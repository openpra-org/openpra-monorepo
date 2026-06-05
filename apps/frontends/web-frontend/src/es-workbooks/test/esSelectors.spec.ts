import { type EventSequenceAnalysis, EndState, DependencyType } from "interfaces-mef-types/es/event-sequence-analysis";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { ccScore, filterConformance, commentsView, stepsFromMef, eventTreesView, dependenciesView } from "../esSelectors";

function baseEs(overrides: Partial<EventSequenceAnalysis> = {}): EventSequenceAnalysis {
  const now = "2026-04-22T12:00:00.000Z";
  return {
    uuid: "es-1",
    name: "ES",
    type: "event-sequence-analysis" as EventSequenceAnalysis["type"],
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
    scopeDefinition: { plantOperatingStateIds: [], initiatingEventIds: [], radioactiveMaterialSources: [], radionuclideBarriers: [] },
    keySafetyFunctions: [],
    eventSequences: [],
    eventSequenceFamilies: [],
    screeningRecords: [],
    plantResponseAnalysisAccuracy: {
      scope: "PRE_OPERATIONAL", accuracy: ImportanceLevel.LOW, basis: "", detailConsistentWithPlant: false,
      sufficientForRiskSignificantContributors: false, sufficiencyJustification: "", highConfidenceAreas: [],
      lowerConfidenceAreas: [], improvementPlans: [], implementsSrs: [],
    },
    modelUncertainty: { uuid: "mu", name: "mu", uncertaintySources: [], relatedAssumptions: [], reasonableAlternatives: [] },
    documentation: {
      processDescription: "", posInitiatorSequenceLinkage: "", successCriteriaBases: "", keySafetyFunctionsIdentification: "",
      sequenceDelineation: "", dependencyTreatment: "", endStateAndReleaseCategoryDefinitions: "", operatorActionsRepresentation: "",
      deterministicAnalysesUsed: "", plantResponseAnalysisBasis: "", intermediateEndStatesAndTransfers: "", screeningProcessAndBasis: "",
      modelUncertaintySources: "", asBuiltLimitations: "", praTaskInterfaces: "", implementsSrs: [],
    },
    ...overrides,
  };
}

describe("esSelectors", () => {
  it("derives conformance items from the ES SR catalog filtered by stage", () => {
    const items = filterConformance(baseEs(), "cc-ii", "pre_operational");
    expect(items.length).toBe(39);
    expect(items.every((it) => it.requiredAt.includes("cc-ii"))).toBe(true);
  });

  it("marks an SR met when the conformance matrix says MET", () => {
    const es = baseEs({
      conformanceMatrix: [
        { sr: "ES-A1", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: [], evidence: "" },
      ],
    });
    const items = filterConformance(es, "cc-ii", "pre_operational");
    expect(items.find((it) => it.id === "ES-A1")?.status).toBe("ok");
  });

  it("scores zero percent when nothing is met", () => {
    const score = ccScore(baseEs(), "cc-ii", "pre_operational");
    expect(score.met).toBe(0);
    expect(score.percent).toBe(0);
    expect(score.applicable).toBeGreaterThan(0);
  });

  it("maps review comments to views with author initials", () => {
    const es = baseEs({
      metadata: { ...baseEs().metadata, reviewers: [{ id: "r1", name: "Dr. Jane Roe", role: "INTERNAL_REVIEWER" }] },
      internalReviewComments: {
        comments: [{ uuid: "c1", authorRole: "INTERNAL_REVIEWER", authorId: "r1", createdAt: "2026-04-22T11:00:00.000Z", text: "Check this", resolved: false, severity: "MAJOR" }],
        openCount: 1, resolvedCount: 0,
      },
    });
    const views = commentsView(es, new Date("2026-04-22T12:00:00.000Z"));
    expect(views).toHaveLength(1);
    expect(views[0].authorName).toBe("Dr. Jane Roe");
    expect(views[0].authorInitials).toBe("JR");
  });

  it("marks the sequences step complete once event sequences exist", () => {
    const es = baseEs({
      eventSequences: [{ uuid: "S1", name: "S1", initiatingEventId: "IEG-1", plantOperatingStateId: "POS-01", endState: EndState.SUCCESSFUL_MITIGATION, implementsSrs: [] }],
    });
    const steps = stepsFromMef(es, "preparer");
    expect(steps.find((s) => s.id === "sequences")?.status).toBe("complete");
    expect(steps.find((s) => s.id === "families")?.status).toBe("idle");
  });

  it("builds a renderable event tree from the MEF branch graph", () => {
    const es = baseEs({
      eventSequences: [
        { uuid: "S1", name: "S1", initiatingEventId: "IEG-1", plantOperatingStateId: "POS-01", endState: EndState.SUCCESSFUL_MITIGATION, implementsSrs: [] },
        { uuid: "S2", name: "S2", initiatingEventId: "IEG-1", plantOperatingStateId: "POS-01", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", implementsSrs: [] },
      ],
      eventTrees: [{
        uuid: "ET-1", name: "Tree 1", initiatingEventId: "IEG-1",
        functionalEvents: { RT: { uuid: "RT", name: "Reactor trip", label: "RT", order: 0 } },
        branches: { b0: { uuid: "b0", name: "RT", functionalEventId: "RT", paths: [{ state: "SUCCESS", target: "S1", targetType: "SEQUENCE" }, { state: "FAILURE", target: "S2", targetType: "SEQUENCE" }] } },
        sequences: { S1: { uuid: "S1", name: "S1", endState: EndState.SUCCESSFUL_MITIGATION, eventSequenceId: "S1" }, S2: { uuid: "S2", name: "S2", endState: EndState.RADIONUCLIDE_RELEASE, eventSequenceId: "S2" } },
        initialState: { branchId: "b0" },
        implementsSrs: [],
      }],
    });
    const trees = eventTreesView(es);
    expect(trees).toHaveLength(1);
    expect(trees[0].functionalEvents).toHaveLength(1);
    expect(trees[0].sequences).toHaveLength(2);
    expect("fe" in trees[0].node).toBe(true);
  });

  it("flattens dependency models into a dependency view", () => {
    const es = baseEs({
      dependencyModels: {
        functionalDependencies: [{
          uuid: "DM-1", name: "deps", description: "", involvedSystems: [],
          dependencies: [{ uuid: "DEP-1", dependentElement: "A", dependedUponElement: "B", dependencyType: DependencyType.FUNCTIONAL, description: "", implementsSrs: [] }],
          implementsSrs: [],
        }],
      },
    });
    const deps = dependenciesView(es);
    expect(deps).toHaveLength(1);
    expect(deps[0].from).toBe("A");
    expect(deps[0].to).toBe("B");
  });
});
