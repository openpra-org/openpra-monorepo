import type { CommonCauseFailureGroup, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import {
  ccfFactorText,
  ccfGroupsForModel,
  defaultCcfParameters,
  estimateParameters,
  matchesEstimate,
  sharedCauseLines,
  validateCcfGroup,
  withMemberTotals,
} from "../syCcf";
import type { SyControlledCcfEstimateOption } from "../syWorkbookContext";

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
    expect(ccfFactorText(GROUP)).toBe("β 0.1");
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

  it("requires one member probability and a matching Qₜ", () => {
    const sy = analysis();
    const mixed = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-b" ? { ...event, probability: 0.03 } : event)) };
    expect(validateCcfGroup(GROUP, mixed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CCF_MEMBER_MISMATCH", severity: "ERROR", message: expect.stringContaining("2.0E-2, 3.0E-2") }),
    ]));

    const stale: CommonCauseFailureGroup = { ...GROUP, modelSpecificParameters: { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.05 } } };
    expect(validateCcfGroup(stale, analysis(stale))).toEqual([
      expect.objectContaining({ code: "CCF_TOTAL_MISMATCH", severity: "ERROR", message: "Qₜ 5.0E-2 does not match the member events (2.0E-2)." }),
    ]);
  });

  it("keeps Qₜ equal to the member probability when a member changes", () => {
    const sy = analysis();
    const raised = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid.startsWith("event-") ? { ...event, probability: 0.04 } : event)) };
    const synced = withMemberTotals(raised, new Set(["event-a"]));
    expect(synced.commonCauseFailureGroups[0]?.modelSpecificParameters).toEqual({ betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.04 } });
    expect(withMemberTotals(sy, new Set(["event-a"]))).toBe(sy);

    const split = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-a" ? { ...event, probability: 0.04 } : event)) };
    expect(withMemberTotals(split, new Set(["event-a"]))).toBe(split);
  });

  it("copies DA estimates into the group model and flags later drift", () => {
    const estimate: SyControlledCcfEstimateOption = {
      workbookId: "da-1",
      workbookName: "Data Analysis",
      estimateId: "DA-CCF-1",
      groupReference: "ccf-1",
      modelType: "ALPHA_FACTOR",
      parameters: { "alpha-2": 0.0126, "alpha-1": 0.97912, "alpha-3": 0.00828 },
      riskSignificant: true,
    };
    expect(estimateParameters(estimate, 0.02)).toEqual({
      alphaFactorParameters: { alphaFactors: { alpha1: 0.97912, alpha2: 0.0126, alpha3: 0.00828 }, totalFailureProbability: 0.02 },
    });

    const threeMembers: CommonCauseFailureGroup = {
      ...GROUP,
      modelType: "ALPHA_FACTOR",
      modelSpecificParameters: estimateParameters(estimate, 0.02),
      members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }, { id: "event-c" }] },
      dataSources: undefined,
    };
    const sy = analysis(threeMembers);
    const withThird = { ...sy, systemBasicEvents: [...sy.systemBasicEvents, { uuid: "event-c", code: "PMP-C-FS", name: "Pump C fails", eventType: "BASIC" as const, failureMode: "FAILURE_TO_START", probability: 0.02, implementsSrs: [] }] };
    expect(matchesEstimate(threeMembers, estimate)).toBe(true);
    expect(ccfFactorText(threeMembers)).toBe("α1 0.97912 · α2 0.0126 · α3 0.00828");
    expect(validateCcfGroup(threeMembers, withThird, [estimate])).toEqual([]);

    const drifted = { ...estimate, parameters: { ...estimate.parameters, "alpha-2": 0.0226, "alpha-1": 0.96912 } };
    expect(validateCcfGroup(threeMembers, withThird, [drifted])).toEqual([
      expect.objectContaining({ code: "CCF_DA_STALE", severity: "WARNING" }),
    ]);
    expect(validateCcfGroup(threeMembers, withThird, [{ ...estimate, estimateId: "DA-CCF-9" }])).toEqual([
      expect.objectContaining({ code: "CCF_DA_MISSING", severity: "WARNING" }),
    ]);
  });

  it("asks for a typed source only when no DA estimate is linked", () => {
    const typed: CommonCauseFailureGroup = { ...GROUP, dataAnalysisCCFParameterRef: undefined, dataSources: undefined };
    expect(validateCcfGroup(typed, analysis(typed)).map(({ code }) => code)).toEqual(["CCF_DA_REFERENCE", "CCF_SOURCE"]);
    const linked: CommonCauseFailureGroup = { ...GROUP, dataSources: undefined };
    expect(validateCcfGroup(linked, analysis(linked))).toEqual([]);
  });

  it("lists the shared causes in plain words", () => {
    expect(sharedCauseLines({ ...GROUP, sharedCauseFactors: { hardwareDesign: true, environment: true, otherFactors: ["Common software image"] } }))
      .toEqual(["Same design", "Same environment", "Common software image"]);
  });
});
