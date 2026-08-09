import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { type InternalFloodPRA } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { fetchJson, patchJson, postJson } from "../api/client";

export type InternalFloodPraWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";
export interface InternalFloodPraWorkbookResponse { workbookId: string; projectId: string; ownerUsername: string; mef: InternalFloodPRA; myRoles: InternalFloodPraWorkbookRoleName[]; hasPreviousMef: boolean; updatedAt: string }
export interface InternalFloodPraExampleOption { id: string; label: string }

export const getInternalFloodPraWorkbook = (workbookId: string): Promise<InternalFloodPraWorkbookResponse> => fetchJson(`/api/internal-flood-pra-workbooks/${workbookId}`);
export const patchInternalFloodPraWorkbook = (workbookId: string, current: InternalFloodPRA, mef: InternalFloodPRA): Promise<InternalFloodPraWorkbookResponse> => patchJson(`/api/internal-flood-pra-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
export const getInternalFloodPraExamples = (): Promise<InternalFloodPraExampleOption[]> => fetchJson("/api/example-workbooks/internal-flood-pra-examples");
export const loadInternalFloodPraExample = (workbookId: string, exampleId?: string): Promise<InternalFloodPraWorkbookResponse> => postJson(`/api/internal-flood-pra-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
export const unloadInternalFloodPraExample = (workbookId: string): Promise<InternalFloodPraWorkbookResponse> => postJson(`/api/internal-flood-pra-workbooks/${workbookId}/unload-example`, {});
