import type { DataAnalysis, DaSensitivityCase, DaUncertaintySource } from "interfaces-mef-types/da/data-analysis";
import type { EventSequenceQuantification, ModelUncertaintySourceAssessment } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";
import { sensitivityResult } from "../da-workbooks/daUncertainty";

const EXAMPLE_PREFIX = "example-da-";

interface EsqDaLink {
  workbookId: string;
  workbookName: string;
  mef: DataAnalysis;
}

interface EsqDaTarget {
  id: string;
  name: string;
}

interface EsqDaRegisterOption {
  workbookId: string;
  workbookName: string;
  entry: DaUncertaintySource;
}

interface EsqDaCaseOption {
  workbookId: string;
  workbookName: string;
  item: DaSensitivityCase;
  target?: string;
  low?: number;
  high?: number;
}

function byId(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function daTargets(links: readonly EsqDaLink[]): EsqDaTarget[] {
  const targets = new Map<string, EsqDaTarget>();
  links.forEach((link) => {
    link.mef.parameters.forEach((parameter) => {
      if (!targets.has(parameter.uuid)) targets.set(parameter.uuid, { id: parameter.uuid, name: parameter.name });
    });
    (link.mef.ccfParameterEstimations ?? []).forEach((estimate) => {
      if (!targets.has(estimate.uuid)) targets.set(estimate.uuid, { id: estimate.uuid, name: estimate.name ?? estimate.ccfGroupReference });
    });
  });
  return [...targets.values()].sort((left, right) => byId(left.id, right.id));
}

function registerKey(workbookId: string, sourceId: string): string {
  return JSON.stringify([workbookId, sourceId]);
}

function registerOptions(links: readonly EsqDaLink[]): EsqDaRegisterOption[] {
  return links.flatMap((link) => (link.mef.uncertaintyRegister ?? []).map((entry) => ({ workbookId: link.workbookId, workbookName: link.workbookName, entry })));
}

function linkedRegister(assessment: ModelUncertaintySourceAssessment, options: readonly EsqDaRegisterOption[]): EsqDaRegisterOption | undefined {
  const ref = assessment.dataAnalysisSourceRef;
  if (ref === undefined) return undefined;
  return options.find((option) => option.workbookId === ref.workbookId && option.entry.id === ref.sourceId);
}

function registerDiffers(assessment: ModelUncertaintySourceAssessment, option: EsqDaRegisterOption): boolean {
  return assessment.uncertaintySource !== option.entry.source || assessment.effectOnFamilyFrequencies !== option.entry.impact;
}

function registerFields(option: EsqDaRegisterOption): Pick<ModelUncertaintySourceAssessment, "uncertaintySource" | "effectOnFamilyFrequencies" | "dataAnalysisSourceRef"> {
  return {
    uncertaintySource: option.entry.source,
    effectOnFamilyFrequencies: option.entry.impact,
    dataAnalysisSourceRef: { workbookId: option.workbookId, sourceId: option.entry.id },
  };
}

function nextFunnelId(assessments: readonly ModelUncertaintySourceAssessment[], taken: ReadonlySet<string>): string {
  const highest = assessments.reduce((max, assessment) => {
    const value = Number(assessment.uuid.split("-").pop());
    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 0);
  let index = highest + 1;
  while (taken.has(`UF-${String(index)}`)) index += 1;
  return `UF-${String(index)}`;
}

function withAssessmentSource(esq: EventSequenceQuantification, assessmentId: string, option: EsqDaRegisterOption | undefined): EventSequenceQuantification {
  return {
    ...esq,
    modelUncertaintySourceAssessments: (esq.modelUncertaintySourceAssessments ?? []).map((assessment) => {
      if (assessment.uuid !== assessmentId) return assessment;
      if (option === undefined) return { ...assessment, dataAnalysisSourceRef: undefined };
      return { ...assessment, sourceElementCode: "DA", ...registerFields(option) };
    }),
  };
}

function withImportedRegister(esq: EventSequenceQuantification, options: readonly EsqDaRegisterOption[]): EventSequenceQuantification {
  const current = esq.modelUncertaintySourceAssessments ?? [];
  const imported = new Set(current.flatMap((assessment) => (assessment.dataAnalysisSourceRef === undefined ? [] : [registerKey(assessment.dataAnalysisSourceRef.workbookId, assessment.dataAnalysisSourceRef.sourceId)])));
  const added: ModelUncertaintySourceAssessment[] = [];
  const taken = new Set(current.map((assessment) => assessment.uuid));
  options.forEach((option) => {
    if (imported.has(registerKey(option.workbookId, option.entry.id))) return;
    const uuid = nextFunnelId([...current, ...added], taken);
    taken.add(uuid);
    added.push({
      uuid,
      sourceElementCode: "DA",
      relatedAssumptions: option.entry.assumption === undefined ? [] : [option.entry.assumption],
      evaluationType: (option.entry.sensitivityIds ?? []).length > 0 ? "QUANTITATIVE" : "QUALITATIVE",
      evaluationScope: "INDIVIDUAL",
      ...registerFields(option),
      implementsSrs: [{ sr: "ESQ-E1", hlr: "E" }],
    });
  });
  return added.length === 0 ? esq : { ...esq, modelUncertaintySourceAssessments: [...current, ...added] };
}

function caseOptions(links: readonly EsqDaLink[]): EsqDaCaseOption[] {
  return links.flatMap((link) => (link.mef.sensitivityCases ?? []).map((item) => {
    const result = sensitivityResult(link.mef, item);
    const target = item.kind === "TESTING" ? item.estimateId : item.parameterId;
    return {
      workbookId: link.workbookId,
      workbookName: link.workbookName,
      item,
      ...(target === undefined ? {} : { target }),
      ...(result.problem === undefined && result.low !== undefined ? { low: result.low } : {}),
      ...(result.problem === undefined && result.high !== undefined ? { high: result.high } : {}),
    };
  }));
}

function studyFields(option: EsqDaCaseOption): Pick<SensitivityStudy, "name" | "description" | "variedParameters" | "parameterRanges" | "results" | "dataAnalysisCaseRef"> {
  const target = option.target;
  return {
    name: option.item.name,
    description: option.item.reason,
    variedParameters: target === undefined ? [] : [target],
    parameterRanges: target !== undefined && option.low !== undefined && option.high !== undefined ? { [target]: [option.low, option.high] } : {},
    results: option.item.results,
    dataAnalysisCaseRef: { workbookId: option.workbookId, caseId: option.item.id },
  };
}

function linkedCase(study: SensitivityStudy, options: readonly EsqDaCaseOption[]): EsqDaCaseOption | undefined {
  const ref = study.dataAnalysisCaseRef;
  if (ref === undefined) return undefined;
  return options.find((option) => option.workbookId === ref.workbookId && option.item.id === ref.caseId);
}

function sameNumber(left: number, right: number): boolean {
  return left === right || Math.abs(left - right) <= 1e-9 * Math.max(Math.abs(left), Math.abs(right));
}

function sameRanges(left: Record<string, [number, number]>, right: Record<string, [number, number]>): boolean {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => {
    const ours = left[key];
    const theirs = right[key];
    return ours !== undefined && theirs !== undefined && sameNumber(ours[0], theirs[0]) && sameNumber(ours[1], theirs[1]);
  });
}

function caseDiffers(study: SensitivityStudy, option: EsqDaCaseOption): boolean {
  const fields = studyFields(option);
  return fields.name !== study.name
    || fields.description !== study.description
    || fields.results !== study.results
    || fields.variedParameters.join("\n") !== study.variedParameters.join("\n")
    || !sameRanges(fields.parameterRanges, study.parameterRanges);
}

function withImportedCases(esq: EventSequenceQuantification, options: readonly EsqDaCaseOption[]): EventSequenceQuantification {
  const current = esq.sensitivityStudies ?? [];
  const taken = new Set(current.map((study) => study.uuid));
  const refreshed = current.map((study) => {
    const option = linkedCase(study, options);
    return option === undefined ? study : { ...study, ...studyFields(option) };
  });
  const added: SensitivityStudy[] = [];
  options.forEach((option) => {
    if (current.some((study) => study.dataAnalysisCaseRef?.workbookId === option.workbookId && study.dataAnalysisCaseRef.caseId === option.item.id)) return;
    let uuid = `DA-${option.item.id}`;
    let index = 2;
    while (taken.has(uuid)) {
      uuid = `DA-${option.item.id}-${String(index)}`;
      index += 1;
    }
    taken.add(uuid);
    added.push({ uuid, ...studyFields(option), implementsSrs: [{ sr: "ESQ-E2", hlr: "E" }] });
  });
  return { ...esq, sensitivityStudies: [...refreshed, ...added] };
}

async function loadDaLink(id: string, name: string): Promise<EsqDaLink[]> {
  try {
    if (id.startsWith(EXAMPLE_PREFIX)) {
      const bundle = await fetchJson<{ da: { mef: DataAnalysis } }>(`/api/example-workbooks/da-bundle?example=${encodeURIComponent(id.slice(EXAMPLE_PREFIX.length))}`);
      return [{ workbookId: id, workbookName: name.length > 0 ? name : bundle.da.mef.name, mef: bundle.da.mef }];
    }
    const workbook = await fetchJson<{ mef: DataAnalysis }>(`/api/da-workbooks/${encodeURIComponent(id)}`);
    return [{ workbookId: id, workbookName: name.length > 0 ? name : workbook.mef.name, mef: workbook.mef }];
  } catch {
    return [];
  }
}

async function loadEsqDaLinks(projectId: string | null, esq: EventSequenceQuantification, exampleVariant?: string): Promise<EsqDaLink[]> {
  let listed: { id: string; name: string }[] = [];
  if (projectId !== null) {
    try {
      listed = (await listWorkbooks(projectId, "DA")).workbooks.map((workbook) => ({ id: workbook.id, name: workbook.name }));
    } catch {
      listed = [];
    }
  }
  const known = new Set(listed.map((entry) => entry.id));
  const referenced = [
    ...(esq.modelUncertaintySourceAssessments ?? []).flatMap((assessment) => assessment.dataAnalysisSourceRef?.workbookId ?? []),
    ...(esq.sensitivityStudies ?? []).flatMap((study) => study.dataAnalysisCaseRef?.workbookId ?? []),
  ];
  const wanted = exampleVariant === undefined ? referenced : [...referenced, `${EXAMPLE_PREFIX}${exampleVariant}`];
  const examples = [...new Set(wanted)]
    .filter((id) => id.startsWith(EXAMPLE_PREFIX) && !known.has(id))
    .map((id) => ({ id, name: "" }));
  const links = await Promise.all([...listed, ...examples].map((entry) => loadDaLink(entry.id, entry.name)));
  return links.flat();
}

export {
  caseDiffers,
  caseOptions,
  daTargets,
  linkedCase,
  linkedRegister,
  loadEsqDaLinks,
  registerDiffers,
  registerKey,
  registerOptions,
  withAssessmentSource,
  withImportedCases,
  withImportedRegister,
  type EsqDaCaseOption,
  type EsqDaLink,
  type EsqDaRegisterOption,
  type EsqDaTarget,
};
