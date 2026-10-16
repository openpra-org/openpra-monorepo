import type { Workbook } from "interfaces-shared-types";
import type { MsLinkedWorkbooks } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getPosWorkbook } from "../pos-workbooks/posWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { getRiWorkbook } from "../ri-workbooks/riWorkbookApi";

type MsLinkCode = keyof MsLinkedWorkbooks;

interface MsLinkedWorkbookData {
  pos?: PlantOperatingStatesAnalysis;
  es?: EventSequenceAnalysis;
  ri?: RiskIntegration;
}

interface MsUpstream extends MsLinkedWorkbookData {
  options: Record<MsLinkCode, Workbook[]>;
}

const MS_LINK_CODES: MsLinkCode[] = ["POS", "ES", "RI"];
const NO_MS_UPSTREAM: MsUpstream = { options: { POS: [], ES: [], RI: [] } };

async function listMsLinkOptions(projectId: string): Promise<Record<MsLinkCode, Workbook[]>> {
  const lists = await Promise.all(MS_LINK_CODES.map(async (code) => {
    try {
      return (await listWorkbooks(projectId, code)).workbooks;
    } catch {
      return [];
    }
  }));
  return { POS: lists[0] ?? [], ES: lists[1] ?? [], RI: lists[2] ?? [] };
}

async function loadMsLinkedWorkbooks(ids: MsLinkedWorkbooks | undefined): Promise<MsLinkedWorkbookData> {
  const [pos, es, ri] = await Promise.all([
    ids?.POS ? getPosWorkbook(ids.POS).then((response) => response.mef, () => undefined) : Promise.resolve(undefined),
    ids?.ES ? getEsWorkbook(ids.ES).then((response) => response.mef, () => undefined) : Promise.resolve(undefined),
    ids?.RI ? getRiWorkbook(ids.RI).then((response) => response.mef, () => undefined) : Promise.resolve(undefined),
  ]);
  return { pos, es, ri };
}

function withMsLink(links: MsLinkedWorkbooks | undefined, code: MsLinkCode, workbookId: string): MsLinkedWorkbooks {
  const next: MsLinkedWorkbooks = {};
  for (const candidate of MS_LINK_CODES) {
    const value = candidate === code ? workbookId : links?.[candidate];
    if (value !== undefined && value.length > 0) next[candidate] = value;
  }
  return next;
}

export {
  MS_LINK_CODES,
  NO_MS_UPSTREAM,
  listMsLinkOptions,
  loadMsLinkedWorkbooks,
  withMsLink,
  type MsLinkCode,
  type MsLinkedWorkbookData,
  type MsUpstream,
};
