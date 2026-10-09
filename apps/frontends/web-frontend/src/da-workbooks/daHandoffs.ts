import { isComponentModel, type DataAnalysis, type DataAnalysisParameter, type CcfParameterEstimation } from "interfaces-mef-types/da/data-analysis";
import { canonicalJson, expressionReferences, type CcfFactorModel, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { carriesUncertainExpression, type CommonCauseFailureGroup, type SystemBasicEvent } from "interfaces-mef-types/sy/systems-analysis";
import type { InitiatingEventGroup } from "interfaces-mef-types/ie/initiating-event-analysis";
import { uncertaintyVersion } from "../newly-developed-methods/shared/useUncertainty";
import { parameterPoint, readyNumber } from "./daLaws";
import type { ImportanceMeasureEntry } from "interfaces-mef-types/esq/event-sequence-quantification";
import { sensitivityResult } from "./daUncertainty";
import type { DaUpstream } from "./daWorkbookContext";
import type { DaFindingSeverity, DaNeedFinding } from "./daSelectors";

const RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const FV_SIGNIFICANT = 0.005;

const RAW_SIGNIFICANT = 2;

const PROBABILITY_TYPES: ReadonlySet<string> = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);

const GENERIC_EVIDENCE: ReadonlySet<string> = new Set(["GENERIC_NUCLEAR", "ANALOGOUS_INDUSTRY", "ENGINEERING_MODEL"]);

type DaHandoffElement = "SY" | "IE" | "HRA" | "POS" | "ESQ";

type DaHandoffStatus = "IN_STEP" | "CHANGED" | "TYPED" | "UNITS" | "MISSING" | "NOT_IMPORTED";

interface DaHandoffRow {
  element: DaHandoffElement;
  id: string;
  code: string;
  name: string;
  holder: "TYPED" | "DA";
  target?: string;
  daValue?: number;
  consumerValue?: number;
  daExpression?: UncertainExpression;
  consumerExpression?: UncertainExpression;
  daFactors?: CcfFactorModel;
  consumerFactors?: CcfFactorModel;
  unit: string;
  status: DaHandoffStatus;
  detail?: string;
}

interface DaImportanceRow {
  id: string;
  name: string;
  kind: "PARAMETER" | "ESTIMATE";
  fussellVesely?: number;
  riskAchievementWorth?: number;
  esqSignificant: boolean;
  daSignificant: boolean;
  generic: boolean;
  entries: string[];
}

interface DaHandoffView {
  rows: DaHandoffRow[];
  importance: DaImportanceRow[];
}

const viewCache = new WeakMap<DataAnalysis, WeakMap<DaUpstream, { version: number; view: DaHandoffView }>>();

const findingCache = new WeakMap<DataAnalysis, WeakMap<DaUpstream, { version: number; findings: DaNeedFinding[] }>>();

function pointOf(parameter: DataAnalysisParameter): number | undefined {
  return readyNumber(parameterPoint(parameter));
}

function same(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a === b || Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

function unitOf(parameter: DataAnalysisParameter): string {
  if (parameter.parameterType === "FREQUENCY") return "per year";
  if (parameter.parameterType === "FAILURE_RATE") return "per hour";
  return "probability";
}

function componentRow(da: DataAnalysis, event: SystemBasicEvent, self: string | undefined): DaHandoffRow {
  const base = { element: "SY" as const, id: event.uuid, code: event.code ?? event.uuid, name: event.name, consumerExpression: event.expression };
  const expression = event.expression;
  const ours = (expression === undefined ? [] : expressionReferences(expression)).filter((reference) => self === undefined || reference.workbookId.trim() === self.trim());
  const first = ours[0];
  if (first === undefined) return { ...base, holder: "TYPED", unit: "estimate", status: "TYPED", detail: expression === undefined ? "SY holds no estimate for this event yet." : undefined };
  const parameter = da.parameters.find((candidate) => candidate.uuid === first.entityId.trim());
  if (parameter === undefined) return { ...base, holder: "DA", target: first.entityId, unit: "estimate", status: "MISSING", detail: `${first.entityId} is not in this workbook.` };
  const row = { ...base, holder: "DA" as const, target: parameter.uuid, daValue: pointOf(parameter), daExpression: parameter.estimate, unit: unitOf(parameter) };
  if (!isComponentModel(parameter.quantificationModel)) return { ...row, status: "UNITS", detail: `${parameter.uuid} is not a component estimate.` };
  if (parameter.estimate === undefined) return { ...row, status: "MISSING", detail: `${parameter.uuid} has no estimate yet.` };
  return { ...row, status: "IN_STEP" };
}

function syRow(da: DataAnalysis, event: SystemBasicEvent, hfeIds: ReadonlySet<string>, self: string | undefined): DaHandoffRow | undefined {
  if (carriesUncertainExpression(event.failureMode)) return componentRow(da, event, self);
  const link = event.controlledDataSource;
  const legacy = event.dataAnalysisBasicEventRef;
  if (link?.referenceType === "HUMAN_FAILURE_EVENT" || (link === undefined && legacy !== undefined && hfeIds.has(legacy))) return undefined;
  const targetId = link === undefined ? legacy : link.entityId;
  const basis = event.quantificationBasis;
  const rate = basis?.kind === "FAILURE_RATE" ? basis.failureRate : undefined;
  const cached = rate === undefined ? event.probability : rate.value;
  const cachedUnit = rate === undefined ? "probability" : `per ${rate.unit.toLowerCase()}`;
  const base = { element: "SY" as const, id: event.uuid, code: event.code ?? event.uuid, name: event.name };
  if (targetId === undefined) return { ...base, holder: "TYPED", consumerValue: cached, unit: cachedUnit, status: "TYPED" };
  const parameter = da.parameters.find((candidate) => candidate.uuid === targetId);
  if (parameter === undefined) return { ...base, holder: "DA", target: targetId, consumerValue: cached, unit: cachedUnit, status: "MISSING", detail: `${targetId} is not in this workbook.` };
  const unit = unitOf(parameter);
  const row = { ...base, holder: "DA" as const, target: parameter.uuid, daValue: parameter.value, consumerValue: cached, unit };
  const wantsRate = parameter.parameterType === "FREQUENCY" || parameter.parameterType === "FAILURE_RATE";
  if (wantsRate !== (rate !== undefined)) return { ...row, status: "UNITS", detail: wantsRate ? "SY holds a probability, but the DA parameter is a rate." : "SY holds a rate, but the DA parameter is a probability." };
  if (rate !== undefined) {
    const expected = parameter.parameterType === "FREQUENCY" ? "YEAR" : "HOUR";
    if (rate.unit !== expected) return { ...row, status: "UNITS", detail: `SY reads the rate per ${rate.unit.toLowerCase()}, but DA gives it ${unit}.` };
  }
  if (!PROBABILITY_TYPES.has(parameter.parameterType) && !wantsRate) return { ...row, status: "UNITS", detail: `A ${parameter.parameterType.toLowerCase().split("_").join(" ")} parameter cannot control a basic event.` };
  return { ...row, status: same(parameter.value, cached) ? "IN_STEP" : "CHANGED" };
}

function ccfRow(da: DataAnalysis, group: CommonCauseFailureGroup): DaHandoffRow {
  const base = { element: "SY" as const, id: group.uuid, code: group.uuid, name: group.name, unit: "factors", consumerFactors: group.factors };
  const reference = group.dataAnalysisCCFParameterRef;
  if (reference === undefined) return { ...base, holder: "TYPED", status: "TYPED" };
  const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === reference);
  if (estimate === undefined) return { ...base, holder: "DA", target: reference, status: "MISSING", detail: `${reference} is not in this workbook.` };
  const ours = estimate.factors;
  if (ours === undefined) return { ...base, holder: "DA", target: estimate.uuid, status: "MISSING", detail: `${estimate.uuid} has no factors yet.` };
  const inStep = canonicalJson(ours) === canonicalJson(group.factors);
  return { ...base, holder: "DA", target: estimate.uuid, daFactors: ours, status: inStep ? "IN_STEP" : "CHANGED", detail: inStep ? undefined : "The model or factors differ from the DA estimate." };
}

function frequencyInStep(held: UncertainExpression | undefined, parameterId: string, estimate: UncertainExpression): boolean {
  if (held === undefined) return false;
  if (held.node === "PARAMETER") return held.reference.entityId.trim() === parameterId;
  return canonicalJson(held) === canonicalJson(estimate);
}

function ieRow(da: DataAnalysis, group: InitiatingEventGroup): DaHandoffRow {
  const held = group.frequency?.expression;
  const base = { element: "IE" as const, id: group.uuid, code: group.uuid, name: group.name, consumerExpression: held, unit: "per year" };
  const link = group.controlledDataSource;
  if (link === undefined) {
    const mapped = (da.dataNeeds?.initiators ?? []).find((need) => need.id === group.uuid)?.parameterId;
    const parameter = mapped === undefined ? undefined : da.parameters.find((candidate) => candidate.uuid === mapped);
    return { ...base, holder: "TYPED", target: parameter?.uuid, daExpression: parameter?.valueMode === "LINKED" ? undefined : parameter?.estimate, status: "TYPED" };
  }
  const parameter = da.parameters.find((candidate) => candidate.uuid === link.entityId);
  if (parameter === undefined) return { ...base, holder: "DA", target: link.entityId, status: "MISSING", detail: `${link.entityId} is not in this workbook.` };
  if (parameter.quantificationModel !== "FREQUENCY") return { ...base, holder: "DA", target: parameter.uuid, status: "UNITS", detail: "IE imports a parameter that is not a frequency." };
  const estimate = parameter.estimate;
  if (estimate === undefined) return { ...base, holder: "DA", target: parameter.uuid, status: "MISSING", detail: `${parameter.uuid} has no estimate yet.` };
  const inStep = frequencyInStep(held, parameter.uuid, estimate);
  return { ...base, holder: "DA", target: parameter.uuid, daExpression: estimate, status: inStep ? "IN_STEP" : "CHANGED", detail: inStep ? undefined : "IE holds another frequency than the DA estimate." };
}

function frequencyValue(value: number | { value: number } | undefined): number | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? value : value.value;
}

function buildRows(da: DataAnalysis, upstream: DaUpstream): DaHandoffRow[] {
  const rows: DaHandoffRow[] = [];
  const sy = upstream.sy;
  if (sy !== undefined) {
    const hfeIds = new Set((upstream.hr?.humanFailureEvents ?? []).map((event) => event.uuid));
    for (const event of sy.systemBasicEvents) {
      const row = syRow(da, event, hfeIds, upstream.workbookId);
      if (row !== undefined) rows.push(row);
    }
    for (const group of sy.commonCauseFailureGroups) rows.push(ccfRow(da, group));
  }
  const ie = upstream.ie;
  if (ie !== undefined) {
    for (const group of ie.initiatingEventGroups) rows.push(ieRow(da, group));
  }
  const hr = upstream.hr;
  if (hr !== undefined) {
    for (const quantification of hr.hepQuantifications) {
      const cached = quantification.meanHep ?? quantification.pointEstimateHep;
      const base = { element: "HRA" as const, id: quantification.uuid, code: quantification.uuid, name: quantification.hfeId, consumerValue: cached, unit: "probability" };
      const link = quantification.controlledDataSource;
      if (link === undefined) {
        rows.push({ ...base, holder: "TYPED", status: "TYPED" });
        continue;
      }
      const parameter = da.parameters.find((candidate) => candidate.uuid === link.entityId);
      if (parameter === undefined) rows.push({ ...base, holder: "DA", target: link.entityId, status: "MISSING", detail: `${link.entityId} is not in this workbook.` });
      else if (!PROBABILITY_TYPES.has(parameter.parameterType)) rows.push({ ...base, holder: "DA", target: parameter.uuid, daValue: parameter.value, status: "UNITS", detail: "HR imports a parameter that is not a probability." });
      else rows.push({ ...base, holder: "DA", target: parameter.uuid, daValue: parameter.value, status: same(parameter.value, cached) ? "IN_STEP" : "CHANGED" });
    }
  }
  const pos = upstream.pos;
  if (pos !== undefined) {
    for (const state of pos.plantOperatingStates) {
      const base = { element: "POS" as const, id: state.uuid, code: state.uuid, name: state.name, consumerValue: state.meanDurationHours, unit: "hours a year" };
      if (state.outageSource === undefined) {
        rows.push({ ...base, holder: "TYPED", status: "TYPED" });
        continue;
      }
      const outages = (da.outages ?? []).filter((outage) => outage.stateId === state.uuid);
      if (outages.length === 0) {
        rows.push({ ...base, holder: "DA", status: "MISSING", detail: "No DA outage covers this state." });
        continue;
      }
      const hours = outages.reduce((total, outage) => total + outage.hours * outage.perYear, 0);
      const entries = outages.reduce((total, outage) => total + outage.perYear, 0);
      const inStep = same(hours, state.meanDurationHours) && same(entries, frequencyValue(state.meanEntryFrequency));
      rows.push({ ...base, holder: "DA", target: outages.map((outage) => outage.id).join(", "), daValue: hours, status: inStep ? "IN_STEP" : "CHANGED", detail: inStep ? undefined : `DA outages give ${Number(hours.toPrecision(4))} h and ${Number(entries.toPrecision(4))} entries a year.` });
    }
  }
  const esq = upstream.esq;
  if (esq !== undefined) {
    for (const source of da.uncertaintyRegister ?? []) {
      const imported = (esq.modelUncertaintySourceAssessments ?? []).find((assessment) => assessment.dataAnalysisSourceRef?.sourceId === source.id);
      const base = { element: "ESQ" as const, id: source.id, code: source.id, name: source.source, unit: "register entry", target: source.id };
      if (imported === undefined) rows.push({ ...base, holder: "TYPED", status: "NOT_IMPORTED", detail: "ESQ has not imported this register entry." });
      else rows.push({ ...base, holder: "DA", status: imported.uncertaintySource === source.source && imported.effectOnFamilyFrequencies === source.impact ? "IN_STEP" : "CHANGED", detail: imported.uncertaintySource === source.source && imported.effectOnFamilyFrequencies === source.impact ? undefined : "The register entry changed in DA." });
    }
    for (const item of da.sensitivityCases ?? []) {
      const study = (esq.sensitivityStudies ?? []).find((candidate) => candidate.dataAnalysisCaseRef?.caseId === item.id);
      const result = sensitivityResult(da, item);
      const base = { element: "ESQ" as const, id: item.id, code: item.id, name: item.name, unit: result.unit, target: item.id };
      if (study === undefined) {
        rows.push({ ...base, holder: "TYPED", status: "NOT_IMPORTED", detail: "ESQ has not imported this sensitivity case." });
        continue;
      }
      const key = item.parameterId ?? item.estimateId ?? item.id;
      const range = study.parameterRanges[key];
      const inStep = range !== undefined && same(range[0], result.low) && same(range[1], result.high);
      rows.push({ ...base, holder: "DA", status: inStep ? "IN_STEP" : "CHANGED", detail: inStep ? undefined : "The case's range changed in DA." });
    }
  }
  return rows;
}

function measuresByTarget(da: DataAnalysis, upstream: DaUpstream): Map<string, { entries: string[]; fv?: number; raw?: number }> {
  const result = new Map<string, { entries: string[]; fv?: number; raw?: number }>();
  const records = upstream.esq?.importanceAnalyses ?? [];
  const overall = records.filter((record) => record.scope === "OVERALL");
  const used = overall.length > 0 ? overall : records;
  for (const record of used) {
    record.measures.forEach((measure: ImportanceMeasureEntry, index) => {
      const ref = measure.dataAnalysisParameterRef;
      if (ref === undefined) return;
      const entry = result.get(ref) ?? { entries: [] };
      entry.entries.push(`${record.uuid} · ${index + 1}`);
      if (measure.fussellVesely !== undefined) entry.fv = Math.max(entry.fv ?? 0, measure.fussellVesely);
      if (measure.riskAchievementWorth !== undefined) entry.raw = Math.max(entry.raw ?? 0, measure.riskAchievementWorth);
      result.set(ref, entry);
    });
  }
  return result;
}

function significant(fv: number | undefined, raw: number | undefined): boolean {
  return (fv !== undefined && fv > FV_SIGNIFICANT) || (raw !== undefined && raw > RAW_SIGNIFICANT);
}

function importanceRows(da: DataAnalysis, upstream: DaUpstream): DaImportanceRow[] {
  const measures = measuresByTarget(da, upstream);
  const rows: DaImportanceRow[] = [];
  const add = (id: string, name: string, kind: "PARAMETER" | "ESTIMATE", daSignificant: boolean, generic: boolean, typed: { fv?: number; raw?: number } | undefined): void => {
    const read = measures.get(id);
    const fv = read?.fv ?? typed?.fv;
    const raw = read?.raw ?? typed?.raw;
    if (read === undefined && typed === undefined) return;
    rows.push({ id, name, kind, fussellVesely: fv, riskAchievementWorth: raw, esqSignificant: significant(fv, raw), daSignificant, generic, entries: read?.entries ?? [] });
  };
  for (const parameter of da.parameters) {
    const typed = parameter.importance?.from === "TYPED" ? { fv: parameter.importance.fussellVesely, raw: parameter.importance.riskAchievementWorth } : undefined;
    add(parameter.uuid, parameter.name, "PARAMETER", parameter.isRiskSignificant === true, parameter.evidenceKind !== undefined && GENERIC_EVIDENCE.has(parameter.evidenceKind), typed);
  }
  for (const estimate of da.ccfParameterEstimations ?? []) {
    const typed = estimate.importance?.from === "TYPED" ? { fv: estimate.importance.fussellVesely, raw: estimate.importance.riskAchievementWorth } : undefined;
    add(estimate.uuid, estimate.name ?? estimate.ccfGroupReference, "ESTIMATE", estimate.isRiskSignificant === true, estimate.parameterSource === "GENERIC" && (estimate.evidence ?? []).every((item) => !item.included), typed);
  }
  return rows;
}

function handoffView(da: DataAnalysis, upstream: DaUpstream): DaHandoffView {
  let byUpstream = viewCache.get(da);
  if (byUpstream === undefined) {
    byUpstream = new WeakMap();
    viewCache.set(da, byUpstream);
  }
  const version = uncertaintyVersion();
  const cached = byUpstream.get(upstream);
  if (cached !== undefined && cached.version === version) return cached.view;
  const view = { rows: buildRows(da, upstream), importance: importanceRows(da, upstream) };
  byUpstream.set(upstream, { version, view });
  return view;
}

function targetOf(row: DaHandoffRow): { kind: "daParameter" | "daCcfFactors" | "daOutage" | "daUncertaintySource" | "daSensitivity"; id: string } | undefined {
  if (row.target === undefined) return undefined;
  if (row.element === "SY" && row.unit === "factors") return { kind: "daCcfFactors", id: row.target };
  if (row.element === "POS") return undefined;
  if (row.element === "ESQ") return row.unit === "register entry" ? { kind: "daUncertaintySource", id: row.target } : { kind: "daSensitivity", id: row.target };
  return { kind: "daParameter", id: row.target };
}

function handoffFindings(da: DataAnalysis, upstream: DaUpstream): DaNeedFinding[] {
  let byUpstream = findingCache.get(da);
  if (byUpstream === undefined) {
    byUpstream = new WeakMap();
    findingCache.set(da, byUpstream);
  }
  const version = uncertaintyVersion();
  const cached = byUpstream.get(upstream);
  if (cached !== undefined && cached.version === version) return cached.findings;
  const findings: DaNeedFinding[] = [];
  const view = handoffView(da, upstream);
  const ccTwo = da.capabilityCategory !== "CC-I";
  const operating = da.plantStage === "OPERATIONAL";
  for (const row of view.rows) {
    const item = `${row.element} ${row.code}`;
    const target = targetOf(row);
    if (row.status === "UNITS") findings.push({ severity: "error", check: "Units differ", item, detail: row.detail ?? "The units do not match.", target });
    else if (row.status === "MISSING") findings.push({ severity: "error", check: "Parameter missing", item, detail: row.detail ?? "The linked DA item is missing.", target });
    else if (row.status === "CHANGED") findings.push({ severity: "warning", check: "Out of step", item, detail: `${row.detail ?? "The DA value changed."} Apply the DA value in ${row.element === "HRA" ? "HR" : row.element}.`, target });
    else if (row.status === "NOT_IMPORTED") findings.push({ severity: "note", check: "Not imported", item, detail: row.detail ?? "Not imported.", target });
  }
  for (const row of view.importance) {
    const target = { kind: "daImportance" as const, id: row.id };
    if (row.esqSignificant && !row.daSignificant) findings.push({ severity: "warning", check: "Significant in ESQ", item: row.id, detail: `ESQ ranks ${row.id} risk significant (FV above ${FV_SIGNIFICANT} or RAW above ${RAW_SIGNIFICANT}), but DA does not mark it.`, target });
    if (!row.esqSignificant && row.daSignificant && row.entries.length > 0) findings.push({ severity: "note", check: "Not significant in ESQ", item: row.id, detail: `DA marks ${row.id} risk significant, but ESQ ranks it below FV ${FV_SIGNIFICANT} and RAW ${RAW_SIGNIFICANT}.`, target });
    if (ccTwo && row.esqSignificant && row.generic) findings.push({ severity: operating ? "warning" : "note", check: "Generic data", item: row.id, detail: `${row.id} is risk significant but rests on generic data. ${operating ? "Give it a realistic plant estimate in Step 05 (DA-D1)." : "Update it with plant experience once the plant operates (DA-D1)."}`, target });
  }
  const sorted = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => RANK[a.finding.severity] - RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
  byUpstream.set(upstream, { version, findings: sorted });
  return sorted;
}

function handoffsComplete(da: DataAnalysis, upstream: DaUpstream): boolean {
  if (upstream.sy === undefined && upstream.ie === undefined && upstream.hr === undefined && upstream.pos === undefined && upstream.esq === undefined) return false;
  return !handoffFindings(da, upstream).some((finding) => finding.severity === "error");
}

function withImportanceFromEsq(da: DataAnalysis, upstream: DaUpstream, now: string): DataAnalysis {
  const measures = measuresByTarget(da, upstream);
  if (measures.size === 0) return da;
  const parameters = da.parameters.map((parameter): DataAnalysisParameter => {
    const read = measures.get(parameter.uuid);
    if (read === undefined) return parameter;
    return { ...parameter, isRiskSignificant: significant(read.fv, read.raw), importance: { from: "ESQ", fussellVesely: read.fv, riskAchievementWorth: read.raw, entryIds: read.entries, importedAt: now } };
  });
  const estimates = (da.ccfParameterEstimations ?? []).map((estimate): CcfParameterEstimation => {
    const read = measures.get(estimate.uuid);
    if (read === undefined) return estimate;
    return { ...estimate, isRiskSignificant: significant(read.fv, read.raw), importance: { from: "ESQ", fussellVesely: read.fv, riskAchievementWorth: read.raw, entryIds: read.entries, importedAt: now } };
  });
  return { ...da, parameters, ccfParameterEstimations: da.ccfParameterEstimations === undefined ? undefined : estimates };
}

export {
  FV_SIGNIFICANT,
  RAW_SIGNIFICANT,
  handoffFindings,
  handoffView,
  handoffsComplete,
  significant,
  withImportanceFromEsq,
  type DaHandoffElement,
  type DaHandoffRow,
  type DaHandoffStatus,
  type DaImportanceRow,
};
