import type { CcfFactorModel, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { CommonCauseFailureGroup, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { CommonCauseFailureGroupSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import {
  ccfFactorText,
  ccfGroupsForModel,
  ccfModelText,
  fittedFactors,
  matchesEstimate,
  sharedCauseLines,
  sharedMemberExpression,
  validateCcfGroup,
  withMemberTotals,
  type CcfAnalysis,
} from "../syCcf";
import type { SyControlledCcfEstimateOption } from "../syWorkbookContext";

function point(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function fraction(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value } } };
}

const LINKED: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-1" } };

const BETA: CcfFactorModel = { model: "BETA_FACTOR", beta: fraction(0.1) };

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
  factors: BETA,
  total: LINKED,
  dataAnalysisCCFParameterRef: "DA-CCF-1",
  members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }] },
  groupSelectionBasis: "Same design and manufacturer",
  dataSources: [{ reference: "NUREG", description: "Generic prior", dataType: "generic" }],
  implementsSrs: [],
};

type TestAnalysis = CcfAnalysis & Pick<SystemsAnalysis, "systemLogicModels">;

function analysis(group: CommonCauseFailureGroup = GROUP, memberValue: UncertainExpression = LINKED): TestAnalysis {
  return {
    systemDefinitions: [{ uuid: "system-1", name: "Cooling", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-built-as-operated", implementsSrs: [] }],
    systemLogicModels: [MODEL],
    systemBasicEvents: [
      { uuid: "event-a", code: "PMP-A-FS", name: "Pump A fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: memberValue, implementsSrs: [] },
      { uuid: "event-b", code: "PMP-B-FS", name: "Pump B fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: memberValue, implementsSrs: [] },
      { uuid: "legacy-ccf", code: "PMP-CCF", name: "Collapsed CCF", eventType: "BASIC", failureMode: "COMMON_CAUSE_FAILURE", probability: 0.002, implementsSrs: [] },
    ],
    commonCauseFailureGroups: [group],
  };
}

function withThird(sy: TestAnalysis): TestAnalysis {
  return { ...sy, systemBasicEvents: [...sy.systemBasicEvents, { uuid: "event-c", code: "PMP-C-FS", name: "Pump C fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: LINKED, implementsSrs: [] }] };
}

const THREE: CommonCauseFailureGroup["members"] = { basicEvents: [{ id: "event-a" }, { id: "event-b" }, { id: "event-c" }] };

describe("SY common cause validation", () => {
  it.each<[string, CcfFactorModel]>([
    ["beta factor", BETA],
    ["MGL", { model: "MGL", factors: [fraction(0.1)] }],
    ["alpha factor", { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.9, 0.1] } } }],
    ["Dirichlet alpha factor", { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [48.2, 0.73] } } }],
    ["phi factor", { model: "PHI_FACTOR", phis: { node: "VALUE", law: { family: "FIXED", values: [0.9, 0.1] } } }],
    ["law-valued beta factor", { model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "BETA", alpha: 1, beta: 19, lower: 0, upper: 1 } } } }],
  ])("accepts a complete %s group that the schema also accepts", (_, factors) => {
    const group = { ...GROUP, factors };
    expect(validateCcfGroup(group, analysis(group))).toEqual([]);
    expect(CommonCauseFailureGroupSchema.safeParse(group).success).toBe(true);
  });

  it("finds the fault tree where every member is used and names the factors", () => {
    const sy = analysis();
    expect(ccfGroupsForModel(sy, MODEL)).toEqual([GROUP]);
    expect(ccfFactorText(GROUP.factors)).toBe("β 0.1");
    expect(ccfModelText(GROUP.factors)).toBe("Beta factor");
    expect(ccfModelText({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.9, 0.1] } } })).toBe("Alpha factor, staggered testing");
    expect(ccfFactorText({ model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [48.2, 0.73] } } })).toBe("α Dirichlet (48.2, 0.73)");
    expect(ccfFactorText({ model: "MGL", factors: [fraction(0.0208860432), fraction(0.396477)] })).toBe("β 0.020886 · γ 0.39648");
    expect(ccfFactorText({ model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "LOGNORMAL", mean: 0.05, errorFactor: 3, level: 0.95 } } } })).toBe("β Lognormal (mean 0.05, EF 3)");
  });

  it("rejects collapsed common cause events because PRAXIS generates them", () => {
    const group = { ...GROUP, members: { basicEvents: [{ id: "event-a" }, { id: "legacy-ccf" }] } };
    expect(validateCcfGroup(group, analysis(group))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CCF_COLLAPSED_MEMBER", severity: "ERROR" }),
    ]));
  });

  it("checks the factor count, a fixed vector's sum and point factors in range", () => {
    const short: CommonCauseFailureGroup = { ...GROUP, factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [1] } } } };
    expect(validateCcfGroup(short, analysis(short)).map(({ code }) => code)).toEqual(["CCF_ALPHA_COUNT"]);
    const unsummed: CommonCauseFailureGroup = { ...GROUP, factors: { model: "PHI_FACTOR", phis: { node: "VALUE", law: { family: "FIXED", values: [0.7, 0.2] } } } };
    expect(validateCcfGroup(unsummed, analysis(unsummed))).toEqual([
      expect.objectContaining({ code: "CCF_PHI_SUM", severity: "ERROR", message: "Phi factors must sum to 1. The current sum is 0.900000." }),
    ]);
    const tooMany: CommonCauseFailureGroup = { ...GROUP, factors: { model: "MGL", factors: [fraction(0.1), fraction(1.2)] } };
    expect(validateCcfGroup(tooMany, analysis(tooMany))).toEqual([
      expect.objectContaining({ code: "CCF_MGL_COUNT", message: "MGL requires 1 to 1 factors for this group." }),
      expect.objectContaining({ code: "CCF_FACTOR_RANGE", message: "MGL factor γ must be between 0 and 1." }),
    ]);
    const outside: CommonCauseFailureGroup = { ...GROUP, factors: { model: "BETA_FACTOR", beta: fraction(-0.1) } };
    expect(validateCcfGroup(outside, analysis(outside))).toEqual([expect.objectContaining({ code: "CCF_FACTOR_RANGE", message: "Beta factor must be between 0 and 1." })]);
  });

  it("leaves a law-valued factor to the PRAXIS meaning checks", () => {
    const law: CommonCauseFailureGroup = { ...GROUP, factors: { model: "MGL", factors: [{ node: "VALUE", value: { unit: "FRACTION", law: { family: "UNIFORM", lower: 0, upper: 2 } } }] } };
    expect(validateCcfGroup(law, analysis(law))).toEqual([]);
  });

  it("refits typed factors to a new member count and keeps factors that still fit", () => {
    expect(fittedFactors(BETA, 3)).toBe(BETA);
    const pair: CcfFactorModel = { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.95, 0.05] } } };
    expect(fittedFactors(pair, 3)).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.95, 0.025, 0.025] } } });
    expect(fittedFactors(pair, 1)).toBe(pair);
    const mgl: CcfFactorModel = { model: "MGL", factors: [fraction(0.1), fraction(0.2)] };
    expect(fittedFactors(mgl, 3)).toBe(mgl);
    expect(fittedFactors(mgl, 2)).toEqual({ model: "MGL", factors: [fraction(0.05)] });
  });

  it("keeps a typed Qₜ when the members differ and flags a Qₜ that left the shared member value", () => {
    const sy = analysis();
    const mixed = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-b" ? { ...event, expression: point(0.03) } : event)) };
    expect(sharedMemberExpression(GROUP, mixed)).toBeNull();
    expect(validateCcfGroup(GROUP, mixed)).toEqual([
      expect.objectContaining({ code: "CCF_MEMBER_MISMATCH", severity: "WARNING" }),
    ]);

    const stale: CommonCauseFailureGroup = { ...GROUP, total: point(0.05) };
    expect(validateCcfGroup(stale, analysis(stale))).toEqual([
      expect.objectContaining({ code: "CCF_TOTAL_MISMATCH", severity: "ERROR", message: "Qₜ differs from the value the member events share." }),
    ]);
    const synced = withMemberTotals(analysis(stale), new Set(["event-a"]));
    expect(synced.commonCauseFailureGroups[0]?.total).toEqual(LINKED);
    expect(validateCcfGroup(synced.commonCauseFailureGroups[0] ?? stale, synced)).toEqual([]);
  });

  it("asks for Qₜ when the members share no value and Qₜ is still zero", () => {
    const sy = analysis({ ...GROUP, total: point(0) });
    const mixed = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-b" ? { ...event, expression: point(0.03) } : event)) };
    expect(validateCcfGroup({ ...GROUP, total: point(0) }, mixed).map(({ code }) => code)).toEqual(["CCF_MEMBER_MISMATCH", "CCF_TOTAL"]);
    expect(validateCcfGroup({ ...GROUP, total: point(1.5) }, mixed).map(({ code }) => code)).toEqual(["CCF_MEMBER_MISMATCH", "CCF_FACTOR_RANGE"]);
  });

  it("asks for a value on a component member", () => {
    const sy = analysis();
    const unset = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-b" ? { ...event, expression: undefined } : event)) };
    expect(validateCcfGroup(GROUP, unset)).toEqual([
      expect.objectContaining({ code: "CCF_MEMBER_PROBABILITY", severity: "ERROR", message: "Pump B fails needs a value. Set it in Step 02." }),
    ]);
  });

  it("takes Qₜ as the members' shared expression, not as a point", () => {
    const typed = { ...GROUP, total: point(0.04) };
    const sy = analysis(typed, point(0.04));
    expect(withMemberTotals(sy, new Set(["event-a"]))).toBe(sy);
    const raised = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid.startsWith("event-") ? { ...event, expression: LINKED } : event)) };
    expect(withMemberTotals(raised, new Set(["event-a"])).commonCauseFailureGroups[0]?.total).toEqual(LINKED);
    expect(withMemberTotals(raised, new Set(["unrelated"]))).toBe(raised);
    const split = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((event) => (event.uuid === "event-a" ? { ...event, expression: LINKED } : event)) };
    expect(withMemberTotals(split, new Set(["event-a"]))).toBe(split);
  });

  it("compares the group with its DA estimate canonically and flags later drift", () => {
    const alphas: CcfFactorModel = { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [97.912, 1.26, 0.828] } } };
    const estimate: SyControlledCcfEstimateOption = {
      workbookId: "da-1",
      workbookName: "Data Analysis",
      estimateId: "DA-CCF-1",
      groupReference: "ccf-1",
      factors: alphas,
      riskSignificant: true,
    };
    const reordered: CcfFactorModel = { alphas: { law: { concentrations: [97.912, 1.26, 0.828], family: "DIRICHLET" }, node: "VALUE" }, testing: "NON_STAGGERED", model: "ALPHA_FACTOR" };
    const threeMembers: CommonCauseFailureGroup = { ...GROUP, factors: reordered, members: THREE, dataSources: undefined };
    const sy = withThird(analysis(threeMembers));
    expect(matchesEstimate(threeMembers, estimate)).toBe(true);
    expect(validateCcfGroup(threeMembers, sy, [estimate])).toEqual([]);

    const staggered = { ...estimate, factors: { ...alphas, testing: "STAGGERED" as const } };
    expect(validateCcfGroup(threeMembers, sy, [staggered])).toEqual([
      expect.objectContaining({ code: "CCF_DA_STALE", severity: "WARNING", message: "The factors differ from DA estimate DA-CCF-1." }),
    ]);
    expect(validateCcfGroup(threeMembers, sy, [{ ...estimate, estimateId: "DA-CCF-9" }])).toEqual([
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
