import type {
  EsqCaseKind,
  EsqManualPreOperational,
  EsqManualRegisterEntry,
  EsqModel,
  EsqPreOperationalDecision,
  EsqRegisterDecision,
  EsqRegisterKind,
  EsqSensitivityCase,
  EsqSensitivityWork,
  EsqSolveRun,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "interfaces-mef-types/core/documentation";
import type { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { importanceGroupsOf } from "interfaces-mef-types/esq/esq-measure-inputs";
import { applySensitivityCase, caseInputsKey, registerEntryId, sensitivityWorkOf } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import { solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqEventTreeRunLogic, EsqModelCalculation, EsqModelRunResult, EventTreeCutSetSettings } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { EsqUpstream } from "./esqLinks";
import type { EsqDaCaseOption } from "./esqDaLinks";
import { modelViewOf, type EsqFamilyView, type EsqFindingSeverity } from "./esqModel";
import { runLogicOf } from "./esqResults";
import type { EsqSolveWindowKind } from "./esqSolve";

type EsqSensitivityWindowKind = "esqSensEntry" | "esqSensCase" | "esqSensPreOp";

type EsqRegisterOrigin = "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "HS" | "ESQ";

interface EsqSensitivityFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqSensitivityWindowKind | EsqSolveWindowKind; id: string };
}

interface EsqRegisterEntry {
  id: string;
  origin: EsqRegisterOrigin;
  kind: EsqRegisterKind;
  text: string;
  impact: string;
  ref?: string;
  daRef?: { workbookId: string; sourceId: string };
  upstreamKey: boolean;
  manual: boolean;
  decision?: EsqRegisterDecision;
}

interface EsqPreOpEntry {
  id: string;
  origin: EsqRegisterOrigin;
  text: string;
  limitation: string;
  closure: string;
  upstreamStatus?: "OPEN" | "IN_PROGRESS" | "CLOSED";
  riskImpact?: ImportanceLevel;
  manual: boolean;
  decision?: EsqPreOperationalDecision;
}

interface EsqCaseView {
  entry: EsqSensitivityCase;
  targetLabel: string;
  problem?: string;
  kept: string[];
  stale: boolean;
}

interface EsqCaseResultRow {
  caseId: string;
  name: string;
  values: Map<string, number>;
  total?: number;
}

interface EsqSensitivityView {
  model: EsqModel;
  work: EsqSensitivityWork;
  families: EsqFamilyView[];
  releaseIds: string[];
  base: Map<string, number>;
  baseTotal: number;
  register: EsqRegisterEntry[];
  orphanDecisions: EsqRegisterDecision[];
  cases: EsqCaseView[];
  results: EsqCaseResultRow[];
  preOperational: EsqPreOpEntry[];
  run?: EsqSolveRun;
  findings: EsqSensitivityFinding[];
}

interface EsqCaseRunRequest {
  logic: EsqEventTreeRunLogic;
  calculation: EsqModelCalculation;
  cutSets?: EventTreeCutSetSettings;
}

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const ORIGINS: readonly EsqRegisterOrigin[] = ["POS", "IE", "ES", "SC", "SY", "HR", "DA", "HS", "ESQ"];

const REGISTER_KIND_LABELS: Record<EsqRegisterKind, string> = { SOURCE: "Uncertainty source", ASSUMPTION: "Assumption", ALTERNATIVE: "Alternative" };

const CASE_KIND_LABELS: Record<EsqCaseKind, string> = {
  PARAMETER: "DA parameter value",
  CCF_TOTAL: "Common cause group total",
  HEP: "HEP value",
  EVENT: "Basic event probability",
  GROUP_FAILED: "Group failed (events set TRUE)",
  FLAG: "Flag state",
  LOGIC: "Logic alternative",
  HEP_95TH: "Every HEP at its 95th percentile",
};

const CASE_KINDS: readonly EsqCaseKind[] = ["PARAMETER", "CCF_TOTAL", "HEP", "EVENT", "GROUP_FAILED", "FLAG", "LOGIC", "HEP_95TH"];

const STATUS_LABELS: Record<"OPEN" | "IN_PROGRESS" | "CLOSED", string> = { OPEN: "Open", IN_PROGRESS: "In progress", CLOSED: "Closed" };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function withSensitivityWork(esq: EventSequenceQuantification, fn: (work: EsqSensitivityWork) => EsqSensitivityWork): EventSequenceQuantification {
  return { ...esq, sensitivityWork: fn(sensitivityWorkOf(esq)) };
}

function documentationEntries(origin: EsqRegisterOrigin, doc: BaseModelUncertaintyDocumentation | undefined): EsqRegisterEntry[] {
  if (doc === undefined) return [];
  const entry = (kind: EsqRegisterKind, text: string, impact: string): EsqRegisterEntry => ({ id: registerEntryId(origin, kind, text), origin, kind, text, impact, upstreamKey: false, manual: false });
  return [
    ...(doc.uncertaintySources ?? []).filter((item) => !blank(item.source)).map((item) => entry("SOURCE", item.source, item.impact)),
    ...(doc.relatedAssumptions ?? []).filter((item) => !blank(item.assumption)).map((item) => entry("ASSUMPTION", item.assumption, item.basis)),
    ...(doc.reasonableAlternatives ?? []).filter((item) => !blank(item.alternative)).map((item) => entry("ALTERNATIVE", item.alternative, item.reasonNotSelected)),
  ];
}

function registerEntries(esq: EventSequenceQuantification, upstream: EsqUpstream): EsqRegisterEntry[] {
  const entries: EsqRegisterEntry[] = [
    ...documentationEntries("POS", upstream.pos?.modelUncertainty),
    ...documentationEntries("IE", upstream.ie?.modelUncertainty),
    ...documentationEntries("ES", upstream.es?.modelUncertainty),
    ...documentationEntries("SC", upstream.sc?.modelUncertainty),
    ...documentationEntries("SY", upstream.sy?.modelUncertainty),
    ...documentationEntries("HR", upstream.hr?.modelUncertainty),
    ...documentationEntries("ESQ", esq.modelUncertainty),
  ];
  for (const analysis of upstream.sy?.uncertaintyAnalyses ?? []) {
    const add = (id: string, text: string, impact: string): void => {
      if (blank(text)) return;
      entries.push({ id: `SY:SOURCE:${id}`, origin: "SY", kind: "SOURCE", text, impact, ref: id, upstreamKey: false, manual: false });
    };
    for (const item of analysis.modelUncertainties) add(item.uncertaintyId, item.description, item.impact);
    for (const item of analysis.ccfUncertainties ?? []) add(item.uncertaintyId, item.description, item.impact);
    for (const item of analysis.dependencyUncertainties ?? []) add(item.uncertaintyId, item.description, item.impact);
    for (const item of analysis.successCriteriaUncertainties ?? []) add(`${analysis.uuid}:${item.criterionId}`, item.description, item.impact);
  }
  const daId = esq.linkedWorkbooks?.DA;
  for (const source of upstream.da?.uncertaintyRegister ?? []) {
    const entry: EsqRegisterEntry = { id: `DA:SOURCE:${source.id}`, origin: "DA", kind: "SOURCE", text: source.source, impact: source.impact, ref: source.id, upstreamKey: source.key, manual: false };
    if (daId !== undefined) entry.daRef = { workbookId: daId, sourceId: source.id };
    entries.push(entry);
  }
  for (const uncertainty of upstream.hs?.uncertainties ?? []) {
    const ref = blank(uncertainty.code) ? uncertainty.uuid : uncertainty.code;
    entries.push({ id: `HS:SOURCE:${ref}`, origin: "HS", kind: "SOURCE", text: blank(uncertainty.name) ? uncertainty.description : uncertainty.name, impact: uncertainty.potentialImpact, ref, upstreamKey: uncertainty.importance === "HIGH", manual: false });
    for (const alternative of uncertainty.reasonableAlternatives) {
      if (blank(alternative)) continue;
      entries.push({ id: registerEntryId("HS", "ALTERNATIVE", `${ref}|${alternative}`), origin: "HS", kind: "ALTERNATIVE", text: alternative, impact: `Alternative to ${ref}.`, ref, upstreamKey: false, manual: false });
    }
  }
  for (const manual of sensitivityWorkOf(esq).manual ?? []) {
    entries.push({ id: manual.id, origin: "ESQ", kind: manual.kind, text: manual.text, impact: manual.impact, upstreamKey: false, manual: true });
  }
  const decisions = new Map((sensitivityWorkOf(esq).decisions ?? []).map((decision) => [decision.id, decision]));
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    if (seen.has(entry.id)) return [];
    seen.add(entry.id);
    const decision = decisions.get(entry.id);
    return [decision === undefined ? entry : { ...entry, decision }];
  });
}

function assumptionEntry(origin: EsqRegisterOrigin, item: PreOperationalAssumption): EsqPreOpEntry {
  const closure = item.plannedClosureActions.length > 0 ? item.plannedClosureActions.join("; ") : item.resolutionPlan ?? item.closureBasis;
  return {
    id: `${origin}:${blank(item.assumptionId) ? item.uuid : item.assumptionId}`,
    origin,
    text: item.description,
    limitation: item.limitations.join("; "),
    closure,
    upstreamStatus: item.status,
    riskImpact: item.riskImpact,
    manual: false,
  };
}

function preOperationalEntries(esq: EventSequenceQuantification, upstream: EsqUpstream): EsqPreOpEntry[] {
  const out: EsqPreOpEntry[] = [];
  const add = (origin: EsqRegisterOrigin, items: readonly PreOperationalAssumption[] | undefined): void => {
    for (const item of items ?? []) out.push(assumptionEntry(origin, item));
  };
  const pos = upstream.pos;
  add("POS", pos?.preOperationalAssumptions);
  for (const state of pos?.plantOperatingStates ?? []) add("POS", state.preOperationalAssumptions);
  for (const evolution of pos?.plantEvolutions ?? []) add("POS", evolution.preOperationalAssumptions);
  for (const group of pos?.plantOperatingStateGroups ?? []) add("POS", group.preOperationalAssumptions);
  add("IE", upstream.ie?.preOperationalAssumptions);
  for (const initiator of upstream.ie?.initiators ?? []) add("IE", initiator.preOperationalAssumptions);
  add("ES", upstream.es?.preOperationalAssumptions);
  for (const sequence of upstream.es?.eventSequences ?? []) add("ES", sequence.sequenceSpecificAssumptions);
  for (const family of upstream.es?.eventSequenceFamilies ?? []) add("ES", family.familySpecificAssumptions);
  add("SC", upstream.sc?.preOperationalAssumptions);
  add("SY", upstream.sy?.preOperationalAssumptions);
  add("HR", upstream.hr?.preOperationalAssumptions);
  add("DA", upstream.da?.preOperationalAssumptions);
  for (const item of upstream.hs?.preOperationalAssumptions ?? []) {
    out.push({ id: `HS:${blank(item.code) ? item.uuid : item.code}`, origin: "HS", text: blank(item.name) ? item.description : item.name, limitation: item.limitation, closure: item.closureAction, upstreamStatus: item.closureStatus, manual: false });
  }
  for (const cell of esq.barrierWork?.cells ?? []) {
    if (cell.assumption === undefined) continue;
    out.push({ id: `ESQ:CELL:${cell.id}`, origin: "ESQ", text: `Cell ${cell.id} rests on ${cell.assumption.calculation}`, limitation: "A design calculation stands in for a test (ESQ-C17).", closure: cell.assumption.closure, manual: false });
  }
  for (const manual of sensitivityWorkOf(esq).manualPreOperational ?? []) {
    out.push({ id: manual.id, origin: "ESQ", text: manual.text, limitation: manual.limitation, closure: "", manual: true });
  }
  const decisions = new Map((sensitivityWorkOf(esq).preOperational ?? []).map((decision) => [decision.id, decision]));
  const seen = new Set<string>();
  return out.flatMap((entry) => {
    if (seen.has(entry.id)) return [];
    seen.add(entry.id);
    const decision = decisions.get(entry.id);
    return [decision === undefined ? entry : { ...entry, decision }];
  });
}

function caseTargetLabel(esq: EventSequenceQuantification, entry: EsqSensitivityCase): string {
  const model = esq.model;
  const target = entry.target;
  if (entry.kind === "HEP_95TH") return "Every HFE and recovery";
  if (entry.kind === "LOGIC") return "Run logic";
  if (target === undefined || model === undefined) return "—";
  switch (entry.kind) {
    case "PARAMETER": {
      const parameter = model.parameters.find((candidate) => candidate.id === target);
      return parameter === undefined ? target : `${parameter.name} (${target})`;
    }
    case "CCF_TOTAL": {
      const group = model.ccfGroups.find((candidate) => candidate.id === target);
      return group === undefined ? target : `${group.name} (${target})`;
    }
    case "HEP": {
      const human = model.humanEvents.find((candidate) => candidate.id === target);
      return human === undefined ? target : `${human.name} (${target})`;
    }
    case "EVENT": {
      const event = model.events.find((candidate) => candidate.id === target);
      return event === undefined ? target : event.code;
    }
    case "GROUP_FAILED": return importanceGroupsOf(esq).find((group) => group.key === target)?.label ?? target;
    case "FLAG": return esq.logic?.flags?.find((flag) => flag.id === target)?.name ?? target;
  }
}

function caseViews(esq: EventSequenceQuantification): EsqCaseView[] {
  return (sensitivityWorkOf(esq).cases ?? []).map((entry) => {
    const applied = applySensitivityCase(esq, entry);
    const view: EsqCaseView = {
      entry,
      targetLabel: caseTargetLabel(esq, entry),
      kept: applied.kept,
      stale: entry.run !== undefined && entry.run.inputs !== caseInputsKey(esq, entry.id),
    };
    if (applied.problem !== undefined) view.problem = applied.problem;
    return view;
  });
}

function baseValues(esq: EventSequenceQuantification): Map<string, number> {
  const values = new Map<string, number>();
  for (const entry of solveWorkOf(esq).families) {
    const value = entry.run?.annualFrequency;
    if (value !== undefined) values.set(entry.familyId, value);
  }
  return values;
}

function caseRunRequest(run: EsqSolveRun): EsqCaseRunRequest | undefined {
  const logic = runLogicOf(run);
  if (run.calculation === "EXACT") return { logic, calculation: "EXACT" };
  if (run.basis === undefined || run.quantifier === undefined || run.cutOffs === undefined || run.cutOffs.length === 0) return undefined;
  const cutSets: EventTreeCutSetSettings = { basis: run.basis, cutOffs: [...run.cutOffs], quantifier: run.quantifier, keep: 1 };
  if (run.limitOrder !== undefined) cutSets.limitOrder = run.limitOrder;
  return { logic, calculation: "CUT_SETS", cutSets };
}

function caseRunProblem(summary: EsqModelRunResult, esq: EventSequenceQuantification, caseId: string): string | undefined {
  const failed = summary.trees.filter((tree) => tree.status === "FAILED").length;
  if (failed > 0) return `${failed} of ${summary.trees.length} event trees failed. Fix them and run again.`;
  if (summary.inputs !== caseInputsKey(esq, caseId)) return "The model or the case changed during the run. Run again.";
  return undefined;
}

function withCaseRun(esq: EventSequenceQuantification, caseId: string, summary: EsqModelRunResult): EventSequenceQuantification {
  return withSensitivityWork(esq, (work) => ({
    ...work,
    cases: (work.cases ?? []).map((entry) => (entry.id !== caseId ? entry : {
      ...entry,
      run: { runId: summary.runId, at: summary.completedAt, inputs: summary.inputs, families: summary.families.map((family) => ({ familyId: family.familyId, annualFrequency: family.annualFrequency })) },
    })),
  }));
}

function withCase(esq: EventSequenceQuantification, caseId: string, next: EsqSensitivityCase | undefined): EventSequenceQuantification {
  return withSensitivityWork(esq, (work) => {
    const list = work.cases ?? [];
    if (next === undefined) return { ...work, cases: list.filter((entry) => entry.id !== caseId) };
    const definitionChanged = (prior: EsqSensitivityCase): boolean => JSON.stringify([prior.kind, prior.target, prior.value, prior.factor, prior.state, prior.logic]) !== JSON.stringify([next.kind, next.target, next.value, next.factor, next.state, next.logic]);
    const index = list.findIndex((entry) => entry.id === caseId);
    if (index < 0) return { ...work, cases: [...list, next] };
    return {
      ...work,
      cases: list.map((entry, position) => {
        if (position !== index) return entry;
        if (!definitionChanged(entry) || next.run === undefined) return next;
        const { run: _old, ...rest } = next;
        return rest;
      }),
    };
  });
}

function nextCaseId(esq: EventSequenceQuantification): string {
  const taken = new Set((sensitivityWorkOf(esq).cases ?? []).map((entry) => entry.id));
  let n = taken.size + 1;
  while (taken.has(`SC-${n}`)) n += 1;
  return `SC-${n}`;
}

function withDecision(esq: EventSequenceQuantification, id: string, decision: EsqRegisterDecision | undefined): EventSequenceQuantification {
  return withSensitivityWork(esq, (work) => {
    const others = (work.decisions ?? []).filter((entry) => entry.id !== id);
    return { ...work, decisions: decision === undefined ? others : [...others, decision] };
  });
}

function withManualEntry(esq: EventSequenceQuantification, entry: EsqManualRegisterEntry, remove = false): EventSequenceQuantification {
  return withSensitivityWork(esq, (work) => {
    const list = work.manual ?? [];
    const index = list.findIndex((item) => item.id === entry.id);
    const manual = remove ? list.filter((item) => item.id !== entry.id) : index < 0 ? [...list, entry] : list.map((item) => (item.id === entry.id ? entry : item));
    const decisions = remove ? (work.decisions ?? []).filter((item) => item.id !== entry.id) : work.decisions;
    return { ...work, manual, ...(decisions === undefined ? {} : { decisions }) };
  });
}

function nextManualId(esq: EventSequenceQuantification): string {
  const taken = new Set((sensitivityWorkOf(esq).manual ?? []).map((entry) => entry.id));
  let n = taken.size + 1;
  while (taken.has(`ESQ-MU-${n}`)) n += 1;
  return `ESQ-MU-${n}`;
}

function withPreOperational(esq: EventSequenceQuantification, id: string, decision: EsqPreOperationalDecision | undefined): EventSequenceQuantification {
  return withSensitivityWork(esq, (work) => {
    const others = (work.preOperational ?? []).filter((entry) => entry.id !== id);
    return { ...work, preOperational: decision === undefined ? others : [...others, decision] };
  });
}

function withManualPreOperational(esq: EventSequenceQuantification, entry: EsqManualPreOperational, remove = false): EventSequenceQuantification {
  return withSensitivityWork(esq, (work) => {
    const list = work.manualPreOperational ?? [];
    const index = list.findIndex((item) => item.id === entry.id);
    const manualPreOperational = remove ? list.filter((item) => item.id !== entry.id) : index < 0 ? [...list, entry] : list.map((item) => (item.id === entry.id ? entry : item));
    const preOperational = remove ? (work.preOperational ?? []).filter((item) => item.id !== entry.id) : work.preOperational;
    return { ...work, manualPreOperational, ...(preOperational === undefined ? {} : { preOperational }) };
  });
}

function nextManualPreOpId(esq: EventSequenceQuantification): string {
  const taken = new Set((sensitivityWorkOf(esq).manualPreOperational ?? []).map((entry) => entry.id));
  let n = taken.size + 1;
  while (taken.has(`ESQ-PA-${n}`)) n += 1;
  return `ESQ-PA-${n}`;
}

function withImportedDaCases(esq: EventSequenceQuantification, options: readonly EsqDaCaseOption[]): EventSequenceQuantification {
  const model = esq.model;
  if (model === undefined) return esq;
  return withSensitivityWork(esq, (work) => {
    const cases = [...(work.cases ?? [])];
    const taken = new Set(cases.map((entry) => entry.id));
    const push = (entry: EsqSensitivityCase): void => {
      if (taken.has(entry.id)) return;
      taken.add(entry.id);
      cases.push(entry);
    };
    for (const option of options) {
      const item = option.item;
      const daCaseRef = { workbookId: option.workbookId, caseId: item.id };
      if (option.low === undefined || option.high === undefined) continue;
      if (item.kind === "TESTING") {
        const group = model.ccfGroups.find((candidate) => candidate.estimateRef === item.estimateId);
        const base = option.base;
        if (group === undefined || base === undefined || !(base > 0)) continue;
        push({ id: `${item.id}-LOW`, name: `${item.name} · low`, kind: "CCF_TOTAL", target: group.id, factor: option.low / base, basis: `${item.reason} The group total scales by DA's all-members ratio.`, daCaseRef });
        push({ id: `${item.id}-HIGH`, name: `${item.name} · high`, kind: "CCF_TOTAL", target: group.id, factor: option.high / base, basis: `${item.reason} The group total scales by DA's all-members ratio.`, daCaseRef });
        continue;
      }
      const parameterId = item.parameterId;
      if (parameterId === undefined || !model.parameters.some((parameter) => parameter.id === parameterId)) continue;
      push({ id: `${item.id}-LOW`, name: `${item.name} · low`, kind: "PARAMETER", target: parameterId, value: option.low, basis: item.reason, daCaseRef });
      push({ id: `${item.id}-HIGH`, name: `${item.name} · high`, kind: "PARAMETER", target: parameterId, value: option.high, basis: item.reason, daCaseRef });
    }
    return { ...work, cases };
  });
}

function registerFindings(view: Omit<EsqSensitivityView, "findings">): EsqSensitivityFinding[] {
  const findings: EsqSensitivityFinding[] = [];
  const caseIds = new Set(view.cases.map((entry) => entry.entry.id));
  const unscreened = view.register.filter((entry) => entry.decision === undefined);
  if (unscreened.length > 0) {
    findings.push({ severity: "warning", check: "Register entries not screened", item: `${unscreened.length} entries`, detail: "Mark the families each entry could move and whether it is a key source (ESQ-E1)." });
  }
  for (const entry of view.register) {
    const target = { kind: "esqSensEntry" as const, id: entry.id };
    const item = entry.ref ?? `${entry.origin} ${REGISTER_KIND_LABELS[entry.kind].toLowerCase()}`;
    const decision = entry.decision;
    const key = decision?.key ?? entry.upstreamKey;
    const linked = (decision?.caseIds ?? []).filter((caseId) => caseIds.has(caseId));
    if (key && linked.length === 0 && blank(decision?.reason)) findings.push({ severity: "error", check: "Key source with no case and no reason", item, detail: "Link a sensitivity case, or record why none is needed (ESQ-E1, ESQ-F3).", target });
    if (decision !== undefined && decision.familyIds.length === 0 && blank(decision.reason)) findings.push({ severity: "warning", check: "Source with no affected family", item, detail: "Mark the families this entry could move, or record why it moves none.", target });
    if (decision !== undefined && decision.caseIds.length > linked.length) findings.push({ severity: "warning", check: "Linked case removed", item, detail: "A case linked to this entry no longer exists.", target });
    if (entry.manual && blank(entry.text)) findings.push({ severity: "error", check: "Empty entry", item: entry.id, detail: "Describe the uncertainty source or assumption.", target });
  }
  for (const decision of view.orphanDecisions) {
    findings.push({ severity: "note", check: "Entry no longer upstream", item: decision.id, detail: "The element that held this entry no longer lists it. Its decision is kept until you remove it." });
  }
  return findings;
}

function caseFindings(view: Omit<EsqSensitivityView, "findings">): EsqSensitivityFinding[] {
  const findings: EsqSensitivityFinding[] = [];
  if (view.cases.length === 0) {
    findings.push({ severity: "warning", check: "No sensitivity case", item: "Cases", detail: "Turn the key sources into cases and run them beside the base case (ESQ-E1)." });
    return findings;
  }
  for (const entry of view.cases) {
    const target = { kind: "esqSensCase" as const, id: entry.entry.id };
    const item = `${entry.entry.id} · ${entry.entry.name}`;
    if (entry.problem !== undefined) {
      findings.push({ severity: "error", check: "Case cannot run", item, detail: entry.problem, target });
      continue;
    }
    if (entry.entry.run === undefined) findings.push({ severity: "warning", check: "Case not run", item, detail: "Run the case to see how far it moves each family.", target });
    else if (entry.stale) findings.push({ severity: "error", check: "Case result older than its inputs", item, detail: "The model or the case changed after the run. Run it again.", target });
    if (blank(entry.entry.basis)) findings.push({ severity: "warning", check: "Case without a basis", item, detail: "Record why the case uses these values.", target });
    if (entry.kept.length > 0) findings.push({ severity: "note", check: "Some HEPs kept", item, detail: `${entry.kept.length} HFEs or recoveries have no distribution, so they stay at their point values in this case.`, target });
  }
  return findings;
}

function preOperationalFindings(view: Omit<EsqSensitivityView, "findings">): EsqSensitivityFinding[] {
  const findings: EsqSensitivityFinding[] = [];
  const undecided = view.preOperational.filter((entry) => entry.decision?.status === undefined);
  if (undecided.length > 0) findings.push({ severity: "warning", check: "Pre-operational assumptions not tracked", item: `${undecided.length} assumptions`, detail: "Set the status of each assumption that must close before operation (ESQ-C17, ESQ-F5)." });
  for (const entry of view.preOperational) {
    const target = { kind: "esqSensPreOp" as const, id: entry.id };
    if (entry.decision?.status === "CLOSED" && blank(entry.decision.closure)) findings.push({ severity: "error", check: "Closed without a closure", item: entry.id, detail: "Record how the assumption was closed.", target });
    if (entry.manual && blank(entry.text)) findings.push({ severity: "error", check: "Empty assumption", item: entry.id, detail: "Describe the assumption.", target });
  }
  return findings;
}

function sensitivityViewOf(esq: EventSequenceQuantification, upstream: EsqUpstream): EsqSensitivityView | undefined {
  const modelView = modelViewOf(esq);
  if (modelView === undefined) return undefined;
  const work = sensitivityWorkOf(esq);
  const register = registerEntries(esq, upstream);
  const known = new Set(register.map((entry) => entry.id));
  const releaseIds = modelView.families.filter((family) => family.release).map((family) => family.id);
  const base = baseValues(esq);
  const cases = caseViews(esq);
  const results = cases.flatMap((entry): EsqCaseResultRow[] => {
    const run = entry.entry.run;
    if (run === undefined) return [];
    const values = new Map(run.families.map((family) => [family.familyId, family.annualFrequency]));
    const row: EsqCaseResultRow = { caseId: entry.entry.id, name: entry.entry.name, values };
    if (releaseIds.length > 0) row.total = releaseIds.reduce((sum, id) => sum + (values.get(id) ?? 0), 0);
    return [row];
  });
  const solveRun = solveWorkOf(esq).run;
  const partial: Omit<EsqSensitivityView, "findings"> = {
    model: modelView.model,
    work,
    families: modelView.families,
    releaseIds,
    base,
    baseTotal: releaseIds.reduce((sum, id) => sum + (base.get(id) ?? 0), 0),
    register,
    orphanDecisions: (work.decisions ?? []).filter((decision) => !known.has(decision.id)),
    cases,
    results,
    preOperational: preOperationalEntries(esq, upstream),
  };
  const full = solveRun === undefined ? partial : { ...partial, run: solveRun };
  const findings = [...registerFindings(full), ...caseFindings(full), ...preOperationalFindings(full)];
  if (solveRun === undefined) findings.push({ severity: "error", check: "No run of record", item: "Run of record", detail: "Run the model in Step 05 and use the run. Each case is compared with it." });
  return { ...full, findings: findings.sort((a, b) => FINDING_RANK[a.severity] - FINDING_RANK[b.severity]) };
}

function sensitivityComplete(esq: EventSequenceQuantification, upstream: EsqUpstream): boolean {
  const view = sensitivityViewOf(esq, upstream);
  return view !== undefined && view.cases.some((entry) => entry.entry.run !== undefined) && !view.findings.some((finding) => finding.severity === "error");
}

export {
  CASE_KINDS,
  CASE_KIND_LABELS,
  ORIGINS,
  REGISTER_KIND_LABELS,
  STATUS_LABELS,
  caseRunProblem,
  caseRunRequest,
  caseTargetLabel,
  nextCaseId,
  nextManualId,
  nextManualPreOpId,
  preOperationalEntries,
  registerEntries,
  sensitivityComplete,
  sensitivityViewOf,
  withCase,
  withCaseRun,
  withDecision,
  withImportedDaCases,
  withManualEntry,
  withManualPreOperational,
  withPreOperational,
  type EsqCaseResultRow,
  type EsqCaseRunRequest,
  type EsqCaseView,
  type EsqPreOpEntry,
  type EsqRegisterEntry,
  type EsqRegisterOrigin,
  type EsqSensitivityFinding,
  type EsqSensitivityView,
  type EsqSensitivityWindowKind,
};
