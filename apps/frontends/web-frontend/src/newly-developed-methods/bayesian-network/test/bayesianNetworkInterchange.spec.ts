import {
  exportBayesianNetworkJson,
  exportBayesianNetworkXdsl,
  importBayesianNetworkJson,
  importBayesianNetworkXdsl,
} from "../bayesianNetworkInterchange";
import { connectNodes, deleteNode } from "../bayesianNetworkOperations";
import {
  createBayesianNetworkModuleFromBranch,
  instantiateBayesianNetworkModule,
} from "../bayesianNetworkModules";
import { TEST_ID, testBayesianNetworkModel } from "./bayesianNetworkTestModel";

describe("Bayesian-network interchange", () => {
  it("round-trips a canonical model through OpenPRA JSON", () => {
    const original = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
    expect(importBayesianNetworkJson(exportBayesianNetworkJson(original))).toEqual(original);
  });

  it("round-trips reusable module templates and materialized instances through OpenPRA JSON", () => {
    const connected = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
    const created = createBayesianNetworkModuleFromBranch(connected, TEST_ID.b);
    const template = created.model.moduleTemplates![0]!;
    const instantiated = instantiateBayesianNetworkModule(created.model, template.id, {
      inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: TEST_ID.a }],
    }).model;

    expect(importBayesianNetworkJson(exportBayesianNetworkJson(instantiated))).toEqual(instantiated);
    const xdsl = new DOMParser().parseFromString(exportBayesianNetworkXdsl(instantiated), "application/xml");
    const instance = instantiated.moduleInstances![0]!;
    const materializedNode = instantiated.nodes.find(
      (node) => node.id === instance.nodeMappings[0]?.nodeId,
    )!;
    expect(xdsl.querySelector(`submodel[id="${instance.code}"] node[id="${materializedNode.code}"]`)).not.toBeNull();
  });

  it("exports and imports discrete XDSL while preserving parent order and probabilities", () => {
    const connected = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
    const table = connected.conditionalProbabilityTables.find(({ nodeId }) => nodeId === TEST_ID.b)!;
    const withConditionalValues = {
      ...connected,
      conditionalProbabilityTables: connected.conditionalProbabilityTables.map((candidate) =>
        candidate.nodeId === TEST_ID.b
          ? {
              ...table,
              rows: table.rows.map((row, index) => ({
                ...row,
                values: [
                  { stateId: TEST_ID.bFalse, probability: index === 0 ? 0.9 : 0.2 },
                  { stateId: TEST_ID.bTrue, probability: index === 0 ? 0.1 : 0.8 },
                ] as typeof row.values,
              })),
            }
          : candidate,
      ),
    };

    const xdsl = exportBayesianNetworkXdsl(withConditionalValues);
    const imported = importBayesianNetworkXdsl(xdsl, testBayesianNetworkModel());
    const importedB = imported.nodes.find(({ code }) => code === "B")!;
    const importedTable = imported.conditionalProbabilityTables.find(({ nodeId }) => nodeId === importedB.id)!;

    expect(xdsl).toContain('<cpt id="B">');
    expect(xdsl).toContain("<parents>A</parents>");
    expect(importedTable.parents).toHaveLength(1);
    expect(importedTable.rows.map((row) => row.values.map(({ probability }) => probability))).toEqual([
      [0.9, 0.1],
      [0.2, 0.8],
    ]);
  });

  it("preserves GeNIe metadata, nested submodels, layout, and cross-submodel arcs", () => {
    const xdsl = `<?xml version="1.0" encoding="UTF-8"?>
      <smile version="1.0" id="BN-SUBMODELS" numsamples="1000" custom="keep-root">
        <nodes>
          <cpt id="A">
            <state id="LOW"/><state id="HIGH"/>
            <probabilities>0.75 0.25</probabilities>
          </cpt>
          <cpt id="B">
            <state id="OFF"/><state id="ON"/>
            <parents>A</parents>
            <probabilities>0.9 0.1 0.2 0.8</probabilities>
          </cpt>
        </nodes>
        <extensions>
          <genie version="1.0" app="GeNIe 5" name="Submodel example">
            <comment>Keep this network comment</comment>
            <node id="A">
              <name>Hazard driver</name>
              <interior color="ffcc00"/>
              <position>10 20 130 80</position>
            </node>
            <submodel id="SM-EQUIPMENT">
              <name>Equipment</name>
              <interior color="abcdef"/>
              <position>250 150 500 400</position>
              <custom key="keep-me">vendor metadata</custom>
              <node id="B">
                <name>Equipment response</name>
                <outline color="123456"/>
                <position>310 220 430 280</position>
              </node>
            </submodel>
          </genie>
        </extensions>
      </smile>`;

    const imported = importBayesianNetworkXdsl(xdsl, testBayesianNetworkModel());
    const importedA = imported.nodes.find(({ code }) => code === "A")!;
    const importedB = imported.nodes.find(({ code }) => code === "B")!;
    expect(importedA.name).toBe("Hazard driver");
    expect(importedB.name).toBe("Equipment response");
    expect(imported.nodePositions).toEqual([
      { nodeId: importedA.id, position: { x: 10, y: 20 } },
      { nodeId: importedB.id, position: { x: 310, y: 220 } },
    ]);
    expect(imported.layout.mode).toBe("MANUAL");
    expect(imported.xdslMetadata?.rootAttributes).toMatchObject({ numsamples: "1000", custom: "keep-root" });
    expect(imported.xdslMetadata?.extensionsXml).toContain('submodel id="SM-EQUIPMENT"');
    expect(importBayesianNetworkJson(exportBayesianNetworkJson(imported)).xdslMetadata).toEqual(imported.xdslMetadata);

    const edited = {
      ...imported,
      nodes: imported.nodes.map((node) => node.id === importedA.id
        ? { ...node, code: "A_RENAMED", name: "Renamed hazard driver" }
        : node.id === importedB.id
          ? { ...node, code: "B_RENAMED", name: "Renamed equipment response" }
          : node),
      nodePositions: imported.nodePositions.map((entry) => entry.nodeId === importedB.id
        ? { ...entry, position: { x: 350, y: 260 } }
        : entry),
    };
    const exported = exportBayesianNetworkXdsl(edited);
    const exportedDocument = new DOMParser().parseFromString(exported, "application/xml");
    const exportedRoot = exportedDocument.documentElement;
    const exportedSubmodel = exportedDocument.querySelector('submodel[id="SM-EQUIPMENT"]');
    const exportedNestedNode = exportedSubmodel?.querySelector('node[id="B_RENAMED"]');

    expect(exportedRoot.getAttribute("numsamples")).toBe("1000");
    expect(exportedRoot.getAttribute("custom")).toBe("keep-root");
    expect(exportedDocument.querySelector('node[id="A_RENAMED"] interior')?.getAttribute("color")).toBe("ffcc00");
    expect(exportedSubmodel?.querySelector("custom")?.getAttribute("key")).toBe("keep-me");
    expect(exportedNestedNode?.querySelector("outline")?.getAttribute("color")).toBe("123456");
    expect(exportedNestedNode?.querySelector("name")?.textContent).toBe("Renamed equipment response");
    expect(exportedNestedNode?.querySelector("position")?.textContent).toBe("350 260 470 320");
    expect(exported).toContain("<parents>A_RENAMED</parents>");

    const roundTripped = importBayesianNetworkXdsl(exported, testBayesianNetworkModel());
    const roundTrippedB = roundTripped.nodes.find(({ code }) => code === "B_RENAMED")!;
    const roundTrippedParent = roundTripped.conditionalProbabilityTables
      .find(({ nodeId }) => nodeId === roundTrippedB.id)!.parents[0]!;
    expect(roundTripped.nodes.find(({ id }) => id === roundTrippedParent.nodeId)?.code).toBe("A_RENAMED");
    expect(roundTripped.xdslMetadata?.extensionsXml).toContain('submodel id="SM-EQUIPMENT"');

    const withoutB = new DOMParser().parseFromString(
      exportBayesianNetworkXdsl(deleteNode(imported, importedB.id)),
      "application/xml",
    );
    expect(withoutB.querySelector('node[id="B"]')).toBeNull();
    expect(withoutB.querySelector('submodel[id="SM-EQUIPMENT"] custom')?.textContent).toBe("vendor metadata");
  });

  it("exports OpenPRA positions as GeNIe metadata for networks created in the editor", () => {
    const xdsl = exportBayesianNetworkXdsl(testBayesianNetworkModel());
    const document = new DOMParser().parseFromString(xdsl, "application/xml");
    expect(document.querySelector("extensions genie node")).not.toBeNull();
    expect(document.querySelector('node[id="A"] position')?.textContent).toBe("40 40 220 110");
  });

  it("rejects unsupported XDSL node families", () => {
    expect(() => importBayesianNetworkXdsl(
      '<smile><nodes><decision id="D"><state id="no"/></decision></nodes></smile>',
    )).toThrow(/Only discrete CPT nodes/i);
  });
});
