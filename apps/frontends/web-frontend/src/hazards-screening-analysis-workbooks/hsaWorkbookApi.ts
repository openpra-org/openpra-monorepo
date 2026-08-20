import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { type HazardsScreeningAnalysis } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import { fetchJson, patchJson, postJson } from "../api/client";

export type HsaWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";
export interface HsaWorkbookResponse { workbookId: string; projectId: string; ownerUsername: string; mef: HazardsScreeningAnalysis; myRoles: HsaWorkbookRoleName[]; hasPreviousMef: boolean; updatedAt: string }
export interface HsaExampleOption { id: string; label: string }
export const getHsaWorkbook = (workbookId: string): Promise<HsaWorkbookResponse> => fetchJson(`/api/hazards-screening-analysis-workbooks/${workbookId}`);
export const patchHsaWorkbook = (workbookId: string, current: HazardsScreeningAnalysis, mef: HazardsScreeningAnalysis): Promise<HsaWorkbookResponse> => patchJson(`/api/hazards-screening-analysis-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
export const getHsaExamples = (): Promise<HsaExampleOption[]> => fetchJson("/api/example-workbooks/hazards-screening-analysis-examples");
export const loadHsaExample = (workbookId: string, exampleId?: string): Promise<HsaWorkbookResponse> => postJson(`/api/hazards-screening-analysis-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
export const unloadHsaExample = (workbookId: string): Promise<HsaWorkbookResponse> => postJson(`/api/hazards-screening-analysis-workbooks/${workbookId}/unload-example`, {});
