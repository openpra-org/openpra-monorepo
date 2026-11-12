import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createModelContext } from "../core/context";
import { DiscretizationService } from "../core/discretization";
import { NetworkBuilderError } from "../core/errors";
import { WorkingModel } from "../core/model";
import type { CpdGenerator } from "../core/model";
import { Registry } from "../core/registry";
import { parseJsonText } from "../core/spec-text";
import { getValue, isMapping, keysOf, repeat, text } from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";

const evenGenerator: CpdGenerator = (context, node) =>
  repeat([0.5, 0.5], context.model.parentConfigurationCount(node.nodeId));

const model = (): WorkingModel => {
  const working = new WorkingModel();
  working.addNode({ key: "k.a", nodeId: "A", states: ["x", "y"], cpdGenerator: evenGenerator });
  working.addNode({ key: "k.b", nodeId: "B", states: ["p", "q", "r"], parentIds: ["A"] });
  return working;
};

const regenerate = (working: WorkingModel): null => {
  const context = createModelContext({
    schemaVersion: "1",
    modelId: "m",
    description: "d",
    discretization: new DiscretizationService({}),
  });
  context.model = working;
  working.regenerateDirtyCpds(context);
  return null;
};

const registryWith = (pairs: [string, string][]): Registry => {
  const registry = new Registry();
  for (const [key, nodeId] of pairs) registry.register(key, nodeId);
  return registry;
};

const discretization = new DiscretizationService({
  PGA: { states: ["a", "b"], centers: [0.1, 0.2] },
  W: ["u", "v", "w"],
});

const scenarios: { [name: string]: () => SpecValue } = {
  add_duplicate_node: () => model().addNode({ key: "k", nodeId: "A", states: ["x", "y"] }).nodeId,
  add_one_state: () => model().addNode({ key: "k", nodeId: "C", states: ["x"] }).nodeId,
  add_unknown_parent: () => model().addNode({ key: "k", nodeId: "C", states: ["x", "y"], parentIds: ["Z"] }).nodeId,
  add_duplicate_parents: () =>
    model().addNode({ key: "k", nodeId: "C", states: ["x", "y"], parentIds: ["A", "A"] }).nodeId,
  add_states_converted: () => model().addNode({ key: "k", nodeId: "C", states: [1, 2.5, true, null] }).states,
  add_parents_sorted: () =>
    model().addNode({ key: "k", nodeId: "C", states: ["x", "y"], parentIds: ["B", "A"] }).parents,
  has_node: () => [model().hasNode("A"), model().hasNode("Z")],
  node_unknown: () => model().node("Z").nodeId,
  mark_dirty_unknown: () => {
    model().markDirty("Z");
    return null;
  },
  edge_unknown_parent: () => model().addParentEdge("Z", "A"),
  edge_unknown_child: () => model().addParentEdge("A", "Z"),
  edge_self: () => model().addParentEdge("A", "A"),
  edge_existing: () => model().addParentEdge("A", "B"),
  edge_new: () => model().addParentEdge("B", "A"),
  counts: () => [
    model().parentConfigurationCount("B"),
    model().expectedCpdSize("B"),
    model().parentConfigurationCount("A"),
  ],
  regenerate_without_generator: () => regenerate(model()),
  regenerate_wrong_size: () => {
    const working = new WorkingModel();
    working.addNode({ key: "k.a", nodeId: "A", states: ["x", "y"], cpdGenerator: () => [1] });
    return regenerate(working);
  },
  registry_empty_key: () => new Registry().register("", "A").key,
  registry_empty_node: () => new Registry().register("k", "").key,
  registry_remap_key: () => registryWith([["k", "A"]]).register("k", "B").key,
  registry_rebind_node: () => registryWith([["k", "A"]]).register("j", "A").key,
  registry_same_again: () => {
    const registry = registryWith([["k", "A"]]);
    const binding = registry.register("k", "A");
    return [
      binding.key,
      binding.nodeId,
      registry.hasKey("k"),
      registry.hasKey("z"),
      registry.nodeId("k"),
      registry.key("A"),
    ];
  },
  registry_unknown_key: () => new Registry().nodeId("zz"),
  registry_unknown_node: () => new Registry().key("zz"),
  registry_unknown_key_with_quote: () => new Registry().nodeId('it\'s "x"'),
  disc_has: () => [
    discretization.has("PGA"),
    discretization.has("Z"),
    discretization.hasCenters("PGA"),
    discretization.hasCenters("W"),
  ],
  disc_states: () => [discretization.states("PGA"), discretization.states("W"), discretization.centers("PGA")],
  disc_unknown_states: () => discretization.states("Z"),
  disc_unknown_centers: () => discretization.centers("W"),
  disc_none: () => new DiscretizationService(null).has("x"),
};

const outcomeText = (name: string): string => {
  try {
    const value = scenarios[name]();
    return `ok ${JSON.stringify(value)}`;
  } catch (error) {
    if (!(error instanceof NetworkBuilderError)) throw error;
    return `${error.kind}: ${error.message}`;
  }
};

const expectedText = (record: SpecMapping): string =>
  getValue(record, "ok") === true ?
    `ok ${JSON.stringify(getValue(record, "value"))}`
  : `${text(getValue(record, "error_type"))}: ${text(getValue(record, "error_message"))}`;

describe("network builder core classes", () => {
  it("behave like the reference for every direct call", () => {
    const parsed = parseJsonText(readFileSync(join(__dirname, "fixtures", "core-direct.json"), "utf-8"));
    const reference = isMapping(parsed) ? parsed : {};
    const names = keysOf(reference);
    expect(names.length).toBe(30);
    expect(names.filter((name) => !Object.prototype.hasOwnProperty.call(scenarios, name))).toEqual([]);
    const differences: string[] = [];
    for (const name of names) {
      const record = reference[name];
      if (!isMapping(record)) continue;
      const expected = expectedText(record);
      const actual = outcomeText(name);
      if (expected !== actual) differences.push(`${name}: expected ${expected} | got ${actual}`);
    }
    expect(differences).toEqual([]);
  });
});
