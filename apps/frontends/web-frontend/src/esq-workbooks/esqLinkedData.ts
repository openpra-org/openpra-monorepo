import type { EsqFamilySolve, EsqLinkedCaseRun, EsqSensitivityCase, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { esqHoldsSavedCopies, esqWithLinkedData, esqWithoutLinkedData } from "interfaces-mef-types/esq/esq-linked-data";
import { esqLinkOf } from "interfaces-mef-types/esq/esq-model-import";
import { solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import { sensitivityWorkOf } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import type { EsqDaCaseOption } from "./esqDaLinks";
import type { EsqUpstream } from "./esqLinks";
import { esqModelSourcesOf, modelNameOf } from "./esqModel";
import { familyQuantificationsOf, frequencyValue } from "./esqSolve";
import { withImportedDaCases } from "./esqSensitivity";

const EDITABLE_STATES: ReadonlySet<string> = new Set(["DRAFT", "REVISION_REQUIRED"]);

function holdsFamilyCopies(esq: EventSequenceQuantification): boolean {
  return (esq.solve?.families ?? []).some((entry) => entry.imported !== undefined);
}

function holdsCaseCopies(esq: EventSequenceQuantification): boolean {
  return (esq.sensitivityWork?.cases ?? []).some((entry) => entry.daCaseRef !== undefined);
}

function esqViewShowsSavedCopies(esq: EventSequenceQuantification): boolean {
  return !EDITABLE_STATES.has(esq.workflowState ?? "DRAFT") && (esqHoldsSavedCopies(esq) || holdsFamilyCopies(esq) || holdsCaseCopies(esq));
}

function esFamilyValues(es: EventSequenceAnalysis | undefined): Map<string, number> {
  return new Map((es?.eventSequenceFamilies ?? []).flatMap((family): [string, number][] => {
    const value = frequencyValue(family.meanFrequency);
    return value === undefined ? [] : [[family.uuid, value]];
  }));
}

function withoutImported(entry: EsqFamilySolve): EsqFamilySolve {
  const { imported: _copy, ...rest } = entry;
  return rest;
}

function withLinkedFamilies(esq: EventSequenceQuantification, es: EventSequenceAnalysis | undefined): EventSequenceQuantification {
  const esId = esqLinkOf(esq, "ES");
  const values = esId === undefined ? new Map<string, number>() : esFamilyValues(es);
  const work = solveWorkOf(esq);
  const linked = (value: number): EsqFamilySolve["imported"] => ({ annualFrequency: value, element: "ES", workbookId: esId ?? "", at: "" });
  const families = work.families.map((entry): EsqFamilySolve => {
    const value = values.get(entry.familyId);
    const rest = withoutImported(entry);
    return value === undefined ? rest : { ...rest, imported: linked(value) };
  });
  const added = [...values.entries()]
    .filter(([familyId]) => !work.families.some((entry) => entry.familyId === familyId))
    .map(([familyId, value]): EsqFamilySolve => ({ familyId, imported: linked(value) }));
  if (added.length === 0 && families.every((entry, index) => JSON.stringify(entry) === JSON.stringify(work.families[index]))) return esq;
  const next: EventSequenceQuantification = { ...esq, solve: { ...work, families: [...families, ...added] } };
  return next.solve?.families.some((entry) => entry.ofRecord === "IMPORTED") === true ? { ...next, familyQuantifications: familyQuantificationsOf(next) } : next;
}

function withoutLinkedFamilies(esq: EventSequenceQuantification): EventSequenceQuantification {
  const solve = esq.solve;
  if (solve === undefined) return esq;
  const families = solve.families.map(withoutImported).filter((entry) => Object.keys(entry).length > 1);
  return { ...esq, solve: { ...solve, families } };
}

function runOfCase(entry: EsqSensitivityCase, runs: readonly EsqLinkedCaseRun[]): EsqSensitivityCase {
  const run = runs.find((candidate) => candidate.caseId === entry.id)?.run;
  return run === undefined ? entry : { ...entry, run };
}

function withLinkedCases(esq: EventSequenceQuantification, options: readonly EsqDaCaseOption[]): EventSequenceQuantification {
  const work = sensitivityWorkOf(esq);
  const held = work.cases ?? [];
  const copies = held.filter((entry) => entry.daCaseRef !== undefined);
  if (copies.length === 0 && options.length === 0) return esq;
  const copiedRuns = copies.flatMap((entry): EsqLinkedCaseRun[] => (entry.run === undefined ? [] : [{ caseId: entry.id, run: entry.run }]));
  const runs = [...(work.linkedCaseRuns ?? []), ...copiedRuns.filter((entry) => !(work.linkedCaseRuns ?? []).some((own) => own.caseId === entry.caseId))];
  const { linkedCaseRuns: _runs, ...rest } = work;
  const typed: EventSequenceQuantification = { ...esq, sensitivityWork: { ...rest, cases: held.filter((entry) => entry.daCaseRef === undefined) } };
  const imported = withImportedDaCases(typed, options);
  const cases = (imported.sensitivityWork?.cases ?? []).map((entry) => (entry.daCaseRef === undefined ? entry : runOfCase(entry, runs)));
  const shown = new Set(cases.filter((entry) => entry.daCaseRef !== undefined).map((entry) => entry.id));
  const waiting = runs.filter((entry) => !shown.has(entry.caseId));
  return { ...imported, sensitivityWork: { ...(imported.sensitivityWork ?? {}), cases, ...(waiting.length === 0 ? {} : { linkedCaseRuns: waiting }) } };
}

function withoutLinkedCases(esq: EventSequenceQuantification): EventSequenceQuantification {
  const work = esq.sensitivityWork;
  if (work === undefined) return esq;
  const cases = work.cases ?? [];
  const runs = cases.flatMap((entry): EsqLinkedCaseRun[] => (entry.daCaseRef === undefined || entry.run === undefined ? [] : [{ caseId: entry.id, run: entry.run }]));
  const waiting = (work.linkedCaseRuns ?? []).filter((entry) => !runs.some((own) => own.caseId === entry.caseId) && !cases.some((own) => own.id === entry.caseId && own.daCaseRef !== undefined));
  const kept = [...runs, ...waiting];
  const { linkedCaseRuns: _runs, cases: _cases, ...rest } = work;
  const typed = cases.filter((entry) => entry.daCaseRef === undefined);
  return { ...esq, sensitivityWork: { ...rest, ...(work.cases === undefined && typed.length === 0 ? {} : { cases: typed }), ...(kept.length === 0 ? {} : { linkedCaseRuns: kept }) } };
}

function esqViewOf(saved: EventSequenceQuantification, upstream: EsqUpstream, daCases: readonly EsqDaCaseOption[]): EventSequenceQuantification {
  if (esqViewShowsSavedCopies(saved)) return saved;
  const base = esqWithLinkedData(saved, { ...esqModelSourcesOf(upstream), ...(upstream.ri === undefined ? {} : { ri: upstream.ri }) }, modelNameOf(upstream));
  const families = withLinkedFamilies(base, upstream.es);
  return esqLinkOf(saved, "DA") === undefined ? withLinkedCases(families, []) : withLinkedCases(families, daCases);
}

function esqSavedOf(view: EventSequenceQuantification): EventSequenceQuantification {
  return esqWithoutLinkedData(withoutLinkedCases(withoutLinkedFamilies(view)));
}

export { esqSavedOf, esqViewOf, esqViewShowsSavedCopies };
