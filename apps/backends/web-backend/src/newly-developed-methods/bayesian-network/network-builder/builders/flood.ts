import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { NetworkBuilderError, valueError } from "../core/errors";
import { errorFunction } from "../core/math-functions";
import type { CpdGenerator, NodeRecord } from "../core/model";
import {
  decodeRowIndex,
  formatGeneral,
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  iterValues,
  keysOf,
  repeat,
  replaceNonAlphanumericRuns,
  repr,
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

const largest = (first: number, ...rest: number[]): number => {
  let best = first;
  for (const value of rest) {
    if (value > best) best = value;
  }
  return best;
};

const exponential = (value: number): number => {
  const result = Math.exp(value);
  if (result === Infinity && value !== Infinity) throw new NetworkBuilderError("OverflowError", "math range error");
  return result;
};

const logarithm = (value: number): number => {
  if (value <= 0) throw valueError("math domain error");
  return Math.log(value);
};

const textOr = (value: SpecValue, fallback: () => string): string => {
  const stripped = strip(text(value));
  return stripped.length > 0 ? stripped : fallback();
};

interface SurfaceParameters {
  c0: number;
  c1: number;
  c2: number;
  betaGlobal: number;
}

interface BreachModel {
  stabilityNoneMode: string;
  pgaEpsilon: number;
  combineMode: string;
  pipingWhenSeismic: string;
  attenuateFactor: number;
  pRand: number;
  pipingType: string;
  medianResistance: number;
  betaResistance: number;
  pipingProbabilities: number[];
}

interface IntactTail {
  waveThreshold: number;
  shallowProbability: number;
  shallowIndex: number;
  noneIndex: number;
}

interface AttenuationState {
  scale: number;
  decay: number;
  useExcessOverCrest: boolean;
}

interface Attenuation {
  Overtopped: AttenuationState;
  Breached: AttenuationState;
}

interface AttenuationDefaults {
  scale: number;
  decay: number;
  useExcessOverCrest: boolean;
}

interface WaveHazard {
  waveStates: string[];
  defenseWaveCenters: number[];
  defenseWaveOvertopValues: number[];
  areaWaveCenters: number[];
  areaWaveOvertopValues: number[];
}

interface DefenseRecord {
  nodeId: string;
  crestHeight: number;
}

interface AreaRecord {
  nodeId: string;
  centers: number[];
}

interface DefenseGeneratorInput {
  pgaKey: string | null;
  waveKey: string;
  pgaNoneLabel: string;
  waveNoneLabel: string;
  pgaCenters: readonly number[];
  waveCenters: readonly number[];
  waveOvertopValues: readonly number[];
  crestHeight: number;
  surface: SurfaceParameters;
  breachModel: BreachModel;
}

interface PropagationGeneratorInput {
  waveKey: string;
  defenseKey: string;
  allowExtraParents: boolean;
  waveNoneLabel: string;
  waveCenters: readonly number[];
  waveOvertopValues: readonly number[];
  depthStates: readonly string[];
  depthCenters: readonly number[];
  depthNoneIndex: number | null;
  crestHeight: number;
  intactDistribution: readonly number[];
  intactTail: IntactTail | null;
  distance: number;
  attenuation: Attenuation;
}

interface BreachInput {
  pgaState: string;
  pgaNoneLabel: string;
  pgaValue: number;
  waveIndex: number;
  waveState: string;
  waveNoneLabel: string;
  waveValue: number;
  surface: SurfaceParameters;
  breachModel: BreachModel;
}

class FloodBuilder extends BuilderBase {
  private static readonly defenseStates = ["Intact", "Overtopped", "Breached"];

  get builderType(): string {
    return "flood";
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    if (truthy(getValueOr(this.config, "require_pga", false))) required.add(this.pgaKey());
    if (getValue(this.config, "wave_given_pga") !== null) required.add(this.pgaKey());
    return required;
  }

  get provides(): Set<string> {
    const output = new Set([this.waveKey()]);
    for (const item of this.defenseItems()) {
      const defenseId = FloodBuilder.requireText(getValue(item, "defense_id"), "defense_id");
      output.add(textOr(getValueOr(item, "key", ""), () => this.defenseKey(defenseId)));
    }
    for (const item of this.areaItems()) {
      const areaId = FloodBuilder.requireText(getValue(item, "area_id"), "area_id");
      output.add(textOr(getValueOr(item, "key", ""), () => this.siteDepthKey(areaId)));
    }
    for (const item of this.outsideSscItems()) {
      const sscId = FloodBuilder.requireText(getValue(item, "ssc_id"), "ssc_id");
      output.add(textOr(getValueOr(item, "key", ""), () => this.outsideDamageKey(sscId)));
    }
    return output;
  }

  build(context: ModelContext): void {
    const pgaKey = this.pgaKey();
    const pgaNoneLabel = this.pgaNoneStateLabel();
    const pgaAvailable = context.registry.hasKey(pgaKey);
    let pgaNodeId: string | null = null;
    let pgaStates: string[];
    let pgaCenters: number[];
    if (pgaAvailable) {
      pgaNodeId = context.registry.nodeId(pgaKey);
      pgaStates = context.model.node(pgaNodeId).states;
      pgaCenters = this.resolvePgaCenters(context, pgaStates);
    } else {
      pgaStates = [pgaNoneLabel];
      pgaCenters = [0];
    }

    const hazard = this.buildWaveHazard(context, pgaKey, pgaAvailable, pgaNodeId, pgaStates);
    const waveKey = this.waveKey();
    const waveNodeId = context.registry.nodeId(waveKey);
    const waveNoneLabel = this.waveNoneStateLabel();

    const defenseRecords = new Map<string, DefenseRecord>();
    for (const item of this.defenseItems()) {
      const defenseId = FloodBuilder.requireText(getValue(item, "defense_id"), "defense_id");
      const defenseKey = textOr(getValueOr(item, "key", ""), () => this.defenseKey(defenseId));
      const defenseNodeId = textOr(getValueOr(item, "node_id", ""), () => this.defaultDefenseNodeId(defenseId));
      const crestHeight = FloodBuilder.requireNonNegativeFloat(getValue(item, "h_crest"), `${defenseId}.h_crest`);
      const surface = this.surfaceParameters(item, defenseId);
      const breachModel = this.parseBreachModel(item, defenseId, hazard.waveStates, waveNoneLabel);
      const defenseCpdGenerator = this.makeDefenseCpdGenerator({
        pgaKey: pgaAvailable ? pgaKey : null,
        waveKey,
        pgaNoneLabel,
        waveNoneLabel,
        pgaCenters,
        waveCenters: hazard.defenseWaveCenters,
        waveOvertopValues: hazard.defenseWaveOvertopValues,
        crestHeight,
        surface,
        breachModel,
      });
      const defenseParentIds = [waveNodeId];
      if (pgaAvailable && pgaNodeId !== null) defenseParentIds.push(pgaNodeId);
      context.model.addNode({
        key: defenseKey,
        nodeId: defenseNodeId,
        states: FloodBuilder.defenseStates,
        metadata: {
          builder: "flood",
          kind: "defense_state",
          defense_id: defenseId,
          h_crest: crestHeight,
          breach_combine_mode: breachModel.combineMode,
          piping_when_seismic: breachModel.pipingWhenSeismic,
        },
        parentIds: defenseParentIds,
        cpdGenerator: defenseCpdGenerator,
      });
      context.registry.register(defenseKey, defenseNodeId);
      defenseRecords.set(defenseKey, { nodeId: defenseNodeId, crestHeight });
    }

    const areaRecords = new Map<string, AreaRecord>();
    for (const item of this.areaItems()) {
      const areaId = FloodBuilder.requireText(getValue(item, "area_id"), "area_id");
      const areaKey = textOr(getValueOr(item, "key", ""), () => this.siteDepthKey(areaId));
      const areaNodeId = textOr(getValueOr(item, "node_id", ""), () => this.defaultAreaNodeId(areaId));
      const defenseKey = FloodBuilder.requireText(getValue(item, "defense_key"), `${areaId}.defense_key`);
      const defenseRecord = defenseRecords.get(defenseKey);
      if (defenseRecord === undefined) {
        throw valueError(`Area '${areaId}' references unknown defense key '${defenseKey}'.`);
      }
      const defenseNodeId = defenseRecord.nodeId;
      const crestHeight = defenseRecord.crestHeight;

      const statesRef = strip(text(getValueOr(item, "states_ref", this.siteDepthStatesRef())));
      const depthStates = context.discretization.states(statesRef);
      const depthNoneLabel = strip(text(getValueOr(item, "none_state_label", this.depthNoneStateLabel())));
      const depthCenters = this.resolveDepthCenters(context, item, statesRef, depthStates, depthNoneLabel);
      const depthNoneIndex = FloodBuilder.findStateIndex(depthStates, depthNoneLabel);

      const intactDistribution = this.resolveIntactDistribution(item, depthStates, depthNoneIndex);
      const intactTail = this.resolveIntactShallowTail(item, depthStates, depthNoneIndex);
      const distance = FloodBuilder.requireNonNegativeFloat(getValueOr(item, "distance_x", 0), `${areaId}.distance_x`);
      const attenuation = this.resolveAttenuation(item, areaId);

      const propagationCpdGenerator = this.makePropagationCpdGenerator({
        waveKey,
        defenseKey,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
        waveNoneLabel,
        waveCenters: hazard.areaWaveCenters,
        waveOvertopValues: hazard.areaWaveOvertopValues,
        depthStates,
        depthCenters,
        depthNoneIndex,
        crestHeight,
        intactDistribution,
        intactTail,
        distance,
        attenuation,
      });

      context.model.addNode({
        key: areaKey,
        nodeId: areaNodeId,
        states: depthStates,
        metadata: {
          builder: "flood",
          kind: "site_depth",
          area_id: areaId,
          defense_key: defenseKey,
        },
        parentIds: [waveNodeId, defenseNodeId],
        cpdGenerator: propagationCpdGenerator,
      });
      context.registry.register(areaKey, areaNodeId);
      areaRecords.set(areaKey, { nodeId: areaNodeId, centers: depthCenters });
    }

    for (const item of this.outsideSscItems()) {
      const sscId = FloodBuilder.requireText(getValue(item, "ssc_id"), "ssc_id");
      const damageKey = textOr(getValueOr(item, "key", ""), () => this.outsideDamageKey(sscId));
      const damageNodeId = textOr(getValueOr(item, "node_id", ""), () => this.defaultOutsideDamageNodeId(sscId));

      let areaKey: string;
      if (hasKey(item, "area_key")) {
        areaKey = FloodBuilder.requireText(getValue(item, "area_key"), `${sscId}.area_key`);
      } else {
        const areaId = FloodBuilder.requireText(getValue(item, "area_id"), `${sscId}.area_id`);
        areaKey = this.siteDepthKey(areaId);
      }

      const areaRecord = areaRecords.get(areaKey);
      if (areaRecord === undefined) {
        throw valueError(`Outside SSC '${sscId}' references unknown area key '${areaKey}'.`);
      }
      const areaNodeId = areaRecord.nodeId;
      const depthCenters = areaRecord.centers;

      const theta = FloodBuilder.requirePositiveFloat(getValue(item, "theta"), `${sscId}.theta`);
      const beta = FloodBuilder.requirePositiveFloat(getValue(item, "beta"), `${sscId}.beta`);
      const failProbabilities = depthCenters.map((center) =>
        FloodBuilder.fragilityFailProbability(center, theta, beta),
      );
      FloodBuilder.checkMonotonic(failProbabilities, sscId);

      context.model.addNode({
        key: damageKey,
        nodeId: damageNodeId,
        states: ["False", "True"],
        metadata: {
          builder: "flood",
          kind: "outside_damage",
          ssc_id: sscId,
          theta,
          beta,
          true_means: "failure",
        },
        parentIds: [areaNodeId],
        cpdGenerator: FloodBuilder.makeDamageCpdGenerator(areaKey, failProbabilities),
      });
      context.registry.register(damageKey, damageNodeId);
    }
  }

  private buildWaveHazard(
    context: ModelContext,
    pgaKey: string,
    pgaAvailable: boolean,
    pgaNodeId: string | null,
    pgaStates: readonly string[],
  ): WaveHazard {
    const waveRef = this.waveStatesRef();
    const nonNoneStates = context.discretization.states(waveRef);
    const nonNoneCentersOffshore = this.resolveWaveNonNoneCenters(context, nonNoneStates, waveRef);
    const nonNoneOvertopValuesOffshore = this.resolveWaveNonNoneOvertopValues(nonNoneStates, nonNoneCentersOffshore);
    const nonNoneCentersEffective = this.applyWaveToDefenseTransform(nonNoneCentersOffshore, "wave_bin_centers");
    const nonNoneOvertopValuesEffective = this.applyWaveToDefenseTransform(
      nonNoneOvertopValuesOffshore,
      "wave_bin_upper_edges",
    );
    const includeNone = this.waveIncludeNoneState();
    const noneLabel = this.waveNoneStateLabel();
    let waveStates = nonNoneStates;
    let waveCentersEffective = nonNoneCentersEffective;
    let waveOvertopValuesEffective = nonNoneOvertopValuesEffective;
    let waveCentersOffshore = nonNoneCentersOffshore;
    let waveOvertopValuesOffshore = nonNoneOvertopValuesOffshore;
    if (includeNone) {
      if (nonNoneStates.some((state) => state === noneLabel)) {
        throw valueError(`Wave discretization '${waveRef}' already contains none-state label '${noneLabel}'.`);
      }
      waveStates = [noneLabel, ...nonNoneStates];
      waveCentersEffective = [0, ...nonNoneCentersEffective];
      waveOvertopValuesEffective = [0, ...nonNoneOvertopValuesEffective];
      waveCentersOffshore = [0, ...nonNoneCentersOffshore];
      waveOvertopValuesOffshore = [0, ...nonNoneOvertopValuesOffshore];
    }

    const probabilities = this.resolveWaveProbabilities(waveStates, nonNoneStates, includeNone);
    const waveGivenPga = this.resolveWaveGivenPga(waveStates, pgaStates, noneLabel) ?? new Map<string, number[]>();

    const waveKey = this.waveKey();
    const waveNodeId = this.waveNodeId();
    let waveParentIds: string[] = [];
    if (waveGivenPga.size > 0) {
      if (!pgaAvailable || pgaNodeId === null) {
        throw valueError(
          "flood.wave_given_pga is configured but no seismic PGA node is available. " +
            "Add a seismic builder, or remove wave_given_pga for flood-only mode.",
        );
      }
      waveParentIds = [pgaNodeId];
    }

    const waveCpdGenerator = (localContext: ModelContext, node: NodeRecord): number[] => {
      const rowCount = localContext.model.parentConfigurationCount(node.nodeId);
      if (waveGivenPga.size === 0) return repeat(probabilities, rowCount);

      const pgaParentId = localContext.registry.nodeId(pgaKey);
      if (!node.parents.includes(pgaParentId)) {
        throw valueError(`wave_given_pga configured but node '${node.nodeId}' is missing PGA parent.`);
      }

      const localPgaStates = localContext.model.node(pgaParentId).states;
      const missing = localPgaStates.filter((state) => !waveGivenPga.has(state));
      if (missing.length > 0) {
        throw valueError(`wave_given_pga rows missing PGA states ${repr(missing)} for node '${node.nodeId}'.`);
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const pgaPosition = node.parents.indexOf(pgaParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        const row = waveGivenPga.get(localPgaStates[indexes[pgaPosition]]) ?? [];
        for (const value of row) output.push(value);
      }
      return output;
    };

    context.model.addNode({
      key: waveKey,
      nodeId: waveNodeId,
      states: waveStates,
      metadata: { builder: "flood", kind: "hazard_wave" },
      parentIds: waveParentIds,
      cpdGenerator: waveCpdGenerator,
    });
    context.registry.register(waveKey, waveNodeId);
    const useEffective = this.siteDepthUseEffectiveWave();
    return {
      waveStates,
      defenseWaveCenters: waveCentersEffective,
      defenseWaveOvertopValues: waveOvertopValuesEffective,
      areaWaveCenters: useEffective ? waveCentersEffective : waveCentersOffshore,
      areaWaveOvertopValues: useEffective ? waveOvertopValuesEffective : waveOvertopValuesOffshore,
    };
  }

  private resolveWaveGivenPga(
    waveStates: readonly string[],
    pgaStates: readonly string[],
    waveNoneLabel: string,
  ): Map<string, number[]> | null {
    const raw = getValue(this.config, "wave_given_pga");
    if (raw === null) return null;
    if (!isMapping(raw)) throw valueError("flood.wave_given_pga must be an object/mapping when provided.");

    const rowsRaw = getValueOr(raw, "rows", raw);
    if (!isMapping(rowsRaw)) throw valueError("flood.wave_given_pga.rows must be an object/mapping.");

    const output = new Map<string, number[]>();
    for (const pgaState of keysOf(rowsRaw)) {
      const row = rowsRaw[pgaState];
      const label = `wave_given_pga[${pgaState}]`;
      if (!isSequence(row)) throw valueError(`${label} must be a list of probabilities.`);
      const values = row.map((item) => toFloat(item));
      output.set(pgaState, FloodBuilder.mapProbabilitiesToStates(values, waveStates, waveNoneLabel, label));
    }

    const missing = pgaStates.filter((state) => !output.has(state));
    if (missing.length > 0) {
      throw valueError(`flood.wave_given_pga missing rows for PGA states: ${repr(missing)}.`);
    }
    const extra = Array.from(output.keys()).filter((state) => !pgaStates.includes(state));
    if (extra.length > 0) {
      throw valueError(`flood.wave_given_pga has unknown PGA rows not in model states: ${repr(extra)}.`);
    }
    return output;
  }

  private makeDefenseCpdGenerator(input: DefenseGeneratorInput): CpdGenerator {
    const frozenPgaKey = input.pgaKey;
    const frozenPgaCenters = Array.from(input.pgaCenters);
    const frozenWaveCenters = Array.from(input.waveCenters);
    const frozenWaveOvertopValues = Array.from(input.waveOvertopValues);
    const frozenSurface = { ...input.surface };
    const frozenBreachModel = { ...input.breachModel };
    const { waveKey, pgaNoneLabel, waveNoneLabel, crestHeight } = input;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      let pgaParentId: string | null = null;
      if (frozenPgaKey !== null && frozenPgaKey.length > 0 && localContext.registry.hasKey(frozenPgaKey)) {
        pgaParentId = localContext.registry.nodeId(frozenPgaKey);
      }
      const waveParentId = localContext.registry.nodeId(waveKey);
      if (!node.parents.includes(waveParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required wave parent '${waveParentId}'.`);
      }
      const waveStates = localContext.model.node(waveParentId).states;
      if (waveStates.length !== frozenWaveCenters.length) {
        throw valueError(`Wave states/centers mismatch in node '${node.nodeId}'.`);
      }
      if (waveStates.length !== frozenWaveOvertopValues.length) {
        throw valueError(`Wave states/overtop-values mismatch in node '${node.nodeId}'.`);
      }
      const hasPgaParent = pgaParentId !== null && node.parents.includes(pgaParentId);
      let pgaStates: string[] = [pgaNoneLabel];
      if (hasPgaParent && pgaParentId !== null) {
        pgaStates = localContext.model.node(pgaParentId).states;
        if (pgaStates.length !== frozenPgaCenters.length) {
          throw valueError(`PGA states/centers mismatch in node '${node.nodeId}'.`);
        }
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const pgaPosition = hasPgaParent && pgaParentId !== null ? node.parents.indexOf(pgaParentId) : null;
      const wavePosition = node.parents.indexOf(waveParentId);

      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        const waveIndex = indexes[wavePosition];
        let pgaState = pgaNoneLabel;
        let pgaValue = 0;
        if (pgaPosition !== null) {
          const pgaIndex = indexes[pgaPosition];
          pgaState = pgaStates[pgaIndex];
          pgaValue = frozenPgaCenters[pgaIndex];
        }
        const waveState = waveStates[waveIndex];
        const waveValue = frozenWaveCenters[waveIndex];
        const waveOvertopValue = frozenWaveOvertopValues[waveIndex];

        const breachProbability = FloodBuilder.clamp01(
          FloodBuilder.combinedBreachProbability({
            pgaState,
            pgaNoneLabel,
            pgaValue: largest(0, pgaValue),
            waveIndex,
            waveState,
            waveNoneLabel,
            waveValue: largest(0, waveValue),
            surface: frozenSurface,
            breachModel: frozenBreachModel,
          }),
        );

        const overtopped = waveState !== waveNoneLabel && waveOvertopValue > crestHeight;
        if (overtopped) {
          output.push(0, 1 - breachProbability, breachProbability);
        } else {
          output.push(1 - breachProbability, 0, breachProbability);
        }
      }
      return output;
    };
  }

  private static combinedBreachProbability(input: BreachInput): number {
    const { breachModel, surface } = input;
    const stabilityNoneMode = strip(breachModel.stabilityNoneMode).toLowerCase();
    let pgaForStability = input.pgaValue;
    if (input.pgaState === input.pgaNoneLabel) {
      pgaForStability = stabilityNoneMode === "epsilon" ? breachModel.pgaEpsilon : 0;
    }

    const stabilityProbability = FloodBuilder.breachFromSurface(
      largest(0, pgaForStability),
      input.waveValue,
      surface.c0,
      surface.c1,
      surface.c2,
      surface.betaGlobal,
    );

    let pipingProbability = FloodBuilder.pipingFailProbability(
      input.waveIndex,
      input.waveState,
      input.waveNoneLabel,
      input.waveValue,
      breachModel,
    );
    const randomProbability = FloodBuilder.clamp01(breachModel.pRand);

    const seismicActive = input.pgaState !== input.pgaNoneLabel && input.pgaValue > 0;
    if (seismicActive) {
      const pipingPolicy = strip(breachModel.pipingWhenSeismic).toLowerCase();
      if (pipingPolicy === "block") {
        pipingProbability = 0;
      } else if (pipingPolicy === "attenuate") {
        pipingProbability = FloodBuilder.clamp01(pipingProbability * breachModel.attenuateFactor);
      }
    }

    const combineMode = strip(breachModel.combineMode).toLowerCase();
    const breachProbability =
      combineMode === "noisy_or" ?
        1 - (1 - stabilityProbability) * (1 - pipingProbability) * (1 - randomProbability)
      : largest(stabilityProbability, pipingProbability, randomProbability);
    return FloodBuilder.clamp01(breachProbability);
  }

  private static pipingFailProbability(
    waveIndex: number,
    waveState: string,
    waveNoneLabel: string,
    waveValue: number,
    breachModel: BreachModel,
  ): number {
    if (waveState === waveNoneLabel) return 0;
    const pipingType = strip(breachModel.pipingType).toLowerCase();
    if (pipingType === "none") return 0;
    if (pipingType === "lognormal") {
      return FloodBuilder.fragilityFailProbability(
        largest(0, waveValue),
        breachModel.medianResistance,
        breachModel.betaResistance,
      );
    }
    if (pipingType === "table") {
      const table = breachModel.pipingProbabilities;
      if (table.length === 0) return 0;
      let index = waveIndex;
      if (index < 0 || index >= table.length) index = Math.min(Math.max(index, 0), table.length - 1);
      return FloodBuilder.clamp01(table[index]);
    }
    throw valueError(`Unsupported piping_type '${pipingType}'.`);
  }

  private makePropagationCpdGenerator(input: PropagationGeneratorInput): CpdGenerator {
    const frozenWaveCenters = Array.from(input.waveCenters);
    const frozenWaveOvertopValues = Array.from(input.waveOvertopValues);
    const frozenDepthStates = Array.from(input.depthStates);
    const frozenDepthCenters = Array.from(input.depthCenters);
    const frozenIntactDistribution = Array.from(input.intactDistribution);
    const frozenIntactTail = input.intactTail === null ? null : { ...input.intactTail };
    const frozenAttenuation: Attenuation = {
      Overtopped: { ...input.attenuation.Overtopped },
      Breached: { ...input.attenuation.Breached },
    };
    const frozenAllowExtra = input.allowExtraParents;
    const { waveKey, defenseKey, waveNoneLabel, depthNoneIndex, crestHeight, distance } = input;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const waveParentId = localContext.registry.nodeId(waveKey);
      const defenseParentId = localContext.registry.nodeId(defenseKey);
      if (!node.parents.includes(waveParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required wave parent '${waveParentId}'.`);
      }
      if (!node.parents.includes(defenseParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required defense parent '${defenseParentId}'.`);
      }

      if (!frozenAllowExtra) {
        const extras = node.parents.filter((parentId) => parentId !== waveParentId && parentId !== defenseParentId);
        if (extras.length > 0) {
          throw valueError(
            `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
              "Remove the coupling or set allow_extra_parents=true for this area.",
          );
        }
      }

      const waveStates = localContext.model.node(waveParentId).states;
      const defenseStates = localContext.model.node(defenseParentId).states;
      if (waveStates.length !== frozenWaveCenters.length) {
        throw valueError(`Wave states/centers mismatch in node '${node.nodeId}'.`);
      }
      if (waveStates.length !== frozenWaveOvertopValues.length) {
        throw valueError(`Wave states/overtop-values mismatch in node '${node.nodeId}'.`);
      }

      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const wavePosition = node.parents.indexOf(waveParentId);
      const defensePosition = node.parents.indexOf(defenseParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];

      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indexes = decodeRowIndex(rowIndex, dimensions);
        const waveIndex = indexes[wavePosition];
        const waveState = waveStates[waveIndex];
        const defenseState = defenseStates[indexes[defensePosition]];
        const waveValue = frozenWaveCenters[waveIndex];
        const waveOvertopValue = frozenWaveOvertopValues[waveIndex];

        let distribution: readonly number[];
        if (waveState === waveNoneLabel) {
          distribution = FloodBuilder.noneDepthDistribution(frozenDepthStates.length, depthNoneIndex);
        } else if (defenseState === "Intact") {
          distribution = FloodBuilder.maybeApplyIntactTail(
            frozenIntactDistribution,
            waveValue,
            frozenDepthStates,
            depthNoneIndex,
            frozenIntactTail,
          );
        } else if (defenseState === "Overtopped" || defenseState === "Breached") {
          const parameters = frozenAttenuation[defenseState];
          let inflowHeight = waveValue;
          if (parameters.useExcessOverCrest) inflowHeight = largest(0, waveOvertopValue - crestHeight);
          const depthValue = parameters.scale * inflowHeight * Math.exp(-parameters.decay * distance);
          distribution = FloodBuilder.valueToDepthDistribution(depthValue, frozenDepthCenters, depthNoneIndex);
        } else {
          distribution = FloodBuilder.noneDepthDistribution(frozenDepthStates.length, depthNoneIndex);
        }
        for (const value of distribution) output.push(value);
      }
      return output;
    };
  }

  private static makeDamageCpdGenerator(areaKey: string, failProbabilities: readonly number[]): CpdGenerator {
    const frozen = Array.from(failProbabilities);
    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const areaParentId = localContext.registry.nodeId(areaKey);
      if (!node.parents.includes(areaParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required depth parent '${areaParentId}'.`);
      }
      const dimensions = node.parents.map((parentId) => localContext.model.card(parentId));
      const areaPosition = node.parents.indexOf(areaParentId);
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const output: number[] = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const failProbability = frozen[decodeRowIndex(rowIndex, dimensions)[areaPosition]];
        output.push(1 - failProbability);
        output.push(failProbability);
      }
      return output;
    };
  }

  private static breachFromSurface(
    pga: number,
    wave: number,
    c0: number,
    c1: number,
    c2: number,
    beta: number,
  ): number {
    if (pga <= 0) return 0;
    const logMedian = c0 + c1 * wave + c2 * wave * wave;
    const median = exponential(logMedian);
    if (median <= 0 || beta <= 0) return 0;
    const z = (logarithm(pga) - logarithm(median)) / beta;
    return FloodBuilder.clamp01(normalCdf(z));
  }

  private surfaceParameters(item: SpecMapping, defenseId: string): SurfaceParameters {
    const surface = getValueOr(item, "fragility_surface", item);
    if (!isMapping(surface)) {
      throw valueError(`flood.defenses[${defenseId}].fragility_surface must be an object/mapping.`);
    }
    return {
      c0: FloodBuilder.requireFloat(getValue(surface, "c0"), `${defenseId}.fragility_surface.c0`),
      c1: FloodBuilder.requireFloat(getValue(surface, "c1"), `${defenseId}.fragility_surface.c1`),
      c2: FloodBuilder.requireFloat(getValue(surface, "c2"), `${defenseId}.fragility_surface.c2`),
      betaGlobal: FloodBuilder.requirePositiveFloat(
        getValue(surface, "beta_global"),
        `${defenseId}.fragility_surface.beta_global`,
      ),
    };
  }

  private parseBreachModel(
    item: SpecMapping,
    defenseId: string,
    waveStates: readonly string[],
    waveNoneLabel: string,
  ): BreachModel {
    const rawModel = getValue(item, "breach_model");
    let model: SpecMapping;
    if (rawModel === null) {
      model = {};
    } else if (isMapping(rawModel)) {
      model = rawModel;
    } else {
      throw valueError(`${defenseId}.breach_model must be a mapping/object when provided.`);
    }

    const rawLegacy = getValueOr(item, "pga_none_policy", {});
    let legacy: SpecMapping;
    if (typeof rawLegacy === "string") {
      legacy = { mode: rawLegacy };
    } else if (isMapping(rawLegacy)) {
      legacy = rawLegacy;
    } else {
      throw valueError(`${defenseId}.pga_none_policy must be either a string or mapping/object.`);
    }

    const legacyMode = strip(text(getValueOr(legacy, "mode", "flood_only_modes"))).toLowerCase();
    if (legacyMode !== "flood_only_modes" && legacyMode !== "epsilon") {
      throw valueError(
        `Unsupported ${defenseId}.pga_none_policy.mode='${legacyMode}'. ` + "Use 'flood_only_modes' or 'epsilon'.",
      );
    }

    const stabilityNoneMode = strip(
      text(getValueOr(model, "stability_none_mode", legacyMode === "epsilon" ? "epsilon" : "zero")),
    ).toLowerCase();
    if (stabilityNoneMode !== "zero" && stabilityNoneMode !== "epsilon") {
      throw valueError(`${defenseId}.breach_model.stability_none_mode must be 'zero' or 'epsilon'.`);
    }
    const pgaEpsilon = FloodBuilder.requirePositiveFloat(
      getValueOr(model, "pga_epsilon", getValueOr(legacy, "pga_epsilon", 1e-6)),
      `${defenseId}.breach_model.pga_epsilon`,
    );

    const combineMode = strip(text(getValueOr(model, "combine_mode", "max"))).toLowerCase();
    if (combineMode !== "max" && combineMode !== "noisy_or") {
      throw valueError(`${defenseId}.breach_model.combine_mode must be one of: max, noisy_or.`);
    }

    const pipingWhenSeismic = strip(text(getValueOr(model, "piping_when_seismic", "full"))).toLowerCase();
    if (pipingWhenSeismic !== "full" && pipingWhenSeismic !== "attenuate" && pipingWhenSeismic !== "block") {
      throw valueError(`${defenseId}.breach_model.piping_when_seismic must be one of: full, attenuate, block.`);
    }
    const attenuateFactor = FloodBuilder.clamp01(toFloat(getValueOr(model, "attenuate_factor", 1)));

    let randomConfig = getValueOr(model, "random", {});
    if (randomConfig === null) randomConfig = {};
    if (!isMapping(randomConfig)) throw valueError(`${defenseId}.breach_model.random must be a mapping/object.`);
    const pRand = FloodBuilder.clamp01(toFloat(getValueOr(randomConfig, "p_rand", getValueOr(legacy, "p_rand", 0))));

    let pipingConfig = getValue(model, "piping");
    if (pipingConfig === null) pipingConfig = getValueOr(legacy, "piping", {});
    if (pipingConfig === null) pipingConfig = {};
    if (!isMapping(pipingConfig)) throw valueError(`${defenseId}.breach_model.piping must be a mapping/object.`);

    let pipingType = strip(text(getValueOr(pipingConfig, "type", ""))).toLowerCase();
    if (pipingType.length === 0 && hasKey(pipingConfig, "m_R") && hasKey(pipingConfig, "beta_R")) {
      pipingType = "lognormal";
    }
    if (pipingType.length === 0 && hasKey(pipingConfig, "probs")) pipingType = "table";
    if (pipingType.length === 0) pipingType = "none";

    const output: BreachModel = {
      stabilityNoneMode,
      pgaEpsilon,
      combineMode,
      pipingWhenSeismic,
      attenuateFactor,
      pRand,
      pipingType,
      medianResistance: 0,
      betaResistance: 0,
      pipingProbabilities: [],
    };
    if (pipingType === "lognormal") {
      output.medianResistance = FloodBuilder.requirePositiveFloat(
        getValue(pipingConfig, "m_R"),
        `${defenseId}.breach_model.piping.m_R`,
      );
      output.betaResistance = FloodBuilder.requirePositiveFloat(
        getValue(pipingConfig, "beta_R"),
        `${defenseId}.breach_model.piping.beta_R`,
      );
    } else if (pipingType === "table") {
      const rawProbabilities = getValue(pipingConfig, "probs");
      if (!isSequence(rawProbabilities)) {
        throw valueError(`${defenseId}.breach_model.piping.probs must be list-like for table mode.`);
      }
      let probabilities = rawProbabilities.map((value) => toFloat(value));
      if (probabilities.length !== waveStates.length) {
        if (probabilities.length === waveStates.length - 1 && waveStates.includes(waveNoneLabel)) {
          const expanded: number[] = [];
          let position = 0;
          for (const state of waveStates) {
            if (state === waveNoneLabel) {
              expanded.push(0);
            } else {
              expanded.push(probabilities[position]);
              position += 1;
            }
          }
          probabilities = expanded;
        } else {
          throw valueError(
            `${defenseId}.breach_model.piping.probs length ${probabilities.length} must match wave states ` +
              `(${waveStates.length}) or non-none states when a wave none state is present.`,
          );
        }
      }
      if (probabilities.some((probability) => probability < -1e-12 || probability > 1 + 1e-12)) {
        throw valueError(`${defenseId}.breach_model.piping.probs values must be in [0,1].`);
      }
      output.pipingProbabilities = probabilities;
    } else if (pipingType !== "none") {
      throw valueError(
        `Unsupported ${defenseId}.breach_model.piping.type='${pipingType}'. ` + "Use 'none', 'lognormal', or 'table'.",
      );
    }
    return output;
  }

  private resolveIntactDistribution(
    item: SpecMapping,
    depthStates: readonly string[],
    depthNoneIndex: number | null,
  ): number[] {
    const raw = getValue(item, "intact_distribution");
    const count = depthStates.length;
    if (raw === null) {
      const output = new Array<number>(count).fill(0);
      output[depthNoneIndex === null ? 0 : depthNoneIndex] = 1;
      return output;
    }
    if (!isSequence(raw)) throw valueError("area.intact_distribution must be list-like when provided.");
    const values = raw.map((value) => toFloat(value));
    if (values.length !== count) {
      throw valueError(`area.intact_distribution length ${values.length} must match state count ${count}.`);
    }
    if (values.some((value) => value < -1e-12 || value > 1 + 1e-12)) {
      throw valueError("area.intact_distribution values must be in [0,1].");
    }
    const total = sum(values);
    if (Math.abs(total - 1) > 1e-9) {
      throw valueError(`area.intact_distribution must sum to 1.0 (got ${formatGeneral(total, 12)}).`);
    }
    return values;
  }

  private resolveIntactShallowTail(
    item: SpecMapping,
    depthStates: readonly string[],
    depthNoneIndex: number | null,
  ): IntactTail | null {
    const raw = getValue(item, "intact_shallow_tail");
    if (raw === null) return null;
    if (!isMapping(raw)) throw valueError("area.intact_shallow_tail must be an object/mapping.");
    const waveThreshold = FloodBuilder.requireNonNegativeFloat(
      getValue(raw, "wave_threshold"),
      "intact_shallow_tail.wave_threshold",
    );
    const shallowProbability = FloodBuilder.clamp01(toFloat(getValueOr(raw, "shallow_prob", 0)));
    if (depthNoneIndex === null) {
      throw valueError("area.intact_shallow_tail requires a depth none state (e.g., 'None').");
    }
    const shallowIndex = FloodBuilder.firstNonNoneStateIndex(depthStates, depthNoneIndex);
    if (shallowIndex === null) {
      throw valueError("area.intact_shallow_tail requires at least one non-none depth state.");
    }
    return { waveThreshold, shallowProbability, shallowIndex, noneIndex: depthNoneIndex };
  }

  private resolveAttenuation(item: SpecMapping, areaId: string): Attenuation {
    const raw = getValueOr(item, "attenuation", {});
    if (!isMapping(raw)) throw valueError(`${areaId}.attenuation must be an object/mapping.`);

    const parseState = (name: string, defaults: AttenuationDefaults): AttenuationState => {
      let stateRaw = getValueOr(raw, name, {});
      if (stateRaw === null) stateRaw = {};
      if (!isMapping(stateRaw)) {
        throw valueError(`${areaId}.attenuation.${name} must be an object/mapping when provided.`);
      }
      const merged: SpecMapping = {
        k_s: defaults.scale,
        alpha_s: defaults.decay,
        use_excess_over_crest: defaults.useExcessOverCrest,
      };
      for (const key of keysOf(stateRaw)) merged[key] = stateRaw[key];
      return {
        scale: FloodBuilder.requireNonNegativeFloat(getValue(merged, "k_s"), `${areaId}.attenuation.${name}.k_s`),
        decay: FloodBuilder.requireNonNegativeFloat(
          getValue(merged, "alpha_s"),
          `${areaId}.attenuation.${name}.alpha_s`,
        ),
        useExcessOverCrest: truthy(getValueOr(merged, "use_excess_over_crest", false)),
      };
    };

    const overtopped = parseState("overtopped", { scale: 1, decay: 0, useExcessOverCrest: true });
    const breached = parseState("breached", { scale: 1, decay: 0, useExcessOverCrest: false });
    return { Overtopped: overtopped, Breached: breached };
  }

  private resolveDepthCenters(
    context: ModelContext,
    item: SpecMapping,
    statesRef: string,
    depthStates: readonly string[],
    noneLabel: string,
  ): number[] {
    const raw = getValue(item, "bin_centers");
    if (raw === null) {
      const centers = context.discretization.centers(statesRef);
      if (centers.length !== depthStates.length) {
        throw valueError(`Depth centers in discretization '${statesRef}' must match states count.`);
      }
      return centers;
    }
    if (!isSequence(raw)) throw valueError("area.bin_centers must be list-like.");
    const values = raw.map((value) => toFloat(value));
    return FloodBuilder.mapCentersToStates(depthStates, noneLabel, values, "area.bin_centers");
  }

  private resolvePgaCenters(context: ModelContext, pgaStates: readonly string[]): number[] {
    const raw = getValue(this.config, "pga_bin_centers");
    let values: number[];
    if (raw === null) {
      values = context.discretization.centers(this.pgaStatesRef());
    } else {
      if (!isSequence(raw)) throw valueError("flood.pga_bin_centers must be list-like when provided.");
      values = raw.map((value) => toFloat(value));
    }
    return FloodBuilder.mapCentersToStates(pgaStates, this.pgaNoneStateLabel(), values, "pga_bin_centers");
  }

  private resolveWaveNonNoneCenters(
    context: ModelContext,
    nonNoneStates: readonly string[],
    statesRef: string,
  ): number[] {
    const raw = getValue(this.config, "wave_bin_centers");
    let values: number[];
    if (raw === null) {
      values = context.discretization.centers(statesRef);
    } else {
      if (!isSequence(raw)) throw valueError("flood.wave_bin_centers must be list-like when provided.");
      values = raw.map((value) => toFloat(value));
    }
    if (values.length !== nonNoneStates.length) {
      throw valueError(
        `Wave bin centers length ${values.length} must match non-none wave states count ${nonNoneStates.length}.`,
      );
    }
    if (values.some((value) => value <= 0)) throw valueError("Wave non-none centers must be strictly positive.");
    return values;
  }

  private resolveWaveNonNoneOvertopValues(nonNoneStates: readonly string[], nonNoneCenters: number[]): number[] {
    const raw = getValue(this.config, "wave_bin_upper_edges");
    if (raw === null) return nonNoneCenters;
    if (!isSequence(raw)) throw valueError("flood.wave_bin_upper_edges must be list-like when provided.");
    const values = raw.map((value) => toFloat(value));
    if (values.length !== nonNoneStates.length) {
      throw valueError(
        `wave_bin_upper_edges length ${values.length} must match non-none wave states count ` +
          `${nonNoneStates.length}.`,
      );
    }
    if (values.some((value) => value <= 0)) throw valueError("wave_bin_upper_edges values must be > 0.");
    return values;
  }

  private applyWaveToDefenseTransform(values: number[], label: string): number[] {
    const raw = getValue(this.config, "wave_to_defense");
    if (raw === null) return values;
    if (!isMapping(raw)) throw valueError("flood.wave_to_defense must be an object/mapping when provided.");
    const factor = FloodBuilder.requireNonNegativeFloat(getValueOr(raw, "factor", 1), "flood.wave_to_defense.factor");
    const siteElevation = FloodBuilder.requireFloat(
      getValueOr(raw, "site_elevation", 0),
      "flood.wave_to_defense.site_elevation",
    );
    const output = values.map((value) => largest(0, factor * value - siteElevation));
    if (output.some((value) => value < -1e-12)) throw valueError(`${label} transformed values must be >= 0.`);
    return output;
  }

  private siteDepthUseEffectiveWave(): boolean {
    return truthy(getValueOr(this.config, "site_depth_use_effective_wave", true));
  }

  private resolveWaveProbabilities(
    waveStates: readonly string[],
    nonNoneStates: readonly string[],
    includeNone: boolean,
  ): number[] {
    const probabilitiesGiven = hasKey(this.config, "wave_probs");
    const frequenciesGiven = hasKey(this.config, "wave_bin_frequencies");
    if (probabilitiesGiven && frequenciesGiven) {
      throw valueError("flood config cannot set both wave_probs and wave_bin_frequencies.");
    }
    if (!probabilitiesGiven && !frequenciesGiven) {
      throw valueError("flood config requires either wave_probs or wave_bin_frequencies.");
    }

    if (probabilitiesGiven) {
      const raw = getValue(this.config, "wave_probs");
      if (!isSequence(raw)) throw valueError("flood.wave_probs must be list-like.");
      let probabilities = raw.map((value) => toFloat(value));
      if (includeNone && probabilities.length === nonNoneStates.length) {
        const nonNoneSum = sum(probabilities);
        if (nonNoneSum > 1 + 1e-9) {
          throw valueError(`Sum of non-none wave_probs (${formatGeneral(nonNoneSum, 12)}) exceeds 1.0.`);
        }
        probabilities = [largest(0, 1 - nonNoneSum), ...probabilities];
      } else if (probabilities.length !== waveStates.length) {
        throw valueError(
          `wave_probs length ${probabilities.length} must match wave states count ${waveStates.length} ` +
            `(or non-none count ${nonNoneStates.length} when include_none_state=true).`,
        );
      }
      return FloodBuilder.validateProbabilityVector(probabilities, "wave_probs");
    }

    const raw = getValue(this.config, "wave_bin_frequencies");
    if (!isSequence(raw)) throw valueError("flood.wave_bin_frequencies must be list-like.");
    const frequencies = raw.map((value) => toFloat(value));
    const expectedLength = includeNone ? nonNoneStates.length : waveStates.length;
    if (frequencies.length !== expectedLength) {
      throw valueError(
        `wave_bin_frequencies length ${frequencies.length} must match ` +
          `${includeNone ? "non-none wave states" : "wave states"} (${expectedLength}).`,
      );
    }
    if (frequencies.some((frequency) => frequency < -1e-18)) {
      throw valueError("wave_bin_frequencies values must be >= 0.");
    }

    const missionTime = toFloat(getValueOr(this.config, "wave_mission_time", 1));
    if (missionTime <= 0) throw valueError("flood.wave_mission_time must be > 0 when using frequencies.");
    const mode = strip(text(getValueOr(this.config, "wave_frequency_to_probability", "poisson"))).toLowerCase();
    if (mode !== "poisson" && mode !== "linear") {
      throw valueError("flood.wave_frequency_to_probability must be 'poisson' or 'linear'.");
    }

    const nonNoneProbabilities =
      mode === "poisson" ?
        frequencies.map((frequency) => 1 - exponential(-frequency * missionTime))
      : frequencies.map((frequency) => frequency * missionTime);

    let probabilities = nonNoneProbabilities;
    if (includeNone) {
      const nonNoneSum = sum(nonNoneProbabilities);
      if (nonNoneSum > 1 + 1e-9) {
        throw valueError(`Converted non-none wave probabilities sum to ${formatGeneral(nonNoneSum, 12)} (>1.0).`);
      }
      probabilities = [largest(0, 1 - nonNoneSum), ...nonNoneProbabilities];
    }
    return FloodBuilder.validateProbabilityVector(probabilities, "converted_wave_probs");
  }

  private static validateProbabilityVector(values: number[], label: string): number[] {
    if (values.some((value) => value < -1e-12 || value > 1 + 1e-12)) {
      throw valueError(`${label} values must be in [0,1].`);
    }
    const total = sum(values);
    if (Math.abs(total - 1) > 1e-9) {
      throw valueError(`${label} must sum to 1.0 (got ${formatGeneral(total, 12)}).`);
    }
    return values;
  }

  private static maybeApplyIntactTail(
    base: readonly number[],
    waveValue: number,
    depthStates: readonly string[],
    noneIndex: number | null,
    tail: IntactTail | null,
  ): readonly number[] {
    if (tail === null) return base;
    if (waveValue <= tail.waveThreshold) return base;
    if (noneIndex === null) return base;
    const shallowIndex = tail.shallowIndex;
    if (shallowIndex < 0 || shallowIndex >= depthStates.length) return base;
    const shallowProbability = FloodBuilder.clamp01(tail.shallowProbability);
    const output = new Array<number>(depthStates.length).fill(0);
    output[noneIndex] = 1 - shallowProbability;
    output[shallowIndex] = shallowProbability;
    return output;
  }

  private static noneDepthDistribution(count: number, noneIndex: number | null): number[] {
    const output = new Array<number>(count).fill(0);
    output[noneIndex === null ? 0 : noneIndex] = 1;
    return output;
  }

  private static valueToDepthDistribution(
    value: number,
    centers: readonly number[],
    noneIndex: number | null,
  ): number[] {
    const count = centers.length;
    if (count === 0) throw valueError("Depth centers cannot be empty.");
    let chosen: number;
    if (value <= 0) {
      chosen = noneIndex === null ? 0 : noneIndex;
    } else {
      let candidates = centers.map((_center, index) => index);
      if (noneIndex !== null) {
        candidates = candidates.filter((index) => index !== noneIndex);
        if (candidates.length === 0) candidates = [noneIndex];
      }
      chosen = candidates[0];
      let bestDistance = Math.abs(centers[chosen] - value);
      for (const index of candidates.slice(1)) {
        const distance = Math.abs(centers[index] - value);
        if (distance < bestDistance) {
          chosen = index;
          bestDistance = distance;
        }
      }
    }
    const output = new Array<number>(count).fill(0);
    output[chosen] = 1;
    return output;
  }

  private static expandOverStates(states: readonly string[], noneLabel: string, values: readonly number[]): number[] {
    const output: number[] = [];
    let position = 0;
    for (const state of states) {
      if (state === noneLabel) {
        output.push(0);
      } else {
        output.push(values[position]);
        position += 1;
      }
    }
    return output;
  }

  private static mapCentersToStates(
    states: readonly string[],
    noneLabel: string,
    centers: readonly number[],
    label: string,
  ): number[] {
    if (centers.length === states.length) return Array.from(centers);
    const noneCount = states.filter((state) => state === noneLabel).length;
    if (noneCount === 1 && centers.length === states.length - 1) {
      return FloodBuilder.expandOverStates(states, noneLabel, centers);
    }
    throw valueError(
      `${label} length ${centers.length} must match states length ${states.length} ` +
        "(or states-1 when exactly one none state exists).",
    );
  }

  private static mapProbabilitiesToStates(
    probabilities: readonly number[],
    states: readonly string[],
    noneLabel: string,
    label: string,
  ): number[] {
    if (probabilities.length === states.length) {
      return FloodBuilder.validateProbabilityVector(Array.from(probabilities), label);
    }
    const noneCount = states.filter((state) => state === noneLabel).length;
    if (probabilities.length === states.length - 1 && noneCount === 1) {
      return FloodBuilder.validateProbabilityVector(
        FloodBuilder.expandOverStates(states, noneLabel, probabilities),
        label,
      );
    }
    throw valueError(
      `${label} length ${probabilities.length} must match states length ${states.length} ` +
        "(or states-1 when exactly one none state exists).",
    );
  }

  private static findStateIndex(states: readonly string[], stateName: string): number | null {
    const index = states.indexOf(stateName);
    return index < 0 ? null : index;
  }

  private static firstNonNoneStateIndex(states: readonly string[], noneIndex: number): number | null {
    for (let index = 0; index < states.length; index += 1) {
      if (index !== noneIndex) return index;
    }
    return null;
  }

  private static fragilityFailProbability(value: number, theta: number, beta: number): number {
    if (value <= 0) return 0;
    const z = logarithm(value / theta) / beta;
    return FloodBuilder.clamp01(normalCdf(z));
  }

  private static checkMonotonic(values: readonly number[], label: string, tolerance = 1e-12): void {
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] + tolerance < values[index - 1]) {
        throw valueError(
          `Non-monotonic fragility for '${label}' at bins ${index - 1}->${index}: ` +
            `${formatGeneral(values[index - 1], 6)} -> ${formatGeneral(values[index], 6)}`,
        );
      }
    }
  }

  private waveKey(): string {
    return strip(text(getValueOr(this.config, "wave_key", "hazard.flood.wave_height")));
  }

  private waveNodeId(): string {
    return strip(text(getValueOr(this.config, "wave_node_id", "WAVE_HEIGHT")));
  }

  private waveStatesRef(): string {
    return strip(text(getValueOr(this.config, "wave_states_ref", "WAVE_HEIGHT")));
  }

  private waveIncludeNoneState(): boolean {
    return truthy(getValueOr(this.config, "wave_include_none_state", true));
  }

  private waveNoneStateLabel(): string {
    return textOr(getValueOr(this.config, "wave_none_state_label", "None"), () => "None");
  }

  private pgaKey(): string {
    return strip(text(getValueOr(this.config, "pga_key", "hazard.seismic.PGA")));
  }

  private pgaStatesRef(): string {
    return strip(text(getValueOr(this.config, "pga_states_ref", "PGA")));
  }

  private pgaNoneStateLabel(): string {
    return textOr(getValueOr(this.config, "pga_none_state_label", "None"), () => "None");
  }

  private siteDepthStatesRef(): string {
    return strip(text(getValueOr(this.config, "site_depth_states_ref", "SITE_DEPTH")));
  }

  private depthNoneStateLabel(): string {
    return textOr(getValueOr(this.config, "depth_none_state_label", "None"), () => "None");
  }

  private defenseKey(defenseId: string): string {
    return `flood.defense.${defenseId}.state`;
  }

  private defaultDefenseNodeId(defenseId: string): string {
    return `FLOOD_DEFENSE_${slug(defenseId).toUpperCase()}_STATE`;
  }

  private siteDepthKey(areaId: string): string {
    return `flood.site.depth_at.${areaId}`;
  }

  private defaultAreaNodeId(areaId: string): string {
    return `FLOOD_SITE_DEPTH_${slug(areaId).toUpperCase()}`;
  }

  private outsideDamageKey(sscId: string): string {
    return `flood.damage_outside.${sscId}`;
  }

  private defaultOutsideDamageNodeId(sscId: string): string {
    return `FLOOD_FAIL_${slug(sscId).toUpperCase()}_OUTSIDE`;
  }

  private defenseItems(): SpecMapping[] {
    const raw = getValue(this.config, "defenses");
    if (!isSequence(raw) || raw.length === 0) throw valueError("flood builder requires non-empty 'defenses' list.");
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`flood.defenses[${index}] must be an object/mapping.`);
      return item;
    });
  }

  private areaItems(): SpecMapping[] {
    const raw = getValueOr(this.config, "areas", []);
    if (!isSequence(raw)) throw valueError("flood.areas must be list-like.");
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`flood.areas[${index}] must be an object/mapping.`);
      return item;
    });
  }

  private outsideSscItems(): SpecMapping[] {
    const raw = getValueOr(this.config, "outside_sscs", []);
    if (!isSequence(raw)) throw valueError("flood.outside_sscs must be list-like.");
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`flood.outside_sscs[${index}] must be an object/mapping.`);
      return item;
    });
  }

  private static clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  private static requireText(value: SpecValue, label: string): string {
    if (typeof value !== "string" || strip(value).length === 0) {
      throw valueError(`flood.${label} must be a non-empty string.`);
    }
    return strip(value);
  }

  private static requireFloat(value: SpecValue, label: string): number {
    try {
      return toFloat(value);
    } catch (error) {
      if (error instanceof NetworkBuilderError) throw valueError(`flood.${label} must be numeric.`);
      throw error;
    }
  }

  private static requirePositiveFloat(value: SpecValue, label: string): number {
    const parsed = FloodBuilder.requireFloat(value, label);
    if (parsed <= 0) throw valueError(`flood.${label} must be > 0.`);
    return parsed;
  }

  private static requireNonNegativeFloat(value: SpecValue, label: string): number {
    const parsed = FloodBuilder.requireFloat(value, label);
    if (parsed < 0) throw valueError(`flood.${label} must be >= 0.`);
    return parsed;
  }
}

export { FloodBuilder };
