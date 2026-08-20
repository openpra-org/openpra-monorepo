import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { ccScore, filterConformance, commentsView, stepsFromMef } from "../scSelectors";

function baseSc(overrides: Partial<SuccessCriteriaDevelopment> = {}): SuccessCriteriaDevelopment {
  const now = "2026-04-22T12:00:00.000Z";
  return {
    uuid: "sc-1",
    name: "SC",
    type: "success-criteria-development" as SuccessCriteriaDevelopment["type"],
    version: "1",
    created: now,
    modified: now,
    owner: "alice",
    workflowState: "DRAFT",
    workflowHistory: [],
    capabilityCategory: "CC-II",
    plantStage: "PRE_OPERATIONAL",
    metadata: {
      versionInfo: { version: "1", lastUpdated: now, schemaVersion: "0.0.1" },
      analysisDate: now, analysts: ["alice"], reviewers: [], scope: "", limitations: [],
      lastModifiedDate: now, lastModifiedBy: "alice",
    },
    conformanceMatrix: [],
    internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
    activePeerReviewIds: [],
    activeAuditIds: [],
    praScope: "",
    safeStableStateDefinition: { definition: "", basis: "", implementsSrs: [] },
    endStateDefinitions: [],
    safetyFunctionSuccessCriteria: [],
    overallSuccessCriteria: [],
    radionuclideBarrierCriteria: [],
    missionTimes: [],
    engineeringAnalyses: [],
    analysisDetailConsistency: {
      consistentWithInitiatingEventGrouping: false,
      consistentWithPlantOperatingStateDefinition: false,
      consistentWithEventSequenceModeling: false,
      basis: "",
      implementsSrs: [],
    },
    modelUncertainty: { uuid: "mu", name: "mu", uncertaintySources: [], relatedAssumptions: [], reasonableAlternatives: [] },
    documentation: {
      processDescription: "", endStateDefinitionsBasis: "", successCriteriaPerFunctionEventState: "", missionTimesBasis: "",
      calculationsAndCodesUsed: "", codeValidationAndLimitations: "", expertJudgmentUse: "", sharedSystemsTreatment: "",
      passiveSafetyTreatment: "", consistencyWithPlantDesign: "", modelUncertaintySources: "", asBuiltLimitations: "",
      praTaskInterfaces: "", implementsSrs: [],
    },
    ...overrides,
  };
}

describe("scSelectors", () => {
  it("derives conformance items from the SC SR catalog filtered by capability category", () => {
    const items = filterConformance(baseSc(), "cc-ii", "pre_operational");
    expect(items.length).toBe(24);
    expect(items.every((it) => it.requiredAt.includes("cc-ii"))).toBe(true);
  });

  it("marks an SR met when the conformance matrix says MET", () => {
    const sc = baseSc({
      conformanceMatrix: [
        { sr: "SC-A1", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: [], evidence: "" },
      ],
    });
    const items = filterConformance(sc, "cc-ii", "pre_operational");
    expect(items.find((it) => it.id === "SC-A1")?.status).toBe("ok");
  });

  it("scores zero percent when nothing is met", () => {
    const score = ccScore(baseSc(), "cc-ii", "pre_operational");
    expect(score.met).toBe(0);
    expect(score.percent).toBe(0);
    expect(score.applicable).toBeGreaterThan(0);
  });

  it("maps review comments to views with author initials", () => {
    const sc = baseSc({
      metadata: { ...baseSc().metadata, reviewers: [{ id: "r1", name: "Dr. Jane Roe", role: "INTERNAL_REVIEWER" }] },
      internalReviewComments: {
        comments: [{ uuid: "c1", authorRole: "INTERNAL_REVIEWER", authorId: "r1", createdAt: "2026-04-22T11:00:00.000Z", text: "Check this", resolved: false, severity: "MAJOR" }],
        openCount: 1, resolvedCount: 0,
      },
    });
    const views = commentsView(sc, new Date("2026-04-22T12:00:00.000Z"));
    expect(views).toHaveLength(1);
    expect(views[0].authorName).toBe("Dr. Jane Roe");
    expect(views[0].authorInitials).toBe("JR");
  });

  it("marks the criteria step complete once success criteria exist", () => {
    const sc = baseSc({
      safetyFunctionSuccessCriteria: [{ uuid: "SFC-1", safetyFunctionId: "SF-RC", initiatingEventId: "IEG-1", plantOperatingStateId: "POS-01", criteria: ["Trip"], engineeringAnalysisReferences: [], implementsSrs: [] }],
    });
    const steps = stepsFromMef(sc, "preparer");
    expect(steps.find((s) => s.id === "criteria")?.status).toBe("complete");
    expect(steps.find((s) => s.id === "mission")?.status).toBe("idle");
  });
});
