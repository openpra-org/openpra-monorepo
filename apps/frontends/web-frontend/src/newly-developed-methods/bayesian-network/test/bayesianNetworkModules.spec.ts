import {
  validateBayesianNetworkModel,
  validateBayesianNetworkModules,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  createBayesianNetworkModuleFromBranch,
  instantiateBayesianNetworkModule,
  compatibleBayesianNetworkModuleInputNodes,
  deleteBayesianNetworkModuleInstance,
} from "../bayesianNetworkModules";
import { connectNodes } from "../bayesianNetworkOperations";
import {
  exportBayesianNetworkJson,
  exportBayesianNetworkXdsl,
  importBayesianNetworkJson,
  importBayesianNetworkXdsl,
} from "../bayesianNetworkInterchange";
import { toCanonicalBayesianNetwork } from "../bayesianNetworkCanonical";

function source(states = ["FALSE", "TRUE"]): BayesianNetworkModel {
  return importBayesianNetworkJson(
    JSON.stringify({
      id: "MODULE-TEST",
      variables: [
        { name: "A", states, probabilities: [0.9, 0.1] },
        { name: "Other", states, probabilities: [0.2, 0.8] },
        { name: "Pump", states: ["OFF", "ON"], parents: ["A"], probabilities: [0.9, 0.1, 0.2, 0.8] },
      ],
    }),
  );
}

function create(model = source()) {
  const created = createBayesianNetworkModuleFromBranch(model, model.nodes.find((node) => node.code === "Pump")!.id);
  const template = created.model.moduleTemplates![0]!;
  const options = { inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: model.nodes[0]!.id }] };
  const first = instantiateBayesianNetworkModule(created.model, template.id, options);
  return { created, template, options, first };
}

describe("reusable BN module integrity", () => {
  it("keeps case-distinct states and maps a reversed input state order correctly", () => {
    const model = source(["On", "on"]);
    model.nodes[1]!.states.reverse();
    const { created, template } = create(model);
    const copy = instantiateBayesianNetworkModule(created.model, template.id, {
      inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: model.nodes[1]!.id }],
    });
    expect(validateBayesianNetworkModel(copy.model)).toEqual([]);
    const canonical = toCanonicalBayesianNetwork(copy.model);
    expect(canonical.variables.at(-1)!.parents).toEqual(["Other"]);
    expect(canonical.variables.at(-1)!.probabilities).toEqual([0.2, 0.8, 0.9, 0.1]);
    const invalid = {
      ...created.model,
      nodes: created.model.nodes.map((node) =>
        node.id === model.nodes[1]!.id ?
          {
            ...node,
            states: node.states.map((state, index) => ({
              ...state,
              code: index === 0 ? "ON" : "off",
            })) as typeof node.states,
          }
        : node,
      ),
    };
    expect(
      compatibleBayesianNetworkModuleInputNodes(invalid, template.inputPorts[0]!).map((node) => node.id),
    ).not.toContain(model.nodes[1]!.id);
    expect(() =>
      instantiateBayesianNetworkModule(invalid, template.id, {
        inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: model.nodes[1]!.id }],
      }),
    ).toThrow(/requires states/);
  });

  it("creates two separate instances, preserves CPTs, and reloads all IDs and bindings", () => {
    const { template, options, first } = create();
    const second = instantiateBayesianNetworkModule(first.model, template.id, options);
    const nodes = second.model.nodes;
    const ids = nodes.flatMap((node) => [node.id, ...node.states.map((state) => state.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(first.outputNodeIds).not.toEqual(second.outputNodeIds);
    expect(validateBayesianNetworkModel(second.model)).toEqual([]);
    expect(importBayesianNetworkJson(exportBayesianNetworkJson(second.model))).toEqual(second.model);
    expect(
      toCanonicalBayesianNetwork(second.model)
        .variables.slice(-2)
        .map((node) => node.probabilities),
    ).toEqual([
      [0.9, 0.1, 0.2, 0.8],
      [0.9, 0.1, 0.2, 0.8],
    ]);
  });

  it.each(["sum", "missing row", "duplicate state", "cycle"])(
    "rejects invalid source branches before copying: %s",
    (kind) => {
      const model = source();
      const table = model.conditionalProbabilityTables[2]!;
      if (kind === "sum") table.rows[0]!.values[0].probability = 0.4;
      if (kind === "missing row") table.rows.pop();
      if (kind === "duplicate state") model.nodes[0]!.states[1]!.code = model.nodes[0]!.states[0].code;
      if (kind === "cycle")
        model.edges.push({
          id: crypto.randomUUID(),
          parentNodeId: model.nodes[2]!.id,
          childNodeId: model.nodes[0]!.id,
        });
      const before = JSON.stringify(model);
      expect(() => createBayesianNetworkModuleFromBranch(model, model.nodes[2]!.id)).toThrow();
      expect(JSON.stringify(model)).toBe(before);
    },
  );

  it.each(["sum", "missing row", "empty template", "duplicate output"])(
    "rejects invalid saved templates before instantiation: %s",
    (kind) => {
      const { created, template, options } = create();
      if (kind === "sum") template.conditionalProbabilityTables[0]!.rows[0]!.values[0].probability = 0.5;
      if (kind === "missing row") template.conditionalProbabilityTables[0]!.rows.pop();
      if (kind === "empty template") template.nodes = [];
      if (kind === "duplicate output") template.outputPorts.push(template.outputPorts[0]!);
      const before = JSON.stringify(created.model);
      expect(() => instantiateBayesianNetworkModule(created.model, template.id, options)).toThrow();
      expect(JSON.stringify(created.model)).toBe(before);
    },
  );

  it.each(["declared input", "edge", "CPT", "extra edge", "duplicate state mapping", "duplicate output binding"])(
    "rejects stale instance metadata: %s",
    (kind) => {
      const { first } = create();
      const model = first.model;
      const instance = model.moduleInstances![0]!;
      const outputId = first.outputNodeIds[0]!;
      const other = model.nodes[1]!.id;
      if (kind === "declared input") instance.inputBindings[0]!.nodeId = other;
      if (kind === "edge") model.edges.find((edge) => edge.childNodeId === outputId)!.parentNodeId = other;
      if (kind === "CPT")
        model.conditionalProbabilityTables.find((table) => table.nodeId === outputId)!.parents[0]!.nodeId = other;
      if (kind === "extra edge")
        model.edges.push({ id: crypto.randomUUID(), parentNodeId: other, childNodeId: outputId });
      if (kind === "duplicate state mapping")
        instance.nodeMappings[0]!.stateMappings.push(instance.nodeMappings[0]!.stateMappings[0]!);
      if (kind === "duplicate output binding") instance.outputBindings.push(instance.outputBindings[0]!);
      expect(validateBayesianNetworkModules(model).length).toBeGreaterThan(0);
      expect(() => importBayesianNetworkJson(JSON.stringify(model))).toThrow();
    },
  );

  it("allows independent probability edits while preserving the template and wiring", () => {
    const { first, template } = create();
    const table = first.model.conditionalProbabilityTables.find((table) => table.nodeId === first.outputNodeIds[0])!;
    table.rows[0]!.values[0].probability = 0.6;
    table.rows[0]!.values[1]!.probability = 0.4;
    table.rows.reverse();
    table.rows.forEach((row) => row.values.reverse());
    expect(validateBayesianNetworkModel(first.model)).toEqual([]);
    expect(template.conditionalProbabilityTables[0]!.rows[0]!.values.map((value) => value.probability)).toEqual([
      0.9, 0.1,
    ]);
  });

  it("allows an input-free template to be instantiated in an empty network", () => {
    const model = source();
    const created = createBayesianNetworkModuleFromBranch(model, model.nodes[0]!.id);
    const empty = { ...created.model, nodes: [], edges: [], conditionalProbabilityTables: [], nodePositions: [] };
    expect(validateBayesianNetworkModel(instantiateBayesianNetworkModule(empty, created.templateId).model)).toEqual([]);
  });

  it("deletes only the instance and rebuilds affected child CPTs using the shared helper", () => {
    const { first } = create();
    let model = connectNodes(first.model, first.outputNodeIds[0]!, first.model.nodes[1]!.id);
    const sinkId = model.nodes[1]!.id;
    const table = model.conditionalProbabilityTables.find((table) => table.nodeId === sinkId)!;
    table.rows.forEach((row) => {
      row.values[0].probability = 0.7;
      row.values[1]!.probability = 0.3;
    });
    const original = JSON.stringify(model);
    const removed = deleteBayesianNetworkModuleInstance(model, first.instanceId);
    expect(JSON.stringify(model)).toBe(original);
    expect(
      removed.conditionalProbabilityTables
        .find((table) => table.nodeId === sinkId)!
        .rows[0]!.values.map((value) => value.probability),
    ).toEqual([0.5, 0.5]);
    expect(removed.conditionalProbabilityTables.find((table) => table.nodeId === model.nodes[0]!.id)).toEqual(
      model.conditionalProbabilityTables[0],
    );
    expect(validateBayesianNetworkModel(removed)).toEqual([]);
  });

  it.each([false, true])(
    "removes deleted instance XML records without removing vendor metadata, prefixed=%s",
    (prefixed) => {
      const { first, template, options } = create();
      const second = instantiateBayesianNetworkModule(first.model, template.id, options);
      const removedCode = second.model.nodes.find((node) => node.id === first.outputNodeIds[0])!.code;
      let xml = exportBayesianNetworkXdsl(second.model).replace(
        "</extensions>",
        '<vendor><node id="opaque"><name>Keep me</name></node></vendor></extensions>',
      );
      xml = xml.replace(
        "</genie>",
        `<v:node xmlns:v="urn:vendor" id="${removedCode}"><v:name>Keep vendor node</v:name></v:node>` +
          `<v:submodel xmlns:v="urn:vendor" id="${second.model.moduleInstances![0]!.code}"><v:font>Keep vendor group</v:font></v:submodel></genie>`,
      );
      if (prefixed)
        xml = xml
          .replace("<smile ", '<smile xmlns:g="urn:genie" ')
          .replace(/<(\/?)(genie|submodel|node|name|position)(?=[\s/>])/g, "<$1g:$2");
      const metadata = importBayesianNetworkXdsl(xml).xdslMetadata!;
      const model = {
        ...second.model,
        xdslMetadata: {
          ...metadata,
          nodeIdentifiers: second.model.nodes.map((node) => ({ nodeId: node.id, sourceId: node.code })),
        },
      };
      const removed = deleteBayesianNetworkModuleInstance(model, first.instanceId);
      const persisted = importBayesianNetworkJson(exportBayesianNetworkJson(removed));
      for (const document of [
        new DOMParser().parseFromString(persisted.xdslMetadata!.extensionsXml!, "application/xml"),
        new DOMParser().parseFromString(exportBayesianNetworkXdsl(persisted), "application/xml"),
      ]) {
        const allRecords = [...document.getElementsByTagName("*")];
        const records = allRecords.filter((node) => node.namespaceURI !== "urn:vendor");
        expect(
          allRecords.some(
            (node) =>
              node.namespaceURI === "urn:vendor" &&
              node.localName === "node" &&
              node.textContent === "Keep vendor node",
          ),
        ).toBe(true);
        expect(
          allRecords.some(
            (node) =>
              node.namespaceURI === "urn:vendor" &&
              node.localName === "submodel" &&
              node.textContent === "Keep vendor group",
          ),
        ).toBe(true);
        expect(records.some((node) => node.localName === "node" && node.getAttribute("id") === removedCode)).toBe(
          false,
        );
        expect(
          records.some(
            (node) => node.localName === "submodel" && node.getAttribute("id") === model.moduleInstances![0]!.code,
          ),
        ).toBe(false);
        expect(records.some((node) => node.getAttribute("id") === "opaque" && node.textContent === "Keep me")).toBe(
          true,
        );
      }
      expect(persisted.moduleInstances).toHaveLength(1);
      expect(validateBayesianNetworkModel(persisted)).toEqual([]);
    },
  );
});
