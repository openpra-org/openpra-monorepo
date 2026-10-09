import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type DataAnalysis, type DaLinkCode } from "interfaces-mef-types/da/data-analysis";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { type Workbook } from "interfaces-shared-types";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getIeWorkbook } from "../ie-workbooks/ieWorkbookApi";
import { getPosWorkbook } from "../pos-workbooks/posWorkbookApi";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { getHrWorkbook } from "../hr-workbooks/hrWorkbookApi";
import { getEsqWorkbook } from "../esq-workbooks/esqWorkbookApi";
import { getScWorkbook } from "../sc-workbooks/scWorkbookApi";
import { exampleLinkVariant } from "./daViewData";

async function listLinkOptions(projectId: string, code: DaLinkCode): Promise<Workbook[]> {
  try {
    return (await listWorkbooks(projectId, code)).workbooks;
  } catch {
    return [];
  }
}

async function listDaLinkOptions(projectId: string): Promise<Record<DaLinkCode, Workbook[]>> {
  const [SY, IE, HRA, POS, SC, ESQ] = await Promise.all([
    listLinkOptions(projectId, "SY"),
    listLinkOptions(projectId, "IE"),
    listLinkOptions(projectId, "HRA"),
    listLinkOptions(projectId, "POS"),
    listLinkOptions(projectId, "SC"),
    listLinkOptions(projectId, "ESQ"),
  ]);
  return { SY, IE, HRA, POS, SC, ESQ };
}

async function loadLinkedIe(id: string): Promise<InitiatingEventsAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ie: { mef: InitiatingEventsAnalysis } }>(`/api/example-workbooks/ie-bundle?example=${variant}`)).ie.mef;
  return (await getIeWorkbook(id)).mef;
}

async function loadLinkedSy(id: string): Promise<SystemsAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ sy: { mef: SystemsAnalysis } }>(`/api/example-workbooks/sy-bundle?example=${variant}`)).sy.mef;
  return (await getSyWorkbook(id)).mef;
}

async function loadLinkedHr(id: string): Promise<HumanReliabilityAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ hr: { mef: HumanReliabilityAnalysis } }>(`/api/example-workbooks/hr-bundle?example=${variant}`)).hr.mef;
  return (await getHrWorkbook(id)).mef;
}

async function loadLinkedPos(id: string): Promise<PlantOperatingStatesAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ pos: { mef: PlantOperatingStatesAnalysis } }>(`/api/example-workbooks/pos-bundle?example=${variant}`)).pos.mef;
  return (await getPosWorkbook(id)).mef;
}

async function loadLinkedEsq(id: string): Promise<EventSequenceQuantification> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ esq: { mef: EventSequenceQuantification } }>(`/api/example-workbooks/esq-bundle?example=${variant}`)).esq.mef;
  return (await getEsqWorkbook(id)).mef;
}

async function loadLinkedSc(id: string): Promise<SuccessCriteriaDevelopment> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ sc: { mef: SuccessCriteriaDevelopment } }>(`/api/example-workbooks/sc-bundle?example=${variant}`)).sc.mef;
  return (await getScWorkbook(id)).mef;
}

type DaWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface DaWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: DataAnalysis;
  myRoles: DaWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getDaWorkbook(workbookId: string): Promise<DaWorkbookResponse> {
  return fetchJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}`);
}

async function patchDaWorkbook(workbookId: string, expectedRevision: number, current: DataAnalysis, mef: DataAnalysis): Promise<DaWorkbookResponse> {
  return patchJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}`, {
    expectedRevision,
    operations: createWorkbookPatch(current, mef),
  });
}

interface DaExampleOption {
  id: string;
  label: string;
}

async function getDaExampleOptions(): Promise<DaExampleOption[]> {
  return fetchJson<DaExampleOption[]>("/api/example-workbooks/da-examples");
}

async function loadDaExample(workbookId: string, exampleId?: string): Promise<DaWorkbookResponse> {
  return postJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadDaExample(workbookId: string): Promise<DaWorkbookResponse> {
  return postJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}/unload-example`, {});
}

interface DaDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listDaDocuments(workbookId: string): Promise<DaDocumentEntry[]> {
  return fetchJson<DaDocumentEntry[]>(`/api/da-workbooks/${workbookId}/documents`);
}

async function uploadDaDocument(workbookId: string, file: File): Promise<DaDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<DaDocumentEntry>(`/api/da-workbooks/${workbookId}/documents`, form);
}

async function deleteDaDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/da-workbooks/${workbookId}/documents/${documentId}`);
}

async function getDaDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/da-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  listDaLinkOptions,
  loadLinkedEsq,
  loadLinkedHr,
  loadLinkedIe,
  loadLinkedPos,
  loadLinkedSc,
  loadLinkedSy,
  getDaExampleOptions,
  getDaWorkbook,
  patchDaWorkbook,
  loadDaExample,
  unloadDaExample,
  listDaDocuments,
  uploadDaDocument,
  deleteDaDocument,
  getDaDocumentDownload,
  type DaWorkbookResponse,
  type DaWorkbookRoleName,
  type DaExampleOption,
  type DaDocumentEntry,
};
