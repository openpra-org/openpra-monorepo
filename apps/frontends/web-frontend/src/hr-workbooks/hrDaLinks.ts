import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { HepQuantification, HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";

const EXAMPLE_PREFIX = "example-da-";

interface HrDaHepOption {
  workbookId: string;
  workbookName: string;
  parameterId: string;
  parameterName: string;
  value: number;
  valueType: "MEAN" | "POINT_ESTIMATE";
}

interface HrDaSource {
  id: string;
  name: string;
  mef: Pick<DataAnalysis, "name" | "parameters">;
}

function daHepKey(workbookId: string, parameterId: string): string {
  return JSON.stringify([workbookId, parameterId]);
}

function daHepOptions(sources: readonly HrDaSource[]): HrDaHepOption[] {
  return sources.flatMap((source) => source.mef.parameters.flatMap((parameter): HrDaHepOption[] => {
    const value = parameter.value;
    if (parameter.parameterType !== "HUMAN_ERROR_PROBABILITY" && parameter.quantificationModel !== "NON_RECOVERY") return [];
    if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) return [];
    if (parameter.valueMode === "LINKED" && parameter.valueLink?.element === "HRA") return [];
    return [{
      workbookId: source.id,
      workbookName: source.name.length > 0 ? source.name : source.mef.name,
      parameterId: parameter.uuid,
      parameterName: parameter.name,
      value,
      valueType: parameter.valueType,
    }];
  })).sort((left, right) => [left.workbookName, left.parameterId].join(":").localeCompare([right.workbookName, right.parameterId].join(":"), undefined, { numeric: true }));
}

function heldHep(quantification: HepQuantification): number | undefined {
  return quantification.meanHep ?? quantification.pointEstimateHep;
}

function hepDiffers(quantification: HepQuantification, value: number): boolean {
  const held = heldHep(quantification);
  return held === undefined || Math.abs(held - value) > 1e-9 * Math.max(Math.abs(held), Math.abs(value));
}

function linkedDaHep(quantification: HepQuantification, options: readonly HrDaHepOption[]): HrDaHepOption | undefined {
  const source = quantification.controlledDataSource;
  if (source === undefined) return undefined;
  return options.find((option) => option.workbookId === source.workbookId && option.parameterId === source.entityId);
}

function withImportedHep(hr: HumanReliabilityAnalysis, quantificationId: string, option: HrDaHepOption | undefined): HumanReliabilityAnalysis {
  return {
    ...hr,
    hepQuantifications: hr.hepQuantifications.map((quantification) => {
      if (quantification.uuid !== quantificationId) return quantification;
      if (option === undefined) return { ...quantification, controlledDataSource: undefined };
      const value = option.valueType === "MEAN" ? { meanHep: option.value } : { pointEstimateHep: option.value, meanHep: undefined };
      return { ...quantification, ...value, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: option.workbookId, entityId: option.parameterId } };
    }),
  };
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
  const referenced = hr.hepQuantifications.flatMap((quantification) => quantification.controlledDataSource?.workbookId ?? []);
  const wanted = exampleVariant === undefined ? referenced : [...referenced, `${EXAMPLE_PREFIX}${exampleVariant}`];
  const examples = [...new Set(wanted)]
    .filter((id) => id.startsWith(EXAMPLE_PREFIX) && !known.has(id))
    .map((id) => ({ id, name: "" }));
  const sources = await Promise.all([...listed, ...examples].map((entry) => loadDaSource(entry.id, entry.name)));
  return daHepOptions(sources.flat());
}

export {
  daHepKey,
  daHepOptions,
  heldHep,
  hepDiffers,
  linkedDaHep,
  loadHrDaHeps,
  withImportedHep,
  withRecoveryHep,
  type HrDaHepOption,
  type HrDaSource,
};
