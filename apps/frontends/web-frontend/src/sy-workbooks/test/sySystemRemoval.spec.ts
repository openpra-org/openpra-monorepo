import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling/workbook-models";
import { removalMessage, withoutSystem } from "../sySystemRemoval";

const LAYOUT: SystemLogicModel["layout"] = { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" };

function tree(uuid: string, system: string, leaves: SystemLogicModel["leafNodes"]): SystemLogicModel {
  const gateId = `${uuid}-top`;
  return {
    uuid,
    code: uuid,
    name: `${system} fault tree`,
    systemReference: system,
    description: "",
    modelRepresentation: "Fault tree",
    topGate: { gateId },
    gates: [{ id: gateId, code: gateId, name: "Top", description: "", kind: "GATE", gateType: "OR" }],
    leafNodes: leaves,
    gateInputs: leaves.map((leaf, order) => ({ id: `${uuid}-in-${order}`, gateId, childId: leaf.id, order })),
    nodePositions: [],
    layout: LAYOUT,
    implementsSrs: [],
  };
}

function event(id: string): SystemsAnalysis["systemBasicEvents"][number] {
  return { uuid: id, code: id, name: id, eventType: "BASIC", probability: 0.01, implementsSrs: [] };
}

function group(uuid: string, affectedSystems: string[], members: string[]): SystemsAnalysis["commonCauseFailureGroups"][number] {
  return {
    uuid,
    name: uuid,
    description: "",
    scope: affectedSystems.length > 1 ? "INTERSYSTEM" : "INTRASYSTEM",
    affectedComponents: [],
    affectedSystems,
    modelType: "BETA_FACTOR",
    members: { basicEvents: members.map((id) => ({ id })) },
    implementsSrs: [],
  };
}

const HCL: WorkbookHclConfiguration = {
  modelId: "hcl-1",
  code: "HCL-1",
  name: "Shared room",
  description: "",
  bayesianNetwork: { workbookId: "sy-1", modelId: "bn-1" },
  faultTrees: [{ workbookId: "sy-1", modelId: "FT-A" }, { workbookId: "sy-1", modelId: "FT-B" }],
  bindings: [
    { id: "bind-a", faultTreeBasicEvent: { workbookId: "sy-1", entityId: "BE-A1", referenceType: "FAULT_TREE_BASIC_EVENT" }, bayesianNetworkNode: { workbookId: "sy-1", modelId: "bn-1", entityId: "node-1", referenceType: "BAYESIAN_NETWORK_NODE" }, trueStateIds: ["failed"] },
    { id: "bind-b", faultTreeBasicEvent: { workbookId: "sy-1", entityId: "BE-B1", referenceType: "FAULT_TREE_BASIC_EVENT" }, bayesianNetworkNode: { workbookId: "sy-1", modelId: "bn-1", entityId: "node-1", referenceType: "BAYESIAN_NETWORK_NODE" }, trueStateIds: ["failed"] },
  ],
  baseEvidence: { observations: [] },
  solverSettings: { variableOrder: null, foldConstants: false, spliceNullGates: false },
};

function makeAnalysis(): SystemsAnalysis {
  const analysis: Partial<SystemsAnalysis> = {
    systemDefinitions: ["SYS-A", "SYS-B", "SYS-C"].map((uuid) => ({
      uuid, name: uuid, boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended" as const, implementsSrs: [],
    })),
    systemToSafetyFunctionMappings: [{ uuid: "map-a", systemReference: "SYS-A", safetyFunctions: ["SF-1"], eventSequences: [], implementsSrs: [] }],
    systemLogicModels: [
      tree("FT-A", "SYS-A", [
        { id: "a1", kind: "BASIC_EVENT_REFERENCE", basicEventId: "BE-A1" },
        { id: "a2", kind: "BASIC_EVENT_REFERENCE", basicEventId: "BE-A2" },
        { id: "a3", kind: "BASIC_EVENT_REFERENCE", basicEventId: "BE-SHARED" },
      ]),
      tree("FT-B", "SYS-B", [
        { id: "b1", kind: "BASIC_EVENT_REFERENCE", basicEventId: "BE-B1" },
        { id: "b2", kind: "TRANSFER_REFERENCE", code: "TR-A", name: "A fails", description: "", target: { modelId: "FT-A", entityId: "FT-A-top" } },
        { id: "b3", kind: "BASIC_EVENT_REFERENCE", basicEventId: "BE-SHARED" },
      ]),
      tree("FT-C", "SYS-C", [{ id: "c1", kind: "BASIC_EVENT_REFERENCE", basicEventId: "BE-C1" }]),
    ],
    systemBasicEvents: ["BE-A1", "BE-A2", "BE-SHARED", "BE-B1", "BE-C1", "BE-DRAFT"].map(event),
    systemDependencies: [
      { uuid: "dep-ba", dependentSystem: "SYS-B", supportingSystem: "SYS-A", type: "FUNCTIONAL", implementsSrs: [] },
      { uuid: "dep-cb", dependentSystem: "SYS-C", supportingSystem: "SYS-B", type: "FUNCTIONAL", implementsSrs: [] },
    ],
    componentDependencies: [],
    dependencyHclConfigurations: [HCL],
    dependencySearchMethodology: { uuid: "dsm", name: "Search", description: "", reference: "", systemsAnalyzed: ["SYS-A", "SYS-B", "SYS-C"], implementsSrs: [] },
    commonCauseFailureGroups: [
      group("CCF-A", ["SYS-A", "SYS-B"], ["BE-A1", "BE-A2"]),
      group("CCF-B", ["SYS-B", "SYS-A"], ["BE-B1", "BE-SHARED"]),
      group("CCF-MIX", ["SYS-C"], ["BE-A1", "BE-C1"]),
      group("CCF-DRAFT", ["SYS-C"], []),
    ],
    supportSystemSuccessCriteria: [
      { uuid: "ssc-a", systemReference: "SYS-A", successCriteria: "One train", criteriaType: "REALISTIC", supportedSystems: ["SYS-B"], implementsSrs: [] },
      { uuid: "ssc-b", systemReference: "SYS-B", successCriteria: "One bus", criteriaType: "REALISTIC", supportedSystems: ["SYS-A", "SYS-C"], implementsSrs: [] },
      { uuid: "ssc-only-a", systemReference: "SYS-B", successCriteria: "One pump", criteriaType: "REALISTIC", supportedSystems: ["SYS-A"], implementsSrs: [] },
    ],
    humanFailureEventIntegrations: [
      { uuid: "hfe-a", hfeReference: "HFE-1", system: "SYS-A", taskDescription: "", hfeType: "POST_INITIATOR", isTestMaintenance: false, implementsSrs: [] },
      { uuid: "hfe-b", hfeReference: "HFE-2", system: "SYS-B", taskDescription: "", hfeType: "POST_INITIATOR", isTestMaintenance: false, implementsSrs: [] },
    ],
    isolationTripConditions: [{ uuid: "trip-a", systemReference: "SYS-A", condition: "Low level", modeledIn: "SYSTEM_MODEL", implementsSrs: [] }],
    nomenclatureDesignators: [
      { uuid: "des-a", designator: "A", kind: "SYSTEM", meaning: "System A", systemReference: "SYS-A" },
      { uuid: "des-fr", designator: "FR", kind: "FAILURE_MODE", meaning: "Fails to run" },
    ],
    uncertaintyAnalyses: [
      { uuid: "ua-a", system: "SYS-A", propagationMethod: "MONTE_CARLO", modelUncertainties: [{ uncertaintyId: "MU-A", description: "A", impact: "", isQuantified: false, treatmentApproach: "" }], parameterUncertainties: [], implementsSrs: [] },
      {
        uuid: "ua-b",
        system: "SYS-B",
        propagationMethod: "MONTE_CARLO",
        modelUncertainties: [],
        parameterUncertainties: [],
        ccfUncertainties: [
          { uncertaintyId: "CU-A", ccfGroupId: "CCF-A", description: "", impact: "" },
          { uncertaintyId: "CU-B", ccfGroupId: "CCF-B", description: "", impact: "" },
        ],
        dependencyUncertainties: [
          { uncertaintyId: "DU-A", supportingSystem: "SYS-A", description: "", impact: "" },
          { uncertaintyId: "DU-C", supportingSystem: "SYS-C", description: "", impact: "" },
        ],
        implementsSrs: [],
      },
    ],
    sensitivityStudies: [
      { uuid: "ss-mu", description: "", variedParameters: [], parameterRanges: {}, modelUncertaintyId: "MU-A" },
      { uuid: "ss-cu-a", description: "", variedParameters: [], parameterRanges: {}, modelUncertaintyId: "CU-A" },
      { uuid: "ss-du-a", description: "", variedParameters: [], parameterRanges: {}, modelUncertaintyId: "DU-A" },
      { uuid: "ss-cu-b", description: "", variedParameters: [], parameterRanges: {}, modelUncertaintyId: "CU-B" },
      { uuid: "ss-free", description: "", variedParameters: [], parameterRanges: {} },
    ],
    modelUncertainty: {
      uuid: "mu",
      name: "Model uncertainty",
      uncertaintySources: [
        { source: "Only A", impact: "", applicableElements: ["SYS-A"] },
        { source: "A and B", impact: "", applicableElements: ["SYS-A", "SYS-B"] },
        { source: "Plant", impact: "" },
      ],
      relatedAssumptions: [],
      reasonableAlternatives: [],
    },
    preOperationalAssumptions: [
      { uuid: "poa-a", assumptionId: "PA-1", description: "", status: "OPEN", limitations: [], influenceOnDefinition: "", riskImpact: ImportanceLevel.LOW, closureBasis: "", plannedClosureActions: [], affectedElementIds: ["SYS-A"] },
      { uuid: "poa-ab", assumptionId: "PA-2", description: "", status: "OPEN", limitations: [], influenceOnDefinition: "", riskImpact: ImportanceLevel.LOW, closureBasis: "", plannedClosureActions: [], affectedElementIds: ["SYS-A", "SYS-B"] },
    ],
  };
  return analysis as SystemsAnalysis;
}

describe("SY system removal", () => {
  it("removes the system, its fault tree and its own basic events but keeps shared ones", () => {
    const { analysis, faultTrees, basicEvents } = withoutSystem(makeAnalysis(), "SYS-A");
    expect(analysis.systemDefinitions.map(({ uuid }) => uuid)).toEqual(["SYS-B", "SYS-C"]);
    expect(analysis.systemToSafetyFunctionMappings).toEqual([]);
    expect(analysis.systemLogicModels.map(({ uuid }) => uuid)).toEqual(["FT-B", "FT-C"]);
    expect(analysis.systemBasicEvents.map(({ uuid }) => uuid)).toEqual(["BE-SHARED", "BE-B1", "BE-C1", "BE-DRAFT"]);
    expect(faultTrees).toBe(1);
    expect(basicEvents).toBe(2);
  });

  it("removes transfers into the removed fault tree from other trees", () => {
    const { analysis, transfers } = withoutSystem(makeAnalysis(), "SYS-A");
    const other = analysis.systemLogicModels.find(({ uuid }) => uuid === "FT-B");
    expect(transfers).toBe(1);
    expect(other?.leafNodes.map(({ id }) => id)).toEqual(["b1", "b3"]);
    expect(other?.gateInputs.map(({ childId, order }) => `${childId}:${order}`)).toEqual(["b1:0", "b3:1"]);
  });

  it("removes owned common cause groups and groups left with one member, and trims the rest", () => {
    const { analysis, commonCauseGroups } = withoutSystem(makeAnalysis(), "SYS-A");
    expect(analysis.commonCauseFailureGroups.map(({ uuid }) => uuid)).toEqual(["CCF-B", "CCF-DRAFT"]);
    expect(analysis.commonCauseFailureGroups[0]).toMatchObject({ affectedSystems: ["SYS-B"], members: { basicEvents: [{ id: "BE-B1" }, { id: "BE-SHARED" }] } });
    expect(commonCauseGroups).toBe(2);
  });

  it("removes the records that refer to the system and trims shared lists", () => {
    const { analysis } = withoutSystem(makeAnalysis(), "SYS-A");
    expect(analysis.systemDependencies.map(({ uuid }) => uuid)).toEqual(["dep-cb"]);
    expect(analysis.supportSystemSuccessCriteria?.map(({ uuid, supportedSystems }) => `${uuid}:${supportedSystems.join("+")}`)).toEqual(["ssc-b:SYS-C"]);
    expect(analysis.humanFailureEventIntegrations.map(({ uuid }) => uuid)).toEqual(["hfe-b"]);
    expect(analysis.isolationTripConditions).toEqual([]);
    expect(analysis.nomenclatureDesignators?.map(({ uuid }) => uuid)).toEqual(["des-fr"]);
    expect(analysis.dependencySearchMethodology.systemsAnalyzed).toEqual(["SYS-B", "SYS-C"]);
    expect(analysis.modelUncertainty.uncertaintySources.map(({ source, applicableElements }) => `${source}:${(applicableElements ?? []).join("+")}`)).toEqual(["A and B:SYS-B", "Plant:"]);
    expect(analysis.preOperationalAssumptions?.map(({ uuid, affectedElementIds }) => `${uuid}:${affectedElementIds.join("+")}`)).toEqual(["poa-ab:SYS-B"]);
  });

  it("removes uncertainty sources about the system and the studies that test them", () => {
    const { analysis } = withoutSystem(makeAnalysis(), "SYS-A");
    expect(analysis.uncertaintyAnalyses?.map(({ uuid }) => uuid)).toEqual(["ua-b"]);
    expect(analysis.uncertaintyAnalyses?.[0]?.ccfUncertainties?.map(({ uncertaintyId }) => uncertaintyId)).toEqual(["CU-B"]);
    expect(analysis.uncertaintyAnalyses?.[0]?.dependencyUncertainties?.map(({ uncertaintyId }) => uncertaintyId)).toEqual(["DU-C"]);
    expect(analysis.sensitivityStudies?.map(({ uuid }) => uuid)).toEqual(["ss-cu-b", "ss-free"]);
  });

  it("drops dependency-network references to the removed fault tree and its events", () => {
    const { analysis } = withoutSystem(makeAnalysis(), "SYS-A");
    const configuration = analysis.dependencyHclConfigurations?.[0];
    expect(configuration?.faultTrees.map(({ modelId }) => modelId)).toEqual(["FT-B"]);
    expect(configuration?.bindings.map(({ id }) => id)).toEqual(["bind-b"]);
  });

  it("counts every removed record and says what goes with the system", () => {
    const removal = withoutSystem(makeAnalysis(), "SYS-A");
    expect(removal.records).toBe(14);
    expect(removalMessage("System A", removal)).toBe("Removing System A also removes its fault tree, 2 basic events, 2 common cause groups and 14 other records about it. It removes 1 transfer to it from other fault trees too.");
  });

  it("has nothing to confirm for a system nothing else refers to", () => {
    const analysis = makeAnalysis();
    const bare = { ...analysis, systemDefinitions: [...analysis.systemDefinitions, { ...analysis.systemDefinitions[0]!, uuid: "SYS-NEW", name: "New system" }] };
    const removal = withoutSystem(bare, "SYS-NEW");
    expect(removalMessage("New system", removal)).toBeNull();
    expect(removal.analysis.systemDefinitions.map(({ uuid }) => uuid)).toEqual(["SYS-A", "SYS-B", "SYS-C"]);
    expect(removal.analysis.systemLogicModels).toEqual(bare.systemLogicModels);
  });
});
