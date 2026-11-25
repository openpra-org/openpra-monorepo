import { valueError } from "../core/errors";
import {
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  keysOf,
  repr,
  strip,
  text,
  toFloat,
  truthy,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import {
  getDefaultDgWeibullParams,
  getTable7Params,
  loadAndValidatePhaseR1DgDataset,
  loadAndValidatePhaseR1LoopDataset,
} from "./recovery-data";
import {
  pairKey,
  requireFloat,
  requirePositiveFloat,
  requireText,
  resolveListText,
  slug,
  timeLabel,
  unknownKeys,
} from "./recovery-values";

interface HazardNonrecoverableParent {
  key: string | null;
  trueState: string;
}

interface HazardParentKeys {
  anyParentKeys: string[];
  allParentKeys: string[];
}

interface ParentKeyPair {
  pgaKey: string;
  floodKey: string;
}

interface BaselineLognormal {
  mu: number;
  sigma: number;
}

interface WeibullPair {
  alpha: number;
  beta: number;
}

interface SimpleMultiplierModel {
  method: string;
  combine: string;
  multiplierSeismic: Map<string, number>;
  multiplierFlood: Map<string, number>;
  multiplierJoint: Map<string, number>;
}

interface EnvironmentMultiplierModel {
  method: string;
  multiplierEnvironment: Map<string, number>;
}

const CAUSE_OR_MODELS = ["cause_or", "cause-union", "cause_union"];
const FRAGILITY_MODELS = ["fragility", "fragility_conditional"];
const TABLE_MODELS = ["", "table", "rows"];
const DEFAULT_ENVIRONMENT_STATES = ["Normal", "Degraded", "Severe"];

const lowerText = (value: SpecValue): string => strip(text(value)).toLowerCase();

const initialLossKeyDefault = (): string => "loop.failed.initial";

const initialLossNodeIdDefault = (): string => "LOOP_FAILED_INITIAL";

const loopEnvironmentKeyDefault = (): string => "recovery.loop.environment";

const loopEnvironmentNodeIdDefault = (): string => "RECOVERY_LOOP_ENVIRONMENT";

const initialLossCauseKeyDefault = (causeId: string): string => {
  const cause = strip(causeId).toLowerCase();
  if (cause === "seismic") return "loop.cause.seismic";
  if (cause === "flood_switchyard") return "loop.cause.flood_switchyard";
  if (cause === "background_gr") return "loop.cause.background_gr";
  if (cause === "hazard") return "loop.cause.hazard";
  return `loop.cause.${cause}`;
};

const initialLossCauseNodeIdDefault = (causeId: string): string => {
  const cause = strip(causeId).toLowerCase();
  if (cause === "seismic") return "LOOP_CAUSE_SEISMIC";
  if (cause === "flood_switchyard") return "LOOP_CAUSE_FLOOD_SWITCHYARD";
  if (cause === "background_gr") return "LOOP_CAUSE_BACKGROUND_GR";
  if (cause === "hazard") return "LOOP_CAUSE_HAZARD";
  return `LOOP_CAUSE_${slug(cause).toUpperCase()}`;
};

const availableAtNodeId = (tHours: number): string =>
  `RECOVERY_LOOP_AVAILABLE_AT_${slug(timeLabel(tHours)).toUpperCase()}`;

const failedByNodeId = (tHours: number): string => `RECOVERY_LOOP_FAILED_BY_${slug(timeLabel(tHours)).toUpperCase()}`;

const availableAtPrefix = (loopCfg: SpecMapping): string =>
  strip(text(getValueOr(loopCfg, "available_at_prefix", "recovery.loop.available_at")));

const failedByPrefix = (loopCfg: SpecMapping): string =>
  strip(text(getValueOr(loopCfg, "failed_by_prefix", "recovery.loop.failed_by")));

const tableKey = (cfg: SpecValue, defaultKey: string): string => {
  if (!isMapping(cfg)) return defaultKey;
  const key = strip(text(getValueOr(cfg, "key", "")));
  return key.length > 0 ? key : defaultKey;
};

const tableNodeId = (cfg: SpecValue, defaultNodeId: string): string => {
  if (!isMapping(cfg)) return defaultNodeId;
  const nodeId = strip(text(getValueOr(cfg, "node_id", "")));
  return nodeId.length > 0 ? nodeId : defaultNodeId;
};

const tableParentKeys = (cfg: SpecValue): string[] => {
  if (!isMapping(cfg)) return [];
  return resolveListText(getValue(cfg, "parent_keys"), "table.parent_keys", false);
};

const isEnabled = (config: SpecMapping): boolean => truthy(getValueOr(config, "enabled", true));

const loopCfg = (config: SpecMapping): SpecMapping => {
  const raw = getValue(config, "loop");
  if (raw === null) return {};
  if (!isMapping(raw)) throw valueError("recovery.loop must be object/mapping.");
  return raw;
};

const loopEnabled = (loop: SpecMapping): boolean => {
  if (!truthy(loop)) return false;
  return truthy(getValueOr(loop, "enabled", true));
};

const loopModel = (loop: SpecMapping): string => lowerText(getValueOr(loop, "model", "simple"));

const legacyModelError = (): Error =>
  valueError(
    "Legacy full recovery model was removed. " +
      "Use recovery.loop.model='simple'. " +
      "Archived implementation: builders/archived/recovery_full_legacy.py",
  );

const dgItems = (config: SpecMapping): SpecMapping[] => {
  const raw = getValueOr(config, "dgs", []);
  if (!isSequence(raw)) throw valueError("recovery.dgs must be list-like.");
  return raw.map((item, index) => {
    if (!isMapping(item)) throw valueError(`recovery.dgs[${index}] must be object/mapping.`);
    return item;
  });
};

const dgEnabled = (dgCfg: SpecMapping): boolean => truthy(getValueOr(dgCfg, "enabled", true));

const enabledDgItems = (config: SpecMapping): SpecMapping[] => dgItems(config).filter((item) => dgEnabled(item));

const dgId = (dgCfg: SpecMapping): string => {
  const identifier = strip(text(getValueOr(dgCfg, "id", "")));
  if (identifier.length === 0) throw valueError("recovery.dgs[].id must be non-empty.");
  return identifier;
};

const dgEnvironmentCfg = (dgCfg: SpecMapping): SpecMapping => {
  const environment = getValue(dgCfg, "environment");
  if (!isMapping(environment)) {
    throw valueError(`recovery.dgs[${dgId(dgCfg)}].environment must be object/mapping.`);
  }
  return environment;
};

const dgHazardNonrecoverableCfg = (dgCfg: SpecMapping): SpecMapping => {
  const raw = getValue(dgCfg, "hazard_nonrecoverable");
  if (raw === null) return {};
  if (!isMapping(raw)) {
    throw valueError(`recovery.dgs[${dgId(dgCfg)}].hazard_nonrecoverable must be object/mapping.`);
  }
  return raw;
};

const dgHazardParentKeys = (dgCfg: SpecMapping): HazardParentKeys => {
  const identifier = dgId(dgCfg);
  const cfg = dgHazardNonrecoverableCfg(dgCfg);
  let anyParentKeys = resolveListText(
    getValue(cfg, "any_parent_keys"),
    `recovery.dgs[${identifier}].hazard_nonrecoverable.any_parent_keys`,
    false,
  );
  const allParentKeys = resolveListText(
    getValue(cfg, "all_parent_keys"),
    `recovery.dgs[${identifier}].hazard_nonrecoverable.all_parent_keys`,
    false,
  );
  if (anyParentKeys.length === 0 && allParentKeys.length === 0) {
    const legacyParentKeys = resolveListText(
      getValue(cfg, "parent_keys"),
      `recovery.dgs[${identifier}].hazard_nonrecoverable.parent_keys`,
      false,
    );
    if (legacyParentKeys.length > 0) anyParentKeys = legacyParentKeys;
  }
  return { anyParentKeys, allParentKeys };
};

const orderedUnion = (first: readonly string[], second: readonly string[]): string[] =>
  Array.from(new Set([...first, ...second]));

const sortedTimeBins = (values: readonly number[]): number[] =>
  Array.from(values).sort((left, right) => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });

const hasNonIncreasingStep = (values: readonly number[]): boolean =>
  values.some((value, index) => index > 0 && value <= values[index - 1]);

const dgTimeBinsHours = (dgCfg: SpecMapping, config: SpecMapping): number[] => {
  let raw = getValue(dgCfg, "mission_times_hours");
  if (raw === null) raw = getValue(config, "time_bins_hours");
  if (raw === null) {
    throw valueError(
      `recovery.dgs[${dgId(dgCfg)}].mission_times_hours is required ` + "(or provide global recovery.time_bins_hours).",
    );
  }
  if (!isSequence(raw) || raw.length === 0) {
    throw valueError(`recovery.dgs[${dgId(dgCfg)}].mission_times_hours must be a non-empty list.`);
  }
  const values = raw.map((item) => toFloat(item));
  if (values.some((value) => value <= 0)) throw valueError("DG mission_times_hours values must be > 0.");
  const sorted = sortedTimeBins(values);
  if (hasNonIncreasingStep(sorted)) throw valueError("DG mission_times_hours must be strictly increasing.");
  return sorted;
};

const timeBinsHours = (loop: SpecMapping, config: SpecMapping): number[] => {
  const raw = getValueOr(loop, "time_bins_hours", getValue(config, "time_bins_hours"));
  if (raw === null) {
    throw valueError("recovery requires time_bins_hours (top-level or recovery.loop.time_bins_hours).");
  }
  if (!isSequence(raw) || raw.length === 0) throw valueError("recovery time_bins_hours must be a non-empty list.");
  const values = raw.map((item) => toFloat(item));
  if (values.some((value) => value <= 0)) throw valueError("recovery time_bins_hours values must be > 0.");
  const sorted = sortedTimeBins(values);
  if (hasNonIncreasingStep(sorted)) throw valueError("recovery time_bins_hours must be strictly increasing.");
  return sorted;
};

const dgWeibullParams = (dgCfg: SpecMapping, identifier: string): WeibullPair => {
  let sourceCfg = getValue(dgCfg, "curve_source");
  if (sourceCfg === null) sourceCfg = {};
  if (!isMapping(sourceCfg)) throw valueError(`recovery.dgs[${identifier}].curve_source must be object/mapping.`);
  const sourceKind = lowerText(getValueOr(sourceCfg, "kind", "dataset"));
  let alphaDefault: number;
  let betaDefault: number;
  if (sourceKind === "dataset") {
    const datasetPath = getValue(sourceCfg, "path");
    const curveId = getValue(sourceCfg, "curve_id");
    const data = loadAndValidatePhaseR1DgDataset(datasetPath);
    const params = getDefaultDgWeibullParams(data, curveId !== null ? strip(text(curveId)) : null);
    alphaDefault = params.alpha;
    betaDefault = params.betaHours;
  } else if (sourceKind === "inline") {
    const paramsRaw = getValue(sourceCfg, "params");
    if (!isMapping(paramsRaw)) {
      throw valueError(`recovery.dgs[${identifier}].curve_source.params must be object/mapping for kind='inline'.`);
    }
    alphaDefault = requirePositiveFloat(
      getValue(paramsRaw, "alpha"),
      `recovery.dgs[${identifier}].curve_source.params.alpha`,
    );
    betaDefault = requirePositiveFloat(
      getValueOr(paramsRaw, "beta_hours", getValue(paramsRaw, "beta")),
      `recovery.dgs[${identifier}].curve_source.params.beta_hours`,
    );
  } else {
    throw valueError(`recovery.dgs[${identifier}].curve_source.kind must be one of: dataset, inline.`);
  }
  const alpha = requirePositiveFloat(getValueOr(dgCfg, "alpha", alphaDefault), `recovery.dgs[${identifier}].alpha`);
  const beta = requirePositiveFloat(
    getValueOr(dgCfg, "beta", getValueOr(dgCfg, "beta_hours", betaDefault)),
    `recovery.dgs[${identifier}].beta`,
  );
  return { alpha, beta };
};

const dgBetaMultiplierByState = (
  dgCfg: SpecMapping,
  environmentCfg: SpecMapping,
  environmentStates: readonly string[],
): Map<string, number> => {
  let raw = getValue(dgCfg, "beta_multiplier_by_state");
  if (raw === null) raw = getValue(environmentCfg, "beta_multiplier_by_state");
  if (!isMapping(raw)) {
    throw valueError(`recovery.dgs[${dgId(dgCfg)}].beta_multiplier_by_state must be object/mapping.`);
  }
  const output = new Map<string, number>();
  for (const state of environmentStates) {
    if (!hasKey(raw, state)) {
      throw valueError(`recovery.dgs[${dgId(dgCfg)}].beta_multiplier_by_state missing state '${state}'.`);
    }
    output.set(
      state,
      requirePositiveFloat(raw[state], `recovery.dgs[${dgId(dgCfg)}].beta_multiplier_by_state[${state}]`),
    );
  }
  const extra = unknownKeys(raw, environmentStates);
  if (extra.length > 0) {
    throw valueError(`recovery.dgs[${dgId(dgCfg)}].beta_multiplier_by_state has unknown states: ` + `${repr(extra)}.`);
  }
  return output;
};

const dgEnvironmentOrder = (dgCfg: SpecMapping, environmentStates: readonly string[]): string[] => {
  const raw = getValue(dgCfg, "environment_order");
  if (raw === null) {
    if (DEFAULT_ENVIRONMENT_STATES.every((state) => environmentStates.includes(state))) {
      return Array.from(DEFAULT_ENVIRONMENT_STATES);
    }
    return [];
  }
  if (!isSequence(raw)) throw valueError(`recovery.dgs[${dgId(dgCfg)}].environment_order must be list-like.`);
  const order = raw.map((item) => strip(text(item)));
  if (order.length === 0) return [];
  if (order.length !== new Set(order).size) {
    throw valueError(`recovery.dgs[${dgId(dgCfg)}].environment_order contains duplicates.`);
  }
  const unlisted = order.filter((state) => !environmentStates.includes(state));
  if (unlisted.length > 0) {
    throw valueError(`recovery.dgs[${dgId(dgCfg)}].environment_order references unknown states: ${repr(unlisted)}`);
  }
  return order;
};

const dgNodeToken = (identifier: string): string => {
  const token = slug(identifier).toUpperCase();
  if (token.startsWith("DG_")) return token;
  return `DG_${token}`;
};

const dgEnvironmentKey = (identifier: string): string => `recovery.dg.${identifier}.environment`;

const dgEnvironmentNodeId = (identifier: string): string => `RECOVERY_${dgNodeToken(identifier)}_ENVIRONMENT`;

const dgHazardNonrecoverableKey = (identifier: string): string => `recovery.dg.${identifier}.hazard_nonrecoverable`;

const dgHazardNonrecoverableNodeId = (identifier: string): string =>
  `RECOVERY_${dgNodeToken(identifier)}_HAZARD_NONRECOVERABLE`;

const dgNotRecoveredKey = (identifier: string, tHours: number): string =>
  `recovery.dg.${identifier}.not_recovered_by.${timeLabel(tHours)}`;

const dgNotRecoveredNodeId = (identifier: string, tHours: number): string =>
  `RECOVERY_${dgNodeToken(identifier)}_` + `NOT_RECOVERED_BY_${slug(timeLabel(tHours)).toUpperCase()}`;

const availableCfg = (loop: SpecMapping): SpecMapping => {
  const raw = getValueOr(loop, "available_at", {});
  if (raw === null) return {};
  if (!isMapping(raw)) throw valueError("recovery.loop.available_at must be object/mapping.");
  return raw;
};

const loopEnvironmentCfg = (loop: SpecMapping): SpecMapping => {
  const raw = getValue(loop, "environment");
  if (raw === null) return {};
  if (!isMapping(raw)) throw valueError("recovery.loop.environment must be object/mapping.");
  return raw;
};

const initialLossCfg = (loop: SpecMapping): SpecMapping => {
  const raw = getValue(loop, "initial_loss");
  if (raw === null) return {};
  if (!isMapping(raw)) throw valueError("recovery.loop.initial_loss must be object/mapping.");
  return raw;
};

const simpleFailedByCfg = (loop: SpecMapping): SpecMapping => {
  const raw = getValueOr(loop, "failed_by", {});
  if (raw === null) return {};
  if (!isMapping(raw)) throw valueError("recovery.loop.failed_by must be object/mapping when provided.");
  return raw;
};

const hazardNonrecoverableParentCfg = (failedCfg: SpecMapping): HazardNonrecoverableParent => {
  const key = strip(text(getValueOr(failedCfg, "hazard_nonrecoverable_parent_key", "")));
  if (key.length === 0) return { key: null, trueState: "True" };
  const trueState = strip(text(getValueOr(failedCfg, "hazard_nonrecoverable_true_state", "True")));
  return { key, trueState: trueState.length > 0 ? trueState : "True" };
};

const parentKeyPairFrom = (seismic: SpecValue, flood: SpecValue): ParentKeyPair | null => {
  if (!isMapping(seismic) || !isMapping(flood)) return null;
  const seismicKey = strip(text(getValueOr(seismic, "parent_key", "")));
  const floodKey = strip(text(getValueOr(flood, "parent_key", "")));
  if (seismicKey.length > 0 && floodKey.length > 0) return { pgaKey: seismicKey, floodKey };
  return null;
};

const simpleRecoveryParentKeys = (loop: SpecMapping, failedCfg: SpecMapping): ParentKeyPair => {
  const keys = resolveListText(getValue(failedCfg, "parent_keys"), "recovery.loop.failed_by.parent_keys", false);
  if (keys.length >= 2) return { pgaKey: keys[0], floodKey: keys[1] };
  const initialCfg = initialLossCfg(loop);
  if (truthy(initialCfg)) {
    const modelKind = lowerText(getValueOr(initialCfg, "model", "table"));
    if (FRAGILITY_MODELS.includes(modelKind)) {
      const pair = parentKeyPairFrom(getValue(initialCfg, "seismic"), getValue(initialCfg, "flood"));
      if (pair !== null) return pair;
    }
    if (CAUSE_OR_MODELS.includes(modelKind)) {
      const causes = getValue(initialCfg, "causes");
      if (isMapping(causes)) {
        const pair = parentKeyPairFrom(getValue(causes, "seismic"), getValue(causes, "flood_switchyard"));
        if (pair !== null) return pair;
      }
    }
    const parentKeys = resolveListText(
      getValue(initialCfg, "parent_keys"),
      "recovery.loop.initial_loss.parent_keys",
      false,
    );
    if (parentKeys.length >= 2) return { pgaKey: parentKeys[0], floodKey: parentKeys[1] };
  }
  throw valueError(
    "recovery.loop.failed_by.parent_keys must specify [PGA_key, flood_depth_key], " +
      "or they must be inferable from recovery.loop.initial_loss.",
  );
};

const datasetLognormal = (path: SpecValue, category: string): BaselineLognormal => {
  const data = loadAndValidatePhaseR1LoopDataset(path);
  const params = getTable7Params(data, [category]).get(category);
  if (params === undefined) throw valueError(`Category '${category}' not found in table_7_fitted_lognormal.`);
  return { mu: params.mu, sigma: params.sigma };
};

const simpleBaselineLognormal = (failedCfg: SpecMapping): BaselineLognormal => {
  const source = getValue(failedCfg, "baseline_source");
  if (source === null) return datasetLognormal(null, "SC");
  if (!isMapping(source)) throw valueError("recovery.loop.failed_by.baseline_source must be object/mapping.");
  const kind = lowerText(getValueOr(source, "kind", "dataset"));
  if (kind === "dataset") {
    const category = strip(text(getValueOr(source, "category", "SC"))).toUpperCase();
    return datasetLognormal(getValue(source, "path"), category);
  }
  if (kind === "inline") {
    const params = getValue(source, "params");
    if (!isMapping(params)) {
      throw valueError("recovery.loop.failed_by.baseline_source.params must be object/mapping.");
    }
    const mu = requireFloat(getValue(params, "mu"), "recovery.loop.failed_by.baseline_source.params.mu");
    const sigma = requirePositiveFloat(
      getValue(params, "sigma"),
      "recovery.loop.failed_by.baseline_source.params.sigma",
    );
    return { mu, sigma };
  }
  throw valueError("recovery.loop.failed_by.baseline_source.kind must be 'dataset' or 'inline'.");
};

const multiplierCfg = (failedCfg: SpecMapping): SpecMapping => {
  let raw = getValueOr(failedCfg, "multiplier", {});
  if (raw === null) raw = {};
  if (!isMapping(raw)) throw valueError("recovery.loop.failed_by.multiplier must be object/mapping.");
  return raw;
};

const multiplierMethod = (raw: SpecMapping): string => {
  const method = lowerText(getValueOr(raw, "method", "time_multiplier"));
  if (method !== "time_multiplier" && method !== "mu_shift") {
    throw valueError("recovery.loop.failed_by.multiplier.method must be 'time_multiplier' or 'mu_shift'.");
  }
  return method;
};

const stateMultiplierMap = (rawMap: SpecValue, label: string, states: readonly string[]): Map<string, number> => {
  if (!isMapping(rawMap)) throw valueError(`${label} must be state->value mapping.`);
  const output = new Map<string, number>();
  for (const state of states) {
    if (!hasKey(rawMap, state)) throw valueError(`${label} missing state '${state}'.`);
    output.set(state, requirePositiveFloat(rawMap[state], `${label}[${state}]`));
  }
  const extra = unknownKeys(rawMap, states);
  if (extra.length > 0) throw valueError(`${label} contains unknown states: ${repr(extra)}.`);
  return output;
};

const simpleMultiplierModel = (
  failedCfg: SpecMapping,
  pgaStates: readonly string[],
  floodStates: readonly string[],
): SimpleMultiplierModel => {
  const raw = multiplierCfg(failedCfg);
  const method = multiplierMethod(raw);
  const combine = lowerText(getValueOr(raw, "combine", "product"));
  if (combine !== "product" && combine !== "max" && combine !== "sum_minus_one") {
    throw valueError("recovery.loop.failed_by.multiplier.combine must be one of: " + "product, max, sum_minus_one.");
  }
  const multiplierSeismic = stateMultiplierMap(
    getValueOr(raw, "seismic_by_state", {}),
    "multiplier.seismic_by_state",
    pgaStates,
  );
  const multiplierFlood = stateMultiplierMap(
    getValueOr(raw, "flood_by_state", {}),
    "multiplier.flood_by_state",
    floodStates,
  );
  let jointRaw = getValueOr(raw, "joint_by_pair", {});
  if (jointRaw === null) jointRaw = {};
  if (!isMapping(jointRaw)) throw valueError("multiplier.joint_by_pair must be object/mapping when provided.");
  const multiplierJoint = new Map<string, number>();
  for (const key of keysOf(jointRaw)) {
    const parts = key.split("|");
    if (parts.length !== 2) {
      throw valueError("multiplier.joint_by_pair keys must be formatted as 'PGA_STATE|FLOOD_STATE'.");
    }
    const pgaState = strip(parts[0]);
    const floodState = strip(parts[1]);
    if (!pgaStates.includes(pgaState)) throw valueError(`multiplier.joint_by_pair unknown PGA state '${pgaState}'.`);
    if (!floodStates.includes(floodState)) {
      throw valueError(`multiplier.joint_by_pair unknown flood state '${floodState}'.`);
    }
    multiplierJoint.set(
      pairKey(pgaState, floodState),
      requirePositiveFloat(jointRaw[key], `multiplier.joint_by_pair[${key}]`),
    );
  }
  return { method, combine, multiplierSeismic, multiplierFlood, multiplierJoint };
};

const simpleMultiplierModelForEnvironment = (
  failedCfg: SpecMapping,
  environmentStates: readonly string[],
): EnvironmentMultiplierModel => {
  const raw = multiplierCfg(failedCfg);
  const method = multiplierMethod(raw);
  const rawMap = getValue(raw, "environment_by_state");
  if (!isMapping(rawMap)) {
    throw valueError(
      "recovery.loop.failed_by.multiplier.environment_by_state must be state->value mapping " +
        "when recovery.loop.environment is configured.",
    );
  }
  const multiplierEnvironment = new Map<string, number>();
  for (const state of environmentStates) {
    if (!hasKey(rawMap, state)) {
      throw valueError(`recovery.loop.failed_by.multiplier.environment_by_state missing state '${state}'.`);
    }
    multiplierEnvironment.set(
      state,
      requirePositiveFloat(rawMap[state], `recovery.loop.failed_by.multiplier.environment_by_state[${state}]`),
    );
  }
  const extra = unknownKeys(rawMap, environmentStates);
  if (extra.length > 0) {
    throw valueError(
      "recovery.loop.failed_by.multiplier.environment_by_state contains unknown states: " + `${repr(extra)}.`,
    );
  }
  return { method, multiplierEnvironment };
};

const initialLossParentKeys = (cfg: SpecMapping): string[] => {
  const modelKind = lowerText(getValueOr(cfg, "model", "table"));
  if (TABLE_MODELS.includes(modelKind)) return tableParentKeys(cfg);
  if (CAUSE_OR_MODELS.includes(modelKind)) {
    const causes = getValue(cfg, "causes");
    if (!isMapping(causes)) {
      throw valueError("recovery.loop.initial_loss.causes must be object/mapping for cause_or.");
    }
    const seismic = getValue(causes, "seismic");
    const flood = getValue(causes, "flood_switchyard");
    if (!isMapping(seismic)) throw valueError("recovery.loop.initial_loss.causes.seismic must be object/mapping.");
    if (!isMapping(flood)) {
      throw valueError("recovery.loop.initial_loss.causes.flood_switchyard must be object/mapping.");
    }
    const seismicKey = strip(text(getValueOr(seismic, "parent_key", "")));
    const floodKey = strip(text(getValueOr(flood, "parent_key", "")));
    if (seismicKey.length === 0) {
      throw valueError("recovery.loop.initial_loss.causes.seismic.parent_key is required.");
    }
    if (floodKey.length === 0) {
      throw valueError("recovery.loop.initial_loss.causes.flood_switchyard.parent_key is required.");
    }
    return [seismicKey, floodKey];
  }
  const keys = resolveListText(getValue(cfg, "parent_keys"), "recovery.loop.initial_loss.parent_keys", false);
  const seismicCfg = getValue(cfg, "seismic");
  if (isMapping(seismicCfg)) {
    const seismicKey = strip(text(getValueOr(seismicCfg, "parent_key", "")));
    if (seismicKey.length > 0) keys.push(seismicKey);
  }
  const floodCfg = getValue(cfg, "flood");
  if (isMapping(floodCfg)) {
    const floodKey = strip(text(getValueOr(floodCfg, "parent_key", "")));
    if (floodKey.length > 0) keys.push(floodKey);
  }
  return Array.from(new Set(keys));
};

const initialLossInternalKeys = (cfg: SpecMapping): Set<string> => {
  const modelKind = lowerText(getValueOr(cfg, "model", "table"));
  const output = new Set<string>();
  if (!CAUSE_OR_MODELS.includes(modelKind)) return output;
  const causes = getValue(cfg, "causes");
  for (const causeId of ["seismic", "flood_switchyard", "background_gr"]) {
    const raw = isMapping(causes) ? getValue(causes, causeId) : {};
    const cfgMap = isMapping(raw) ? raw : {};
    output.add(tableKey(cfgMap, initialLossCauseKeyDefault(causeId)));
  }
  const hazardUnionRaw = getValue(cfg, "hazard_union");
  if (isMapping(hazardUnionRaw) && truthy(getValueOr(hazardUnionRaw, "enabled", false))) {
    output.add(tableKey(hazardUnionRaw, initialLossCauseKeyDefault("hazard")));
  }
  return output;
};

const initialLossKeyExternal = (loop: SpecMapping): string =>
  requireText(getValueOr(loop, "initial_loss_key", initialLossKeyDefault()), "recovery.loop.initial_loss_key");

export type { BaselineLognormal, HazardParentKeys, ParentKeyPair };
export {
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
};
