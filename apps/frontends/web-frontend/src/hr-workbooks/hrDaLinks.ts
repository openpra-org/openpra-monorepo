import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { parameterLaw } from "interfaces-mef-types/esq/esq-measure-inputs";
import { esqParameterRecord } from "interfaces-mef-types/esq/esq-run-inputs";
import type { HepQuantification, HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { fetchJson } from "../api/client";
import type { ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { listWorkbooks } from "../workbooks/workbookApi";

const EXAMPLE_PREFIX = "example-da-";

const HEP_MODELS: readonly string[] = ["HUMAN_ERROR", "NON_RECOVERY"];

interface HrDaHepOption {
  workbookId: string;
  workbookName: string;
  parameterId: string;
  parameterName: string;
  law: UncertainExpression;
}

interface HrDaSource {
  id: string;
  name: string;
  mef: Pick<DataAnalysis, "name" | "parameters">;
}

function daHepOptions(sources: readonly HrDaSource[]): HrDaHepOption[] {
  return sources.flatMap((source) => source.mef.parameters.flatMap((parameter): HrDaHepOption[] => {
    const model = parameter.quantificationModel;
    if (parameter.parameterType !== "HUMAN_ERROR_PROBABILITY" && (model === undefined || !HEP_MODELS.includes(model))) return [];
    if (parameter.valueMode === "LINKED" && parameter.valueLink?.element === "HRA") return [];
    const law = parameterLaw(esqParameterRecord(parameter));
    if (law === undefined) return [];
    return [{
      workbookId: source.id,
      workbookName: source.name.length > 0 ? source.name : source.mef.name,
      parameterId: parameter.uuid,
      parameterName: parameter.name,
      law,
    }];
  })).sort((left, right) => [left.workbookName, left.parameterId].join(":").localeCompare([right.workbookName, right.parameterId].join(":"), undefined, { numeric: true }));
}

function hepReference(quantification: HepQuantification): WorkbookParameterReference | undefined {
  return quantification.hep?.node === "PARAMETER" ? quantification.hep.reference : undefined;
}

function linkedDaHep(quantification: HepQuantification, options: readonly HrDaHepOption[]): HrDaHepOption | undefined {
  const reference = hepReference(quantification);
  if (reference === undefined) return undefined;
  return options.find((option) => option.workbookId === reference.workbookId && option.parameterId === reference.entityId);
}

function hepParameterOptions(options: readonly HrDaHepOption[]): ParameterOption[] {
  return options.map((option) => ({
    reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: option.workbookId, entityId: option.parameterId },
    label: `${option.workbookName} · ${option.parameterId} · ${expressionText(option.law)}`,
    unit: "PROBABILITY",
  }));
}

function quantificationHepText(quantification: HepQuantification | undefined, options: readonly HrDaHepOption[] = []): string {
  const hep = quantification?.hep;
  if (hep === undefined) return "—";
  const linked = quantification === undefined ? undefined : linkedDaHep(quantification, options);
  if (linked !== undefined) return `DA · ${linked.parameterId} · ${expressionText(linked.law)}`;
  return expressionText(hep, (key) => `DA ${key}`);
}

function nextRecoveryHepId(hr: HumanReliabilityAnalysis): string {
  const used = new Set(hr.hepQuantifications.map((quantification) => quantification.uuid));
  let index = 1;
  while (used.has(`REC-Q-${String(index)}`)) index += 1;
  return `REC-Q-${String(index)}`;
}

function withRecoveryHep(hr: HumanReliabilityAnalysis, recoveryId: string): HumanReliabilityAnalysis {
  const recovery = (hr.recoveryActions ?? []).find((action) => action.uuid === recoveryId);
  if (recovery === undefined || hr.hepQuantifications.some((quantification) => quantification.uuid === recovery.hepQuantificationId)) return hr;
  const typedId = recovery.hepQuantificationId.trim();
  const uuid = typedId.length > 0 ? typedId : nextRecoveryHepId(hr);
  const created: HepQuantification = {
    uuid,
    hfeId: recovery.hfeId,
    methodology: "",
    assessmentType: "DETAILED_ASSESSMENT",
    isRiskSignificant: false,
    implementsSrs: [{ sr: "HR-H4", hlr: "H" }],
  };
  return {
    ...hr,
    hepQuantifications: [...hr.hepQuantifications, created],
    recoveryActions: (hr.recoveryActions ?? []).map((action) => (action.uuid === recoveryId ? { ...action, hepQuantificationId: uuid } : action)),
  };
}

async function loadDaSource(id: string, name: string): Promise<HrDaSource[]> {
  try {
    if (id.startsWith(EXAMPLE_PREFIX)) {
      const bundle = await fetchJson<{ da: { mef: DataAnalysis } }>(`/api/example-workbooks/da-bundle?example=${encodeURIComponent(id.slice(EXAMPLE_PREFIX.length))}`);
      return [{ id, name, mef: bundle.da.mef }];
    }
    const workbook = await fetchJson<{ mef: DataAnalysis }>(`/api/da-workbooks/${encodeURIComponent(id)}`);
    return [{ id, name, mef: workbook.mef }];
  } catch {
    return [];
  }
}

async function loadHrDaHeps(projectId: string | null, hr: HumanReliabilityAnalysis, exampleVariant?: string): Promise<HrDaHepOption[]> {
  let listed: { id: string; name: string }[] = [];
  if (projectId !== null) {
    try {
      listed = (await listWorkbooks(projectId, "DA")).workbooks.map((workbook) => ({ id: workbook.id, name: workbook.name }));
    } catch {
      listed = [];
    }
  }
  const known = new Set(listed.map((entry) => entry.id));
  const referenced = hr.hepQuantifications.flatMap((quantification) => hepReference(quantification)?.workbookId ?? []);
  const wanted = exampleVariant === undefined ? referenced : [...referenced, `${EXAMPLE_PREFIX}${exampleVariant}`];
  const examples = [...new Set(wanted)]
    .filter((id) => id.startsWith(EXAMPLE_PREFIX) && !known.has(id))
    .map((id) => ({ id, name: "" }));
  const sources = await Promise.all([...listed, ...examples].map((entry) => loadDaSource(entry.id, entry.name)));
  return daHepOptions(sources.flat());
}

export {
  daHepOptions,
  hepParameterOptions,
  hepReference,
  linkedDaHep,
  loadHrDaHeps,
  quantificationHepText,
  withRecoveryHep,
  type HrDaHepOption,
  type HrDaSource,
};
