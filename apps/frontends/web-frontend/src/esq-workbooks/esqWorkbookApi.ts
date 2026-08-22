import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type EsqLinkedInputs } from "./esqWorkbookContext";

interface LinkedPosMef { plantOperatingStates?: { uuid: string; name: string; operatingMode?: string; meanDurationHours: number }[] }
interface LinkedIeMef { initiatingEventGroups?: { uuid: string; name: string; meanFrequency?: { value: number } }[] }
interface LinkedEsMef { eventSequenceFamilies?: { uuid: string; name: string }[] }
interface LinkedScMef { missionTimes?: { uuid: string; eventSequenceReference: string; missionTimeHours: number }[] }
interface LinkedSyMef { systemDefinitions?: { uuid: string; name: string }[] }
interface LinkedHrMef { hepQuantifications?: { uuid: string; hfeId?: string; meanHep?: number; pointEstimateHep?: number }[] }
interface LinkedDaMef { parameters?: { uuid: string; name: string; value: number }[] }

async function fetchEsqLinkedInputs(variant: string): Promise<EsqLinkedInputs> {
  const [posB, ieB, esB, scB, syB, hrB, daB] = await Promise.all([
    fetchJson<{ pos: { mef: LinkedPosMef } }>(`/api/example-workbooks/pos-bundle?example=${variant}`),
    fetchJson<{ ie: { mef: LinkedIeMef } }>(`/api/example-workbooks/ie-bundle?example=${variant}`),
    fetchJson<{ es: { mef: LinkedEsMef } }>(`/api/example-workbooks/es-bundle?example=${variant}`),
    fetchJson<{ sc: { mef: LinkedScMef } }>(`/api/example-workbooks/sc-bundle?example=${variant}`),
    fetchJson<{ sy: { mef: LinkedSyMef } }>(`/api/example-workbooks/sy-bundle?example=${variant}`),
    fetchJson<{ hr: { mef: LinkedHrMef } }>(`/api/example-workbooks/hr-bundle?example=${variant}`),
    fetchJson<{ da: { mef: LinkedDaMef } }>(`/api/example-workbooks/da-bundle?example=${variant}`),
  ]);
  return {
    posStates: (posB.pos.mef.plantOperatingStates ?? []).map((s) => ({ id: s.uuid, name: s.name, mode: s.operatingMode ?? "—", durationHours: s.meanDurationHours })),
    ieGroups: (ieB.ie.mef.initiatingEventGroups ?? []).filter((g) => g.meanFrequency !== undefined).map((g) => ({ id: g.uuid, name: g.name, frequency: g.meanFrequency?.value ?? 0 })),
    esFamilies: (esB.es.mef.eventSequenceFamilies ?? []).map((f) => ({ id: f.uuid, name: f.name })),
    scMissionTimes: (scB.sc.mef.missionTimes ?? []).map((m) => ({ id: m.uuid, sequence: m.eventSequenceReference, hours: m.missionTimeHours })),
    sySystems: (syB.sy.mef.systemDefinitions ?? []).map((s) => ({ id: s.uuid, name: s.name })),
    hrActions: (hrB.hr.mef.hepQuantifications ?? []).map((h) => ({ id: h.uuid, hfe: h.hfeId ?? "—", mean: h.meanHep ?? h.pointEstimateHep ?? 0 })),
    daParams: (daB.da.mef.parameters ?? []).map((p) => ({ id: p.uuid, name: p.name, value: p.value })),
  };
}

type EsqWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface EsqWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: EventSequenceQuantification;
  myRoles: EsqWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getEsqWorkbook(workbookId: string): Promise<EsqWorkbookResponse> {
  return fetchJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}`);
}

async function patchEsqWorkbook(
  workbookId: string,
  expectedRevision: number,
  current: EventSequenceQuantification,
  mef: EventSequenceQuantification,
): Promise<EsqWorkbookResponse> {
  return patchJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}`, {
    expectedRevision,
    operations: createWorkbookPatch(current, mef),
  });
}

interface EsqExampleOption {
  id: string;
  label: string;
}

async function getEsqExampleOptions(): Promise<EsqExampleOption[]> {
  return fetchJson<EsqExampleOption[]>("/api/example-workbooks/esq-examples");
}

async function loadEsqExample(workbookId: string, exampleId?: string): Promise<EsqWorkbookResponse> {
  return postJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadEsqExample(workbookId: string): Promise<EsqWorkbookResponse> {
  return postJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}/unload-example`, {});
}

interface EsqDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listEsqDocuments(workbookId: string): Promise<EsqDocumentEntry[]> {
  return fetchJson<EsqDocumentEntry[]>(`/api/esq-workbooks/${workbookId}/documents`);
}

async function uploadEsqDocument(workbookId: string, file: File): Promise<EsqDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<EsqDocumentEntry>(`/api/esq-workbooks/${workbookId}/documents`, form);
}

async function deleteEsqDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/esq-workbooks/${workbookId}/documents/${documentId}`);
}

async function getEsqDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/esq-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  fetchEsqLinkedInputs,
  getEsqExampleOptions,
  getEsqWorkbook,
  patchEsqWorkbook,
  loadEsqExample,
  unloadEsqExample,
  listEsqDocuments,
  uploadEsqDocument,
  deleteEsqDocument,
  getEsqDocumentDownload,
  type EsqWorkbookResponse,
  type EsqWorkbookRoleName,
  type EsqExampleOption,
  type EsqDocumentEntry,
};
