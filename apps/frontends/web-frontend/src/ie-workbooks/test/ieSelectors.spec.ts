import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { ccScore, filterConformance, commentsView, stepsFromMef } from "../ieSelectors";

function baseIe(overrides: Partial<InitiatingEventsAnalysis> = {}): InitiatingEventsAnalysis {
  const now = "2026-04-22T12:00:00.000Z";
  return {
    uuid: "ie-1",
    name: "IE",
    type: "initiating-event-analysis" as InitiatingEventsAnalysis["type"],
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
    includesNonInternalHazardGroups: false,
    applicablePlantOperatingStates: [],
    initiators: [],
    initiatingEventGroups: [],
    completenessSearch: { functionalCategoriesCovered: [], perSystemSearchPerformed: false, perSupportSystemSearchPerformed: false, multiReactorEventsAddressed: false, radioactiveSourceMechanismsAddressed: false, implementsSrs: [] },
    quantifications: [],
    screeningRecords: [],
    documentation: {
      processDescription: "", inputSources: "", appliedMethods: "", resultsSummary: "",
      functionalCategoriesConsidered: "", plantUniqueInitiatorsSearch: "", stateSpecificInitiatorsSearch: "",
      rcbFailureSearch: "", completenessAssessment: "", groupingProcessAndBasis: "", screeningProcessAndBasis: "",
      frequencyDerivation: "", quantificationApproach: "", dataSourceJustification: "", modelUncertaintySources: "",
      asBuiltLimitations: "", praTaskInterfaces: "", implementsSrs: [],
    },
    ...overrides,
  };
}

describe("ieSelectors", () => {
  it("derives conformance items from the IE SR catalog filtered by stage", () => {
    const items = filterConformance(baseIe(), "cc-ii", "pre_operational");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((it) => it.requiredAt.includes("cc-ii"))).toBe(true);
  });

  it("marks an SR met when the conformance matrix says MET", () => {
    const ie = baseIe({
      conformanceMatrix: [
        { sr: "IE-A1", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: [], evidence: "" },
      ],
    });
    const items = filterConformance(ie, "cc-ii", "pre_operational");
    const a1 = items.find((it) => it.id === "IE-A1");
    expect(a1?.status).toBe("ok");
  });

  it("scores zero percent when nothing is met", () => {
    const score = ccScore(baseIe(), "cc-ii", "pre_operational");
    expect(score.met).toBe(0);
    expect(score.percent).toBe(0);
    expect(score.applicable).toBeGreaterThan(0);
  });

  it("maps review comments to views with author initials", () => {
    const ie = baseIe({
      metadata: { ...baseIe().metadata, reviewers: [{ id: "r1", name: "Dr. Jane Roe", role: "INTERNAL_REVIEWER" }] },
      internalReviewComments: {
        comments: [{ uuid: "c1", authorRole: "INTERNAL_REVIEWER", authorId: "r1", createdAt: "2026-04-22T11:00:00.000Z", text: "Check this", resolved: false, severity: "MAJOR" }],
        openCount: 1, resolvedCount: 0,
      },
    });
    const views = commentsView(ie, new Date("2026-04-22T12:00:00.000Z"));
    expect(views).toHaveLength(1);
    expect(views[0].authorName).toBe("Dr. Jane Roe");
    expect(views[0].authorInitials).toBe("JR");
    expect(views[0].severity).toBe("MAJOR");
  });

  it("marks the identify step complete once initiators exist", () => {
    const ie = baseIe({ initiators: [{ uuid: "IE-01" } as InitiatingEventsAnalysis["initiators"][number]] });
    const steps = stepsFromMef(ie, "preparer");
    expect(steps.find((s) => s.id === "identify")?.status).toBe("complete");
    expect(steps.find((s) => s.id === "scope")?.status).toBe("idle");
  });
});
