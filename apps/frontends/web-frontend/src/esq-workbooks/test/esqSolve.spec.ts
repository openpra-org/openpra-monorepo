import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqModelRunId, solveInputsKey } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqModelRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { withModelImported } from "../esqModel";
import { AS_SET } from "../esqLogic";
import { stepsFromMef } from "../esqSelectors";
import {
  convergenceOf,
  cutOffsFrom,
  solveComplete,
  solveViewOf,
  summaryProblem,
  withFamilySolve,
  withRareEventReason,
  withRunOfRecord,
} from "../esqSolve";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-10-05T12:00:00.000Z";
const RUN = "4f6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const TREE_A = "5a6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const TREE_B = "6b6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";

const WORKED_CUT_OFFS = [1e-6, 1e-7, 1e-8, 1e-9, 1e-10, 1e-11, 1e-12, 1e-13, 1e-14];
const WORKED_MCUB = [
  7.223255661048299e-5, 7.544359014206936e-5, 7.607544131708545e-5, 7.609120654116963e-5, 7.610673570581969e-5,
  7.610847499844621e-5, 7.610862662195862e-5, 7.610864253390602e-5, 7.610864499698232e-5,
];
const WORKED_KEPT = [6, 14, 33, 37, 79, 128, 196, 258, 309];

function importedEsq(): EventSequenceQuantification {
  return withModelImported(linkedEsq(), modelUpstream(), NOW);
}

function sweepOf(values: readonly number[], counts: readonly number[] = values.map((_, index) => index + 1)): { cutOff: number; count: number; annualFrequency: number }[] {
  return values.map((annualFrequency, index) => ({ cutOff: WORKED_CUT_OFFS[index] ?? 1e-20, count: counts[index] ?? 0, annualFrequency }));
}

function summaryOf(esq: EventSequenceQuantification, release: readonly number[] = WORKED_MCUB, quantifier: "MCUB" | "RARE_EVENT" | "EXACT" = "MCUB", peak = 2e-5): EsqModelRunResult {
  const lowest = release.length;
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_MODEL_RUN",
    runId: RUN,
    owner: { workbookId: "esq-1", modelId: esqModelRunId(), workbookRevision: 4 },
    completedAt: NOW,
    inputs: solveInputsKey(esq),
    calculation: "CUT_SETS",
    logic: AS_SET,
    cutSets: { basis: "FREQUENCY", cutOffs: WORKED_CUT_OFFS.slice(0, lowest), quantifier, keep: 10 },
    trees: [
      { treeId: "ET-A", runId: TREE_A, status: "SUCCEEDED", initiatorFrequency: 2.5, failure: null },
      { treeId: "ET-B", runId: TREE_B, status: "SUCCEEDED", initiatorFrequency: 0.5, failure: null },
    ],
    sequences: [
      { treeId: "ET-A", sequenceIds: ["A-1"], familyId: "F-OK", endState: "SUCCESSFUL_MITIGATION", conditionalProbability: 1, annualFrequency: 2.5, cutSetCount: 1 },
      { treeId: "ET-A", sequenceIds: ["A-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 2.8e-5, annualFrequency: 7e-5, cutSetCount: 30 },
      { treeId: "ET-A", sequenceIds: ["A-3", "T-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 1e-6, annualFrequency: 2.5e-6, cutSetCount: 4 },
      { treeId: "ET-B", sequenceIds: ["B-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 7e-6, annualFrequency: 3.5e-6, cutSetCount: 3 },
      { treeId: "ET-B", sequenceIds: ["B-1"], familyId: "F-OK", endState: "SUCCESSFUL_MITIGATION", conditionalProbability: 1, annualFrequency: 0.5, cutSetCount: 1 },
    ],
    families: [
      {
        familyId: "F-REL",
        annualFrequency: release[lowest - 1] ?? 0,
        sequenceCount: 3,
        cutSetCount: WORKED_KEPT[lowest - 1] ?? 0,
        sweep: sweepOf(release, WORKED_KEPT),
        states: [
          { stateId: "POS-01", annualFrequency: (release[lowest - 1] ?? 0) * 0.9, sweep: sweepOf(release.map((value) => value * 0.9)) },
          { stateId: "POS-02", annualFrequency: (release[lowest - 1] ?? 0) * 0.1, sweep: sweepOf(release.map((value, index) => value * (index < 2 ? 0.05 : 0.1))) },
        ],
        cutSets: [{ treeId: "ET-A", basicEventIds: ["E-1", "E-2"], annualFrequency: 3.3e-5 }],
      },
      {
        familyId: "F-OK",
        annualFrequency: 3,
        sequenceCount: 2,
        cutSetCount: 2,
        sweep: sweepOf(release.map(() => 3), release.map(() => 2)),
        states: [],
        cutSets: [{ treeId: "ET-A", basicEventIds: [], annualFrequency: 2.5 }],
      },
    ],
    endStates: [{ endState: "RADIONUCLIDE_RELEASE", annualFrequency: 7.6e-5 }],
    eventCodes: { "E-1": "SCS-PM-A", "E-2": "RCCS-STACK" },
    peakProbability: peak,
  };
}

function checks(esq: EventSequenceQuantification): string[] {
  return (solveViewOf(esq)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

describe("ESQ Step 05 solve and converge", () => {
  it("finds convergence where a one-decade step is under the rule and smaller than the step before", () => {
    const worked = convergenceOf(sweepOf(WORKED_MCUB), 5);
    expect(worked.convergedAt).toBe(1e-8);
    expect(worked.changes[0]).toBeUndefined();
    expect(worked.changes[1]).toBeCloseTo(4.445410327786123, 9);
    expect(worked.changes[2]).toBeCloseTo(0.8375147230218493, 9);
    expect(convergenceOf(sweepOf([3, 3, 3]), 5).convergedAt).toBe(1e-8);
    expect(convergenceOf(sweepOf([0, 0, 0]), 5).convergedAt).toBe(1e-8);
    expect(convergenceOf(sweepOf([0, 1e-6, 1.01e-6]), 5).convergedAt).toBe(1e-8);
    expect(convergenceOf(sweepOf([1, 1.1, 1.18, 1.25]), 5).convergedAt).toBeUndefined();
    expect(convergenceOf(sweepOf([1, 1.1, 1.18, 1.25]), 10).convergedAt).toBe(1e-8);
    expect(cutOffsFrom(-6, -9)).toEqual([1e-6, 1e-7, 1e-8, 1e-9]);
  });

  it("asks for a value of record for every family with members before the step completes", () => {
    const esq = importedEsq();
    expect(checks(esq)).toEqual(["error:No value of record:F-OK", "error:No value of record:F-REL"]);
    expect(solveComplete(esq)).toBe(false);
    expect(stepsFromMef(esq, "preparer").map((step) => `${step.num}:${step.id}`)).toEqual([
      "01:scope", "02:model", "03:logic", "04:barriers", "05:solve", "06:post", "07:results", "08:uncert", "09:sens", "10:handoff", "11:draft", "12:review", "13:approval",
    ]);
  });

  it("keeps a run as the values of record and writes the family package for RI", () => {
    const base = importedEsq();
    const prior = {
      uuid: "EFQ-OLD",
      name: "Old typed release value",
      eventSequenceFamilyRef: "F-REL",
      crossPosGroupingJustification: "Same response in both states.",
      dependenciesConsideredInGrouping: true,
      quantificationBasis: "MEAN_PROPAGATED_SOKC" as const,
      meanFrequency: 3.2e-7,
      percentile95: 7.8e-7,
      implementsSrs: [],
    };
    const other = { ...prior, uuid: "EFQ-OTHER", eventSequenceFamilyRef: "F-ELSEWHERE", meanFrequency: 1e-8 };
    const esq = withRunOfRecord({ ...base, familyQuantifications: [prior, other] }, summaryOf(base));
    expect(esq.solve?.run).toEqual({
      runId: RUN,
      revision: 4,
      at: NOW,
      inputs: solveInputsKey(base),
      calculation: "CUT_SETS",
      logic: AS_SET,
      basis: "FREQUENCY",
      quantifier: "MCUB",
      cutOffs: WORKED_CUT_OFFS,
      peakProbability: 2e-5,
      peakInitiatorFrequency: 2.5,
    });
    const view = solveViewOf(esq);
    const release = view?.families.find((family) => family.id === "F-REL");
    expect(release).toMatchObject({ value: WORKED_MCUB[8], source: "RUN" });
    expect(release?.convergence?.convergedAt).toBe(1e-8);
    expect(release?.states.map((state) => `${state.stateId}:${String(state.convergence.convergedAt)}`)).toEqual(["POS-01:1e-8", "POS-02:1e-9"]);
    expect(esq.familyQuantifications.map((record) => `${record.uuid}:${record.eventSequenceFamilyRef}:${String(record.meanFrequency)}:${record.quantificationBasis}`)).toEqual([
      "EFQ-OTHER:F-ELSEWHERE:1e-8:MEAN_PROPAGATED_SOKC",
      `EFQ-F-REL:F-REL:${String(WORKED_MCUB[8])}:POINT_ESTIMATE`,
      "EFQ-F-OK:F-OK:3:POINT_ESTIMATE",
    ]);
    expect(esq.familyQuantifications[1]).toMatchObject({ name: "Release", crossPosGroupingJustification: "Same response in both states." });
    expect(esq.familyQuantifications[1]?.percentile95).toBeUndefined();
    expect(esq.sequenceFrequencyEstimates?.map((estimate) => `${estimate.eventSequenceRef}:${String(estimate.meanFrequency)}`)).toEqual([
      "A-1:2.5", "A-2:0.00007", "T-2:0.0000025", "B-2:0.0000035", "B-1:0.5",
    ]);
    expect(checks(esq)).toEqual(["note:No independent comparison:Verification"]);
    expect(solveComplete(esq)).toBe(true);
  });

  it("flags stale results, the rare event above 0.1, a family not converged and a shallow cutoff", () => {
    const base = importedEsq();
    const rare = withRunOfRecord(base, summaryOf(base, WORKED_MCUB.slice(0, 4), "RARE_EVENT", 0.2));
    expect(checks(rare)).toEqual([
      "error:Rare event above 0.1 without a reason:Run of record",
      "warning:Cutoff too close to a family:Run of record",
      "note:No independent comparison:Verification",
    ]);
    const reasoned = withRareEventReason(rare, "Every cut set sits below 1E-3 except the initiator alone.");
    expect(checks(reasoned)).not.toContain("error:Rare event above 0.1 without a reason:Run of record");
    expect(reasoned.solve?.rareEventReason).toBe("Every cut set sits below 1E-3 except the initiator alone.");

    const growing = [1e-5, 2e-5, 3e-5, 4e-5];
    const unconverged = withRunOfRecord(base, summaryOf(base, growing));
    expect(checks(unconverged)).toEqual(expect.arrayContaining([
      "error:Not converged at its cutoff:F-REL",
      "warning:Operating state not converged:F-REL · POS-01",
    ]));

    const stale = { ...unconverged, logic: { flags: [{ id: "FL-1", name: "Power", target: { kind: "EVENT" as const, id: "E-1" }, state: false, groupIds: [], stateIds: [], basis: "" }] } };
    expect(checks(stale)[0]).toBe("error:Result older than its inputs:Run of record");
    expect(summaryProblem(summaryOf(base), stale)).toBe("The model, logic or values changed after this run. Run again before using it.");
    const failed = summaryOf(base);
    failed.trees = [{ ...failed.trees[0]!, status: "FAILED", failure: "Not linked." }, failed.trees[1]!];
    expect(summaryProblem(failed, base)).toBe("1 of 2 event trees failed in this run. Fix them and run again before using it.");
    expect(summaryProblem(summaryOf(base), base)).toBeUndefined();
  });

  it("keeps typed and imported family values beside the run", () => {
    const base = importedEsq();
    const run = withRunOfRecord(base, summaryOf(base));
    const upstream = modelUpstream();
    const es = upstream.es;
    if (es === undefined) throw new Error("fixture has no ES");
    es.eventSequenceFamilies = es.eventSequenceFamilies.map((family) => (family.uuid === "F-REL" ? { ...family, meanFrequency: 4.323e-5 } : family));
    expect(solveViewOf(run, es)?.families.find((family) => family.id === "F-REL")?.esFrequency).toBe(4.323e-5);

    const solve = run.solve?.families.find((entry) => entry.familyId === "F-REL");
    if (solve === undefined) throw new Error("no release family");
    const typed = withFamilySolve(run, "F-REL", { ...solve, typed: { annualFrequency: 7.5e-5, source: "" }, ofRecord: "TYPED" });
    expect(checks(typed)).toEqual([
      "error:Typed value without a source:F-REL",
      "warning:Run value set aside:F-REL",
    ]);
    const sourced = withFamilySolve(typed, "F-REL", { ...solve, typed: { annualFrequency: 7.5e-5, source: "Hand calculation, report Table 5" }, ofRecord: "TYPED", reason: "Checked by hand." });
    expect(checks(sourced)).toEqual([]);
    expect(sourced.familyQuantifications.find((record) => record.eventSequenceFamilyRef === "F-REL")?.meanFrequency).toBe(7.5e-5);

    const imported = withFamilySolve(run, "F-REL", { ...solve, imported: { annualFrequency: 4.323e-5, element: "ES", workbookId: "es-1", at: NOW } });
    expect(solveViewOf(imported)?.families.find((family) => family.id === "F-REL")).toMatchObject({ source: "RUN", value: WORKED_MCUB[8] });
    expect(checks(imported)).toEqual([]);
  });

  it("drops run values a newer run no longer covers", () => {
    const base = importedEsq();
    const first = withRunOfRecord(base, summaryOf(base));
    const typedSafe = withFamilySolve(first, "F-OK", { familyId: "F-OK", typed: { annualFrequency: 3, source: "Initiator total" }, ofRecord: "TYPED", reason: "Success is the initiator total." });
    const narrower = summaryOf(base);
    narrower.families = narrower.families.filter((family) => family.familyId === "F-REL");
    const second = withRunOfRecord(typedSafe, narrower);
    const safe = second.solve?.families.find((entry) => entry.familyId === "F-OK");
    expect(safe).toEqual({ familyId: "F-OK", typed: { annualFrequency: 3, source: "Initiator total" }, ofRecord: "TYPED", reason: "Success is the initiator total." });
  });
});
