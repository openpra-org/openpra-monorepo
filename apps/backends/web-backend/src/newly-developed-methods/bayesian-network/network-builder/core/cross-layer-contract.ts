import type { ModelContext } from "./context";
import { crossLayerContractError } from "./errors";
import {
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  keysOf,
  repr,
  sortedText,
  strip,
  text,
} from "./spec-values";
import type { SpecMapping, SpecValue } from "./spec-values";

interface RequiredEdge {
  parentKey: string;
  childKey: string;
}

interface ParentSetRule {
  childKey: string;
  parentKeys: string[];
  mode: string;
}

interface OwnerRule {
  key: string;
  builderType: string;
}

interface CrossLayerContract {
  requiredKeys: string[];
  requiredEdges: RequiredEdge[];
  parentSets: ParentSetRule[];
  ownerRules: OwnerRule[];
}

const requireMapping = (value: SpecValue, label: string): SpecMapping => {
  if (!isMapping(value)) throw crossLayerContractError(`${label} must be an object/mapping.`);
  return value;
};

const requireSequence = (value: SpecValue, label: string): SpecValue[] => {
  if (!isSequence(value)) throw crossLayerContractError(`${label} must be a list/array.`);
  return value;
};

const requireNonEmptyText = (value: SpecValue, label: string): string => {
  if (typeof value !== "string" || strip(value).length === 0) {
    throw crossLayerContractError(`${label} must be a non-empty string.`);
  }
  return strip(value);
};

const parseTextList = (raw: SpecValue, label: string): string[] =>
  requireSequence(raw, label).map((item, index) => requireNonEmptyText(item, `${label}[${index}]`));

const listRepr = (values: Iterable<string>): string => repr(sortedText(values));

const parseCrossLayerContract = (raw: SpecValue): CrossLayerContract | null => {
  if (raw === null) return null;
  const data = requireMapping(raw, "metadata.cross_layer_contract");
  const requiredKeys = parseTextList(getValueOr(data, "required_keys", []), "required_keys");
  const requiredEdges = requireSequence(getValueOr(data, "required_edges", []), "required_edges").map((item, index) => {
    const row = requireMapping(item, `required_edges[${index}]`);
    const parentKey = requireNonEmptyText(getValue(row, "parent_key"), `required_edges[${index}].parent_key`);
    const childKey = requireNonEmptyText(getValue(row, "child_key"), `required_edges[${index}].child_key`);
    return { parentKey, childKey };
  });
  const parentSets = requireSequence(getValueOr(data, "parent_sets", []), "parent_sets").map((item, index) => {
    const row = requireMapping(item, `parent_sets[${index}]`);
    const childKey = requireNonEmptyText(getValue(row, "child_key"), `parent_sets[${index}].child_key`);
    const parentKeys = parseTextList(getValueOr(row, "parent_keys", []), `parent_sets[${index}].parent_keys`);
    const mode = strip(text(getValueOr(row, "mode", "exact"))).toLowerCase();
    if (mode !== "exact" && mode !== "at_least" && mode !== "at_most") {
      throw crossLayerContractError(`parent_sets[${index}].mode must be one of: exact, at_least, at_most.`);
    }
    return { childKey, parentKeys, mode };
  });
  const ownerRulesRaw = getValueOr(data, "key_owners", []);
  const ownerRules: OwnerRule[] = [];
  if (isMapping(ownerRulesRaw)) {
    for (const key of keysOf(ownerRulesRaw)) {
      ownerRules.push({
        key: requireNonEmptyText(key, "key_owners.<key>"),
        builderType: requireNonEmptyText(ownerRulesRaw[key], `key_owners[${key}]`),
      });
    }
  } else {
    requireSequence(ownerRulesRaw, "key_owners").forEach((item, index) => {
      const row = requireMapping(item, `key_owners[${index}]`);
      ownerRules.push({
        key: requireNonEmptyText(getValue(row, "key"), `key_owners[${index}].key`),
        builderType: requireNonEmptyText(getValue(row, "builder_type"), `key_owners[${index}].builder_type`),
      });
    });
  }
  return { requiredKeys, requiredEdges, parentSets, ownerRules };
};

const isSubset = (candidate: Set<string>, container: Set<string>): boolean =>
  Array.from(candidate).every((item) => container.has(item));

const validateParentSetRule = (context: ModelContext, rule: ParentSetRule, errors: string[]): void => {
  if (!context.registry.hasKey(rule.childKey)) {
    errors.push(`Missing child key for parent-set rule: '${rule.childKey}'.`);
    return;
  }
  const missingExpected = rule.parentKeys.filter((key) => !context.registry.hasKey(key));
  for (const key of missingExpected) {
    errors.push(`Parent-set rule for '${rule.childKey}' references missing key '${key}'.`);
  }
  if (missingExpected.length > 0) return;
  const child = context.model.node(context.registry.nodeId(rule.childKey));
  const actual = new Set(child.parents);
  const expected = new Set(rule.parentKeys.map((key) => context.registry.nodeId(key)));
  if (rule.mode === "exact") {
    if (!(isSubset(actual, expected) && isSubset(expected, actual))) {
      errors.push(
        `Parent-set exact mismatch for '${rule.childKey}': expected ${listRepr(expected)}, got ${listRepr(actual)}.`,
      );
    }
    return;
  }
  if (rule.mode === "at_least") {
    if (!isSubset(expected, actual)) {
      errors.push(
        `Parent-set at_least mismatch for '${rule.childKey}': expected subset ${listRepr(expected)}, got ${listRepr(actual)}.`,
      );
    }
    return;
  }
  if (rule.mode === "at_most" && !isSubset(actual, expected)) {
    errors.push(
      `Parent-set at_most mismatch for '${rule.childKey}': allowed ${listRepr(expected)}, got ${listRepr(actual)}.`,
    );
  }
};

const validateCrossLayerContract = (context: ModelContext, contract: CrossLayerContract): void => {
  const errors: string[] = [];
  for (const key of contract.requiredKeys) {
    if (!context.registry.hasKey(key)) errors.push(`Missing required canonical key: '${key}'.`);
  }
  for (const edge of contract.requiredEdges) {
    if (!context.registry.hasKey(edge.parentKey)) {
      errors.push(`Required edge parent key does not exist: '${edge.parentKey}'.`);
      continue;
    }
    if (!context.registry.hasKey(edge.childKey)) {
      errors.push(`Required edge child key does not exist: '${edge.childKey}'.`);
      continue;
    }
    const parentId = context.registry.nodeId(edge.parentKey);
    const childId = context.registry.nodeId(edge.childKey);
    if (!context.model.node(childId).parents.includes(parentId)) {
      errors.push(`Missing required edge '${edge.parentKey}' -> '${edge.childKey}'.`);
    }
  }
  for (const rule of contract.parentSets) validateParentSetRule(context, rule, errors);
  for (const ownerRule of contract.ownerRules) {
    if (!context.registry.hasKey(ownerRule.key)) {
      errors.push(`Owner rule references missing key '${ownerRule.key}'.`);
      continue;
    }
    const metadata = context.model.node(context.registry.nodeId(ownerRule.key)).metadata;
    const builder = strip(text(getValueOr(metadata, "builder", "")));
    if (builder !== ownerRule.builderType) {
      errors.push(`Owner mismatch for key '${ownerRule.key}': expected '${ownerRule.builderType}', got '${builder}'.`);
    }
  }
  if (errors.length > 0) {
    const lines = ["Cross-layer contract validation failed:"];
    errors.forEach((message, index) => lines.push(`${index + 1}. ${message}`));
    throw crossLayerContractError(lines.join("\n"));
  }
};

const validateCrossLayerContractFromMetadata = (context: ModelContext): void => {
  if (!hasKey(context.metadata, "cross_layer_contract")) return;
  const contract = parseCrossLayerContract(context.metadata.cross_layer_contract);
  if (contract === null) return;
  validateCrossLayerContract(context, contract);
};

export type { CrossLayerContract, OwnerRule, ParentSetRule, RequiredEdge };
export { parseCrossLayerContract, validateCrossLayerContract, validateCrossLayerContractFromMetadata };
