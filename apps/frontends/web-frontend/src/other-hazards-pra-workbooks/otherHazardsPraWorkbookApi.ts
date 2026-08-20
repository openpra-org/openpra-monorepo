import { type OtherHazardsPRA } from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson } from "../api/client";

export type OtherHazardsPraWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";
export interface OtherHazardsPraWorkbookResponse { workbookId: string; projectId: string; ownerUsername: string; mef: OtherHazardsPRA; myRoles: OtherHazardsPraWorkbookRoleName[]; hasPreviousMef: boolean; updatedAt: string }
export interface OtherHazardsPraExampleOption { id: string; label: string }

export const getOtherHazardsPraWorkbook = (workbookId: string): Promise<OtherHazardsPraWorkbookResponse> => fetchJson(`/api/other-hazards-pra-workbooks/${workbookId}`);
export const patchOtherHazardsPraWorkbook = (workbookId: string, current: OtherHazardsPRA, mef: OtherHazardsPRA): Promise<OtherHazardsPraWorkbookResponse> => patchJson(`/api/other-hazards-pra-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
export const getOtherHazardsPraExamples = (): Promise<OtherHazardsPraExampleOption[]> => fetchJson("/api/example-workbooks/other-hazards-pra-examples");
export const loadOtherHazardsPraExample = (workbookId: string, exampleId?: string): Promise<OtherHazardsPraWorkbookResponse> => postJson(`/api/other-hazards-pra-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
export const unloadOtherHazardsPraExample = (workbookId: string): Promise<OtherHazardsPraWorkbookResponse> => postJson(`/api/other-hazards-pra-workbooks/${workbookId}/unload-example`, {});
