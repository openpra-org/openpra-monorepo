import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { type InternalFirePRA } from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { fetchJson, patchJson, postJson } from "../api/client";

export type InternalFirePraWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";
export interface InternalFirePraWorkbookResponse { workbookId: string; projectId: string; ownerUsername: string; mef: InternalFirePRA; myRoles: InternalFirePraWorkbookRoleName[]; hasPreviousMef: boolean; updatedAt: string }
export interface InternalFirePraExampleOption { id: string; label: string }

export const getInternalFirePraWorkbook = (workbookId: string): Promise<InternalFirePraWorkbookResponse> => fetchJson(`/api/internal-fire-pra-workbooks/${workbookId}`);
export const patchInternalFirePraWorkbook = (workbookId: string, current: InternalFirePRA, mef: InternalFirePRA): Promise<InternalFirePraWorkbookResponse> => patchJson(`/api/internal-fire-pra-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
export const getInternalFirePraExamples = (): Promise<InternalFirePraExampleOption[]> => fetchJson("/api/example-workbooks/internal-fire-pra-examples");
export const loadInternalFirePraExample = (workbookId: string, exampleId?: string): Promise<InternalFirePraWorkbookResponse> => postJson(`/api/internal-fire-pra-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
export const unloadInternalFirePraExample = (workbookId: string): Promise<InternalFirePraWorkbookResponse> => postJson(`/api/internal-fire-pra-workbooks/${workbookId}/unload-example`, {});
