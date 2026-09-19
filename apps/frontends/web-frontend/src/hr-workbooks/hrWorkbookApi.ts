import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type HrLinkedInputs } from "./hrWorkbookContext";

interface LinkedPosMef { plantOperatingStates?: { uuid: string; name: string; operatingMode?: string; meanDurationHours: number }[] }
interface LinkedEsMef { operatorActionWindows?: { humanActionId: string; action: string; cue?: string; windowStartMinutes: number; windowEndMinutes: number }[] }
interface LinkedScMef { humanActionSuccessCriteria?: { humanActionId: string; description: string; timeAvailable: string; successCriteria: string }[] }
interface LinkedSyMef { humanFailureEventIntegrations?: { hfeReference: string; taskDescription: string; system: string }[]; systemDefinitions?: { uuid: string; name: string }[] }
interface LinkedDaMef { parameters?: { uuid: string; name: string }[] }
interface LinkedIeMef { initiators?: { uuid: string; name: string }[] }

async function fetchHrLinkedInputs(variant: string): Promise<HrLinkedInputs> {
  const [posB, esB, scB, syB, daB, ieB] = await Promise.all([
    fetchJson<{ pos: { mef: LinkedPosMef } }>(`/api/example-workbooks/pos-bundle?example=${variant}`),
    fetchJson<{ es: { mef: LinkedEsMef } }>(`/api/example-workbooks/es-bundle?example=${variant}`),
    fetchJson<{ sc: { mef: LinkedScMef } }>(`/api/example-workbooks/sc-bundle?example=${variant}`),
    fetchJson<{ sy: { mef: LinkedSyMef } }>(`/api/example-workbooks/sy-bundle?example=${variant}`),
    fetchJson<{ da: { mef: LinkedDaMef } }>(`/api/example-workbooks/da-bundle?example=${variant}`),
    fetchJson<{ ie: { mef: LinkedIeMef } }>(`/api/example-workbooks/ie-bundle?example=${variant}`),
  ]);
  return {
    posStates: (posB.pos.mef.plantOperatingStates ?? []).map((s) => ({ id: s.uuid, name: s.name, mode: s.operatingMode ?? "—", durationHours: s.meanDurationHours })),
    esActions: (esB.es.mef.operatorActionWindows ?? []).map((a) => ({ id: a.humanActionId, action: a.action, cue: a.cue ?? "—", window: `${String(a.windowStartMinutes)} to ${String(a.windowEndMinutes)}` })),
    scWindows: (scB.sc.mef.humanActionSuccessCriteria ?? []).map((c) => ({ id: c.humanActionId, description: c.description, timeAvailable: c.timeAvailable, criteria: c.successCriteria })),
    syPlaced: (syB.sy.mef.humanFailureEventIntegrations ?? []).map((h) => ({ id: h.hfeReference, task: h.taskDescription, system: h.system })),
    syDefs: (syB.sy.mef.systemDefinitions ?? []).map((s) => ({ id: s.uuid, name: s.name })),
    daParams: (daB.da.mef.parameters ?? []).map((p) => ({ id: p.uuid, name: p.name })),
    ieInitiators: (ieB.ie.mef.initiators ?? []).map((i) => ({ id: i.uuid, name: i.name })),
  };
}

type HrWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface HrWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: HumanReliabilityAnalysis;
  myRoles: HrWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getHrWorkbook(workbookId: string): Promise<HrWorkbookResponse> {
  return fetchJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}`);
}

async function patchHrWorkbook(
  workbookId: string,
  expectedRevision: number,
  current: HumanReliabilityAnalysis,
  mef: HumanReliabilityAnalysis,
): Promise<HrWorkbookResponse> {
  return patchJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}`, {
    expectedRevision,
    operations: createWorkbookPatch(current, mef),
  });
}

interface HrExampleOption {
  id: string;
  label: string;
}

async function getHrExampleOptions(): Promise<HrExampleOption[]> {
  return fetchJson<HrExampleOption[]>("/api/example-workbooks/hr-examples");
}

async function loadHrExample(workbookId: string, exampleId?: string): Promise<HrWorkbookResponse> {
  return postJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadHrExample(workbookId: string): Promise<HrWorkbookResponse> {
  return postJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}/unload-example`, {});
}

interface HrDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listHrDocuments(workbookId: string): Promise<HrDocumentEntry[]> {
  return fetchJson<HrDocumentEntry[]>(`/api/hr-workbooks/${workbookId}/documents`);
}

async function uploadHrDocument(workbookId: string, file: File): Promise<HrDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<HrDocumentEntry>(`/api/hr-workbooks/${workbookId}/documents`, form);
}

async function deleteHrDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/hr-workbooks/${workbookId}/documents/${documentId}`);
}

async function getHrDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/hr-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  fetchHrLinkedInputs,
  getHrWorkbook,
  patchHrWorkbook,
  getHrExampleOptions,
  loadHrExample,
  unloadHrExample,
  listHrDocuments,
  uploadHrDocument,
  deleteHrDocument,
  getHrDocumentDownload,
  type HrWorkbookResponse,
  type HrWorkbookRoleName,
  type HrExampleOption,
  type HrDocumentEntry,
};
