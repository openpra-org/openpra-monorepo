import type { ModelContext } from "./context";
import { valueError } from "./errors";
import { getValueOr, strip, text } from "./spec-values";
import type { SpecMapping } from "./spec-values";

interface AddParentRule {
  parentKey: string;
  childKey: string;
}

const parseCouplingRules = (rawRules: readonly SpecMapping[] | null): AddParentRule[] => {
  const rules: AddParentRule[] = [];
  (rawRules ?? []).forEach((item, index) => {
    const ruleType = strip(text(getValueOr(item, "type", ""))).toLowerCase();
    if (ruleType !== "add_parent") {
      throw valueError(
        `Unsupported coupling type at couplings[${index}]: '${text(getValueOr(item, "type", null))}'. ` +
          "Only 'add_parent' is currently supported.",
      );
    }
    const parentKey = strip(text(getValueOr(item, "parent_key", "")));
    const childKey = strip(text(getValueOr(item, "child_key", "")));
    if (parentKey.length === 0 || childKey.length === 0) {
      throw valueError(`couplings[${index}] add_parent requires non-empty parent_key and child_key.`);
    }
    rules.push({ parentKey, childKey });
  });
  return rules;
};

const applyAddParentCouplings = (context: ModelContext, rules: readonly AddParentRule[]): number => {
  let applied = 0;
  for (const rule of rules) {
    const parentId = context.registry.nodeId(rule.parentKey);
    const childId = context.registry.nodeId(rule.childKey);
    if (context.model.addParentEdge(parentId, childId)) applied += 1;
  }
  return applied;
};

export type { AddParentRule };
export { applyAddParentCouplings, parseCouplingRules };
