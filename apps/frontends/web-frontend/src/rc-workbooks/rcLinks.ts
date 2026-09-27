import type { Workbook } from "interfaces-shared-types";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { RadiologicalConsequenceAnalysis, RcLinkedWorkbooks } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcStepLinks } from "interfaces-shared-types/rc-workbooks/step-checks";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { getMsWorkbook } from "../ms-workbooks/msWorkbookApi";
import { getRiWorkbook } from "../ri-workbooks/riWorkbookApi";

type RcLinkCode = keyof RcLinkedWorkbooks;

interface RcLinkedWorkbookData {
  es?: EventSequenceAnalysis;
  ms?: MechanisticSourceTermAnalysis;
  riMeasures?: string[];
}

interface RcLinks extends RcLinkedWorkbookData {
  options: Record<RcLinkCode, Workbook[]>;
}

const RC_LINK_CODES: RcLinkCode[] = ["ES", "MS", "RI"];
const NO_RC_LINKS: RcLinks = { options: { ES: [], MS: [], RI: [] } };

async function listRcLinkOptions(projectId: string): Promise<Record<RcLinkCode, Workbook[]>> {
  const lists = await Promise.all(RC_LINK_CODES.map(async (code) => {
    try {
      return (await listWorkbooks(projectId, code)).workbooks;
    } catch {
      return [];
    }
  }));
  return { ES: lists[0] ?? [], MS: lists[1] ?? [], RI: lists[2] ?? [] };
}

async function loadRcLinkedWorkbooks(ids: RcLinkedWorkbooks | undefined): Promise<RcLinkedWorkbookData> {
  const [es, ms, ri] = await Promise.all([
    ids?.ES ? getEsWorkbook(ids.ES).then((response) => response.mef, () => undefined) : Promise.resolve(undefined),
    ids?.MS ? getMsWorkbook(ids.MS).then((response) => response.mef, () => undefined) : Promise.resolve(undefined),
    ids?.RI ? getRiWorkbook(ids.RI).then((response) => response.mef, () => undefined) : Promise.resolve(undefined),
  ]);
  return { es, ms, riMeasures: ri?.scopeDefinition.consequenceMeasures.map((measure) => measure.name).filter((name) => name.trim()) };
}

function rcStepLinks(rc: RadiologicalConsequenceAnalysis, links: RcLinks): RcStepLinks {
  const esId = rc.linkedWorkbooks?.ES;
  return {
    ...(esId && links.es ? { es: { workbookId: esId, families: links.es.eventSequenceFamilies.map((family) => ({
      uuid: family.uuid, name: family.name, releaseCategoryIds: family.releaseCategoryIds ?? [], memberSequenceIds: family.memberSequenceIds })) } } : {}),
    ...(rc.linkedWorkbooks?.RI && links.riMeasures ? { riMeasures: links.riMeasures } : {}),
  };
}

export {
  RC_LINK_CODES,
  NO_RC_LINKS,
  listRcLinkOptions,
  loadRcLinkedWorkbooks,
  rcStepLinks,
  type RcLinkCode,
  type RcLinks,
  type RcLinkedWorkbookData,
};
