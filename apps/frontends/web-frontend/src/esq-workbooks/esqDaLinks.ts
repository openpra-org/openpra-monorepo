import type { DataAnalysis, DaSensitivityCase, DaUncertaintySource } from "interfaces-mef-types/da/data-analysis";
import type { EventSequenceQuantification, ModelUncertaintySourceAssessment } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { fetchJson } from "../api/client";
import { sensitivityResult } from "../da-workbooks/daUncertainty";

const EXAMPLE_PREFIX = "example-da-";

interface EsqDaLink {
  workbookId: string;
  workbookName: string;
  mef: DataAnalysis;
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
  base?: number;
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
      ...(result.problem === undefined && result.base !== undefined ? { base: result.base } : {}),
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

async function loadEsqDaLinks(workbookId: string | undefined): Promise<EsqDaLink[]> {
  if (workbookId === undefined || workbookId.length === 0) return [];
  try {
    if (workbookId.startsWith(EXAMPLE_PREFIX)) {
      const bundle = await fetchJson<{ da: { mef: DataAnalysis } }>(`/api/example-workbooks/da-bundle?example=${encodeURIComponent(workbookId.slice(EXAMPLE_PREFIX.length))}`);
      return [{ workbookId, workbookName: bundle.da.mef.name, mef: bundle.da.mef }];
    }
    const workbook = await fetchJson<{ mef: DataAnalysis }>(`/api/da-workbooks/${encodeURIComponent(workbookId)}`);
    return [{ workbookId, workbookName: workbook.mef.name, mef: workbook.mef }];
  } catch {
    return [];
  }
}

export {
  caseDiffers,
  caseOptions,
  linkedRegister,
  loadEsqDaLinks,
  registerDiffers,
  registerOptions,
  withAssessmentSource,
  type EsqDaCaseOption,
  type EsqDaLink,
  type EsqDaRegisterOption,
};
