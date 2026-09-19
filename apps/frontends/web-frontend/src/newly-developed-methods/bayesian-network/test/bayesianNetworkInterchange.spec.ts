import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  exportBayesianNetworkJson,
  exportCanonicalBayesianNetworkJson,
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


const sourceNetwork = {
  id: "EarthquakePump",
  variables: [
    { name: "Earthquake", states: ["No", "Yes"], parents: [], probabilities: [0.9, 0.1] },
    { name: "Power", states: ["On", "Off", "Backup"], parents: [], probabilities: [0.6, 0.3, 0.1] },
    { name: "Pump", states: ["Works", "Fails"], parents: ["Power", "Earthquake"],
      probabilities: [0.99, 0.01, 0.2, 0.8, 0.7, 0.3, 0.1, 0.9, 0.8, 0.2, 0.4, 0.6] },
  ],
};
const simpleXdsl = '<smile id="Test"><nodes><cpt id="A"><state id="No"/><state id="Yes"/><probabilities>0.8 0.2</probabilities></cpt></nodes></smile>';

describe("source-compatible BN interchange", () => {
  it("round-trips main canonical JSON with unequal parent cardinalities", () => {
    const model = importBayesianNetworkJson(JSON.stringify(sourceNetwork));
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(model))).toEqual(sourceNetwork);
    const xdslModel = importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model));
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(xdslModel))).toEqual(sourceNetwork);
  });

  it("indexes shuffled CPT rows, parent references and values by their assignments", () => {
    const model = importBayesianNetworkJson(JSON.stringify(sourceNetwork));
    model.conditionalProbabilityTables.forEach((table) => {
      table.parents.reverse();
      table.rows.reverse();
      table.rows.forEach((row) => { row.parentStates.reverse(); row.values.reverse(); });
    });
    expect(validateBayesianNetworkModel(model)).toEqual([]);
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(model))).toEqual(sourceNetwork);
    const reloaded = importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model));
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(reloaded))).toEqual(sourceNetwork);
  });

  it("keeps probabilities attached to states after parent and child state reordering", () => {
    const model = importBayesianNetworkJson(JSON.stringify(sourceNetwork));
    model.nodes[0]!.states.reverse();
    model.nodes[2]!.states.reverse();
    const canonical = JSON.parse(exportCanonicalBayesianNetworkJson(model));
    expect(canonical.variables[2].states).toEqual(["Fails", "Works"]);
    expect(canonical.variables[2].probabilities).toEqual([0.8, 0.2, 0.01, 0.99, 0.9, 0.1, 0.3, 0.7, 0.6, 0.4, 0.2, 0.8]);
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model))))).toEqual(canonical);
  });

  it.each([false, true])("preserves single-state nodes through JSON/XDSL, prefixed=%s", (prefixed) => {
    let xml = '<smile id="Certain"><nodes><cpt id="Certain"><state id="Only"/><probabilities>1</probabilities></cpt></nodes></smile>';
    if (prefixed) xml = xml.replace(/<(\/?)(smile|nodes|cpt|state|probabilities)/g, '<$1x:$2').replace('<x:smile ', '<x:smile xmlns:x="urn:xdsl" ');
    const model = importBayesianNetworkXdsl(xml);
    expect(validateBayesianNetworkModel(model)).toEqual([]);
    expect(model.nodes[0]!.states).toHaveLength(1);
    expect(importBayesianNetworkJson(exportBayesianNetworkJson(model))).toEqual(model);
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model))))).toEqual({
      id: "Certain", variables: [{ name: "Certain", states: ["Only"], parents: [], probabilities: [1] }],
    });
  });

  it("keeps source case-sensitive names and the 1e-6 CPT tolerance without normalizing", () => {
    const source = { variables: [
      { name: "A", states: ["On", "on"], probabilities: [0.7, 0.3000005] },
      { name: "a", states: ["Only"], probabilities: [1] },
    ] };
    const model = importBayesianNetworkJson(JSON.stringify(source));
    expect(model.nodes.map((node) => node.code)).toEqual(["A", "a"]);
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(model)).variables[0].probabilities).toEqual([0.7, 0.3000005]);
    source.variables[0]!.probabilities = [0.7, 0.300002];
    expect(() => importBayesianNetworkJson(JSON.stringify(source))).toThrow(/sum to one/);
  });

  it.each([
    ['bad sum', simpleXdsl.replace('0.8 0.2', '0.8 0.8')],
    ['duplicate states', simpleXdsl.replace('id="Yes"', 'id="No"')],
    ['missing parent', simpleXdsl.replace('<probabilities>', '<parents>Missing</parents><probabilities>')],
    ['self edge', simpleXdsl.replace('<probabilities>0.8 0.2', '<parents>A</parents><probabilities>0.8 0.2 0.5 0.5')],
    ['duplicate parents', simpleXdsl.replace('<probabilities>0.8 0.2', '<parents>A A</parents><probabilities>0.8 0.2 0.5 0.5 0.2 0.8 0.3 0.7')],
    ['negative', simpleXdsl.replace('0.8 0.2', '-0.2 1.2')],
    ['infinite', simpleXdsl.replace('0.8 0.2', '1e999 0')],
    ['hexadecimal', simpleXdsl.replace('0.8 0.2', '0x1 0')],
    ['missing values', simpleXdsl.replace('0.8 0.2', '0.8')],
    ['empty state list', simpleXdsl.replace('<state id="No"/><state id="Yes"/>', '')],
    ['duplicate probability element', simpleXdsl.replace('</cpt>', '<probabilities>0.3 0.7</probabilities></cpt>')],
    ['duplicate nodes collection', simpleXdsl.replace('</smile>', '<nodes/></smile>')],
    ['malformed XML', '<smile><nodes></smile>'],
  ])("rejects malformed XDSL: %s", (_name, xml) => {
    expect(() => importBayesianNetworkXdsl(xml)).toThrow();
  });

  it("rejects a directed cycle through all import/export formats", () => {
    const model = importBayesianNetworkJson(JSON.stringify(sourceNetwork));
    const cyclicSource = { variables: [
      { name: "A", states: ["Only"], parents: ["B"], probabilities: [1] },
      { name: "B", states: ["Only"], parents: ["A"], probabilities: [1] },
    ] };
    expect(() => importBayesianNetworkJson(JSON.stringify(cyclicSource))).toThrow(/cycle/);
    const xml = '<smile><nodes><cpt id="A"><state id="Only"/><parents>B</parents><probabilities>1</probabilities></cpt><cpt id="B"><state id="Only"/><parents>A</parents><probabilities>1</probabilities></cpt></nodes></smile>';
    expect(() => importBayesianNetworkXdsl(xml)).toThrow(/cycle/);
    const table = model.conditionalProbabilityTables[2]!;
    table.rows[1]!.parentStates = table.rows[0]!.parentStates;
    expect(() => importBayesianNetworkJson(JSON.stringify(model))).toThrow();
    expect(() => exportBayesianNetworkJson(model)).toThrow();
    expect(() => exportCanonicalBayesianNetworkJson(model)).toThrow();
    expect(() => exportBayesianNetworkXdsl(model)).toThrow();
  });

  it.each(['missing parent', 'missing row', 'duplicate row', 'bad parent order', 'bad sum'])('rejects invalid exports: %s', (kind) => {
    const model = importBayesianNetworkJson(JSON.stringify(sourceNetwork));
    const table = model.conditionalProbabilityTables[2]!;
    if (kind === 'missing parent') table.parents[0]!.nodeId = TEST_ID.a;
    if (kind === 'missing row') table.rows.pop();
    if (kind === 'duplicate row') table.rows[1] = table.rows[0]!;
    if (kind === 'bad parent order') table.parents[0]!.order = 10;
    if (kind === 'bad sum') table.rows[0]!.values[0]!.probability = 0.5;
    expect(() => exportBayesianNetworkXdsl(model)).toThrow();
    expect(() => exportCanonicalBayesianNetworkJson(model)).toThrow();
    expect(() => exportBayesianNetworkJson(model)).toThrow();
  });

  it("handles trimmed node IDs consistently and rejects internal whitespace", () => {
    const model = importBayesianNetworkXdsl(simpleXdsl.replace('cpt id="A"', 'cpt id=" A "'));
    expect(model.nodes[0]!.code).toBe("A");
    expect(() => importBayesianNetworkXdsl(simpleXdsl.replace('cpt id="A"', 'cpt id="A B"'))).toThrow(/whitespace/);
    model.nodes[0]!.code = "A B";
    expect(() => exportBayesianNetworkXdsl(model)).toThrow(/whitespace/);
  });

  it("round-trips names, comments, edited positions and opaque vendor records", () => {
    const input = simpleXdsl.replace('</smile>', '<extensions><genie name="Original name"><comment>Original comment</comment><node id="A"><name>Original node</name><comment>Original note</comment><position>1 2 101 52</position></node></genie><vendor><node id="A"><name>Opaque name</name><position>9 9 9 9</position></node></vendor></extensions></smile>');
    const model = importBayesianNetworkXdsl(input);
    expect(model.name).toBe("Original name");
    expect(model.description).toBe("Original comment");
    model.name = 'Edited & <network>';
    model.description = 'Edited "description"';
    model.nodes[0]!.name = 'Edited node';
    model.nodes[0]!.description = 'Edited node note';
    model.nodePositions[0]!.position = { x: 10, y: 20 };
    const xml = exportBayesianNetworkXdsl(model);
    const rt = importBayesianNetworkXdsl(xml);
    expect(rt.name).toBe(model.name);
    expect(rt.description).toBe(model.description);
    expect(rt.nodes[0]!.description).toBe(model.nodes[0]!.description);
    expect(rt.nodePositions[0]!.position).toEqual({ x: 10, y: 20 });
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('vendor node name')!.textContent).toBe('Opaque name');
    expect(doc.querySelector('genie node position')!.textContent).toBe('10 20 110 70');
  });

  it("writes descriptions for nodes and networks created in OpenPRA", () => {
    const model = testBayesianNetworkModel();
    model.description = 'Network description'; model.nodes[0]!.description = 'Pump description';
    const rt = importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model));
    expect(rt.name).toBe(model.name);
    expect(rt.description).toBe(model.description);
    expect(rt.nodes[0]!.description).toBe(model.nodes[0]!.description);
  });

  it("replaces instances while retaining self-contained templates and workbook identity", () => {
    const created = createBayesianNetworkModuleFromBranch(connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b), TEST_ID.b);
    const template = created.model.moduleTemplates![0]!;
    const current = instantiateBayesianNetworkModule(created.model, template.id, {
      inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: TEST_ID.a }],
    }).model;
    for (const imported of [importBayesianNetworkXdsl(simpleXdsl, current), importBayesianNetworkJson(JSON.stringify(sourceNetwork), current)]) {
      expect(imported.modelId).toBe(current.modelId);
      expect(imported.moduleTemplates).toEqual(current.moduleTemplates);
      expect(imported.moduleInstances).toBeUndefined();
      expect(validateBayesianNetworkModel(imported)).toEqual([]);
    }
    expect(current.moduleInstances).toHaveLength(1);
  });

  it("rejects unsupported canonical fields instead of guessing another format", () => {
    expect(() => importBayesianNetworkJson(JSON.stringify({ ...sourceNetwork, extra: true }))).toThrow();
    expect(() => importBayesianNetworkJson(JSON.stringify({ variables: [] }))).toThrow();
  });

  it.each([1, 2, 3, 4])("preserves the source CPTs in HCL_MH case %i", (number) => {
    const xml = readFileSync(resolve(__dirname, '../../../../../../solvers/praxis/tests/fixtures/hcl_mh_xdsl', `Case_${number}/BN.xdsl`), 'utf8');
    const source = new DOMParser().parseFromString(xml, 'application/xml');
    const expected = [...source.querySelectorAll('nodes > cpt')].map((node) => ({
      name: node.id,
      states: [...node.querySelectorAll('state')].map((state) => state.id),
      parents: (node.querySelector('parents')?.textContent ?? '').trim().split(/\s+/).filter(Boolean),
      probabilities: node.querySelector('probabilities')!.textContent!.trim().split(/\s+/).map(Number),
    }));
    const imported = importBayesianNetworkXdsl(xml);
    const exported = importBayesianNetworkXdsl(exportBayesianNetworkXdsl(imported));
    expect(JSON.parse(exportCanonicalBayesianNetworkJson(exported)).variables).toEqual(expected);
  });
});


it("preserves namespaced GeNIe metadata and default-namespace XDSL", () => {
  for (const declaration of ['xmlns="urn:xdsl"', 'xmlns:x="urn:xdsl"']) {
    let xml = simpleXdsl.replace('<smile ', `<smile ${declaration} `).replace('</smile>',
      '<extensions><genie name="Namespaced"><submodel id="Group"><node id="A"><name>Named node</name><comment>Note</comment><position>10 20 110 70</position></node></submodel></genie></extensions></smile>');
    if (declaration.startsWith('xmlns:x')) xml = xml.replace(/<(\/?)(smile|nodes|cpt|state|probabilities|extensions|genie|submodel|node|name|comment|position)(?=[\s/>])/g, '<$1x:$2');
    const model = importBayesianNetworkXdsl(xml);
    model.nodes[0]!.description = 'Edited';
    const roundTrip = importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model));
    expect(roundTrip.name).toBe('Namespaced');
    expect(roundTrip.nodes[0]!.name).toBe('Named node');
    expect(roundTrip.nodes[0]!.description).toBe('Edited');
    expect(roundTrip.nodePositions[0]!.position).toEqual({ x: 10, y: 20 });
  }
});
