import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assignBayesianNetworkNodesToSubmodel as assign,
  saveBayesianNetworkSubmodel as save,
  removeBayesianNetworkSubmodel as remove,
  readBayesianNetworkSubmodels as groups,
  positionBayesianNetworkSubmodels,
  importBayesianNetworkXdsl,
  exportBayesianNetworkXdsl,
  importBayesianNetworkJson,
  exportBayesianNetworkJson,
} from "../bayesianNetworkInterchange";
import { toCanonicalBayesianNetwork } from "../bayesianNetworkCanonical";
import { createSubmodelOverview, arrangeSubmodelOverview } from "../bayesianNetworkSubmodels";
import { createBayesianNetworkModuleFromBranch, instantiateBayesianNetworkModule } from "../bayesianNetworkModules";
import { deleteNode } from "../bayesianNetworkOperations";
import { testBayesianNetworkModel } from "./bayesianNetworkTestModel";
import { validateBayesianNetworkModel, type BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";

const xml = readFileSync(resolve(__dirname, "../../../../../../../resources/examples/bayesian-networks/grouping-demo.xdsl"), "utf8");
const demo = () => importBayesianNetworkXdsl(xml);
const group = (model: BayesianNetworkModel, path: string) => groups(model).find((entry) => entry.path === path)!;
const nodeId = (model: BayesianNetworkModel, code: string) => model.nodes.find((node) => node.code === code)!.id;
const membership = (model: BayesianNetworkModel) => groups(model).map((entry) => ({
  path: entry.path, members: entry.nodeIds.map((id) => model.nodes.find((node) => node.id === id)!.code).sort(),
})).sort((a, b) => a.path.localeCompare(b.path));

describe("visual group authoring", () => {
  it("creates and nests groups, moves members and survives XDSL and workbook JSON reload without altering calculation data", () => {
    const before = testBayesianNetworkModel();
    const canonical = toCanonicalBayesianNetwork(before);
    let model = save(before, { name: "Equipment", parentId: null, nodeIds: [before.nodes[0]!.id] });
    model = save(model, { name: "Controls", parentId: group(model, "Equipment").id, nodeIds: [before.nodes[1]!.id] });
    model = assign(model, [before.nodes[0]!.id], group(model, "Equipment / Controls").id);
    model = assign(model, [before.nodes[1]!.id], null);
    expect(group(model, "Equipment").nodeIds).toEqual([]);
    expect(group(model, "Equipment / Controls").nodeIds).toEqual([before.nodes[0]!.id]);
    expect(model.nodes).toBe(before.nodes);
    expect(model.edges).toBe(before.edges);
    expect(model.conditionalProbabilityTables).toBe(before.conditionalProbabilityTables);
    expect(toCanonicalBayesianNetwork(model)).toEqual(canonical);
    expect(validateBayesianNetworkModel(model)).toEqual([]);
    for (const restored of [importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model)), importBayesianNetworkJson(exportBayesianNetworkJson(model))]) {
      expect(membership(restored)).toEqual(membership(model));
      expect(toCanonicalBayesianNetwork(restored)).toEqual(canonical);
    }
    expect(before.xdslMetadata).toBeUndefined();
  });

  it("renames and reparents groups while retaining nested groups and deselecting direct members", () => {
    const before = demo();
    const model = save(before, { id: group(before, "Pumps").id, name: "Equipment", parentId: group(before, "Heat removal").id, nodeIds: [nodeId(before, "PumpA")] });
    expect(group(model, "Heat removal / Equipment").nodeIds).toEqual([nodeId(model, "PumpA")]);
    expect(group(model, "Heat removal").nodeIds).toContain(nodeId(model, "PumpB"));
    expect(group(model, "Heat removal / Equipment / Controls").nodeIds).toEqual([nodeId(model, "Controller")]);
    expect(toCanonicalBayesianNetwork(model)).toEqual(toCanonicalBayesianNetwork(before));
  });

  it("removes only the visual group, lifting its nodes and child groups", () => {
    const before = demo();
    const model = remove(before, group(before, "Pumps").id);
    expect(groups(model).map((entry) => entry.path)).toEqual(["Heat removal", "Controls"]);
    expect(createSubmodelOverview(model, groups(model), null).entities.filter((entity) => entity.nodeId).map((entity) => entity.nodeId))
      .toEqual(["Power", "PumpA", "PumpB"].map((code) => nodeId(model, code)));
    expect(toCanonicalBayesianNetwork(model)).toEqual(toCanonicalBayesianNetwork(before));
  });

  it("rejects invalid names, stale nodes/groups, sibling duplicates and hierarchy cycles without changing the input", () => {
    const model = demo();
    const frozen = JSON.stringify(model);
    expect(() => save(model, { name: " ", parentId: null, nodeIds: [] })).toThrow("name is required");
    expect(() => save(model, { name: "Pumps", parentId: null, nodeIds: [] })).toThrow("already exists");
    expect(() => save(model, { id: group(model, "Pumps").id, name: "Pumps", parentId: group(model, "Pumps / Controls").id, nodeIds: [] })).toThrow("descendants");
    expect(() => assign(model, ["missing"], null)).toThrow("node no longer exists");
    expect(() => assign(model, [], "missing")).toThrow("group no longer exists");
    expect(JSON.stringify(model)).toBe(frozen);
  });

  it.each([false, true])("preserves vendor data and node styles when moving or removing groups, prefixed=%s", (prefixed) => {
    let source = xml.replace('<genie version=', '<genie xmlns:v="urn:vendor" version=').replace('<node id="PumpA">', '<v:settings flag="keep"/><node id="PumpA"><interior color="123456"/>');
    if (prefixed) source = source.replace('<smile ', '<smile xmlns:g="urn:genie" ').replace(/<(\/?)(genie|submodel|node|name|position|comment|interior)(?=[\s/>])/g, "<$1g:$2");
    let model = importBayesianNetworkXdsl(source);
    const canonical = toCanonicalBayesianNetwork(model);
    model = assign(model, [nodeId(model, "PumpA")], group(model, "Heat removal").id);
    model = remove(model, group(model, "Pumps").id);
    const exported = exportBayesianNetworkXdsl(model);
    const doc = new DOMParser().parseFromString(exported, "application/xml");
    expect(doc.getElementsByTagNameNS("urn:vendor", "settings")[0]!.getAttribute("flag")).toBe("keep");
    expect(exported).toContain('color="123456"');
    const restored = importBayesianNetworkXdsl(exported);
    expect(toCanonicalBayesianNetwork(restored)).toEqual(canonical);
    expect(group(restored, "Heat removal").nodeIds).toContain(nodeId(restored, "PumpA"));
  });

  it("keeps manually moved template nodes in their chosen group after export", () => {
    const before = testBayesianNetworkModel();
    const created = createBayesianNetworkModuleFromBranch(before, before.nodes[0]!.id);
    const instance = instantiateBayesianNetworkModule(created.model, created.templateId);
    const copied = instance.model.moduleInstances![0]!.nodeMappings.map((entry) => entry.nodeId);
    let model = save(instance.model, { name: "Manual group", parentId: null, nodeIds: copied });
    model = importBayesianNetworkJson(exportBayesianNetworkJson(model));
    expect(group(model, "Manual group").nodeIds.sort()).toEqual(copied.sort());
    expect(groups(model).filter((entry) => entry.name !== "Manual group").every((entry) => entry.nodeIds.length === 0)).toBe(true);
    expect(toCanonicalBayesianNetwork(model)).toEqual(toCanonicalBayesianNetwork(instance.model));
  });

  it("handles renamed/deleted nodes and repeated imported membership without leaving stale assignments", () => {
    let model = demo();
    model.xdslMetadata!.extensionsXml = model.xdslMetadata!.extensionsXml!.replace('</genie>', '<submodel id="Repeat"><node id="PumpA"/></submodel></genie>');
    const id = nodeId(model, "PumpA");
    model = { ...model, nodes: model.nodes.map((node) => node.id === id ? { ...node, code: "Renamed" } : node) };
    model = assign(model, [id], group(model, "Heat removal").id);
    expect(groups(model).flatMap((entry) => entry.nodeIds).filter((entry) => entry === id)).toHaveLength(1);
    expect(group(model, "Heat removal").nodeIds).toContain(id);
    model = deleteNode(model, id);
    expect(groups(model).flatMap((entry) => entry.nodeIds)).not.toContain(id);
    expect(exportBayesianNetworkXdsl(model)).not.toContain('id="Renamed"');
  });

  it("stores group positions and lays out scopes without moving hidden nodes", () => {
    const before = demo();
    const view = createSubmodelOverview(before, groups(before), null);
    const layout = arrangeSubmodelOverview(view, {});
    expect([...layout.values()].every((position) => Number.isFinite(position.x) && Number.isFinite(position.y))).toBe(true);
    const id = group(before, "Pumps").id;
    const model = positionBayesianNetworkSubmodels(before, new Map([[id, { x: 50, y: 60 }]]));
    expect(group(importBayesianNetworkXdsl(exportBayesianNetworkXdsl(model)), "Pumps").position).toEqual({ x: 50, y: 60 });
    expect(model.nodePositions).toBe(before.nodePositions);
    expect(toCanonicalBayesianNetwork(model)).toEqual(toCanonicalBayesianNetwork(before));
  });
});
