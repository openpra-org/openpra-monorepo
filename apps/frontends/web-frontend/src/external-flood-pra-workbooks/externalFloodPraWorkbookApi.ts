import { type ExternalFloodPRA } from "interfaces-mef-types/external-flood/external-flood-pra";
import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson } from "../api/client";

export type ExternalFloodPraWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";
export interface ExternalFloodPraWorkbookResponse { workbookId: string; projectId: string; ownerUsername: string; mef: ExternalFloodPRA; myRoles: ExternalFloodPraWorkbookRoleName[]; hasPreviousMef: boolean; updatedAt: string }
export interface ExternalFloodPraExampleOption { id: string; label: string }

export const getExternalFloodPraWorkbook = (workbookId: string): Promise<ExternalFloodPraWorkbookResponse> => fetchJson(`/api/external-flood-pra-workbooks/${workbookId}`);
export const patchExternalFloodPraWorkbook = (workbookId: string, current: ExternalFloodPRA, mef: ExternalFloodPRA): Promise<ExternalFloodPraWorkbookResponse> => patchJson(`/api/external-flood-pra-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
export const getExternalFloodPraExamples = (): Promise<ExternalFloodPraExampleOption[]> => fetchJson("/api/example-workbooks/external-flood-pra-examples");
export const loadExternalFloodPraExample = (workbookId: string, exampleId?: string): Promise<ExternalFloodPraWorkbookResponse> => postJson(`/api/external-flood-pra-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
export const unloadExternalFloodPraExample = (workbookId: string): Promise<ExternalFloodPraWorkbookResponse> => postJson(`/api/external-flood-pra-workbooks/${workbookId}/unload-example`, {});
