import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { uncertaintyInputsKey } from "interfaces-mef-types/esq/esq-measure-inputs";
import { stepsFromMef } from "../esqSelectors";
import { withModelImported } from "../esqModel";
import {
  contributorRows,
  cutSetRows,
  importanceRecordOf,
  measureRows,
  resultsComplete,
  resultsViewOf,
  thresholdsOf,
  withComparison,
  withConfirmation,
  withConsistency,
  withCutSetReview,
  withImportance,
  withThresholds,
} from "../esqResults";
import { uncertaintyViewOf, withSpread, withUncertaintyRun } from "../esqUncertainty";
import { sensitivityViewOf, withCase, withCaseRun, withDecision, withImportedDaCases, withPreOperational } from "../esqSensitivity";
import { handoffViewOf, publishEsq } from "../esqHandoff";
import { modelSummary } from "./esqPostFixtures";
import { NOW } from "./esqPostFixtures";
import { RELEASE, caseSummary, importanceResult, measureEsq, measureUpstream, uncertaintyResult } from "./esqMeasureFixtures";
import { PUMP_ESTIMATE, daParameter, fanMission } from "./esqModelFixtures";
import { applySensitivityCase } from "interfaces-mef-types/esq/esq-sensitivity-inputs";

const FAN_LAW: UncertainExpression = { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "LOGNORMAL", mean: 2e-5, errorFactor: 3, level: 0.95 } } };

function checks(findings: { severity: string; check: string; item: string }[]): string[] {
  return findings.map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

function ranked(esq: EventSequenceQuantification): EventSequenceQuantification {
  return withImportance(esq, importanceRecordOf(importanceResult(esq), esq, thresholdsOf(esq, undefined)));
}

function reviewed(esq: EventSequenceQuantification): EventSequenceQuantification {
  const view = resultsViewOf(esq);
  if (view === undefined) throw new Error("no view");
  const [row] = cutSetRows(modelSummary(esq, RELEASE), "F-REL", RELEASE, view.work, view.thresholds, (id) => id);
  if (row === undefined) throw new Error("no cut set");
  let next = withCutSetReview(esq, row, { verdict: "CORRECT", note: "The pump is the only cooling train." });
  for (const topic of ["SYSTEMS", "SUCCESS_CRITERIA", "PROCEDURES", "RULES"] as const) next = withConsistency(next, topic, { topic, consistent: true, note: "Checked against the linked models." });
  next = withComparison(next, { possible: false, reason: "No operating plant of this design exists.", plants: [] });
  return withConfirmation(next, "E-2", "The alignment action is only credited in sequences that do not reach a release.");
}

describe("ESQ Steps 07 to 10", () => {
  it("lists the thirteen steps in order", () => {
    expect(stepsFromMef(measureEsq(), "preparer").map((step) => `${step.num}:${step.id}`)).toEqual([
      "01:scope", "02:model", "03:logic", "04:barriers", "05:solve", "06:post", "07:results", "08:uncert", "09:sens", "10:handoff", "11:draft", "12:review", "13:approval",
    ]);
  });

  it("ranks importance by family with the published RI thresholds", () => {
    const esq = measureEsq();
    const result = importanceResult(esq);
    const thresholds = thresholdsOf(esq, undefined);
    expect(thresholds).toMatchObject({ fussellVesely: 0.005, riskAchievementWorth: 2, aggregatePercent: 95, individualPercent: 1, typed: false });
    const rows = new Map(measureRows(result, ["F-REL"], thresholds).map((row) => [row.target.id, row]));
    const pump = rows.get("EVENT:E-1");
    expect(pump?.fussellVesely).toBeCloseTo(0.6, 12);
    expect(pump?.riskAchievementWorth).toBeCloseTo(300.4, 9);
    expect(pump?.riskReductionWorth).toBeCloseTo(2.5, 12);
    expect(pump?.birnbaum).toBeCloseTo(3e-3, 15);
    expect(rows.get("EVENT:E-3")).toMatchObject({ significant: true });
    expect(rows.get("EVENT:E-3")?.fussellVesely).toBeCloseTo(0.004, 12);
    expect(rows.get("EVENT:E-3")?.riskAchievementWorth).toBeCloseTo(2.5, 12);
    expect(rows.get("EVENT:E-4")).toMatchObject({ significant: false });
    const record = importanceRecordOf(result, esq, thresholds);
    expect(record.significant.map((entry) => entry.id).sort()).toEqual(["EVENT:E-1", "EVENT:E-3", "PARAMETER:P-1", "SYSTEM:SYS-COOL"]);
    expect(record).toMatchObject({ base: RELEASE, silentEventIds: ["E-2"], thresholds: { fussellVesely: 0.005, riskAchievementWorth: 2 } });
    const typed = withThresholds(withImportance(esq, record), { fussellVesely: 0.01, riskAchievementWorth: 3, source: "Project criteria." });
    expect(resultsViewOf(typed)?.thresholdsChanged).toBe(true);
    expect(importanceRecordOf(result, typed, thresholdsOf(typed, undefined)).significant.map((entry) => entry.id).sort()).toEqual(["EVENT:E-1", "PARAMETER:P-1", "SYSTEM:SYS-COOL"]);
  });

  it("asks for the reviews of Step 07 and completes once they are done", () => {
    const esq = measureEsq();
    expect(checks(resultsViewOf(esq)?.findings ?? [])).toEqual(expect.arrayContaining([
      "error:No significant cut set reviewed:F-REL",
      "error:Consistency not checked:System models",
      "error:Consistency not checked:Flags, exclusions and recovery",
      "error:Similar plants not addressed:Comparison",
      "error:Importance not ranked:Importance",
    ]));
    const ranking = ranked(esq);
    expect(checks(resultsViewOf(ranking)?.findings ?? [])).toContain("warning:Event never in a retained cut set:SUP-HFE");
    const done = reviewed(ranking);
    const view = resultsViewOf(done);
    expect(checks(view?.findings ?? []).filter((text) => text.startsWith("error"))).toEqual([]);
    expect(checks(view?.findings ?? [])).toContain("warning:No non-significant cut set sampled:Cut sets");
    expect(resultsComplete(done)).toBe(true);
    expect(stepsFromMef(done, "preparer").find((step) => step.id === "results")?.status).toBe("complete");
  });

  it("splits a family by sequence, state and initiator and adds the ranked contributors", () => {
    const esq = ranked(measureEsq());
    const rows = contributorRows({ esq, familyIds: ["F-REL"], summary: modelSummary(esq, RELEASE), importance: importanceResult(esq) });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    expect(byKey.get("SEQUENCE:ET-A:A-2")).toMatchObject({ kind: "SEQUENCE", fraction: 1 });
    expect(byKey.get("INITIATOR:IEG-01")?.fraction).toBeCloseTo(1, 12);
    expect(byKey.get("STATE:POS-01")?.fraction).toBeCloseTo(1, 12);
    expect(byKey.get("PARAMETER:PARAMETER:P-1")?.fraction).toBeCloseTo(0.6, 12);
    expect(byKey.get("SYSTEM:SYSTEM:SYS-COOL")?.annualFrequency).toBeCloseTo(6e-6, 18);
  });

  it("samples DA estimates and SY expressions, takes typed spreads only on the other inputs and keeps the record", () => {
    const esq = ranked(measureEsq());
    const view = uncertaintyViewOf(esq);
    const inputs = new Map((view?.inputs ?? []).map((row) => [row.input.key, row]));
    expect(inputs.get("PARAMETER:P-1")).toMatchObject({ significant: true, sampled: true, input: { contract: true, source: "DA", unit: "PROBABILITY", expression: PUMP_ESTIMATE } });
    expect(inputs.get("INITIATOR:IEG-01")).toMatchObject({ sampled: true, input: { contract: true, source: "IE", unit: "PER_YEAR", expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 2.943, errorFactor: 2.3, level: 0.95 } } } } });
    expect(inputs.get("EVENT:E-3")).toMatchObject({ significant: true, sampled: false, input: { contract: true, source: "SY", missing: "SY types this value without uncertainty. Give it a law in SY." } });
    expect(inputs.get("HFE:HFE-1")).toMatchObject({ sampled: false, input: { contract: false, legacy: { point: 1e-3 }, missing: "HR gives no distribution. Type an error factor." } });
    expect(checks(view?.findings ?? [])).toEqual(expect.arrayContaining([
      "error:No propagated mean:Uncertainty",
      "error:Risk-significant input without a distribution:SUP-FAN-FR · Fan fails to run",
    ]));
    const ignored = withSpread(esq, "EVENT:E-3", { key: "EVENT:E-3", errorFactor: 3, source: "Generic fan spread." });
    const fan = uncertaintyViewOf(ignored)?.inputs.find((row) => row.input.key === "EVENT:E-3");
    expect(fan).toMatchObject({ sampled: false, input: { source: "SY" } });
    expect(fan?.spread).toBeUndefined();
    const typed = withSpread(esq, "HFE:HFE-1", { key: "HFE:HFE-1", errorFactor: 3, source: "Generic HEP spread." });
    const human = uncertaintyViewOf(typed)?.inputs.find((row) => row.input.key === "HFE:HFE-1");
    expect(human).toMatchObject({ sampled: true, spread: { errorFactor: 3 }, input: { source: "TYPED", legacy: { point: 1e-3, errorFactor: 3 } } });
    expect(human?.input.expression).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: 1e-3, errorFactor: 3, level: 0.95 }, lower: null, upper: 1 } } });
    expect(uncertaintyInputsKey(typed)).not.toBe(uncertaintyInputsKey(esq));
    const upstream = measureUpstream();
    const sy = upstream.sy;
    if (sy === undefined) throw new Error("SY fixture missing");
    sy.systemBasicEvents = sy.systemBasicEvents.map((event) => (event.uuid === "E-3" ? { ...event, expression: fanMission(FAN_LAW) } : event));
    const lawful = withModelImported(typed, upstream, NOW);
    expect(uncertaintyViewOf(lawful)?.inputs.find((row) => row.input.key === "EVENT:E-3")).toMatchObject({ sampled: true, input: { expression: fanMission(FAN_LAW) } });
    const sampled = withUncertaintyRun(lawful, uncertaintyResult(lawful));
    const after = uncertaintyViewOf(sampled);
    expect(after?.run).toMatchObject({ trials: 1000, method: "LATIN_HYPERCUBE", correlation: "SHARED", total: { mean: 1.3e-5 }, families: [expect.objectContaining({ standardError: 2e-5 / Math.sqrt(1000) })] });
    expect(after?.runStale).toBe(false);
    expect(checks(after?.findings ?? [])).toContain("note:Mean away from the point value:F-REL");
    expect(checks(after?.findings ?? []).filter((text) => text.startsWith("error"))).toEqual([]);
  });

  it("imports the registers, turns a key source into a case and tracks the pre-operational assumptions", () => {
    const upstream = measureUpstream();
    const esq = measureEsq();
    const view = sensitivityViewOf(esq, upstream);
    const entries = new Map((view?.register ?? []).map((entry) => [entry.id, entry]));
    expect(entries.get("DA:SOURCE:MU-1")).toMatchObject({ origin: "DA", kind: "SOURCE", upstreamKey: true, daRef: { workbookId: "da-1", sourceId: "MU-1" } });
    expect([...entries.values()].some((entry) => entry.origin === "POS" && entry.text === "Shutdown hours come from a reference plant")).toBe(true);
    expect(view?.preOperational.map((entry) => entry.id)).toContain("POS:POS-PA-1");
    expect(checks(view?.findings ?? [])).toEqual(expect.arrayContaining([
      "error:Key source with no case and no reason:MU-1",
      "warning:No sensitivity case:Cases",
      "warning:Pre-operational assumptions not tracked:1 assumptions",
    ]));
    const withCases = withCase(esq, "SC-1", { id: "SC-1", name: "Pump at its upper bound", kind: "PARAMETER", target: "P-1", value: 1e-2, basis: "DA upper bound." });
    const linked = withDecision(withCases, "DA:SOURCE:MU-1", { id: "DA:SOURCE:MU-1", familyIds: ["F-REL"], key: true, caseIds: ["SC-1"], reason: "" });
    const ran = withCaseRun(linked, "SC-1", caseSummary(linked, "SC-1", 5e-5));
    const after = sensitivityViewOf(ran, upstream);
    expect(after?.cases[0]).toMatchObject({ stale: false, entry: { run: { families: expect.arrayContaining([{ familyId: "F-REL", annualFrequency: 5e-5 }]) } } });
    expect(after?.results[0]?.total).toBeCloseTo(5e-5, 18);
    expect(after?.baseTotal).toBeCloseTo(RELEASE, 18);
    expect(checks(after?.findings ?? [])).not.toContain("error:Key source with no case and no reason:MU-1");
    const broken = withCase(ran, "SC-2", { id: "SC-2", name: "Unknown", kind: "PARAMETER", target: "P-9", value: 1, basis: "" });
    expect(checks(sensitivityViewOf(broken, upstream)?.findings ?? [])).toContain("error:Case cannot run:SC-2 · Unknown");
    const closed = withPreOperational(ran, "POS:POS-PA-1", { id: "POS:POS-PA-1", status: "CLOSED", closure: "", caseIds: [] });
    expect(checks(sensitivityViewOf(closed, upstream)?.findings ?? [])).toContain("error:Closed without a closure:POS:POS-PA-1");
    const imported = withImportedDaCases(esq, [{ workbookId: "da-1", workbookName: "DA", item: { id: "SS-1", name: "Pump range", kind: "RANGE", parameterId: "P-1", low: 1e-3, high: 4e-3, reason: "Generic spread." }, target: "P-1", low: 1e-3, high: 4e-3, base: 2e-3 }]);
    expect(imported.sensitivityWork?.cases).toEqual([
      { id: "SS-1-LOW", name: "Pump range · low", kind: "PARAMETER", target: "P-1", value: 1e-3, basis: "Generic spread.", daCaseRef: { workbookId: "da-1", caseId: "SS-1" } },
      { id: "SS-1-HIGH", name: "Pump range · high", kind: "PARAMETER", target: "P-1", value: 4e-3, basis: "Generic spread.", daCaseRef: { workbookId: "da-1", caseId: "SS-1" } },
    ]);
  });

  it("runs an event case that rewrites a DA-held expression and stops one that reads an unknown parameter", () => {
    const esq = measureEsq();
    const doubled = withCase(esq, "SC-E1", { id: "SC-E1", name: "Pump at twice its estimate", kind: "EVENT", target: "E-1", factor: 2, basis: "Doubled for the test." });
    const applied = applySensitivityCase(doubled, { id: "SC-E1", name: "Pump at twice its estimate", kind: "EVENT", target: "E-1", factor: 2, basis: "Doubled for the test." });
    expect(applied.esq.model?.events.find((event) => event.id === "E-1")).toMatchObject({ heldBy: "TYPED", expression: { node: "OPERATION", operation: "MULTIPLY", operands: [daParameter("P-1"), expect.objectContaining({ node: "VALUE" })] } });
    expect(sensitivityViewOf(doubled, measureUpstream())?.cases[0]?.problem).toBeUndefined();
    const model = esq.model;
    if (model === undefined) throw new Error("no model");
    const broken: EventSequenceQuantification = { ...esq, model: { ...model, events: model.events.map((event) => (event.id === "E-4" ? { ...event, expression: daParameter("P-9") } : event)) } };
    const stopped = withCase(broken, "SC-E4", { id: "SC-E4", name: "Division doubled", kind: "EVENT", target: "E-4", factor: 2, basis: "Doubled for the test." });
    expect(sensitivityViewOf(stopped, measureUpstream())?.cases[0]?.problem).toBe("RPS-DIV-FS reads DA parameter P-9, which the Step 02 import does not hold.");
  });

  it("publishes the family package that RI and DA read and flags a stale publication", () => {
    const upstream = measureUpstream();
    const base = ranked(measureEsq());
    const esq = withUncertaintyRun(base, uncertaintyResult(base));
    const published = publishEsq(esq, { upstream, daCases: [], importance: importanceResult(esq), summary: modelSummary(esq, RELEASE), at: NOW, revision: 6 });
    const release = published.familyQuantifications.find((record) => record.eventSequenceFamilyRef === "F-REL");
    expect(release).toMatchObject({ quantificationBasis: "MEAN_PROPAGATED_SOKC", meanFrequency: 1.3e-5, percentile05: 2e-6, percentile50: 7e-6, percentile95: 4.5e-5 });
    expect(release?.contributionBreakdown).toEqual(expect.arrayContaining([
      { contributorRef: "Loss of cooling (IEG-01)", contributorType: "INITIATING_EVENT", fractionalContribution: 1 },
      { contributorRef: "Full power (POS-01)", contributorType: "PLANT_OPERATING_STATE", fractionalContribution: 1 },
      expect.objectContaining({ contributorRef: "Pump fails to start (COOL-PMP-FS)", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: expect.closeTo(0.6, 12) }),
    ]));
    const overall = published.importanceAnalyses?.find((record) => record.scope === "OVERALL");
    expect(overall?.measures).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "COMPONENT", entityRef: "Pump fails to start (P-1)", dataAnalysisParameterRef: "P-1", fussellVesely: expect.closeTo(0.6, 12) }),
      expect.objectContaining({ entityType: "SYSTEM", systemRef: "SYS-COOL" }),
    ]));
    expect(published.importanceAnalyses?.find((record) => record.scope === "PER_FAMILY")?.familyRef).toBe("F-REL");
    expect(published.riskSignificantContributors.map((entry) => entry.entityRef)).toEqual(expect.arrayContaining(["Pump fails to start (COOL-PMP-FS)", "Pump fails to start (P-1)"]));
    expect(published.modelUncertaintySourceAssessments).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceElementCode: "DA", uncertaintySource: "Pump data from generic sources", effectOnFamilyFrequencies: "The pump may fail to start more often", dataAnalysisSourceRef: { workbookId: "da-1", sourceId: "MU-1" } }),
    ]));
    expect(published.preOperationalAssumptions).toEqual([expect.objectContaining({ assumptionId: "POS:POS-PA-1", status: "OPEN", riskImpact: "MEDIUM", affectedTechnicalElementCodes: ["POS"] })]);
    expect(published.uncertaintyPropagation).toMatchObject({ propagationMethod: "LATIN_HYPERCUBE", numberOfSamples: 1000, randomSeed: 1, characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT_SOKC", stateOfKnowledgeCorrelation: { isConsidered: true } });
    expect(published.handoffWork?.published).toMatchObject({ at: NOW, revision: 6, families: 2 });
    const view = handoffViewOf(published, upstream);
    expect(view?.published).toBe(true);
    expect(view?.publishedStale).toBe(false);
    expect(checks(view?.findings ?? [])).not.toContain("error:Not published:Hand-off");
    const changed = withThresholds(published, { fussellVesely: 0.01, riskAchievementWorth: 3, source: "Project criteria." });
    expect(checks(handoffViewOf(changed, upstream)?.findings ?? [])).toContain("error:Published package older than the workbook:Hand-off");
  });
});
