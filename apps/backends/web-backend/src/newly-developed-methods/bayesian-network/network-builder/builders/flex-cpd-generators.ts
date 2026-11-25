import type { ModelContext } from "../core/context";
import { NetworkBuilderError, keyError, valueError } from "../core/errors";
import { errorFunction } from "../core/math-functions";
import type { CpdGenerator, NodeRecord } from "../core/model";
import { decodeRowIndex, repeat, repr, strip, toFloat, tupleRepr } from "../core/spec-values";

interface Fragility {
  theta: number;
  beta: number;
}

type StateNumbers = ReadonlyMap<string, number>;

interface HazardFailureInput {
  pgaKey: string | null;
  pgaStateValues: StateNumbers;
  pgaNoneLabel: string;
  pgaFragility: Fragility | null;
  pgaFailGivenState: StateNumbers | null;
  floodParentKey: string | null;
  floodNoneLabel: string;
  floodFragility: Fragility | null;
  floodFailGivenState: StateNumbers | null;
  floodStateValues: StateNumbers | null;
  baselineFailProb: number;
  combineMode: string;
  probFloor: number;
  probCap: number;
  allowExtraParents: boolean;
}

interface EquipmentUnavailableInput extends HazardFailureInput {
  storageParentKey: string | null;
  storageFailureUnavailabilityProb: number;
}

interface ConnectFailureInput {
  transportFailedKey: string;
  hookupInaccessibleKey: string | null;
  hfeFailedKeys: readonly string[];
  failIfReady: number;
  failIfTransportFailed: number;
  failIfHookupInaccessible: number;
  failIfHfeFailed: number;
  allowExtraParents: boolean;
}

interface TransportFailureInput {
  retrieveFailedKey: string;
  accessFailedKey: string;
  hfeFailedKeys: readonly string[];
  failIfAccessOpen: number;
  failIfAccessFailed: number;
  failIfRetrieveFailed: number;
  failIfHfeFailed: number;
  allowExtraParents: boolean;
}

interface RetrieveFailureInput {
  equipmentUnavailableKey: string | null;
  accessFailedKey: string;
  hfeFailedKeys: readonly string[];
  failIfAccessOpen: number;
  failIfAccessFailed: number;
  failIfEquipmentUnavailable: number;
  failIfHfeFailed: number;
  allowExtraParents: boolean;
}

interface SingleParentFailureInput {
  parentKey: string;
  failParentFalse: number;
  failParentTrue: number;
  allowExtraParents: boolean;
}

interface StartRunFailureInput {
  equipmentUnavailableKey: string;
  connectFailedKey: string;
  hfeFailedKeys: readonly string[];
  failIfReady: number;
  failIfEquipmentUnavailable: number;
  failIfConnectFailed: number;
  failIfBothFailed: number;
  failIfHfeFailed: number;
  allowExtraParents: boolean;
}

interface StartRunFailureLogisticsInput {
  connectFailedKey: string;
  hfeFailedKeys: readonly string[];
  failIfReady: number;
  failIfConnectFailed: number;
  failIfHfeFailed: number;
  allowExtraParents: boolean;
}

interface GateFailureInput {
  parentKeys: readonly string[];
  gateMode: string;
  allowExtraParents: boolean;
}

interface IdheasContextInput {
  parentKeys: readonly string[];
  comboToProbs: ReadonlyMap<string, readonly number[]>;
  allowExtraParents: boolean;
}

interface IdheasContextHazardMultiplierInput {
  parentKeys: readonly string[];
  baselineProbs: readonly number[];
  degradedProbs: readonly number[] | null;
  severeProbs: readonly number[];
  combineMode: string;
  probFloor: number;
  probCap: number;
  stateFailByParent: ReadonlyMap<string, StateNumbers>;
  weightByParent: StateNumbers;
  allowExtraParents: boolean;
}

interface IdheasHfeSelectorInput {
  parentKeys: readonly string[];
  comboToFail: ReadonlyMap<string, number>;
  allowExtraParents: boolean;
}

const normalCdf = (z: number): number => 0.5 * (1 + errorFunction(z / Math.sqrt(2)));

const comboKey = (combo: readonly string[]): string => JSON.stringify(combo);

const larger = (left: number, right: number): number => (right > left ? right : left);

const smaller = (left: number, right: number): number => (right < left ? right : left);

const largest = (values: readonly number[]): number => {
  let output = values[0];
  for (let index = 1; index < values.length; index += 1) output = larger(output, values[index]);
  return output;
};

const logarithm = (value: number): number => {
  if (value <= 0) throw valueError("math domain error");
  return Math.log(value);
};

const mapItem = (mapping: StateNumbers, key: string): number => {
  const value = mapping.get(key);
  if (value === undefined) throw keyError(key);
  return value;
};

const clamp01 = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const floatSum = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  let total = 0 + values[0];
  let compensation = 0;
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    const next = total + value;
    if (Math.abs(total) >= Math.abs(value)) compensation += total - next + value;
    else compensation += value - next + total;
    total = next;
  }
  if (compensation !== 0 && Number.isFinite(compensation)) total += compensation;
  return total;
};

const combineFailureProbs = (probs: readonly number[], mode: string): number => {
  const values = probs.map((probability) => clamp01(probability));
  if (mode === "max") return values.length > 0 ? largest(values) : 0;
  if (mode === "additive_clipped") return clamp01(floatSum(values));
  let survive = 1;
  for (const value of values) survive *= 1 - value;
  return clamp01(1 - survive);
};

const fragilityProbability = (imValue: number, theta: number, beta: number): number => {
  const z = logarithm(imValue / theta) / beta;
  return clamp01(normalCdf(z));
};

const resolveFloodStateNumericValue = (state: string, stateValues: StateNumbers | null): number => {
  if (stateValues !== null) {
    const value = stateValues.get(state);
    if (value === undefined) throw valueError(`Missing flood state value for '${state}'.`);
    return value;
  }
  try {
    return toFloat(state);
  } catch (error) {
    if (error instanceof NetworkBuilderError) {
      throw valueError(`Cannot infer numeric value for flood state '${state}'. Provide flood_state_values mapping.`);
    }
    throw error;
  }
};

const blendProbVectors = (left: readonly number[], right: readonly number[], t: number): number[] => {
  if (left.length !== right.length) {
    throw valueError("Cannot blend probability vectors with different lengths.");
  }
  const alpha = clamp01(t);
  const values = left.map((item, index) => (1 - alpha) * item + alpha * right[index]);
  const total = floatSum(values);
  if (total <= 0) throw valueError("Invalid blended probability vector with non-positive sum.");
  return values.map((value) => value / total);
};

const isBinary = (states: readonly string[]): boolean => states.includes("False") && states.includes("True");

const makeIdheasContextCpdGenerator = (input: IdheasContextInput): CpdGenerator => {
  const frozenParentKeys = Array.from(input.parentKeys);
  const frozenComboToProbs = new Map<string, number[]>();
  input.comboToProbs.forEach((value, key) => frozenComboToProbs.set(key, Array.from(value)));
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const expectedIds = frozenParentKeys.map((key) => localContext.registry.nodeId(key));
    const expectedSet = new Set(expectedIds);
    for (const parentId of expectedIds) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expectedSet.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const combo: string[] = [];
      for (const parentId of expectedIds) {
        const parentPosition = node.parents.indexOf(parentId);
        const parentStates = localContext.model.node(parentId).states;
        combo.push(parentStates[indices[parentPosition]]);
      }
      const probs = frozenComboToProbs.get(comboKey(combo));
      if (probs === undefined) {
        throw valueError(`Node '${node.nodeId}' has unmapped parent combination ${tupleRepr(combo)}.`);
      }
      if (probs.length !== node.states.length) {
        throw valueError(
          `Node '${node.nodeId}' expected probability length ${node.states.length}, got ${probs.length}.`,
        );
      }
      for (const probability of probs) output.push(probability);
    }
    return output;
  };
};

const makeIdheasContextHazardMultiplierCpdGenerator = (input: IdheasContextHazardMultiplierInput): CpdGenerator => {
  const frozenParentKeys = Array.from(input.parentKeys);
  const frozenBaseline = Array.from(input.baselineProbs);
  const frozenDegraded = input.degradedProbs !== null ? Array.from(input.degradedProbs) : null;
  const frozenSevere = Array.from(input.severeProbs);
  const frozenMode = strip(input.combineMode).toLowerCase();
  const frozenFloor = input.probFloor;
  const frozenCap = input.probCap;
  const frozenStateFail = new Map<string, Map<string, number>>();
  input.stateFailByParent.forEach((value, key) => frozenStateFail.set(key, new Map(value)));
  const frozenWeights = new Map(input.weightByParent);
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const expectedIds = frozenParentKeys.map((key) => localContext.registry.nodeId(key));
    const expectedSet = new Set(expectedIds);
    for (const parentId of expectedIds) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expectedSet.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const components: number[] = [];
      frozenParentKeys.forEach((parentKey, keyIndex) => {
        const parentId = expectedIds[keyIndex];
        const parentPosition = node.parents.indexOf(parentId);
        const parentStates = localContext.model.node(parentId).states;
        const state = parentStates[indices[parentPosition]];
        const stateFail = frozenStateFail.get(parentKey);
        const fail = stateFail === undefined ? undefined : stateFail.get(state);
        if (fail === undefined) {
          throw valueError(
            `Node '${node.nodeId}' has no hazard multiplier mapping for ` + `parent '${parentKey}' state '${state}'.`,
          );
        }
        components.push(clamp01(fail * (frozenWeights.get(parentKey) ?? 1)));
      });

      let total = combineFailureProbs(components, frozenMode);
      total = smaller(frozenCap, larger(frozenFloor, clamp01(total)));
      let probs: number[];
      if (frozenDegraded === null) {
        probs = blendProbVectors(frozenBaseline, frozenSevere, total);
      } else if (total <= 0.5) {
        probs = blendProbVectors(frozenBaseline, frozenDegraded, total * 2);
      } else {
        probs = blendProbVectors(frozenDegraded, frozenSevere, (total - 0.5) * 2);
      }
      for (const probability of probs) output.push(probability);
    }
    return output;
  };
};

const makeIdheasHfeSelectorCpdGenerator = (input: IdheasHfeSelectorInput): CpdGenerator => {
  const frozenParentKeys = Array.from(input.parentKeys);
  const frozenComboToFail = new Map(input.comboToFail);
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const expectedIds = frozenParentKeys.map((key) => localContext.registry.nodeId(key));
    const expectedSet = new Set(expectedIds);
    for (const parentId of expectedIds) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expectedSet.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const combo: string[] = [];
      for (const parentId of expectedIds) {
        const parentPosition = node.parents.indexOf(parentId);
        const parentStates = localContext.model.node(parentId).states;
        combo.push(parentStates[indices[parentPosition]]);
      }
      const fail = frozenComboToFail.get(comboKey(combo));
      if (fail === undefined) {
        throw valueError(`Node '${node.nodeId}' missing HFE selector mapping for combo ${tupleRepr(combo)}.`);
      }
      const q = clamp01(fail);
      output.push(1 - q, q);
    }
    return output;
  };
};

const makeConstantFailureCpdGenerator = (failProbability: number, allowExtraParents: boolean): CpdGenerator => {
  const q = clamp01(failProbability);
  const frozenAllowExtra = allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    if (!frozenAllowExtra && node.parents.length > 0) {
      throw valueError(
        `Node '${node.nodeId}' has unexpected parents ${repr(node.parents)}. ` +
          "Set allow_extra_parents=true to permit this.",
      );
    }
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    return repeat([1 - q, q], rows);
  };
};

const makeHazardFailureCpdGenerator = (input: HazardFailureInput): CpdGenerator => {
  const frozenPgaKey = input.pgaKey;
  const frozenPgaValues = new Map(input.pgaStateValues);
  const frozenPgaNone = input.pgaNoneLabel;
  const frozenPgaFragility = input.pgaFragility;
  const frozenPgaGiven = input.pgaFailGivenState !== null ? new Map(input.pgaFailGivenState) : null;
  const frozenFloodKey = input.floodParentKey;
  const frozenFloodNone = input.floodNoneLabel;
  const frozenFloodFragility = input.floodFragility;
  const frozenFloodGiven = input.floodFailGivenState !== null ? new Map(input.floodFailGivenState) : null;
  const frozenFloodValues = input.floodStateValues !== null ? new Map(input.floodStateValues) : null;
  const frozenBase = input.baselineFailProb;
  const frozenMode = input.combineMode;
  const frozenFloor = input.probFloor;
  const frozenCap = input.probCap;
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const expected = new Set<string>();
    let pgaParentId: string | null = null;
    let floodParentId: string | null = null;

    if (frozenPgaKey !== null) {
      pgaParentId = localContext.registry.nodeId(frozenPgaKey);
      if (!node.parents.includes(pgaParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required PGA parent '${pgaParentId}'.`);
      }
      expected.add(pgaParentId);
    }

    if (frozenFloodKey !== null) {
      floodParentId = localContext.registry.nodeId(frozenFloodKey);
      if (!node.parents.includes(floodParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required flood parent '${floodParentId}'.`);
      }
      expected.add(floodParentId);
    }

    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expected.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];

    const pgaPosition = pgaParentId !== null ? node.parents.indexOf(pgaParentId) : -1;
    const floodPosition = floodParentId !== null ? node.parents.indexOf(floodParentId) : -1;
    const pgaStates = pgaParentId !== null ? localContext.model.node(pgaParentId).states : [];
    const floodStates = floodParentId !== null ? localContext.model.node(floodParentId).states : [];

    if (frozenPgaGiven !== null) {
      const missing = pgaStates.filter((state) => !frozenPgaGiven.has(state));
      if (missing.length > 0) {
        throw valueError(`Node '${node.nodeId}' missing pga_fail_given_state for states ${repr(missing)}.`);
      }
    }
    if (frozenFloodGiven !== null) {
      const missing = floodStates.filter((state) => !frozenFloodGiven.has(state));
      if (missing.length > 0) {
        throw valueError(`Node '${node.nodeId}' missing flood_fail_given_state for states ${repr(missing)}.`);
      }
    }

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const components: number[] = [frozenBase];

      if (pgaParentId !== null) {
        const pgaState = pgaStates[indices[pgaPosition]];
        let pgaFail = 0;
        if (pgaState !== frozenPgaNone) {
          if (frozenPgaGiven !== null) {
            pgaFail = clamp01(mapItem(frozenPgaGiven, pgaState));
          } else if (frozenPgaFragility !== null) {
            const pgaValue = frozenPgaValues.get(pgaState);
            if (pgaValue === undefined) {
              throw valueError(`Node '${node.nodeId}' missing PGA numeric value for state '${pgaState}'.`);
            }
            pgaFail = fragilityProbability(pgaValue, frozenPgaFragility.theta, frozenPgaFragility.beta);
          }
        }
        components.push(pgaFail);
      }

      if (floodParentId !== null) {
        const floodState = floodStates[indices[floodPosition]];
        let floodFail = 0;
        if (floodState !== frozenFloodNone) {
          if (frozenFloodGiven !== null) {
            floodFail = clamp01(mapItem(frozenFloodGiven, floodState));
          } else if (frozenFloodFragility !== null) {
            const floodValue = resolveFloodStateNumericValue(floodState, frozenFloodValues);
            floodFail = fragilityProbability(floodValue, frozenFloodFragility.theta, frozenFloodFragility.beta);
          }
        }
        components.push(floodFail);
      }

      let total = combineFailureProbs(components, frozenMode);
      total = smaller(frozenCap, larger(frozenFloor, clamp01(total)));
      output.push(1 - total, total);
    }

    return output;
  };
};

const makeEquipmentUnavailableCpdGenerator = (input: EquipmentUnavailableInput): CpdGenerator => {
  const frozenStorageKey = input.storageParentKey;
  const frozenStorageFail = input.storageFailureUnavailabilityProb;
  const pgaKey = input.pgaKey;
  const floodParentKey = input.floodParentKey;

  const baseGenerator = makeHazardFailureCpdGenerator({
    pgaKey: input.pgaKey,
    pgaStateValues: input.pgaStateValues,
    pgaNoneLabel: input.pgaNoneLabel,
    pgaFragility: input.pgaFragility,
    pgaFailGivenState: input.pgaFailGivenState,
    floodParentKey: input.floodParentKey,
    floodNoneLabel: input.floodNoneLabel,
    floodFragility: input.floodFragility,
    floodFailGivenState: input.floodFailGivenState,
    floodStateValues: input.floodStateValues,
    baselineFailProb: input.baselineFailProb,
    combineMode: input.combineMode,
    probFloor: input.probFloor,
    probCap: input.probCap,
    allowExtraParents: true,
  });
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const base = Array.from(baseGenerator(localContext, node));

    const expected = new Set<string>();
    if (frozenStorageKey !== null) {
      const storageParentId = localContext.registry.nodeId(frozenStorageKey);
      if (!node.parents.includes(storageParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required storage parent '${storageParentId}'.`);
      }
      expected.add(storageParentId);
      const storageStates = localContext.model.node(storageParentId).states;
      const dims = node.parents.map((parentId) => localContext.model.card(parentId));
      const rows = localContext.model.parentConfigurationCount(node.nodeId);
      const childCard = node.states.length;
      const storagePosition = node.parents.indexOf(storageParentId);
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const indices = decodeRowIndex(rowIndex, dims);
        const storageState = storageStates[indices[storagePosition]];
        if (storageState === "True") {
          const current = base[rowIndex * childCard + 1];
          const updated = clamp01(combineFailureProbs([current, frozenStorageFail], "noisy_or_independent"));
          base[rowIndex * childCard + 0] = 1 - updated;
          base[rowIndex * childCard + 1] = updated;
        }
      }
    }

    if (!frozenAllowExtra) {
      const hazardExpected = new Set(expected);
      if (pgaKey !== null) hazardExpected.add(localContext.registry.nodeId(pgaKey));
      if (floodParentKey !== null) hazardExpected.add(localContext.registry.nodeId(floodParentKey));
      const extras = node.parents.filter((parentId) => !hazardExpected.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    return base;
  };
};

const makeConnectFailureCpdGenerator = (input: ConnectFailureInput): CpdGenerator => {
  const readyFail = input.failIfReady;
  const transportFail = input.failIfTransportFailed;
  const hookupFail = input.failIfHookupInaccessible;
  const hfeFail = input.failIfHfeFailed;
  const frozenTransportKey = input.transportFailedKey;
  const frozenHookupKey =
    input.hookupInaccessibleKey !== null && input.hookupInaccessibleKey.length > 0 ? input.hookupInaccessibleKey : null;
  const frozenHfeKeys = Array.from(input.hfeFailedKeys);
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const transportParentId = localContext.registry.nodeId(frozenTransportKey);
    if (!node.parents.includes(transportParentId)) {
      throw valueError(`Node '${node.nodeId}' missing required transport parent '${transportParentId}'.`);
    }

    let hookupParentId: string | null = null;
    if (frozenHookupKey !== null) {
      hookupParentId = localContext.registry.nodeId(frozenHookupKey);
      if (!node.parents.includes(hookupParentId)) {
        throw valueError(`Node '${node.nodeId}' missing required hookup/access parent '${hookupParentId}'.`);
      }
    }

    const hfeParentIds = frozenHfeKeys.map((key) => localContext.registry.nodeId(key));
    for (const parentId of hfeParentIds) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required HFE parent '${parentId}'.`);
      }
    }

    const expected = new Set<string>([transportParentId]);
    if (hookupParentId !== null) expected.add(hookupParentId);
    for (const parentId of hfeParentIds) expected.add(parentId);
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expected.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const transportStates = localContext.model.node(transportParentId).states;
    if (!isBinary(transportStates)) {
      throw valueError(`Node '${node.nodeId}' expected binary transport parent states ['False','True'].`);
    }

    let hookupStates: string[] = [];
    if (hookupParentId !== null) {
      hookupStates = localContext.model.node(hookupParentId).states;
      if (!isBinary(hookupStates)) {
        throw valueError(`Node '${node.nodeId}' expected binary hookup/access parent states ['False','True'].`);
      }
    }
    for (const parentId of hfeParentIds) {
      if (!isBinary(localContext.model.node(parentId).states)) {
        throw valueError(
          `Node '${node.nodeId}' expected binary HFE parent states ['False','True'] for parent '${parentId}'.`,
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const transportPosition = node.parents.indexOf(transportParentId);
    const hookupPosition = hookupParentId !== null ? node.parents.indexOf(hookupParentId) : -1;
    const hfePositions = hfeParentIds.map((parentId) => node.parents.indexOf(parentId));
    const hfeStates = hfeParentIds.map((parentId) => localContext.model.node(parentId).states);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const transportFailed = transportStates[indices[transportPosition]] === "True";
      const hookupInaccessible = hookupParentId !== null && hookupStates[indices[hookupPosition]] === "True";
      const anyHfeFailed = hfeStates.some((states, index) => states[indices[hfePositions[index]]] === "True");

      let q: number;
      if (transportFailed) q = transportFail;
      else if (hookupInaccessible) q = hookupFail;
      else q = readyFail;
      if (anyHfeFailed) q = larger(q, hfeFail);
      q = clamp01(q);
      output.push(1 - q, q);
    }
    return output;
  };
};

const makeTransportFailureCpdGenerator = (input: TransportFailureInput): CpdGenerator => {
  const accessOpenFail = input.failIfAccessOpen;
  const accessFailedFail = input.failIfAccessFailed;
  const retrieveFailedFail = input.failIfRetrieveFailed;
  const hfeFail = input.failIfHfeFailed;
  const frozenRetrieveKey = input.retrieveFailedKey;
  const frozenAccessKey = input.accessFailedKey;
  const frozenHfeKeys = Array.from(input.hfeFailedKeys);
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const retrieveParentId = localContext.registry.nodeId(frozenRetrieveKey);
    const accessParentId = localContext.registry.nodeId(frozenAccessKey);
    const hfeParentIds = frozenHfeKeys.map((key) => localContext.registry.nodeId(key));
    const expected = new Set<string>([retrieveParentId, accessParentId, ...hfeParentIds]);

    for (const parentId of expected) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expected.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const retrieveStates = localContext.model.node(retrieveParentId).states;
    const accessStates = localContext.model.node(accessParentId).states;
    if (!isBinary(retrieveStates)) {
      throw valueError(`Node '${node.nodeId}' expected binary retrieve parent states ['False','True'].`);
    }
    if (!isBinary(accessStates)) {
      throw valueError(`Node '${node.nodeId}' expected binary access parent states ['False','True'].`);
    }
    for (const parentId of hfeParentIds) {
      if (!isBinary(localContext.model.node(parentId).states)) {
        throw valueError(
          `Node '${node.nodeId}' expected binary HFE parent states ['False','True'] for parent '${parentId}'.`,
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const retrievePosition = node.parents.indexOf(retrieveParentId);
    const accessPosition = node.parents.indexOf(accessParentId);
    const hfePositions = hfeParentIds.map((parentId) => node.parents.indexOf(parentId));
    const hfeStates = hfeParentIds.map((parentId) => localContext.model.node(parentId).states);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const retrieveFailed = retrieveStates[indices[retrievePosition]] === "True";
      const accessFailed = accessStates[indices[accessPosition]] === "True";
      const anyHfeFailed = hfeStates.some((states, index) => states[indices[hfePositions[index]]] === "True");
      let q: number;
      if (retrieveFailed) q = retrieveFailedFail;
      else q = accessFailed ? accessFailedFail : accessOpenFail;
      if (anyHfeFailed) q = larger(q, hfeFail);
      q = clamp01(q);
      output.push(1 - q, q);
    }
    return output;
  };
};

const makeRetrieveFailureCpdGenerator = (input: RetrieveFailureInput): CpdGenerator => {
  const accessOpenFail = input.failIfAccessOpen;
  const accessFailedFail = input.failIfAccessFailed;
  const equipmentFail = input.failIfEquipmentUnavailable;
  const hfeFail = input.failIfHfeFailed;
  const frozenEquipmentKey =
    input.equipmentUnavailableKey !== null && input.equipmentUnavailableKey.length > 0 ?
      strip(input.equipmentUnavailableKey)
    : "";
  const frozenAccessKey = input.accessFailedKey;
  const frozenHfeKeys = Array.from(input.hfeFailedKeys);
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const equipmentParentId = frozenEquipmentKey.length > 0 ? localContext.registry.nodeId(frozenEquipmentKey) : null;
    const accessParentId = localContext.registry.nodeId(frozenAccessKey);
    const hfeParentIds = frozenHfeKeys.map((key) => localContext.registry.nodeId(key));
    const expected = new Set<string>([accessParentId, ...hfeParentIds]);
    if (equipmentParentId !== null) expected.add(equipmentParentId);

    for (const parentId of expected) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expected.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    let equipmentStates: string[] | null = null;
    if (equipmentParentId !== null) {
      equipmentStates = localContext.model.node(equipmentParentId).states;
      if (!isBinary(equipmentStates)) {
        throw valueError(`Node '${node.nodeId}' expected binary equipment parent states ['False','True'].`);
      }
    }
    const accessStates = localContext.model.node(accessParentId).states;
    if (!isBinary(accessStates)) {
      throw valueError(`Node '${node.nodeId}' expected binary access parent states ['False','True'].`);
    }

    for (const parentId of hfeParentIds) {
      if (!isBinary(localContext.model.node(parentId).states)) {
        throw valueError(
          `Node '${node.nodeId}' expected binary HFE parent states ['False','True'] for parent '${parentId}'.`,
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const equipmentPosition = equipmentParentId !== null ? node.parents.indexOf(equipmentParentId) : -1;
    const accessPosition = node.parents.indexOf(accessParentId);
    const hfePositions = hfeParentIds.map((parentId) => node.parents.indexOf(parentId));
    const hfeStates = hfeParentIds.map((parentId) => localContext.model.node(parentId).states);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const equipmentFailed =
        equipmentParentId !== null &&
        equipmentStates !== null &&
        equipmentStates[indices[equipmentPosition]] === "True";
      const accessFailed = accessStates[indices[accessPosition]] === "True";
      const anyHfeFailed = hfeStates.some((states, index) => states[indices[hfePositions[index]]] === "True");

      let q = accessFailed ? accessFailedFail : accessOpenFail;
      if (equipmentFailed) q = larger(q, equipmentFail);
      if (anyHfeFailed) q = larger(q, hfeFail);
      q = clamp01(q);
      output.push(1 - q, q);
    }
    return output;
  };
};

const makeSingleParentFailureCpdGenerator = (input: SingleParentFailureInput): CpdGenerator => {
  const falseFail = input.failParentFalse;
  const trueFail = input.failParentTrue;
  const frozenAllowExtra = input.allowExtraParents;
  const frozenParentKey = input.parentKey;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const parentId = localContext.registry.nodeId(frozenParentKey);
    if (!node.parents.includes(parentId)) {
      throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((candidate) => candidate !== parentId);
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const parentStates = localContext.model.node(parentId).states;
    if (!isBinary(parentStates)) {
      throw valueError(`Node '${node.nodeId}' expected binary parent states ['False','True'].`);
    }

    const dims = node.parents.map((candidate) => localContext.model.card(candidate));
    const parentPosition = node.parents.indexOf(parentId);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const state = parentStates[indices[parentPosition]];
      const q = clamp01(state === "True" ? trueFail : falseFail);
      output.push(1 - q, q);
    }
    return output;
  };
};

const makeStartRunFailureCpdGenerator = (input: StartRunFailureInput): CpdGenerator => {
  const readyFail = input.failIfReady;
  const equipmentFail = input.failIfEquipmentUnavailable;
  const connectFail = input.failIfConnectFailed;
  const bothFail = input.failIfBothFailed;
  const hfeFail = input.failIfHfeFailed;
  const equipmentUnavailableKey = input.equipmentUnavailableKey;
  const connectFailedKey = input.connectFailedKey;
  const frozenHfeKeys = Array.from(input.hfeFailedKeys);
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const equipmentParentId = localContext.registry.nodeId(equipmentUnavailableKey);
    const connectParentId = localContext.registry.nodeId(connectFailedKey);
    const hfeParentIds = frozenHfeKeys.map((key) => localContext.registry.nodeId(key));
    const expected = new Set<string>([equipmentParentId, connectParentId, ...hfeParentIds]);
    for (const parentId of expected) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expected.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const equipmentStates = localContext.model.node(equipmentParentId).states;
    const connectStates = localContext.model.node(connectParentId).states;
    for (const parentId of hfeParentIds) {
      if (!isBinary(localContext.model.node(parentId).states)) {
        throw valueError(
          `Node '${node.nodeId}' expected binary HFE parent states ['False','True'] for parent '${parentId}'.`,
        );
      }
    }
    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const equipmentPosition = node.parents.indexOf(equipmentParentId);
    const connectPosition = node.parents.indexOf(connectParentId);
    const hfePositions = hfeParentIds.map((parentId) => node.parents.indexOf(parentId));
    const hfeStates = hfeParentIds.map((parentId) => localContext.model.node(parentId).states);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const equipmentFailed = equipmentStates[indices[equipmentPosition]] === "True";
      const connectFailed = connectStates[indices[connectPosition]] === "True";
      const anyHfeFailed = hfeStates.some((states, index) => states[indices[hfePositions[index]]] === "True");
      let q: number;
      if (equipmentFailed && connectFailed) q = bothFail;
      else if (equipmentFailed) q = equipmentFail;
      else if (connectFailed) q = connectFail;
      else q = readyFail;
      if (anyHfeFailed) q = larger(q, hfeFail);
      q = clamp01(q);
      output.push(1 - q, q);
    }
    return output;
  };
};

const makeStartRunFailureLogisticsCpdGenerator = (input: StartRunFailureLogisticsInput): CpdGenerator => {
  const readyFail = input.failIfReady;
  const connectFail = input.failIfConnectFailed;
  const hfeFail = input.failIfHfeFailed;
  const connectFailedKey = input.connectFailedKey;
  const frozenHfeKeys = Array.from(input.hfeFailedKeys);
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const connectParentId = localContext.registry.nodeId(connectFailedKey);
    const hfeParentIds = frozenHfeKeys.map((key) => localContext.registry.nodeId(key));
    const expected = new Set<string>([connectParentId, ...hfeParentIds]);
    for (const parentId of expected) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expected.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const connectStates = localContext.model.node(connectParentId).states;
    if (!isBinary(connectStates)) {
      throw valueError(`Node '${node.nodeId}' expected binary connect parent states ['False','True'].`);
    }
    for (const parentId of hfeParentIds) {
      if (!isBinary(localContext.model.node(parentId).states)) {
        throw valueError(
          `Node '${node.nodeId}' expected binary HFE parent states ['False','True'] for parent '${parentId}'.`,
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const connectPosition = node.parents.indexOf(connectParentId);
    const hfePositions = hfeParentIds.map((parentId) => node.parents.indexOf(parentId));
    const hfeStates = hfeParentIds.map((parentId) => localContext.model.node(parentId).states);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const connectFailed = connectStates[indices[connectPosition]] === "True";
      const anyHfeFailed = hfeStates.some((states, index) => states[indices[hfePositions[index]]] === "True");
      let q = connectFailed ? connectFail : readyFail;
      if (anyHfeFailed) q = larger(q, hfeFail);
      q = clamp01(q);
      output.push(1 - q, q);
    }
    return output;
  };
};

const makeGateFailureCpdGenerator = (input: GateFailureInput): CpdGenerator => {
  const frozenParentKeys = Array.from(input.parentKeys);
  const frozenMode = strip(input.gateMode).toLowerCase();
  if (frozenMode !== "or" && frozenMode !== "and") {
    throw valueError(`Unsupported gate mode '${input.gateMode}'.`);
  }
  const frozenAllowExtra = input.allowExtraParents;

  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const expectedIds = frozenParentKeys.map((key) => localContext.registry.nodeId(key));
    const expectedSet = new Set(expectedIds);
    for (const parentId of expectedIds) {
      if (!node.parents.includes(parentId)) {
        throw valueError(`Node '${node.nodeId}' missing required parent '${parentId}'.`);
      }
    }
    if (!frozenAllowExtra) {
      const extras = node.parents.filter((parentId) => !expectedSet.has(parentId));
      if (extras.length > 0) {
        throw valueError(
          `Node '${node.nodeId}' has unexpected extra parents ${repr(extras)}. ` +
            "Set allow_extra_parents=true to permit this.",
        );
      }
    }

    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const states: boolean[] = [];
      for (const parentId of expectedIds) {
        const parentStates = localContext.model.node(parentId).states;
        const parentPosition = node.parents.indexOf(parentId);
        states.push(parentStates[indices[parentPosition]] === "True");
      }
      const failed = frozenMode === "or" ? states.some((state) => state) : states.every((state) => state);
      if (failed) output.push(0, 1);
      else output.push(1, 0);
    }
    return output;
  };
};

export type { Fragility, StateNumbers };
export {
  blendProbVectors,
  clamp01,
  combineFailureProbs,
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
  makeSingleParentFailureCpdGenerator,
  makeStartRunFailureCpdGenerator,
  makeStartRunFailureLogisticsCpdGenerator,
  makeTransportFailureCpdGenerator,
  resolveFloodStateNumericValue,
};
