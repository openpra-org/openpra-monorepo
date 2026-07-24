import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { deleteJson, fetchJson, patchJson, postJson, postMultipart } from "../api/client";

type SeismicPraWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface SeismicPraWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: SeismicPRA;
  myRoles: SeismicPraWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface SeismicPraExampleOption { id: string; label: string }
interface SeismicPraDocumentEntry { documentId: string; filename: string; mimeType: string; size: number; uploadedBy: string; uploadedAt: string }

const getSeismicPraWorkbook = (workbookId: string): Promise<SeismicPraWorkbookResponse> => fetchJson(`/api/seismic-pra-workbooks/${workbookId}`);
const patchSeismicPraWorkbook = (workbookId: string, mef: SeismicPRA): Promise<SeismicPraWorkbookResponse> => patchJson(`/api/seismic-pra-workbooks/${workbookId}`, { mef });
const getSeismicPraExamples = (): Promise<SeismicPraExampleOption[]> => fetchJson("/api/example-workbooks/seismic-pra-examples");
const loadSeismicPraExample = (workbookId: string, exampleId?: string): Promise<SeismicPraWorkbookResponse> => postJson(`/api/seismic-pra-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
const unloadSeismicPraExample = (workbookId: string): Promise<SeismicPraWorkbookResponse> => postJson(`/api/seismic-pra-workbooks/${workbookId}/unload-example`, {});
const listSeismicPraDocuments = (workbookId: string): Promise<SeismicPraDocumentEntry[]> => fetchJson(`/api/seismic-pra-workbooks/${workbookId}/documents`);
async function uploadSeismicPraDocument(workbookId: string, file: File): Promise<SeismicPraDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart(`/api/seismic-pra-workbooks/${workbookId}/documents`, form);
}
const deleteSeismicPraDocument = async (workbookId: string, documentId: string): Promise<void> => { await deleteJson(`/api/seismic-pra-workbooks/${workbookId}/documents/${documentId}`); };
const updateSeismicPraDocument = (workbookId: string, documentId: string, name: string): Promise<SeismicPraDocumentEntry> => patchJson(`/api/seismic-pra-workbooks/${workbookId}/documents/${documentId}`, { name });
const getSeismicPraDocumentDownload = (workbookId: string, documentId: string): Promise<{ url: string; filename: string }> => fetchJson(`/api/seismic-pra-workbooks/${workbookId}/documents/${documentId}/download`);

export {
  getSeismicPraWorkbook,
  patchSeismicPraWorkbook,
  getSeismicPraExamples,
  loadSeismicPraExample,
  unloadSeismicPraExample,
  listSeismicPraDocuments,
  uploadSeismicPraDocument,
  deleteSeismicPraDocument,
  updateSeismicPraDocument,
  getSeismicPraDocumentDownload,
  type SeismicPraWorkbookResponse,
  type SeismicPraWorkbookRoleName,
  type SeismicPraExampleOption,
  type SeismicPraDocumentEntry,
};
