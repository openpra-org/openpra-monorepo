import type { EsqCombination, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqRecoveryEventId, resolvedCombinations, therpJoint, type EsqResolvedCombination } from "interfaces-mef-types/esq/esq-post-inputs";
import { applySensitivityCase } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import { MODEL_AS_SET } from "../esqLogic";
import { stepsFromMef } from "../esqSelectors";
import { withRunOfRecord } from "../esqSolve";
import {
  comparisonRequest,
  postComplete,
  postRunProblem,
  postViewOf,
  withCombination,
  withCombinationsFor,
  withComparison,
  withDeletions,
  withFloor,
  withRecoveryRule,
  withSearch,
} from "../esqPost";
import { modelSummary, postEsq, postSummary } from "./esqPostFixtures";

const NR = esqRecoveryEventId("REC-1");
const NR_PAIR = [NR, "E-3"].sort();
const NR_CODES = NR_PAIR.map((id) => (id === NR ? "NR-REC-1" : "SUP-FAN-HFE"));
const NOT_RUN = "error:Not quantified with the rules:Run of record";

function checks(esq: EventSequenceQuantification): string[] {
  return (postViewOf(esq)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

function ruleChecks(esq: EventSequenceQuantification): string[] {
  return checks(esq).filter((text) => !text.endsWith(":Run of record") && !text.endsWith(":Results"));
}

function credited(esq: EventSequenceQuantification): EventSequenceQuantification {
  return withRecoveryRule(esq, "REC-1", { id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "The local start is in the procedure." });
}

function assessed(): EventSequenceQuantification {
  const esq = credited(postEsq());
  const searched = withSearch(esq, postSummary(esq, [
    { eventIds: NR_PAIR, treeIds: ["ET-A"], cutSetCount: 1, nominalFrequency: 4e-6 },
    { eventIds: ["E-2", "E-3"], treeIds: ["ET-A", "ET-B"], cutSetCount: 2, nominalFrequency: 1.2e-7 },
  ]));
  return withCombinationsFor(searched, (postViewOf(searched)?.combinations ?? []).map((row) => row.eventIds));
}

function pairOf(esq: EventSequenceQuantification): EsqCombination {
  const pair = esq.postWork?.combinations?.find((entry) => entry.id === "HC-2");
  if (pair === undefined) throw new Error("no pair");
  return pair;
}

function entryOf(esq: EventSequenceQuantification, id: string): EsqResolvedCombination | undefined {
  return postViewOf(esq)?.combinations.find((row) => row.entry?.combination.id === id)?.entry;
}

describe("ESQ Step 06 post-processing", () => {
  it("lists the HR recoveries and asks for the HFE search before the step completes", () => {
    const esq = postEsq();
    const view = postViewOf(esq);
    expect(view?.recoveries.map((entry) => `${entry.recovery.id}:${entry.codes.join("+")}:${String(entry.recovery.value)}:${String(entry.recovery.credited)}`)).toEqual([
      "REC-1:SUP-FAN-HFE:0.1:false",
      "REC-2:SUP-HFE:undefined:false",
    ]);
    expect(view?.hrFloor).toBe(1e-5);
    expect(view?.members.map((option) => option.label)).toEqual([
      "SUP-FAN-HFE · Operator fails to start the fan",
      "SUP-HFE · Operator fails to align",
      "NR-REC-1 · Start the fan locally fails",
      "NR-REC-2 · Align from the remote panel fails",
    ]);
    expect(checks(esq)).toEqual(["error:HFE combinations not searched:HFE combinations"]);
    expect(postComplete(esq)).toBe(false);
    expect(stepsFromMef(esq, "preparer").map((step) => `${step.num}:${step.id}`)).toEqual([
      "01:scope", "02:model", "03:logic", "04:barriers", "05:solve", "06:post", "07:results", "08:uncert", "09:sens", "10:handoff", "11:draft", "12:review", "13:approval",
    ]);
  });

  it("credits a recovery only with its feasibility, value and dependency assessment", () => {
    const base = postEsq();
    expect(checks(credited(base))).toEqual(["error:Recovery outside the dependency assessment:REC-1", "error:HFE combinations not searched:HFE combinations", NOT_RUN]);
    const remote = withRecoveryRule(base, "REC-2", { id: "REC-2", groupIds: [], stateIds: [], credited: true, basis: "" });
    expect(checks(remote)).toEqual([
      "error:Recovery not feasible:REC-2",
      "error:No non-recovery HEP:REC-2",
      "error:HFE combinations not searched:HFE combinations",
      "warning:Credit without a basis:REC-2",
    ]);
    const typed = withRecoveryRule(base, "REC-2", {
      id: "REC-2",
      groupIds: ["IEG-01"],
      stateIds: ["POS-01"],
      credited: true,
      basis: "The remote panel is staffed.",
      typed: { value: 0.3, source: "" },
      ofRecord: "TYPED",
      feasibility: { procedure: true, training: true, cues: true, crew: true, time: true, access: true, equipment: true },
    });
    expect(postViewOf(typed)?.recoveries.find((entry) => entry.recovery.id === "REC-2")).toMatchObject({ active: true, assessed: false, recovery: { value: 0.3, source: "TYPED", missing: [] } });
    expect(checks(typed)).toEqual([
      "error:Typed HEP without a source:REC-2",
      "error:Recovery outside the dependency assessment:REC-2",
      "error:HFE combinations not searched:HFE combinations",
      NOT_RUN,
    ]);
  });

  it("keeps the search and assesses each combination from HR in HR's order", () => {
    const esq = credited(postEsq());
    const searched = withSearch(esq, postSummary(esq, [
      { eventIds: ["E-2", "E-3"], treeIds: ["ET-A", "ET-B"], cutSetCount: 2, nominalFrequency: 1.2e-7 },
      { eventIds: NR_PAIR, treeIds: ["ET-A"], cutSetCount: 1, nominalFrequency: 4e-6 },
    ]));
    expect(searched.postWork?.search).toMatchObject({ raisedHep: 0.8, cutOff: 1e-14, revision: 5 });
    expect(postViewOf(searched)?.combinations.map((row) => `${row.codes.join("+")}:${String(row.entry)}`)).toEqual([`${NR_CODES.join("+")}:undefined`, "SUP-HFE+SUP-FAN-HFE:undefined"]);
    expect(ruleChecks(searched)).toEqual([
      "error:Recovery outside the dependency assessment:REC-1",
      `error:Combination not assessed:${NR_CODES.join(" and ")}`,
      "error:Combination not assessed:SUP-HFE and SUP-FAN-HFE",
    ]);
    const done = assessed();
    expect(done.postWork?.combinations?.map((entry) => `${entry.id}:${entry.eventIds.join("+")}`)).toEqual([`HC-1:${NR}+E-3`, "HC-2:E-2+E-3"]);
    const rows = postViewOf(done)?.combinations ?? [];
    expect(rows.map((row) => `${row.entry?.combination.id ?? ""}:${row.entry?.hr?.id ?? ""}:${row.entry?.source ?? ""}`)).toEqual(["HC-1:DEP-2:HRA", "HC-2:DEP-1:HRA"]);
    expect(rows[0]?.entry?.joint).toBeCloseTo(0.011, 15);
    expect(rows[0]?.entry?.therp).toBeCloseTo((0.02 * 1.1) / 2, 15);
    expect(rows[1]?.entry?.joint).toBeCloseTo(1.6e-4, 15);
    expect(rows[1]?.entry?.therp).toBeCloseTo((0.001 * 1.12) / 7, 15);
    expect(checks(done)).toEqual([NOT_RUN]);
    expect(postComplete(done)).toBe(false);
    expect(ruleChecks(withRecoveryRule(done, "REC-1", { id: "REC-1", groupIds: [], stateIds: [], credited: false, basis: "" }))).toEqual(["warning:Search older than its inputs:HFE combinations"]);
  });

  it("flags an HR joint that its level does not give", () => {
    const esq = credited(postEsq(5e-4));
    const searched = withSearch(esq, postSummary(esq, [{ eventIds: ["E-2", "E-3"], treeIds: ["ET-A"], cutSetCount: 2, nominalFrequency: 1.2e-7 }]));
    const done = withCombinationsFor(searched, [["E-2", "E-3"]]);
    expect(checks(done)).toContain("warning:HR joint HEP disagrees with its level:HC-1");
    expect(postViewOf(done)?.findings.find((finding) => finding.check === "HR joint HEP disagrees with its level")?.detail).toBe("HR gives 5E-4 at moderate dependence. THERP at that level gives 1.6E-4.");
  });

  it("falls back to THERP, types a joint and applies the floor", () => {
    const done = assessed();
    const pair = pairOf(done);
    const low = withCombination(done, "HC-2", { ...pair, ofRecord: "THERP", level: "LOW", basis: "Same crew, different cues." });
    expect(entryOf(low, "HC-2")?.joint).toBeCloseTo((0.001 * 1.38) / 20, 15);
    expect(ruleChecks(low)).toEqual([]);

    const floored = withFloor(low, { value: 1e-4, source: "Site HRA guidance" });
    expect(entryOf(floored, "HC-2")).toMatchObject({ joint: 1e-4, floorApplies: true });
    const independent = withCombination(floored, "HC-2", { ...pair, ofRecord: "THERP", level: "ZERO", basis: "" });
    expect(entryOf(independent, "HC-2")).toMatchObject({ floorApplies: false });
    expect(entryOf(independent, "HC-2")?.joint).toBeCloseTo(2e-5, 18);
    expect(ruleChecks(independent)).toEqual(["warning:Independence without a basis:HC-2"]);
    expect(ruleChecks(withFloor(low, { value: 1e-6, source: "" }))).toEqual(["error:Typed floor without a source:Joint HEP floor", "error:Floor below HR's floor:Joint HEP floor"]);

    const typed = withCombination(done, "HC-2", { ...pair, ofRecord: "TYPED", typed: { joint: 3e-5, source: "" }, basis: "Shared cue." });
    expect(entryOf(typed, "HC-2")?.joint).toBe(3e-5);
    expect(ruleChecks(typed)).toEqual(["error:Typed joint HEP without a source:HC-2"]);
    const tooHigh = withCombination(done, "HC-2", { ...pair, ofRecord: "TYPED", typed: { joint: 0.005, source: "Judgment" }, basis: "Shared cue." });
    expect(ruleChecks(tooHigh)).toEqual(["error:Joint HEP not usable:HC-2"]);
    const waived = withCombination(done, "HC-2", { ...pair, ofRecord: "TYPED", typed: { joint: 3e-5, source: "Judgment" }, floorWaiver: "Very low dependence, so the 1E-6 floor applies.", basis: "Separate crews." });
    expect(entryOf(waived, "HC-2")).toMatchObject({ joint: 3e-5, floorApplies: false });
    expect(ruleChecks(waived)).toEqual(["note:Floor waived:HC-2"]);
  });

  it("moves an HR joint with its members in the 95th percentile case", () => {
    const done = assessed();
    const esq: EventSequenceQuantification = { ...done, uncertaintyWork: { spreads: ["HFE:HFE-1", "HFE:HFE-2", "RECOVERY:REC-1"].map((key) => ({ key, errorFactor: 3, source: "HR uncertainty note." })) } };
    const applied = applySensitivityCase(esq, { id: "SC-9", name: "Every HEP at its 95th percentile", kind: "HEP_95TH", basis: "Applicability gap." });
    expect(applied.problem).toBeUndefined();
    expect(applied.esq.postWork?.combinations?.find((entry) => entry.id === "HC-2")).toMatchObject({ ofRecord: "THERP", level: "MODERATE" });
    const view = resolvedCombinations(applied.esq).find((entry) => entry.combination.id === "HC-2");
    expect(view?.problem).toBeUndefined();
    expect(view?.joint).toBeCloseTo(therpJoint(view?.members ?? [], "MODERATE") ?? 0, 15);
    expect(view?.joint).toBeGreaterThan(entryOf(esq, "HC-2")?.joint ?? 1);
  });

  it("checks the deletions of each exclusion and keeps their basis", () => {
    const base = postEsq();
    const esq: EventSequenceQuantification = { ...base, logic: { exclusions: [{ id: "EX-1", eventIds: ["E-1", "E-4"], basis: "" }, { id: "EX-2", eventIds: ["E-2"], basis: "One event." }] } };
    expect(checks(esq)).toEqual(expect.arrayContaining(["error:Deleted combination without a basis:EX-1", "error:Deletions not checked:Exclusions"]));
    const checked = withDeletions(esq, postSummary(esq, [], [{ exclusionId: "EX-1", treeIds: ["ET-A"], cutSetCount: 3, nominalFrequency: 2e-6 }]));
    expect(postViewOf(checked)?.exclusions.map((entry) => `${entry.exclusion.id}:${String(entry.checkable)}:${String(entry.finding?.cutSetCount)}`)).toEqual(["EX-1:true:3", "EX-2:false:undefined"]);
    expect(checks(checked)).not.toContain("error:Deletions not checked:Exclusions");
    expect(checks(withDeletions(esq, postSummary(esq, [], [])))).toContain("note:Exclusion removes nothing:EX-1");
    expect(postRunProblem(postSummary(esq, [], []), esq)).toBeUndefined();
    expect(postRunProblem(postSummary(base, [], []), esq)).toBe("The model, logic or values changed during the run. Run again.");
    const failed = postSummary(esq, [], []);
    failed.trees = [{ ...failed.trees[0]!, status: "FAILED", failure: "Reactor trip in ET-A is not linked." }, failed.trees[1]!];
    expect(postRunProblem(failed, esq)).toBe("1 of 2 event trees failed. Fix them and run again.");
  });

  it("asks for a run with the rules and compares it with a run without them", () => {
    const done = assessed();
    const recorded = withRunOfRecord(done, modelSummary(done, 5.8e-5));
    expect(checks(recorded)).toEqual(["note:No comparison without the rules:Results"]);
    expect(postComplete(recorded)).toBe(true);
    const run = recorded.solve?.run;
    if (run === undefined) throw new Error("no run of record");
    expect(comparisonRequest(run)).toEqual({
      logic: { ...MODEL_AS_SET, recovery: false, dependency: false },
      calculation: "CUT_SETS",
      cutSets: { basis: "FREQUENCY", cutOffs: [1e-12, 1e-13, 1e-14], quantifier: "MCUB", keep: 100, limitOrder: 4 },
    });
    expect(comparisonRequest({ ...run, cutOffs: [] })).toBeUndefined();
    const compared = withComparison(recorded, modelSummary(recorded, 7.6e-5, { ...MODEL_AS_SET, recovery: false, dependency: false }));
    expect(postViewOf(compared)?.results).toEqual([
      { familyId: "F-OK", name: "Safe", without: 3, withRules: 3 },
      { familyId: "F-REL", name: "Release", without: 7.6e-5, withRules: 5.8e-5 },
    ]);
    expect(checks(compared)).toEqual([]);
    const ruleless = withRunOfRecord(done, modelSummary(done, 7.6e-5, { ...MODEL_AS_SET, recovery: false }));
    expect(checks(ruleless)).toContain("error:Run of record leaves rules out:Run of record");
    const changed = withRecoveryRule(compared, "REC-1", { id: "REC-1", groupIds: ["IEG-01"], stateIds: [], credited: true, basis: "Only after a loss of cooling." });
    expect(checks(changed)).toEqual(expect.arrayContaining(["error:Run of record older than the rules:Run of record", "warning:Comparison older than its inputs:Results"]));
  });
});
