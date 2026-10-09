import type { RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type EsqLinkCode, type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type Workbook } from "interfaces-shared-types";
import { type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import { syLinkRoots } from "../sy-workbooks/syLinks";
import { useLinkedScSources } from "../sc-workbooks/scMissionTimeSources";
import { type LinkRoot } from "../newly-developed-methods/shared/uncertaintyLinks";
import { missionTimeSourcesOf, parameterTableOf } from "./esqModel";
import { type EsqDaLink } from "./esqDaLinks";
import {
  EMPTY_UPSTREAM,
  loadLinkedDa,
  loadLinkedEs,
  loadLinkedHr,
  loadLinkedHs,
  loadLinkedIe,
  loadLinkedPos,
  loadLinkedRi,
  loadLinkedSc,
  loadLinkedSy,
  type EsqUpstream,
} from "./esqLinks";

interface EsqWorkbookData {
  esq: EventSequenceQuantification;
  daLinks?: EsqDaLink[];
}

interface EsqWorkbookRuntime {
  saveStatus: RevisionedSaveStatus;
  workbookId: string | null;
  projectId: string | null;
  revision: number | null;
}

type EsqMutator = (esq: EventSequenceQuantification) => EventSequenceQuantification;

interface EsqWorkbookContextValue extends EsqWorkbookData {
  editable: boolean;
  runtime: EsqWorkbookRuntime;
  mutateEsq: (mutator: EsqMutator) => void;
  upstream: EsqUpstream;
}

const EsqWorkbookContext = createContext<EsqWorkbookContextValue | null>(null);

function useLinkedMef<T>(id: string | undefined, load: (id: string) => Promise<T>): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (id === undefined) {
      setValue(undefined);
      return;
    }
    let cancelled = false;
    load(id)
      .then((mef) => { if (!cancelled) setValue(mef); })
      .catch(() => { if (!cancelled) setValue(undefined); });
    return () => { cancelled = true; };
  }, [id, load]);
  return value;
}

function root(expression: UncertainExpression | undefined, missionTime: boolean): LinkRoot[] {
  return expression === undefined ? [] : [{ expression, missionTime }];
}

function esqLinkRoots(esq: EventSequenceQuantification): LinkRoot[] {
  const model = esq.model;
  if (model === undefined) return [];
  return [
    ...model.trees.flatMap((tree) => root(tree.missionTime, true)),
    ...model.events.flatMap((event) => [...root(event.expression, false), ...root(event.missionTime, true)]),
    ...model.parameters.flatMap((parameter) => [...root(parameter.estimate, false), ...root(parameter.missionTime, true)]),
    ...model.ccfGroups.flatMap((group) => root(group.total, false)),
  ];
}

function useEsqUpstream(esq: EventSequenceQuantification | undefined, options: Record<EsqLinkCode, Workbook[]>): EsqUpstream {
  const links = esq?.linkedWorkbooks;
  const es = useLinkedMef(links?.ES, loadLinkedEs);
  const sy = useLinkedMef(links?.SY, loadLinkedSy);
  const da = useLinkedMef(links?.DA, loadLinkedDa);
  const hr = useLinkedMef(links?.HRA, loadLinkedHr);
  const ie = useLinkedMef(links?.IE, loadLinkedIe);
  const pos = useLinkedMef(links?.POS, loadLinkedPos);
  const sc = useLinkedMef(links?.SC, loadLinkedSc);
  const ri = useLinkedMef(links?.RI, loadLinkedRi);
  const hs = useLinkedMef(links?.HS, loadLinkedHs);
  const scRoots = useMemo(() => [...(esq === undefined ? [] : esqLinkRoots(esq)), ...(sy === undefined ? [] : syLinkRoots(sy))], [esq, sy]);
  const scBaseTable = useMemo(() => (esq === undefined ? new Map<string, UncertainParameter>() : parameterTableOf(esq, missionTimeSourcesOf(esq, { sc, scReferenced: [] }))), [esq, sc]);
  const scReferenced = useLinkedScSources(scRoots, scBaseTable);
  return useMemo<EsqUpstream>(() => ({ options, es, sy, da, hr, ie, pos, sc, ri, hs, scReferenced }), [options, es, sy, da, hr, ie, pos, sc, ri, hs, scReferenced]);
}

function EsqWorkbookProvider({ data, editable, runtime, mutateEsq, upstream = EMPTY_UPSTREAM, children }: {
  data: EsqWorkbookData;
  editable: boolean;
  runtime?: EsqWorkbookRuntime;
  mutateEsq: (mutator: EsqMutator) => void;
  upstream?: EsqUpstream;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<EsqWorkbookContextValue>(
    () => ({
      ...data,
      editable,
      runtime: runtime ?? { workbookId: null, projectId: null, revision: null, saveStatus: "saved" },
      mutateEsq,
      upstream,
    }),
    [data, editable, mutateEsq, runtime, upstream],
  );
  return <EsqWorkbookContext.Provider value={value}>{children}</EsqWorkbookContext.Provider>;
}

function useEsqWorkbook(): EsqWorkbookContextValue {
  const ctx = useContext(EsqWorkbookContext);
  if (ctx === null) throw new Error("useEsqWorkbook must be used inside EsqWorkbookProvider");
  return ctx;
}

export {
  EsqWorkbookProvider,
  useEsqWorkbook,
  useEsqUpstream,
  type EsqWorkbookData,
  type EsqMutator,
  type EsqWorkbookRuntime,
};
