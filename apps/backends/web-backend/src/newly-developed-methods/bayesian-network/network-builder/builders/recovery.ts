import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { valueError } from "../core/errors";
import {
  cartesianProduct,
  compareText,
  floatRepr,
  getValue,
  getValueOr,
  isMapping,
  isSequence,
  iterValues,
  keysOf,
  repr,
  sortedText,
  strip,
  text,
  truthy,
  tupleRepr,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import {
  CAUSE_OR_MODELS,
  DEFAULT_ENVIRONMENT_STATES,
  FRAGILITY_MODELS,
  TABLE_MODELS,
  availableAtNodeId,
  availableAtPrefix,
  availableCfg,
  dgBetaMultiplierByState,
  dgEnvironmentCfg,
  dgEnvironmentKey,
  dgEnvironmentNodeId,
  dgEnvironmentOrder,
  dgHazardNonrecoverableCfg,
  dgHazardNonrecoverableKey,
  dgHazardNonrecoverableNodeId,
  dgHazardParentKeys,
  dgId,
  dgNotRecoveredKey,
  dgNotRecoveredNodeId,
  dgTimeBinsHours,
  dgWeibullParams,
  enabledDgItems,
  failedByNodeId,
  failedByPrefix,
  hazardNonrecoverableParentCfg,
  initialLossCauseKeyDefault,
  initialLossCauseNodeIdDefault,
  initialLossCfg,
  initialLossInternalKeys,
  initialLossKeyDefault,
  initialLossKeyExternal,
  initialLossNodeIdDefault,
  initialLossParentKeys,
  isEnabled,
  legacyModelError,
  loopCfg,
  loopEnabled,
  loopEnvironmentCfg,
  loopEnvironmentKeyDefault,
  loopEnvironmentNodeIdDefault,
  loopModel,
  lowerText,
  orderedUnion,
  simpleBaselineLognormal,
  simpleFailedByCfg,
  simpleMultiplierModel,
  simpleMultiplierModelForEnvironment,
  simpleRecoveryParentKeys,
  tableKey,
  tableNodeId,
  tableParentKeys,
  timeBinsHours,
} from "./recovery-config";
import {
  makeConstantBoolCpdGenerator,
  makeDgHazardNonrecoverableCpdGenerator,
  makeDgNotRecoveredCpdGenerator,
  makeFloodCauseCpdGenerator,
  makeFragilityCauseCpdGenerator,
  makeInitialLossFragilityCpdGenerator,
  makeNotBoolCpdGenerator,
  makeOrBoolCpdGenerator,
  makeSimpleFailedByCpdGenerator,
  makeSimpleFailedByEnvironmentCpdGenerator,
  makeTableConstantCpdGenerator,
  makeTableRowsCpdGenerator,
} from "./recovery-cpd-generators";
import {
  BOOL_STATES,
  dgNonRecoveryProbability,
  lookup,
  requireFloat,
  requirePositiveFloat,
  requireProbability,
  requireText,
  resolveImByState,
  resolveListText,
  resolveProbabilityVector,
  setsEqual,
  simpleFailedProbability,
  simpleFailedProbabilityForMultiplier,
  timeLabel,
} from "./recovery-values";

interface BuiltNode {
  nodeId: string;
  states: string[];
}

interface ParentItem {
  nodeId: string;
  key: string;
}

interface TableNodeInput {
  context: ModelContext;
  cfg: SpecValue;
  label: string;
  defaultKey: string;
  defaultNodeId: string;
  defaultStates: readonly string[];
}

interface InitialLossNodeInput {
  context: ModelContext;
  cfg: SpecMapping;
  label: string;
  defaultKey: string;
  defaultNodeId: string;
}

const sortParentItems = (items: ParentItem[]): ParentItem[] =>
  items.sort((left, right) => compareText(left.nodeId, right.nodeId));

const failedByDefinition = (hazardNonrecoverableParentId: string | null): string =>
  hazardNonrecoverableParentId !== null ?
    "loop_lost_initial AND " + "(hazard_nonrecoverable OR nonrecovery_by_time)"
  : "loop_lost_initial AND nonrecovery_by_time";

const boolStatesOrConfigured = (cfg: SpecMapping, label: string): string[] => {
  const configured = resolveListText(getValue(cfg, "states"), `${label}.states`, false);
  return configured.length > 0 ? configured : Array.from(BOOL_STATES);
};

const floodPolicyOf = (cfg: SpecMapping, label: string, fallback: string): string => {
  const floodPolicy = lowerText(getValueOr(cfg, "flood_when_seismic", fallback));
  if (floodPolicy !== "block" && floodPolicy !== "attenuate" && floodPolicy !== "full") {
    throw valueError(`${label}.flood_when_seismic must be one of: block, attenuate, full.`);
  }
  return floodPolicy;
};

const buildTableNode = (input: TableNodeInput): BuiltNode => {
  const { context, cfg, label } = input;
  let cfgMap: SpecMapping = {};
  if (cfg !== null) {
    if (!isMapping(cfg)) throw valueError(`${label} must be object/mapping when provided.`);
    cfgMap = cfg;
  }
  const key = tableKey(cfgMap, input.defaultKey);
  const nodeId = tableNodeId(cfgMap, input.defaultNodeId);
  const configuredStates = resolveListText(getValue(cfgMap, "states"), `${label}.states`, false);
  const states = configuredStates.length > 0 ? configuredStates : Array.from(input.defaultStates);
  if (states.length < 2) throw valueError(`${label}.states must include at least two unique states.`);
  if (states.length !== new Set(states).size) throw valueError(`${label}.states contains duplicates.`);

  const parentKeys = resolveListText(getValue(cfgMap, "parent_keys"), `${label}.parent_keys`, false);
  const parentItems: ParentItem[] = [];
  for (const parentKey of parentKeys) {
    if (!context.registry.hasKey(parentKey)) {
      throw valueError(`${label} references unknown parent key '${parentKey}'.`);
    }
    parentItems.push({ nodeId: context.registry.nodeId(parentKey), key: parentKey });
  }
  sortParentItems(parentItems);
  const orderedParentIds = parentItems.map((item) => item.nodeId);
  const orderedParentKeys = parentItems.map((item) => item.key);

  if (orderedParentIds.length === 0) {
    const probabilities = resolveProbabilityVector(getValue(cfgMap, "probs"), states, `${label}.probs`);
    context.model.addNode({
      key,
      nodeId,
      states,
      metadata: { builder: "recovery", kind: label },
      parentIds: orderedParentIds,
      cpdGenerator: makeTableConstantCpdGenerator(probabilities),
    });
    context.registry.register(key, nodeId);
    return { nodeId, states };
  }

  const rows = getValue(cfgMap, "rows");
  if (!isSequence(rows) || rows.length === 0) {
    throw valueError(`${label}.rows must be a non-empty list when parent_keys are provided.`);
  }
  const comboToProbabilities = new Map<string, number[]>();
  rows.forEach((row, rowIndex) => {
    if (!isMapping(row)) throw valueError(`${label}.rows[${rowIndex}] must be object/mapping.`);
    const when = getValue(row, "when");
    if (!isMapping(when)) throw valueError(`${label}.rows[${rowIndex}].when must be object/mapping.`);
    if (!setsEqual(keysOf(when), orderedParentKeys)) {
      throw valueError(
        `${label}.rows[${rowIndex}] 'when' keys mismatch. ` +
          `Expected ${repr(orderedParentKeys)}, got ${repr(sortedText(keysOf(when)))}.`,
      );
    }
    const combo: string[] = [];
    for (const parentKey of orderedParentKeys) {
      const state = text(when[parentKey]);
      const parentStates = context.model.node(context.registry.nodeId(parentKey)).states;
      if (!parentStates.includes(state)) {
        throw valueError(
          `${label}.rows[${rowIndex}] references state '${state}' not in ` +
            `parent '${parentKey}' states ${repr(parentStates)}.`,
        );
      }
      combo.push(state);
    }
    const comboKey = JSON.stringify(combo);
    if (comboToProbabilities.has(comboKey)) {
      throw valueError(`Duplicate row mapping for ${label} combo=${tupleRepr(combo)}.`);
    }
    comboToProbabilities.set(
      comboKey,
      resolveProbabilityVector(getValue(row, "probs"), states, `${label}.rows[${rowIndex}].probs`),
    );
  });

  const parentStateLists = orderedParentKeys.map(
    (parentKey) => context.model.node(context.registry.nodeId(parentKey)).states,
  );
  for (const combo of cartesianProduct(parentStateLists)) {
    if (!comboToProbabilities.has(JSON.stringify(combo))) {
      throw valueError(`${label} missing mapping for parent combo ${tupleRepr(combo)}.`);
    }
  }

  context.model.addNode({
    key,
    nodeId,
    states,
    metadata: { builder: "recovery", kind: label },
    parentIds: orderedParentIds,
    cpdGenerator: makeTableRowsCpdGenerator(comboToProbabilities),
  });
  context.registry.register(key, nodeId);
  return { nodeId, states };
};

const buildInitialLossFragilityNode = (input: InitialLossNodeInput): BuiltNode => {
  const { context, cfg, label } = input;
  const key = tableKey(cfg, input.defaultKey);
  const nodeId = tableNodeId(cfg, input.defaultNodeId);
  const states = boolStatesOrConfigured(cfg, label);
  if (!setsEqual(states, BOOL_STATES) || states.length !== 2) {
    throw valueError(
      `${label}.states must be exactly ${repr(BOOL_STATES)} in any order ` + "for fragility_conditional model.",
    );
  }

  const seismicCfg = getValue(cfg, "seismic");
  const floodCfg = getValue(cfg, "flood");
  if (!isMapping(seismicCfg)) throw valueError(`${label}.seismic must be object/mapping.`);
  if (!isMapping(floodCfg)) throw valueError(`${label}.flood must be object/mapping.`);

  const parentKeysCfg = resolveListText(getValue(cfg, "parent_keys"), `${label}.parent_keys`, false);
  const seismicDefault = parentKeysCfg.length >= 1 ? parentKeysCfg[0] : "";
  const floodDefault = parentKeysCfg.length >= 2 ? parentKeysCfg[1] : "";
  const seismicParentKey = strip(text(getValueOr(seismicCfg, "parent_key", seismicDefault)));
  const floodParentKey = strip(text(getValueOr(floodCfg, "parent_key", floodDefault)));
  if (seismicParentKey.length === 0 || floodParentKey.length === 0) {
    throw valueError(
      `${label} requires seismic.parent_key and flood.parent_key ` + "(or inferable parent_keys order).",
    );
  }
  if (seismicParentKey === floodParentKey) {
    throw valueError(`${label} seismic.parent_key and flood.parent_key must be different.`);
  }
  if (!context.registry.hasKey(seismicParentKey)) {
    throw valueError(`${label} references unknown seismic parent '${seismicParentKey}'.`);
  }
  if (!context.registry.hasKey(floodParentKey)) {
    throw valueError(`${label} references unknown flood parent '${floodParentKey}'.`);
  }

  const seismicParentId = context.registry.nodeId(seismicParentKey);
  const floodParentId = context.registry.nodeId(floodParentKey);
  const seismicStates = context.model.node(seismicParentId).states;
  const floodStates = context.model.node(floodParentId).states;

  const baseProbability = requireProbability(getValueOr(cfg, "base_prob", 0), `${label}.base_prob`);

  const thetaSeismic = requirePositiveFloat(getValue(seismicCfg, "theta"), `${label}.seismic.theta`);
  const betaSeismic = requirePositiveFloat(getValue(seismicCfg, "beta"), `${label}.seismic.beta`);
  const thetaFlood = requirePositiveFloat(getValue(floodCfg, "theta"), `${label}.flood.theta`);
  const betaFlood = requirePositiveFloat(getValue(floodCfg, "beta"), `${label}.flood.beta`);

  const seismicImByState = resolveImByState(
    seismicStates,
    getValue(seismicCfg, "im_by_state"),
    `${label}.seismic.im_by_state`,
  );
  const floodImByState = resolveImByState(floodStates, getValue(floodCfg, "im_by_state"), `${label}.flood.im_by_state`);

  let dependenceCfg = getValueOr(cfg, "dependence", {});
  if (dependenceCfg === null) dependenceCfg = {};
  if (!isMapping(dependenceCfg)) throw valueError(`${label}.dependence must be object/mapping.`);
  const dependenceEnabled = truthy(getValueOr(dependenceCfg, "enabled", true));
  const dependenceStrength = requireFloat(
    getValueOr(dependenceCfg, "dep_strength", 0),
    `${label}.dependence.dep_strength`,
  );
  if (dependenceStrength < 0) throw valueError(`${label}.dependence.dep_strength must be >= 0.`);
  const minThetaScale = requirePositiveFloat(
    getValueOr(dependenceCfg, "min_theta_scale", 0.1),
    `${label}.dependence.min_theta_scale`,
  );
  if (minThetaScale > 1) throw valueError(`${label}.dependence.min_theta_scale must be <= 1.`);

  const floodPolicy = floodPolicyOf(cfg, label, "full");
  const attenuateFactor = requireProbability(getValueOr(cfg, "attenuate_factor", 0.1), `${label}.attenuate_factor`);

  const orderedParentIds = sortParentItems([
    { nodeId: seismicParentId, key: seismicParentKey },
    { nodeId: floodParentId, key: floodParentKey },
  ]).map((item) => item.nodeId);

  context.model.addNode({
    key,
    nodeId,
    states,
    metadata: {
      builder: "recovery",
      kind: label,
      model: "fragility_conditional",
      base_prob: baseProbability,
      seismic_parent_key: seismicParentKey,
      flood_parent_key: floodParentKey,
      dependence_enabled: dependenceEnabled,
      dependence_strength: dependenceStrength,
      flood_when_seismic: floodPolicy,
      attenuate_factor: attenuateFactor,
    },
    parentIds: orderedParentIds,
    cpdGenerator: makeInitialLossFragilityCpdGenerator({
      seismicParentId,
      floodParentId,
      thetaSeismic,
      betaSeismic,
      thetaFlood,
      betaFlood,
      seismicImByState,
      floodImByState,
      baseProbability,
      dependenceEnabled,
      dependenceStrength,
      minThetaScale,
      floodPolicy,
      attenuateFactor,
    }),
  });
  context.registry.register(key, nodeId);
  return { nodeId, states };
};

const buildInitialLossCauseOrNode = (input: InitialLossNodeInput): BuiltNode => {
  const { context, cfg, label } = input;
  const initialKey = tableKey(cfg, input.defaultKey);
  const initialNodeId = tableNodeId(cfg, input.defaultNodeId);
  const initialStates = boolStatesOrConfigured(cfg, label);
  if (!setsEqual(initialStates, BOOL_STATES) || initialStates.length !== 2) {
    throw valueError(`${label}.states must be exactly ${repr(BOOL_STATES)} in any order for cause_or model.`);
  }

  const causesRaw = getValue(cfg, "causes");
  if (!isMapping(causesRaw)) throw valueError(`${label}.causes must be object/mapping for cause_or model.`);

  const seismicCfg = getValue(causesRaw, "seismic");
  const floodCfg = getValue(causesRaw, "flood_switchyard");
  const backgroundRaw = getValue(causesRaw, "background_gr");
  if (!isMapping(seismicCfg)) throw valueError(`${label}.causes.seismic must be object/mapping.`);
  if (!isMapping(floodCfg)) throw valueError(`${label}.causes.flood_switchyard must be object/mapping.`);
  if (backgroundRaw !== null && !isMapping(backgroundRaw)) {
    throw valueError(`${label}.causes.background_gr must be object/mapping when provided.`);
  }

  const seismicKey = tableKey(seismicCfg, initialLossCauseKeyDefault("seismic"));
  const seismicNodeId = tableNodeId(seismicCfg, initialLossCauseNodeIdDefault("seismic"));
  const seismicParentKey = requireText(getValue(seismicCfg, "parent_key"), `${label}.causes.seismic.parent_key`);
  if (!context.registry.hasKey(seismicParentKey)) {
    throw valueError(`${label}.causes.seismic references unknown parent key '${seismicParentKey}'.`);
  }
  const seismicParentId = context.registry.nodeId(seismicParentKey);
  const seismicParentStates = context.model.node(seismicParentId).states;
  const thetaSeismic = requirePositiveFloat(getValue(seismicCfg, "theta"), `${label}.causes.seismic.theta`);
  const betaSeismic = requirePositiveFloat(getValue(seismicCfg, "beta"), `${label}.causes.seismic.beta`);
  const seismicImByState = resolveImByState(
    seismicParentStates,
    getValue(seismicCfg, "im_by_state"),
    `${label}.causes.seismic.im_by_state`,
  );
  context.model.addNode({
    key: seismicKey,
    nodeId: seismicNodeId,
    states: BOOL_STATES,
    metadata: {
      builder: "recovery",
      kind: `${label}.cause.seismic`,
      theta: thetaSeismic,
      beta: betaSeismic,
      true_means: "loop_initiation_due_to_seismic",
    },
    parentIds: [seismicParentId],
    cpdGenerator: makeFragilityCauseCpdGenerator({
      parentId: seismicParentId,
      theta: thetaSeismic,
      beta: betaSeismic,
      imByState: seismicImByState,
    }),
  });
  context.registry.register(seismicKey, seismicNodeId);

  const floodKey = tableKey(floodCfg, initialLossCauseKeyDefault("flood_switchyard"));
  const floodNodeId = tableNodeId(floodCfg, initialLossCauseNodeIdDefault("flood_switchyard"));
  const floodParentKey = requireText(getValue(floodCfg, "parent_key"), `${label}.causes.flood_switchyard.parent_key`);
  if (!context.registry.hasKey(floodParentKey)) {
    throw valueError(`${label}.causes.flood_switchyard references unknown parent key '${floodParentKey}'.`);
  }
  const floodParentId = context.registry.nodeId(floodParentKey);
  const floodParentStates = context.model.node(floodParentId).states;
  const thetaFlood = requirePositiveFloat(getValue(floodCfg, "theta"), `${label}.causes.flood_switchyard.theta`);
  const betaFlood = requirePositiveFloat(getValue(floodCfg, "beta"), `${label}.causes.flood_switchyard.beta`);
  const floodImByState = resolveImByState(
    floodParentStates,
    getValue(floodCfg, "im_by_state"),
    `${label}.causes.flood_switchyard.im_by_state`,
  );
  const floodPolicy = floodPolicyOf(cfg, label, "attenuate");
  const attenuateFactor = requireProbability(getValueOr(cfg, "attenuate_factor", 0.1), `${label}.attenuate_factor`);
  const floodDependsOnSeismic = floodPolicy === "block" || floodPolicy === "attenuate";
  const floodParentIds = sortedText(floodDependsOnSeismic ? [floodParentId, seismicNodeId] : [floodParentId]);
  context.model.addNode({
    key: floodKey,
    nodeId: floodNodeId,
    states: BOOL_STATES,
    metadata: {
      builder: "recovery",
      kind: `${label}.cause.flood_switchyard`,
      theta: thetaFlood,
      beta: betaFlood,
      flood_when_seismic: floodPolicy,
      attenuate_factor: attenuateFactor,
      true_means: "loop_initiation_due_to_switchyard_flood",
    },
    parentIds: floodParentIds,
    cpdGenerator: makeFloodCauseCpdGenerator({
      floodParentId,
      seismicCauseParentId: floodDependsOnSeismic ? seismicNodeId : null,
      theta: thetaFlood,
      beta: betaFlood,
      imByState: floodImByState,
      floodPolicy,
      attenuateFactor,
    }),
  });
  context.registry.register(floodKey, floodNodeId);

  const hazardUnionRaw = getValue(cfg, "hazard_union");
  let hazardUnionCfg: SpecMapping;
  if (hazardUnionRaw === null) hazardUnionCfg = {};
  else if (isMapping(hazardUnionRaw)) hazardUnionCfg = hazardUnionRaw;
  else throw valueError(`${label}.hazard_union must be object/mapping when provided.`);
  const hazardUnionEnabled = truthy(getValueOr(hazardUnionCfg, "enabled", false));

  const hazardUnionKey = tableKey(hazardUnionCfg, initialLossCauseKeyDefault("hazard"));
  const hazardUnionNodeId = tableNodeId(hazardUnionCfg, initialLossCauseNodeIdDefault("hazard"));
  if (hazardUnionEnabled) {
    const hazardUnionParentIds = sortedText([seismicNodeId, floodNodeId]);
    context.model.addNode({
      key: hazardUnionKey,
      nodeId: hazardUnionNodeId,
      states: BOOL_STATES,
      metadata: {
        builder: "recovery",
        kind: `${label}.cause.hazard`,
        definition: "OR(loop.cause.seismic, loop.cause.flood_switchyard)",
        true_means: "loop_initiation_due_to_hazard",
      },
      parentIds: hazardUnionParentIds,
      cpdGenerator: makeOrBoolCpdGenerator(hazardUnionParentIds),
    });
    context.registry.register(hazardUnionKey, hazardUnionNodeId);
  }

  const backgroundCfg: SpecMapping = backgroundRaw === null ? {} : backgroundRaw;
  const backgroundKey = tableKey(backgroundCfg, initialLossCauseKeyDefault("background_gr"));
  const backgroundNodeId = tableNodeId(backgroundCfg, initialLossCauseNodeIdDefault("background_gr"));
  const backgroundTrueProbability = requireProbability(
    getValueOr(backgroundCfg, "true_prob", getValueOr(cfg, "base_prob", 0.005)),
    `${label}.causes.background_gr.true_prob`,
  );
  context.model.addNode({
    key: backgroundKey,
    nodeId: backgroundNodeId,
    states: BOOL_STATES,
    metadata: {
      builder: "recovery",
      kind: `${label}.cause.background_gr`,
      true_prob: backgroundTrueProbability,
      true_means: "loop_background_initiation",
    },
    parentIds: [],
    cpdGenerator: makeConstantBoolCpdGenerator(backgroundTrueProbability),
  });
  context.registry.register(backgroundKey, backgroundNodeId);

  const causeParentIds =
    hazardUnionEnabled ?
      sortedText([hazardUnionNodeId, backgroundNodeId])
    : sortedText([seismicNodeId, floodNodeId, backgroundNodeId]);
  context.model.addNode({
    key: initialKey,
    nodeId: initialNodeId,
    states: initialStates,
    metadata: {
      builder: "recovery",
      kind: label,
      model: "cause_or",
      flood_when_seismic: floodPolicy,
      attenuate_factor: attenuateFactor,
      hazard_union_enabled: hazardUnionEnabled,
    },
    parentIds: causeParentIds,
    cpdGenerator: makeOrBoolCpdGenerator(causeParentIds),
  });
  context.registry.register(initialKey, initialNodeId);
  return { nodeId: initialNodeId, states: initialStates };
};

const resolveInitialLossNode = (context: ModelContext, loop: SpecMapping): BuiltNode => {
  const cfg = initialLossCfg(loop);
  if (truthy(cfg)) {
    const modelKind = lowerText(getValueOr(cfg, "model", "table"));
    const shared = {
      context,
      cfg,
      label: "recovery.loop.initial_loss",
      defaultKey: initialLossKeyDefault(),
      defaultNodeId: initialLossNodeIdDefault(),
    };
    if (TABLE_MODELS.includes(modelKind)) return buildTableNode({ ...shared, defaultStates: BOOL_STATES });
    if (FRAGILITY_MODELS.includes(modelKind)) return buildInitialLossFragilityNode(shared);
    if (CAUSE_OR_MODELS.includes(modelKind)) return buildInitialLossCauseOrNode(shared);
    throw valueError(
      "recovery.loop.initial_loss.model must be one of: " + "'table', 'rows', 'fragility_conditional', 'cause_or'.",
    );
  }
  const key = initialLossKeyExternal(loop);
  if (!context.registry.hasKey(key)) {
    throw valueError(
      "recovery.loop.initial_loss not configured and external initial loss key " + `'${key}' was not found.`,
    );
  }
  const nodeId = context.registry.nodeId(key);
  return { nodeId, states: context.model.node(nodeId).states };
};

const dgHazardTrueStateByParent = (
  dgCfg: SpecMapping,
  parentItems: readonly ParentItem[],
  context: ModelContext,
): Map<string, string> => {
  const identifier = dgId(dgCfg);
  const cfg = dgHazardNonrecoverableCfg(dgCfg);
  let raw = getValueOr(cfg, "true_state_by_parent", {});
  if (raw === null) raw = {};
  if (!isMapping(raw)) {
    throw valueError(`recovery.dgs[${identifier}].hazard_nonrecoverable.true_state_by_parent must be object/mapping.`);
  }
  const output = new Map<string, string>();
  const knownParentKeys = parentItems.map((item) => item.key);
  for (const item of parentItems) {
    const states = context.model.node(item.nodeId).states;
    const configured = strip(text(getValueOr(raw, item.key, "True")));
    const trueState = configured.length > 0 ? configured : "True";
    if (!states.includes(trueState)) {
      throw valueError(
        `recovery.dgs[${identifier}].hazard_nonrecoverable.true_state_by_parent[${item.key}] ` +
          `state '${trueState}' is not in parent states ${repr(states)}.`,
      );
    }
    output.set(item.key, trueState);
  }
  const extra = sortedText(keysOf(raw).filter((key) => !knownParentKeys.includes(key)));
  if (extra.length > 0) {
    throw valueError(
      `recovery.dgs[${identifier}].hazard_nonrecoverable.true_state_by_parent has ` +
        `unknown parent keys: ${repr(extra)}.`,
    );
  }
  return output;
};

class RecoveryBuilder extends BuilderBase {
  get builderType(): string {
    return "recovery";
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    if (!isEnabled(this.config)) return required;

    const loop = loopCfg(this.config);
    const loopIsEnabled = loopEnabled(loop);

    const dgs = enabledDgItems(this.config);
    if (!loopIsEnabled && dgs.length === 0) return required;

    if (loopIsEnabled) {
      const model = loopModel(loop);
      if (model !== "simple" && model !== "") throw legacyModelError();

      const initialLoss = initialLossCfg(loop);
      if (truthy(initialLoss)) {
        for (const parentKey of initialLossParentKeys(initialLoss)) required.add(parentKey);
      } else {
        required.add(initialLossKeyExternal(loop));
      }

      const failedCfg = simpleFailedByCfg(loop);
      const environmentCfg = loopEnvironmentCfg(loop);
      if (truthy(environmentCfg)) {
        for (const parentKey of tableParentKeys(environmentCfg)) required.add(parentKey);
      } else {
        const parentKeys = simpleRecoveryParentKeys(loop, failedCfg);
        required.add(parentKeys.pgaKey);
        required.add(parentKeys.floodKey);
      }
    }

    for (const dgCfg of dgs) {
      for (const parentKey of tableParentKeys(dgEnvironmentCfg(dgCfg))) required.add(parentKey);
      const hazardCfg = dgHazardNonrecoverableCfg(dgCfg);
      if (truthy(getValueOr(hazardCfg, "enabled", false))) {
        const hazardKeys = dgHazardParentKeys(dgCfg);
        for (const parentKey of orderedUnion(hazardKeys.anyParentKeys, hazardKeys.allParentKeys)) {
          required.add(parentKey);
        }
      }
    }
    return required;
  }

  get provides(): Set<string> {
    if (!isEnabled(this.config)) return new Set<string>();
    const loop = loopCfg(this.config);
    const loopIsEnabled = loopEnabled(loop);
    const dgs = enabledDgItems(this.config);
    if (!loopIsEnabled && dgs.length === 0) return new Set<string>();

    const output = new Set<string>();
    if (loopIsEnabled) {
      const initialLoss = initialLossCfg(loop);
      if (truthy(initialLoss)) {
        output.add(tableKey(initialLoss, initialLossKeyDefault()));
        for (const key of initialLossInternalKeys(initialLoss)) output.add(key);
      }
      const environmentCfg = loopEnvironmentCfg(loop);
      if (truthy(environmentCfg)) output.add(tableKey(environmentCfg, loopEnvironmentKeyDefault()));

      const failedCfg = simpleFailedByCfg(loop);
      const failedPrefix = strip(text(getValueOr(failedCfg, "prefix", failedByPrefix(loop))));
      if (failedPrefix.length === 0) throw valueError("recovery.loop.failed_by.prefix must be non-empty.");
      for (const tHours of timeBinsHours(loop, this.config)) output.add(`${failedPrefix}.${timeLabel(tHours)}`);

      const available = availableCfg(loop);
      if (truthy(getValueOr(available, "enabled", false))) {
        const availablePrefix = strip(text(getValueOr(available, "prefix", availableAtPrefix(loop))));
        if (availablePrefix.length === 0) {
          throw valueError("recovery.loop.available_at.prefix must be non-empty when enabled.");
        }
        for (const tHours of timeBinsHours(loop, this.config)) {
          output.add(`${availablePrefix}.${timeLabel(tHours)}`);
        }
      }
    }

    for (const dgCfg of dgs) {
      const identifier = dgId(dgCfg);
      const environmentCfg = dgEnvironmentCfg(dgCfg);
      output.add(tableKey(environmentCfg, dgEnvironmentKey(identifier)));
      const hazardCfg = dgHazardNonrecoverableCfg(dgCfg);
      if (truthy(getValueOr(hazardCfg, "enabled", false))) {
        output.add(tableKey(hazardCfg, dgHazardNonrecoverableKey(identifier)));
      }
      for (const tHours of dgTimeBinsHours(dgCfg, this.config)) output.add(dgNotRecoveredKey(identifier, tHours));
    }
    return output;
  }

  build(context: ModelContext): void {
    if (!isEnabled(this.config)) return;
    const loop = loopCfg(this.config);
    const loopIsEnabled = loopEnabled(loop);
    const dgs = enabledDgItems(this.config);
    if (!loopIsEnabled && dgs.length === 0) return;

    if (loopIsEnabled) {
      const model = loopModel(loop);
      if (model !== "simple" && model !== "") throw legacyModelError();
      this.buildSimple(context, loop);
    }

    if (dgs.length > 0) this.buildDgRecovery(context, dgs);
  }

  private buildSimple(context: ModelContext, loop: SpecMapping): void {
    const timeBins = timeBinsHours(loop, this.config);

    const initialLoss = resolveInitialLossNode(context, loop);
    const initialLossId = initialLoss.nodeId;
    if (!initialLoss.states.includes("False") || !initialLoss.states.includes("True")) {
      throw valueError("recovery.loop.initial_loss states must include ['False','True'].");
    }
    const initialLossTrueState = "True";
    const initialLossFalseState = "False";

    const failedCfg = simpleFailedByCfg(loop);
    const hazardParent = hazardNonrecoverableParentCfg(failedCfg);
    const hazardNonrecoverableKey = hazardParent.key;
    const hazardNonrecoverableTrueState = hazardParent.trueState;
    let hazardNonrecoverableParentId: string | null = null;
    if (hazardNonrecoverableKey !== null) {
      if (!context.registry.hasKey(hazardNonrecoverableKey)) {
        throw valueError(
          "recovery.loop.failed_by.hazard_nonrecoverable_parent_key references " +
            `unknown key '${hazardNonrecoverableKey}'.`,
        );
      }
      hazardNonrecoverableParentId = context.registry.nodeId(hazardNonrecoverableKey);
      const hazardStates = context.model.node(hazardNonrecoverableParentId).states;
      if (!hazardStates.includes(hazardNonrecoverableTrueState)) {
        throw valueError(
          "recovery.loop.failed_by.hazard_nonrecoverable_true_state " +
            `'${hazardNonrecoverableTrueState}' is not a valid state for ` +
            `'${hazardNonrecoverableKey}' (${repr(hazardStates)}).`,
        );
      }
    }

    const baseline = simpleBaselineLognormal(failedCfg);
    const mu0 = baseline.mu;
    const sigma0 = baseline.sigma;

    const failedPrefix = strip(text(getValueOr(failedCfg, "prefix", failedByPrefix(loop))));
    if (failedPrefix.length === 0) throw valueError("recovery.loop.failed_by.prefix must be non-empty.");
    const environmentCfg = loopEnvironmentCfg(loop);
    if (truthy(environmentCfg)) {
      const environment = buildTableNode({
        context,
        cfg: environmentCfg,
        label: "recovery.loop.environment",
        defaultKey: loopEnvironmentKeyDefault(),
        defaultNodeId: loopEnvironmentNodeIdDefault(),
        defaultStates: DEFAULT_ENVIRONMENT_STATES,
      });
      const environmentNodeId = environment.nodeId;
      const multiplierModel = simpleMultiplierModelForEnvironment(failedCfg, environment.states);
      const { method, multiplierEnvironment } = multiplierModel;

      for (const environmentState of environment.states) {
        let previous = 1;
        for (const tHours of timeBins) {
          const q = simpleFailedProbabilityForMultiplier(
            tHours,
            mu0,
            sigma0,
            method,
            lookup(multiplierEnvironment, environmentState),
          );
          if (q > previous + 1e-12) {
            throw valueError(
              "recovery.loop.failed_by is non-monotone in time for " +
                `(environment=${environmentState}): ${floatRepr(q)} > ${floatRepr(previous)}.`,
            );
          }
          previous = q;
        }
      }

      const parentItems = sortParentItems([
        { nodeId: initialLossId, key: initialLossKeyDefault() },
        { nodeId: environmentNodeId, key: loopEnvironmentKeyDefault() },
      ]);
      if (hazardNonrecoverableParentId !== null && hazardNonrecoverableKey !== null) {
        parentItems.push({ nodeId: hazardNonrecoverableParentId, key: hazardNonrecoverableKey });
        sortParentItems(parentItems);
      }
      const failedParentIds = parentItems.map((item) => item.nodeId);
      for (const tHours of timeBins) {
        const failedKey = `${failedPrefix}.${timeLabel(tHours)}`;
        const failedNodeId = failedByNodeId(tHours);
        context.model.addNode({
          key: failedKey,
          nodeId: failedNodeId,
          states: BOOL_STATES,
          metadata: {
            builder: "recovery",
            kind: "loop_recovery_failed_by_time",
            model: "simple",
            time_hours: tHours,
            definition: failedByDefinition(hazardNonrecoverableParentId),
            true_means: "loop_not_recovered_by_time",
          },
          parentIds: failedParentIds,
          cpdGenerator: makeSimpleFailedByEnvironmentCpdGenerator({
            initialLossParentId: initialLossId,
            environmentParentId: environmentNodeId,
            hazardNonrecoverableParentId,
            hazardNonrecoverableTrueState,
            initialLossTrueState,
            initialLossFalseState,
            tHours,
            mu0,
            sigma0,
            method,
            multiplierEnvironment,
          }),
        });
        context.registry.register(failedKey, failedNodeId);
      }
    } else {
      const { pgaKey, floodKey } = simpleRecoveryParentKeys(loop, failedCfg);
      if (!context.registry.hasKey(pgaKey)) {
        throw valueError(`recovery.simple failed_by references unknown parent key '${pgaKey}'.`);
      }
      if (!context.registry.hasKey(floodKey)) {
        throw valueError(`recovery.simple failed_by references unknown parent key '${floodKey}'.`);
      }
      const pgaId = context.registry.nodeId(pgaKey);
      const floodId = context.registry.nodeId(floodKey);
      const pgaStates = context.model.node(pgaId).states;
      const floodStates = context.model.node(floodId).states;
      const multiplierModel = simpleMultiplierModel(failedCfg, pgaStates, floodStates);
      const { method, combine, multiplierSeismic, multiplierFlood, multiplierJoint } = multiplierModel;

      for (const pgaState of pgaStates) {
        for (const floodState of floodStates) {
          let previous = 1;
          for (const tHours of timeBins) {
            const q = simpleFailedProbability({
              tHours,
              mu0,
              sigma0,
              method,
              combine,
              pgaState,
              floodState,
              multiplierSeismic,
              multiplierFlood,
              multiplierJoint,
            });
            if (q > previous + 1e-12) {
              throw valueError(
                "recovery.loop.failed_by is non-monotone in time for " +
                  `(pga=${pgaState}, flood=${floodState}): ${floatRepr(q)} > ${floatRepr(previous)}.`,
              );
            }
            previous = q;
          }
        }
      }

      const parentItems = sortParentItems([
        { nodeId: initialLossId, key: initialLossKeyDefault() },
        { nodeId: pgaId, key: pgaKey },
        { nodeId: floodId, key: floodKey },
      ]);
      if (hazardNonrecoverableParentId !== null && hazardNonrecoverableKey !== null) {
        parentItems.push({ nodeId: hazardNonrecoverableParentId, key: hazardNonrecoverableKey });
        sortParentItems(parentItems);
      }
      const failedParentIds = parentItems.map((item) => item.nodeId);
      for (const tHours of timeBins) {
        const failedKey = `${failedPrefix}.${timeLabel(tHours)}`;
        const failedNodeId = failedByNodeId(tHours);
        context.model.addNode({
          key: failedKey,
          nodeId: failedNodeId,
          states: BOOL_STATES,
          metadata: {
            builder: "recovery",
            kind: "loop_recovery_failed_by_time",
            model: "simple",
            time_hours: tHours,
            definition: failedByDefinition(hazardNonrecoverableParentId),
            true_means: "loop_not_recovered_by_time",
          },
          parentIds: failedParentIds,
          cpdGenerator: makeSimpleFailedByCpdGenerator({
            initialLossParentId: initialLossId,
            pgaParentId: pgaId,
            floodParentId: floodId,
            hazardNonrecoverableParentId,
            hazardNonrecoverableTrueState,
            initialLossTrueState,
            initialLossFalseState,
            tHours,
            mu0,
            sigma0,
            method,
            combine,
            multiplierSeismic,
            multiplierFlood,
            multiplierJoint,
          }),
        });
        context.registry.register(failedKey, failedNodeId);
      }
    }

    const available = availableCfg(loop);
    if (truthy(getValueOr(available, "enabled", false))) {
      const availablePrefix = strip(text(getValueOr(available, "prefix", availableAtPrefix(loop))));
      if (availablePrefix.length === 0) {
        throw valueError("recovery.loop.available_at.prefix must be non-empty when enabled.");
      }
      for (const tHours of timeBins) {
        const failedKey = `${failedPrefix}.${timeLabel(tHours)}`;
        const failedNodeId = context.registry.nodeId(failedKey);
        const availableKey = `${availablePrefix}.${timeLabel(tHours)}`;
        const availableNodeId = availableAtNodeId(tHours);
        context.model.addNode({
          key: availableKey,
          nodeId: availableNodeId,
          states: BOOL_STATES,
          metadata: {
            builder: "recovery",
            kind: "loop_available_at_time",
            model: "simple",
            time_hours: tHours,
            definition: "NOT(loop_failed_by_t)",
            true_means: "loop_power_available_at_time",
          },
          parentIds: [failedNodeId],
          cpdGenerator: makeNotBoolCpdGenerator(failedNodeId),
        });
        context.registry.register(availableKey, availableNodeId);
      }
    }
  }

  private buildDgRecovery(context: ModelContext, dgs: readonly SpecMapping[]): void {
    for (const dgCfg of dgs) {
      const identifier = dgId(dgCfg);
      const environmentCfg = dgEnvironmentCfg(dgCfg);
      const environment = buildTableNode({
        context,
        cfg: environmentCfg,
        label: `recovery.dgs[${identifier}].environment`,
        defaultKey: dgEnvironmentKey(identifier),
        defaultNodeId: dgEnvironmentNodeId(identifier),
        defaultStates: DEFAULT_ENVIRONMENT_STATES,
      });
      const environmentNodeId = environment.nodeId;
      const environmentStates = environment.states;
      const betaMultiplier = dgBetaMultiplierByState(dgCfg, environmentCfg, environmentStates);

      const environmentOrder = dgEnvironmentOrder(dgCfg, environmentStates);
      for (let index = 1; index < environmentOrder.length; index += 1) {
        const previousState = environmentOrder[index - 1];
        const thisState = environmentOrder[index];
        const previousMultiplier = lookup(betaMultiplier, previousState);
        const thisMultiplier = lookup(betaMultiplier, thisState);
        if (thisMultiplier < previousMultiplier - 1e-12) {
          throw valueError(
            `recovery.dg.${identifier} beta_multiplier_by_state must be non-decreasing over ` +
              `environment_order; got ${previousState}=${floatRepr(previousMultiplier)} then ` +
              `${thisState}=${floatRepr(thisMultiplier)}.`,
          );
        }
      }

      const { alpha, beta } = dgWeibullParams(dgCfg, identifier);
      const timeBins = dgTimeBinsHours(dgCfg, this.config);

      let hazardParentId: string | null = null;
      const hazardCfg = dgHazardNonrecoverableCfg(dgCfg);
      const hazardEnabled = truthy(getValueOr(hazardCfg, "enabled", false));
      if (hazardEnabled) {
        const hazardKey = tableKey(hazardCfg, dgHazardNonrecoverableKey(identifier));
        const hazardNodeId = tableNodeId(hazardCfg, dgHazardNonrecoverableNodeId(identifier));
        const { anyParentKeys, allParentKeys } = dgHazardParentKeys(dgCfg);
        const parentKeysUnion = orderedUnion(anyParentKeys, allParentKeys);
        if (parentKeysUnion.length === 0) {
          throw valueError(`recovery.dgs[${identifier}].hazard_nonrecoverable requires at least one parent key.`);
        }
        for (const parentKey of parentKeysUnion) {
          if (!context.registry.hasKey(parentKey)) {
            throw valueError(
              `recovery.dgs[${identifier}].hazard_nonrecoverable references unknown ` + `parent key '${parentKey}'.`,
            );
          }
        }
        const parentItems = sortParentItems(
          parentKeysUnion.map((parentKey) => ({ nodeId: context.registry.nodeId(parentKey), key: parentKey })),
        );
        const parentIds = parentItems.map((item) => item.nodeId);
        const trueStateByParent = dgHazardTrueStateByParent(dgCfg, parentItems, context);
        context.model.addNode({
          key: hazardKey,
          nodeId: hazardNodeId,
          states: BOOL_STATES,
          metadata: {
            builder: "recovery",
            kind: "dg_hazard_nonrecoverable",
            dg_id: identifier,
            any_parent_keys: Array.from(anyParentKeys),
            all_parent_keys: Array.from(allParentKeys),
            definition: "OR(ANY(any_parent_keys), ALL(all_parent_keys))",
            true_means: "dg_hazard_damage_not_recoverable_in_mission_time",
          },
          parentIds,
          cpdGenerator: makeDgHazardNonrecoverableCpdGenerator({
            parentIds,
            anyParentKeys,
            allParentKeys,
            keyById: new Map(parentItems.map((item) => [item.nodeId, item.key])),
            trueStateByParent,
          }),
        });
        context.registry.register(hazardKey, hazardNodeId);
        hazardParentId = hazardNodeId;
      }

      for (const environmentState of environmentStates) {
        let previous = 1;
        for (const tHours of timeBins) {
          const q = dgNonRecoveryProbability(tHours, alpha, beta, lookup(betaMultiplier, environmentState));
          if (q > previous + 1e-12) {
            throw valueError(
              `recovery.dg.${identifier} non-recovery is non-monotone in time ` +
                `for env=${environmentState}: ${floatRepr(q)} > ${floatRepr(previous)}.`,
            );
          }
          previous = q;
        }
      }

      for (const tHours of timeBins) {
        const key = dgNotRecoveredKey(identifier, tHours);
        const nodeId = dgNotRecoveredNodeId(identifier, tHours);
        const parentIds = [environmentNodeId];
        if (hazardParentId !== null) parentIds.push(hazardParentId);
        context.model.addNode({
          key,
          nodeId,
          states: BOOL_STATES,
          metadata: {
            builder: "recovery",
            kind: "dg_recovery_not_recovered_by_time",
            dg_id: identifier,
            time_hours: tHours,
            weibull_alpha: alpha,
            weibull_beta: beta,
            definition: hazardParentId !== null ? "hazard_nonrecoverable OR P(T_repair > t)" : "P(T_repair > t)",
            true_means: "dg_not_recovered_by_time",
          },
          parentIds,
          cpdGenerator: makeDgNotRecoveredCpdGenerator({
            environmentParentId: environmentNodeId,
            tHours,
            alpha,
            beta,
            betaMultiplierByState: betaMultiplier,
            hazardNonrecoverableParentId: hazardParentId,
          }),
        });
        context.registry.register(key, nodeId);
      }
    }
  }
}

export { RecoveryBuilder };
