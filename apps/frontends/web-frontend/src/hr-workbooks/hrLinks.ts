import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { HrLinkedWorkbooks } from "interfaces-mef-types/hr/human-reliability-analysis";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getPosWorkbook } from "../pos-workbooks/posWorkbookApi";
import { getIeWorkbook } from "../ie-workbooks/ieWorkbookApi";
import { getScWorkbook } from "../sc-workbooks/scWorkbookApi";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import type { HrLinkedInputs } from "./hrWorkbookContext";

type HrLinkCode = keyof HrLinkedWorkbooks;

interface HrLinkOption {
  workbookId: string;
  name: string;
}

interface HrLinkActions {
  available: (code: HrLinkCode) => Promise<HrLinkOption[]>;
  setLink: (code: HrLinkCode, workbookId: string | null) => void;
}

const HR_LINK_CODES: readonly HrLinkCode[] = ["POS", "IE", "SC", "SY", "DA"];

const EXAMPLE_PREFIX = "example-";

function exampleVariant(id: string): string | undefined {
  return id.startsWith(EXAMPLE_PREFIX) ? id.split("-").slice(2).join("-") : undefined;
}

function exampleLinks(variant: string): HrLinkedWorkbooks {
  const links: HrLinkedWorkbooks = {};
  for (const code of HR_LINK_CODES) links[code] = `${EXAMPLE_PREFIX}${code.toLowerCase()}-${variant}`;
  return links;
}

async function loadLinkedPos(id: string): Promise<PlantOperatingStatesAnalysis> {
  const variant = exampleVariant(id);
  if (variant !== undefined) return (await fetchJson<{ pos: { mef: PlantOperatingStatesAnalysis } }>(`/api/example-workbooks/pos-bundle?example=${encodeURIComponent(variant)}`)).pos.mef;
  return (await getPosWorkbook(id)).mef;
}

async function loadLinkedIe(id: string): Promise<InitiatingEventsAnalysis> {
  const variant = exampleVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ie: { mef: InitiatingEventsAnalysis } }>(`/api/example-workbooks/ie-bundle?example=${encodeURIComponent(variant)}`)).ie.mef;
  return (await getIeWorkbook(id)).mef;
}

async function loadLinkedSc(id: string): Promise<SuccessCriteriaDevelopment> {
  const variant = exampleVariant(id);
  if (variant !== undefined) return (await fetchJson<{ sc: { mef: SuccessCriteriaDevelopment } }>(`/api/example-workbooks/sc-bundle?example=${encodeURIComponent(variant)}`)).sc.mef;
  return (await getScWorkbook(id)).mef;
}

async function loadLinkedSy(id: string): Promise<SystemsAnalysis> {
  const variant = exampleVariant(id);
  if (variant !== undefined) return (await fetchJson<{ sy: { mef: SystemsAnalysis } }>(`/api/example-workbooks/sy-bundle?example=${encodeURIComponent(variant)}`)).sy.mef;
  return (await getSyWorkbook(id)).mef;
}

async function listHrLinkOptions(projectId: string, code: HrLinkCode): Promise<HrLinkOption[]> {
  return (await listWorkbooks(projectId, code)).workbooks.map((workbook) => ({ workbookId: workbook.id, name: workbook.name }));
}

function withLink(links: HrLinkedWorkbooks | undefined, code: HrLinkCode, workbookId: string | null): HrLinkedWorkbooks {
  const next: HrLinkedWorkbooks = {};
  for (const key of HR_LINK_CODES) {
    const value = key === code ? workbookId : links?.[key];
    if (value !== undefined && value !== null) next[key] = value;
  }
  return next;
}

function ieChoices(ie: InitiatingEventsAnalysis): { id: string; name: string }[] {
  const groups = ie.initiatingEventGroups.map((group) => ({ id: group.uuid, name: group.name }));
  const known = new Set(groups.map((group) => group.id));
  return [...groups, ...ie.initiators.filter((initiator) => !known.has(initiator.uuid)).map((initiator) => ({ id: initiator.uuid, name: initiator.name }))];
}

async function loadHrLinkedInputs(links: HrLinkedWorkbooks): Promise<HrLinkedInputs> {
  const [pos, ie, sc, sy] = await Promise.all([
    links.POS === undefined ? undefined : loadLinkedPos(links.POS),
    links.IE === undefined ? undefined : loadLinkedIe(links.IE),
    links.SC === undefined ? undefined : loadLinkedSc(links.SC),
    links.SY === undefined ? undefined : loadLinkedSy(links.SY),
  ]);
  return {
    posStates: (pos?.plantOperatingStates ?? []).map((state) => ({ id: state.uuid, name: state.name })),
    ieInitiators: ie === undefined ? [] : ieChoices(ie),
    scOperatorCriteria: (sc?.humanActionSuccessCriteria ?? []).map((criterion) => ({ id: criterion.uuid, description: criterion.description, timeAvailable: criterion.timeAvailable })),
    sySystems: (sy?.systemDefinitions ?? []).map((system) => ({ id: system.uuid, name: system.name })),
  };
}

export {
  HR_LINK_CODES,
  exampleLinks,
  listHrLinkOptions,
  loadHrLinkedInputs,
  withLink,
  type HrLinkActions,
  type HrLinkCode,
  type HrLinkOption,
};
