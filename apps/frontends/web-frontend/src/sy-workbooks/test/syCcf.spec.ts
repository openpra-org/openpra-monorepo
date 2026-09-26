import type { CommonCauseFailureGroup, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import {
  ccfGroupsForModel,
  ccfParameterSummary,
  defaultCcfParameters,
  validateCcfGroup,
} from "../syCcf";

const MODEL: SystemLogicModel = {
  uuid: "model-1",
  code: "FT-1",
  name: "Cooling fault tree",
  systemReference: "system-1",
  description: "Cooling unavailable",
  modelRepresentation: "FAULT_TREE",
  topGate: { gateId: "top" },
  gates: [{ id: "top", kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" }],
  leafNodes: [
    { id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" },
    { id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-b" },
  ],
  gateInputs: [
    { id: "input-a", gateId: "top", childId: "leaf-a", order: 0 },
    { id: "input-b", gateId: "top", childId: "leaf-b", order: 1 },
  ],
  nodePositions: [],
  layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
  implementsSrs: [],
};

const GROUP: CommonCauseFailureGroup = {
  uuid: "ccf-1",
  name: "Cooling pumps",
  description: "Same design and manufacturer",
  scope: "INTRASYSTEM",
  affectedComponents: ["pump-a", "pump-b"],
  affectedSystems: ["system-1"],
  modelType: "BETA_FACTOR",
  modelSpecificParameters: { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.02 } },
  dataAnalysisCCFParameterRef: "DA-CCF-1",
  members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }] },
  groupSelectionBasis: "Same design and manufacturer",
  dataSources: [{ reference: "NUREG", description: "Generic prior", dataType: "generic" }],
  implementsSrs: [],
};

function analysis(group: CommonCauseFailureGroup = GROUP): SystemsAnalysis {
  return {
    systemDefinitions: [{ uuid: "system-1", name: "Cooling", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-built-as-operated", implementsSrs: [] }],
    systemLogicModels: [MODEL],
    systemBasicEvents: [
      { uuid: "event-a", code: "PMP-A-FS", name: "Pump A fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.02, implementsSrs: [] },
      { uuid: "event-b", code: "PMP-B-FS", name: "Pump B fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.02, implementsSrs: [] },
      { uuid: "legacy-ccf", code: "PMP-CCF", name: "Collapsed CCF", eventType: "BASIC", failureMode: "COMMON_CAUSE_FAILURE", probability: 0.002, implementsSrs: [] },
    ],
    commonCauseFailureGroups: [group],
  } as unknown as SystemsAnalysis;
}

describe("SY common cause validation", () => {
  it.each([
    ["BETA_FACTOR", { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.02 } }],
    ["MGL", { mglParameters: { beta: 0.1, totalFailureProbability: 0.02 } }],
    ["ALPHA_FACTOR", { alphaFactorParameters: { alphaFactors: { alpha1: 0.9, alpha2: 0.1 }, totalFailureProbability: 0.02 } }],
    ["PHI_FACTOR", { phiFactorParameters: { phiFactors: { phi1: 0.9, phi2: 0.1 }, totalFailureProbability: 0.02 } }],
  ] as const)("accepts a complete %s group", (modelType, modelSpecificParameters) => {
    const group = { ...GROUP, modelType, modelSpecificParameters } as CommonCauseFailureGroup;
    expect(validateCcfGroup(group, analysis(group))).toEqual([]);
  });

  it("accepts a complete group and finds the fault tree where every member is used", () => {
    const sy = analysis();
    expect(validateCcfGroup(GROUP, sy)).toEqual([]);
    expect(ccfGroupsForModel(sy, MODEL)).toEqual([GROUP]);
    expect(ccfParameterSummary(GROUP)).toMatchObject({ short: "β 0.1", totalFailureProbability: 0.02 });
  });

  it("rejects collapsed common cause events because PRAXIS generates them", () => {
    const group = { ...GROUP, members: { basicEvents: [{ id: "event-a" }, { id: "legacy-ccf" }] } };
    expect(validateCcfGroup(group, analysis(group))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CCF_COLLAPSED_MEMBER", severity: "ERROR" }),
    ]));
  });

  it("checks the factor count and normalization required by PRAXIS", () => {
    const group: CommonCauseFailureGroup = {
      ...GROUP,
      modelType: "ALPHA_FACTOR",
      modelSpecificParameters: { alphaFactorParameters: { alphaFactors: { alpha1: 0.7 }, totalFailureProbability: 0.02 } },
    };
    const issues = validateCcfGroup(group, analysis(group));
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CCF_ALPHA_COUNT" }),
      expect.objectContaining({ code: "CCF_ALPHA_SUM" }),
    ]));
    expect(defaultCcfParameters("PHI_FACTOR", 3, 0.01)).toEqual({
      phiFactorParameters: {
        phiFactors: { phi1: 0.95, phi2: 0.025, phi3: 0.025 },
        totalFailureProbability: 0.01,
      },
    });
  });
});
