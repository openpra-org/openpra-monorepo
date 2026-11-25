import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { NetworkBuilderError, valueError } from "../core/errors";
import { isClose } from "../core/math-functions";
import type { CpdGenerator, NodeRecord } from "../core/model";
import {
  decodeRowIndex,
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
  sortedText,
  strip,
  stripCharacters,
  text,
  toFloat,
  truthy,
  tupleRepr,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import {
  clamp01,
  comboKey,
  floatSum,
  fragilityProbability,
  makeConnectFailureCpdGenerator,
  makeConstantFailureCpdGenerator,
  makeEquipmentUnavailableCpdGenerator,
  makeGateFailureCpdGenerator,
  makeHazardFailureCpdGenerator,
  makeIdheasContextCpdGenerator,
  makeIdheasContextHazardMultiplierCpdGenerator,
  makeIdheasHfeSelectorCpdGenerator,
  makeRetrieveFailureCpdGenerator,
  makeStartRunFailureCpdGenerator,
  makeStartRunFailureLogisticsCpdGenerator,
  makeTransportFailureCpdGenerator,
  resolveFloodStateNumericValue,
} from "./flex-cpd-generators";
import type { Fragility } from "./flex-cpd-generators";
import { aggregateTableHep, getRowHep, getTable, getTableRows, loadAndValidatePhase0Dataset } from "./flex-idheas-data";

const BOOL_STATES = ["False", "True"];

const AGGREGATION_POLICIES = ["subject_value", "mean", "median", "p95"];

const COMBINE_MODES = ["noisy_or_independent", "max", "additive_clipped"];

const STEP_TARGETS = [
  "retrieve_failed",
  "transport_failed",
  "connect_failed",
  "start_run_failed",
  "connect_start_bundle",
  "all_steps",
];

const ROLE_TO_TARGET: Readonly<Record<string, string>> = {
  elap: "all_steps",
  elap_declare: "all_steps",
  elap_declaration: "all_steps",
  elap_declare_failed: "all_steps",
  transport: "transport_failed",
  transport_failed: "transport_failed",
  connect_start: "connect_start_bundle",
  connect_start_failed: "connect_start_bundle",
  strategy: "strategy_failed",
};

interface HazardFailureConfig {
  usesPga: boolean;
  pgaFragility: Fragility | null;
  pgaFailGivenState: Map<string, number> | null;
  floodParentKey: string | null;
  floodNoneLabel: string;
  floodFragility: Fragility | null;
  floodFailGivenState: Map<string, number> | null;
  floodStateValues: Map<string, number> | null;
  baselineFailProb: number;
  combineMode: string;
  probFloor: number;
  probCap: number;
  allowExtraParents: boolean;
}

interface HazardMultiplierConfig {
  baselineProbs: number[];
  degradedProbs: number[] | null;
  severeProbs: number[];
  combineMode: string;
  probFloor: number;
  probCap: number;
  stateFailByParent: Map<string, Map<string, number>>;
  weightByParent: Map<string, number>;
}

interface IntegrationRule {
  hfeId: string;
  hfeKey: string;
  strategyId: string;
  targetStep: string;
  mode: string;
}

interface StepHfeKeys {
  retrieveFailed: string[];
  transportFailed: string[];
  connectFailed: string[];
  startRunFailed: string[];
}

type StepName = keyof StepHfeKeys;

const slug = (token: string): string => {
  const cleaned = stripCharacters(replaceNonAlphanumericRuns(strip(token), "_"), "_");
  return cleaned.length > 0 ? cleaned.toLowerCase() : "x";
};

const strippedText = (mapping: SpecMapping, key: string): string => strip(text(getValueOr(mapping, key, "")));

const nonEmptyOr = (value: string, fallback: string): string => (value.length > 0 ? value : fallback);

const uniqueInOrder = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
};

class FlexBuilder extends BuilderBase {
  get builderType(): string {
    return "flex";
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    const local = this.localProvidedKeys();

    for (const item of this.storageItems()) {
      if (this.usesPga(item)) required.add(this.pgaKey());
      const floodParentKey = this.resolveFloodParentKey(item, text(getValueOr(item, "storage_id", "")), "storage");
      if (floodParentKey !== null) required.add(floodParentKey);
    }

    for (const item of this.equipmentItems()) {
      const storageKey = this.resolveStorageParentKey(item, null);
      if (storageKey !== null && !local.has(storageKey)) required.add(storageKey);
      if (this.usesPga(item)) required.add(this.pgaKey());
      const floodParentKey = this.resolveFloodParentKey(item, text(getValueOr(item, "equipment_id", "")), "equipment");
      if (floodParentKey !== null) required.add(floodParentKey);
    }

    for (const item of this.accessItems()) {
      if (this.usesPga(item)) required.add(this.pgaKey());
      const floodParentKey = this.resolveFloodParentKey(item, text(getValueOr(item, "access_id", "")), "access");
      if (floodParentKey !== null) required.add(floodParentKey);
    }

    for (const item of this.hookupItems()) {
      if (this.usesPga(item)) required.add(this.pgaKey());
      const floodParentKey = this.resolveFloodParentKey(item, text(getValueOr(item, "hookup_id", "")), "hookup");
      if (floodParentKey !== null) required.add(floodParentKey);
    }

    for (const item of this.strategyItems()) {
      const strategyId = FlexBuilder.requireText(getValue(item, "strategy_id"), "strategies[].strategy_id");
      const strategyMode = this.strategyMode(item, strategyId);
      let equipmentKey: string | null = null;
      if (strategyMode === "full") equipmentKey = this.resolveStrategyEquipmentKey(item, strategyId, null);
      const accessKey = this.resolveStrategyAccessKey(item, strategyId, null);
      const hookupKey = this.resolveStrategyHookupKey(item, strategyId, null);
      for (const dependency of [equipmentKey, accessKey, hookupKey]) {
        if (dependency !== null && dependency.length > 0 && !local.has(dependency)) required.add(dependency);
      }
    }

    for (const item of this.goalItems()) {
      const goalId = FlexBuilder.requireText(getValue(item, "goal_id"), "goals[].goal_id");
      for (const strategyKey of this.resolveGoalStrategyFailedKeys(item, goalId, null)) {
        if (!local.has(strategyKey)) required.add(strategyKey);
      }
    }

    const contextKeyById = new Map<string, string>();
    for (const item of this.idheasContextItems()) {
      const contextId = FlexBuilder.requireText(getValue(item, "context_id"), "idheas_eca.contexts[].context_id");
      if (contextKeyById.has(contextId)) {
        throw valueError(`Duplicate idheas_eca.contexts[].context_id '${contextId}'.`);
      }
      contextKeyById.set(contextId, nonEmptyOr(strippedText(item, "key"), this.defaultIdheasContextKey(contextId)));
      const parentKeys = this.resolveTextList(
        getValue(item, "parent_keys"),
        `idheas_eca.contexts[${contextId}].parent_keys`,
        true,
      );
      for (const parentKey of parentKeys) {
        if (!local.has(parentKey)) required.add(parentKey);
      }
    }

    for (const item of this.idheasHfeItems()) {
      const hfeId = FlexBuilder.requireText(getValue(item, "hfe_id"), "idheas_eca.hfe_nodes[].hfe_id");
      for (const parentKey of this.resolveIdheasHfeParentKeys(item, hfeId, contextKeyById)) {
        if (!local.has(parentKey)) required.add(parentKey);
      }
    }

    return required;
  }

  get provides(): Set<string> {
    return this.localProvidedKeys();
  }

  private localProvidedKeys(): Set<string> {
    const output = new Set<string>();

    for (const item of this.storageItems()) {
      const storageId = FlexBuilder.requireText(getValue(item, "storage_id"), "storages[].storage_id");
      output.add(nonEmptyOr(strippedText(item, "key"), this.storageFailedKey(storageId)));
    }

    for (const item of this.equipmentItems()) {
      const equipmentId = FlexBuilder.requireText(getValue(item, "equipment_id"), "equipment[].equipment_id");
      output.add(nonEmptyOr(strippedText(item, "key"), this.equipmentUnavailableKey(equipmentId)));
    }

    for (const item of this.accessItems()) {
      const accessId = FlexBuilder.requireText(getValue(item, "access_id"), "access[].access_id");
      output.add(nonEmptyOr(strippedText(item, "key"), this.accessFailedKey(accessId)));
    }

    for (const item of this.hookupItems()) {
      const hookupId = FlexBuilder.requireText(getValue(item, "hookup_id"), "hookups[].hookup_id");
      output.add(nonEmptyOr(strippedText(item, "key"), this.hookupFailedKey(hookupId)));
    }

    for (const item of this.strategyItems()) {
      const strategyId = FlexBuilder.requireText(getValue(item, "strategy_id"), "strategies[].strategy_id");
      output.add(nonEmptyOr(strippedText(item, "retrieve_failed_key"), this.retrieveFailedKey(strategyId)));
      output.add(nonEmptyOr(strippedText(item, "transport_failed_key"), this.transportFailedKey(strategyId)));
      output.add(nonEmptyOr(strippedText(item, "connect_failed_key"), this.connectFailedKey(strategyId)));
      output.add(nonEmptyOr(strippedText(item, "start_run_failed_key"), this.startRunFailedKey(strategyId)));
      output.add(nonEmptyOr(strippedText(item, "strategy_failed_key"), this.strategyFailedKey(strategyId)));
    }

    for (const item of this.goalItems()) {
      const goalId = FlexBuilder.requireText(getValue(item, "goal_id"), "goals[].goal_id");
      output.add(nonEmptyOr(strippedText(item, "key"), this.goalFailedKey(goalId)));
    }

    for (const item of this.idheasContextItems()) {
      const contextId = FlexBuilder.requireText(getValue(item, "context_id"), "idheas_eca.contexts[].context_id");
      output.add(nonEmptyOr(strippedText(item, "key"), this.defaultIdheasContextKey(contextId)));
    }

    for (const item of this.idheasHfeItems()) {
      const hfeId = FlexBuilder.requireText(getValue(item, "hfe_id"), "idheas_eca.hfe_nodes[].hfe_id");
      output.add(nonEmptyOr(strippedText(item, "key"), this.defaultIdheasHfeKey(hfeId)));
    }

    return output;
  }

  build(context: ModelContext): void {
    const pgaKey = this.pgaKey();
    const pgaNoneLabel = this.pgaNoneStateLabel();
    const pgaAvailable = context.registry.hasKey(pgaKey);
    let pgaNodeId: string | null = null;
    let pgaStates: string[] = [pgaNoneLabel];
    let pgaStateValues = new Map<string, number>();

    if (pgaAvailable) {
      pgaNodeId = context.registry.nodeId(pgaKey);
      pgaStates = context.model.node(pgaNodeId).states;
    }

    const hazardGroups = [this.storageItems(), this.equipmentItems(), this.accessItems(), this.hookupItems()];
    const anyPgaFragility = hazardGroups.some((group) => group.some((item) => this.usesPga(item)));
    if (anyPgaFragility) {
      if (!pgaAvailable) {
        throw valueError("flex builder uses pga_fragility/include_pga_parent, but seismic PGA key is unavailable.");
      }
      pgaStateValues = this.resolvePgaStateValues(context, pgaStates, pgaNoneLabel);
    }

    const storageKeyById = new Map<string, string>();
    for (const item of this.storageItems()) {
      const storageId = FlexBuilder.requireText(getValue(item, "storage_id"), "storages[].storage_id");
      if (storageKeyById.has(storageId)) {
        throw valueError(`Duplicate storage_id '${storageId}' in flex.storages.`);
      }

      const key = nonEmptyOr(strippedText(item, "key"), this.storageFailedKey(storageId));
      const nodeId = nonEmptyOr(strippedText(item, "node_id"), this.defaultStorageFailedNodeId(storageId));
      const cfg = this.resolveHazardFailureCfg(item, `storages[${storageId}]`, "storage");
      const parentIds: string[] = [];
      if (cfg.usesPga) {
        if (pgaNodeId === null) {
          throw valueError(`flex.storages[${storageId}] requires PGA parent but PGA is unavailable.`);
        }
        parentIds.push(pgaNodeId);
      }
      const floodParentKey = cfg.floodParentKey ?? "";
      if (floodParentKey.length > 0) {
        if (!context.registry.hasKey(floodParentKey)) {
          throw valueError(`flex.storages[${storageId}] references unknown flood parent key '${floodParentKey}'.`);
        }
        parentIds.push(context.registry.nodeId(floodParentKey));
      }

      const cpdGenerator = makeHazardFailureCpdGenerator({
        pgaKey: cfg.usesPga ? pgaKey : null,
        pgaStateValues,
        pgaNoneLabel,
        pgaFragility: cfg.pgaFragility,
        pgaFailGivenState: cfg.pgaFailGivenState,
        floodParentKey: floodParentKey.length > 0 ? floodParentKey : null,
        floodNoneLabel: cfg.floodNoneLabel,
        floodFragility: cfg.floodFragility,
        floodFailGivenState: cfg.floodFailGivenState,
        floodStateValues: cfg.floodStateValues,
        baselineFailProb: cfg.baselineFailProb,
        combineMode: cfg.combineMode,
        probFloor: cfg.probFloor,
        probCap: cfg.probCap,
        allowExtraParents: cfg.allowExtraParents,
      });

      context.model.addNode({
        key,
        nodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "storage_failed",
          storage_id: storageId,
          component_group: FlexBuilder.resolveComponentGroup(item, [storageId]),
          true_means: "storage_failed",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, nodeId);
      storageKeyById.set(storageId, key);
    }

    const equipmentKeyById = new Map<string, string>();
    for (const item of this.equipmentItems()) {
      const equipmentId = FlexBuilder.requireText(getValue(item, "equipment_id"), "equipment[].equipment_id");
      if (equipmentKeyById.has(equipmentId)) {
        throw valueError(`Duplicate equipment_id '${equipmentId}' in flex.equipment.`);
      }

      const key = nonEmptyOr(strippedText(item, "key"), this.equipmentUnavailableKey(equipmentId));
      const nodeId = nonEmptyOr(strippedText(item, "node_id"), this.defaultEquipmentUnavailableNodeId(equipmentId));
      const cfg = this.resolveHazardFailureCfg(item, `equipment[${equipmentId}]`, "equipment");

      const storageParentKey = this.resolveStorageParentKey(item, storageKeyById);
      const parentIds: string[] = [];
      if (storageParentKey !== null) {
        if (!context.registry.hasKey(storageParentKey)) {
          throw valueError(`flex.equipment[${equipmentId}] references unknown storage key '${storageParentKey}'.`);
        }
        parentIds.push(context.registry.nodeId(storageParentKey));
      }

      if (cfg.usesPga) {
        if (pgaNodeId === null) {
          throw valueError(`flex.equipment[${equipmentId}] requires PGA parent but PGA is unavailable.`);
        }
        parentIds.push(pgaNodeId);
      }
      const floodParentKey = cfg.floodParentKey ?? "";
      if (floodParentKey.length > 0) {
        if (!context.registry.hasKey(floodParentKey)) {
          throw valueError(`flex.equipment[${equipmentId}] references unknown flood parent key '${floodParentKey}'.`);
        }
        parentIds.push(context.registry.nodeId(floodParentKey));
      }

      const cpdGenerator = makeEquipmentUnavailableCpdGenerator({
        storageParentKey,
        storageFailureUnavailabilityProb: FlexBuilder.requireProbability(
          getValueOr(item, "storage_failure_unavailability_prob", 1),
          `equipment[${equipmentId}].storage_failure_unavailability_prob`,
        ),
        pgaKey: cfg.usesPga ? pgaKey : null,
        pgaStateValues,
        pgaNoneLabel,
        pgaFragility: cfg.pgaFragility,
        pgaFailGivenState: cfg.pgaFailGivenState,
        floodParentKey: floodParentKey.length > 0 ? floodParentKey : null,
        floodNoneLabel: cfg.floodNoneLabel,
        floodFragility: cfg.floodFragility,
        floodFailGivenState: cfg.floodFailGivenState,
        floodStateValues: cfg.floodStateValues,
        baselineFailProb: cfg.baselineFailProb,
        combineMode: cfg.combineMode,
        probFloor: cfg.probFloor,
        probCap: cfg.probCap,
        allowExtraParents: cfg.allowExtraParents,
      });

      context.model.addNode({
        key,
        nodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "equipment_unavailable",
          equipment_id: equipmentId,
          component_group: FlexBuilder.resolveComponentGroup(item, [equipmentId]),
          true_means: "equipment_unavailable",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, nodeId);
      equipmentKeyById.set(equipmentId, key);
    }

    const accessKeyById = new Map<string, string>();
    for (const item of this.accessItems()) {
      const accessId = FlexBuilder.requireText(getValue(item, "access_id"), "access[].access_id");
      if (accessKeyById.has(accessId)) {
        throw valueError(`Duplicate access_id '${accessId}' in flex.access.`);
      }

      const key = nonEmptyOr(strippedText(item, "key"), this.accessFailedKey(accessId));
      const nodeId = nonEmptyOr(strippedText(item, "node_id"), this.defaultAccessFailedNodeId(accessId));
      const cfg = this.resolveHazardFailureCfg(item, `access[${accessId}]`, "access");
      const parentIds: string[] = [];
      if (cfg.usesPga) {
        if (pgaNodeId === null) {
          throw valueError(`flex.access[${accessId}] requires PGA parent but PGA is unavailable.`);
        }
        parentIds.push(pgaNodeId);
      }
      const floodParentKey = cfg.floodParentKey ?? "";
      if (floodParentKey.length > 0) {
        if (!context.registry.hasKey(floodParentKey)) {
          throw valueError(`flex.access[${accessId}] references unknown flood parent key '${floodParentKey}'.`);
        }
        parentIds.push(context.registry.nodeId(floodParentKey));
      }

      const cpdGenerator = makeHazardFailureCpdGenerator({
        pgaKey: cfg.usesPga ? pgaKey : null,
        pgaStateValues,
        pgaNoneLabel,
        pgaFragility: cfg.pgaFragility,
        pgaFailGivenState: cfg.pgaFailGivenState,
        floodParentKey: floodParentKey.length > 0 ? floodParentKey : null,
        floodNoneLabel: cfg.floodNoneLabel,
        floodFragility: cfg.floodFragility,
        floodFailGivenState: cfg.floodFailGivenState,
        floodStateValues: cfg.floodStateValues,
        baselineFailProb: cfg.baselineFailProb,
        combineMode: cfg.combineMode,
        probFloor: cfg.probFloor,
        probCap: cfg.probCap,
        allowExtraParents: cfg.allowExtraParents,
      });

      context.model.addNode({
        key,
        nodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "access_failed",
          access_id: accessId,
          component_group: FlexBuilder.resolveComponentGroup(item, [accessId]),
          true_means: "access_failed",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, nodeId);
      accessKeyById.set(accessId, key);
    }

    const hookupKeyById = new Map<string, string>();
    for (const item of this.hookupItems()) {
      const hookupId = FlexBuilder.requireText(getValue(item, "hookup_id"), "hookups[].hookup_id");
      if (hookupKeyById.has(hookupId)) {
        throw valueError(`Duplicate hookup_id '${hookupId}' in flex.hookups.`);
      }

      const key = nonEmptyOr(strippedText(item, "key"), this.hookupFailedKey(hookupId));
      const nodeId = nonEmptyOr(strippedText(item, "node_id"), this.defaultHookupFailedNodeId(hookupId));
      const cfg = this.resolveHazardFailureCfg(item, `hookups[${hookupId}]`, "hookup");
      const parentIds: string[] = [];
      if (cfg.usesPga) {
        if (pgaNodeId === null) {
          throw valueError(`flex.hookups[${hookupId}] requires PGA parent but PGA is unavailable.`);
        }
        parentIds.push(pgaNodeId);
      }
      const floodParentKey = cfg.floodParentKey ?? "";
      if (floodParentKey.length > 0) {
        if (!context.registry.hasKey(floodParentKey)) {
          throw valueError(`flex.hookups[${hookupId}] references unknown flood parent key '${floodParentKey}'.`);
        }
        parentIds.push(context.registry.nodeId(floodParentKey));
      }

      const cpdGenerator = makeHazardFailureCpdGenerator({
        pgaKey: cfg.usesPga ? pgaKey : null,
        pgaStateValues,
        pgaNoneLabel,
        pgaFragility: cfg.pgaFragility,
        pgaFailGivenState: cfg.pgaFailGivenState,
        floodParentKey: floodParentKey.length > 0 ? floodParentKey : null,
        floodNoneLabel: cfg.floodNoneLabel,
        floodFragility: cfg.floodFragility,
        floodFailGivenState: cfg.floodFailGivenState,
        floodStateValues: cfg.floodStateValues,
        baselineFailProb: cfg.baselineFailProb,
        combineMode: cfg.combineMode,
        probFloor: cfg.probFloor,
        probCap: cfg.probCap,
        allowExtraParents: cfg.allowExtraParents,
      });

      context.model.addNode({
        key,
        nodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "hookup_inaccessible",
          hookup_id: hookupId,
          component_group: FlexBuilder.resolveComponentGroup(item, [hookupId]),
          true_means: "hookup_inaccessible",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, nodeId);
      hookupKeyById.set(hookupId, key);
    }

    const idheasIntegrationByStrategy = this.buildIdheasPhase1Nodes(context);

    const strategyFailedKeyById = new Map<string, string>();
    for (const item of this.strategyItems()) {
      const strategyId = FlexBuilder.requireText(getValue(item, "strategy_id"), "strategies[].strategy_id");
      if (strategyFailedKeyById.has(strategyId)) {
        throw valueError(`Duplicate strategy_id '${strategyId}' in flex.strategies.`);
      }
      const strategyMode = this.strategyMode(item, strategyId);
      const fullMode = strategyMode === "full";

      let equipmentKey: string | null = null;
      if (fullMode) equipmentKey = this.resolveStrategyEquipmentKey(item, strategyId, equipmentKeyById);
      const accessKey = this.resolveStrategyAccessKey(item, strategyId, accessKeyById);
      const hookupKey = this.resolveStrategyHookupKey(item, strategyId, hookupKeyById);
      const dependencies: [string | null, string][] = [[accessKey, "access"]];
      if (fullMode) dependencies.unshift([equipmentKey, "equipment"]);
      for (const [dependencyKey, dependencyLabel] of dependencies) {
        if (dependencyKey === null) {
          throw valueError(`flex.strategies[${strategyId}] requires ${dependencyLabel} reference.`);
        }
        if (!context.registry.hasKey(dependencyKey)) {
          throw valueError(
            `flex.strategies[${strategyId}] references unknown ${dependencyLabel} key '${dependencyKey}'.`,
          );
        }
      }
      if (hookupKey !== null && hookupKey.length > 0 && !context.registry.hasKey(hookupKey)) {
        throw valueError(`flex.strategies[${strategyId}] references unknown hookup key '${hookupKey}'.`);
      }

      const equipmentParentId = equipmentKey !== null ? context.registry.nodeId(equipmentKey) : null;
      const accessKeyText = text(accessKey);
      const accessParentId = context.registry.nodeId(accessKeyText);
      const hookupParentId = hookupKey !== null && hookupKey.length > 0 ? context.registry.nodeId(hookupKey) : null;
      const integrationRules = idheasIntegrationByStrategy.get(strategyId) ?? [];
      const stepHfeKeys = this.resolveIdheasStepHfeKeys(strategyId, integrationRules);
      const strategyGroup = FlexBuilder.resolveComponentGroup(item, [
        strategyId,
        text(getValueOr(item, "equipment_id", "")),
        text(getValueOr(item, "hookup_id", "")),
      ]);

      const retrieveKey = nonEmptyOr(strippedText(item, "retrieve_failed_key"), this.retrieveFailedKey(strategyId));
      const retrieveNodeId = nonEmptyOr(
        strippedText(item, "retrieve_failed_node_id"),
        this.defaultRetrieveFailedNodeId(strategyId),
      );
      const retrieveNominalFailProb =
        fullMode ?
          FlexBuilder.requireProbability(
            getValueOr(item, "retrieve_fail_if_equipment_available", 0.05),
            `strategies[${strategyId}].retrieve_fail_if_equipment_available`,
          )
        : FlexBuilder.requireProbability(
            getValueOr(item, "retrieve_fail_prob", getValueOr(item, "retrieve_fail_if_equipment_available", 0.05)),
            `strategies[${strategyId}].retrieve_fail_prob`,
          );
      const retrieveFailIfEquipmentUnavailable =
        fullMode ?
          FlexBuilder.requireProbability(
            getValueOr(item, "retrieve_fail_if_equipment_unavailable", 0.98),
            `strategies[${strategyId}].retrieve_fail_if_equipment_unavailable`,
          )
        : retrieveNominalFailProb;
      const retrieveFailIfAccessOpen = FlexBuilder.requireProbability(
        getValueOr(item, "retrieve_fail_if_access_open", retrieveNominalFailProb),
        `strategies[${strategyId}].retrieve_fail_if_access_open`,
      );
      const retrieveFailIfAccessFailed = FlexBuilder.requireProbability(
        getValueOr(item, "retrieve_fail_if_access_failed", 1),
        `strategies[${strategyId}].retrieve_fail_if_access_failed`,
      );
      const retrieveFailIfHfeFailed = FlexBuilder.requireProbability(
        getValueOr(item, "retrieve_fail_if_hfe_failed", 1),
        `strategies[${strategyId}].retrieve_fail_if_hfe_failed`,
      );
      const retrieveCpd = makeRetrieveFailureCpdGenerator({
        equipmentUnavailableKey: fullMode && equipmentKey !== null ? equipmentKey : null,
        accessFailedKey: accessKeyText,
        hfeFailedKeys: stepHfeKeys.retrieveFailed,
        failIfAccessOpen: retrieveFailIfAccessOpen,
        failIfAccessFailed: retrieveFailIfAccessFailed,
        failIfEquipmentUnavailable: retrieveFailIfEquipmentUnavailable,
        failIfHfeFailed: retrieveFailIfHfeFailed,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_retrieve_parents", false)),
      });
      const retrieveParentIds: string[] = [accessParentId];
      if (fullMode && equipmentParentId !== null) retrieveParentIds.push(equipmentParentId);
      for (const hfeKey of stepHfeKeys.retrieveFailed) retrieveParentIds.push(context.registry.nodeId(hfeKey));
      context.model.addNode({
        key: retrieveKey,
        nodeId: retrieveNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "retrieve_failed",
          strategy_id: strategyId,
          strategy_mode: strategyMode,
          component_group: strategyGroup,
          true_means: "retrieve_failed",
        },
        parentIds: retrieveParentIds.filter((parentId) => parentId.length > 0),
        cpdGenerator: retrieveCpd,
      });
      context.registry.register(retrieveKey, retrieveNodeId);

      const transportKey = nonEmptyOr(strippedText(item, "transport_failed_key"), this.transportFailedKey(strategyId));
      const transportNodeId = nonEmptyOr(
        strippedText(item, "transport_failed_node_id"),
        this.defaultTransportFailedNodeId(strategyId),
      );
      const transportFailIfAccessOpen = FlexBuilder.requireProbability(
        getValueOr(item, "transport_fail_if_access_open", 0.08),
        `strategies[${strategyId}].transport_fail_if_access_open`,
      );
      const transportFailIfAccessFailed = FlexBuilder.requireProbability(
        getValueOr(item, "transport_fail_if_access_failed", 0.98),
        `strategies[${strategyId}].transport_fail_if_access_failed`,
      );
      const transportFailIfRetrieveFailed = FlexBuilder.requireProbability(
        getValueOr(item, "transport_fail_if_retrieve_failed", 1),
        `strategies[${strategyId}].transport_fail_if_retrieve_failed`,
      );
      const transportFailIfHfeFailed = FlexBuilder.requireProbability(
        getValueOr(item, "transport_fail_if_hfe_failed", 1),
        `strategies[${strategyId}].transport_fail_if_hfe_failed`,
      );
      const transportCpd = makeTransportFailureCpdGenerator({
        retrieveFailedKey: retrieveKey,
        accessFailedKey: accessKeyText,
        hfeFailedKeys: stepHfeKeys.transportFailed,
        failIfAccessOpen: transportFailIfAccessOpen,
        failIfAccessFailed: transportFailIfAccessFailed,
        failIfRetrieveFailed: transportFailIfRetrieveFailed,
        failIfHfeFailed: transportFailIfHfeFailed,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_transport_parents", false)),
      });
      const transportParentIds = [retrieveNodeId, accessParentId];
      for (const hfeKey of stepHfeKeys.transportFailed) transportParentIds.push(context.registry.nodeId(hfeKey));
      context.model.addNode({
        key: transportKey,
        nodeId: transportNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "transport_failed",
          strategy_id: strategyId,
          strategy_mode: strategyMode,
          component_group: strategyGroup,
          true_means: "transport_failed",
        },
        parentIds: transportParentIds,
        cpdGenerator: transportCpd,
      });
      context.registry.register(transportKey, transportNodeId);

      const connectKey = nonEmptyOr(strippedText(item, "connect_failed_key"), this.connectFailedKey(strategyId));
      const connectNodeId = nonEmptyOr(
        strippedText(item, "connect_failed_node_id"),
        this.defaultConnectFailedNodeId(strategyId),
      );
      const connectNominalFailProb = FlexBuilder.requireProbability(
        getValueOr(
          item,
          "connect_fail_if_ready",
          getValueOr(item, "connect_fail_if_hookup_ok", getValueOr(item, "connect_fail_prob", 0.1)),
        ),
        `strategies[${strategyId}].connect_fail_if_ready`,
      );
      const connectFailIfTransportFailed = FlexBuilder.requireProbability(
        getValueOr(item, "connect_fail_if_transport_failed", 1),
        `strategies[${strategyId}].connect_fail_if_transport_failed`,
      );
      const connectFailIfHookupInaccessible = FlexBuilder.requireProbability(
        getValueOr(item, "connect_fail_if_hookup_inaccessible", getValueOr(item, "connect_fail_if_hookup_failed", 1)),
        `strategies[${strategyId}].connect_fail_if_hookup_inaccessible`,
      );
      const connectFailIfHfeFailed = FlexBuilder.requireProbability(
        getValueOr(item, "connect_fail_if_hfe_failed", 1),
        `strategies[${strategyId}].connect_fail_if_hfe_failed`,
      );
      const connectCpd = makeConnectFailureCpdGenerator({
        transportFailedKey: transportKey,
        hookupInaccessibleKey: hookupKey !== null && hookupKey.length > 0 ? hookupKey : null,
        hfeFailedKeys: stepHfeKeys.connectFailed,
        failIfReady: connectNominalFailProb,
        failIfTransportFailed: connectFailIfTransportFailed,
        failIfHookupInaccessible: connectFailIfHookupInaccessible,
        failIfHfeFailed: connectFailIfHfeFailed,
        allowExtraParents: truthy(getValueOr(item, "allow_extra_connect_parents", false)),
      });
      const connectParentIds = [transportNodeId];
      if (hookupParentId !== null && hookupParentId.length > 0) connectParentIds.push(hookupParentId);
      for (const hfeKey of stepHfeKeys.connectFailed) connectParentIds.push(context.registry.nodeId(hfeKey));

      context.model.addNode({
        key: connectKey,
        nodeId: connectNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "connect_failed",
          strategy_id: strategyId,
          strategy_mode: strategyMode,
          component_group: strategyGroup,
          true_means: "connect_failed",
        },
        parentIds: connectParentIds.filter((parentId) => parentId.length > 0),
        cpdGenerator: connectCpd,
      });
      context.registry.register(connectKey, connectNodeId);

      const startRunKey = nonEmptyOr(strippedText(item, "start_run_failed_key"), this.startRunFailedKey(strategyId));
      const startRunNodeId = nonEmptyOr(
        strippedText(item, "start_run_failed_node_id"),
        this.defaultStartRunFailedNodeId(strategyId),
      );
      let startRunCpd: CpdGenerator;
      let startRunParentIds: string[];
      if (fullMode) {
        const startRunFailIfReady = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_ready", 0.1),
          `strategies[${strategyId}].start_run_fail_if_ready`,
        );
        const startRunFailIfEquipmentUnavailable = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_equipment_unavailable", 0.95),
          `strategies[${strategyId}].start_run_fail_if_equipment_unavailable`,
        );
        const startRunFailIfConnectFailed = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_connect_failed", 0.95),
          `strategies[${strategyId}].start_run_fail_if_connect_failed`,
        );
        const startRunFailIfBothFailed = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_both_failed", 0.995),
          `strategies[${strategyId}].start_run_fail_if_both_failed`,
        );
        const startRunFailIfHfeFailed = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_hfe_failed", 1),
          `strategies[${strategyId}].start_run_fail_if_hfe_failed`,
        );
        startRunCpd = makeStartRunFailureCpdGenerator({
          equipmentUnavailableKey: text(equipmentKey),
          connectFailedKey: connectKey,
          hfeFailedKeys: stepHfeKeys.startRunFailed,
          failIfReady: startRunFailIfReady,
          failIfEquipmentUnavailable: startRunFailIfEquipmentUnavailable,
          failIfConnectFailed: startRunFailIfConnectFailed,
          failIfBothFailed: startRunFailIfBothFailed,
          failIfHfeFailed: startRunFailIfHfeFailed,
          allowExtraParents: truthy(getValueOr(item, "allow_extra_start_run_parents", false)),
        });
        startRunParentIds = equipmentParentId !== null ? [equipmentParentId, connectNodeId] : [connectNodeId];
      } else {
        const startRunFailIfReady = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_ready", 0.1),
          `strategies[${strategyId}].start_run_fail_if_ready`,
        );
        const startRunFailIfConnectFailed = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_connect_failed", 0.95),
          `strategies[${strategyId}].start_run_fail_if_connect_failed`,
        );
        const startRunFailIfHfeFailed = FlexBuilder.requireProbability(
          getValueOr(item, "start_run_fail_if_hfe_failed", 1),
          `strategies[${strategyId}].start_run_fail_if_hfe_failed`,
        );
        startRunCpd = makeStartRunFailureLogisticsCpdGenerator({
          connectFailedKey: connectKey,
          hfeFailedKeys: stepHfeKeys.startRunFailed,
          failIfReady: startRunFailIfReady,
          failIfConnectFailed: startRunFailIfConnectFailed,
          failIfHfeFailed: startRunFailIfHfeFailed,
          allowExtraParents: truthy(getValueOr(item, "allow_extra_start_run_parents", false)),
        });
        startRunParentIds = [connectNodeId];
      }
      for (const hfeKey of stepHfeKeys.startRunFailed) startRunParentIds.push(context.registry.nodeId(hfeKey));
      context.model.addNode({
        key: startRunKey,
        nodeId: startRunNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "start_run_failed",
          strategy_id: strategyId,
          strategy_mode: strategyMode,
          component_group: strategyGroup,
          true_means: "start_run_failed",
        },
        parentIds: startRunParentIds,
        cpdGenerator: startRunCpd,
      });
      context.registry.register(startRunKey, startRunNodeId);

      const strategyFailedKey = nonEmptyOr(
        strippedText(item, "strategy_failed_key"),
        this.strategyFailedKey(strategyId),
      );
      const strategyFailedNodeId = nonEmptyOr(
        strippedText(item, "strategy_failed_node_id"),
        this.defaultStrategyFailedNodeId(strategyId),
      );
      const strategyFailMode = strip(text(getValueOr(item, "strategy_fail_mode", "or"))).toLowerCase();
      if (strategyFailMode !== "or") {
        throw valueError(`flex.strategies[${strategyId}].strategy_fail_mode must be 'or'.`);
      }
      const strategyParentKeys = this.applyIdheasStrategyIntegrations(
        strategyId,
        [retrieveKey, transportKey, connectKey, startRunKey],
        integrationRules,
      );
      const strategyParentIds = strategyParentKeys.map((parentKey) => context.registry.nodeId(parentKey));
      const strategyCpd = makeGateFailureCpdGenerator({
        parentKeys: strategyParentKeys,
        gateMode: "or",
        allowExtraParents: truthy(getValueOr(item, "allow_extra_strategy_parents", false)),
      });
      context.model.addNode({
        key: strategyFailedKey,
        nodeId: strategyFailedNodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "strategy_failed",
          strategy_id: strategyId,
          strategy_mode: strategyMode,
          component_group: strategyGroup,
          true_means: "strategy_failed",
        },
        parentIds: strategyParentIds,
        cpdGenerator: strategyCpd,
      });
      context.registry.register(strategyFailedKey, strategyFailedNodeId);
      strategyFailedKeyById.set(strategyId, strategyFailedKey);
    }

    for (const item of this.goalItems()) {
      const goalId = FlexBuilder.requireText(getValue(item, "goal_id"), "goals[].goal_id");
      const key = nonEmptyOr(strippedText(item, "key"), this.goalFailedKey(goalId));
      const nodeId = nonEmptyOr(strippedText(item, "node_id"), this.defaultGoalFailedNodeId(goalId));
      const strategyFailedKeys = this.resolveGoalStrategyFailedKeys(item, goalId, strategyFailedKeyById);
      const gateMode = strip(text(getValueOr(item, "gate_mode", "all_strategies_fail"))).toLowerCase();
      if (gateMode !== "all_strategies_fail" && gateMode !== "any_strategy_fail") {
        throw valueError(`flex.goals[${goalId}].gate_mode must be 'all_strategies_fail' or 'any_strategy_fail'.`);
      }

      const parentIds: string[] = [];
      for (const strategyFailedKey of strategyFailedKeys) {
        if (!context.registry.hasKey(strategyFailedKey)) {
          throw valueError(`flex.goals[${goalId}] references unknown strategy failed key '${strategyFailedKey}'.`);
        }
        parentIds.push(context.registry.nodeId(strategyFailedKey));
      }

      let cpdGenerator: CpdGenerator;
      if (parentIds.length > 0) {
        cpdGenerator = makeGateFailureCpdGenerator({
          parentKeys: strategyFailedKeys,
          gateMode: gateMode === "all_strategies_fail" ? "and" : "or",
          allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
        });
      } else {
        const baselineFailProb = FlexBuilder.requireProbability(
          getValueOr(item, "baseline_fail_prob", 1),
          `goals[${goalId}].baseline_fail_prob`,
        );
        const allowExtraGoalParents = truthy(getValueOr(item, "allow_extra_parents", false));
        cpdGenerator = (localContext: ModelContext, node: NodeRecord): number[] => {
          if (!allowExtraGoalParents && node.parents.length > 0) {
            throw valueError(
              `Node '${node.nodeId}' has unexpected parents ${repr(node.parents)}. ` +
                "Set allow_extra_parents=true to permit this.",
            );
          }
          const rows = localContext.model.parentConfigurationCount(node.nodeId);
          return repeat([1 - baselineFailProb, baselineFailProb], rows);
        };
      }

      context.model.addNode({
        key,
        nodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "goal_failed",
          goal_id: goalId,
          true_means: "goal_failed",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, nodeId);
    }
  }

  private resolveHazardFailureCfg(item: SpecMapping, itemLabel: string, itemRole: string): HazardFailureConfig {
    const includePga = truthy(getValueOr(item, "include_pga_parent", false));
    const pgaFragility = this.resolveOptionalFragility(getValue(item, "pga_fragility"), `${itemLabel}.pga_fragility`);
    const pgaFailGivenState = this.resolveOptionalProbMapping(
      getValue(item, "pga_fail_given_state"),
      `${itemLabel}.pga_fail_given_state`,
    );
    const usesPga = includePga || pgaFragility !== null || pgaFailGivenState !== null;
    if (includePga && pgaFragility === null && pgaFailGivenState === null) {
      throw valueError(
        `flex.${itemLabel} has include_pga_parent=true but no pga_fragility ` + "or pga_fail_given_state was provided.",
      );
    }

    const floodParentKey = this.resolveFloodParentKey(item, itemLabel, itemRole);
    const floodFragility = this.resolveOptionalFragility(
      getValue(item, "flood_fragility"),
      `${itemLabel}.flood_fragility`,
    );
    const floodFailGivenState = this.resolveOptionalProbMapping(
      getValue(item, "flood_fail_given_state"),
      `${itemLabel}.flood_fail_given_state`,
    );
    const floodStateValues = this.resolveOptionalValueMapping(
      getValue(item, "flood_state_values"),
      `${itemLabel}.flood_state_values`,
    );
    const hasFloodModel = floodFragility !== null || floodFailGivenState !== null;
    if (hasFloodModel && floodParentKey === null) {
      throw valueError(
        `flex.${itemLabel} defines flood_fragility/flood_fail_given_state but no flood parent ` +
          "could be resolved. Provide one of: flood_parent_key, location_kind+location_ref, " +
          "flood_area_id, flood_building_id.",
      );
    }
    if (floodParentKey !== null && !hasFloodModel) {
      throw valueError(
        `flex.${itemLabel} has flood parent '${floodParentKey}' but no flood_fragility ` +
          "or flood_fail_given_state was provided.",
      );
    }

    const combineMode = strip(
      text(getValueOr(item, "combine_mode", getValueOr(this.config, "combine_mode_default", "noisy_or_independent"))),
    ).toLowerCase();
    if (!COMBINE_MODES.includes(combineMode)) {
      throw valueError(`flex.${itemLabel}.combine_mode must be one of: noisy_or_independent, max, additive_clipped.`);
    }

    const baselineFailProb = FlexBuilder.requireProbability(
      getValueOr(item, "baseline_fail_prob", getValueOr(item, "baseline_unavailable_prob", 0)),
      `${itemLabel}.baseline_fail_prob`,
    );
    const probFloor = FlexBuilder.requireProbability(getValueOr(item, "prob_floor", 0), `${itemLabel}.prob_floor`);
    const probCap = FlexBuilder.requireProbability(getValueOr(item, "prob_cap", 1), `${itemLabel}.prob_cap`);
    if (probFloor > probCap) throw valueError(`flex.${itemLabel} requires prob_floor <= prob_cap.`);

    return {
      usesPga,
      pgaFragility,
      pgaFailGivenState,
      floodParentKey,
      floodNoneLabel: nonEmptyOr(
        strip(text(getValueOr(item, "flood_none_state_label", this.floodNoneStateLabel()))),
        this.floodNoneStateLabel(),
      ),
      floodFragility,
      floodFailGivenState,
      floodStateValues,
      baselineFailProb,
      combineMode,
      probFloor,
      probCap,
      allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
    };
  }

  private buildIdheasPhase1Nodes(context: ModelContext): Map<string, IntegrationRule[]> {
    if (!this.idheasEnabled()) return new Map<string, IntegrationRule[]>();

    const cfg = this.idheasCfg();
    const datasetPathRaw = getValue(cfg, "dataset_path");
    const datasetPath =
      datasetPathRaw !== null ? FlexBuilder.requireText(datasetPathRaw, "idheas_eca.dataset_path") : null;
    const dataset = loadAndValidatePhase0Dataset(datasetPath);

    const defaultPolicy = strip(text(getValueOr(cfg, "aggregation_policy", "subject_value"))).toLowerCase();
    if (!AGGREGATION_POLICIES.includes(defaultPolicy)) {
      throw valueError("flex.idheas_eca.aggregation_policy must be one of: subject_value, mean, median, p95.");
    }
    const defaultSubjectText = strippedText(cfg, "subject_id");
    const defaultSubjectId = defaultSubjectText.length > 0 ? defaultSubjectText : null;
    const allowSubjectSelector = truthy(getValueOr(cfg, "allow_subject_row_selector", false));

    const contextKeyById = new Map<string, string>();
    for (const item of this.idheasContextItems()) {
      const contextId = FlexBuilder.requireText(getValue(item, "context_id"), "idheas_eca.contexts[].context_id");
      if (contextKeyById.has(contextId)) {
        throw valueError(`Duplicate idheas_eca.contexts[].context_id '${contextId}'.`);
      }
      const key = nonEmptyOr(strippedText(item, "key"), this.defaultIdheasContextKey(contextId));
      const nodeId = nonEmptyOr(strippedText(item, "node_id"), this.defaultIdheasContextNodeId(contextId));
      const states = this.resolveTextList(getValue(item, "states"), `idheas_eca.contexts[${contextId}].states`, true);
      if (new Set(states).size !== states.length) {
        throw valueError(`flex.idheas_eca.contexts[${contextId}].states contains duplicates.`);
      }
      const attributeCodes = this.resolveTextList(
        getValue(item, "attribute_codes"),
        `idheas_eca.contexts[${contextId}].attribute_codes`,
        true,
      );
      const parentKeys = this.resolveTextList(
        getValue(item, "parent_keys"),
        `idheas_eca.contexts[${contextId}].parent_keys`,
        true,
      );
      const parentIds: string[] = [];
      const parentStatesByKey = new Map<string, string[]>();
      for (const parentKey of parentKeys) {
        if (!context.registry.hasKey(parentKey)) {
          throw valueError(`flex.idheas_eca.contexts[${contextId}] references unknown parent key '${parentKey}'.`);
        }
        const parentId = context.registry.nodeId(parentKey);
        parentIds.push(parentId);
        parentStatesByKey.set(parentKey, context.model.node(parentId).states);
      }

      const rawRows = getValue(item, "rows");
      const rawMultiplier = getValue(item, "hazard_multiplier");
      if (rawRows !== null && rawMultiplier !== null) {
        throw valueError(
          `flex.idheas_eca.contexts[${contextId}] must define exactly one of rows or hazard_multiplier.`,
        );
      }
      if (rawRows === null && rawMultiplier === null) {
        throw valueError(`flex.idheas_eca.contexts[${contextId}] must define rows or hazard_multiplier.`);
      }

      let cpdGenerator: CpdGenerator;
      let contextModel: string;
      if (rawRows !== null) {
        const comboToProbs = this.resolveIdheasContextComboToProbsFromRows(
          contextId,
          states,
          parentKeys,
          parentStatesByKey,
          rawRows,
        );
        cpdGenerator = makeIdheasContextCpdGenerator({
          parentKeys,
          comboToProbs,
          allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
        });
        contextModel = "explicit_rows";
      } else {
        let pgaStateValues: Map<string, number> | null = null;
        if (parentKeys.includes(this.pgaKey())) {
          const pgaStates = parentStatesByKey.get(this.pgaKey()) ?? [];
          pgaStateValues = this.resolvePgaStateValues(context, pgaStates, this.pgaNoneStateLabel());
        }
        const multiplierCfg = this.resolveIdheasContextHazardMultiplierCfg(
          contextId,
          states,
          parentKeys,
          parentStatesByKey,
          rawMultiplier,
          pgaStateValues,
        );
        cpdGenerator = makeIdheasContextHazardMultiplierCpdGenerator({
          parentKeys,
          baselineProbs: multiplierCfg.baselineProbs,
          degradedProbs: multiplierCfg.degradedProbs,
          severeProbs: multiplierCfg.severeProbs,
          combineMode: multiplierCfg.combineMode,
          probFloor: multiplierCfg.probFloor,
          probCap: multiplierCfg.probCap,
          stateFailByParent: multiplierCfg.stateFailByParent,
          weightByParent: multiplierCfg.weightByParent,
          allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
        });
        contextModel = "hazard_multiplier";
      }
      context.model.addNode({
        key,
        nodeId,
        states,
        metadata: {
          builder: "flex",
          kind: "flex_idheas_context",
          context_id: contextId,
          component_group: FlexBuilder.resolveComponentGroup(item, [contextId]),
          attribute_codes: Array.from(attributeCodes),
          context_model: contextModel,
          true_means: "",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, nodeId);
      contextKeyById.set(contextId, key);
    }

    const strategyGroupById = new Map<string, string>();
    for (const strategyItem of this.strategyItems()) {
      const strategyId = FlexBuilder.requireText(getValue(strategyItem, "strategy_id"), "strategies[].strategy_id");
      if (strategyGroupById.has(strategyId)) {
        throw valueError(`Duplicate strategy_id '${strategyId}' in flex.strategies.`);
      }
      strategyGroupById.set(
        strategyId,
        FlexBuilder.resolveComponentGroup(strategyItem, [
          strategyId,
          text(getValueOr(strategyItem, "equipment_id", "")),
          text(getValueOr(strategyItem, "access_id", "")),
          text(getValueOr(strategyItem, "hookup_id", "")),
        ]),
      );
    }
    const strategyIdsAvailable = Array.from(strategyGroupById.keys());

    const integrationsByStrategy = new Map<string, IntegrationRule[]>();
    for (const item of this.idheasHfeItems()) {
      const hfeId = FlexBuilder.requireText(getValue(item, "hfe_id"), "idheas_eca.hfe_nodes[].hfe_id");
      const key = nonEmptyOr(strippedText(item, "key"), this.defaultIdheasHfeKey(hfeId));
      const nodeId = nonEmptyOr(strippedText(item, "node_id"), this.defaultIdheasHfeNodeId(hfeId));
      const tableKey = FlexBuilder.requireText(getValue(item, "table_key"), `idheas_eca.hfe_nodes[${hfeId}].table_key`);
      const table = getTable(dataset, tableKey);
      const tableRows = getTableRows(dataset, tableKey);
      const rowsById = new Map<string, SpecMapping>();
      const rowsBySubject = new Map<string, SpecMapping>();
      for (const row of tableRows) {
        rowsById.set(text(getValueOr(row, "row_id", "")), row);
        rowsBySubject.set(text(getValueOr(row, "subject_id", "")), row);
      }
      const parentKeys = this.resolveIdheasHfeParentKeys(item, hfeId, contextKeyById);

      const parentIds: string[] = [];
      const parentStatesByKey = new Map<string, string[]>();
      for (const parentKey of parentKeys) {
        if (!context.registry.hasKey(parentKey)) {
          throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}] references unknown parent key '${parentKey}'.`);
        }
        const parentId = context.registry.nodeId(parentKey);
        parentIds.push(parentId);
        parentStatesByKey.set(parentKey, context.model.node(parentId).states);
      }
      const parentStates = parentKeys.map((parentKey) => parentStatesByKey.get(parentKey) ?? []);

      const policy = strip(text(getValueOr(item, "aggregation_policy", defaultPolicy))).toLowerCase();
      if (!AGGREGATION_POLICIES.includes(policy)) {
        throw valueError(
          `flex.idheas_eca.hfe_nodes[${hfeId}].aggregation_policy must be one of ` +
            "subject_value, mean, median, p95.",
        );
      }
      const subjectText = strip(text(getValueOr(item, "subject_id", defaultSubjectId ?? "")));
      const subjectId = subjectText.length > 0 ? subjectText : null;

      const rawSelector = getValue(item, "row_selector");
      const comboToFail = new Map<string, number>();
      const selectedRows: SpecMapping[] = [];
      let cpdGenerator: CpdGenerator;
      if (rawSelector !== null) {
        if (parentKeys.length === 0) {
          throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}] row_selector requires non-empty parent_keys.`);
        }
        if (!isSequence(rawSelector) || rawSelector.length === 0) {
          throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}].row_selector must be non-empty list.`);
        }
        if (policy !== "subject_value") {
          throw valueError(
            `flex.idheas_eca.hfe_nodes[${hfeId}] row_selector can only be used with ` +
              "aggregation_policy='subject_value'.",
          );
        }
        rawSelector.forEach((selector, rowIndex) => {
          if (!isMapping(selector)) {
            throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}].row_selector[${rowIndex}] must be object.`);
          }
          const whenRaw = getValue(selector, "when");
          if (!isMapping(whenRaw)) {
            throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}].row_selector[${rowIndex}].when must be object.`);
          }
          const missingWhen = parentKeys.filter((parentKey) => !hasKey(whenRaw, parentKey));
          const extraWhen = keysOf(whenRaw).filter((whenKey) => !parentKeys.includes(whenKey));
          if (missingWhen.length > 0 || extraWhen.length > 0) {
            throw valueError(
              `flex.idheas_eca.hfe_nodes[${hfeId}].row_selector[${rowIndex}] when keys mismatch. ` +
                `missing=${repr(missingWhen)}, extra=${repr(extraWhen)}.`,
            );
          }
          const combo: string[] = [];
          parentKeys.forEach((parentKey, position) => {
            const state = strip(text(whenRaw[parentKey]));
            if (!parentStates[position].includes(state)) {
              throw valueError(
                `flex.idheas_eca.hfe_nodes[${hfeId}].row_selector[${rowIndex}] ` +
                  `uses unknown state '${state}' for parent '${parentKey}'.`,
              );
            }
            combo.push(state);
          });
          if (comboToFail.has(comboKey(combo))) {
            throw valueError(
              `Duplicate row_selector mapping in flex.idheas_eca.hfe_nodes[${hfeId}] for combo ${tupleRepr(combo)}.`,
            );
          }

          const selectorRowId = strippedText(selector, "row_id");
          const selectorSubjectId = strippedText(selector, "subject_id");
          if (selectorRowId.length > 0 === selectorSubjectId.length > 0) {
            throw valueError(
              `flex.idheas_eca.hfe_nodes[${hfeId}].row_selector[${rowIndex}] must provide exactly one ` +
                "of row_id or subject_id.",
            );
          }
          if (selectorSubjectId.length > 0 && !allowSubjectSelector) {
            throw valueError(
              `flex.idheas_eca.hfe_nodes[${hfeId}].row_selector[${rowIndex}] uses subject_id. ` +
                "Use row_id for hazard-conditioned row mapping, or set " +
                "flex.idheas_eca.allow_subject_row_selector=true to allow subject_id selectors.",
            );
          }
          let failProbability: number;
          if (selectorRowId.length > 0) {
            const selectedRow = rowsById.get(selectorRowId);
            if (selectedRow === undefined) {
              throw valueError(`Unknown row_id '${selectorRowId}' in table '${tableKey}'.`);
            }
            selectedRows.push(selectedRow);
            failProbability = getRowHep(dataset, tableKey, selectorRowId, null);
          } else {
            const selectedRow = rowsBySubject.get(selectorSubjectId);
            if (selectedRow === undefined) {
              throw valueError(`Unknown subject_id '${selectorSubjectId}' in table '${tableKey}'.`);
            }
            selectedRows.push(selectedRow);
            failProbability = getRowHep(dataset, tableKey, null, selectorSubjectId);
          }
          comboToFail.set(comboKey(combo), failProbability);
        });

        const dims = parentStates.map((states) => states.length);
        let totalRows = 1;
        for (const dim of dims) totalRows *= dim;
        for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
          const indices = decodeRowIndex(rowIndex, dims);
          const combo = parentStates.map((states, position) => states[indices[position]]);
          if (!comboToFail.has(comboKey(combo))) {
            throw valueError(
              `flex.idheas_eca.hfe_nodes[${hfeId}] missing row_selector mapping for combo ${tupleRepr(combo)}.`,
            );
          }
        }
        cpdGenerator = makeIdheasHfeSelectorCpdGenerator({
          parentKeys,
          comboToFail,
          allowExtraParents: truthy(getValueOr(item, "allow_extra_parents", false)),
        });
      } else {
        if (parentKeys.length > 0) {
          throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}] has parent_keys but no row_selector.`);
        }
        let failProbability: number;
        if (policy === "subject_value") {
          if (subjectId === null) {
            throw valueError(
              `flex.idheas_eca.hfe_nodes[${hfeId}] with aggregation_policy='subject_value' ` + "requires subject_id.",
            );
          }
          selectedRows.push(rowsBySubject.get(subjectId) ?? {});
          failProbability = aggregateTableHep(dataset, tableKey, "subject_value", subjectId);
        } else {
          failProbability = aggregateTableHep(dataset, tableKey, policy, null);
        }
        cpdGenerator = makeConstantFailureCpdGenerator(
          failProbability,
          truthy(getValueOr(item, "allow_extra_parents", false)),
        );
      }

      const selectedRowsClean = selectedRows.filter((row) => keysOf(row).length > 0);
      const rowIds = sortedText(
        new Set(selectedRowsClean.map((row) => strippedText(row, "row_id")).filter((value) => value.length > 0)),
      );
      const subjectIds = sortedText(
        new Set(selectedRowsClean.map((row) => strippedText(row, "subject_id")).filter((value) => value.length > 0)),
      );
      const cfms = FlexBuilder.collectRowTokens(selectedRowsClean, "cfms");
      const attributeCodes = FlexBuilder.collectRowTokens(selectedRowsClean, "attribute_codes");

      context.model.addNode({
        key,
        nodeId,
        states: BOOL_STATES,
        metadata: {
          builder: "flex",
          kind: "flex_idheas_hfe_failed",
          hfe_id: hfeId,
          component_group: FlexBuilder.resolveComponentGroup(item, [hfeId]),
          table_key: tableKey,
          table_id: text(getValueOr(table, "table_id", "")),
          variant_id: text(getValueOr(table, "case_id", getValueOr(table, "critical_task_id", ""))),
          aggregation_policy: policy,
          subject_id: subjectId ?? "",
          row_ids: rowIds,
          selected_subject_ids: subjectIds,
          cfms,
          attribute_codes: attributeCodes,
          true_means: "hfe_failed",
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, nodeId);

      const rules = this.resolveIdheasHfeIntegrations(item, hfeId, key, strategyIdsAvailable, strategyGroupById);
      for (const rule of rules) {
        const existing = integrationsByStrategy.get(rule.strategyId);
        if (existing === undefined) integrationsByStrategy.set(rule.strategyId, [rule]);
        else existing.push(rule);
      }
    }

    return integrationsByStrategy;
  }

  private static collectRowTokens(rows: readonly SpecMapping[], field: string): string[] {
    const tokens = new Set<string>();
    for (const row of rows) {
      const raw = getValue(row, field);
      if (!truthy(raw)) continue;
      for (const token of iterValues(raw)) {
        if (strip(text(token)).length > 0) tokens.add(text(token));
      }
    }
    return sortedText(tokens);
  }

  private resolveIdheasContextComboToProbsFromRows(
    contextId: string,
    states: readonly string[],
    parentKeys: readonly string[],
    parentStatesByKey: ReadonlyMap<string, string[]>,
    rawRows: SpecValue,
  ): Map<string, number[]> {
    if (!isSequence(rawRows) || rawRows.length === 0) {
      throw valueError(`flex.idheas_eca.contexts[${contextId}].rows must be non-empty list.`);
    }
    const parentStates = parentKeys.map((parentKey) => parentStatesByKey.get(parentKey) ?? []);
    const comboToProbs = new Map<string, number[]>();
    rawRows.forEach((row, rowIndex) => {
      if (!isMapping(row)) {
        throw valueError(`flex.idheas_eca.contexts[${contextId}].rows[${rowIndex}] must be object.`);
      }
      const whenRaw = getValue(row, "when");
      if (!isMapping(whenRaw)) {
        throw valueError(`flex.idheas_eca.contexts[${contextId}].rows[${rowIndex}].when must be object.`);
      }
      const missingWhen = parentKeys.filter((parentKey) => !hasKey(whenRaw, parentKey));
      const extraWhen = keysOf(whenRaw).filter((whenKey) => !parentKeys.includes(whenKey));
      if (missingWhen.length > 0 || extraWhen.length > 0) {
        throw valueError(
          `flex.idheas_eca.contexts[${contextId}].rows[${rowIndex}] 'when' keys mismatch. ` +
            `missing=${repr(missingWhen)}, extra=${repr(extraWhen)}.`,
        );
      }
      const combo: string[] = [];
      parentKeys.forEach((parentKey, position) => {
        const state = strip(text(whenRaw[parentKey]));
        if (!parentStates[position].includes(state)) {
          throw valueError(
            `flex.idheas_eca.contexts[${contextId}].rows[${rowIndex}] ` +
              `uses unknown state '${state}' for parent '${parentKey}'.`,
          );
        }
        combo.push(state);
      });
      if (comboToProbs.has(comboKey(combo))) {
        throw valueError(`Duplicate row mapping for flex.idheas_eca.contexts[${contextId}] combo=${tupleRepr(combo)}.`);
      }

      if (hasKey(row, "state")) {
        const targetState = strippedText(row, "state");
        if (!states.includes(targetState)) {
          throw valueError(
            `flex.idheas_eca.contexts[${contextId}].rows[${rowIndex}].state ` + `must be one of ${tupleRepr(states)}.`,
          );
        }
        const probs = new Array<number>(states.length).fill(0);
        probs[states.indexOf(targetState)] = 1;
        comboToProbs.set(comboKey(combo), probs);
      } else {
        const probs = this.resolveProbVector(
          getValue(row, "probs"),
          `idheas_eca.contexts[${contextId}].rows[${rowIndex}].probs`,
          states.length,
        );
        comboToProbs.set(comboKey(combo), probs);
      }
    });

    const dims = parentStates.map((candidates) => candidates.length);
    let totalRows = 1;
    for (const dim of dims) totalRows *= dim;
    for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const combo = parentStates.map((candidates, position) => candidates[indices[position]]);
      if (!comboToProbs.has(comboKey(combo))) {
        throw valueError(
          `flex.idheas_eca.contexts[${contextId}] missing mapping for parent combo ${tupleRepr(combo)}.`,
        );
      }
    }
    return comboToProbs;
  }

  private resolveIdheasContextHazardMultiplierCfg(
    contextId: string,
    states: readonly string[],
    parentKeys: readonly string[],
    parentStatesByKey: ReadonlyMap<string, string[]>,
    rawMultiplier: SpecValue,
    pgaStateValues: ReadonlyMap<string, number> | null,
  ): HazardMultiplierConfig {
    if (!isMapping(rawMultiplier)) {
      throw valueError(`flex.idheas_eca.contexts[${contextId}].hazard_multiplier must be object/mapping.`);
    }

    const baselineProbs = this.resolveProbVector(
      getValue(rawMultiplier, "baseline_probs"),
      `idheas_eca.contexts[${contextId}].hazard_multiplier.baseline_probs`,
      states.length,
    );
    const severeProbs = this.resolveProbVector(
      getValue(rawMultiplier, "severe_probs"),
      `idheas_eca.contexts[${contextId}].hazard_multiplier.severe_probs`,
      states.length,
    );
    const degradedProbsRaw = getValue(rawMultiplier, "degraded_probs");
    let degradedProbs: number[] | null = null;
    if (degradedProbsRaw !== null) {
      degradedProbs = this.resolveProbVector(
        degradedProbsRaw,
        `idheas_eca.contexts[${contextId}].hazard_multiplier.degraded_probs`,
        states.length,
      );
    }

    const combineMode = strip(
      text(
        getValueOr(
          rawMultiplier,
          "combine_mode",
          getValueOr(this.config, "combine_mode_default", "noisy_or_independent"),
        ),
      ),
    ).toLowerCase();
    if (!COMBINE_MODES.includes(combineMode)) {
      throw valueError(
        `flex.idheas_eca.contexts[${contextId}].hazard_multiplier.combine_mode must be one of: ` +
          "noisy_or_independent, max, additive_clipped.",
      );
    }
    const probFloor = FlexBuilder.requireProbability(
      getValueOr(rawMultiplier, "prob_floor", 0),
      `idheas_eca.contexts[${contextId}].hazard_multiplier.prob_floor`,
    );
    const probCap = FlexBuilder.requireProbability(
      getValueOr(rawMultiplier, "prob_cap", 1),
      `idheas_eca.contexts[${contextId}].hazard_multiplier.prob_cap`,
    );
    if (probFloor > probCap) {
      throw valueError(`flex.idheas_eca.contexts[${contextId}].hazard_multiplier requires prob_floor <= prob_cap.`);
    }

    const rawParentModels = getValue(rawMultiplier, "parent_models");
    const parentModelEntries: SpecMapping[] = [];
    if (isMapping(rawParentModels)) {
      for (const parentKey of keysOf(rawParentModels)) {
        const modelRaw = rawParentModels[parentKey];
        if (!isMapping(modelRaw)) {
          throw valueError(
            `flex.idheas_eca.contexts[${contextId}].hazard_multiplier.parent_models[${parentKey}] ` +
              "must be object/mapping.",
          );
        }
        const entry: SpecMapping = { ...modelRaw };
        if (!hasKey(entry, "parent_key")) entry.parent_key = parentKey;
        parentModelEntries.push(entry);
      }
    } else if (isSequence(rawParentModels)) {
      rawParentModels.forEach((modelRaw, index) => {
        if (!isMapping(modelRaw)) {
          throw valueError(
            `flex.idheas_eca.contexts[${contextId}].hazard_multiplier.parent_models[${index}] ` +
              "must be object/mapping.",
          );
        }
        parentModelEntries.push(modelRaw);
      });
    } else {
      throw valueError(
        `flex.idheas_eca.contexts[${contextId}].hazard_multiplier.parent_models must be list or mapping.`,
      );
    }
    if (parentModelEntries.length === 0) {
      throw valueError(`flex.idheas_eca.contexts[${contextId}].hazard_multiplier.parent_models must be non-empty.`);
    }

    const stateFailByParent = new Map<string, Map<string, number>>();
    const weightByParent = new Map<string, number>();
    const pgaKey = this.pgaKey();
    const pgaNoneLabel = this.pgaNoneStateLabel();
    const defaultFloodNone = this.floodNoneStateLabel();
    parentModelEntries.forEach((model, index) => {
      const modelLabel = `idheas_eca.contexts[${contextId}].hazard_multiplier.parent_models[${index}]`;
      const parentKey = FlexBuilder.requireText(getValue(model, "parent_key"), `${modelLabel}.parent_key`);
      if (!parentKeys.includes(parentKey)) {
        throw valueError(
          `flex.${modelLabel}.parent_key '${parentKey}' is not in context parent_keys ${tupleRepr(parentKeys)}.`,
        );
      }
      if (stateFailByParent.has(parentKey)) {
        throw valueError(`Duplicate hazard multiplier parent model for key '${parentKey}' in context '${contextId}'.`);
      }

      const weight = FlexBuilder.requireFloat(getValueOr(model, "weight", 1), `${modelLabel}.weight`);
      if (weight < 0) throw valueError(`flex.${modelLabel}.weight must be >= 0.`);
      weightByParent.set(parentKey, weight);

      const defaultNone = parentKey === pgaKey ? pgaNoneLabel : defaultFloodNone;
      const noneStateLabel = nonEmptyOr(strip(text(getValueOr(model, "none_state_label", defaultNone))), defaultNone);

      const failGivenState = this.resolveOptionalProbMapping(
        getValue(model, "fail_given_state"),
        `${modelLabel}.fail_given_state`,
      );
      const fragility = this.resolveOptionalFragility(getValue(model, "fragility"), `${modelLabel}.fragility`);
      if ((failGivenState === null) === (fragility === null)) {
        throw valueError(`flex.${modelLabel} must provide exactly one of fail_given_state or fragility.`);
      }

      const stateFail = new Map<string, number>();
      const parentStates = parentStatesByKey.get(parentKey) ?? [];
      if (failGivenState !== null) {
        for (const state of parentStates) {
          const given = failGivenState.get(state);
          if (given !== undefined) {
            stateFail.set(state, clamp01(given));
          } else if (state === noneStateLabel) {
            stateFail.set(state, 0);
          } else {
            throw valueError(`flex.${modelLabel}.fail_given_state missing state '${state}'.`);
          }
        }
      } else if (fragility !== null) {
        const stateValues = this.resolveOptionalValueMapping(
          getValue(model, "state_values"),
          `${modelLabel}.state_values`,
        );
        for (const state of parentStates) {
          if (state === noneStateLabel) {
            stateFail.set(state, 0);
            continue;
          }
          let imValue: number;
          if (stateValues !== null) {
            const stateValue = stateValues.get(state);
            if (stateValue === undefined) {
              throw valueError(`flex.${modelLabel}.state_values missing state '${state}'.`);
            }
            imValue = stateValue;
          } else if (parentKey === pgaKey && pgaStateValues !== null) {
            const pgaValue = pgaStateValues.get(state);
            if (pgaValue === undefined) {
              throw valueError(
                `flex.${modelLabel} missing PGA center for state '${state}'. ` + "Provide state_values to override.",
              );
            }
            imValue = pgaValue;
          } else {
            imValue = resolveFloodStateNumericValue(state, stateValues);
          }
          stateFail.set(state, fragilityProbability(imValue, fragility.theta, fragility.beta));
        }
      }
      stateFailByParent.set(parentKey, stateFail);
    });

    const missingParentModels = parentKeys.filter((parentKey) => !stateFailByParent.has(parentKey));
    if (missingParentModels.length > 0) {
      throw valueError(
        `flex.idheas_eca.contexts[${contextId}].hazard_multiplier.parent_models missing parents ` +
          `${repr(missingParentModels)}.`,
      );
    }

    return {
      baselineProbs,
      degradedProbs,
      severeProbs,
      combineMode,
      probFloor,
      probCap,
      stateFailByParent,
      weightByParent,
    };
  }

  private resolveIdheasHfeParentKeys(
    item: SpecMapping,
    hfeId: string,
    contextKeyById: ReadonlyMap<string, string> | null,
  ): string[] {
    const output: string[] = [];
    for (const key of this.resolveTextList(
      getValue(item, "parent_keys"),
      `idheas_eca.hfe_nodes[${hfeId}].parent_keys`,
      false,
    )) {
      output.push(key);
    }
    for (const contextId of this.resolveTextList(
      getValue(item, "context_ids"),
      `idheas_eca.hfe_nodes[${hfeId}].context_ids`,
      false,
    )) {
      const contextKey = contextKeyById !== null ? contextKeyById.get(contextId) : undefined;
      output.push(contextKey !== undefined ? contextKey : this.defaultIdheasContextKey(contextId));
    }
    return uniqueInOrder(output);
  }

  private resolveIdheasHfeIntegrations(
    item: SpecMapping,
    hfeId: string,
    hfeKey: string,
    strategyIdsAvailable: readonly string[],
    strategyGroupById: ReadonlyMap<string, string>,
  ): IntegrationRule[] {
    const raw = getValueOr(item, "integrations", getValue(item, "integration"));
    if (raw !== null) {
      let entries: SpecValue[];
      if (isMapping(raw)) entries = [raw];
      else if (isSequence(raw)) entries = Array.from(raw);
      else throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}].integrations must be object or list.`);
      const output: IntegrationRule[] = [];
      entries.forEach((entry, index) => {
        if (!isMapping(entry)) {
          throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}].integrations[${index}] must be object.`);
        }
        const strategyId = FlexBuilder.requireText(
          getValue(entry, "strategy_id"),
          `idheas_eca.hfe_nodes[${hfeId}].integrations[${index}].strategy_id`,
        );
        const targetStep = strippedText(entry, "target_step").toLowerCase();
        if (!STEP_TARGETS.includes(targetStep) && targetStep !== "strategy_failed") {
          throw valueError(
            `flex.idheas_eca.hfe_nodes[${hfeId}].integrations[${index}].target_step must be one of ` +
              "retrieve_failed, transport_failed, connect_failed, start_run_failed, " +
              "connect_start_bundle, all_steps, strategy_failed.",
          );
        }
        let mode = strippedText(entry, "mode").toLowerCase();
        if (mode.length === 0) mode = STEP_TARGETS.includes(targetStep) ? "replace" : "overlay";
        if (mode !== "replace" && mode !== "overlay") {
          throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}].integrations[${index}].mode must be replace|overlay.`);
        }
        output.push({ hfeId, hfeKey, strategyId, targetStep, mode });
      });
      return output;
    }

    const role = strippedText(item, "role").toLowerCase();
    if (role.length === 0) return [];
    if (!hasKey(ROLE_TO_TARGET, role)) {
      throw valueError(
        `flex.idheas_eca.hfe_nodes[${hfeId}].role='${role}' is unsupported. ` +
          "Supported roles: elap, elap_declare, transport, connect_start, strategy.",
      );
    }

    const targetStep = ROLE_TO_TARGET[role];
    let mode = strippedText(item, "mode").toLowerCase();
    if (mode.length === 0) {
      mode = targetStep === "all_steps" || targetStep === "strategy_failed" ? "overlay" : "replace";
    }
    if (mode !== "replace" && mode !== "overlay") {
      throw valueError(`flex.idheas_eca.hfe_nodes[${hfeId}].mode must be replace|overlay.`);
    }

    const strategyIds: string[] = [];
    const rawStrategyId = getValue(item, "strategy_id");
    if (rawStrategyId !== null) {
      strategyIds.push(FlexBuilder.requireText(rawStrategyId, `idheas_eca.hfe_nodes[${hfeId}].strategy_id`));
    }
    for (const strategyId of this.resolveTextList(
      getValue(item, "strategy_ids"),
      `idheas_eca.hfe_nodes[${hfeId}].strategy_ids`,
      false,
    )) {
      strategyIds.push(strategyId);
    }
    if (
      truthy(getValueOr(item, "apply_to_all_strategies", false)) ||
      truthy(getValueOr(item, "all_strategies", false))
    ) {
      for (const strategyId of strategyIdsAvailable) strategyIds.push(strategyId);
    }

    if (strategyIds.length === 0) {
      const hfeComponentGroup = FlexBuilder.resolveComponentGroup(item, [hfeId]);
      if (hfeComponentGroup.length > 0) {
        for (const strategyId of strategyIdsAvailable) {
          if (strip(strategyGroupById.get(strategyId) ?? "").toLowerCase() === hfeComponentGroup) {
            strategyIds.push(strategyId);
          }
        }
      } else if (strategyIdsAvailable.length === 1) {
        for (const strategyId of strategyIdsAvailable) strategyIds.push(strategyId);
      }
    }

    const seen = new Set<string>();
    const uniqueStrategyIds: string[] = [];
    for (const strategyId of strategyIds) {
      if (seen.has(strategyId)) continue;
      if (!strategyGroupById.has(strategyId)) {
        throw valueError(
          `flex.idheas_eca.hfe_nodes[${hfeId}] resolved unknown strategy_id '${strategyId}'. ` +
            `Available: ${repr(sortedText(strategyGroupById.keys()))}.`,
        );
      }
      seen.add(strategyId);
      uniqueStrategyIds.push(strategyId);
    }

    if (uniqueStrategyIds.length === 0) {
      throw valueError(
        `flex.idheas_eca.hfe_nodes[${hfeId}] with role='${role}' could not resolve any target strategies. ` +
          "Provide strategy_id/strategy_ids, set apply_to_all_strategies=true, " +
          "or set component_group that matches at least one strategy.",
      );
    }

    return uniqueStrategyIds.map((strategyId) => ({ hfeId, hfeKey, strategyId, targetStep, mode }));
  }

  private applyIdheasStrategyIntegrations(
    strategyId: string,
    parentKeys: readonly string[],
    integrationRules: readonly IntegrationRule[],
  ): string[] {
    let output = Array.from(parentKeys);
    for (const rule of integrationRules) {
      const hfeKey = FlexBuilder.requireText(
        rule.hfeKey,
        `idheas_eca integration for strategy '${strategyId}' hfe_key`,
      );
      const targetStep = strip(rule.targetStep).toLowerCase();
      const mode = strip(rule.mode).toLowerCase();

      if (targetStep === "strategy_failed") {
        if (mode === "replace") output = [hfeKey];
        else output.push(hfeKey);
      } else if (STEP_TARGETS.includes(targetStep)) {
        continue;
      } else {
        throw valueError(`Unknown idheas_eca integration target_step '${targetStep}' for strategy '${strategyId}'.`);
      }
    }
    return uniqueInOrder(output);
  }

  private resolveIdheasStepHfeKeys(strategyId: string, integrationRules: readonly IntegrationRule[]): StepHfeKeys {
    const output: StepHfeKeys = {
      retrieveFailed: [],
      transportFailed: [],
      connectFailed: [],
      startRunFailed: [],
    };
    for (const rule of integrationRules) {
      const hfeKey = FlexBuilder.requireText(
        rule.hfeKey,
        `idheas_eca integration for strategy '${strategyId}' hfe_key`,
      );
      const targetStep = strip(rule.targetStep).toLowerCase();
      const mode = strip(rule.mode).toLowerCase();

      let targets: StepName[];
      if (targetStep === "retrieve_failed") targets = ["retrieveFailed"];
      else if (targetStep === "transport_failed") targets = ["transportFailed"];
      else if (targetStep === "connect_failed") targets = ["connectFailed"];
      else if (targetStep === "start_run_failed") targets = ["startRunFailed"];
      else if (targetStep === "connect_start_bundle") targets = ["connectFailed", "startRunFailed"];
      else if (targetStep === "all_steps") {
        targets = ["retrieveFailed", "transportFailed", "connectFailed", "startRunFailed"];
      } else continue;

      for (const target of targets) {
        if (mode === "replace") output[target] = [hfeKey];
        else if (!output[target].includes(hfeKey)) output[target].push(hfeKey);
      }
    }
    return output;
  }

  private resolvePgaStateValues(
    context: ModelContext,
    pgaStates: readonly string[],
    pgaNoneLabel: string,
  ): Map<string, number> {
    const statesRef = this.pgaStatesRef();
    let centers: number[];
    let refStates: string[];
    if (hasKey(this.config, "pga_bin_centers")) {
      const rawCenters = getValue(this.config, "pga_bin_centers");
      if (!isSequence(rawCenters)) throw valueError("flex.pga_bin_centers must be list-like when provided.");
      centers = rawCenters.map((center) => toFloat(center));
      refStates = pgaStates.filter((state) => state !== pgaNoneLabel);
    } else {
      if (!context.discretization.has(statesRef)) {
        throw valueError(
          `flex pga fragility requires either discretization '${statesRef}' or explicit flex.pga_bin_centers.`,
        );
      }
      if (!context.discretization.hasCenters(statesRef)) {
        throw valueError(`flex pga fragility requires centers for discretization '${statesRef}'.`);
      }
      refStates = context.discretization.states(statesRef);
      centers = context.discretization.centers(statesRef);
    }

    if (refStates.length !== centers.length) {
      throw valueError(`flex PGA state/center mismatch: ${refStates.length} states vs ${centers.length} centers.`);
    }
    if (centers.some((center) => center <= 0)) {
      throw valueError("flex PGA centers for non-none states must be > 0.");
    }

    const refMap = new Map<string, number>();
    refStates.forEach((state, index) => refMap.set(state, centers[index]));
    const output = new Map<string, number>();
    for (const pgaState of pgaStates) {
      if (pgaState === pgaNoneLabel) {
        output.set(pgaState, 0);
        continue;
      }
      const center = refMap.get(pgaState);
      if (center === undefined) {
        throw valueError(`flex could not map PGA state '${pgaState}' via discretization '${statesRef}'.`);
      }
      output.set(pgaState, center);
    }
    return output;
  }

  private resolveOptionalFragility(raw: SpecValue, label: string): Fragility | null {
    if (raw === null) return null;
    if (!isMapping(raw)) throw valueError(`flex.${label} must be an object/mapping.`);
    const theta = FlexBuilder.requirePositiveFloat(getValue(raw, "theta"), `${label}.theta`);
    const beta = FlexBuilder.requirePositiveFloat(getValue(raw, "beta"), `${label}.beta`);
    return { theta, beta };
  }

  private resolveOptionalProbMapping(raw: SpecValue, label: string): Map<string, number> | null {
    if (raw === null) return null;
    if (!isMapping(raw)) throw valueError(`flex.${label} must be mapping by state label.`);
    const output = new Map<string, number>();
    for (const key of keysOf(raw)) {
      output.set(key, FlexBuilder.requireProbability(raw[key], `${label}[${key}]`));
    }
    return output;
  }

  private resolveOptionalValueMapping(raw: SpecValue, label: string): Map<string, number> | null {
    if (raw === null) return null;
    if (isMapping(raw)) {
      const output = new Map<string, number>();
      for (const key of keysOf(raw)) output.set(key, toFloat(raw[key]));
      return output;
    }
    throw valueError(`flex.${label} must be mapping by state label when provided.`);
  }

  private resolveProbVector(raw: SpecValue, label: string, expectedLength: number): number[] {
    if (!isSequence(raw)) throw valueError(`flex.${label} must be list-like.`);
    if (raw.length !== expectedLength) {
      throw valueError(`flex.${label} length ${raw.length} != expected ${expectedLength}.`);
    }
    const probs = raw.map((value, index) => FlexBuilder.requireProbability(value, `${label}[${index}]`));
    if (!isClose(floatSum(probs), 1, 0, 1e-12)) throw valueError(`flex.${label} must sum to 1.`);
    return probs;
  }

  private resolveStorageParentKey(
    item: SpecMapping,
    storageKeyById: ReadonlyMap<string, string> | null,
  ): string | null {
    const raw = getValue(item, "storage_key");
    if (raw !== null) {
      if (typeof raw !== "string") {
        throw valueError("flex.equipment[].storage_key must be a string when provided.");
      }
      const key = strip(raw);
      return key.length > 0 ? key : null;
    }
    const storageIdRaw = getValue(item, "storage_id");
    if (storageIdRaw === null) return null;
    const storageId = FlexBuilder.requireText(storageIdRaw, "equipment[].storage_id");
    const known = storageKeyById !== null ? storageKeyById.get(storageId) : undefined;
    if (known !== undefined) return known;
    return this.storageFailedKey(storageId);
  }

  private resolveFloodParentKey(item: SpecMapping, itemId: string, itemRole: string): string | null {
    const rawKey = getValue(item, "flood_parent_key");
    if (rawKey !== null) {
      if (typeof rawKey !== "string") throw valueError(`flex.${itemId}.flood_parent_key must be string.`);
      const key = strip(rawKey);
      return key.length > 0 ? key : null;
    }

    const locationKindRaw = getValue(item, "location_kind");
    const locationRefRaw = getValue(item, "location_ref");
    let locationKind: string | null = null;
    let locationRef: string | null = null;

    if (locationKindRaw !== null) {
      if (typeof locationKindRaw !== "string") {
        throw valueError(`flex.${itemId}.location_kind must be a string.`);
      }
      locationKind = strip(locationKindRaw).toLowerCase();
      if (locationKind !== "outdoor" && locationKind !== "indoor") {
        throw valueError(`flex.${itemId}.location_kind must be 'outdoor' or 'indoor'.`);
      }
    }

    if (locationRefRaw !== null) {
      locationRef = FlexBuilder.requireText(locationRefRaw, `${itemId}.location_ref`);
    }

    if (locationKind === null && locationRef !== null) locationKind = "outdoor";

    const rawArea = getValue(item, "flood_area_id");
    const rawBuilding = getValue(item, "flood_building_id");
    const areaId = rawArea !== null ? FlexBuilder.requireText(rawArea, `${itemId}.flood_area_id`) : null;
    const buildingId =
      rawBuilding !== null ? FlexBuilder.requireText(rawBuilding, `${itemId}.flood_building_id`) : null;

    if (locationKind !== null) {
      if (locationRef === null) {
        if (locationKind === "outdoor" && areaId !== null) locationRef = areaId;
        else if (locationKind === "indoor" && buildingId !== null) locationRef = buildingId;
        else throw valueError(`flex.${itemId}.location_kind is set but location_ref is missing.`);
      }
      if (locationKind === "outdoor") return `flood.site.depth_at.${locationRef}`;
      return `flood.interior.depth.${locationRef}`;
    }

    if (itemRole === "storage" && buildingId !== null) {
      throw valueError(
        `flex.${itemId} uses flood_building_id but storage is not allowed to bind ` +
          "to interior flood unless location_kind='indoor' is explicit.",
      );
    }

    if (areaId !== null) return `flood.site.depth_at.${areaId}`;

    if (buildingId !== null) return `flood.interior.depth.${buildingId}`;

    return null;
  }

  private resolveStrategyEquipmentKey(
    item: SpecMapping,
    strategyId: string,
    equipmentKeyById: ReadonlyMap<string, string> | null,
  ): string | null {
    const raw = getValue(item, "equipment_key");
    if (raw !== null) {
      if (typeof raw !== "string") {
        throw valueError(`flex.strategies[${strategyId}].equipment_key must be string.`);
      }
      const key = strip(raw);
      return key.length > 0 ? key : null;
    }
    const equipmentIdRaw = getValue(item, "equipment_id");
    if (equipmentIdRaw === null) return null;
    const equipmentId = FlexBuilder.requireText(equipmentIdRaw, `strategies[${strategyId}].equipment_id`);
    const known = equipmentKeyById !== null ? equipmentKeyById.get(equipmentId) : undefined;
    if (known !== undefined) return known;
    return this.equipmentUnavailableKey(equipmentId);
  }

  private resolveStrategyAccessKey(
    item: SpecMapping,
    strategyId: string,
    accessKeyById: ReadonlyMap<string, string> | null,
  ): string | null {
    const raw = getValue(item, "access_key");
    if (raw !== null) {
      if (typeof raw !== "string") throw valueError(`flex.strategies[${strategyId}].access_key must be string.`);
      const key = strip(raw);
      return key.length > 0 ? key : null;
    }
    const accessIdRaw = getValue(item, "access_id");
    if (accessIdRaw === null) return null;
    const accessId = FlexBuilder.requireText(accessIdRaw, `strategies[${strategyId}].access_id`);
    const known = accessKeyById !== null ? accessKeyById.get(accessId) : undefined;
    if (known !== undefined) return known;
    return this.accessFailedKey(accessId);
  }

  private resolveStrategyHookupKey(
    item: SpecMapping,
    strategyId: string,
    hookupKeyById: ReadonlyMap<string, string> | null,
  ): string | null {
    const raw = getValue(item, "hookup_key");
    if (raw !== null) {
      if (typeof raw !== "string") throw valueError(`flex.strategies[${strategyId}].hookup_key must be string.`);
      const key = strip(raw);
      return key.length > 0 ? key : null;
    }
    const hookupIdRaw = getValue(item, "hookup_id");
    if (hookupIdRaw === null) return null;
    const hookupId = FlexBuilder.requireText(hookupIdRaw, `strategies[${strategyId}].hookup_id`);
    const known = hookupKeyById !== null ? hookupKeyById.get(hookupId) : undefined;
    if (known !== undefined) return known;
    return this.hookupFailedKey(hookupId);
  }

  private resolveGoalStrategyFailedKeys(
    item: SpecMapping,
    goalId: string,
    strategyFailedKeyById: ReadonlyMap<string, string> | null,
  ): string[] {
    const output: string[] = [];
    const rawKeys = getValue(item, "strategy_failed_keys");
    const rawIds = getValue(item, "strategy_ids");

    if (rawKeys !== null) {
      if (!isSequence(rawKeys)) throw valueError(`flex.goals[${goalId}].strategy_failed_keys must be list-like.`);
      for (const key of rawKeys) {
        output.push(FlexBuilder.requireText(key, `goals[${goalId}].strategy_failed_keys[]`));
      }
    }

    if (rawIds !== null) {
      if (!isSequence(rawIds)) throw valueError(`flex.goals[${goalId}].strategy_ids must be list-like.`);
      for (const rawId of rawIds) {
        const strategyId = FlexBuilder.requireText(rawId, `goals[${goalId}].strategy_ids[]`);
        const known = strategyFailedKeyById !== null ? strategyFailedKeyById.get(strategyId) : undefined;
        output.push(known !== undefined ? known : this.strategyFailedKey(strategyId));
      }
    }

    return uniqueInOrder(output);
  }

  private usesPga(item: SpecMapping): boolean {
    return (
      truthy(getValueOr(item, "include_pga_parent", false)) ||
      getValue(item, "pga_fragility") !== null ||
      getValue(item, "pga_fail_given_state") !== null
    );
  }

  private static resolveComponentGroup(item: SpecMapping, fallbackTokens: readonly string[]): string {
    const explicit = strippedText(item, "component_group").toLowerCase();
    if (explicit.length > 0) return explicit;
    const joined = fallbackTokens
      .filter((token) => strip(token).length > 0)
      .map((token) => strip(token).toLowerCase())
      .join(" ");
    if (joined.includes("pump")) return "pump";
    if (joined.includes("dg") || joined.includes("diesel") || joined.includes("generator")) return "dg";
    return "";
  }

  private strategyMode(item: SpecMapping, strategyId: string): string {
    const rawMode = getValueOr(item, "strategy_mode", getValueOr(this.config, "strategy_mode_default", "full"));
    const mode = strip(text(rawMode)).toLowerCase();
    if (mode !== "full" && mode !== "logistics_only") {
      throw valueError(`flex.strategies[${strategyId}].strategy_mode must be 'full' or 'logistics_only'.`);
    }
    return mode;
  }

  private pgaKey(): string {
    return strip(text(getValueOr(this.config, "pga_key", "hazard.seismic.PGA")));
  }

  private pgaStatesRef(): string {
    return strip(text(getValueOr(this.config, "pga_states_ref", "PGA")));
  }

  private pgaNoneStateLabel(): string {
    return nonEmptyOr(strip(text(getValueOr(this.config, "pga_none_state_label", "None"))), "None");
  }

  private floodNoneStateLabel(): string {
    return nonEmptyOr(strip(text(getValueOr(this.config, "flood_none_state_label", "None"))), "None");
  }

  private storageFailedKey(storageId: string): string {
    return `flex.storage_failed.${storageId}`;
  }

  private defaultStorageFailedNodeId(storageId: string): string {
    return `FLEX_STORAGE_FAILED_${slug(storageId).toUpperCase()}`;
  }

  private equipmentUnavailableKey(equipmentId: string): string {
    return `flex.equipment_unavailable.${equipmentId}`;
  }

  private defaultEquipmentUnavailableNodeId(equipmentId: string): string {
    return `FLEX_EQUIPMENT_UNAVAILABLE_${slug(equipmentId).toUpperCase()}`;
  }

  private accessFailedKey(accessId: string): string {
    return `flex.access_failed.${accessId}`;
  }

  private defaultAccessFailedNodeId(accessId: string): string {
    return `FLEX_ACCESS_FAILED_${slug(accessId).toUpperCase()}`;
  }

  private hookupFailedKey(hookupId: string): string {
    return `flex.hookup_failed.${hookupId}`;
  }

  private defaultHookupFailedNodeId(hookupId: string): string {
    return `FLEX_HOOKUP_FAILED_${slug(hookupId).toUpperCase()}`;
  }

  private retrieveFailedKey(strategyId: string): string {
    return `flex.strategy.${strategyId}.retrieve_failed`;
  }

  private defaultRetrieveFailedNodeId(strategyId: string): string {
    return `FLEX_RETRIEVE_FAILED_${slug(strategyId).toUpperCase()}`;
  }

  private transportFailedKey(strategyId: string): string {
    return `flex.strategy.${strategyId}.transport_failed`;
  }

  private defaultTransportFailedNodeId(strategyId: string): string {
    return `FLEX_TRANSPORT_FAILED_${slug(strategyId).toUpperCase()}`;
  }

  private connectFailedKey(strategyId: string): string {
    return `flex.strategy.${strategyId}.connect_failed`;
  }

  private defaultConnectFailedNodeId(strategyId: string): string {
    return `FLEX_CONNECT_FAILED_${slug(strategyId).toUpperCase()}`;
  }

  private startRunFailedKey(strategyId: string): string {
    return `flex.strategy.${strategyId}.start_run_failed`;
  }

  private defaultStartRunFailedNodeId(strategyId: string): string {
    return `FLEX_START_RUN_FAILED_${slug(strategyId).toUpperCase()}`;
  }

  private strategyFailedKey(strategyId: string): string {
    return `flex.strategy_failed.${strategyId}`;
  }

  private defaultStrategyFailedNodeId(strategyId: string): string {
    return `FLEX_STRATEGY_FAILED_${slug(strategyId).toUpperCase()}`;
  }

  private goalFailedKey(goalId: string): string {
    return `flex.goal_failed.${goalId}`;
  }

  private defaultGoalFailedNodeId(goalId: string): string {
    return `FLEX_GOAL_FAILED_${slug(goalId).toUpperCase()}`;
  }

  private mappingItems(raw: SpecValue, label: string): SpecMapping[] {
    if (!isSequence(raw)) throw valueError(`flex.${label} must be list-like.`);
    return raw.map((item, index) => {
      if (!isMapping(item)) throw valueError(`flex.${label}[${index}] must be object/mapping.`);
      return item;
    });
  }

  private storageItems(): SpecMapping[] {
    return this.mappingItems(getValueOr(this.config, "storages", []), "storages");
  }

  private equipmentItems(): SpecMapping[] {
    return this.mappingItems(getValueOr(this.config, "equipment", []), "equipment");
  }

  private accessItems(): SpecMapping[] {
    return this.mappingItems(getValueOr(this.config, "access", []), "access");
  }

  private hookupItems(): SpecMapping[] {
    return this.mappingItems(getValueOr(this.config, "hookups", []), "hookups");
  }

  private strategyItems(): SpecMapping[] {
    return this.mappingItems(getValueOr(this.config, "strategies", []), "strategies");
  }

  private goalItems(): SpecMapping[] {
    return this.mappingItems(getValueOr(this.config, "goals", []), "goals");
  }

  private idheasCfg(): SpecMapping {
    const raw = getValue(this.config, "idheas_eca");
    if (raw === null) return {};
    if (!isMapping(raw)) throw valueError("flex.idheas_eca must be object/mapping when provided.");
    return raw;
  }

  private idheasEnabled(): boolean {
    const cfg = this.idheasCfg();
    if (keysOf(cfg).length === 0) return false;
    return truthy(getValueOr(cfg, "enabled", true));
  }

  private idheasContextItems(): SpecMapping[] {
    if (!this.idheasEnabled()) return [];
    return this.mappingItems(getValueOr(this.idheasCfg(), "contexts", []), "idheas_eca.contexts");
  }

  private idheasHfeItems(): SpecMapping[] {
    if (!this.idheasEnabled()) return [];
    return this.mappingItems(getValueOr(this.idheasCfg(), "hfe_nodes", []), "idheas_eca.hfe_nodes");
  }

  private defaultIdheasContextKey(contextId: string): string {
    return `flex.hra.context.${contextId}`;
  }

  private defaultIdheasContextNodeId(contextId: string): string {
    return `FLEX_HRA_CONTEXT_${slug(contextId).toUpperCase()}`;
  }

  private defaultIdheasHfeKey(hfeId: string): string {
    return `flex.hra.hfe.${hfeId}.failed`;
  }

  private defaultIdheasHfeNodeId(hfeId: string): string {
    return `FLEX_HRA_HFE_FAILED_${slug(hfeId).toUpperCase()}`;
  }

  private resolveTextList(raw: SpecValue, label: string, required: boolean): string[] {
    if (raw === null) {
      if (required) throw valueError(`flex.${label} must be list-like and non-empty.`);
      return [];
    }
    if (!isSequence(raw)) throw valueError(`flex.${label} must be list-like.`);
    const output = raw.map((item, index) => FlexBuilder.requireText(item, `${label}[${index}]`));
    if (required && output.length === 0) throw valueError(`flex.${label} must be non-empty.`);
    return output;
  }

  private static requireText(value: SpecValue, label: string): string {
    if (typeof value !== "string" || strip(value).length === 0) {
      throw valueError(`flex.${label} must be a non-empty string.`);
    }
    return strip(value);
  }

  private static requireFloat(value: SpecValue, label: string): number {
    try {
      return toFloat(value);
    } catch (error) {
      if (error instanceof NetworkBuilderError) throw valueError(`flex.${label} must be numeric.`);
      throw error;
    }
  }

  private static requirePositiveFloat(value: SpecValue, label: string): number {
    const parsed = FlexBuilder.requireFloat(value, label);
    if (parsed <= 0) throw valueError(`flex.${label} must be > 0.`);
    return parsed;
  }

  private static requireProbability(value: SpecValue, label: string): number {
    const parsed = FlexBuilder.requireFloat(value, label);
    if (parsed < 0 || parsed > 1) throw valueError(`flex.${label} must be in [0,1].`);
    return parsed;
  }
}

export { FlexBuilder };
