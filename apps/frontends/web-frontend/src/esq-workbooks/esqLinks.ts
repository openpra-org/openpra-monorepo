import type { Workbook } from "interfaces-shared-types";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EsqLinkCode } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { HazardsScreeningAnalysis } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getDaWorkbook } from "../da-workbooks/daWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { getHsaWorkbook } from "../hazards-screening-analysis-workbooks/hsaWorkbookApi";
import { getHrWorkbook } from "../hr-workbooks/hrWorkbookApi";
import { getIeWorkbook } from "../ie-workbooks/ieWorkbookApi";
import { getPosWorkbook } from "../pos-workbooks/posWorkbookApi";
import { getRiWorkbook } from "../ri-workbooks/riWorkbookApi";
import { getScWorkbook } from "../sc-workbooks/scWorkbookApi";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { type ScMissionTimeSource } from "../sc-workbooks/scMissionTimeSources";
import { exampleLinkVariant } from "./esqViewData";

interface EsqLinkedDa {
  mef: DataAnalysis;
  revision: number;
}

interface EsqUpstream {
  options: Record<EsqLinkCode, Workbook[]>;
  es?: EventSequenceAnalysis;
  sy?: SystemsAnalysis;
  da?: DataAnalysis;
  daRevision?: number;
  hr?: HumanReliabilityAnalysis;
  ie?: InitiatingEventsAnalysis;
  pos?: PlantOperatingStatesAnalysis;
  sc?: SuccessCriteriaDevelopment;
  ri?: RiskIntegration;
  hs?: HazardsScreeningAnalysis;
  scReferenced: ScMissionTimeSource[];
}

const NO_LINK_OPTIONS: Record<EsqLinkCode, Workbook[]> = { ES: [], SY: [], DA: [], HRA: [], IE: [], POS: [], SC: [], RI: [], HS: [] };

const EMPTY_UPSTREAM: EsqUpstream = { options: NO_LINK_OPTIONS, scReferenced: [] };

async function listLinkOptions(projectId: string, code: EsqLinkCode): Promise<Workbook[]> {
  try {
    return (await listWorkbooks(projectId, code)).workbooks;
  } catch {
    return [];
  }
}

async function listEsqLinkOptions(projectId: string): Promise<Record<EsqLinkCode, Workbook[]>> {
  const [ES, SY, DA, HRA, IE, POS, SC, RI, HS] = await Promise.all([
    listLinkOptions(projectId, "ES"),
    listLinkOptions(projectId, "SY"),
    listLinkOptions(projectId, "DA"),
    listLinkOptions(projectId, "HRA"),
    listLinkOptions(projectId, "IE"),
    listLinkOptions(projectId, "POS"),
    listLinkOptions(projectId, "SC"),
    listLinkOptions(projectId, "RI"),
    listLinkOptions(projectId, "HS"),
  ]);
  return { ES, SY, DA, HRA, IE, POS, SC, RI, HS };
}

async function loadLinkedEs(id: string): Promise<EventSequenceAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ es: { mef: EventSequenceAnalysis } }>(`/api/example-workbooks/es-bundle?example=${variant}`)).es.mef;
  return (await getEsWorkbook(id)).mef;
}

async function loadLinkedSy(id: string): Promise<SystemsAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ sy: { mef: SystemsAnalysis } }>(`/api/example-workbooks/sy-bundle?example=${variant}`)).sy.mef;
  return (await getSyWorkbook(id)).mef;
}

async function loadLinkedDa(id: string): Promise<EsqLinkedDa> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return { mef: (await fetchJson<{ da: { mef: DataAnalysis } }>(`/api/example-workbooks/da-bundle?example=${variant}`)).da.mef, revision: 1 };
  const workbook = await getDaWorkbook(id);
  return { mef: workbook.mef, revision: workbook.revision };
}

async function loadLinkedHr(id: string): Promise<HumanReliabilityAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ hr: { mef: HumanReliabilityAnalysis } }>(`/api/example-workbooks/hr-bundle?example=${variant}`)).hr.mef;
  return (await getHrWorkbook(id)).mef;
}

async function loadLinkedIe(id: string): Promise<InitiatingEventsAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ie: { mef: InitiatingEventsAnalysis } }>(`/api/example-workbooks/ie-bundle?example=${variant}`)).ie.mef;
  return (await getIeWorkbook(id)).mef;
}

async function loadLinkedPos(id: string): Promise<PlantOperatingStatesAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ pos: { mef: PlantOperatingStatesAnalysis } }>(`/api/example-workbooks/pos-bundle?example=${variant}`)).pos.mef;
  return (await getPosWorkbook(id)).mef;
}

async function loadLinkedSc(id: string): Promise<SuccessCriteriaDevelopment> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ sc: { mef: SuccessCriteriaDevelopment } }>(`/api/example-workbooks/sc-bundle?example=${variant}`)).sc.mef;
  return (await getScWorkbook(id)).mef;
}

async function loadLinkedRi(id: string): Promise<RiskIntegration> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ri: { mef: RiskIntegration } }>(`/api/example-workbooks/ri-bundle?example=${variant}`)).ri.mef;
  return (await getRiWorkbook(id)).mef;
}

async function loadLinkedHs(id: string): Promise<HazardsScreeningAnalysis> {
  const variant = exampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ hazardsScreeningAnalysis: { mef: HazardsScreeningAnalysis } }>(`/api/example-workbooks/hazards-screening-analysis-bundle?example=${variant}`)).hazardsScreeningAnalysis.mef;
  return (await getHsaWorkbook(id)).mef;
}

export {
  EMPTY_UPSTREAM,
  NO_LINK_OPTIONS,
  listEsqLinkOptions,
  loadLinkedDa,
  loadLinkedEs,
  loadLinkedHr,
  loadLinkedHs,
  loadLinkedIe,
  loadLinkedPos,
  loadLinkedRi,
  loadLinkedSc,
  loadLinkedSy,
  type EsqLinkedDa,
  type EsqUpstream,
};
