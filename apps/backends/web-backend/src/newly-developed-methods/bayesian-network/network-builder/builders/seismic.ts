import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { NetworkBuilderError, valueError } from "../core/errors";
import { errorFunction } from "../core/math-functions";
import type { NodeRecord } from "../core/model";
import {
  decodeRowIndex,
  formatGeneral,
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  iterValues,
  repeat,
  replaceNonAlphanumericRuns,
  strip,
  stripCharacters,
  sum,
  text,
  toFloat,
  truthy,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";

const slug = (token: string): string => {
  const cleaned = stripCharacters(replaceNonAlphanumericRuns(strip(token), "_"), "_");
  return cleaned.length > 0 ? cleaned.toLowerCase() : "x";
};

const normalCdf = (z: number): number => 0.5 * (1 + errorFunction(z / Math.sqrt(2)));

const larger = (first: number, second: number): number => (second > first ? second : first);

const naturalLogarithm = (value: number): number => {
  if (value <= 0) throw valueError("math domain error");
  return Math.log(value);
};

const exponential = (value: number): number => {
  const result = Math.exp(value);
  if (result === Infinity && value !== Infinity) throw new NetworkBuilderError("OverflowError", "math range error");
  return result;
};

interface FragilityBeta {
  beta: number;
  betaR: number | null;
  betaU: number | null;
}

class SeismicBuilder extends BuilderBase {
  get builderType(): string {
    return "seismic";
  }

  get requires(): Set<string> {
    return new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
  }

  get provides(): Set<string> {
    const output = new Set([this.pgaKey()]);
    for (const item of this.sscItems()) {
      if (!truthy(getValueOr(item, "enabled", true))) continue;
      output.add(this.damageKey(SeismicBuilder.requireText(getValue(item, "ssc_id"), "ssc_id")));
    }
    return output;
  }

  build(context: ModelContext): void {
    const pgaKey = this.pgaKey();
    const pgaNodeId = this.pgaNodeId();
    const pgaStatesRef = this.pgaStatesRef();
    const nonNoneStates = context.discretization.states(pgaStatesRef);
    const nonNoneCenters = this.resolvePgaCenters(context, pgaStatesRef, nonNoneStates);
    const includeNone = this.includeNoneState();
    const noneLabel = this.noneStateLabel();
    let pgaStates = nonNoneStates;
    let pgaCenters = nonNoneCenters;
    if (includeNone) {
      if (nonNoneStates.some((state) => state === noneLabel)) {
        throw valueError(
          `Discretization '${pgaStatesRef}' already contains none-state label '${noneLabel}'. ` +
            "Either remove it from discretization states or disable include_none_state.",
        );
      }
      pgaStates = [noneLabel, ...nonNoneStates];
      pgaCenters = [0, ...nonNoneCenters];
    }
    const pgaProbabilities = this.resolvePgaProbabilities(pgaStates, nonNoneStates, includeNone);
    const pgaCpdGenerator = (localContext: ModelContext, node: NodeRecord): number[] =>
      repeat(pgaProbabilities, localContext.model.parentConfigurationCount(node.nodeId));
    context.model.addNode({
      key: pgaKey,
      nodeId: pgaNodeId,
      states: pgaStates,
      metadata: { builder: "seismic", kind: "hazard_im" },
      parentIds: [],
      cpdGenerator: pgaCpdGenerator,
    });
    context.registry.register(pgaKey, pgaNodeId);

    for (const item of this.sscItems()) {
      if (!truthy(getValueOr(item, "enabled", true))) continue;
      const sscId = SeismicBuilder.requireText(getValue(item, "ssc_id"), "ssc_id");
      const theta = SeismicBuilder.requirePositiveFloat(getValue(item, "theta"), `${sscId}.theta`);
      const dispersion = this.resolveFragilityBeta(item, sscId);
      const damageKey = this.damageKey(sscId);
      const customNodeId = strip(text(getValueOr(item, "node_id", "")));
      const damageNodeId = customNodeId.length > 0 ? customNodeId : this.defaultDamageNodeId(sscId);
      const failProbabilities = pgaCenters.map((center) =>
        SeismicBuilder.fragilityFailProbability(center, theta, dispersion.beta),
      );
      SeismicBuilder.checkMonotonic(failProbabilities, sscId);
      context.model.addNode({
        key: damageKey,
        nodeId: damageNodeId,
        states: ["False", "True"],
        metadata: {
          builder: "seismic",
          kind: "damage",
          ssc_id: sscId,
          theta,
          beta: dispersion.beta,
          beta_r: dispersion.betaR,
          beta_u: dispersion.betaU,
          true_means: "failure",
        },
        parentIds: [pgaNodeId],
        cpdGenerator: SeismicBuilder.makeDamageCpdGenerator(pgaKey, failProbabilities),
      });
      context.registry.register(damageKey, damageNodeId);
    }
  }

  private pgaKey(): string {
    return strip(text(getValueOr(this.config, "pga_key", "hazard.seismic.PGA")));
  }

  private pgaNodeId(): string {
    return strip(text(getValueOr(this.config, "pga_node_id", "PGA")));
  }

  private pgaStatesRef(): string {
    return strip(text(getValueOr(this.config, "pga_states_ref", "PGA")));
  }

  private damagePrefix(): string {
    return strip(text(getValueOr(this.config, "damage_key_prefix", "seismic.damage")));
  }

  private damageKey(sscId: string): string {
    return `${this.damagePrefix()}.${sscId}`;
  }

  private defaultDamageNodeId(sscId: string): string {
    return `SEISMIC_FAIL_${slug(sscId).toUpperCase()}`;
  }

  private sscItems(): SpecMapping[] {
    const items = getValue(this.config, "sscs");
    if (!isSequence(items) || items.length === 0) {
      throw valueError("seismic builder requires non-empty 'sscs' list.");
    }
    return items.map((item, index) => {
      if (!isMapping(item)) throw valueError(`seismic.sscs[${index}] must be a mapping/object.`);
      return item;
    });
  }

  private resolvePgaCenters(context: ModelContext, statesRef: string, nonNoneStates: readonly string[]): number[] {
    let centers: number[];
    if (hasKey(this.config, "pga_bin_centers")) {
      const raw = getValue(this.config, "pga_bin_centers");
      if (!isSequence(raw)) throw valueError("seismic.pga_bin_centers must be list-like.");
      centers = raw.map((item) => toFloat(item));
    } else {
      centers = context.discretization.centers(statesRef);
    }
    if (centers.length !== nonNoneStates.length) {
      throw valueError(
        `PGA centers length ${centers.length} must match non-none PGA states length ${nonNoneStates.length}.`,
      );
    }
    if (centers.some((center) => center <= 0)) throw valueError("All non-none PGA centers must be positive.");
    return centers;
  }

  private resolvePgaProbabilities(
    pgaStates: readonly string[],
    nonNoneStates: readonly string[],
    includeNone: boolean,
  ): number[] {
    const probabilitiesGiven = hasKey(this.config, "pga_probs");
    const frequenciesGiven = hasKey(this.config, "pga_bin_frequencies");
    if (probabilitiesGiven && frequenciesGiven) {
      throw valueError("seismic config cannot specify both 'pga_probs' and 'pga_bin_frequencies'.");
    }
    if (!probabilitiesGiven && !frequenciesGiven) {
      throw valueError("seismic config requires either 'pga_probs' or 'pga_bin_frequencies'.");
    }
    if (probabilitiesGiven) return this.resolveFromProbabilities(pgaStates, nonNoneStates, includeNone);
    return this.resolveFromFrequencies(pgaStates, nonNoneStates, includeNone);
  }

  private resolveFromProbabilities(
    pgaStates: readonly string[],
    nonNoneStates: readonly string[],
    includeNone: boolean,
  ): number[] {
    const raw = getValue(this.config, "pga_probs");
    if (!isSequence(raw)) throw valueError("seismic.pga_probs must be list-like.");
    let probabilities = raw.map((item) => toFloat(item));
    if (includeNone && probabilities.length === nonNoneStates.length) {
      const nonNoneSum = sum(probabilities);
      if (nonNoneSum > 1 + 1e-9) {
        throw valueError(`Sum of non-none pga_probs (${formatGeneral(nonNoneSum, 12)}) exceeds 1.0.`);
      }
      probabilities = [larger(0, 1 - nonNoneSum), ...probabilities];
    } else if (probabilities.length !== pgaStates.length) {
      throw valueError(
        `pga_probs length ${probabilities.length} must match PGA state count ${pgaStates.length} ` +
          `(or non-none count ${nonNoneStates.length} when include_none_state=true).`,
      );
    }
    return SeismicBuilder.validateFullProbabilityVector(probabilities, "pga_probs");
  }

  private resolveFromFrequencies(
    pgaStates: readonly string[],
    nonNoneStates: readonly string[],
    includeNone: boolean,
  ): number[] {
    const raw = getValue(this.config, "pga_bin_frequencies");
    if (!isSequence(raw)) throw valueError("seismic.pga_bin_frequencies must be list-like.");
    const frequencies = raw.map((item) => toFloat(item));
    const expectedLength = includeNone ? nonNoneStates.length : pgaStates.length;
    if (frequencies.length !== expectedLength) {
      throw valueError(
        `pga_bin_frequencies length ${frequencies.length} must match ` +
          `${includeNone ? "non-none PGA state count" : "PGA state count"} (${expectedLength}).`,
      );
    }
    if (frequencies.some((frequency) => frequency < -1e-18)) {
      throw valueError("pga_bin_frequencies values must be >= 0.");
    }
    const missionTime = toFloat(getValueOr(this.config, "mission_time", 1));
    if (missionTime <= 0) throw valueError("seismic.mission_time must be > 0 when using frequencies.");
    const mode = strip(text(getValueOr(this.config, "frequency_to_probability", "poisson"))).toLowerCase();
    if (mode !== "poisson" && mode !== "linear") {
      throw valueError("seismic.frequency_to_probability must be 'poisson' or 'linear'.");
    }
    const nonNoneProbabilities =
      mode === "poisson" ?
        frequencies.map((frequency) => 1 - exponential(-frequency * missionTime))
      : frequencies.map((frequency) => frequency * missionTime);
    let probabilities = nonNoneProbabilities;
    if (includeNone) {
      const nonNoneSum = sum(nonNoneProbabilities);
      if (nonNoneSum > 1 + 1e-9) {
        throw valueError(
          `Converted non-none probabilities sum to ${formatGeneral(nonNoneSum, 12)} (>1.0). ` +
            "Adjust frequencies/mission_time or use a different conversion.",
        );
      }
      probabilities = [larger(0, 1 - nonNoneSum), ...nonNoneProbabilities];
    }
    return SeismicBuilder.validateFullProbabilityVector(probabilities, "converted_pga_probs");
  }

  private static validateFullProbabilityVector(probabilities: number[], label: string): number[] {
    if (probabilities.some((probability) => probability < -1e-12 || probability > 1 + 1e-12)) {
      throw valueError(`${label} values must be within [0, 1].`);
    }
    const total = sum(probabilities);
    if (Math.abs(total - 1) > 1e-9) {
      throw valueError(`${label} must sum to 1.0 (got ${formatGeneral(total, 12)}).`);
    }
    return probabilities;
  }

  private includeNoneState(): boolean {
    return truthy(getValueOr(this.config, "include_none_state", false));
  }

  private noneStateLabel(): string {
    const label = strip(text(getValueOr(this.config, "none_state_label", "None")));
    return label.length > 0 ? label : "None";
  }

  private static makeDamageCpdGenerator(pgaKey: string, failProbabilities: readonly number[]) {
    const frozen = Array.from(failProbabilities);
    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const pgaParentId = localContext.registry.nodeId(pgaKey);
      if (!node.parents.includes(pgaParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
      }
      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const pgaPosition = node.parents.indexOf(pgaParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const failProbability = frozen[decodeRowIndex(rowIndex, dimensions)[pgaPosition]];
        output.push(1 - failProbability);
        output.push(failProbability);
      }
      return output;
    };
  }

  private static fragilityFailProbability(pgaCenter: number, theta: number, beta: number): number {
    if (pgaCenter <= 0) return 0;
    const probability = normalCdf(naturalLogarithm(pgaCenter / theta) / beta);
    if (probability < 0) return 0;
    if (probability > 1) return 1;
    return probability;
  }

  private static checkMonotonic(failProbabilities: readonly number[], sscId: string, tolerance = 1e-12): void {
    for (let index = 1; index < failProbabilities.length; index += 1) {
      if (failProbabilities[index] + tolerance < failProbabilities[index - 1]) {
        throw valueError(
          `Non-monotonic seismic fragility for '${sscId}' at bins ${index - 1}->${index}: ` +
            `${formatGeneral(failProbabilities[index - 1], 6)} -> ${formatGeneral(failProbabilities[index], 6)}`,
        );
      }
    }
  }

  private static requireText(value: SpecValue, label: string): string {
    if (typeof value !== "string" || strip(value).length === 0) {
      throw valueError(`seismic.${label} must be a non-empty string.`);
    }
    return strip(value);
  }

  private static parseNumeric(value: SpecValue, label: string): number {
    try {
      return toFloat(value);
    } catch (error) {
      if (error instanceof NetworkBuilderError) throw valueError(`seismic.${label} must be numeric.`);
      throw error;
    }
  }

  private static requirePositiveFloat(value: SpecValue, label: string): number {
    const parsed = SeismicBuilder.parseNumeric(value, label);
    if (parsed <= 0) throw valueError(`seismic.${label} must be > 0.`);
    return parsed;
  }

  private static requireNonNegativeFloat(value: SpecValue, label: string): number {
    const parsed = SeismicBuilder.parseNumeric(value, label);
    if (parsed < 0) throw valueError(`seismic.${label} must be >= 0.`);
    return parsed;
  }

  private resolveFragilityBeta(item: SpecMapping, sscId: string): FragilityBeta {
    const hasBeta = hasKey(item, "beta") && item.beta !== null;
    const hasBetaR = hasKey(item, "beta_r") && item.beta_r !== null;
    const hasBetaU = hasKey(item, "beta_u") && item.beta_u !== null;
    if (hasBeta && (hasBetaR || hasBetaU)) {
      throw valueError(`seismic.sscs[${sscId}] cannot specify both 'beta' and ('beta_r'/'beta_u').`);
    }
    if (hasBeta) {
      return {
        beta: SeismicBuilder.requirePositiveFloat(getValue(item, "beta"), `${sscId}.beta`),
        betaR: null,
        betaU: null,
      };
    }
    if (hasBetaR || hasBetaU) {
      if (!(hasBetaR && hasBetaU)) {
        throw valueError(`seismic.sscs[${sscId}] must provide both 'beta_r' and 'beta_u' together.`);
      }
      const betaR = SeismicBuilder.requireNonNegativeFloat(getValue(item, "beta_r"), `${sscId}.beta_r`);
      const betaU = SeismicBuilder.requireNonNegativeFloat(getValue(item, "beta_u"), `${sscId}.beta_u`);
      const beta = Math.sqrt(betaR * betaR + betaU * betaU);
      if (beta <= 0) throw valueError(`seismic.sscs[${sscId}] requires sqrt(beta_r^2 + beta_u^2) > 0.`);
      return { beta, betaR, betaU };
    }
    throw valueError(`seismic.sscs[${sscId}] must define either 'beta' or both 'beta_r' and 'beta_u'.`);
  }
}

export { SeismicBuilder };
