import type { EsqCombination, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { esqRecoveryEventId, resolvedCombinations, therpJoint, type EsqResolvedCombination } from "interfaces-mef-types/esq/esq-post-inputs";
import { applySensitivityCase } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import {
  MODEL_AS_SET,
  logicComplete,
  logicViewOf,
  postRunProblem,
  withCombination,
  withCombinationsFor,
  withDeletions,
  withFloor,
  withRecoveryRule,
  withSearch,
} from "../esqLogic";
import { solveViewOf, withRunOfRecord } from "../esqSolve";
import { modelSummary, postEsq, postSummary } from "./esqPostFixtures";

const NR = esqRecoveryEventId("REC-1");
const NR_PAIR = [NR, "E-3"].sort();
const NR_CODES = NR_PAIR.map((id) => (id === NR ? "NR-REC-1" : "SUP-FAN-HFE"));

const POINTS = new Map([["HFE:HFE-1", 1e-3], ["HFE:HFE-2", 0.02], ["RECOVERY:REC-1", 0.1]]);

function point(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function lognormal(mean: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "LOGNORMAL", mean, errorFactor: 3, level: 0.95 } } };
}

function pointOf(expression: UncertainExpression | undefined): number | undefined {
  return expression?.node === "VALUE" && expression.value.law.family === "POINT" ? expression.value.law.value : undefined;
}

function checks(esq: EventSequenceQuantification): string[] {
  return (logicViewOf(esq, POINTS)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

function solveChecks(esq: EventSequenceQuantification): string[] {
  return (solveViewOf(esq)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
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
  return withCombinationsFor(searched, (logicViewOf(searched)?.combinations ?? []).map((row) => row.eventIds));
}

function pairOf(esq: EventSequenceQuantification): EsqCombination {
  const pair = esq.postWork?.combinations?.find((entry) => entry.id === "HC-2");
  if (pair === undefined) throw new Error("no pair");
  return pair;
}

function entryOf(esq: EventSequenceQuantification, id: string): EsqResolvedCombination | undefined {
  return logicViewOf(esq, POINTS)?.combinations.find((row) => row.entry?.combination.id === id)?.entry;
}

describe("ESQ Step 04 recovery, HFE dependence and deletion rules", () => {
  it("lists the HR recoveries and asks for the HFE search before the step completes", () => {
    const esq = postEsq();
    const view = logicViewOf(esq, POINTS);
    expect(view?.recoveries.map((entry) => `${entry.recovery.id}:${entry.codes.join("+")}:${String(pointOf(entry.recovery.expression))}:${String(entry.recovery.credited)}`)).toEqual([
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
    expect(checks(esq)).toEqual(["error:HFE combinations not searched:HFE dependence"]);
    expect(logicComplete(esq)).toBe(false);
  });

  it("credits a recovery only with its feasibility, value and dependency assessment", () => {
    const base = postEsq();
    expect(checks(credited(base))).toEqual(["error:Recovery outside the dependency assessment:REC-1", "error:HFE combinations not searched:HFE dependence"]);
    const remote = withRecoveryRule(base, "REC-2", { id: "REC-2", groupIds: [], stateIds: [], credited: true, basis: "" });
    expect(checks(remote)).toEqual([
      "error:Recovery not feasible:REC-2",
      "error:No non-recovery value:REC-2",
      "error:HFE combinations not searched:HFE dependence",
      "warning:Credit without a basis:REC-2",
    ]);
    const typed = withRecoveryRule(base, "REC-2", {
      id: "REC-2",
      groupIds: ["IEG-01"],
      stateIds: ["POS-01"],
      credited: true,
      basis: "The remote panel is staffed.",
      typed: { expression: point(0.3), source: "" },
      ofRecord: "TYPED",
      feasibility: { procedure: true, training: true, cues: true, crew: true, time: true, access: true, equipment: true },
    });
    expect(logicViewOf(typed, POINTS)?.recoveries.find((entry) => entry.recovery.id === "REC-2")).toMatchObject({ active: true, assessed: false, recovery: { expression: point(0.3), source: "TYPED", missing: [] } });
    expect(checks(typed)).toEqual([
      "error:Typed value without a source:REC-2",
      "error:Recovery outside the dependency assessment:REC-2",
      "error:HFE combinations not searched:HFE dependence",
    ]);
  });

  it("keeps the search and assesses each combination from HR in HR's order", () => {
    const esq = credited(postEsq());
    const searched = withSearch(esq, postSummary(esq, [
      { eventIds: ["E-2", "E-3"], treeIds: ["ET-A", "ET-B"], cutSetCount: 2, nominalFrequency: 1.2e-7 },
      { eventIds: NR_PAIR, treeIds: ["ET-A"], cutSetCount: 1, nominalFrequency: 4e-6 },
    ]));
    expect(searched.postWork?.search).toMatchObject({ raisedHep: 0.8, cutOff: 1e-14, revision: 5 });
    expect(logicViewOf(searched)?.combinations.map((row) => `${row.codes.join("+")}:${String(row.entry)}`)).toEqual([`${NR_CODES.join("+")}:undefined`, "SUP-HFE+SUP-FAN-HFE:undefined"]);
    expect(checks(searched)).toEqual([
      "error:Recovery outside the dependency assessment:REC-1",
      `error:Combination not assessed:${NR_CODES.join(" and ")}`,
      "error:Combination not assessed:SUP-HFE and SUP-FAN-HFE",
    ]);
    const done = assessed();
    expect(done.postWork?.combinations?.map((entry) => `${entry.id}:${entry.eventIds.join("+")}`)).toEqual([`HC-1:${NR}+E-3`, "HC-2:E-2+E-3"]);
    const rows = logicViewOf(done, POINTS)?.combinations ?? [];
    expect(rows.map((row) => `${row.entry?.combination.id ?? ""}:${row.entry?.hr?.id ?? ""}:${row.entry?.source ?? ""}`)).toEqual(["HC-1:DEP-2:HRA", "HC-2:DEP-1:HRA"]);
    expect(rows[0]?.entry?.joint).toBeCloseTo(0.011, 15);
    expect(rows[0]?.entry?.therp).toBeCloseTo((0.02 * 1.1) / 2, 15);
    expect(rows[1]?.entry?.joint).toBeCloseTo(1.6e-4, 15);
    expect(rows[1]?.entry?.therp).toBeCloseTo((0.001 * 1.12) / 7, 15);
    expect(checks(done)).toEqual([]);
    expect(logicComplete(done)).toBe(true);
    expect(checks(withRecoveryRule(done, "REC-1", { id: "REC-1", groupIds: [], stateIds: [], credited: false, basis: "" }))).toEqual(["warning:Search older than its inputs:HFE dependence"]);
  });

  it("flags an HR joint that its level does not give", () => {
    const esq = credited(postEsq(5e-4));
    const searched = withSearch(esq, postSummary(esq, [{ eventIds: ["E-2", "E-3"], treeIds: ["ET-A"], cutSetCount: 2, nominalFrequency: 1.2e-7 }]));
    const done = withCombinationsFor(searched, [["E-2", "E-3"]]);
    expect(checks(done)).toContain("warning:HR joint HEP disagrees with its level:HC-1");
    expect(logicViewOf(done, POINTS)?.findings.find((finding) => finding.check === "HR joint HEP disagrees with its level")?.detail).toBe("HR gives 5E-4 at moderate dependence. THERP at that level gives 1.6E-4.");
  });

  it("falls back to THERP, types a joint and applies the floor", () => {
    const done = assessed();
    const pair = pairOf(done);
    const low = withCombination(done, "HC-2", { ...pair, ofRecord: "THERP", level: "LOW", basis: "Same crew, different cues." });
    expect(entryOf(low, "HC-2")?.joint).toBeCloseTo((0.001 * 1.38) / 20, 15);
    expect(checks(low)).toEqual([]);

    const floored = withFloor(low, { value: 1e-4, source: "Site HRA guidance" });
    expect(entryOf(floored, "HC-2")).toMatchObject({ joint: 1e-4, floorApplies: true });
    const independent = withCombination(floored, "HC-2", { ...pair, ofRecord: "THERP", level: "ZERO", basis: "" });
    expect(entryOf(independent, "HC-2")).toMatchObject({ floorApplies: false });
    expect(entryOf(independent, "HC-2")?.joint).toBeCloseTo(2e-5, 18);
    expect(checks(independent)).toEqual(["warning:Independence without a basis:HC-2"]);
    expect(checks(withFloor(low, { value: 1e-6, source: "" }))).toEqual(["error:Typed floor without a source:Joint HEP floor", "error:Floor below HR's floor:Joint HEP floor"]);

    const typed = withCombination(done, "HC-2", { ...pair, ofRecord: "TYPED", typed: { joint: 3e-5, source: "" }, basis: "Shared cue." });
    expect(entryOf(typed, "HC-2")?.joint).toBe(3e-5);
    expect(checks(typed)).toEqual(["error:Typed joint HEP without a source:HC-2"]);
    const tooHigh = withCombination(done, "HC-2", { ...pair, ofRecord: "TYPED", typed: { joint: 0.005, source: "Judgment" }, basis: "Shared cue." });
    expect(checks(tooHigh)).toEqual(["error:Joint HEP not usable:HC-2"]);
    const waived = withCombination(done, "HC-2", { ...pair, ofRecord: "TYPED", typed: { joint: 3e-5, source: "Judgment" }, floorWaiver: "Very low dependence, so the 1E-6 floor applies.", basis: "Separate crews." });
    expect(entryOf(waived, "HC-2")).toMatchObject({ joint: 3e-5, floorApplies: false });
    expect(checks(waived)).toEqual(["note:Floor waived:HC-2"]);
  });

  it("moves an HR joint with its members in the 95th percentile case", () => {
    const done = assessed();
    const model = done.model;
    if (model === undefined) throw new Error("no model");
    const esq: EventSequenceQuantification = {
      ...done,
      model: {
        ...model,
        humanEvents: model.humanEvents.map((human) => ({ ...human, hep: lognormal(human.id === "HFE-1" ? 1e-3 : 0.02) })),
        recoveries: (model.recoveries ?? []).map((recovery) => ({ ...recovery, hep: lognormal(0.1) })),
      },
    };
    const upper = new Map([["HFE:HFE-1", 2.40014e-3], ["HFE:HFE-2", 0.0480028], ["RECOVERY:REC-1", 0.240028]]);
    const applied = applySensitivityCase(esq, { id: "SC-9", name: "Every HEP at its 95th percentile", kind: "HEP_95TH", basis: "Applicability gap." }, upper);
    expect(applied.problem).toBeUndefined();
    expect(applied.esq.model?.humanEvents.find((human) => human.id === "HFE-2")?.hep).toEqual(point(0.0480028));
    expect(applied.esq.postWork?.combinations?.find((entry) => entry.id === "HC-2")).toMatchObject({ ofRecord: "THERP", level: "MODERATE" });
    const view = resolvedCombinations(applied.esq, upper).find((entry) => entry.combination.id === "HC-2");
    expect(view?.problem).toBeUndefined();
    expect(view?.joint).toBeCloseTo(therpJoint(view?.members ?? [], "MODERATE") ?? 0, 15);
    expect(view?.joint).toBeGreaterThan(entryOf(esq, "HC-2")?.joint ?? 1);
  });

  it("checks the deletions of each exclusion and keeps their basis", () => {
    const base = postEsq();
    const esq: EventSequenceQuantification = { ...base, logic: { exclusions: [{ id: "EX-1", eventIds: ["E-1", "E-4"], basis: "" }, { id: "EX-2", eventIds: ["E-2"], basis: "One event." }] } };
    expect(checks(esq)).toEqual(expect.arrayContaining(["error:Basis missing:EX-1", "error:Deletions not checked:Exclusions"]));
    const checked = withDeletions(esq, postSummary(esq, [], [{ exclusionId: "EX-1", treeIds: ["ET-A"], cutSetCount: 3, nominalFrequency: 2e-6 }]));
    expect(logicViewOf(checked)?.exclusions.map((entry) => `${entry.exclusion.id}:${String(entry.checkable)}:${String(entry.finding?.cutSetCount)}`)).toEqual(["EX-1:true:3", "EX-2:false:undefined"]);
    expect(checks(checked)).not.toContain("error:Deletions not checked:Exclusions");
    expect(checks(withDeletions(esq, postSummary(esq, [], [])))).toContain("note:Exclusion removes nothing:EX-1");
    expect(postRunProblem(postSummary(esq, [], []), esq)).toBeUndefined();
    expect(postRunProblem(postSummary(base, [], []), esq)).toBe("The model, logic or values changed during the run. Run again.");
    const failed = postSummary(esq, [], []);
    failed.trees = [{ ...failed.trees[0]!, status: "FAILED", failure: "Reactor trip in ET-A is not linked." }, failed.trees[1]!];
    expect(postRunProblem(failed, esq)).toBe("1 of 2 event trees failed. Fix them and run again.");
  });

  it("flags a run of record that leaves the recovery rules out", () => {
    const done = assessed();
    expect(solveChecks(withRunOfRecord(done, modelSummary(done, 5.8e-5)))).not.toContain("error:Run of record leaves rules out:Run of record");
    expect(solveChecks(withRunOfRecord(done, modelSummary(done, 7.6e-5, { ...MODEL_AS_SET, recovery: false })))).toContain("error:Run of record leaves rules out:Run of record");
  });
});
