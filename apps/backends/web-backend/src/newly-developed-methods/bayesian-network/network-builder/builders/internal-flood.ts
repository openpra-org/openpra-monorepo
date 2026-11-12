import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { NetworkBuilderError, valueError } from "../core/errors";
import { errorFunction } from "../core/math-functions";
import type { CpdGenerator, NodeRecord } from "../core/model";
import {
  cartesianProduct,
  floatRepr,
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  iterValues,
  keysOf,
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

const normalCdf = (z: number): number => 0.5 * (1.0 + errorFunction(z / Math.sqrt(2.0)));

const naturalLogarithm = (value: number): number => {
  if (value <= 0.0) throw valueError("math domain error");
  return Math.log(value);
};

const larger = (first: number, second: number): number => (second > first ? second : first);

const smaller = (first: number, second: number): number => (second < first ? second : first);

const isBooleanStateSet = (states: readonly string[]): boolean => {
  const unique = new Set(states);
  return unique.size === 2 && unique.has("False") && unique.has("True");
};

interface Fragility {
  theta: number;
  beta: number;
}

interface HazardConfig {
  usesPga: boolean;
  pgaFragility: Fragility | null;
  pgaFailGivenState: Map<string, number> | null;
  pgaStateValues: Map<string, number> | null;
  baselineFailProb: number;
  combineMode: string;
  probFloor: number;
  probCap: number;
}

interface Definition {
  id: string;
  key: string;
  item: SpecMapping;
}

interface LevelRecord {
  key: string;
  nodeId: string;
  states: string[];
  values: number[];
}

interface LevelStatesAndValues {
  states: string[];
  values: number[];
}

interface HazardFailureInput {
  pgaKey: string | null;
  pgaNoneLabel: string;
  pgaFragility: Fragility | null;
  pgaFailGivenState: Map<string, number> | null;
  pgaStateValues: Map<string, number> | null;
  baselineFailProb: number;
  combineMode: string;
  probFloor: number;
  probCap: number;
  allowExtraParents: boolean;
}

interface MitigationEffectiveInput {
  sourceKey: string;
  pumpKey: string | null;
  pgaKey: string | null;
  pgaNoneLabel: string;
  pgaFragility: Fragility | null;
  pgaFailGivenState: Map<string, number> | null;
  pgaStateValues: Map<string, number> | null;
  combineMode: string;
  probFloor: number;
  probCap: number;
  pEffectiveIfNoSource: number;
  pEffectiveIfSource: number;
  pEffectiveIfSourceWhenImpacted: number;
  pEffectiveIfPumpFailed: number;
  baselineImpactProb: number;
  allowExtraParents: boolean;
}

interface LevelCpdInput {
  sourceKey: string;
  mitigationKey: string | null;
  noSourceProbs: readonly number[];
  sourceNoMitigationProbs: readonly number[];
  sourceMitigationEffectiveProbs: readonly number[];
  sourceMitigationFailedProbs: readonly number[];
  allowExtraParents: boolean;
}

interface HazardStateInput {
  pgaState: string;
  pgaNoneLabel: string;
  pgaFragility: Fragility | null;
  pgaFailGivenState: Map<string, number> | null;
  pgaStateValues: Map<string, number> | null;
  label: string;
}

interface DistributionInput {
  raw: SpecValue;
  states: readonly string[];
  noneIndex: number | null;
  label: string;
  defaultMode: string;
  sourceDistribution?: readonly number[] | null;
}

class InternalFloodBuilder extends BuilderBase {
  private static readonly BOOL_STATES = ["False", "True"];

  get builderType(): string {
    return "internal_flood";
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    const pgaKey = InternalFloodBuilder.pgaKey();

    const sourceKeyById = InternalFloodBuilder.keyById(this.sourceDefs());
    const pumpKeyById = InternalFloodBuilder.keyById(this.pumpDefs());
    const mitigationKeyById = InternalFloodBuilder.keyById(this.mitigationDefs());
    const levelKeyById = InternalFloodBuilder.keyById(this.levelDefs());

    for (const definition of this.sourceDefs()) {
      if (InternalFloodBuilder.hazardUsesPga(definition.item, "sources")) required.add(pgaKey);
    }
    for (const definition of this.pumpDefs()) {
      if (InternalFloodBuilder.hazardUsesPga(definition.item, "pumps")) required.add(pgaKey);
    }
    for (const definition of this.mitigationDefs()) {
      required.add(this.resolveSourceKey(definition.item, sourceKeyById, "mitigations"));
      const pumpKey = this.resolveOptionalPumpKey(definition.item, pumpKeyById, "mitigations");
      if (pumpKey !== null && pumpKey.length > 0) required.add(pumpKey);
      if (InternalFloodBuilder.hazardUsesPga(definition.item, "mitigations")) required.add(pgaKey);
    }

    for (const definition of this.levelDefs()) {
      required.add(this.resolveSourceKey(definition.item, sourceKeyById, "levels"));
      const mitigationKey = this.resolveOptionalMitigationKey(definition.item, mitigationKeyById, "levels");
      if (mitigationKey !== null && mitigationKey.length > 0) required.add(mitigationKey);
    }

    for (const definition of this.componentDefs()) {
      required.add(this.resolveLevelKey(definition.item, levelKeyById, "components"));
    }
    const provided = this.provides;
    const output = new Set<string>();
    for (const key of required) {
      if (!provided.has(key)) output.add(key);
    }
    return output;
  }

  get provides(): Set<string> {
    const output = new Set<string>();
    for (const definition of this.sourceDefs()) output.add(definition.key);
    for (const definition of this.pumpDefs()) output.add(definition.key);
    for (const definition of this.mitigationDefs()) output.add(definition.key);
    for (const definition of this.levelDefs()) output.add(definition.key);
    for (const definition of this.componentDefs()) output.add(definition.key);
    return output;
  }

  build(context: ModelContext): void {
    const pgaKey = InternalFloodBuilder.pgaKey();
    const pgaNoneLabel = this.pgaNoneStateLabel();
    const pgaAvailable = context.registry.hasKey(pgaKey);
    let pgaNodeId: string | null = null;
    let pgaStateValuesDefault: Map<string, number> | null = null;
    if (pgaAvailable) {
      pgaNodeId = context.registry.nodeId(pgaKey);
      const pgaStates = context.model.node(pgaNodeId).states;
      pgaStateValuesDefault = this.resolveDefaultPgaStateValues(context, pgaStates, pgaNoneLabel);
    }

    const anyUsesPga =
      this.sourceDefs().some((definition) => InternalFloodBuilder.hazardUsesPga(definition.item, "sources")) ||
      this.pumpDefs().some((definition) => InternalFloodBuilder.hazardUsesPga(definition.item, "pumps")) ||
      this.mitigationDefs().some((definition) => InternalFloodBuilder.hazardUsesPga(definition.item, "mitigations"));
    if (anyUsesPga && !pgaAvailable) {
      throw valueError(
        "internal_flood requires seismic PGA for at least one configured node, " +
          "but key 'hazard.seismic.PGA' is unavailable.",
      );
    }

    const sourceKeyById = new Map<string, string>();
    for (const definition of this.sourceDefs()) {
      const sourceId = definition.id;
      const item = definition.item;
      const customNodeId = strip(text(getValueOr(item, "node_id", "")));
      const nodeId = customNodeId.length > 0 ? customNodeId : InternalFloodBuilder.defaultSourceNodeId(sourceId);
      const hazardConfig = this.applyDefaultPgaStateValues(
        this.resolveHazardConfig(item, `sources[${sourceId}]`),
        pgaStateValuesDefault,
        `sources[${sourceId}]`,
      );
      const parentIds: string[] = [];
      if (hazardConfig.usesPga && pgaNodeId !== null) parentIds.push(pgaNodeId);
      const cpdGenerator = this.makeHazardFailureCpdGenerator({
        pgaKey: hazardConfig.usesPga ? pgaKey : null,
        pgaNoneLabel,
        pgaFragility: hazardConfig.pgaFragility,
        pgaFailGivenState: hazardConfig.pgaFailGivenState,
        pgaStateValues: hazardConfig.pgaStateValues,
        baselineFailProb: hazardConfig.baselineFailProb,
        combineMode: hazardConfig.combineMode,
        probFloor: hazardConfig.probFloor,
        probCap: hazardConfig.probCap,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
      });

      context.model.addNode({
        key: definition.key,
        nodeId,
        states: InternalFloodBuilder.BOOL_STATES,
        metadata: {
          builder: "internal_flood",
          kind: "source_initiated",
          source_id: sourceId,
          true_means: "internal_flood_source_initiated",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(definition.key, nodeId);
      sourceKeyById.set(sourceId, definition.key);
    }

    const pumpKeyById = new Map<string, string>();
    for (const definition of this.pumpDefs()) {
      const pumpId = definition.id;
      const item = definition.item;
      const customNodeId = strip(text(getValueOr(item, "node_id", "")));
      const nodeId = customNodeId.length > 0 ? customNodeId : InternalFloodBuilder.defaultPumpNodeId(pumpId);
      const hazardConfig = this.applyDefaultPgaStateValues(
        this.resolveHazardConfig(item, `pumps[${pumpId}]`),
        pgaStateValuesDefault,
        `pumps[${pumpId}]`,
      );
      const parentIds: string[] = [];
      if (hazardConfig.usesPga && pgaNodeId !== null) parentIds.push(pgaNodeId);
      const cpdGenerator = this.makeHazardFailureCpdGenerator({
        pgaKey: hazardConfig.usesPga ? pgaKey : null,
        pgaNoneLabel,
        pgaFragility: hazardConfig.pgaFragility,
        pgaFailGivenState: hazardConfig.pgaFailGivenState,
        pgaStateValues: hazardConfig.pgaStateValues,
        baselineFailProb: hazardConfig.baselineFailProb,
        combineMode: hazardConfig.combineMode,
        probFloor: hazardConfig.probFloor,
        probCap: hazardConfig.probCap,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
      });

      context.model.addNode({
        key: definition.key,
        nodeId,
        states: InternalFloodBuilder.BOOL_STATES,
        metadata: {
          builder: "internal_flood",
          kind: "sink_pump_failed",
          pump_id: pumpId,
          true_means: "internal_flood_sink_pump_failed",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(definition.key, nodeId);
      pumpKeyById.set(pumpId, definition.key);
    }

    const mitigationKeyById = new Map<string, string>();
    for (const definition of this.mitigationDefs()) {
      const mitigationId = definition.id;
      const item = definition.item;
      const label = `mitigations[${mitigationId}]`;
      const customNodeId = strip(text(getValueOr(item, "node_id", "")));
      const nodeId =
        customNodeId.length > 0 ? customNodeId : InternalFloodBuilder.defaultMitigationNodeId(mitigationId);
      const sourceKey = this.resolveSourceKey(item, sourceKeyById, label);
      const sourceParentId = context.registry.nodeId(sourceKey);
      const pumpKey = this.resolveOptionalPumpKey(item, pumpKeyById, label);
      const pumpParentId = pumpKey !== null && pumpKey.length > 0 ? context.registry.nodeId(pumpKey) : null;
      const hazardConfig = this.applyDefaultPgaStateValues(
        this.resolveHazardConfig(item, label),
        pgaStateValuesDefault,
        label,
      );

      const parentIds: string[] = [sourceParentId];
      if (pumpParentId !== null) parentIds.push(pumpParentId);
      if (hazardConfig.usesPga && pgaNodeId !== null) parentIds.push(pgaNodeId);

      const pEffectiveIfNoSource = InternalFloodBuilder.requireProbability(
        getValueOr(item, "p_effective_if_no_source", 1.0),
        `${label}.p_effective_if_no_source`,
      );
      const pEffectiveIfSource = InternalFloodBuilder.requireProbability(
        getValueOr(item, "p_effective_if_source", 0.8),
        `${label}.p_effective_if_source`,
      );
      const pEffectiveIfSourceWhenImpacted = InternalFloodBuilder.requireProbability(
        getValueOr(item, "p_effective_if_source_when_impacted", 0.35),
        `${label}.p_effective_if_source_when_impacted`,
      );
      const pEffectiveIfPumpFailed = InternalFloodBuilder.requireProbability(
        getValueOr(item, "p_effective_if_pump_failed", 0.0),
        `${label}.p_effective_if_pump_failed`,
      );
      const baselineImpactProb = InternalFloodBuilder.requireProbability(
        getValueOr(item, "baseline_impact_prob", 0.0),
        `${label}.baseline_impact_prob`,
      );
      const cpdGenerator = this.makeMitigationEffectiveCpdGenerator({
        sourceKey,
        pumpKey,
        pgaKey: hazardConfig.usesPga ? pgaKey : null,
        pgaNoneLabel,
        pgaFragility: hazardConfig.pgaFragility,
        pgaFailGivenState: hazardConfig.pgaFailGivenState,
        pgaStateValues: hazardConfig.pgaStateValues,
        combineMode: hazardConfig.combineMode,
        probFloor: hazardConfig.probFloor,
        probCap: hazardConfig.probCap,
        pEffectiveIfNoSource,
        pEffectiveIfSource,
        pEffectiveIfSourceWhenImpacted,
        pEffectiveIfPumpFailed,
        baselineImpactProb,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
      });
      context.model.addNode({
        key: definition.key,
        nodeId,
        states: InternalFloodBuilder.BOOL_STATES,
        metadata: {
          builder: "internal_flood",
          kind: "mitigation_effective",
          mitigation_id: mitigationId,
          true_means: "internal_flood_mitigation_effective",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(definition.key, nodeId);
      mitigationKeyById.set(mitigationId, definition.key);
    }

    const levelMeta = new Map<string, LevelRecord>();
    for (const definition of this.levelDefs()) {
      const levelId = definition.id;
      const item = definition.item;
      const customNodeId = strip(text(getValueOr(item, "node_id", "")));
      const nodeId = customNodeId.length > 0 ? customNodeId : InternalFloodBuilder.defaultLevelNodeId(levelId);
      const resolved = this.resolveLevelStatesAndValues(context, item, levelId);
      const levelStates = resolved.states;
      const customNoneLabel = strip(text(getValueOr(item, "none_state_label", this.levelNoneStateLabel())));
      const noneStateLabel = customNoneLabel.length > 0 ? customNoneLabel : this.levelNoneStateLabel();
      const noneIndex = InternalFloodBuilder.findStateIndex(levelStates, noneStateLabel);

      const noSourceProbs = this.resolveDistribution({
        raw: getValue(item, "no_source_probs"),
        states: levelStates,
        noneIndex,
        label: `levels[${levelId}].no_source_probs`,
        defaultMode: "one_hot_none",
      });
      const sourceNoMitigationProbs = this.resolveDistribution({
        raw: getValueOr(item, "source_no_mitigation_probs", getValue(item, "source_probs")),
        states: levelStates,
        noneIndex,
        label: `levels[${levelId}].source_no_mitigation_probs`,
        defaultMode: "uniform_non_none",
      });
      const sourceMitigationEffectiveProbs = this.resolveDistribution({
        raw: getValue(item, "source_mitigation_effective_probs"),
        states: levelStates,
        noneIndex,
        label: `levels[${levelId}].source_mitigation_effective_probs`,
        defaultMode: "same_as_source",
        sourceDistribution: sourceNoMitigationProbs,
      });
      const sourceMitigationFailedProbs = this.resolveDistribution({
        raw: getValue(item, "source_mitigation_failed_probs"),
        states: levelStates,
        noneIndex,
        label: `levels[${levelId}].source_mitigation_failed_probs`,
        defaultMode: "same_as_source",
        sourceDistribution: sourceNoMitigationProbs,
      });

      const sourceKey = this.resolveSourceKey(item, sourceKeyById, `levels[${levelId}]`);
      const sourceParentId = context.registry.nodeId(sourceKey);
      const mitigationKey = this.resolveOptionalMitigationKey(item, mitigationKeyById, `levels[${levelId}]`);
      const mitigationParentId =
        mitigationKey !== null && mitigationKey.length > 0 ? context.registry.nodeId(mitigationKey) : null;
      const parentIds = [sourceParentId];
      if (mitigationParentId !== null) parentIds.push(mitigationParentId);

      const cpdGenerator = this.makeLevelCpdGenerator({
        sourceKey,
        mitigationKey,
        noSourceProbs,
        sourceNoMitigationProbs,
        sourceMitigationEffectiveProbs,
        sourceMitigationFailedProbs,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
      });

      context.model.addNode({
        key: definition.key,
        nodeId,
        states: levelStates,
        metadata: {
          builder: "internal_flood",
          kind: "internal_level",
          level_id: levelId,
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(definition.key, nodeId);
      levelMeta.set(levelId, { key: definition.key, nodeId, states: levelStates, values: resolved.values });
    }

    for (const definition of this.componentDefs()) {
      const sscId = definition.id;
      const item = definition.item;
      const customNodeId = strip(text(getValueOr(item, "node_id", "")));
      const nodeId = customNodeId.length > 0 ? customNodeId : InternalFloodBuilder.defaultComponentNodeId(sscId);
      const theta = InternalFloodBuilder.requirePositiveFloat(getValue(item, "theta"), `components[${sscId}].theta`);
      const beta = InternalFloodBuilder.requirePositiveFloat(getValue(item, "beta"), `components[${sscId}].beta`);
      const levelKeyById = new Map<string, string>();
      for (const [knownLevelId, record] of levelMeta) levelKeyById.set(knownLevelId, record.key);
      const levelKey = this.resolveLevelKey(item, levelKeyById, `components[${sscId}]`);
      const levelId = InternalFloodBuilder.resolveLevelIdFromItem(item, levelKey, levelMeta);
      const levelRecord = levelMeta.get(levelId);
      if (levelRecord === undefined) {
        throw valueError(`Unable to resolve level_id for level_key '${levelKey}' in internal_flood.components.`);
      }
      const levelNodeId = levelRecord.nodeId;
      const levelValues = levelRecord.values;

      const failProbs = levelValues.map((value) => InternalFloodBuilder.fragilityFailProb(value, theta, beta));
      InternalFloodBuilder.checkMonotonic(failProbs, `components[${sscId}]`);
      const cpdGenerator = this.makeDamageCpdGenerator(
        levelKey,
        failProbs,
        truthy(getValueOr(item, "allow_extra_parents", false)),
      );
      context.model.addNode({
        key: definition.key,
        nodeId,
        states: InternalFloodBuilder.BOOL_STATES,
        metadata: {
          builder: "internal_flood",
          kind: "inside_damage",
          ssc_id: sscId,
          level_id: levelId,
          theta,
          beta,
          true_means: "failure",
        },
        parentIds: [levelNodeId],
        cpdGenerator,
      });
      context.registry.register(definition.key, nodeId);
    }
  }

  private static keyById(definitions: readonly Definition[]): Map<string, string> {
    const output = new Map<string, string>();
    for (const definition of definitions) output.set(definition.id, definition.key);
    return output;
  }

  private static extraParents(node: NodeRecord, expected: ReadonlySet<string>, allowExtraParents: boolean): void {
    if (allowExtraParents) return;
    const extras = node.parents.filter((parentId) => !expected.has(parentId));
    if (extras.length > 0) {
      throw valueError(
        `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
          "Set allow_extra_parents=true to permit this.",
      );
    }
  }

  private static booleanRow(node: NodeRecord, probability: number): number[] {
    return node.states.map((state) => (state === "False" ? 1.0 - probability : probability));
  }

  private makeHazardFailureCpdGenerator(input: HazardFailureInput): CpdGenerator {
    const frozenPgaKey = input.pgaKey;
    const frozenNone = input.pgaNoneLabel;
    const frozenFragility = input.pgaFragility !== null ? { ...input.pgaFragility } : null;
    const frozenMap =
      input.pgaFailGivenState !== null && input.pgaFailGivenState.size > 0 ? new Map(input.pgaFailGivenState) : null;
    const frozenValues =
      input.pgaStateValues !== null && input.pgaStateValues.size > 0 ? new Map(input.pgaStateValues) : null;
    const frozenBase = input.baselineFailProb;
    const frozenMode = input.combineMode;
    const frozenFloor = input.probFloor;
    const frozenCap = input.probCap;
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      let pgaParentId: string | null = null;
      if (frozenPgaKey !== null && frozenPgaKey.length > 0) {
        pgaParentId = localContext.registry.nodeId(frozenPgaKey);
        if (!node.parents.includes(pgaParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
        }
        localContext.model.node(pgaParentId);
      }

      const expected = new Set<string>();
      if (pgaParentId !== null && pgaParentId.length > 0) expected.add(pgaParentId);
      InternalFloodBuilder.extraParents(node, expected, frozenAllowExtra);

      const rows: number[] = [];
      const parentStateLists = node.parents.map((parentId) => localContext.model.node(parentId).states);
      const pgaPosition = pgaParentId !== null ? node.parents.indexOf(pgaParentId) : -1;
      for (const combination of cartesianProduct(parentStateLists)) {
        let seismicProbability = 0.0;
        if (pgaParentId !== null) {
          seismicProbability = this.hazardProbabilityFromPgaState({
            pgaState: combination[pgaPosition],
            pgaNoneLabel: frozenNone,
            pgaFragility: frozenFragility,
            pgaFailGivenState: frozenMap,
            pgaStateValues: frozenValues,
            label: node.nodeId,
          });
        }
        const combined = InternalFloodBuilder.combineProbs(frozenBase, seismicProbability, frozenMode);
        const probability = smaller(frozenCap, larger(frozenFloor, combined));
        for (const value of InternalFloodBuilder.booleanRow(node, probability)) rows.push(value);
      }
      return rows;
    };
  }

  private makeMitigationEffectiveCpdGenerator(input: MitigationEffectiveInput): CpdGenerator {
    const frozenSourceKey = input.sourceKey;
    const frozenPumpKey = input.pumpKey;
    const frozenPgaKey = input.pgaKey;
    const frozenNone = input.pgaNoneLabel;
    const frozenFragility = input.pgaFragility !== null ? { ...input.pgaFragility } : null;
    const frozenMap =
      input.pgaFailGivenState !== null && input.pgaFailGivenState.size > 0 ? new Map(input.pgaFailGivenState) : null;
    const frozenValues =
      input.pgaStateValues !== null && input.pgaStateValues.size > 0 ? new Map(input.pgaStateValues) : null;
    const frozenMode = input.combineMode;
    const frozenFloor = input.probFloor;
    const frozenCap = input.probCap;
    const frozenNoSource = input.pEffectiveIfNoSource;
    const frozenSource = input.pEffectiveIfSource;
    const frozenSourceImpacted = input.pEffectiveIfSourceWhenImpacted;
    const frozenPumpFailed = input.pEffectiveIfPumpFailed;
    const frozenBaseImpact = input.baselineImpactProb;
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const sourceParentId = localContext.registry.nodeId(frozenSourceKey);
      if (!node.parents.includes(sourceParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required source parent '${sourceParentId}'.`);
      }
      const sourceStates = localContext.model.node(sourceParentId).states;
      if (!isBooleanStateSet(sourceStates)) {
        throw valueError(`Node '${node.nodeId}' expects source parent with states ['False','True'].`);
      }

      let pumpParentId: string | null = null;
      if (frozenPumpKey !== null && frozenPumpKey.length > 0) {
        pumpParentId = localContext.registry.nodeId(frozenPumpKey);
        if (!node.parents.includes(pumpParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required pump parent '${pumpParentId}'.`);
        }
      }

      let pgaParentId: string | null = null;
      if (frozenPgaKey !== null && frozenPgaKey.length > 0) {
        pgaParentId = localContext.registry.nodeId(frozenPgaKey);
        if (!node.parents.includes(pgaParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
        }
        localContext.model.node(pgaParentId);
      }

      const expected = new Set<string>([sourceParentId]);
      if (pumpParentId !== null) expected.add(pumpParentId);
      if (pgaParentId !== null) expected.add(pgaParentId);
      InternalFloodBuilder.extraParents(node, expected, frozenAllowExtra);

      const rows: number[] = [];
      const parentStateLists = node.parents.map((parentId) => localContext.model.node(parentId).states);
      const sourcePosition = node.parents.indexOf(sourceParentId);
      const pumpPosition = pumpParentId !== null ? node.parents.indexOf(pumpParentId) : -1;
      const pgaPosition = pgaParentId !== null ? node.parents.indexOf(pgaParentId) : -1;
      for (const combination of cartesianProduct(parentStateLists)) {
        const sourceState = combination[sourcePosition];
        let effective: number;
        if (sourceState === "False") {
          effective = frozenNoSource;
        } else if (pumpParentId !== null && combination[pumpPosition] === "True") {
          effective = frozenPumpFailed;
        } else {
          let seismicProbability = 0.0;
          if (pgaParentId !== null) {
            seismicProbability = this.hazardProbabilityFromPgaState({
              pgaState: combination[pgaPosition],
              pgaNoneLabel: frozenNone,
              pgaFragility: frozenFragility,
              pgaFailGivenState: frozenMap,
              pgaStateValues: frozenValues,
              label: node.nodeId,
            });
          }
          const combined = InternalFloodBuilder.combineProbs(frozenBaseImpact, seismicProbability, frozenMode);
          const impact = smaller(frozenCap, larger(frozenFloor, combined));
          effective = (1.0 - impact) * frozenSource + impact * frozenSourceImpacted;
        }

        effective = smaller(1.0, larger(0.0, effective));
        for (const value of InternalFloodBuilder.booleanRow(node, effective)) rows.push(value);
      }
      return rows;
    };
  }

  private makeLevelCpdGenerator(input: LevelCpdInput): CpdGenerator {
    const frozenSourceKey = input.sourceKey;
    const frozenMitigationKey = input.mitigationKey;
    const frozenNoSource = Array.from(input.noSourceProbs);
    const frozenSourceNoMitigation = Array.from(input.sourceNoMitigationProbs);
    const frozenSourceEffective = Array.from(input.sourceMitigationEffectiveProbs);
    const frozenSourceFailed = Array.from(input.sourceMitigationFailedProbs);
    const frozenAllowExtra = input.allowExtraParents;

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const sourceParentId = localContext.registry.nodeId(frozenSourceKey);
      if (!node.parents.includes(sourceParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required source parent '${sourceParentId}'.`);
      }
      const sourceStates = localContext.model.node(sourceParentId).states;
      if (!isBooleanStateSet(sourceStates)) {
        throw valueError(`Node '${node.nodeId}' expects source parent with states ['False','True'].`);
      }

      let mitigationParentId: string | null = null;
      if (frozenMitigationKey !== null && frozenMitigationKey.length > 0) {
        mitigationParentId = localContext.registry.nodeId(frozenMitigationKey);
        if (!node.parents.includes(mitigationParentId)) {
          throw valueError(`Node '${node.nodeId}' missing required mitigation parent '${mitigationParentId}'.`);
        }
        const mitigationStates = localContext.model.node(mitigationParentId).states;
        if (!isBooleanStateSet(mitigationStates)) {
          throw valueError(`Node '${node.nodeId}' expects mitigation parent with states ['False','True'].`);
        }
      }

      const expected = new Set<string>([sourceParentId]);
      if (mitigationParentId !== null) expected.add(mitigationParentId);
      InternalFloodBuilder.extraParents(node, expected, frozenAllowExtra);

      const rows: number[] = [];
      const parentStateLists = node.parents.map((parentId) => localContext.model.node(parentId).states);
      const sourcePosition = node.parents.indexOf(sourceParentId);
      const mitigationPosition = mitigationParentId !== null ? node.parents.indexOf(mitigationParentId) : -1;
      for (const combination of cartesianProduct(parentStateLists)) {
        const sourceState = combination[sourcePosition];
        let probabilities: number[];
        if (sourceState === "False") probabilities = frozenNoSource;
        else if (mitigationParentId === null) probabilities = frozenSourceNoMitigation;
        else if (combination[mitigationPosition] === "True") probabilities = frozenSourceEffective;
        else probabilities = frozenSourceFailed;
        for (const value of probabilities) rows.push(value);
      }
      return rows;
    };
  }

  private makeDamageCpdGenerator(
    levelKey: string,
    failProbs: readonly number[],
    allowExtraParents: boolean,
  ): CpdGenerator {
    const frozenFailProbs = Array.from(failProbs);

    return (localContext: ModelContext, node: NodeRecord): number[] => {
      const levelParentId = localContext.registry.nodeId(levelKey);
      if (!node.parents.includes(levelParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required level parent '${levelParentId}'.`);
      }
      InternalFloodBuilder.extraParents(node, new Set<string>([levelParentId]), allowExtraParents);

      const levelStates = localContext.model.node(levelParentId).states;
      if (levelStates.length !== frozenFailProbs.length) {
        throw valueError(`Level states/fail_probs mismatch for node '${node.nodeId}'.`);
      }
      const rows: number[] = [];
      for (const probability of frozenFailProbs) {
        for (const value of InternalFloodBuilder.booleanRow(node, probability)) rows.push(value);
      }
      return rows;
    };
  }

  private static combineProbs(baseProb: number, hazardProb: number, combineMode: string): number {
    if (combineMode === "noisy_or_independent") return 1.0 - (1.0 - baseProb) * (1.0 - hazardProb);
    if (combineMode === "max") return larger(baseProb, hazardProb);
    if (combineMode === "additive_clipped") return smaller(1.0, baseProb + hazardProb);
    throw valueError("combine_mode must be one of: noisy_or_independent, max, additive_clipped.");
  }

  private hazardProbabilityFromPgaState(input: HazardStateInput): number {
    if (input.pgaFailGivenState !== null) {
      const mapped = input.pgaFailGivenState.get(input.pgaState);
      if (mapped === undefined) {
        throw valueError(`${input.label} missing pga_fail_given_state entry for state '${input.pgaState}'.`);
      }
      return mapped;
    }
    if (input.pgaFragility === null) return 0.0;

    if (input.pgaState === input.pgaNoneLabel) return 0.0;

    if (input.pgaStateValues === null) {
      throw valueError(`${input.label} uses pga_fragility but pga_state_values could not be resolved.`);
    }
    const value = input.pgaStateValues.get(input.pgaState);
    if (value === undefined) {
      throw valueError(`${input.label} missing pga_state_values entry for state '${input.pgaState}'.`);
    }
    const theta = input.pgaFragility.theta;
    const beta = input.pgaFragility.beta;
    if (value <= 0.0) return 0.0;
    const z = naturalLogarithm(value / theta) / beta;
    return normalCdf(z);
  }

  private static fragilityFailProb(value: number, theta: number, beta: number): number {
    if (value <= 0.0) return 0.0;
    const z = naturalLogarithm(value / theta) / beta;
    return normalCdf(z);
  }

  private resolveLevelStatesAndValues(context: ModelContext, item: SpecMapping, levelId: string): LevelStatesAndValues {
    const statesRef = strip(text(getValueOr(item, "states_ref", this.levelStatesRef())));
    const explicitStates = getValue(item, "states");
    let states: string[];
    if (explicitStates !== null) {
      states = InternalFloodBuilder.requireList(explicitStates, `levels[${levelId}].states`).map((state) =>
        InternalFloodBuilder.requireText(state, `levels[${levelId}].states[]`),
      );
    } else {
      states = context.discretization.states(statesRef);
    }
    if (states.length < 2) throw valueError(`levels[${levelId}] must define at least two states.`);
    if (states.length !== new Set(states).size) throw valueError(`levels[${levelId}] states must be unique.`);

    const valuesMap = this.resolveOptionalValueMapping(
      getValue(item, "state_values"),
      `levels[${levelId}].state_values`,
    );
    if (valuesMap !== null) {
      const missing = states.filter((state) => !valuesMap.has(state));
      if (missing.length > 0) {
        throw valueError(`levels[${levelId}] state_values missing entries for ${repr(missing)}.`);
      }
      return { states, values: states.map((state) => valuesMap.get(state) ?? 0.0) };
    }

    let centers: number[];
    try {
      centers = context.discretization.centers(statesRef);
    } catch (error) {
      if (error instanceof NetworkBuilderError) {
        throw valueError(
          `levels[${levelId}] requires either state_values or discretization centers ` +
            `for states_ref '${statesRef}'.`,
        );
      }
      throw error;
    }

    const noneLabel = strip(text(getValueOr(item, "none_state_label", this.levelNoneStateLabel())));
    if (noneLabel.length > 0 && states.includes(noneLabel) && centers.length === states.length - 1) {
      const nonNoneStates = states.filter((state) => state !== noneLabel);
      const valuesByState = new Map<string, number>([[noneLabel, 0.0]]);
      const pairs = Math.min(nonNoneStates.length, centers.length);
      for (let index = 0; index < pairs; index += 1) valuesByState.set(nonNoneStates[index], centers[index]);
      return { states, values: states.map((state) => valuesByState.get(state) ?? 0.0) };
    }
    if (centers.length === states.length) return { states, values: centers };

    throw valueError(
      `levels[${levelId}] states/centers mismatch: ${states.length} states vs ${centers.length} centers. ` +
        "Provide levels[].state_values explicitly.",
    );
  }

  private resolveDistribution(input: DistributionInput): number[] {
    const states = input.states;
    const label = input.label;
    const noneIndex = input.noneIndex;
    if (input.raw !== null) {
      const vector = InternalFloodBuilder.requireList(input.raw, label).map((item) => toFloat(item));
      if (vector.length !== states.length) {
        throw valueError(`${label} length ${vector.length} must match state count ${states.length}.`);
      }
      InternalFloodBuilder.validateProbabilityVector(vector, label);
      return vector;
    }

    if (input.defaultMode === "one_hot_none") {
      if (noneIndex === null) throw valueError(`${label} missing and no none-state could be inferred.`);
      const vector = states.map(() => 0.0);
      vector[noneIndex] = 1.0;
      return vector;
    }
    if (input.defaultMode === "uniform_non_none") {
      if (noneIndex === null) {
        const probability = 1.0 / states.length;
        return states.map(() => probability);
      }
      const nonNone = states.length - 1;
      if (nonNone <= 0) throw valueError(`${label} cannot infer uniform non-none distribution.`);
      const probability = 1.0 / nonNone;
      const vector = states.map(() => probability);
      vector[noneIndex] = 0.0;
      return vector;
    }
    if (input.defaultMode === "same_as_source") {
      const sourceDistribution = input.sourceDistribution ?? null;
      if (sourceDistribution === null) {
        throw valueError(`${label} default_mode same_as_source requires source_dist.`);
      }
      return Array.from(sourceDistribution);
    }
    throw valueError(`Unsupported default distribution mode '${input.defaultMode}'.`);
  }

  private resolveHazardConfig(item: SpecMapping, label: string): HazardConfig {
    const includePgaParent = truthy(getValueOr(item, "include_pga_parent", false));
    const pgaFragility = this.resolveOptionalFragility(getValue(item, "pga_fragility"), `${label}.pga_fragility`);
    const pgaFailGivenState = this.resolveOptionalProbMapping(
      getValue(item, "pga_fail_given_state"),
      `${label}.pga_fail_given_state`,
    );
    const pgaStateValues = this.resolveOptionalValueMapping(
      getValue(item, "pga_state_values"),
      `${label}.pga_state_values`,
    );

    const usesPga = includePgaParent || pgaFragility !== null || pgaFailGivenState !== null;
    if (includePgaParent && pgaFragility === null && pgaFailGivenState === null) {
      throw valueError(`${label} has include_pga_parent=true but no pga_fragility or pga_fail_given_state provided.`);
    }

    const combineMode = strip(
      text(getValueOr(item, "combine_mode", getValueOr(this.config, "combine_mode_default", "noisy_or_independent"))),
    ).toLowerCase();
    if (combineMode !== "noisy_or_independent" && combineMode !== "max" && combineMode !== "additive_clipped") {
      throw valueError(`${label}.combine_mode must be one of: noisy_or_independent, max, additive_clipped.`);
    }

    const baselineFailProb = InternalFloodBuilder.requireProbability(
      getValueOr(item, "baseline_fail_prob", 0.0),
      `${label}.baseline_fail_prob`,
    );
    const probFloor = InternalFloodBuilder.requireProbability(
      getValueOr(item, "prob_floor", 0.0),
      `${label}.prob_floor`,
    );
    const probCap = InternalFloodBuilder.requireProbability(getValueOr(item, "prob_cap", 1.0), `${label}.prob_cap`);
    if (probFloor > probCap + 1e-12) throw valueError(`${label} has prob_floor > prob_cap.`);

    return {
      usesPga,
      pgaFragility,
      pgaFailGivenState,
      pgaStateValues,
      baselineFailProb,
      combineMode,
      probFloor,
      probCap,
    };
  }

  private applyDefaultPgaStateValues(
    hazardConfig: HazardConfig,
    defaultValues: Map<string, number> | null,
    label: string,
  ): HazardConfig {
    const hasFragility = hazardConfig.pgaFragility !== null;
    const hasMap = hazardConfig.pgaFailGivenState !== null;
    const hasValues = hazardConfig.pgaStateValues !== null;
    if (!(hazardConfig.usesPga && hasFragility && !hasMap && !hasValues)) return hazardConfig;
    if (defaultValues === null) {
      throw valueError(`${label} uses pga_fragility but pga_state_values could not be inferred from discretization.`);
    }
    return { ...hazardConfig, pgaStateValues: new Map(defaultValues) };
  }

  private resolveDefaultPgaStateValues(
    context: ModelContext,
    pgaStates: readonly string[],
    pgaNoneLabel: string,
  ): Map<string, number> | null {
    const statesRef = this.pgaStatesRef();
    let centers: number[];
    try {
      centers = context.discretization.centers(statesRef);
    } catch (error) {
      if (error instanceof NetworkBuilderError) return null;
      throw error;
    }

    if (pgaStates.length === 0) return null;

    if (centers.length === pgaStates.length) {
      const output = new Map<string, number>();
      for (let index = 0; index < pgaStates.length; index += 1) output.set(pgaStates[index], centers[index]);
      return output;
    }

    if (pgaStates.includes(pgaNoneLabel) && centers.length === pgaStates.length - 1) {
      const output = new Map<string, number>([[pgaNoneLabel, 0.0]]);
      const nonNoneStates = pgaStates.filter((state) => state !== pgaNoneLabel);
      const pairs = Math.min(nonNoneStates.length, centers.length);
      for (let index = 0; index < pairs; index += 1) output.set(nonNoneStates[index], centers[index]);
      return output;
    }

    return null;
  }

  private resolveOptionalFragility(raw: SpecValue, label: string): Fragility | null {
    if (raw === null) return null;
    if (!isMapping(raw)) throw valueError(`${label} must be object/mapping.`);
    const theta = InternalFloodBuilder.requirePositiveFloat(getValue(raw, "theta"), `${label}.theta`);
    const beta = InternalFloodBuilder.requirePositiveFloat(getValue(raw, "beta"), `${label}.beta`);
    return { theta, beta };
  }

  private resolveOptionalProbMapping(raw: SpecValue, label: string): Map<string, number> | null {
    if (raw === null) return null;
    if (!isMapping(raw) || keysOf(raw).length === 0) {
      throw valueError(`${label} must be non-empty object/mapping.`);
    }
    const output = new Map<string, number>();
    for (const rawKey of keysOf(raw)) {
      const key = InternalFloodBuilder.requireText(rawKey, `${label}.<state>`);
      output.set(key, InternalFloodBuilder.requireProbability(raw[rawKey], `${label}.${key}`));
    }
    return output;
  }

  private resolveOptionalValueMapping(raw: SpecValue, label: string): Map<string, number> | null {
    if (raw === null) return null;
    if (!isMapping(raw) || keysOf(raw).length === 0) {
      throw valueError(`${label} must be non-empty object/mapping.`);
    }
    const output = new Map<string, number>();
    for (const rawKey of keysOf(raw)) {
      const key = InternalFloodBuilder.requireText(rawKey, `${label}.<state>`);
      output.set(key, InternalFloodBuilder.requireNonNegativeFloat(raw[rawKey], `${label}.${key}`));
    }
    return output;
  }

  private definitions(
    configKey: string,
    idKey: string,
    required: boolean,
    defaultKey: (id: string) => string,
  ): Definition[] {
    const items = InternalFloodBuilder.requireList(
      getValueOr(this.config, configKey, []),
      `internal_flood.${configKey}`,
    );
    if (required && items.length === 0) throw valueError(`internal_flood requires non-empty ${configKey} list.`);
    const output: Definition[] = [];
    const seen = new Set<string>();
    items.forEach((raw, index) => {
      const item = InternalFloodBuilder.requireMapping(raw, `${configKey}[${index}]`);
      const id = InternalFloodBuilder.requireText(getValue(item, idKey), `${configKey}[${index}].${idKey}`);
      if (seen.has(id)) throw valueError(`Duplicate ${idKey} '${id}' in internal_flood.${configKey}.`);
      seen.add(id);
      const customKey = strip(text(getValueOr(item, "key", "")));
      output.push({ id, key: customKey.length > 0 ? customKey : defaultKey(id), item });
    });
    return output;
  }

  private sourceDefs(): Definition[] {
    return this.definitions("sources", "source_id", true, InternalFloodBuilder.sourceKey);
  }

  private pumpDefs(): Definition[] {
    return this.definitions("pumps", "pump_id", false, InternalFloodBuilder.pumpKey);
  }

  private mitigationDefs(): Definition[] {
    return this.definitions("mitigations", "mitigation_id", false, InternalFloodBuilder.mitigationKey);
  }

  private levelDefs(): Definition[] {
    return this.definitions("levels", "level_id", true, InternalFloodBuilder.levelKey);
  }

  private componentDefs(): Definition[] {
    return this.definitions("components", "ssc_id", false, InternalFloodBuilder.componentDamageKey);
  }

  private resolveSourceKey(item: SpecMapping, sourceKeyById: ReadonlyMap<string, string>, label: string): string {
    const sourceKey = strip(text(getValueOr(item, "source_key", "")));
    if (sourceKey.length > 0) return sourceKey;
    const sourceId = InternalFloodBuilder.requireText(getValue(item, "source_id"), `${label}.source_id`);
    const resolved = sourceKeyById.get(sourceId);
    if (resolved === undefined) throw valueError(`${label} references unknown source_id '${sourceId}'.`);
    return resolved;
  }

  private resolveOptionalPumpKey(
    item: SpecMapping,
    pumpKeyById: ReadonlyMap<string, string>,
    label: string,
  ): string | null {
    const pumpKey = strip(text(getValueOr(item, "pump_key", "")));
    if (pumpKey.length > 0) return pumpKey;
    const rawPumpId = strip(text(getValueOr(item, "pump_id", "")));
    if (rawPumpId.length === 0) return null;
    const resolved = pumpKeyById.get(rawPumpId);
    if (resolved === undefined) throw valueError(`${label} references unknown pump_id '${rawPumpId}'.`);
    return resolved;
  }

  private resolveOptionalMitigationKey(
    item: SpecMapping,
    mitigationKeyById: ReadonlyMap<string, string>,
    label: string,
  ): string | null {
    const mitigationKey = strip(text(getValueOr(item, "mitigation_key", "")));
    if (mitigationKey.length > 0) return mitigationKey;
    const rawMitigationId = strip(text(getValueOr(item, "mitigation_id", "")));
    if (rawMitigationId.length === 0) return null;
    const resolved = mitigationKeyById.get(rawMitigationId);
    if (resolved === undefined) {
      throw valueError(`${label} references unknown mitigation_id '${rawMitigationId}'.`);
    }
    return resolved;
  }

  private resolveLevelKey(item: SpecMapping, levelKeyById: ReadonlyMap<string, string>, label: string): string {
    const levelKey = strip(text(getValueOr(item, "level_key", "")));
    if (levelKey.length > 0) return levelKey;
    const levelId = InternalFloodBuilder.requireText(getValue(item, "level_id"), `${label}.level_id`);
    const resolved = levelKeyById.get(levelId);
    if (resolved === undefined) throw valueError(`${label} references unknown level_id '${levelId}'.`);
    return resolved;
  }

  private static resolveLevelIdFromItem(
    item: SpecMapping,
    levelKey: string,
    levelMeta: ReadonlyMap<string, LevelRecord>,
  ): string {
    const byId = strip(text(getValueOr(item, "level_id", "")));
    if (byId.length > 0 && levelMeta.has(byId)) return byId;
    for (const [levelId, record] of levelMeta) {
      if (record.key === levelKey) return levelId;
    }
    throw valueError(`Unable to resolve level_id for level_key '${levelKey}' in internal_flood.components.`);
  }

  private static hazardUsesPga(item: SpecMapping, label: string): boolean {
    const includePgaParent = truthy(getValueOr(item, "include_pga_parent", false));
    const hasFragility = getValue(item, "pga_fragility") !== null;
    const hasMap = getValue(item, "pga_fail_given_state") !== null;
    const uses = includePgaParent || hasFragility || hasMap;
    if (includePgaParent && !(hasFragility || hasMap)) {
      throw valueError(`${label} has include_pga_parent=true but no pga_fragility or pga_fail_given_state.`);
    }
    return uses;
  }

  private static checkMonotonic(probabilities: readonly number[], label: string): void {
    for (let index = 1; index < probabilities.length; index += 1) {
      if (probabilities[index] + 1e-12 < probabilities[index - 1]) {
        throw valueError(
          `${label} fragility probabilities must be non-decreasing; ` +
            `index ${index - 1}->${index}: ${floatRepr(probabilities[index - 1])} -> ` +
            `${floatRepr(probabilities[index])}`,
        );
      }
    }
  }

  private static requireProbability(raw: SpecValue, label: string): number {
    const value = toFloat(raw);
    if (!(0.0 <= value && value <= 1.0)) throw valueError(`${label} must be in [0,1], got ${floatRepr(value)}.`);
    return value;
  }

  private static requirePositiveFloat(raw: SpecValue, label: string): number {
    const value = toFloat(raw);
    if (value <= 0.0) throw valueError(`${label} must be > 0, got ${floatRepr(value)}.`);
    return value;
  }

  private static requireNonNegativeFloat(raw: SpecValue, label: string): number {
    const value = toFloat(raw);
    if (value < 0.0) throw valueError(`${label} must be >= 0, got ${floatRepr(value)}.`);
    return value;
  }

  private static requireMapping(raw: SpecValue, label: string): SpecMapping {
    if (!isMapping(raw)) throw valueError(`${label} must be object/mapping.`);
    return raw;
  }

  private static requireList(raw: SpecValue, label: string): SpecValue[] {
    if (!isSequence(raw)) throw valueError(`${label} must be list-like.`);
    return Array.from(raw);
  }

  private static requireText(raw: SpecValue, label: string): string {
    const value = strip(text(raw));
    if (value.length === 0) throw valueError(`${label} must be a non-empty string.`);
    return value;
  }

  private static validateProbabilityVector(probabilities: readonly number[], label: string): void {
    if (probabilities.some((value) => value < -1e-12 || value > 1.0 + 1e-12)) {
      throw valueError(`${label} has probability outside [0,1].`);
    }
    const total = sum(probabilities);
    if (Math.abs(total - 1.0) > 1e-9) {
      throw valueError(`${label} probabilities must sum to 1.0, got ${floatRepr(total)}.`);
    }
  }

  private static findStateIndex(states: readonly string[], target: string): number | null {
    for (let index = 0; index < states.length; index += 1) {
      if (states[index] === target) return index;
    }
    return null;
  }

  private static pgaKey(): string {
    return "hazard.seismic.PGA";
  }

  private pgaStatesRef(): string {
    return strip(text(getValueOr(this.config, "pga_states_ref", "PGA")));
  }

  private pgaNoneStateLabel(): string {
    const label = strip(text(getValueOr(this.config, "pga_none_state_label", "None")));
    return label.length > 0 ? label : "None";
  }

  private levelStatesRef(): string {
    return strip(text(getValueOr(this.config, "level_states_ref", "SITE_DEPTH")));
  }

  private levelNoneStateLabel(): string {
    const label = strip(text(getValueOr(this.config, "level_none_state_label", "None")));
    return label.length > 0 ? label : "None";
  }

  private static sourceKey(sourceId: string): string {
    return `internal_flood.source.${slug(sourceId)}.initiated`;
  }

  private static pumpKey(pumpId: string): string {
    return `internal_flood.pump.${slug(pumpId)}.failed`;
  }

  private static mitigationKey(mitigationId: string): string {
    return `internal_flood.mitigation.${slug(mitigationId)}.effective`;
  }

  private static levelKey(levelId: string): string {
    return `internal_flood.level.${slug(levelId)}`;
  }

  private static componentDamageKey(sscId: string): string {
    return `internal_flood.damage_inside.${slug(sscId)}`;
  }

  private static defaultSourceNodeId(sourceId: string): string {
    return `IF_SOURCE_${slug(sourceId).toUpperCase()}_INITIATED`;
  }

  private static defaultPumpNodeId(pumpId: string): string {
    return `IF_SINK_PUMP_${slug(pumpId).toUpperCase()}_FAILED`;
  }

  private static defaultMitigationNodeId(mitigationId: string): string {
    return `IF_MITIGATION_${slug(mitigationId).toUpperCase()}_EFFECTIVE`;
  }

  private static defaultLevelNodeId(levelId: string): string {
    return `IF_LEVEL_${slug(levelId).toUpperCase()}`;
  }

  private static defaultComponentNodeId(sscId: string): string {
    return `IF_FAIL_${slug(sscId).toUpperCase()}`;
  }
}

export { InternalFloodBuilder };
