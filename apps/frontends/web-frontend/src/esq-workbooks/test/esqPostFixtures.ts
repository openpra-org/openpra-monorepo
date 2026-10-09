import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { HumanReliabilityAnalysis, RecoveryAction } from "interfaces-mef-types/hr/human-reliability-analysis";
import { esqPostRunId } from "interfaces-mef-types/esq/esq-post-inputs";
import { esqModelRunId, solveInputsKey } from "interfaces-mef-types/esq/esq-solve-inputs";
import type {
  EsqEventTreeRunLogic,
  EsqModelRunResult,
  EsqPostCombinationFinding,
  EsqPostDeletionFinding,
  EsqPostRunResult,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { EsqUpstream } from "../esqLinks";
import { withModelImported } from "../esqModel";
import { MODEL_AS_SET } from "../esqLogic";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-10-05T12:00:00.000Z";
const POST_RUN = "7a6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const MODEL_RUN = "4f6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const TREE_A = "5a6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const TREE_B = "6b6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";

const FEASIBLE = {
  procedureOrGuidanceAvailable: true,
  trainingIncluded: true,
  cuesAvailable: true,
  manpowerAvailable: true,
  timeAvailable: true,
  accessibilityConfirmed: true,
  equipmentAvailable: true,
};

function postUpstream(hrJoint = 1.6e-4): EsqUpstream {
  const upstream = modelUpstream();
  const hr = upstream.hr;
  const sy = upstream.sy;
  if (hr === undefined || sy === undefined) throw new Error("fixture has no HR or SY");
  hr.humanFailureEvents = [
    { uuid: "HFE-1", name: "Operator fails to align", hfeTiming: "POST_INITIATOR", applicablePlantOperatingStates: ["POS-01"] },
    { uuid: "HFE-2", name: "Operator fails to start the fan", hfeTiming: "POST_INITIATOR", applicablePlantOperatingStates: ["POS-01"] },
  ] as HumanReliabilityAnalysis["humanFailureEvents"];
  hr.hepQuantifications = [
    ...hr.hepQuantifications,
    { uuid: "Q-2", hfeId: "HFE-2", methodology: "THERP", assessmentType: "DETAILED_ASSESSMENT", isRiskSignificant: false, meanHep: 0.02 },
    { uuid: "Q-R1", hfeId: "HFE-2", methodology: "THERP", assessmentType: "DETAILED_ASSESSMENT", isRiskSignificant: false, meanHep: 0.1 },
  ] as HumanReliabilityAnalysis["hepQuantifications"];
  const recoveries: RecoveryAction[] = [
    { uuid: "REC-1", name: "Start the fan locally", hfeId: "HFE-2", appliedAtLevel: "SEQUENCE", restoredFunction: "Support cooling", appliedToSequenceIds: [], feasibility: FEASIBLE, hepQuantificationId: "Q-R1", dependencyAssessmentId: "DEP-2", implementsSrs: [] },
    { uuid: "REC-2", name: "Align from the remote panel", hfeId: "HFE-1", appliedAtLevel: "SEQUENCE", restoredFunction: "Support alignment", appliedToSequenceIds: [], feasibility: { ...FEASIBLE, manpowerAvailable: false }, hepQuantificationId: "Q-R2", implementsSrs: [] },
  ];
  hr.recoveryActions = recoveries;
  hr.dependencyAssessments = [
    { uuid: "DEP-1", scope: "WITHIN_SEQUENCE", hfeIds: ["HFE-1", "HFE-2"], dependenceLevel: "MODERATE", jointHep: hrJoint, includesRecoveryHfe: false },
    { uuid: "DEP-2", scope: "WITHIN_SEQUENCE", hfeIds: ["HFE-2"], dependenceLevel: "HIGH", jointHep: 0.011, includesRecoveryHfe: true },
  ] as HumanReliabilityAnalysis["dependencyAssessments"];
  hr.jointHepFloor = { uuid: "JHF-1", minimumJointProbability: 1e-5, justification: "Joint HEP floor of the HRA guidance." } as HumanReliabilityAnalysis["jointHepFloor"];
  sy.systemBasicEvents = sy.systemBasicEvents.map((event) => {
    if (event.uuid !== "E-3") return event;
    const { expression: _component, ...rest } = event;
    return { ...rest, code: "SUP-FAN-HFE", name: "Operator fails to start the fan", failureMode: "HUMAN_ERROR", probability: 5e-4, dataAnalysisBasicEventRef: "HFE-2" };
  });
  return upstream;
}

function postEsq(hrJoint?: number): EventSequenceQuantification {
  return withModelImported(linkedEsq(), postUpstream(hrJoint), NOW);
}

function postSummary(esq: EventSequenceQuantification, combinations: EsqPostCombinationFinding[], deletions: EsqPostDeletionFinding[] = []): EsqPostRunResult {
  const purpose = deletions.length > 0 || combinations.length === 0 ? "DELETIONS" : "COMBINATIONS";
  const logic: EsqEventTreeRunLogic = purpose === "COMBINATIONS" ? { ...MODEL_AS_SET, dependency: false } : { ...MODEL_AS_SET, exclusions: false, dependency: false };
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_POST_RUN",
    runId: POST_RUN,
    owner: { workbookId: "esq-1", modelId: esqPostRunId(), workbookRevision: 5 },
    completedAt: NOW,
    inputs: solveInputsKey(esq, { combinations: false }),
    purpose,
    cutOff: 1e-14,
    raisedHep: purpose === "COMBINATIONS" ? 0.8 : null,
    logic,
    trees: [
      { treeId: "ET-A", runId: TREE_A, status: "SUCCEEDED", initiatorFrequency: 2.5, failure: null },
      { treeId: "ET-B", runId: TREE_B, status: "SUCCEEDED", initiatorFrequency: 0.5, failure: null },
    ],
    combinations,
    deletions,
    eventCodes: {},
  };
}

function modelSummary(esq: EventSequenceQuantification, release: number, logic: EsqEventTreeRunLogic = MODEL_AS_SET): EsqModelRunResult {
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_MODEL_RUN",
    runId: MODEL_RUN,
    owner: { workbookId: "esq-1", modelId: esqModelRunId(), workbookRevision: 5 },
    completedAt: NOW,
    inputs: solveInputsKey(esq),
    calculation: "CUT_SETS",
    logic,
    cutSets: { basis: "FREQUENCY", cutOffs: [1e-12, 1e-13, 1e-14], quantifier: "MCUB", keep: 100, limitOrder: 4 },
    trees: [
      { treeId: "ET-A", runId: TREE_A, status: "SUCCEEDED", initiatorFrequency: 2.5, failure: null },
      { treeId: "ET-B", runId: TREE_B, status: "SUCCEEDED", initiatorFrequency: 0.5, failure: null },
    ],
    sequences: [
      { treeId: "ET-A", sequenceIds: ["A-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: release / 2.5, annualFrequency: release, cutSetCount: 3 },
      { treeId: "ET-A", sequenceIds: ["A-1"], familyId: "F-OK", endState: "SUCCESSFUL_MITIGATION", conditionalProbability: 1, annualFrequency: 2.5, cutSetCount: 1 },
    ],
    families: [
      {
        familyId: "F-REL",
        annualFrequency: release,
        sequenceCount: 1,
        cutSetCount: 3,
        sweep: [1e-12, 1e-13, 1e-14].map((cutOff) => ({ cutOff, count: 3, annualFrequency: release })),
        states: [],
        cutSets: [{ treeId: "ET-A", basicEventIds: ["E-1"], annualFrequency: release }],
      },
      {
        familyId: "F-OK",
        annualFrequency: 3,
        sequenceCount: 2,
        cutSetCount: 2,
        sweep: [1e-12, 1e-13, 1e-14].map((cutOff) => ({ cutOff, count: 2, annualFrequency: 3 })),
        states: [],
        cutSets: [{ treeId: "ET-A", basicEventIds: [], annualFrequency: 2.5 }],
      },
    ],
    endStates: [{ endState: "RADIONUCLIDE_RELEASE", annualFrequency: release }],
    eventCodes: {},
    peakProbability: release / 2.5,
  };
}

export { MODEL_RUN, NOW, POST_RUN, modelSummary, postEsq, postSummary, postUpstream };
