import { type HighWindsPRA } from "interfaces-mef-types/high-winds/high-winds-pra";
import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson } from "../api/client";

export type HighWindsPraWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";
export interface HighWindsPraWorkbookResponse { workbookId: string; projectId: string; ownerUsername: string; mef: HighWindsPRA; myRoles: HighWindsPraWorkbookRoleName[]; hasPreviousMef: boolean; updatedAt: string }
export interface HighWindsPraExampleOption { id: string; label: string }

export const getHighWindsPraWorkbook = (workbookId: string): Promise<HighWindsPraWorkbookResponse> => fetchJson(`/api/high-winds-pra-workbooks/${workbookId}`);
export const patchHighWindsPraWorkbook = (workbookId: string, current: HighWindsPRA, mef: HighWindsPRA): Promise<HighWindsPraWorkbookResponse> => patchJson(`/api/high-winds-pra-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
export const getHighWindsPraExamples = (): Promise<HighWindsPraExampleOption[]> => fetchJson("/api/example-workbooks/high-winds-pra-examples");
export const loadHighWindsPraExample = (workbookId: string, exampleId?: string): Promise<HighWindsPraWorkbookResponse> => postJson(`/api/high-winds-pra-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
export const unloadHighWindsPraExample = (workbookId: string): Promise<HighWindsPraWorkbookResponse> => postJson(`/api/high-winds-pra-workbooks/${workbookId}/unload-example`, {});
