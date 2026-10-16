import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { esqImportanceRunId, esqUncertaintyRunId, uncertaintyInputsKey } from "interfaces-mef-types/esq/esq-measure-inputs";
import { caseInputsKey, esqSensitivityRunId } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import { solveInputsKey } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqImportanceRunResult, EsqModelRunResult, EsqUncertaintyRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { EsqUpstream } from "../esqLinks";
import { MODEL_AS_SET } from "../esqLogic";
import { withRunOfRecord } from "../esqSolve";
import { PUMP_ESTIMATE, linkedEsq, liveImport, modelUpstream } from "./esqModelFixtures";
import { NOW, modelSummary } from "./esqPostFixtures";

const IMPORTANCE_RUN = "1c6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const UNCERTAINTY_RUN = "2c6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const CASE_RUN = "3c6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const RELEASE = 1e-5;

function measureUpstream(): EsqUpstream {
  const upstream = modelUpstream();
  const { pos, da } = upstream;
  if (pos === undefined || da === undefined) throw new Error("fixture has no POS or DA");
  pos.modelUncertainty = {
    uuid: "POS-MU",
    name: "POS model uncertainty",
    uncertaintySources: [{ source: "Shutdown hours come from a reference plant", impact: "Moves the shutdown share of each family" }],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  };
  pos.preOperationalAssumptions = [{
    uuid: "POS-PA-U",
    assumptionId: "POS-PA-1",
    description: "Outage durations follow the vendor plan",
    status: "OPEN",
    limitations: ["No outage history"],
    influenceOnDefinition: "Sets the shutdown hours.",
    riskImpact: ImportanceLevel.MEDIUM,
    closureBasis: "",
    plannedClosureActions: ["Confirm against the first outage"],
    affectedElementIds: [],
  }];
  da.uncertaintyRegister = [{ id: "MU-1", source: "Pump data from generic sources", impact: "The pump may fail to start more often", parameterIds: ["P-1"], alternatives: [], key: true }];
  return upstream;
}

function measureEsq(): EventSequenceQuantification {
  const esq = liveImport(linkedEsq(), measureUpstream(), NOW);
  return withRunOfRecord(esq, modelSummary(esq, RELEASE));
}

function importanceResult(esq: EventSequenceQuantification): EsqImportanceRunResult {
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_IMPORTANCE_RUN",
    runId: IMPORTANCE_RUN,
    owner: { workbookId: "esq-1", modelId: esqImportanceRunId(), workbookRevision: 5 },
    completedAt: NOW,
    inputs: solveInputsKey(esq),
    logic: { ...MODEL_AS_SET },
    trees: [{ treeId: "ET-A", runId: IMPORTANCE_RUN, status: "SUCCEEDED", initiatorFrequency: 2.5, failure: null }],
    families: [
      { familyId: "F-REL", base: RELEASE, endState: "RADIONUCLIDE_RELEASE" },
      { familyId: "F-OK", base: 3, endState: "SUCCESSFUL_MITIGATION" },
    ],
    targets: [
      { id: "EVENT:E-1", kind: "EVENT", role: "BASIC", label: "COOL-PMP-FS", ref: "E-1", probability: 2e-3, changes: [{ familyId: "F-REL", decrease: 6e-6, increase: 2.994e-3 }, { familyId: "F-OK", decrease: -6e-6, increase: -2.994e-3 }] },
      { id: "EVENT:E-3", kind: "EVENT", role: "BASIC", label: "SUP-FAN-FR", ref: "E-3", probability: 5e-4, changes: [{ familyId: "F-REL", decrease: 4e-8, increase: 1.5e-5 }] },
      { id: "EVENT:E-4", kind: "EVENT", role: "BASIC", label: "RPS-DIV-FS", ref: "E-4", probability: 1e-4, changes: [{ familyId: "F-REL", decrease: 1e-9, increase: 5e-6 }] },
      { id: "PARAMETER:P-1", kind: "PARAMETER", role: null, label: "Pump fails to start (P-1)", ref: "P-1", probability: null, changes: [{ familyId: "F-REL", decrease: 6e-6, increase: 2.994e-3 }] },
      { id: "SYSTEM:SYS-COOL", kind: "SYSTEM", role: null, label: "COOL (SYS-COOL)", ref: "SYS-COOL", probability: null, changes: [{ familyId: "F-REL", decrease: 6e-6, increase: 2.994e-3 }] },
    ],
    silentEventIds: ["E-2"],
  };
}

function uncertaintyResult(esq: EventSequenceQuantification): EsqUncertaintyRunResult {
  const stats = { point: RELEASE, mean: 1.3e-5, standardDeviation: 2e-5, standardError: 2e-5 / Math.sqrt(1000), p05: 2e-6, p50: 7e-6, p95: 4.5e-5 };
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_UNCERTAINTY_RUN",
    runId: UNCERTAINTY_RUN,
    owner: { workbookId: "esq-1", modelId: esqUncertaintyRunId(), workbookRevision: 5 },
    completedAt: NOW,
    inputs: uncertaintyInputsKey(esq),
    logic: { ...MODEL_AS_SET },
    trials: 1000,
    seed: 1,
    method: "LATIN_HYPERCUBE",
    correlation: "SHARED",
    trees: [{ treeId: "ET-A", runId: UNCERTAINTY_RUN, status: "SUCCEEDED", initiatorFrequency: 2.5, failure: null }],
    families: [{ familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", ...stats, values: [1e-5, 1.6e-5] }],
    total: stats,
    keys: [{ key: "PARAMETER:P-1", label: "Pump fails to start (P-1)", source: "DA", expression: PUMP_ESTIMATE, unit: "PROBABILITY", events: 1 }],
    unsampled: [{ id: "EVENT:E-4", label: "RPS-DIV-FS · Division fails to trip", reason: "SY types this value without uncertainty. Give it a law in SY." }],
  };
}

function caseSummary(esq: EventSequenceQuantification, caseId: string, release: number): EsqModelRunResult {
  return {
    ...modelSummary(esq, release),
    runId: CASE_RUN,
    owner: { workbookId: "esq-1", modelId: esqSensitivityRunId(caseId), workbookRevision: 5 },
    inputs: caseInputsKey(esq, caseId),
    caseId,
  };
}

export { CASE_RUN, IMPORTANCE_RUN, RELEASE, UNCERTAINTY_RUN, caseSummary, importanceResult, measureEsq, measureUpstream, uncertaintyResult };
