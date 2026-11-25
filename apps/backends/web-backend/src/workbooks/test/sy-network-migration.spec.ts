import { esqStableId } from "interfaces-mef-types/esq/esq-run-inputs";
import { EsqFunctionLinkSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import {
  carriedNodeLinks,
  convertEsqNetworkLinks,
  esqTargets,
  heldSyNetworks,
  nodeLinkKey,
  receiveSyNetworks,
  stripEsNetworks,
  sySourceOf,
  withoutNetworks,
  withoutNetworkNodes,
  type EsqPlacement,
} from "../sy-network-migration";
import type { JsonRecord } from "../uncertainty-migration-json";

const SY = "sy-1";
const ESQ = "esq-1";
const NETWORK = "network-1";
const CONFIGURATION = "configuration-1";
const NODE = "node-1";
const FAILED = "state-failed";
const TREE = "tree-1";
const OTHER_TREE = "tree-2";

interface Stored {
  workbookId: string;
  projectId: string;
  mef: JsonRecord;
  prior?: JsonRecord;
}

interface Stores {
  sy: Stored[];
  esq: Stored[];
  es: Stored[];
}

function network(modelId = NETWORK, code = "BN-1"): JsonRecord {
  return { modelId, code, name: "Shared condition", description: "", nodes: [{ id: NODE, code: "N", name: "Node", states: [{ id: "state-ok" }, { id: FAILED }] }], edges: [] };
}

function nodeReference(workbookId: string): JsonRecord {
  return { referenceType: "BAYESIAN_NETWORK_NODE", workbookId, modelId: NETWORK, entityId: NODE };
}

function eventReference(workbookId: string): JsonRecord {
  return { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId, entityId: "event-1" };
}

function configuration(workbookId: string, modelId = CONFIGURATION, code = "DEP-1"): JsonRecord {
  return {
    modelId,
    code,
    name: "Bindings",
    description: "",
    bayesianNetwork: { workbookId, modelId: NETWORK },
    faultTrees: [{ workbookId: SY, modelId: "fault-tree-1" }],
    bindings: [{ id: "binding-1", faultTreeBasicEvent: eventReference(SY), bayesianNetworkNode: nodeReference(workbookId), trueStateIds: [FAILED] }],
    baseEvidence: { observations: [] },
    solverSettings: {
      variableOrder: null,
      foldConstants: true,
      spliceNullGates: true,
      uncertainty: {
        sampleCount: 100,
        sampler: "MC",
        basicEvents: [{ faultTreeBasicEvent: eventReference(SY), expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SY, entityId: "parameter-1" } } }],
        cptRows: [{ bayesianNetworkNode: nodeReference(workbookId), cptRowId: "row-1", row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [1, 1] } } }],
        cptGenerators: [{ bayesianNetworkNode: nodeReference(workbookId), generator: { kind: "SEISMIC_PGA_BINS" } }],
        cptRowDistributions: [{ bayesianNetworkNode: nodeReference(workbookId), cptRowId: "row-2", prior: { family: "DIRICHLET", alpha: [1, 1] } }],
      },
    },
  };
}

function syMef(): JsonRecord {
  return { name: "Systems", systemLogicModels: [], dependencyBayesianNetworks: [network()], dependencyHclConfigurations: [configuration(SY)] };
}

function nodeLink(treeId: string, trueStateIds: string[] = [FAILED]): JsonRecord {
  return { treeId, node: { workbookId: SY, modelId: NETWORK, nodeId: NODE }, trueStateIds, label: "N · Node · BN-1" };
}

function treeRecord(id: string, initiatorId = "IEG-1", stateId = "POS-1"): JsonRecord {
  return { id, code: id.toUpperCase(), name: id, initiatorId, stateId, functionIds: ["RPS"], transferEntry: false };
}

function esqMef(overrides: JsonRecord = {}): JsonRecord {
  return {
    name: "Quantification",
    linkedWorkbooks: { SY },
    model: {
      sources: [{ element: "SY", workbookId: SY, workbookName: "Systems" }],
      trees: [treeRecord(TREE), treeRecord(OTHER_TREE, "IEG-2", "POS-2")],
      functions: [{ id: "RPS", name: "Reactor trip", treeIds: [TREE, OTHER_TREE], esLinks: [], nodeLinks: [nodeLink(TREE)] }],
    },
    bayesianNetworks: [],
    hclConfigurations: [],
    ...overrides,
  };
}

function functionalEvent(uuid: string, label: string, linked: boolean): JsonRecord {
  return { uuid, name: label, label, order: 0, ...(linked ? { networkNode: { bayesianNetworkNode: nodeReference(SY), trueStateIds: [FAILED] } } : {}) };
}

function eventTree(uuid: string, linked: boolean): JsonRecord {
  return { uuid, name: `Tree ${uuid}`, label: uuid.toUpperCase(), functionalEvents: { "fe-1": functionalEvent("fe-1", "RPS", linked), "fe-2": functionalEvent("fe-2", "DHR", false) }, sequences: {} };
}

function placementsOf(esqs: readonly Stored[]): EsqPlacement[] {
  return esqs.map((esq) => {
    const sySource = sySourceOf(esq.mef);
    return { workbookId: esq.workbookId, projectId: esq.projectId, ...(sySource === undefined ? {} : { sySource }) };
  });
}

function migrated(stores: Stores): { stores: Stores; notes: string[] } {
  const notes: string[] = [];
  const carried = new Set<string>();
  const esqById = new Map(stores.esq.map((esq) => [esq.workbookId, esq]));
  const convert = (mef: JsonRecord, workbookId: string): JsonRecord => {
    const conversion = convertEsqNetworkLinks(mef, workbookId);
    for (const key of [...carriedNodeLinks(mef), ...carriedNodeLinks(conversion.mef)]) carried.add(key);
    notes.push(...conversion.notes);
    return conversion.mef;
  };
  const restore = (prior: JsonRecord | undefined, change: (part: JsonRecord) => JsonRecord): { prior?: JsonRecord } => (prior === undefined ? {} : { prior: change(prior) });
  const placements = placementsOf(stores.esq);
  const sy = stores.sy.map((holder) => {
    const held = heldSyNetworks(holder.mef, holder.prior);
    if (held === undefined) return holder;
    for (const esqId of esqTargets(holder.workbookId, holder.projectId, placements)) {
      const esq = esqById.get(esqId);
      if (esq === undefined) continue;
      esqById.set(esqId, {
        ...esq,
        mef: convert(receiveSyNetworks(esq.mef, esqId, held, holder.workbookId), esqId),
        ...restore(esq.prior, (part) => convertEsqNetworkLinks(receiveSyNetworks(part, esqId, held, holder.workbookId), esqId).mef),
      });
    }
    return { ...holder, mef: withoutNetworks(holder.mef), ...restore(holder.prior, withoutNetworks) };
  });
  const esq = stores.esq.map((holder) => {
    const current = esqById.get(holder.workbookId) ?? holder;
    return { ...current, mef: convert(current.mef, holder.workbookId), ...restore(current.prior, (part) => convertEsqNetworkLinks(part, holder.workbookId).mef) };
  });
  const es = stores.es.map((holder) => {
    const stripped = stripEsNetworks(holder.mef, carried);
    notes.push(...stripped.notes);
    return { ...holder, mef: stripped.mef };
  });
  return { stores: { sy, esq, es }, notes };
}

function expectedRule(functionId: string, treeId: string, esqId = ESQ): JsonRecord {
  return {
    id: esqStableId(`node-link:${functionId}:${treeId}`),
    treeIds: [treeId],
    groupIds: [],
    stateIds: [],
    target: { kind: "NETWORK_NODE", node: { workbookId: esqId, modelId: NETWORK, nodeId: NODE }, trueStateIds: [FAILED] },
    reason: "",
  };
}

describe("dependency network move from SY to ESQ", () => {
  it("reads the SY source of an ESQ workbook from its link, then from its import", () => {
    expect(sySourceOf({ linkedWorkbooks: { SY: "sy-linked" }, model: { sources: [{ element: "SY", workbookId: "sy-imported" }] } })).toBe("sy-linked");
    expect(sySourceOf({ linkedWorkbooks: { DA: "da-1" }, model: { sources: [{ element: "ES", workbookId: "es-1" }, { element: "SY", workbookId: "sy-imported" }] } })).toBe("sy-imported");
    expect(sySourceOf({ linkedWorkbooks: { SY: "example-sy-htgr" }, model: { sources: [{ element: "SY", workbookId: "sy-imported" }] } })).toBe("sy-imported");
    expect(sySourceOf({ linkedWorkbooks: { SY: "example-sy-htgr" }, model: { sources: [{ element: "SY", workbookId: "example-sy-htgr" }] } })).toBeUndefined();
    expect(sySourceOf({})).toBeUndefined();
  });

  it("moves the networks and configurations to the one linked ESQ workbook", () => {
    const { stores, notes } = migrated({
      sy: [{ workbookId: SY, projectId: "project-1", mef: syMef() }],
      esq: [
        { workbookId: ESQ, projectId: "project-1", mef: esqMef({ model: { sources: [], trees: [], functions: [] } }) },
        { workbookId: "esq-other", projectId: "project-1", mef: esqMef({ linkedWorkbooks: { SY: "sy-other" }, model: { sources: [], trees: [], functions: [] } }) },
      ],
      es: [],
    });
    expect(stores.sy[0]?.mef).toEqual({ name: "Systems", systemLogicModels: [] });
    expect(stores.esq[0]?.mef["bayesianNetworks"]).toEqual([network()]);
    expect(stores.esq[0]?.mef["hclConfigurations"]).toMatchObject([{ modelId: CONFIGURATION, bayesianNetwork: { workbookId: ESQ, modelId: NETWORK } }]);
    expect(stores.esq[1]?.mef["bayesianNetworks"]).toEqual([]);
    expect(stores.esq[1]?.mef["hclConfigurations"]).toEqual([]);
    expect(notes).toEqual([]);
  });

  it("copies to every ESQ workbook that takes its fault trees from the SY workbook", () => {
    const placements: EsqPlacement[] = [
      { workbookId: "esq-a", projectId: "project-1", sySource: SY },
      { workbookId: "esq-b", projectId: "project-2", sySource: SY },
      { workbookId: "esq-c", projectId: "project-1", sySource: "sy-other" },
      { workbookId: "esq-d", projectId: "project-1" },
    ];
    expect(esqTargets(SY, "project-1", placements)).toEqual(["esq-a", "esq-b"]);
    for (const esqId of ["esq-a", "esq-b"]) {
      const received = receiveSyNetworks(esqMef(), esqId, syMef(), SY);
      expect(received["bayesianNetworks"]).toEqual([network()]);
      expect(received["hclConfigurations"]).toEqual([configuration(esqId)]);
    }
  });

  it("falls back to the ESQ workbooks of the same project when none links the SY workbook", () => {
    const placements: EsqPlacement[] = [
      { workbookId: "esq-a", projectId: "project-1" },
      { workbookId: "esq-b", projectId: "project-1", sySource: "sy-other" },
      { workbookId: "esq-c", projectId: "project-2" },
    ];
    expect(esqTargets(SY, "project-1", placements)).toEqual(["esq-a", "esq-b"]);
  });

  it("removes the fields from SY when no ESQ workbook can hold them", () => {
    expect(esqTargets(SY, "project-1", [{ workbookId: "esq-c", projectId: "project-2" }])).toEqual([]);
    const { stores } = migrated({ sy: [{ workbookId: SY, projectId: "project-1", mef: syMef() }], esq: [{ workbookId: "esq-c", projectId: "project-2", mef: esqMef({ linkedWorkbooks: {}, model: { sources: [], trees: [], functions: [] } }) }], es: [] });
    expect(stores.sy[0]?.mef).toEqual({ name: "Systems", systemLogicModels: [] });
    expect(stores.esq[0]?.mef["hclConfigurations"]).toEqual([]);
  });

  it("replaces an ESQ entry with the same model id and keeps the others", () => {
    const esq = esqMef({
      bayesianNetworks: [network("network-kept", "BN-KEPT"), network(NETWORK, "BN-STALE")],
      hclConfigurations: [configuration(ESQ, CONFIGURATION, "DEP-STALE"), configuration(ESQ, "configuration-kept", "DEP-KEPT")],
    });
    const received = receiveSyNetworks(esq, ESQ, syMef(), SY);
    expect(received["bayesianNetworks"]).toEqual([network("network-kept", "BN-KEPT"), network()]);
    expect(received["hclConfigurations"]).toEqual([configuration(ESQ, "configuration-kept", "DEP-KEPT"), configuration(ESQ)]);
  });

  it("gathers the networks of the live and the prior contents of an SY workbook and lets the live entry win", () => {
    const empty = { name: "Plain", dependencyBayesianNetworks: [], dependencyHclConfigurations: [] };
    expect(heldSyNetworks({ name: "Plain" }, undefined)).toBeUndefined();
    expect(heldSyNetworks(empty, empty)).toBeUndefined();
    expect(heldSyNetworks(syMef(), undefined)).toEqual({ dependencyBayesianNetworks: [network()], dependencyHclConfigurations: [configuration(SY)] });
    expect(heldSyNetworks(empty, syMef())).toEqual({ dependencyBayesianNetworks: [network()], dependencyHclConfigurations: [configuration(SY)] });
    const prior = {
      dependencyBayesianNetworks: [network(NETWORK, "BN-PRIOR"), network("network-prior", "BN-PRIOR-ONLY")],
      dependencyHclConfigurations: [configuration(SY, CONFIGURATION, "DEP-PRIOR"), configuration(SY, "configuration-prior", "DEP-PRIOR-ONLY")],
    };
    expect(heldSyNetworks(syMef(), prior)).toEqual({
      dependencyBayesianNetworks: [network("network-prior", "BN-PRIOR-ONLY"), network()],
      dependencyHclConfigurations: [configuration(SY, "configuration-prior", "DEP-PRIOR-ONLY"), configuration(SY)],
    });
  });

  it("returns the same contents when an ESQ workbook already holds what the SY workbook gives", () => {
    const received = receiveSyNetworks(esqMef(), ESQ, syMef(), SY);
    expect(received).not.toBe(esqMef());
    expect(receiveSyNetworks(received, ESQ, syMef(), SY)).toBe(received);
    const empty = { name: "Plain", dependencyBayesianNetworks: [], dependencyHclConfigurations: [] };
    expect(withoutNetworks(empty)).toBe(empty);
  });

  it("moves networks that only prior contents hold and gives them to both parts of the ESQ workbook", () => {
    const first = migrated({
      sy: [{ workbookId: SY, projectId: "project-1", mef: { name: "Systems", systemLogicModels: [] }, prior: syMef() }],
      esq: [{ workbookId: ESQ, projectId: "project-1", mef: esqMef({ model: { sources: [], trees: [], functions: [] } }), prior: esqMef({ solve: { run: { hcl: { workbookId: SY, modelId: CONFIGURATION, treeIds: [TREE] } }, families: [] } }) }],
      es: [],
    });
    expect(first.stores.sy[0]?.mef).toEqual({ name: "Systems", systemLogicModels: [] });
    expect(first.stores.sy[0]?.prior).toEqual({ name: "Systems", systemLogicModels: [] });
    for (const part of [first.stores.esq[0]?.mef, first.stores.esq[0]?.prior]) {
      expect(part?.["bayesianNetworks"]).toEqual([network()]);
      expect(part?.["hclConfigurations"]).toEqual([configuration(ESQ)]);
    }
    expect(first.stores.esq[0]?.prior).toMatchObject({
      modelDecisions: { functionLinks: [{ functionId: "RPS", rules: [expectedRule("RPS", TREE)] }] },
      solve: { run: { hcl: { workbookId: ESQ, modelId: CONFIGURATION } } },
    });
    expect(first.notes).toEqual([]);
    const second = migrated(first.stores);
    expect(second.stores.sy[0]?.prior).toBe(first.stores.sy[0]?.prior);
    expect(second.stores.esq[0]?.mef).toBe(first.stores.esq[0]?.mef);
    expect(second.stores.esq[0]?.prior).toBe(first.stores.esq[0]?.prior);
  });

  it("repoints every network side reference and leaves the fault tree side on the SY workbook", () => {
    const moved = receiveSyNetworks(esqMef(), ESQ, syMef(), SY)["hclConfigurations"];
    expect(moved).toEqual([configuration(ESQ)]);
    expect(moved).toMatchObject([{
      bayesianNetwork: { workbookId: ESQ },
      faultTrees: [{ workbookId: SY }],
      bindings: [{ faultTreeBasicEvent: { workbookId: SY }, bayesianNetworkNode: { workbookId: ESQ } }],
      solverSettings: {
        uncertainty: {
          basicEvents: [{ faultTreeBasicEvent: { workbookId: SY }, expression: { reference: { workbookId: SY } } }],
          cptRows: [{ bayesianNetworkNode: { workbookId: ESQ } }],
          cptGenerators: [{ bayesianNetworkNode: { workbookId: ESQ } }],
          cptRowDistributions: [{ bayesianNetworkNode: { workbookId: ESQ } }],
        },
      },
    }]);
    const foreign = { ...syMef(), dependencyHclConfigurations: [configuration("sy-foreign")] };
    expect(receiveSyNetworks(esqMef(), ESQ, foreign, SY)["hclConfigurations"]).toEqual([configuration("sy-foreign")]);
  });

  it("turns a node link into a rule for its tree and deletes the node links", () => {
    const { mef, notes } = convertEsqNetworkLinks(esqMef(), ESQ);
    expect(mef["model"]).toMatchObject({ functions: [{ id: "RPS", name: "Reactor trip", treeIds: [TREE, OTHER_TREE], esLinks: [] }] });
    expect(JSON.stringify(mef)).not.toContain("nodeLinks");
    expect(mef["modelDecisions"]).toEqual({ functionLinks: [{ functionId: "RPS", rules: [expectedRule("RPS", TREE)] }] });
    expect(EsqFunctionLinkSchema.safeParse({ functionId: "RPS", rules: [expectedRule("RPS", TREE)] }).success).toBe(true);
    expect(notes).toEqual([]);
  });

  it("adds the rule after the rules a function already has and keeps its other decisions", () => {
    const stateRule = { id: "rule-state", groupIds: [], stateIds: ["POS-2"], target: { kind: "SPLIT_FRACTION" }, reason: "Shutdown" };
    const esq = esqMef({ modelDecisions: { functionLinks: [{ functionId: "DHR", reason: "kept" }, { functionId: "RPS", rules: [stateRule], reason: "typed" }], sequenceChoices: [] } });
    const { mef } = convertEsqNetworkLinks(esq, ESQ);
    expect(mef["modelDecisions"]).toEqual({
      functionLinks: [{ functionId: "DHR", reason: "kept" }, { functionId: "RPS", rules: [stateRule, expectedRule("RPS", TREE)], reason: "typed" }],
      sequenceChoices: [],
    });
  });

  it.each<{ shadow: string; link: JsonRecord }>([
    { shadow: "a rule for the tree", link: { functionId: "RPS", rules: [{ id: "rule-tree", treeIds: [TREE], groupIds: [], stateIds: [], target: { kind: "SPLIT_FRACTION" }, reason: "" }] } },
    { shadow: "a rule for the initiator group and state of the tree", link: { functionId: "RPS", rules: [{ id: "rule-scope", groupIds: ["ieg-1 "], stateIds: ["pos-1"], target: { kind: "SPLIT_FRACTION" }, reason: "" }] } },
    { shadow: "a rule for every tree", link: { functionId: "RPS", rules: [{ id: "rule-all", groupIds: [], stateIds: [], target: { kind: "SPLIT_FRACTION" }, reason: "" }] } },
    { shadow: "the default target of the function", link: { functionId: "RPS", target: { kind: "FAULT_TREE", top: { workbookId: SY, modelId: "fault-tree-1", gateId: "gate-1" } } } },
  ])("makes no rule where $shadow shadowed the node link", ({ link }) => {
    const { mef, notes } = convertEsqNetworkLinks(esqMef({ modelDecisions: { functionLinks: [link] } }), ESQ);
    expect(mef["modelDecisions"]).toEqual({ functionLinks: [link] });
    expect(JSON.stringify(mef)).not.toContain("nodeLinks");
    expect(notes).toEqual([]);
  });

  it("makes no rule where a fault tree link from ES shadowed the node link or the tree is gone", () => {
    const model = {
      sources: [],
      trees: [treeRecord(TREE)],
      functions: [{ id: "RPS", name: "Reactor trip", treeIds: [TREE], esLinks: [{ treeId: TREE, top: { workbookId: SY, modelId: "fault-tree-1", gateId: "gate-1" } }], nodeLinks: [nodeLink(TREE), nodeLink("tree-gone")] }],
    };
    const { mef } = convertEsqNetworkLinks(esqMef({ model }), ESQ);
    expect(mef["modelDecisions"]).toBeUndefined();
    expect(JSON.stringify(mef)).not.toContain("nodeLinks");
  });

  it("keeps a rule that does not match the tree from shadowing the node link", () => {
    const rules: JsonRecord[] = [
      { id: "rule-other-tree", treeIds: [OTHER_TREE], groupIds: [], stateIds: [], target: { kind: "SPLIT_FRACTION" }, reason: "" },
      { id: "rule-other-state", groupIds: ["IEG-1"], stateIds: ["POS-2"], target: { kind: "SPLIT_FRACTION" }, reason: "" },
    ];
    const { mef } = convertEsqNetworkLinks(esqMef({ modelDecisions: { functionLinks: [{ functionId: "RPS", rules }] } }), ESQ);
    expect(mef["modelDecisions"]).toEqual({ functionLinks: [{ functionId: "RPS", rules: [...rules, expectedRule("RPS", TREE)] }] });
  });

  it("makes one rule for each linked tree and drops a link with no failing state", () => {
    const model = {
      sources: [],
      trees: [treeRecord(TREE), treeRecord(OTHER_TREE)],
      functions: [
        { id: "RPS", name: "Reactor trip", treeIds: [TREE, OTHER_TREE], esLinks: [], nodeLinks: [nodeLink(TREE), nodeLink(OTHER_TREE), nodeLink(TREE, ["state-ignored"])] },
        { id: "DHR", name: "Heat removal", treeIds: [TREE], esLinks: [], nodeLinks: [nodeLink(TREE, [])] },
      ],
    };
    const { mef, notes } = convertEsqNetworkLinks(esqMef({ model }), ESQ);
    expect(mef["modelDecisions"]).toEqual({ functionLinks: [{ functionId: "RPS", rules: [expectedRule("RPS", TREE), expectedRule("RPS", OTHER_TREE)] }] });
    expect(notes).toEqual(["Function Heat removal had a network node link with no node or no failing state in event tree TREE-1. It was dropped."]);
  });

  it("strips network node links from the event trees drawn in ESQ", () => {
    const esq = esqMef({ model: { sources: [], trees: [], functions: [] }, modelDecisions: { typedTrees: [eventTree("typed-1", true), eventTree("typed-2", false)], typedInitiators: [] } });
    const { mef } = convertEsqNetworkLinks(esq, ESQ);
    expect(mef["modelDecisions"]).toEqual({ typedTrees: [eventTree("typed-1", false), eventTree("typed-2", false)], typedInitiators: [] });
  });

  it("repoints the run of record when its configuration now lives in the workbook", () => {
    const run = { runId: "run-1", hcl: { workbookId: SY, modelId: CONFIGURATION, treeIds: [TREE] } };
    const received = receiveSyNetworks(esqMef({ model: { sources: [], trees: [], functions: [] }, solve: { run, families: [] } }), ESQ, syMef(), SY);
    expect(convertEsqNetworkLinks(received, ESQ).mef["solve"]).toEqual({ run: { runId: "run-1", hcl: { workbookId: ESQ, modelId: CONFIGURATION, treeIds: [TREE] } }, families: [] });
    const absent = esqMef({ model: { sources: [], trees: [], functions: [] }, solve: { run, families: [] } });
    expect(convertEsqNetworkLinks(absent, ESQ).mef).toBe(absent);
  });

  it("strips node links and leftover networks from ES and names what reached no ESQ workbook", () => {
    const es = { name: "Sequences", eventTrees: [eventTree("tree-1", true), eventTree("tree-2", true)], dependencyBayesianNetworks: [network()], dependencyHclConfigurations: [configuration("es-1")] };
    const carried = new Set(carriedNodeLinks(convertEsqNetworkLinks(esqMef(), ESQ).mef));
    expect([...carried]).toEqual([nodeLinkKey(TREE, NETWORK, NODE)]);
    expect(carriedNodeLinks(esqMef())).toEqual([nodeLinkKey(TREE, NETWORK, NODE)]);
    const stripped = stripEsNetworks(es, carried);
    expect(stripped.mef).toEqual({ name: "Sequences", eventTrees: [eventTree("tree-1", false), eventTree("tree-2", false)] });
    expect(stripped.notes).toEqual([
      "Functional event RPS in event tree TREE-2 lost its network node link. No ESQ workbook had imported it.",
      "Its 1 dependency network and 1 dependency configuration reached no ESQ workbook and were removed. The backup keeps them.",
    ]);
  });

  it("strips node links from an old ES or ESQ snapshot without touching the rest", () => {
    const es = { name: "Sequences", eventTrees: [eventTree("tree-1", true)], dependencyBayesianNetworks: [network()] };
    expect(withoutNetworkNodes(es)).toEqual({ name: "Sequences", eventTrees: [eventTree("tree-1", false)], dependencyBayesianNetworks: [network()] });
    const esq = esqMef({ modelDecisions: { typedTrees: [eventTree("typed-1", true)] } });
    expect(withoutNetworkNodes(esq)).toEqual(esqMef({ modelDecisions: { typedTrees: [eventTree("typed-1", false)] } }));
    const clean = esqMef({ modelDecisions: { typedTrees: [eventTree("typed-1", false)] } });
    expect(withoutNetworkNodes(clean)).toBe(clean);
  });

  it("changes nothing on a second run", () => {
    const first = migrated({
      sy: [{ workbookId: SY, projectId: "project-1", mef: syMef() }, { workbookId: "sy-plain", projectId: "project-1", mef: { name: "Plain", dependencyBayesianNetworks: [], dependencyHclConfigurations: [] } }],
      esq: [{ workbookId: ESQ, projectId: "project-1", mef: esqMef({ modelDecisions: { typedTrees: [eventTree("typed-1", true)] }, solve: { run: { hcl: { workbookId: SY, modelId: CONFIGURATION, treeIds: [TREE] } }, families: [] } }) }],
      es: [{ workbookId: "es-1", projectId: "project-1", mef: { name: "Sequences", eventTrees: [eventTree(TREE, true)] } }],
    });
    expect(first.notes).toEqual([]);
    expect(first.stores.sy[1]?.mef).toEqual({ name: "Plain", dependencyBayesianNetworks: [], dependencyHclConfigurations: [] });
    const second = migrated(first.stores);
    expect(second.notes).toEqual([]);
    for (const kind of ["sy", "esq", "es"] as const) {
      second.stores[kind].forEach((holder, index) => expect(holder.mef).toBe(first.stores[kind][index]?.mef));
    }
    expect(JSON.stringify(second.stores)).not.toContain("networkNode");
    expect(JSON.stringify(second.stores)).not.toContain("nodeLinks");
    expect(second.stores.esq[0]?.mef).toMatchObject({
      hclConfigurations: [{ bayesianNetwork: { workbookId: ESQ } }],
      modelDecisions: { functionLinks: [{ functionId: "RPS", rules: [expectedRule("RPS", TREE)] }] },
      solve: { run: { hcl: { workbookId: ESQ } } },
    });
  });
});
