import { BuilderBase } from "../core/builder-base";
import type { ModelContext } from "../core/context";
import { typeError, valueError } from "../core/errors";
import type { NodeRecord } from "../core/model";
import {
  formatGeneral,
  getValue,
  getValueOr,
  hasKey,
  isMapping,
  isSequence,
  iterValues,
  keysOf,
  recordKeyOrder,
  repeat,
  strip,
  sum,
  text,
  toFloat,
  truthy,
  typeName,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";

const pairItems = (element: SpecValue, index: number): SpecValue[] => {
  if (typeof element === "string") return Array.from(element);
  if (isSequence(element)) return element;
  if (isMapping(element)) return keysOf(element);
  throw typeError(`cannot convert dictionary update sequence element #${index} to a sequence`);
};

const mappingFromPairs = (elements: readonly SpecValue[]): SpecMapping => {
  const output: SpecMapping = {};
  const order: string[] = [];
  elements.forEach((element, index) => {
    const items = pairItems(element, index);
    if (items.length !== 2) {
      throw valueError(`dictionary update sequence element #${index} has length ${items.length}; 2 is required`);
    }
    const [rawKey, value] = items;
    if (isSequence(rawKey) || isMapping(rawKey)) throw typeError(`unhashable type: '${typeName(rawKey)}'`);
    const key = text(rawKey);
    if (!hasKey(output, key)) order.push(key);
    output[key] = value;
  });
  return recordKeyOrder(output, order);
};

const mappingFromValue = (value: SpecValue): SpecMapping => {
  if (isMapping(value)) return { ...value };
  if (isSequence(value)) return mappingFromPairs(value);
  if (typeof value === "string") return mappingFromPairs(Array.from(value));
  throw typeError(`'${typeName(value)}' object is not iterable`);
};

class ConstantNodeBuilder extends BuilderBase {
  get builderType(): string {
    return `constant_node:${text(getValueOr(this.config, "node_id", "unknown"))}`;
  }

  get requires(): Set<string> {
    const required = new Set(iterValues(getValueOr(this.config, "requires", [])).map((item) => text(item)));
    for (const item of iterValues(getValueOr(this.config, "parent_keys", []))) required.add(text(item));
    return required;
  }

  get provides(): Set<string> {
    const key = strip(text(getValueOr(this.config, "key", "")));
    if (key.length === 0) throw valueError("ConstantNodeBuilder requires non-empty config.key.");
    return new Set([key]);
  }

  build(context: ModelContext): void {
    const key = strip(text(getValueOr(this.config, "key", "")));
    const nodeId = strip(text(getValueOr(this.config, "node_id", "")));
    if (key.length === 0 || nodeId.length === 0) {
      throw valueError("ConstantNodeBuilder requires both key and node_id.");
    }
    const states = this.resolveStates(context);
    const probabilities = this.resolveProbabilities(states);
    const parentKeys = iterValues(getValueOr(this.config, "parent_keys", [])).map((item) => text(item));
    const parentIds = parentKeys.map((parentKey) => context.registry.nodeId(parentKey));
    const cpdGenerator = (localContext: ModelContext, node: NodeRecord): number[] =>
      repeat(probabilities, localContext.model.parentConfigurationCount(node.nodeId));
    const rawMetadata = getValueOr(this.config, "metadata", {});
    const metadata: SpecMapping = truthy(rawMetadata) ? mappingFromValue(rawMetadata) : {};
    if (!hasKey(metadata, "builder")) metadata.builder = "constant_node";
    context.model.addNode({ key, nodeId, states, metadata, parentIds, cpdGenerator });
    context.registry.register(key, nodeId);
  }

  private resolveStates(context: ModelContext): string[] {
    if (hasKey(this.config, "states")) {
      const states = iterValues(this.config.states).map((state) => text(state));
      if (states.length < 2) throw valueError("constant_node states must include at least two values.");
      return states;
    }
    const reference = strip(text(getValueOr(this.config, "states_ref", "")));
    if (reference.length === 0) {
      throw valueError("constant_node requires either explicit 'states' or a 'states_ref' discretization name.");
    }
    return context.discretization.states(reference);
  }

  private resolveProbabilities(states: readonly string[]): number[] {
    const raw = getValue(this.config, "probs");
    if (!isSequence(raw)) throw valueError("constant_node 'probs' must be a list of probabilities.");
    const probabilities = raw.map((item) => toFloat(item));
    if (probabilities.length !== states.length) {
      throw valueError(
        `constant_node probs length ${probabilities.length} does not match state count ${states.length}.`,
      );
    }
    const total = sum(probabilities);
    if (Math.abs(total - 1) > 1e-9) {
      throw valueError(`constant_node probs must sum to 1.0 (got ${formatGeneral(total, 12)}).`);
    }
    if (probabilities.some((probability) => probability < -1e-12 || probability > 1 + 1e-12)) {
      throw valueError("constant_node probs must lie in [0,1].");
    }
    return probabilities;
  }
}

export { ConstantNodeBuilder };
