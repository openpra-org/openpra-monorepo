import type { ModelContext } from "../core/context";
import { NetworkBuilderError, valueError } from "../core/errors";
import type { CpdGenerator, NodeRecord } from "../core/model";
import { cartesianProduct, repeat, repr, sortedText, tupleRepr } from "../core/spec-values";
import {
  clampUnit,
  dgNonRecoveryProbability,
  largerOf,
  lognormalFragilityCdf,
  lookup,
  lookupText,
  setsEqual,
  simpleFailedProbability,
  simpleFailedProbabilityForMultiplier,
  stateProbabilities,
} from "./recovery-values";

interface DgNotRecoveredInput {
  environmentParentId: string;
  tHours: number;
  alpha: number;
  beta: number;
  betaMultiplierByState: Map<string, number>;
  hazardNonrecoverableParentId: string | null;
}

interface DgHazardNonrecoverableInput {
  parentIds: readonly string[];
  anyParentKeys: readonly string[];
  allParentKeys: readonly string[];
  keyById: Map<string, string>;
  trueStateByParent: Map<string, string>;
}

interface InitialLossFragilityInput {
  seismicParentId: string;
  floodParentId: string;
  thetaSeismic: number;
  betaSeismic: number;
  thetaFlood: number;
  betaFlood: number;
  seismicImByState: Map<string, number>;
  floodImByState: Map<string, number>;
  baseProbability: number;
  dependenceEnabled: boolean;
  dependenceStrength: number;
  minThetaScale: number;
  floodPolicy: string;
  attenuateFactor: number;
}

interface FragilityCauseInput {
  parentId: string;
  theta: number;
  beta: number;
  imByState: Map<string, number>;
}

interface FloodCauseInput {
  floodParentId: string;
  seismicCauseParentId: string | null;
  theta: number;
  beta: number;
  imByState: Map<string, number>;
  floodPolicy: string;
  attenuateFactor: number;
}

interface SimpleFailedByInput {
  initialLossParentId: string;
  pgaParentId: string;
  floodParentId: string;
  hazardNonrecoverableParentId: string | null;
  hazardNonrecoverableTrueState: string;
  initialLossTrueState: string;
  initialLossFalseState: string;
  tHours: number;
  mu0: number;
  sigma0: number;
  method: string;
  combine: string;
  multiplierSeismic: Map<string, number>;
  multiplierFlood: Map<string, number>;
  multiplierJoint: Map<string, number>;
}

interface SimpleFailedByEnvironmentInput {
  initialLossParentId: string;
  environmentParentId: string;
  hazardNonrecoverableParentId: string | null;
  hazardNonrecoverableTrueState: string;
  initialLossTrueState: string;
  initialLossFalseState: string;
  tHours: number;
  mu0: number;
  sigma0: number;
  method: string;
  multiplierEnvironment: Map<string, number>;
}

const parentStateCombinations = (context: ModelContext, node: NodeRecord): string[][] =>
  cartesianProduct(node.parents.map((parentId) => context.model.node(parentId).states));

const makeTableConstantCpdGenerator =
  (probabilities: readonly number[]): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] =>
    repeat(probabilities, localContext.model.parentConfigurationCount(node.nodeId));

const makeTableRowsCpdGenerator =
  (comboToProbabilities: Map<string, number[]>): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    const output: number[] = [];
    for (const combo of parentStateCombinations(localContext, node)) {
      const probabilities = comboToProbabilities.get(JSON.stringify(combo));
      if (probabilities === undefined) throw new NetworkBuilderError("KeyError", tupleRepr(combo));
      for (const probability of probabilities) output.push(probability);
    }
    return output;
  };

const makeDgNotRecoveredCpdGenerator =
  (input: DgNotRecoveredInput): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    const expected = new Set([input.environmentParentId]);
    if (input.hazardNonrecoverableParentId !== null) expected.add(input.hazardNonrecoverableParentId);
    if (!setsEqual(node.parents, expected)) {
      throw valueError(`Node '${node.nodeId}' parent mismatch for DG non-recovered CPT.`);
    }
    const environmentPosition = node.parents.indexOf(input.environmentParentId);
    const hazardPosition =
      input.hazardNonrecoverableParentId !== null ? node.parents.indexOf(input.hazardNonrecoverableParentId) : -1;
    const rows: number[] = [];
    for (const combo of parentStateCombinations(localContext, node)) {
      const environmentState = combo[environmentPosition];
      if (!input.betaMultiplierByState.has(environmentState)) {
        throw valueError(`Node '${node.nodeId}' missing beta multiplier for environment state '${environmentState}'.`);
      }
      let q: number;
      if (input.hazardNonrecoverableParentId !== null && combo[hazardPosition] === "True") {
        q = 1;
      } else {
        q = dgNonRecoveryProbability(
          input.tHours,
          input.alpha,
          input.beta,
          lookup(input.betaMultiplierByState, environmentState),
        );
      }
      q = clampUnit(q);
      for (const probability of stateProbabilities(node.states, 1 - q, q)) rows.push(probability);
    }
    return rows;
  };

const makeDgHazardNonrecoverableCpdGenerator = (input: DgHazardNonrecoverableInput): CpdGenerator => {
  const anySet = new Set(input.anyParentKeys);
  const allSet = new Set(input.allParentKeys);
  const expectedIds = new Set(input.parentIds);
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    if (!setsEqual(node.parents, expectedIds)) {
      throw valueError(`Node '${node.nodeId}' parent mismatch for DG hazard non-recoverable CPT.`);
    }
    const rows: number[] = [];
    for (const combo of parentStateCombinations(localContext, node)) {
      let anyHit = false;
      if (anySet.size > 0) {
        for (let position = 0; position < node.parents.length; position += 1) {
          const parentKey = lookupText(input.keyById, node.parents[position]);
          if (anySet.has(parentKey) && combo[position] === lookupText(input.trueStateByParent, parentKey)) {
            anyHit = true;
            break;
          }
        }
      }
      let allHit = false;
      if (allSet.size > 0) {
        allHit = true;
        for (let position = 0; position < node.parents.length; position += 1) {
          const parentKey = lookupText(input.keyById, node.parents[position]);
          if (allSet.has(parentKey) && combo[position] !== lookupText(input.trueStateByParent, parentKey)) {
            allHit = false;
            break;
          }
        }
      }
      const trueValue = anyHit || allHit ? 1 : 0;
      for (const probability of stateProbabilities(node.states, 1 - trueValue, trueValue)) rows.push(probability);
    }
    return rows;
  };
};

const makeInitialLossFragilityCpdGenerator =
  (input: InitialLossFragilityInput): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    const expected = new Set([input.seismicParentId, input.floodParentId]);
    if (!setsEqual(node.parents, expected)) {
      throw valueError(
        `Node '${node.nodeId}' parent mismatch for fragility_conditional initial loss CPT. ` +
          `Expected ${repr(sortedText(expected))}, got ${repr(node.parents)}.`,
      );
    }
    const seismicPosition = node.parents.indexOf(input.seismicParentId);
    const floodPosition = node.parents.indexOf(input.floodParentId);
    const rows: number[] = [];
    for (const combo of parentStateCombinations(localContext, node)) {
      const seismicState = combo[seismicPosition];
      const floodState = combo[floodPosition];
      if (!input.seismicImByState.has(seismicState)) {
        throw valueError(`Node '${node.nodeId}' missing seismic IM value for state '${seismicState}'.`);
      }
      if (!input.floodImByState.has(floodState)) {
        throw valueError(`Node '${node.nodeId}' missing flood IM value for state '${floodState}'.`);
      }
      const imSeismic = lookup(input.seismicImByState, seismicState);
      const imFlood = lookup(input.floodImByState, floodState);
      const qSeismic = lognormalFragilityCdf(imSeismic, input.thetaSeismic, input.betaSeismic);
      let thetaFloodEffective = input.thetaFlood;
      if (input.dependenceEnabled) {
        const thetaScale = largerOf(input.minThetaScale, 1 - input.dependenceStrength * qSeismic);
        thetaFloodEffective = input.thetaFlood * thetaScale;
      }
      const qFloodGivenSeismic = lognormalFragilityCdf(imFlood, thetaFloodEffective, input.betaFlood);
      const seismicActive = imSeismic > 0;
      let qFloodEffective: number;
      if (seismicActive) {
        if (input.floodPolicy === "block") qFloodEffective = 0;
        else if (input.floodPolicy === "attenuate") qFloodEffective = qFloodGivenSeismic * input.attenuateFactor;
        else qFloodEffective = qFloodGivenSeismic;
      } else {
        qFloodEffective = qFloodGivenSeismic;
      }
      const qHazard = 1 - (1 - qSeismic) * (1 - qFloodEffective);
      const qTrue = clampUnit(input.baseProbability + (1 - input.baseProbability) * qHazard);
      const qFalse = 1 - qTrue;
      for (const probability of stateProbabilities(node.states, qFalse, qTrue)) rows.push(probability);
    }
    return rows;
  };

const makeConstantBoolCpdGenerator = (trueProbability: number): CpdGenerator => {
  const q = clampUnit(trueProbability);
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (const probability of stateProbabilities(node.states, 1 - q, q)) output.push(probability);
    }
    return output;
  };
};

const makeFragilityCauseCpdGenerator =
  (input: FragilityCauseInput): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    if (!setsEqual(node.parents, [input.parentId])) {
      throw valueError(`Node '${node.nodeId}' parent mismatch for fragility cause node.`);
    }
    const output: number[] = [];
    for (const state of localContext.model.node(input.parentId).states) {
      if (!input.imByState.has(state)) {
        throw valueError(`Node '${node.nodeId}' missing IM value for parent state '${state}'.`);
      }
      const q = clampUnit(lognormalFragilityCdf(lookup(input.imByState, state), input.theta, input.beta));
      for (const probability of stateProbabilities(node.states, 1 - q, q)) output.push(probability);
    }
    return output;
  };

const makeFloodCauseCpdGenerator =
  (input: FloodCauseInput): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    const expected = new Set([input.floodParentId]);
    if (input.seismicCauseParentId !== null) expected.add(input.seismicCauseParentId);
    if (!setsEqual(node.parents, expected)) {
      throw valueError(
        `Node '${node.nodeId}' parent mismatch for flood cause node. ` +
          `Expected ${repr(sortedText(expected))}, got ${repr(node.parents)}.`,
      );
    }
    const floodPosition = node.parents.indexOf(input.floodParentId);
    const seismicPosition = input.seismicCauseParentId !== null ? node.parents.indexOf(input.seismicCauseParentId) : -1;
    const output: number[] = [];
    for (const combo of parentStateCombinations(localContext, node)) {
      const floodState = combo[floodPosition];
      if (!input.imByState.has(floodState)) {
        throw valueError(`Node '${node.nodeId}' missing flood IM value for state '${floodState}'.`);
      }
      let q = lognormalFragilityCdf(lookup(input.imByState, floodState), input.theta, input.beta);
      if (input.seismicCauseParentId !== null) {
        const seismicTrue = combo[seismicPosition] === "True";
        if (seismicTrue) {
          if (input.floodPolicy === "block") q = 0;
          else if (input.floodPolicy === "attenuate") q *= input.attenuateFactor;
        }
      }
      q = clampUnit(q);
      for (const probability of stateProbabilities(node.states, 1 - q, q)) output.push(probability);
    }
    return output;
  };

const makeOrBoolCpdGenerator = (parentIds: readonly string[]): CpdGenerator => {
  const expectedIds = new Set(parentIds);
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    if (!setsEqual(node.parents, expectedIds)) {
      throw valueError(
        `Node '${node.nodeId}' parent mismatch for n-ary OR CPT. ` +
          `Expected ${repr(sortedText(expectedIds))}, got ${repr(node.parents)}.`,
      );
    }
    const combinations = parentStateCombinations(localContext, node);
    for (const parentId of node.parents) {
      const states = localContext.model.node(parentId).states;
      if (!states.includes("False") || !states.includes("True")) {
        throw valueError(`Node '${node.nodeId}' expects binary parent states for n-ary OR.`);
      }
    }
    const output: number[] = [];
    for (const combo of combinations) {
      const trueValue = combo.some((state) => state === "True") ? 1 : 0;
      for (const probability of stateProbabilities(node.states, 1 - trueValue, trueValue)) output.push(probability);
    }
    return output;
  };
};

const initialLossStatesError = (nodeId: string, falseState: string, trueState: string): NetworkBuilderError =>
  valueError(`Node '${nodeId}' missing initial-loss states '${falseState}'/'${trueState}'.`);

const makeSimpleFailedByCpdGenerator =
  (input: SimpleFailedByInput): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    const expected = new Set([input.initialLossParentId, input.pgaParentId, input.floodParentId]);
    if (input.hazardNonrecoverableParentId !== null) expected.add(input.hazardNonrecoverableParentId);
    if (!setsEqual(node.parents, expected)) {
      throw valueError(
        `Node '${node.nodeId}' parent mismatch for simple failed-by CPT. ` +
          `Expected ${repr(sortedText(expected))}, got ${repr(node.parents)}.`,
      );
    }
    const initialStates = localContext.model.node(input.initialLossParentId).states;
    if (!initialStates.includes(input.initialLossTrueState) || !initialStates.includes(input.initialLossFalseState)) {
      throw initialLossStatesError(node.nodeId, input.initialLossFalseState, input.initialLossTrueState);
    }
    const pgaStates = localContext.model.node(input.pgaParentId).states;
    const floodStates = localContext.model.node(input.floodParentId).states;
    const initialPosition = node.parents.indexOf(input.initialLossParentId);
    const pgaPosition = node.parents.indexOf(input.pgaParentId);
    const floodPosition = node.parents.indexOf(input.floodParentId);
    const hazardPosition =
      input.hazardNonrecoverableParentId !== null ? node.parents.indexOf(input.hazardNonrecoverableParentId) : -1;
    const rows: number[] = [];
    for (const combo of parentStateCombinations(localContext, node)) {
      const initialState = combo[initialPosition];
      const pgaState = combo[pgaPosition];
      const floodState = combo[floodPosition];
      if (!pgaStates.includes(pgaState) || !floodStates.includes(floodState)) {
        throw valueError(`Node '${node.nodeId}' saw invalid parent states pga=${pgaState}, flood=${floodState}.`);
      }
      let hazardNonrecoverable = false;
      if (input.hazardNonrecoverableParentId !== null) {
        hazardNonrecoverable = combo[hazardPosition] === input.hazardNonrecoverableTrueState;
      }
      let qFail: number;
      if (initialState === input.initialLossFalseState) {
        qFail = 0;
      } else if (hazardNonrecoverable) {
        qFail = 1;
      } else {
        qFail = simpleFailedProbability({
          tHours: input.tHours,
          mu0: input.mu0,
          sigma0: input.sigma0,
          method: input.method,
          combine: input.combine,
          pgaState,
          floodState,
          multiplierSeismic: input.multiplierSeismic,
          multiplierFlood: input.multiplierFlood,
          multiplierJoint: input.multiplierJoint,
        });
      }
      qFail = clampUnit(qFail);
      for (const probability of stateProbabilities(node.states, 1 - qFail, qFail)) rows.push(probability);
    }
    return rows;
  };

const makeSimpleFailedByEnvironmentCpdGenerator =
  (input: SimpleFailedByEnvironmentInput): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    const expected = new Set([input.initialLossParentId, input.environmentParentId]);
    if (input.hazardNonrecoverableParentId !== null) expected.add(input.hazardNonrecoverableParentId);
    if (!setsEqual(node.parents, expected)) {
      throw valueError(
        `Node '${node.nodeId}' parent mismatch for loop environment failed-by CPT. ` +
          `Expected ${repr(sortedText(expected))}, got ${repr(node.parents)}.`,
      );
    }
    const initialStates = localContext.model.node(input.initialLossParentId).states;
    if (!initialStates.includes(input.initialLossTrueState) || !initialStates.includes(input.initialLossFalseState)) {
      throw initialLossStatesError(node.nodeId, input.initialLossFalseState, input.initialLossTrueState);
    }
    const environmentStates = localContext.model.node(input.environmentParentId).states;
    const initialPosition = node.parents.indexOf(input.initialLossParentId);
    const environmentPosition = node.parents.indexOf(input.environmentParentId);
    const hazardPosition =
      input.hazardNonrecoverableParentId !== null ? node.parents.indexOf(input.hazardNonrecoverableParentId) : -1;
    const rows: number[] = [];
    for (const combo of parentStateCombinations(localContext, node)) {
      const initialState = combo[initialPosition];
      const environmentState = combo[environmentPosition];
      if (!environmentStates.includes(environmentState)) {
        throw valueError(`Node '${node.nodeId}' saw invalid environment state '${environmentState}'.`);
      }
      if (!input.multiplierEnvironment.has(environmentState)) {
        throw valueError(`Node '${node.nodeId}' missing multiplier for environment state '${environmentState}'.`);
      }
      let hazardNonrecoverable = false;
      if (input.hazardNonrecoverableParentId !== null) {
        hazardNonrecoverable = combo[hazardPosition] === input.hazardNonrecoverableTrueState;
      }
      let qFail: number;
      if (initialState === input.initialLossFalseState) {
        qFail = 0;
      } else if (hazardNonrecoverable) {
        qFail = 1;
      } else {
        qFail = simpleFailedProbabilityForMultiplier(
          input.tHours,
          input.mu0,
          input.sigma0,
          input.method,
          lookup(input.multiplierEnvironment, environmentState),
        );
      }
      qFail = clampUnit(qFail);
      for (const probability of stateProbabilities(node.states, 1 - qFail, qFail)) rows.push(probability);
    }
    return rows;
  };

const makeNotBoolCpdGenerator =
  (parentId: string): CpdGenerator =>
  (localContext: ModelContext, node: NodeRecord): number[] => {
    if (!setsEqual(node.parents, [parentId])) {
      throw valueError(`Node '${node.nodeId}' parent mismatch for NOT-bool CPT.`);
    }
    const parentStates = localContext.model.node(parentId).states;
    if (!parentStates.includes("False") || !parentStates.includes("True")) {
      throw valueError(`Node '${node.nodeId}' expects binary parent states for NOT-bool CPT.`);
    }
    const rows: number[] = [];
    for (const state of parentStates) {
      const trueValue = state === "False" ? 1 : 0;
      for (const probability of stateProbabilities(node.states, 1 - trueValue, trueValue)) rows.push(probability);
    }
    return rows;
  };

export {
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
};
