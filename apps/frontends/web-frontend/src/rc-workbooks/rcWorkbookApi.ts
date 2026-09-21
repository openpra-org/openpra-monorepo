import type { RcCaseRecords, RcCaseSelection, RcCaseTable, RcCaseTextPage, RcCaseDataset, RcCaseReview, RcLinkedResultValues } from "interfaces-mef-types/rc/case-records";
import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RcSiteReceptors, RcSiteSettings } from "interfaces-mef-types/rc/site-receptors";
import type { RcEarlyResponseModel } from "interfaces-mef-types/rc/early-response";
import type { RcResponseCalculationResult } from "interfaces-mef-types/rc/early-response-calculation";
import type { RcWeatherInputs, RcWeatherPage, RcWeatherSettings } from "interfaces-mef-types/rc/weather";
import type { RcTransportInputs, RcTransportSettings, RcLinkedDeposition, RcDecayDetail } from "interfaces-mef-types/rc/transport";
import type { RcDoseInputs, RcDoseSettings, RcDosePathway, RcDoseFilePage, RcDoseRecord } from "interfaces-mef-types/rc/dose-inputs";

export async function importRcDoseInput(id: string, kind: "exposure" | RcDosePathway, baseRevision: number, file: File, categoryId?: string, sourceRevision?: number): Promise<RcDoseInputs> {
  const form = new FormData(); form.append("baseRevision", String(baseRevision)); form.append("file", file);
  if (categoryId !== undefined) form.append("categoryId", categoryId);
  if (sourceRevision !== undefined) form.append("sourceRevision", String(sourceRevision));
  return postMultipart(`/api/rc-workbooks/${encodeURIComponent(id)}/dose-inputs/import/${kind}`, form);
}
export async function saveRcDoseSettings(id: string, baseRevision: number, categoryId: string, sourceRevision: number, settings: RcDoseSettings): Promise<RcDoseInputs> {
  return patchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/dose-inputs`, { baseRevision, categoryId, sourceRevision, settings });
}
export async function readRcDoseOriginal(id: string, documentId: string, offset: number): Promise<RcDoseFilePage> {
  return fetchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/dose-inputs/files/${encodeURIComponent(documentId)}?offset=${offset}`);
}
export async function readRcDoseRecords(id: string, documentId: string, nuclide: string): Promise<RcDoseRecord[]> {
  return fetchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/dose-inputs/records/${encodeURIComponent(documentId)}?nuclide=${encodeURIComponent(nuclide)}`);
}

export async function importRcTransportFiles(id: string, kind: "deposition" | "dispersion" | "decay", baseRevision: number, files: File[], categoryId?: string, sourceRevision?: number): Promise<RcTransportInputs> {
  const form = new FormData(); form.append("baseRevision", String(baseRevision));
  if (categoryId !== undefined) form.append("categoryId", categoryId);
  if (sourceRevision !== undefined) form.append("sourceRevision", String(sourceRevision));
  files.forEach(f => form.append("files", f));
  return postMultipart(`/api/rc-workbooks/${encodeURIComponent(id)}/transport/import/${kind}`, form);
}
export async function saveRcTransportSettings(id: string, baseRevision: number, categoryId: string, sourceRevision: number, settings: RcTransportSettings): Promise<RcTransportInputs> {
  return patchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/transport`, { baseRevision, categoryId, sourceRevision, settings });
}
export async function unlinkRcTransportFile(id: string, baseRevision: number, kind: "decay" | "deposition", documentId?: string, categoryId?: string): Promise<RcTransportInputs> {
  return postJson(`/api/rc-workbooks/${encodeURIComponent(id)}/transport/unlink`, { baseRevision, kind, documentId, categoryId });
}
export async function readRcTransportSource(id: string, categoryId: string): Promise<RcLinkedDeposition> { return fetchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/transport/source/${encodeURIComponent(categoryId)}`); }
export async function readRcTransportOriginal(id: string, documentId: string): Promise<string> {
  return (await fetchJson<{ text: string }>(`/api/rc-workbooks/${encodeURIComponent(id)}/transport/files/${encodeURIComponent(documentId)}`)).text;
}
export async function readRcTransportDecay(id: string, documentId: string, index: number, offset: number): Promise<RcDecayDetail> {
  return fetchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/transport/decay/${encodeURIComponent(documentId)}/${index}?offset=${offset}`);
}

export async function importRcWeatherInput(id: string, kind: "weather" | "configuration", baseRevision: number, file: File): Promise<RcWeatherInputs> {
  const form = new FormData(); form.append("baseRevision", String(baseRevision)); form.append("file", file);
  return postMultipart(`/api/rc-workbooks/${encodeURIComponent(id)}/weather/import/${kind}`, form);
}
export async function saveRcWeatherSettings(id: string, baseRevision: number, settings: RcWeatherSettings, confirm: boolean): Promise<RcWeatherInputs> {
  return patchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/weather`, { baseRevision, settings, confirm });
}
export async function prepareRcWeatherCollection(id: string, baseRevision: number, siteRevision: number, dates: { start: string; end: string }): Promise<RcWeatherInputs> {
  return postJson(`/api/rc-workbooks/${encodeURIComponent(id)}/weather/collection-request`, { baseRevision, siteRevision, dates });
}
export async function readRcWeatherOriginal(id: string, documentId: string): Promise<string> {
  return (await fetchJson<{ text: string }>(`/api/rc-workbooks/${encodeURIComponent(id)}/weather/files/${encodeURIComponent(documentId)}`)).text;
}
export async function readRcWeatherRecords(id: string, offset: number): Promise<RcWeatherPage> {
  return fetchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/weather/records?offset=${offset}&limit=6`);
}

export async function importRcSiteInput(id: string, kind: "location" | "geometry", baseRevision: number, file: File): Promise<RcSiteReceptors> {
  const form = new FormData(); form.append("baseRevision", String(baseRevision)); form.append("file", file);
  return postMultipart(`/api/rc-workbooks/${encodeURIComponent(id)}/site-receptors/import/${kind}`, form);
}
export async function saveRcSiteSettings(id: string, baseRevision: number, settings: RcSiteSettings): Promise<RcSiteReceptors> {
  return patchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/site-receptors`, { baseRevision, settings });
}
export async function readRcSiteOriginal(id: string, documentId: string): Promise<string> {
  const result = await fetchJson<{ text: string }>(`/api/rc-workbooks/${encodeURIComponent(id)}/site-receptors/files/${encodeURIComponent(documentId)}`);
  return result.text;
}

export async function importRcEarlyResponse(id: string, baseRevision: number, file: File): Promise<RcEarlyResponseModel> {
  const form = new FormData(); form.append("baseRevision", String(baseRevision)); form.append("file", file);
  return postMultipart(`/api/rc-workbooks/${encodeURIComponent(id)}/early-response/import`, form);
}
export async function saveRcEarlyResponse(id: string, baseRevision: number, model: RcEarlyResponseModel): Promise<RcEarlyResponseModel> {
  return patchJson(`/api/rc-workbooks/${encodeURIComponent(id)}/early-response`, { baseRevision, model });
}
export async function readRcEarlyResponseOriginal(id: string, documentId: string): Promise<string> {
  return (await fetchJson<{ text: string }>(`/api/rc-workbooks/${encodeURIComponent(id)}/early-response/files/${encodeURIComponent(documentId)}`)).text;
}
export async function calculateRcEarlyResponse(id: string, categoryId: string, file: File): Promise<RcResponseCalculationResult> {
  const form = new FormData(); form.append("categoryId", categoryId); form.append("file", file);
  return postMultipart(`/api/rc-workbooks/${encodeURIComponent(id)}/early-response/calculate`, form);
}

export async function importRcSourceTerm(workbookId: string, categoryId: string, baseRevision: number, file: File): Promise<ReleaseCategoryInputs> {
  const form = new FormData();
  form.append("baseRevision", String(baseRevision));
  form.append("file", file);
  return postMultipart(`/api/rc-workbooks/${encodeURIComponent(workbookId)}/source-terms/${encodeURIComponent(categoryId)}/import`, form);
}

export async function saveRcSourceTerm(workbookId: string, categoryId: string, baseRevision: number, values: RcSourceTermValues): Promise<ReleaseCategoryInputs> {
  return patchJson(`/api/rc-workbooks/${encodeURIComponent(workbookId)}/source-terms/${encodeURIComponent(categoryId)}`, { baseRevision, values });
}

type RcWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface RcWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: RadiologicalConsequenceAnalysis;
  myRoles: RcWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getRcWorkbook(workbookId: string): Promise<RcWorkbookResponse> {
  return fetchJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}`);
}

async function patchRcWorkbook(workbookId: string, current: RadiologicalConsequenceAnalysis, mef: RadiologicalConsequenceAnalysis): Promise<RcWorkbookResponse> {
  return patchJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
}

interface RcExampleOption {
  id: string;
  label: string;
}

async function getRcExamples(): Promise<RcExampleOption[]> {
  return fetchJson<RcExampleOption[]>("/api/example-workbooks/rc-examples");
}

async function loadRcExample(workbookId: string, exampleId?: string): Promise<RcWorkbookResponse> {
  return postJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadRcExample(workbookId: string): Promise<RcWorkbookResponse> {
  return postJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}/unload-example`, {});
}

interface RcDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listRcDocuments(workbookId: string): Promise<RcDocumentEntry[]> {
  return fetchJson<RcDocumentEntry[]>(`/api/rc-workbooks/${workbookId}/documents`);
}

async function uploadRcDocument(workbookId: string, file: File): Promise<RcDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<RcDocumentEntry>(`/api/rc-workbooks/${workbookId}/documents`, form);
}

async function deleteRcDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/rc-workbooks/${workbookId}/documents/${documentId}`);
}

async function getRcDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/rc-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getRcWorkbook,
  patchRcWorkbook,
  getRcExamples,
  loadRcExample,
  unloadRcExample,
  listRcDocuments,
  uploadRcDocument,
  deleteRcDocument,
  getRcDocumentDownload,
  type RcWorkbookResponse,
  type RcWorkbookRoleName,
  type RcExampleOption,
  type RcDocumentEntry,
};

const caseUrl = (id: string) => `/api/rc-workbooks/${encodeURIComponent(id)}/case-records`;
const caseQuery = (selection: RcCaseSelection, offset?: number) => new URLSearchParams({ categoryId: selection.categoryId, versions: selection.versions, ...(selection.snapshotId ? { snapshotId: selection.snapshotId } : {}), ...(offset === undefined ? {} : { offset: String(offset) }) }).toString();
export function saveRcCaseSnapshot(id: string, baseRevision: number, selection: RcCaseSelection): Promise<{ records: RcCaseRecords; snapshotId: string }> {
  return postJson(`${caseUrl(id)}/snapshots`, { baseRevision, categoryId: selection.categoryId, versions: selection.versions });
}
export function saveRcLinkedResult(id: string, baseRevision: number, result: RcLinkedResultValues, file: File): Promise<RcCaseRecords> {
  const form = new FormData(); form.append("record", JSON.stringify({ baseRevision, result })); form.append("file", file);
  return postMultipart(`${caseUrl(id)}/results`, form);
}
export function readRcCaseTable(id: string, selection: RcCaseSelection, kind: RcCaseDataset, offset: number): Promise<RcCaseTable> { return fetchJson(`${caseUrl(id)}/table/${kind}?${caseQuery(selection, offset)}`); }
export function readRcCaseText(id: string, selection: RcCaseSelection, fileId: string, offset: number): Promise<RcCaseTextPage> { return fetchJson(`${caseUrl(id)}/text/${encodeURIComponent(fileId)}?${caseQuery(selection, offset)}`); }
export function readRcCaseReview(id: string, selection: RcCaseSelection): Promise<RcCaseReview> { return fetchJson(`${caseUrl(id)}/review?${caseQuery(selection)}`); }
export function readRcCaseChoices(id: string, snapshotId: string, kind: "receptors" | "weather", search: string): Promise<{ ids: string[]; total: number }> { return fetchJson(`${caseUrl(id)}/snapshots/${encodeURIComponent(snapshotId)}/choices/${kind}?search=${encodeURIComponent(search)}`); }
export function readRcCaseOutput(id: string, resultId: string, offset: number): Promise<RcCaseTextPage> { return fetchJson(`${caseUrl(id)}/results/${encodeURIComponent(resultId)}/output?offset=${offset}`); }
