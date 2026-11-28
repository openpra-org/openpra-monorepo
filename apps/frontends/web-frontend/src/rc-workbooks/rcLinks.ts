import { useCallback, useEffect, useMemo, useState } from "react";
import type { Workbook } from "interfaces-shared-types";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { RadiologicalConsequenceAnalysis, RcLinkedWorkbooks } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import type { RcStepLinks } from "interfaces-shared-types/rc-workbooks/step-checks";
import {
  rcCategoriesNotListed,
  rcFeedbackIsTyped,
  rcListedCategoryIds,
  rcSourceStandsIn,
  rcTypedSourceCategories,
  rcWithCategoriesReplaced,
  rcWithTypedFeedbackReplaced,
  rcWithTypedSourcesReplaced,
  type RcLinkedData,
} from "interfaces-shared-types/rc-workbooks/linked-data";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { getMsWorkbook } from "../ms-workbooks/msWorkbookApi";
import { getRiWorkbook } from "../ri-workbooks/riWorkbookApi";

type RcLinkCode = keyof RcLinkedWorkbooks;
type RcMutation = (rc: RadiologicalConsequenceAnalysis) => RadiologicalConsequenceAnalysis;

interface RcLinks {
  options: Record<RcLinkCode, Workbook[]>;
  es?: EventSequenceAnalysis;
  ms?: MechanisticSourceTermAnalysis;
  ri?: RiskIntegration;
  riMeasures?: string[];
  unavailable?: readonly RcLinkCode[];
}

interface RcLinkedReading {
  links: RcLinks;
  linked: RcLinkedData;
  refresh: () => Promise<void>;
}

interface RcLinkReplacement {
  replaced?: string;
  replace: RcMutation;
}

interface LinkedMef<T> {
  id: string;
  mef?: T;
}

const RC_LINK_CODES: RcLinkCode[] = ["ES", "MS", "RI"];
const NO_RC_LINKS: RcLinks = { options: { ES: [], MS: [], RI: [] } };
const NO_RC_LINKED_DATA: RcLinkedData = {};

const RC_EXAMPLE_VARIANT_LABELS: Record<string, string> = {
  htgr: "Generic HTGR",
  sfr: "Generic SFR",
  hcl: "HCL",
};

function rcExampleLinkVariant(id: string): string | undefined {
  return id.startsWith("example-") ? id.split("-").slice(2).join("-") : undefined;
}

function rcExampleLinkLabel(id: string): string | undefined {
  const variant = rcExampleLinkVariant(id);
  if (variant === undefined) return undefined;
  return `${RC_EXAMPLE_VARIANT_LABELS[variant] ?? variant} example`;
}

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

async function loadRcLinkedEs(id: string): Promise<EventSequenceAnalysis> {
  const variant = rcExampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ es: { mef: EventSequenceAnalysis } }>(`/api/example-workbooks/es-bundle?example=${variant}`)).es.mef;
  return (await getEsWorkbook(id)).mef;
}

async function loadRcLinkedMs(id: string): Promise<MechanisticSourceTermAnalysis> {
  const variant = rcExampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ms: { mef: MechanisticSourceTermAnalysis } }>(`/api/example-workbooks/ms-bundle?example=${variant}`)).ms.mef;
  return (await getMsWorkbook(id)).mef;
}

async function loadRcLinkedRi(id: string): Promise<RiskIntegration> {
  const variant = rcExampleLinkVariant(id);
  if (variant !== undefined) return (await fetchJson<{ ri: { mef: RiskIntegration } }>(`/api/example-workbooks/ri-bundle?example=${variant}`)).ri.mef;
  return (await getRiWorkbook(id)).mef;
}

function useRcLinkedMef<T>(id: string | undefined, load: (id: string) => Promise<T>, reading: number): LinkedMef<T> | undefined {
  const [value, setValue] = useState<LinkedMef<T> | undefined>(undefined);
  useEffect(() => {
    if (id === undefined) {
      setValue(undefined);
      return;
    }
    let cancelled = false;
    load(id)
      .then((mef) => {
        if (cancelled) return;
        setValue((previous) => (previous !== undefined && previous.id === id && previous.mef !== undefined && JSON.stringify(previous.mef) === JSON.stringify(mef) ? previous : { id, mef }));
      })
      .catch(() => { if (!cancelled) setValue({ id }); });
    return () => { cancelled = true; };
  }, [id, load, reading]);
  return value !== undefined && value.id === id ? value : undefined;
}

function linkId(id: string | undefined): string | undefined {
  return id === undefined || id.length === 0 ? undefined : id;
}

function useRcLinkedWorkbooks(ids: RcLinkedWorkbooks | undefined, options: Record<RcLinkCode, Workbook[]>): RcLinkedReading {
  const [reading, setReading] = useState(0);
  const es = useRcLinkedMef(linkId(ids?.ES), loadRcLinkedEs, reading);
  const ms = useRcLinkedMef(linkId(ids?.MS), loadRcLinkedMs, reading);
  const ri = useRcLinkedMef(linkId(ids?.RI), loadRcLinkedRi, reading);
  const refresh = useCallback((): Promise<void> => {
    setReading((count) => count + 1);
    return Promise.resolve();
  }, []);
  const links = useMemo<RcLinks>(() => {
    const read: Record<RcLinkCode, boolean> = {
      ES: es === undefined || es.mef !== undefined,
      MS: ms === undefined || ms.mef !== undefined,
      RI: ri === undefined || ri.mef !== undefined,
    };
    const unavailable = RC_LINK_CODES.filter((code) => !read[code]);
    return {
      options,
      ...(es?.mef === undefined ? {} : { es: es.mef }),
      ...(ms?.mef === undefined ? {} : { ms: ms.mef }),
      ...(ri?.mef === undefined ? {} : { ri: ri.mef, riMeasures: ri.mef.scopeDefinition.consequenceMeasures.map((measure) => measure.name).filter((name) => name.trim().length > 0) }),
      ...(unavailable.length === 0 ? {} : { unavailable }),
    };
  }, [options, es, ms, ri]);
  const linked = useMemo<RcLinkedData>(() => ({
    ...(es?.mef === undefined ? {} : { es: { workbookId: es.id, analysis: es.mef } }),
    ...(ms?.mef === undefined ? {} : { ms: { workbookId: ms.id, analysis: ms.mef } }),
    ...(ri?.mef === undefined ? {} : { ri: { workbookId: ri.id, analysis: ri.mef } }),
  }), [es, ms, ri]);
  return useMemo<RcLinkedReading>(() => ({ links, linked, refresh }), [links, linked, refresh]);
}

function rcStepLinks(rc: RadiologicalConsequenceAnalysis, links: RcLinks, linked: RcLinkedData): RcStepLinks {
  const es = linked.es;
  const typedSources = linked.ms === undefined ? [] : rc.releaseCategoryToConsequence.releaseCategoryInputs.filter((category) => rcSourceStandsIn(category, linked)).map((category) => category.releaseCategory);
  const unavailable = links.unavailable ?? [];
  return {
    ...(es === undefined ? {} : { es: {
      workbookId: es.workbookId,
      families: es.analysis.eventSequenceFamilies.map((family) => ({ uuid: family.uuid, name: family.name, releaseCategoryIds: family.releaseCategoryIds ?? [], memberSequenceIds: family.memberSequenceIds })),
      categoryIds: rcListedCategoryIds(es.analysis),
    } }),
    ...(linked.ri === undefined || links.riMeasures === undefined ? {} : { riMeasures: links.riMeasures }),
    ...(typedSources.length === 0 ? {} : { typedSources }),
    ...(unavailable.length === 0 ? {} : { unavailable: [...unavailable] }),
  };
}

function namedList(ids: readonly string[]): string {
  return ids.join(", ");
}

async function loadRcLinkReplacement(code: RcLinkCode, workbookId: string, rc: RadiologicalConsequenceAnalysis): Promise<RcLinkReplacement> {
  const firstLink = linkId(rc.linkedWorkbooks?.[code]) === undefined;
  if (code === "ES") {
    const es = await loadRcLinkedEs(workbookId);
    const dropped = firstLink ? rcCategoriesNotListed(rc, es) : [];
    if (dropped.length === 0) return { replace: (draft) => draft };
    return { replaced: `the release categories entered here (${namedList(dropped)})`, replace: (draft) => rcWithCategoriesReplaced(draft, es) };
  }
  if (code === "MS") {
    const ms = await loadRcLinkedMs(workbookId);
    const typed = firstLink ? rcTypedSourceCategories(rc, ms) : [];
    if (typed.length === 0) return { replace: (draft) => draft };
    return { replaced: `the source terms entered here (${namedList(typed)})`, replace: (draft) => rcWithTypedSourcesReplaced(draft, ms) };
  }
  await loadRcLinkedRi(workbookId);
  if (!firstLink || !rcFeedbackIsTyped(rc)) return { replace: (draft) => draft };
  return { replaced: "the RI feedback entered in Step 08", replace: rcWithTypedFeedbackReplaced };
}

export {
  RC_LINK_CODES,
  NO_RC_LINKS,
  NO_RC_LINKED_DATA,
  listRcLinkOptions,
  loadRcLinkReplacement,
  rcExampleLinkLabel,
  rcStepLinks,
  useRcLinkedWorkbooks,
  type RcLinkCode,
  type RcLinks,
  type RcLinkedReading,
  type RcLinkReplacement,
  type RcMutation,
};
