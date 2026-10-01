import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { type Workbook } from "interfaces-shared-types";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getPosWorkbook } from "../pos-workbooks/posWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { getEsqWorkbook } from "../esq-workbooks/esqWorkbookApi";
import { getRcWorkbook } from "../rc-workbooks/rcWorkbookApi";
import { getMsWorkbook } from "../ms-workbooks/msWorkbookApi";
import { exampleLinkVariant, type RiLinkCode } from "./riViewData";

type RiWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface RiWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: RiskIntegration;
  myRoles: RiWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getRiWorkbook(workbookId: string): Promise<RiWorkbookResponse> {
  return fetchJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}`);
}

async function patchRiWorkbook(workbookId: string, current: RiskIntegration, mef: RiskIntegration): Promise<RiWorkbookResponse> {
  return patchJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
}

interface RiExampleOption {
  id: string;
  label: string;
}

async function getRiExamples(): Promise<RiExampleOption[]> {
  return fetchJson<RiExampleOption[]>("/api/example-workbooks/ri-examples");
}

async function loadRiExample(workbookId: string, exampleId?: string): Promise<RiWorkbookResponse> {
  return postJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadRiExample(workbookId: string): Promise<RiWorkbookResponse> {
  return postJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}/unload-example`, {});
}

async function listLinkOptions(projectId: string, code: RiLinkCode): Promise<Workbook[]> {
  try {
    return (await listWorkbooks(projectId, code)).workbooks;
  } catch {
    return [];
  }
}

async function listRiLinkOptions(projectId: string): Promise<Record<RiLinkCode, Workbook[]>> {
  const [POS, ES, ESQ, MS, RC] = await Promise.all([
    listLinkOptions(projectId, "POS"),
    listLinkOptions(projectId, "ES"),
    listLinkOptions(projectId, "ESQ"),
    listLinkOptions(projectId, "MS"),
    listLinkOptions(projectId, "RC"),
  ]);
  return { POS, ES, ESQ, MS, RC };
}

async function loadLinkedPos(id: string): Promise<PlantOperatingStatesAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ pos: { mef: PlantOperatingStatesAnalysis } }>(`/api/example-workbooks/pos-bundle?example=${variant}`)).pos.mef;
  return (await getPosWorkbook(id)).mef;
}

async function loadLinkedEs(id: string): Promise<EventSequenceAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ es: { mef: EventSequenceAnalysis } }>(`/api/example-workbooks/es-bundle?example=${variant}`)).es.mef;
  return (await getEsWorkbook(id)).mef;
}

async function loadLinkedEsq(id: string): Promise<EventSequenceQuantification> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ esq: { mef: EventSequenceQuantification } }>(`/api/example-workbooks/esq-bundle?example=${variant}`)).esq.mef;
  return (await getEsqWorkbook(id)).mef;
}

async function loadLinkedMs(id: string): Promise<MechanisticSourceTermAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ms: { mef: MechanisticSourceTermAnalysis } }>(`/api/example-workbooks/ms-bundle?example=${variant}`)).ms.mef;
  return (await getMsWorkbook(id)).mef;
}

async function loadLinkedRc(id: string): Promise<RadiologicalConsequenceAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ rc: { mef: RadiologicalConsequenceAnalysis } }>(`/api/example-workbooks/rc-bundle?example=${variant}`)).rc.mef;
  return (await getRcWorkbook(id)).mef;
}

interface RiDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listRiDocuments(workbookId: string): Promise<RiDocumentEntry[]> {
  return fetchJson<RiDocumentEntry[]>(`/api/ri-workbooks/${workbookId}/documents`);
}

async function uploadRiDocument(workbookId: string, file: File): Promise<RiDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<RiDocumentEntry>(`/api/ri-workbooks/${workbookId}/documents`, form);
}

async function deleteRiDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/ri-workbooks/${workbookId}/documents/${documentId}`);
}

async function getRiDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/ri-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getRiWorkbook,
  patchRiWorkbook,
  getRiExamples,
  loadRiExample,
  unloadRiExample,
  listRiLinkOptions,
  loadLinkedPos,
  loadLinkedEs,
  loadLinkedEsq,
  loadLinkedMs,
  loadLinkedRc,
  type RiExampleOption,
  listRiDocuments,
  uploadRiDocument,
  deleteRiDocument,
  getRiDocumentDownload,
  type RiWorkbookResponse,
  type RiWorkbookRoleName,
  type RiDocumentEntry,
};
