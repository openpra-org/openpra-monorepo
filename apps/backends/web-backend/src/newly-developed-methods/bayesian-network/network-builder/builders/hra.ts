import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { keyError, valueError } from "../core/errors";
import type { CpdGenerator, NodeRecord } from "../core/model";
import {
  cartesianProduct,
  collapseUnderscores,
  compareText,
  decodeRowIndex,
  formatGeneral,
  getValue,
  getValueOr,
  isMapping,
  isSequence,
  iterValues,
  keysOf,
  replaceNonAlphanumericRuns,
  replaceNonIdentifierRuns,
  repr,
  sortedText,
  startsWithIdentifierStart,
  strip,
  stripCharacters,
  sum,
  text,
  toFloat,
  truthy,
  tupleRepr,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import { GENERIC_HFE_TEMPLATE } from "../data/generic-hfe-template";

const BUILT_IN_TEMPLATE_NAME = "Generic_HFE.xdsl";
const BUILT_IN_TEMPLATE_FILE_NAMES = ["Generic_HFE.xdsl", "Generic HFE.xdsl"];

interface TemplateNode {
  nodeId: string;
  states: string[];
  parents: string[];
  table: number[];
}

interface TemplateModel {
  nodeOrder: string[];
  nodeMap: Map<string, TemplateNode>;
}

interface StateRow {
  states: string[];
  probabilities: number[];
}

type StateRowTable = Map<string, StateRow>;

type IndexRowTable = Map<string, number[]>;

interface ContextSpec {
  contextId: string;
  key: string;
  nodeId: string;
  states: string[];
  parentKeys: string[];
  rowByParentStates: StateRowTable;
}

interface PifMappingSpec {
  templateNodeId: string;
  contextIds: string[];
  rowByContextStates: StateRowTable;
  templatePassthroughWhenContextStates: Map<string, string> | null;
}

interface HazardInfluenceSpec {
  contextSpecs: ContextSpec[];
  pifMappings: Map<string, PifMappingSpec>;
}

interface EventRecord {
  index: number;
  hfeId: string;
  hfeSegment: string;
  nodeIdPrefix: string;
  finalKey: string;
  event: SpecMapping;
}

interface DependencyContextSpec {
  sourceHfeId: string;
  sourceHfeSegment: string;
  sourceFailedKey: string;
  targetHfeId: string;
  targetHfeSegment: string;
  contextId: string;
  key: string;
  nodeId: string;
  states: string[];
  rowBySourceStates: StateRowTable;
}

interface DependenciesSpec {
  orderedHfeSegments: string[];
  contextsByTarget: Map<string, DependencyContextSpec[]>;
}

interface HazardInfluenceInput {
  event: SpecMapping;
  hfeId: string;
  hfeSegment: string;
  nodeIdPrefix: string;
  template: TemplateModel;
  templateHfeNodeId: string;
  sharedContextIds: Set<string>;
  dependencyContextIds: Set<string>;
}

interface KeepNodesInput {
  template: TemplateModel;
  templateHfeNodeId: string;
  cfmIds: readonly string[];
  activeCfms: Set<string>;
  hazardSpec: HazardInfluenceSpec | null;
  sparseActiveCfmsOnly: boolean;
}

interface RowTableInput {
  rowsRaw: SpecValue;
  orderedParentLabels: readonly string[];
  childStates: readonly string[];
  label: string;
}

interface RowByIndicesInput {
  rowByStateTuple: StateRowTable;
  orderedParentLabels: readonly string[];
  orderedParentStates: readonly (readonly string[])[];
  label: string;
}

const slug = (token: string): string => {
  const cleaned = stripCharacters(replaceNonAlphanumericRuns(strip(token), "_"), "_");
  return cleaned.length > 0 ? cleaned.toLowerCase() : "x";
};

const nodeIdToken = (token: string): string => {
  let cleaned = replaceNonIdentifierRuns(strip(token), "_");
  cleaned = stripCharacters(collapseUnderscores(cleaned), "_");
  if (cleaned.length === 0) cleaned = "X";
  if (!startsWithIdentifierStart(cleaned)) cleaned = `N_${cleaned}`;
  return cleaned;
};

const strippedText = (value: SpecValue): string => strip(text(value));

const strippedTextOr = (value: SpecValue, fallback: string): string => {
  const cleaned = strippedText(value);
  return cleaned.length > 0 ? cleaned : fallback;
};

const stateTupleKey = (states: readonly string[]): string => JSON.stringify(states);

const indexTupleKey = (indices: readonly number[]): string => indices.join(",");

const compareTextTuples = (left: readonly string[], right: readonly string[]): number => {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const order = compareText(left[index], right[index]);
    if (order !== 0) return order;
  }
  return left.length - right.length;
};

const tupleListRepr = (tuples: readonly (readonly string[])[]): string =>
  `[${tuples.map((item) => tupleRepr(Array.from(item))).join(", ")}]`;

const sameMembers = (left: Iterable<string>, right: Iterable<string>): boolean => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) return false;
  for (const item of leftSet) {
    if (!rightSet.has(item)) return false;
  }
  return true;
};

const hasDuplicates = (values: readonly string[]): boolean => new Set(values).size !== values.length;

const requireText = (value: SpecValue, label: string): string => {
  if (typeof value !== "string" || strip(value).length === 0) {
    throw valueError(`hra.${label} must be a non-empty string.`);
  }
  return strip(value);
};

const parseBoolean = (value: SpecValue): boolean => {
  if (typeof value === "boolean") return value;
  if (value === null) return false;
  const token = strip(text(value)).toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(token)) return true;
  if (["0", "false", "no", "n", "off"].includes(token)) return false;
  return truthy(value);
};

const normalizeNamedEntries = (raw: SpecValue, label: string, idFields: readonly string[]): SpecMapping[] => {
  if (raw === null) return [];
  if (isMapping(raw)) {
    const output: SpecMapping[] = [];
    for (const name of keysOf(raw)) {
      const item = raw[name];
      if (!isMapping(item)) throw valueError(`hra.${label}['${name}'] must be mapping/object.`);
      const merged: SpecMapping = { ...item };
      if (!idFields.some((field) => strippedText(getValueOr(merged, field, "")).length > 0)) {
        merged[idFields[0]] = name;
      }
      output.push(merged);
    }
    return output;
  }
  if (!isSequence(raw)) throw valueError(`hra.${label} must be list-like or mapping/object.`);
  const output: SpecMapping[] = [];
  raw.forEach((item, index) => {
    if (!isMapping(item)) throw valueError(`hra.${label}[${index}] must be mapping/object.`);
    output.push(item);
  });
  return output;
};

const parseStates = (value: SpecValue, label: string): string[] => {
  if (!isSequence(value) || value.length < 2) {
    throw valueError(`hra.${label} must be list-like with at least 2 states.`);
  }
  const states = value.map((item) => strippedText(item));
  if (states.some((state) => state.length === 0)) throw valueError(`hra.${label} contains empty state id.`);
  if (hasDuplicates(states)) {
    throw valueError(`hra.${label} contains duplicate states: ${tupleRepr(states)}.`);
  }
  return states;
};

const parseTextList = (value: SpecValue, label: string): string[] => {
  if (value === null) return [];
  if (!isSequence(value)) throw valueError(`hra.${label} must be list-like.`);
  const output = value.map((item) => requireText(item, label));
  if (hasDuplicates(output)) {
    throw valueError(`hra.${label} contains duplicate values: ${tupleRepr(output)}.`);
  }
  return output;
};

const parseProbabilityVector = (probabilitiesRaw: SpecValue, childCard: number, label: string): number[] => {
  if (!isSequence(probabilitiesRaw)) throw valueError(`hra.${label} must define list-like probs.`);
  const probabilities = probabilitiesRaw.map((item) => toFloat(item));
  if (probabilities.length !== childCard) {
    throw valueError(`hra.${label} probs length ${probabilities.length} does not match child card ${text(childCard)}.`);
  }
  const total = sum(probabilities);
  if (Math.abs(total - 1) > 1e-9) {
    throw valueError(`hra.${label} probs must sum to 1.0 (got ${formatGeneral(total, 12)}).`);
  }
  if (probabilities.some((probability) => probability < -1e-12 || probability > 1 + 1e-12)) {
    throw valueError(`hra.${label} probs must lie within [0,1].`);
  }
  return probabilities;
};

const parseRowTable = (input: RowTableInput): StateRowTable => {
  const { rowsRaw, orderedParentLabels, childStates, label } = input;
  if (!isSequence(rowsRaw) || rowsRaw.length === 0) {
    throw valueError(`hra.${label}.rows must be a non-empty list.`);
  }
  const expectedParentSet = new Set(orderedParentLabels);
  const output: StateRowTable = new Map();
  rowsRaw.forEach((row, index) => {
    if (!isMapping(row)) throw valueError(`hra.${label}.rows[${index}] must be mapping/object.`);
    const whenRaw = getValueOr(row, "when", {});
    let stateTuple: string[] = [];
    if (orderedParentLabels.length > 0) {
      if (!isMapping(whenRaw)) throw valueError(`hra.${label}.rows[${index}].when must be mapping/object.`);
      const whenKeys = new Set(keysOf(whenRaw));
      if (!sameMembers(whenKeys, expectedParentSet)) {
        throw valueError(
          `hra.${label}.rows[${index}].when must provide exactly keys ` +
            `${repr(sortedText(expectedParentSet))} (got ${repr(sortedText(whenKeys))}).`,
        );
      }
      stateTuple = orderedParentLabels.map((parent) =>
        requireText(getValue(whenRaw, parent), `${label}.rows[${index}].when[${parent}]`),
      );
    } else if (whenRaw !== null && !(isMapping(whenRaw) && keysOf(whenRaw).length === 0)) {
      throw valueError(`hra.${label}.rows[${index}] cannot set 'when' because node has no parents.`);
    }
    const probabilities = parseProbabilityVector(
      getValueOr(row, "probs", getValue(row, "p")),
      childStates.length,
      `${label}.rows[${index}]`,
    );
    const key = stateTupleKey(stateTuple);
    if (output.has(key)) {
      throw valueError(`hra.${label}.rows[${index}] duplicates parent condition ${tupleRepr(stateTuple)}.`);
    }
    output.set(key, { states: stateTuple, probabilities });
  });
  return output;
};

const resolveRowByIndices = (input: RowByIndicesInput): IndexRowTable => {
  const { rowByStateTuple, orderedParentLabels, orderedParentStates, label } = input;
  const expectedTuples = cartesianProduct(orderedParentStates);
  const expected = new Map<string, string[]>();
  for (const item of expectedTuples) expected.set(stateTupleKey(item), item);

  const missing = Array.from(expected.entries())
    .filter(([key]) => !rowByStateTuple.has(key))
    .map(([, item]) => item)
    .sort(compareTextTuples);
  if (missing.length > 0) {
    throw valueError(
      `hra.${label} missing CPT rows for parent states: ` +
        `${tupleListRepr(missing.slice(0, 3))}${missing.length > 3 ? "..." : ""}`,
    );
  }

  const extra = Array.from(rowByStateTuple.entries())
    .filter(([key]) => !expected.has(key))
    .map(([, row]) => row.states)
    .sort(compareTextTuples);
  if (extra.length > 0) {
    throw valueError(
      `hra.${label} defines unexpected CPT rows: ` +
        `${tupleListRepr(extra.slice(0, 3))}${extra.length > 3 ? "..." : ""}. ` +
        `Expected parent labels ${repr(Array.from(orderedParentLabels))}.`,
    );
  }

  const output: IndexRowTable = new Map();
  for (const row of rowByStateTuple.values()) {
    const indices: number[] = [];
    row.states.forEach((stateValue, position) => {
      const parentStates = orderedParentStates[position];
      if (!parentStates.includes(stateValue)) {
        throw valueError(
          `hra.${label} references unknown parent state '${stateValue}' ` +
            `for parent '${orderedParentLabels[position]}', expected one of ${tupleRepr(Array.from(parentStates))}.`,
        );
      }
      indices.push(parentStates.indexOf(stateValue));
    });
    output.set(indexTupleKey(indices), Array.from(row.probabilities));
  }
  return output;
};

const resolveContextStateIndices = (
  stateByContextId: Map<string, string>,
  orderedContextIds: readonly string[],
  orderedContextStates: readonly (readonly string[])[],
  label: string,
): number[] => {
  const output: number[] = [];
  orderedContextIds.forEach((contextId, position) => {
    const states = orderedContextStates[position];
    const value = text(stateByContextId.get(contextId) ?? null);
    if (!states.includes(value)) {
      throw valueError(
        `hra.${label} references unknown state '${value}' for context '${contextId}', ` +
          `expected one of ${tupleRepr(Array.from(states))}.`,
      );
    }
    output.push(states.indexOf(value));
  });
  return output;
};

const encodeRowIndex = (indices: readonly number[], dimensions: readonly number[]): number => {
  if (indices.length !== dimensions.length) throw valueError("encode_row_index: indices and dims length mismatch.");
  let output = 0;
  let multiplier = 1;
  for (let index = dimensions.length - 1; index >= 0; index -= 1) {
    output += indices[index] * multiplier;
    multiplier *= dimensions[index];
  }
  return output;
};

const templateNodeKey = (hfeSegment: string, templateNodeId: string): string =>
  `hra.hfe.${hfeSegment}.template.${templateNodeId}`;

const finalFailedKey = (hfeSegment: string): string => `hra.hfe.${hfeSegment}.failed`;

const positionByParent = (parents: readonly string[]): Map<string, number> => {
  const output = new Map<string, number>();
  parents.forEach((parentId, index) => output.set(parentId, index));
  return output;
};

const positionOf = (positions: Map<string, number>, parentId: string): number => positions.get(parentId) ?? 0;

const appendValues = (output: number[], values: readonly number[]): void => {
  for (const value of values) output.push(value);
};

const makeForceStateCpdGenerator = (forceStateIndex: number, childCard: number): CpdGenerator => {
  const frozenRow = new Array<number>(childCard).fill(0);
  frozenRow[forceStateIndex] = 1;
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) appendValues(output, frozenRow);
    return output;
  };
};

const makeTemplateCpdGenerator = (
  templateParentInstIds: readonly string[],
  templateTable: readonly number[],
  childCard: number,
): CpdGenerator => {
  const frozenParentIds = Array.from(templateParentInstIds);
  const frozenTable = Array.from(templateTable);
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const expectedSet = new Set(frozenParentIds);
    if (!sameMembers(node.parents, expectedSet)) {
      throw valueError(
        `Node '${node.nodeId}' parent set changed from template. ` +
          `Expected ${repr(sortedText(expectedSet))}, got ${repr(sortedText(node.parents))}.`,
      );
    }
    const dimsCanonical = node.parents.map((parentId) => localContext.model.card(parentId));
    const dimsTemplate = frozenParentIds.map((parentId) => localContext.model.card(parentId));
    const positions = positionByParent(node.parents);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indexCanonical = decodeRowIndex(rowIndex, dimsCanonical);
      const indexTemplate = frozenParentIds.map((parentId) => indexCanonical[positionOf(positions, parentId)]);
      const start = encodeRowIndex(indexTemplate, dimsTemplate) * childCard;
      appendValues(output, frozenTable.slice(start, start + childCard));
    }
    return output;
  };
};

interface ProjectedTemplateInput {
  templateParentIds: readonly string[];
  presentParentInstIdByTemplateParent: Map<string, string>;
  fixedParentStateIndexByTemplateParent: Map<string, number>;
  templateParentCardByParent: Map<string, number>;
  templateTable: readonly number[];
  childCard: number;
}

const makeProjectedTemplateCpdGenerator = (input: ProjectedTemplateInput): CpdGenerator => {
  const frozenTemplateParentIds = Array.from(input.templateParentIds);
  const frozenPresentParentMap = new Map(input.presentParentInstIdByTemplateParent);
  const frozenFixedParentIndex = new Map(input.fixedParentStateIndexByTemplateParent);
  const frozenParentCards = new Map(input.templateParentCardByParent);
  const frozenTable = Array.from(input.templateTable);
  const childCard = input.childCard;
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const expectedParentIds = new Set(frozenPresentParentMap.values());
    if (!sameMembers(node.parents, expectedParentIds)) {
      throw valueError(
        `Node '${node.nodeId}' parent set changed from sparse projected template expectation. ` +
          `Expected ${repr(sortedText(expectedParentIds))}, got ${repr(sortedText(node.parents))}.`,
      );
    }
    const dimsCanonical = node.parents.map((parentId) => localContext.model.card(parentId));
    const positions = positionByParent(node.parents);
    const dimsTemplate = frozenTemplateParentIds.map((parentId) => frozenParentCards.get(parentId) ?? 0);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indexCanonical = decodeRowIndex(rowIndex, dimsCanonical);
      const indexTemplate: number[] = [];
      for (const templateParentId of frozenTemplateParentIds) {
        const mappedParent = frozenPresentParentMap.get(templateParentId);
        if (mappedParent !== undefined) {
          indexTemplate.push(indexCanonical[positionOf(positions, mappedParent)]);
          continue;
        }
        const fixedIndex = frozenFixedParentIndex.get(templateParentId);
        if (fixedIndex === undefined) {
          throw valueError(
            `Node '${node.nodeId}' has no fixed state for removed template parent '${templateParentId}'.`,
          );
        }
        indexTemplate.push(fixedIndex);
      }
      const start = encodeRowIndex(indexTemplate, dimsTemplate) * childCard;
      appendValues(output, frozenTable.slice(start, start + childCard));
    }
    return output;
  };
};

const copyIndexRowTable = (table: IndexRowTable): IndexRowTable => {
  const output: IndexRowTable = new Map();
  for (const [key, row] of table) output.set(key, Array.from(row));
  return output;
};

const makeRowLookupCpdGenerator = (
  expectedParentIds: readonly string[],
  rowByParentIndices: IndexRowTable,
  childCard: number,
): CpdGenerator => {
  const frozenParentIds = Array.from(expectedParentIds);
  const frozenRowMap = copyIndexRowTable(rowByParentIndices);
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    if (!sameMembers(node.parents, frozenParentIds)) {
      throw valueError(
        `Node '${node.nodeId}' parent set changed from configured context parents. ` +
          `Expected ${repr(sortedText(frozenParentIds))}, got ${repr(sortedText(node.parents))}.`,
      );
    }
    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const positions = positionByParent(node.parents);
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indexCanonical = decodeRowIndex(rowIndex, dims);
      const indexExpected = frozenParentIds.map((parentId) => indexCanonical[positionOf(positions, parentId)]);
      const row = frozenRowMap.get(indexTupleKey(indexExpected));
      if (row === undefined) {
        throw valueError(
          `Node '${node.nodeId}' missing context CPT row for parent index tuple ${tupleRepr(indexExpected)}.`,
        );
      }
      if (row.length !== childCard) {
        throw valueError(
          `Node '${node.nodeId}' row length mismatch: got ${row.length}, ` + `expected ${text(childCard)}.`,
        );
      }
      appendValues(output, row);
    }
    return output;
  };
};

interface ContextOverrideInput {
  templateParentInstIds: readonly string[];
  contextParentInstIds: readonly string[];
  rowByContextIndices: IndexRowTable;
  passthroughContextIndices: readonly number[] | null;
  templateTable: readonly number[];
  childCard: number;
}

const makeContextOverrideCpdGenerator = (input: ContextOverrideInput): CpdGenerator => {
  const frozenTemplateParentIds = Array.from(input.templateParentInstIds);
  const frozenContextParentIds = Array.from(input.contextParentInstIds);
  const frozenRowMap = copyIndexRowTable(input.rowByContextIndices);
  const frozenPassthroughKey =
    input.passthroughContextIndices === null ? null : indexTupleKey(input.passthroughContextIndices);
  const frozenTemplateTable = Array.from(input.templateTable);
  const childCard = input.childCard;
  const frozenExpectedSet = new Set([...frozenTemplateParentIds, ...frozenContextParentIds]);
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    if (!sameMembers(node.parents, frozenExpectedSet)) {
      throw valueError(
        `Node '${node.nodeId}' parent set changed from configured hazard override. ` +
          `Expected ${repr(sortedText(frozenExpectedSet))}, got ${repr(sortedText(node.parents))}.`,
      );
    }
    const dimsCanonical = node.parents.map((parentId) => localContext.model.card(parentId));
    const positions = positionByParent(node.parents);
    const dimsTemplate =
      frozenPassthroughKey === null ? [] : frozenTemplateParentIds.map((parentId) => localContext.model.card(parentId));
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indexCanonical = decodeRowIndex(rowIndex, dimsCanonical);
      const contextIndex = frozenContextParentIds.map((parentId) => indexCanonical[positionOf(positions, parentId)]);
      const contextKey = indexTupleKey(contextIndex);
      if (frozenPassthroughKey !== null && contextKey === frozenPassthroughKey) {
        const indexTemplate = frozenTemplateParentIds.map(
          (parentId) => indexCanonical[positionOf(positions, parentId)],
        );
        const start = encodeRowIndex(indexTemplate, dimsTemplate) * childCard;
        appendValues(output, frozenTemplateTable.slice(start, start + childCard));
        continue;
      }
      const row = frozenRowMap.get(contextKey);
      if (row === undefined) {
        throw valueError(
          `Node '${node.nodeId}' missing context->PIF CPT row for index tuple ${tupleRepr(contextIndex)}.`,
        );
      }
      if (row.length !== childCard) {
        throw valueError(
          `Node '${node.nodeId}' row length mismatch: got ${row.length}, ` + `expected ${text(childCard)}.`,
        );
      }
      appendValues(output, row);
    }
    return output;
  };
};

interface FinalOutputInput {
  templateHfeKey: string;
  feasibilityParentId: string | null;
  infeasibleStates: readonly string[];
  failureStateIndex: number;
  binary: boolean;
}

const makeFinalOutputCpdGenerator = (input: FinalOutputInput): CpdGenerator => {
  const frozenTemplateHfeKey = input.templateHfeKey;
  const frozenFeasibilityParentId = input.feasibilityParentId;
  const frozenInfeasibleStates = new Set(input.infeasibleStates);
  const frozenFailureIndex = input.failureStateIndex;
  const binary = input.binary;
  return (localContext: ModelContext, node: NodeRecord): number[] => {
    const templateHfeId = localContext.registry.nodeId(frozenTemplateHfeKey);
    if (!node.parents.includes(templateHfeId)) {
      throw valueError(`Node '${node.nodeId}' missing template HFE parent '${templateHfeId}'.`);
    }
    const positionTemplate = node.parents.indexOf(templateHfeId);
    let positionFeasibility: number | null = null;
    let feasibilityStates: string[] | null = null;
    if (frozenFeasibilityParentId !== null) {
      if (!node.parents.includes(frozenFeasibilityParentId)) {
        throw valueError(`Node '${node.nodeId}' missing feasibility parent '${frozenFeasibilityParentId}'.`);
      }
      positionFeasibility = node.parents.indexOf(frozenFeasibilityParentId);
      feasibilityStates = localContext.model.node(frozenFeasibilityParentId).states;
    }
    const dims = node.parents.map((parentId) => localContext.model.card(parentId));
    const rows = localContext.model.parentConfigurationCount(node.nodeId);
    const childCard = localContext.model.card(node.nodeId);
    const output: number[] = [];
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const indices = decodeRowIndex(rowIndex, dims);
      const sourceStateIndex = indices[positionTemplate];
      let infeasible = false;
      if (positionFeasibility !== null && feasibilityStates !== null) {
        infeasible = frozenInfeasibleStates.has(feasibilityStates[indices[positionFeasibility]]);
      }
      if (binary) {
        const fail = infeasible || sourceStateIndex === frozenFailureIndex;
        appendValues(output, fail ? [0, 1] : [1, 0]);
        continue;
      }
      const row = new Array<number>(childCard).fill(0);
      if (infeasible) row[frozenFailureIndex] = 1;
      else row[sourceStateIndex] = 1;
      appendValues(output, row);
    }
    return output;
  };
};

class HraBuilder extends BuilderBase {
  private templateCache: TemplateModel | null = null;

  get builderType(): string {
    return "hra";
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    const template = this.loadTemplate();
    const events = this.eventRecords();
    const dependencies = this.resolveDependencies(events);
    const sharedContextSpecs = this.resolveSharedContextSpecs();
    for (const context of sharedContextSpecs.values()) {
      for (const key of context.parentKeys) required.add(key);
    }
    const eventFinalKeys = new Set(events.map((record) => record.finalKey));
    for (const dependencyContexts of dependencies.contextsByTarget.values()) {
      for (const dependencyContext of dependencyContexts) {
        if (!eventFinalKeys.has(dependencyContext.sourceFailedKey)) required.add(dependencyContext.sourceFailedKey);
      }
    }
    for (const record of events) {
      const event = record.event;
      const hfeId = record.hfeId;
      const hazardSpec = this.resolveHazardInfluence({
        event,
        hfeId,
        hfeSegment: record.hfeSegment,
        nodeIdPrefix: record.nodeIdPrefix,
        template,
        templateHfeNodeId: this.templateHfeNodeId(event),
        sharedContextIds: new Set(sharedContextSpecs.keys()),
        dependencyContextIds: HraBuilder.dependencyContextIds(dependencies, record.hfeSegment),
      });
      if (hazardSpec !== null) {
        for (const context of hazardSpec.contextSpecs) {
          for (const key of context.parentKeys) required.add(key);
        }
      }
      const feasibility = getValue(event, "feasibility");
      if (feasibility === null) continue;
      if (!isMapping(feasibility)) {
        throw valueError(`hra.hfe_events[${hfeId}].feasibility must be a mapping/object.`);
      }
      required.add(requireText(getValue(feasibility, "parent_key"), `hfe_events[${hfeId}].feasibility.parent_key`));
    }
    return required;
  }

  get provides(): Set<string> {
    const template = this.loadTemplate();
    const output = new Set<string>();
    const events = this.eventRecords();
    const dependencies = this.resolveDependencies(events);
    const sharedContextSpecs = this.resolveSharedContextSpecs();
    for (const context of sharedContextSpecs.values()) output.add(context.key);
    for (const dependencyContexts of dependencies.contextsByTarget.values()) {
      for (const dependencyContext of dependencyContexts) output.add(dependencyContext.key);
    }
    for (const record of events) {
      const event = record.event;
      const hfeId = record.hfeId;
      const hfeSegment = record.hfeSegment;
      const templateHfeNodeId = this.templateHfeNodeId(event);
      const hazardSpec = this.resolveHazardInfluence({
        event,
        hfeId,
        hfeSegment,
        nodeIdPrefix: record.nodeIdPrefix,
        template,
        templateHfeNodeId,
        sharedContextIds: new Set(sharedContextSpecs.keys()),
        dependencyContextIds: HraBuilder.dependencyContextIds(dependencies, hfeSegment),
      });
      if (hazardSpec !== null) {
        for (const context of hazardSpec.contextSpecs) output.add(context.key);
      }
      const cfmIds = this.cfmIds(template);
      const activeCfms = HraBuilder.resolveActiveCfms(event, hfeId, cfmIds);
      const sparseActiveCfmsOnly = this.resolveSparseActiveCfmsOnlyMode(event);
      const keepTemplateNodeIds = HraBuilder.resolveTemplateKeepNodes({
        template,
        templateHfeNodeId,
        cfmIds,
        activeCfms,
        hazardSpec,
        sparseActiveCfmsOnly,
      });
      for (const templateNodeId of template.nodeOrder) {
        if (keepTemplateNodeIds.has(templateNodeId)) output.add(templateNodeKey(hfeSegment, templateNodeId));
      }
      output.add(finalFailedKey(hfeSegment));
    }
    return output;
  }

  build(context: ModelContext): void {
    const template = this.loadTemplate();
    const events = this.eventRecords();
    const eventBySegment = new Map(events.map((record) => [record.hfeSegment, record]));
    const dependencies = this.resolveDependencies(events);
    const sharedContextSpecs = this.resolveSharedContextSpecs();
    const sharedContextNodeIdById = HraBuilder.buildSharedContextNodes(context, sharedContextSpecs);

    for (const hfeSegment of dependencies.orderedHfeSegments) {
      const record = eventBySegment.get(hfeSegment);
      if (record === undefined) continue;
      this.buildEvent(context, template, record, dependencies, sharedContextSpecs, sharedContextNodeIdById);
    }
  }

  private buildEvent(
    context: ModelContext,
    template: TemplateModel,
    record: EventRecord,
    dependencies: DependenciesSpec,
    sharedContextSpecs: Map<string, ContextSpec>,
    sharedContextNodeIdById: Map<string, string>,
  ): void {
    const event = record.event;
    const hfeId = record.hfeId;
    const hfeSegment = record.hfeSegment;
    const nodeIdPrefix = record.nodeIdPrefix;

    const templateHfeNodeId = this.templateHfeNodeId(event);
    const templateHfeNode = template.nodeMap.get(templateHfeNodeId);
    if (templateHfeNode === undefined) {
      throw valueError(
        `hra.hfe_events[${hfeId}] template_hfe_node_id '${templateHfeNodeId}' ` +
          `not found in template '${this.templatePath()}'.`,
      );
    }

    const cfmIds = this.cfmIds(template);
    const activeCfms = HraBuilder.resolveActiveCfms(event, hfeId, cfmIds);

    const cfmSuccessState = strippedTextOr(
      getValueOr(event, "cfm_success_state", getValueOr(this.config, "cfm_success_state", "HSE")),
      "HSE",
    );
    const cfmFailureState = strippedTextOr(
      getValueOr(event, "cfm_failure_state", getValueOr(this.config, "cfm_failure_state", "HFE")),
      "HFE",
    );
    const inactivePolicy = strippedText(
      getValueOr(event, "inactive_cfm_policy", getValueOr(this.config, "inactive_cfm_policy", "force_success")),
    ).toLowerCase();
    if (inactivePolicy !== "force_success") {
      throw valueError(`hra.hfe_events[${hfeId}] unsupported inactive_cfm_policy '${inactivePolicy}'.`);
    }
    const sparseActiveCfmsOnly = this.resolveSparseActiveCfmsOnlyMode(event);

    const dependencyContextSpecs = dependencies.contextsByTarget.get(hfeSegment) ?? [];
    const hazardSpec = this.resolveHazardInfluence({
      event,
      hfeId,
      hfeSegment,
      nodeIdPrefix,
      template,
      templateHfeNodeId,
      sharedContextIds: new Set(sharedContextSpecs.keys()),
      dependencyContextIds: HraBuilder.dependencyContextIds(dependencies, hfeSegment),
    });
    const contextNodeIdById = new Map(sharedContextNodeIdById);
    const dependencyContextNodeIds = HraBuilder.buildDependencyContextNodesForEvent(
      context,
      hfeId,
      dependencyContextSpecs,
    );
    for (const [contextId, nodeId] of dependencyContextNodeIds) contextNodeIdById.set(contextId, nodeId);
    if (hazardSpec !== null) {
      const localContextIds = HraBuilder.buildContextNodesForEvent(context, hfeId, hazardSpec);
      for (const [contextId, nodeId] of localContextIds) {
        if (contextNodeIdById.has(contextId)) {
          throw valueError(
            `hra.hfe_events[${hfeId}] context_id '${contextId}' collides with ` + "shared/dependency context.",
          );
        }
        contextNodeIdById.set(contextId, nodeId);
      }
    }

    const keepTemplateNodeIds = HraBuilder.resolveTemplateKeepNodes({
      template,
      templateHfeNodeId,
      cfmIds,
      activeCfms,
      hazardSpec,
      sparseActiveCfmsOnly,
    });

    const instantiatedIdByTemplateId = new Map<string, string>();
    for (const templateNodeId of template.nodeOrder) {
      if (!keepTemplateNodeIds.has(templateNodeId)) continue;
      const templateNode = template.nodeMap.get(templateNodeId);
      if (templateNode === undefined) continue;
      const instNodeId = `${nodeIdPrefix}__${nodeIdToken(templateNodeId)}`;
      const key = templateNodeKey(hfeSegment, templateNodeId);

      const isCfm = cfmIds.includes(templateNodeId);
      const forceInactive = isCfm && !activeCfms.has(templateNodeId);
      const pifMapping = hazardSpec === null ? null : (hazardSpec.pifMappings.get(templateNodeId) ?? null);

      const missingTemplateParents = templateNode.parents.filter((parent) => !instantiatedIdByTemplateId.has(parent));
      const parentInstIdsTemplateOrder: string[] = [];
      for (const parent of templateNode.parents) {
        const instantiated = instantiatedIdByTemplateId.get(parent);
        if (instantiated !== undefined) parentInstIdsTemplateOrder.push(instantiated);
      }
      const isSparseAggregate = sparseActiveCfmsOnly && templateNodeId === templateHfeNodeId;
      if (missingTemplateParents.length > 0 && !isSparseAggregate) {
        throw valueError(
          `hra.hfe_events[${hfeId}] node '${templateNodeId}' is missing required parents ` +
            `${tupleRepr(missingTemplateParents)} in instantiated subgraph.`,
        );
      }
      let contextParentIdsOrder: string[] = [];
      if (pifMapping !== null) {
        contextParentIdsOrder = pifMapping.contextIds.map((contextId) =>
          HraBuilder.contextNodeId(contextNodeIdById, contextId),
        );
      }
      const parentIds = [...parentInstIdsTemplateOrder, ...contextParentIdsOrder];
      const childCard = templateNode.states.length;

      let cpdGenerator: CpdGenerator;
      if (forceInactive) {
        if (!templateNode.states.includes(cfmSuccessState)) {
          throw valueError(
            `hra.hfe_events[${hfeId}] inactive CFM '${templateNodeId}' ` +
              `cannot be forced to success: state '${cfmSuccessState}' missing in ` +
              `${tupleRepr(templateNode.states)}.`,
          );
        }
        if (!templateNode.states.includes(cfmFailureState)) {
          throw valueError(
            `hra.hfe_events[${hfeId}] CFM '${templateNodeId}' missing failure state ` +
              `'${cfmFailureState}' in ${tupleRepr(templateNode.states)}.`,
          );
        }
        cpdGenerator = makeForceStateCpdGenerator(templateNode.states.indexOf(cfmSuccessState), childCard);
      } else if (pifMapping !== null) {
        const mappingLabel = `hfe_events[${hfeId}].hazard_influence.pif_mappings[${templateNodeId}]`;
        const rowByContextIndices = resolveRowByIndices({
          rowByStateTuple: pifMapping.rowByContextStates,
          orderedParentLabels: pifMapping.contextIds,
          orderedParentStates: contextParentIdsOrder.map((parentId) => context.model.node(parentId).states),
          label: mappingLabel,
        });
        let passthroughContextIndices: number[] | null = null;
        if (pifMapping.templatePassthroughWhenContextStates !== null) {
          passthroughContextIndices = resolveContextStateIndices(
            pifMapping.templatePassthroughWhenContextStates,
            pifMapping.contextIds,
            contextParentIdsOrder.map((parentId) => context.model.node(parentId).states),
            `${mappingLabel}.template_passthrough_when`,
          );
        }
        cpdGenerator = makeContextOverrideCpdGenerator({
          templateParentInstIds: parentInstIdsTemplateOrder,
          contextParentInstIds: contextParentIdsOrder,
          rowByContextIndices,
          passthroughContextIndices,
          templateTable: templateNode.table,
          childCard,
        });
      } else if (isSparseAggregate && missingTemplateParents.length > 0) {
        const fixedParentStateIndexByTemplateParent = new Map<string, number>();
        const templateParentCardByParent = new Map<string, number>();
        const presentParentInstIdByTemplateParent = new Map<string, string>();
        for (const parent of templateNode.parents) {
          const parentNode = template.nodeMap.get(parent);
          if (parentNode === undefined) continue;
          templateParentCardByParent.set(parent, parentNode.states.length);
          const instantiated = instantiatedIdByTemplateId.get(parent);
          if (instantiated !== undefined) {
            presentParentInstIdByTemplateParent.set(parent, instantiated);
            continue;
          }
          if (!cfmIds.includes(parent)) {
            throw valueError(
              `hra.hfe_events[${hfeId}] sparse active CFM mode cannot remove non-CFM parent ` +
                `'${parent}' from '${templateHfeNodeId}'.`,
            );
          }
          if (!parentNode.states.includes(cfmSuccessState)) {
            throw valueError(
              `hra.hfe_events[${hfeId}] sparse active CFM mode cannot fix parent '${parent}' ` +
                `to success state '${cfmSuccessState}' because states are ${tupleRepr(parentNode.states)}.`,
            );
          }
          fixedParentStateIndexByTemplateParent.set(parent, parentNode.states.indexOf(cfmSuccessState));
        }
        cpdGenerator = makeProjectedTemplateCpdGenerator({
          templateParentIds: templateNode.parents,
          presentParentInstIdByTemplateParent,
          fixedParentStateIndexByTemplateParent,
          templateParentCardByParent,
          templateTable: templateNode.table,
          childCard,
        });
      } else {
        cpdGenerator = makeTemplateCpdGenerator(parentInstIdsTemplateOrder, templateNode.table, childCard);
      }

      context.model.addNode({
        key,
        nodeId: instNodeId,
        states: templateNode.states,
        metadata: {
          builder: "hra",
          kind: "template_node",
          hfe_id: hfeId,
          template_node_id: templateNodeId,
          display_name: `${hfeId}:${templateNodeId}`,
          is_cfm: isCfm,
          cfm_active: isCfm ? !forceInactive : null,
          sparse_active_cfms_only: sparseActiveCfmsOnly,
          hazard_influenced: pifMapping !== null,
          hazard_context_ids: pifMapping !== null ? Array.from(pifMapping.contextIds) : [],
        },
        parentIds,
        cpdGenerator,
      });
      context.registry.register(key, instNodeId);
      instantiatedIdByTemplateId.set(templateNodeId, instNodeId);
    }

    const templateHfeKey = templateNodeKey(hfeSegment, templateHfeNodeId);
    const templateHfeInstId = instantiatedIdByTemplateId.get(templateHfeNodeId) ?? "";
    const templateHfeStates = templateHfeNode.states;

    const outputFailureState = strippedTextOr(
      getValueOr(event, "output_failure_state", getValueOr(this.config, "output_failure_state", cfmFailureState)),
      cfmFailureState,
    );
    if (!templateHfeStates.includes(outputFailureState)) {
      throw valueError(
        `hra.hfe_events[${hfeId}] output_failure_state '${outputFailureState}' ` +
          `missing in template HFE states ${tupleRepr(templateHfeStates)}.`,
      );
    }
    const failureStateIndex = templateHfeStates.indexOf(outputFailureState);
    const outputBinary = truthy(getValueOr(event, "output_binary", getValueOr(this.config, "output_binary", true)));

    const finalKey = strippedTextOr(getValueOr(event, "final_key", ""), finalFailedKey(hfeSegment));
    const finalNodeId = strippedTextOr(getValueOr(event, "final_node_id", ""), `${nodeIdPrefix}_FAILED`);

    const feasibility = getValue(event, "feasibility");
    let feasibilityParentId: string | null = null;
    let infeasibleStates: string[] = [];
    if (feasibility !== null) {
      if (!isMapping(feasibility)) {
        throw valueError(`hra.hfe_events[${hfeId}].feasibility must be mapping/object.`);
      }
      const parentKey = requireText(getValue(feasibility, "parent_key"), `hfe_events[${hfeId}].feasibility.parent_key`);
      if (!context.registry.hasKey(parentKey)) {
        throw valueError(`hra.hfe_events[${hfeId}] feasibility parent key '${parentKey}' is unavailable.`);
      }
      feasibilityParentId = context.registry.nodeId(parentKey);
      const parentStates = context.model.node(feasibilityParentId).states;
      const rawInfeasibleStates = getValueOr(feasibility, "infeasible_states", ["True"]);
      if (!isSequence(rawInfeasibleStates) || rawInfeasibleStates.length === 0) {
        throw valueError(`hra.hfe_events[${hfeId}].feasibility.infeasible_states must be non-empty list-like.`);
      }
      infeasibleStates = rawInfeasibleStates.map((item) => text(item));
      const missing = infeasibleStates.filter((state) => !parentStates.includes(state));
      if (missing.length > 0) {
        throw valueError(
          `hra.hfe_events[${hfeId}] infeasible_states ${repr(missing)} not present in feasibility parent ` +
            `states ${tupleRepr(parentStates)}.`,
        );
      }
    }

    const finalParentIds = [templateHfeInstId];
    if (feasibilityParentId !== null) finalParentIds.push(feasibilityParentId);

    context.model.addNode({
      key: finalKey,
      nodeId: finalNodeId,
      states: outputBinary ? ["False", "True"] : templateHfeStates,
      metadata: {
        builder: "hra",
        kind: "hfe_output",
        hfe_id: hfeId,
        template_hfe_node_id: templateHfeNodeId,
        output_failure_state: outputFailureState,
        output_binary: outputBinary,
        sparse_active_cfms_only: sparseActiveCfmsOnly,
        display_name: `${hfeId}:HFE_FAILED`,
        true_means: outputBinary ? "hfe_failure" : "hfe_failure_state",
      },
      parentIds: finalParentIds,
      cpdGenerator: makeFinalOutputCpdGenerator({
        templateHfeKey,
        feasibilityParentId,
        infeasibleStates,
        failureStateIndex,
        binary: outputBinary,
      }),
    });
    context.registry.register(finalKey, finalNodeId);
  }

  private static contextNodeId(contextNodeIdById: Map<string, string>, contextId: string): string {
    const nodeId = contextNodeIdById.get(contextId);
    if (nodeId === undefined) throw keyError(contextId);
    return nodeId;
  }

  private static dependencyContextIds(dependencies: DependenciesSpec, hfeSegment: string): Set<string> {
    return new Set((dependencies.contextsByTarget.get(hfeSegment) ?? []).map((item) => item.contextId));
  }

  private templateHfeNodeId(event: SpecMapping): string {
    return strippedTextOr(
      getValueOr(event, "template_hfe_node_id", getValueOr(this.config, "template_hfe_node_id", "HFE")),
      "HFE",
    );
  }

  private cfmIds(template: TemplateModel): string[] {
    const cfmPrefix = strippedTextOr(getValueOr(this.config, "cfm_prefix", "CFM_"), "CFM_");
    return template.nodeOrder.filter((nodeId) => nodeId.startsWith(cfmPrefix));
  }

  private resolveSparseActiveCfmsOnlyMode(event: SpecMapping): boolean {
    return parseBoolean(
      getValueOr(event, "active_cfm_only_mode", getValueOr(this.config, "active_cfm_only_mode", false)),
    );
  }

  private static resolveTemplateKeepNodes(input: KeepNodesInput): Set<string> {
    const { template, templateHfeNodeId, cfmIds, activeCfms, hazardSpec, sparseActiveCfmsOnly } = input;
    if (!sparseActiveCfmsOnly) return new Set(template.nodeOrder);

    const templateHfeNode = template.nodeMap.get(templateHfeNodeId);
    if (templateHfeNode === undefined) {
      throw valueError(`hra sparse mode: template_hfe_node_id '${templateHfeNodeId}' not found in template.`);
    }

    const cfmSet = new Set(cfmIds);
    const seedNodes = new Set(activeCfms);
    if (hazardSpec !== null) {
      for (const key of hazardSpec.pifMappings.keys()) seedNodes.add(key);
    }
    for (const parentId of templateHfeNode.parents) {
      if (!cfmSet.has(parentId)) seedNodes.add(parentId);
    }

    const keep = new Set<string>();
    const stack = Array.from(seedNodes);
    while (stack.length > 0) {
      const nodeId = stack.pop() ?? "";
      if (keep.has(nodeId)) continue;
      const node = template.nodeMap.get(nodeId);
      if (node === undefined) {
        throw valueError(`hra sparse mode: seed node '${nodeId}' is not present in template.`);
      }
      keep.add(nodeId);
      for (const parentId of node.parents) {
        if (!keep.has(parentId)) stack.push(parentId);
      }
    }

    keep.add(templateHfeNodeId);
    return keep;
  }

  private hfeEvents(): SpecMapping[] {
    const raw = getValue(this.config, "hfe_events");
    if (!isSequence(raw) || raw.length === 0) {
      throw valueError("hra builder requires non-empty 'hfe_events' list.");
    }
    const output: SpecMapping[] = [];
    raw.forEach((item, index) => {
      if (!isMapping(item)) throw valueError(`hra.hfe_events[${index}] must be mapping/object.`);
      output.push(item);
    });
    return output;
  }

  private eventRecords(): EventRecord[] {
    const records: EventRecord[] = [];
    const seenSegments = new Set<string>();
    this.hfeEvents().forEach((event, index) => {
      const hfeId = requireText(getValue(event, "hfe_id"), "hfe_events[].hfe_id");
      const hfeSegment = slug(hfeId);
      if (seenSegments.has(hfeSegment)) {
        throw valueError(`Duplicate HFE key segment '${hfeSegment}' (from hfe_id '${hfeId}').`);
      }
      seenSegments.add(hfeSegment);

      let nodeIdPrefix = strippedText(getValueOr(event, "node_id_prefix", ""));
      if (nodeIdPrefix.length === 0) nodeIdPrefix = `HRA_${nodeIdToken(hfeSegment).toUpperCase()}`;

      const finalKey = strippedTextOr(getValueOr(event, "final_key", ""), finalFailedKey(hfeSegment));
      records.push({ index, hfeId, hfeSegment, nodeIdPrefix, finalKey, event });
    });
    return records;
  }

  private resolveDependencies(events: readonly EventRecord[]): DependenciesSpec {
    const eventsBySegment = new Map(events.map((record) => [record.hfeSegment, record]));
    const eventIndex = new Map(events.map((record) => [record.hfeSegment, record.index]));
    if (eventsBySegment.size !== events.length) {
      throw valueError("Internal HRA error: duplicate event segments in dependency resolution.");
    }

    const entries = normalizeNamedEntries(getValueOr(this.config, "dependencies", []), "dependencies", ["id"]);
    if (entries.length === 0) {
      return { orderedHfeSegments: events.map((record) => record.hfeSegment), contextsByTarget: new Map() };
    }

    const edges = new Map<string, Set<string>>(events.map((record) => [record.hfeSegment, new Set<string>()]));
    const indegree = new Map<string, number>(events.map((record) => [record.hfeSegment, 0]));
    const contextsByTarget = new Map<string, DependencyContextSpec[]>();
    const contextIdsByTarget = new Map<string, Set<string>>();

    entries.forEach((item, index) => {
      const sourceHfe = requireText(
        getValueOr(item, "source_hfe", getValue(item, "source")),
        `dependencies[${index}].source_hfe`,
      );
      const targetHfe = requireText(
        getValueOr(item, "target_hfe", getValue(item, "target")),
        `dependencies[${index}].target_hfe`,
      );
      const sourceSegment = slug(sourceHfe);
      const targetSegment = slug(targetHfe);
      const sourceRecord = eventsBySegment.get(sourceSegment);
      if (sourceRecord === undefined) {
        throw valueError(`hra.dependencies[${index}] source_hfe '${sourceHfe}' is not defined in hfe_events.`);
      }
      const targetRecord = eventsBySegment.get(targetSegment);
      if (targetRecord === undefined) {
        throw valueError(`hra.dependencies[${index}] target_hfe '${targetHfe}' is not defined in hfe_events.`);
      }
      if (sourceSegment === targetSegment) {
        throw valueError(`hra.dependencies[${index}] source_hfe and target_hfe cannot be the same ('${sourceHfe}').`);
      }

      const sourceEdges = edges.get(sourceSegment) ?? new Set<string>();
      if (!sourceEdges.has(targetSegment)) {
        sourceEdges.add(targetSegment);
        edges.set(sourceSegment, sourceEdges);
        indegree.set(targetSegment, (indegree.get(targetSegment) ?? 0) + 1);
      }

      let sourceFailedKey = strippedText(getValueOr(item, "source_failed_key", ""));
      if (sourceFailedKey.length === 0) sourceFailedKey = sourceRecord.finalKey;

      const carryoverEntries = normalizeNamedEntries(
        getValueOr(item, "carryover_contexts", []),
        `dependencies[${sourceHfe}->${targetHfe}].carryover_contexts`,
        ["context_id", "id"],
      );
      if (carryoverEntries.length === 0) {
        throw valueError(`hra.dependencies[${index}] requires non-empty carryover_contexts.`);
      }

      const targetPrefix = targetRecord.nodeIdPrefix;
      let targetContextIds = contextIdsByTarget.get(targetSegment);
      if (targetContextIds === undefined) {
        targetContextIds = new Set<string>();
        contextIdsByTarget.set(targetSegment, targetContextIds);
      }
      let targetContextSpecs = contextsByTarget.get(targetSegment);
      if (targetContextSpecs === undefined) {
        targetContextSpecs = [];
        contextsByTarget.set(targetSegment, targetContextSpecs);
      }
      const seenContextIds = targetContextIds;
      const contextSpecs = targetContextSpecs;
      carryoverEntries.forEach((carryover, carryoverIndex) => {
        const contextId = requireText(
          getValueOr(carryover, "context_id", getValue(carryover, "id")),
          `dependencies[${index}].carryover_contexts[${carryoverIndex}].context_id`,
        );
        if (seenContextIds.has(contextId)) {
          throw valueError(
            `hra.dependencies[${index}] duplicate carryover context_id '${contextId}' ` +
              `for target_hfe '${targetHfe}'.`,
          );
        }
        seenContextIds.add(contextId);

        const states = parseStates(
          getValue(carryover, "states"),
          `dependencies[${index}].carryover_contexts[${contextId}].states`,
        );
        const rowBySourceStates = parseRowTable({
          rowsRaw: getValue(carryover, "rows"),
          orderedParentLabels: ["source_state"],
          childStates: states,
          label: `dependencies[${index}].carryover_contexts[${contextId}]`,
        });

        const key = strippedTextOr(
          getValueOr(carryover, "key", ""),
          `hra.hfe.${targetSegment}.context.${slug(contextId)}`,
        );
        const nodeId = strippedTextOr(
          getValueOr(carryover, "node_id", ""),
          `${targetPrefix}__DEP_${nodeIdToken(contextId).toUpperCase()}`,
        );
        contextSpecs.push({
          sourceHfeId: sourceRecord.hfeId,
          sourceHfeSegment: sourceSegment,
          sourceFailedKey,
          targetHfeId: targetRecord.hfeId,
          targetHfeSegment: targetSegment,
          contextId,
          key,
          nodeId,
          states,
          rowBySourceStates,
        });
      });
    });

    const indexOf = (segment: string): number => eventIndex.get(segment) ?? 0;
    const compareByIndex = (left: string, right: string): number => indexOf(left) - indexOf(right);
    let ready: string[] = [];
    for (const [segment, degree] of indegree) {
      if (degree === 0) ready.push(segment);
    }
    const ordered: string[] = [];
    while (ready.length > 0) {
      ready = ready.sort(compareByIndex);
      const segment = ready[0];
      ready = ready.slice(1);
      ordered.push(segment);
      for (const child of Array.from(edges.get(segment) ?? []).sort(compareByIndex)) {
        const remaining = (indegree.get(child) ?? 0) - 1;
        indegree.set(child, remaining);
        if (remaining === 0) ready.push(child);
      }
    }

    if (ordered.length !== events.length) {
      const cyclic = sortedText(
        Array.from(indegree.entries())
          .filter(([, degree]) => degree > 0)
          .map(([segment]) => segment),
      );
      throw valueError("hra.dependencies introduces a cycle among HFEs. " + `Cyclic nodes: ${repr(cyclic)}`);
    }

    return { orderedHfeSegments: ordered, contextsByTarget };
  }

  private resolveSharedContextSpecs(): Map<string, ContextSpec> {
    let rawContexts = getValue(this.config, "shared_hazard_contexts");
    if (rawContexts === null) {
      const rawShared = getValue(this.config, "shared_hazard_influence");
      if (isMapping(rawShared)) rawContexts = getValue(rawShared, "contexts");
    }
    const output = new Map<string, ContextSpec>();
    if (rawContexts === null) return output;

    const entries = normalizeNamedEntries(rawContexts, "shared_hazard_contexts", ["context_id", "id"]);
    entries.forEach((item, index) => {
      const contextId = requireText(
        getValueOr(item, "context_id", getValue(item, "id")),
        `shared_hazard_contexts[${index}].context_id`,
      );
      if (output.has(contextId)) {
        throw valueError(`hra.shared_hazard_contexts duplicate context_id '${contextId}'.`);
      }
      const states = parseStates(getValue(item, "states"), `shared_hazard_contexts[${contextId}].states`);
      const parentKeys = parseTextList(getValueOr(item, "parents", []), `shared_hazard_contexts[${contextId}].parents`);
      const rowByParentStates = parseRowTable({
        rowsRaw: getValue(item, "rows"),
        orderedParentLabels: parentKeys,
        childStates: states,
        label: `shared_hazard_contexts[${contextId}]`,
      });
      const key = strippedTextOr(getValueOr(item, "key", ""), `hra.context.${slug(contextId)}`);
      const nodeId = strippedTextOr(getValueOr(item, "node_id", ""), `HRA_CTX_${nodeIdToken(contextId).toUpperCase()}`);
      output.set(contextId, { contextId, key, nodeId, states, parentKeys, rowByParentStates });
    });
    return output;
  }

  private static resolveActiveCfms(event: SpecMapping, hfeId: string, cfmIds: readonly string[]): Set<string> {
    const raw = getValue(event, "active_cfms_override");
    if (raw === null) return new Set(cfmIds);
    if (!isSequence(raw)) throw valueError(`hra.hfe_events[${hfeId}].active_cfms_override must be list-like.`);

    const cfmSet = new Set(cfmIds);
    const output = new Set<string>();
    for (const token of raw) {
      const cleaned = requireText(token, `hfe_events[${hfeId}].active_cfms_override[]`);
      if (cfmSet.has(cleaned)) {
        output.add(cleaned);
        continue;
      }
      const expanded = `CFM_${cleaned}`;
      if (cfmSet.has(expanded)) {
        output.add(expanded);
        continue;
      }
      throw valueError(
        `hra.hfe_events[${hfeId}] unknown CFM '${cleaned}'. Supported CFMs: ${repr(sortedText(cfmSet))}`,
      );
    }
    return output;
  }

  private resolveHazardInfluence(input: HazardInfluenceInput): HazardInfluenceSpec | null {
    const { event, hfeId, hfeSegment, nodeIdPrefix, template, templateHfeNodeId } = input;
    const { sharedContextIds, dependencyContextIds } = input;
    const raw = getValue(event, "hazard_influence");
    if (raw === null) return null;
    if (!isMapping(raw)) throw valueError(`hra.hfe_events[${hfeId}].hazard_influence must be mapping/object.`);

    const contextEntries = normalizeNamedEntries(
      getValueOr(raw, "contexts", []),
      `hfe_events[${hfeId}].hazard_influence.contexts`,
      ["context_id", "id"],
    );

    const contextSpecs: ContextSpec[] = [];
    const contextIdsSeen = new Set<string>();
    contextEntries.forEach((item, index) => {
      const contextId = requireText(
        getValueOr(item, "context_id", getValue(item, "id")),
        `hfe_events[${hfeId}].hazard_influence.contexts[${index}].context_id`,
      );
      if (contextIdsSeen.has(contextId)) {
        throw valueError(`hra.hfe_events[${hfeId}] duplicate context_id '${contextId}' in hazard_influence.contexts.`);
      }
      if (sharedContextIds.has(contextId)) {
        throw valueError(
          `hra.hfe_events[${hfeId}] context_id '${contextId}' is already defined as shared ` +
            "context; remove local duplicate and reference shared context_id in pif_mappings.",
        );
      }
      if (dependencyContextIds.has(contextId)) {
        throw valueError(
          `hra.hfe_events[${hfeId}] context_id '${contextId}' is already defined as dependency ` +
            "context; remove local duplicate and reference dependency context_id in pif_mappings.",
        );
      }
      contextIdsSeen.add(contextId);

      const contextLabel = `hfe_events[${hfeId}].hazard_influence.contexts[${contextId}]`;
      const states = parseStates(getValue(item, "states"), `${contextLabel}.states`);
      const parentKeys = parseTextList(getValueOr(item, "parents", []), `${contextLabel}.parents`);
      const rowByParentStates = parseRowTable({
        rowsRaw: getValue(item, "rows"),
        orderedParentLabels: parentKeys,
        childStates: states,
        label: contextLabel,
      });
      const key = strippedTextOr(getValueOr(item, "key", ""), `hra.hfe.${hfeSegment}.context.${slug(contextId)}`);
      const nodeId = strippedTextOr(
        getValueOr(item, "node_id", ""),
        `${nodeIdPrefix}__CTX_${nodeIdToken(contextId).toUpperCase()}`,
      );
      contextSpecs.push({ contextId, key, nodeId, states, parentKeys, rowByParentStates });
    });

    const contextIds = new Set<string>([
      ...contextSpecs.map((item) => item.contextId),
      ...sharedContextIds,
      ...dependencyContextIds,
    ]);
    const pifEntries = normalizeNamedEntries(
      getValueOr(raw, "pif_mapping", getValueOr(raw, "pif_mappings", [])),
      `hfe_events[${hfeId}].hazard_influence.pif_mappings`,
      ["template_node_id", "node_id"],
    );

    const pifSpecs = new Map<string, PifMappingSpec>();
    const cfmPrefix = strippedTextOr(getValueOr(this.config, "cfm_prefix", "CFM_"), "CFM_");
    pifEntries.forEach((item, index) => {
      const templateNodeId = requireText(
        getValueOr(item, "template_node_id", getValue(item, "node_id")),
        `hfe_events[${hfeId}].hazard_influence.pif_mappings[${index}].template_node_id`,
      );
      if (pifSpecs.has(templateNodeId)) {
        throw valueError(`hra.hfe_events[${hfeId}] duplicate pif mapping target '${templateNodeId}'.`);
      }
      const templateNode = template.nodeMap.get(templateNodeId);
      if (templateNode === undefined) {
        throw valueError(
          `hra.hfe_events[${hfeId}] pif mapping target '${templateNodeId}' ` + "not found in template nodes.",
        );
      }
      if (templateNodeId === templateHfeNodeId) {
        throw valueError(
          `hra.hfe_events[${hfeId}] pif mapping target '${templateNodeId}' ` +
            "cannot target the aggregate template HFE node.",
        );
      }
      if (templateNodeId.startsWith(cfmPrefix)) {
        throw valueError(
          `hra.hfe_events[${hfeId}] pif mapping target '${templateNodeId}' ` +
            "cannot target CFM nodes in H2A (target template PIF nodes instead).",
        );
      }

      const mappingLabel = `hfe_events[${hfeId}].hazard_influence.pif_mappings[${templateNodeId}]`;
      const contextIdsForTarget = parseTextList(
        getValueOr(item, "context_ids", getValueOr(item, "contexts", [])),
        `${mappingLabel}.context_ids`,
      );
      if (contextIdsForTarget.length === 0) {
        throw valueError(`hra.hfe_events[${hfeId}] pif mapping '${templateNodeId}' requires non-empty context_ids.`);
      }
      const missingContexts = contextIdsForTarget.filter((contextId) => !contextIds.has(contextId));
      if (missingContexts.length > 0) {
        throw valueError(
          `hra.hfe_events[${hfeId}] pif mapping '${templateNodeId}' references ` +
            `unknown context_ids ${repr(missingContexts)}.`,
        );
      }

      const rowByContextStates = parseRowTable({
        rowsRaw: getValue(item, "rows"),
        orderedParentLabels: contextIdsForTarget,
        childStates: templateNode.states,
        label: mappingLabel,
      });

      const passthroughWhenRaw = getValue(item, "template_passthrough_when");
      let templatePassthroughWhenContextStates: Map<string, string> | null = null;
      if (passthroughWhenRaw !== null) {
        if (!isMapping(passthroughWhenRaw)) {
          throw valueError(`hra.${mappingLabel}.template_passthrough_when must be mapping/object.`);
        }
        if (!sameMembers(keysOf(passthroughWhenRaw), contextIdsForTarget)) {
          throw valueError(
            `hra.${mappingLabel}` +
              ".template_passthrough_when must provide exactly context_ids " +
              `${repr(contextIdsForTarget)}.`,
          );
        }
        const passthroughStates = new Map<string, string>();
        for (const contextId of contextIdsForTarget) {
          passthroughStates.set(
            contextId,
            requireText(
              getValue(passthroughWhenRaw, contextId),
              `${mappingLabel}.template_passthrough_when[${contextId}]`,
            ),
          );
        }
        templatePassthroughWhenContextStates = passthroughStates;
      }

      pifSpecs.set(templateNodeId, {
        templateNodeId,
        contextIds: contextIdsForTarget,
        rowByContextStates,
        templatePassthroughWhenContextStates,
      });
    });

    if (pifSpecs.size > 0 && contextIds.size === 0) {
      throw valueError(`hra.hfe_events[${hfeId}] defines pif_mappings but no contexts.`);
    }
    return { contextSpecs, pifMappings: pifSpecs };
  }

  private static buildSharedContextNodes(
    context: ModelContext,
    sharedContextSpecs: Map<string, ContextSpec>,
  ): Map<string, string> {
    const contextNodeIds = new Map<string, string>();
    for (const [contextId, spec] of sharedContextSpecs) {
      HraBuilder.addContextNode(context, spec, `shared_hazard_contexts[${spec.contextId}]`, {
        builder: "hra",
        kind: "hazard_context_shared",
        context_scope: "shared",
        hfe_id: "",
        context_id: spec.contextId,
        display_name: `HRA:${spec.contextId}`,
      });
      contextNodeIds.set(contextId, spec.nodeId);
    }
    return contextNodeIds;
  }

  private static buildDependencyContextNodesForEvent(
    context: ModelContext,
    targetHfeId: string,
    dependencyContextSpecs: readonly DependencyContextSpec[],
  ): Map<string, string> {
    const contextNodeIds = new Map<string, string>();
    for (const spec of dependencyContextSpecs) {
      const sourceFailedKey = spec.sourceFailedKey;
      if (!context.registry.hasKey(sourceFailedKey)) {
        throw valueError(
          "hra.dependencies source_failed_key " +
            `'${sourceFailedKey}' is unavailable when building target_hfe ` +
            `'${targetHfeId}'.`,
        );
      }
      const sourceParentId = context.registry.nodeId(sourceFailedKey);
      const sourceParentStates = context.model.node(sourceParentId).states;
      const rowByParentIndices = resolveRowByIndices({
        rowByStateTuple: spec.rowBySourceStates,
        orderedParentLabels: ["source_state"],
        orderedParentStates: [sourceParentStates],
        label: "dependencies" + `[${spec.sourceHfeId}->${spec.targetHfeId}]` + `.carryover_contexts[${spec.contextId}]`,
      });
      context.model.addNode({
        key: spec.key,
        nodeId: spec.nodeId,
        states: spec.states,
        metadata: {
          builder: "hra",
          kind: "hazard_context_dependency",
          context_scope: "dependency",
          hfe_id: targetHfeId,
          context_id: spec.contextId,
          source_hfe_id: spec.sourceHfeId,
          source_hfe_segment: spec.sourceHfeSegment,
          source_failed_key: spec.sourceFailedKey,
          display_name: `${targetHfeId}:${spec.contextId}` + `<-${spec.sourceHfeId}`,
        },
        parentIds: [sourceParentId],
        cpdGenerator: makeRowLookupCpdGenerator([sourceParentId], rowByParentIndices, spec.states.length),
      });
      context.registry.register(spec.key, spec.nodeId);
      contextNodeIds.set(spec.contextId, spec.nodeId);
    }
    return contextNodeIds;
  }

  private static buildContextNodesForEvent(
    context: ModelContext,
    hfeId: string,
    hazardSpec: HazardInfluenceSpec,
  ): Map<string, string> {
    const contextNodeIds = new Map<string, string>();
    for (const spec of hazardSpec.contextSpecs) {
      HraBuilder.addContextNode(context, spec, `hfe_events[${hfeId}].hazard_influence.contexts[${spec.contextId}]`, {
        builder: "hra",
        kind: "hazard_context",
        hfe_id: hfeId,
        context_id: spec.contextId,
        display_name: `${hfeId}:${spec.contextId}`,
      });
      contextNodeIds.set(spec.contextId, spec.nodeId);
    }
    return contextNodeIds;
  }

  private static addContextNode(context: ModelContext, spec: ContextSpec, label: string, metadata: SpecMapping): void {
    const parentIds = spec.parentKeys.map((key) => context.registry.nodeId(key));
    const rowByParentIndices = resolveRowByIndices({
      rowByStateTuple: spec.rowByParentStates,
      orderedParentLabels: spec.parentKeys,
      orderedParentStates: parentIds.map((parentId) => context.model.node(parentId).states),
      label,
    });
    context.model.addNode({
      key: spec.key,
      nodeId: spec.nodeId,
      states: spec.states,
      metadata,
      parentIds,
      cpdGenerator: makeRowLookupCpdGenerator(parentIds, rowByParentIndices, spec.states.length),
    });
    context.registry.register(spec.key, spec.nodeId);
  }

  private loadTemplate(): TemplateModel {
    if (this.templateCache !== null) return this.templateCache;

    const path = this.templatePath();
    const order: string[] = [];
    const nodeMap = new Map<string, TemplateNode>();
    for (const entry of GENERIC_HFE_TEMPLATE) {
      const nodeId = strip(entry.id);
      if (nodeId.length === 0) {
        throw valueError(`Invalid hra template '${path}': encountered <cpt> with empty id.`);
      }
      if (nodeMap.has(nodeId)) {
        throw valueError(`Invalid hra template '${path}': duplicate node id '${nodeId}'.`);
      }
      const states = entry.states.map((state) => strip(state));
      if (states.length < 2 || states.some((state) => state.length === 0)) {
        throw valueError(`Invalid hra template '${path}': node '${nodeId}' must have at least 2 non-empty states.`);
      }
      if (entry.probabilities.length === 0) {
        throw valueError(`Invalid hra template '${path}': node '${nodeId}' missing <probabilities>.`);
      }
      order.push(nodeId);
      nodeMap.set(nodeId, {
        nodeId,
        states,
        parents: Array.from(entry.parents),
        table: Array.from(entry.probabilities),
      });
    }

    if (nodeMap.size === 0) throw valueError(`Invalid hra template '${path}': no <cpt> nodes found.`);

    for (const nodeId of order) {
      const templateNode = nodeMap.get(nodeId);
      if (templateNode === undefined) continue;
      let expected = templateNode.states.length;
      for (const parentId of templateNode.parents) {
        if (!nodeMap.has(parentId)) {
          throw valueError(`Invalid hra template '${path}': node '${nodeId}' references unknown parent '${parentId}'.`);
        }
      }
      for (const parentId of templateNode.parents) expected *= nodeMap.get(parentId)?.states.length ?? 0;
      if (templateNode.table.length !== expected) {
        throw valueError(
          `Invalid hra template '${path}': node '${nodeId}' probability count ${templateNode.table.length} ` +
            `does not match expected ${expected}.`,
        );
      }
    }

    this.templateCache = { nodeOrder: order, nodeMap };
    return this.templateCache;
  }

  private templatePath(): string {
    const raw = strippedText(getValueOr(this.config, "template_path", ""));
    if (raw.length === 0) return BUILT_IN_TEMPLATE_NAME;
    const segments = raw.split("\\").join("/").split("/");
    const fileName = segments[segments.length - 1];
    if (!BUILT_IN_TEMPLATE_FILE_NAMES.includes(fileName)) {
      throw valueError(
        `hra template_path '${raw}' is not supported because only the built-in ${BUILT_IN_TEMPLATE_NAME} ` +
          "template is available.",
      );
    }
    return BUILT_IN_TEMPLATE_NAME;
  }
}

export { HraBuilder };
