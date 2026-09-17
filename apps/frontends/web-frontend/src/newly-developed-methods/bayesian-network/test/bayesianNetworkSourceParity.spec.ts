import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import reference from "./fixtures/hclMhSource.json";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  importBayesianNetworkJson,
  importBayesianNetworkXdsl,
  exportBayesianNetworkJson,
  exportBayesianNetworkXdsl,
  readBayesianNetworkSubmodels,
} from "../bayesianNetworkInterchange";
import { createSubmodelOverview } from "../bayesianNetworkSubmodels";
import { toCanonicalBayesianNetwork } from "../bayesianNetworkCanonical";
import { reorderParents, connectNodes } from "../bayesianNetworkOperations";
import {
  createBayesianNetworkModuleFromBranch,
  instantiateBayesianNetworkModule,
  deleteBayesianNetworkModuleInstance,
} from "../bayesianNetworkModules";
const root = resolve(__dirname, "../../../../../../..");
const frozenHra = "apps/solvers/praxis/tests/fixtures/hcl_mh_xdsl/Generic_HFE.xdsl";

describe("HCL_MH template and visual-submodel source parity", () => {
  it("uses the frozen HRA input protected by the shared reference manifest", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, "apps/solvers/praxis/tests/hcl-reference-manifest.json"), "utf8"),
    );
    expect(
      createHash("sha256")
        .update(readFileSync(resolve(root, frozenHra), "utf8").replace(/\r\n/g, "\n"))
        .digest("hex"),
    ).toBe(manifest.files[frozenHra]);
  });

  it.each(["synthetic", "hra"] as const)(
    "preserves every CPT through parent reordering and independent branch copies: %s",
    (kind) => {
      let model =
        kind === "synthetic" ?
          importBayesianNetworkJson(JSON.stringify(reference.synthetic.network))
        : importBayesianNetworkXdsl(readFileSync(resolve(root, frozenHra), "utf8"));
      const before = JSON.stringify(model);
      const caseReference = reference[kind].reordered;
      for (const expected of caseReference) {
        const node = model.nodes.find((candidate) => candidate.code === expected.name)!;
        model = reorderParents(
          model,
          node.id,
          expected.parents.map((code) => model.nodes.find((candidate) => candidate.code === code)!.id),
        );
      }
      expect(validateBayesianNetworkModel(model)).toEqual([]);
      const sourceCanonical = toCanonicalBayesianNetwork(model);
      for (const expected of caseReference) {
        const actual = sourceCanonical.variables.find((node) => node.name === expected.name)!;
        expect(actual.parents).toEqual(expected.parents);
        expect(actual.probabilities).toEqual(expected.probabilities);
      }
      const branch = model.nodes.find((node) => node.code === (kind === "synthetic" ? "Z" : "CFM_AR"))!;
      const created = createBayesianNetworkModuleFromBranch(model, branch.id);
      const template = created.model.moduleTemplates![0]!;
      const options = {
        inputBindings: template.inputPorts.map((port) => ({
          portId: port.id,
          nodeId: model.nodes.find((node) => node.code === port.code)!.id,
        })),
      };
      const first = instantiateBayesianNetworkModule(created.model, template.id, options);
      const second = instantiateBayesianNetworkModule(first.model, template.id, options);
      let copied = second.model;
      const copyCanonical = toCanonicalBayesianNetwork(copied);
      for (const instance of copied.moduleInstances!) {
        for (const mapping of instance.nodeMappings) {
          const templateNode = template.nodes.find((node) => node.id === mapping.templateNodeId)!;
          const original = model.nodes.find((node) => node.code === templateNode.code)!;
          const expected = sourceCanonical.variables.find((node) => node.name === original.code)!;
          const actual = copyCanonical.variables.find(
            (node) => node.name === copied.nodes.find((node) => node.id === mapping.nodeId)!.code,
          )!;
          expect(actual.states).toEqual(expected.states);
          expect(actual.probabilities).toEqual(expected.probabilities);
          const table = copied.conditionalProbabilityTables.find((table) => table.nodeId === mapping.nodeId)!;
          const parentIds = [...table.parents].sort((a, b) => b.order - a.order).map((parent) => parent.nodeId);
          copied = reorderParents(copied, mapping.nodeId, parentIds);
        }
      }
      expect(validateBayesianNetworkModel(copied)).toEqual([]);
      expect(importBayesianNetworkJson(exportBayesianNetworkJson(copied))).toEqual(copied);
      const identifiers = copied.nodes.flatMap((node) => [node.id, ...node.states.map((state) => state.id)]);
      expect(new Set(identifiers).size).toBe(identifiers.length);
      // Reordering never modifies the original row assignments or values.
      expect(model.conditionalProbabilityTables.map((table) => table.rows)).toEqual(
        JSON.parse(before).conditionalProbabilityTables.map((table: { rows: unknown }) => table.rows),
      );
    },
  );

  it.each(reference.submodels.scopes)(
    "matches source visible entities and aggregated connections at $path",
    (expected) => {
      const model = importBayesianNetworkXdsl(reference.submodels.xdsl);
      const before = JSON.stringify(model);
      const groups = readBayesianNetworkSubmodels(model);
      const scope = groups.find((group) => group.path === expected.path)?.id ?? null;
      const view = createSubmodelOverview(model, groups, scope);
      const names = new Map(
        view.entities.map((entity) => [
          entity.id,
          entity.group === undefined ?
            `node:${model.nodes.find((node) => node.id === entity.nodeId)!.code}`
          : `group:${entity.group.path}`,
        ]),
      );
      expect([...names.values()].sort()).toEqual(expected.entities);
      expect(view.edges.map((edge) => [names.get(edge.from), names.get(edge.to), edge.count]).sort()).toEqual(
        expected.edges,
      );
      expect(JSON.stringify(model)).toBe(before);
    },
  );

  it.each([false, true])("preserves hierarchy and probability data through file reload, prefixed=%s", (prefixed) => {
    const xml =
      prefixed ?
        reference.submodels.xdsl
          .replace("<smile ", '<smile xmlns:g="urn:genie" ')
          .replace(/<(\/?)(genie|submodel|node|name)(?=[\s/>])/g, "<$1g:$2")
      : reference.submodels.xdsl;
    const model = importBayesianNetworkXdsl(xml);
    const restored = importBayesianNetworkXdsl(
      exportBayesianNetworkXdsl(importBayesianNetworkJson(exportBayesianNetworkJson(model))),
    );
    expect(toCanonicalBayesianNetwork(restored)).toEqual(toCanonicalBayesianNetwork(model));
    expect(readBayesianNetworkSubmodels(restored).map((group) => group.path)).toEqual([
      "Pumps",
      "Pumps / Controls",
      "Cooling",
    ]);
  });

  it("shows new template instances as visual groups and removes only the deleted instance", () => {
    const model = importBayesianNetworkJson(JSON.stringify(reference.synthetic.network));
    const created = createBayesianNetworkModuleFromBranch(model, model.nodes[0]!.id);
    const template = created.model.moduleTemplates![0]!;
    const options = {
      inputBindings: template.inputPorts.map((port) => ({
        portId: port.id,
        nodeId: model.nodes.find((node) => node.code === port.code)!.id,
      })),
    };
    const first = instantiateBayesianNetworkModule(created.model, template.id, options);
    const second = instantiateBayesianNetworkModule(first.model, template.id, options);
    expect(readBayesianNetworkSubmodels(second.model)).toHaveLength(2);
    const removed = deleteBayesianNetworkModuleInstance(second.model, first.instanceId);
    expect(readBayesianNetworkSubmodels(removed)).toHaveLength(1);
    expect(toCanonicalBayesianNetwork(removed).variables.slice(0, model.nodes.length)).toEqual(
      toCanonicalBayesianNetwork(model).variables,
    );
  });

  it("allows both visual arrow directions when grouping an acyclic BN", () => {
    let model = importBayesianNetworkXdsl(reference.submodels.xdsl);
    model = connectNodes(
      model,
      model.nodes.find((node) => node.code === "D")!.id,
      model.nodes.find((node) => node.code === "C")!.id,
    );
    expect(validateBayesianNetworkModel(model)).toEqual([]);
    const groups = readBayesianNetworkSubmodels(model);
    const view = createSubmodelOverview(model, groups, null);
    const pumps = `group:${groups.find((group) => group.name === "Pumps")!.id}`;
    const cooling = `group:${groups.find((group) => group.name === "Cooling")!.id}`;
    expect(view.edges).toEqual(
      expect.arrayContaining([
        { from: pumps, to: cooling, count: 2 },
        { from: cooling, to: pumps, count: 1 },
      ]),
    );
  });

  it("rejects a changed or duplicated parent set instead of silently changing the model", () => {
    const model = importBayesianNetworkJson(JSON.stringify(reference.synthetic.network));
    const node = model.nodes.find((node) => node.code === "C")!;
    expect(() => reorderParents(model, node.id, [model.nodes[0]!.id])).toThrow(/exactly the same/);
    expect(() => reorderParents(model, node.id, [model.nodes[0]!.id, model.nodes[0]!.id])).toThrow(/exactly the same/);
  });
});


it("keeps nested visual group identifiers distinct and bounded", () => {
  const model = importBayesianNetworkXdsl(reference.submodels.xdsl);
  let nested = '<node id="A"/>';
  for (let index = 0; index < 20; index += 1) nested = `<submodel id="same"><name>Nested</name>${nested}</submodel>`;
  model.xdslMetadata!.extensionsXml = `<extensions><genie>${nested}</genie></extensions>`;
  const groups = readBayesianNetworkSubmodels(model);
  expect(groups).toHaveLength(20);
  expect(new Set(groups.map((group) => group.id)).size).toBe(20);
  expect(Math.max(...groups.map((group) => group.id.length))).toBeLessThan(1024);
  expect(groups.at(-1)!.nodeIds).toEqual([model.nodes.find((node) => node.code === "A")!.id]);
});
