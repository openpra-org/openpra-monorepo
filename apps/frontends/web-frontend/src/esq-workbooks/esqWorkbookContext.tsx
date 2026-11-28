import type { RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type EsqLinkCode, type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type Workbook } from "interfaces-shared-types";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import { syLinkRoots } from "../sy-workbooks/syLinks";
import { useLinkedScSources } from "../sc-workbooks/scMissionTimeSources";
import { type LinkRoot } from "../newly-developed-methods/shared/uncertaintyLinks";
import { liveEsqOf, missionTimeSourcesOf, parameterTableOf, withModelImported } from "./esqModel";
import { type EsqDaLink } from "./esqDaLinks";
import { IE_SYNC_IDLE, type EsqIeSyncStatus } from "./esqIeSync";
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
  ieSync: EsqIeSyncStatus;
  replaceLinkedSy: (workbookId: string, mef: SystemsAnalysis) => void;
}

const KEEP_LINKED_SY = (): void => undefined;

const EsqWorkbookContext = createContext<EsqWorkbookContextValue | null>(null);

interface LinkedMef<T> {
  id: string;
  mef?: T;
}

function useLinkedMef<T>(id: string | undefined, load: (id: string) => Promise<T>, reading: number): LinkedMef<T> | undefined {
  const [value, setValue] = useState<LinkedMef<T> | undefined>(undefined);
  useEffect(() => {
    if (id === undefined || id.length === 0) {
      setValue(undefined);
      return;
    }
    let cancelled = false;
    load(id)
      .then((mef) => { if (!cancelled) setValue((previous) => (previous !== undefined && previous.id === id && previous.mef !== undefined && JSON.stringify(previous.mef) === JSON.stringify(mef) ? previous : { id, mef })); })
      .catch(() => { if (!cancelled) setValue({ id }); });
    return () => { cancelled = true; };
  }, [id, load, reading]);
  return value !== undefined && value.id === id ? value : undefined;
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
    ...(esq.modelDecisions?.valueBindings ?? []).flatMap((binding) => root(binding.expression, false)),
  ];
}

interface EsqLinkedUpstream {
  upstream: EsqUpstream;
  refresh: () => Promise<void>;
}

function failed<T>(code: EsqLinkCode, entry: LinkedMef<T> | undefined): EsqLinkCode[] {
  return entry !== undefined && entry.mef === undefined ? [code] : [];
}

function useEsqUpstream(esq: EventSequenceQuantification | undefined, options: Record<EsqLinkCode, Workbook[]>): EsqLinkedUpstream {
  const [reading, setReading] = useState(0);
  const links = esq?.linkedWorkbooks;
  const esEntry = useLinkedMef(links?.ES, loadLinkedEs, reading);
  const syEntry = useLinkedMef(links?.SY, loadLinkedSy, reading);
  const daEntry = useLinkedMef(links?.DA, loadLinkedDa, reading);
  const hrEntry = useLinkedMef(links?.HRA, loadLinkedHr, reading);
  const ieEntry = useLinkedMef(links?.IE, loadLinkedIe, reading);
  const posEntry = useLinkedMef(links?.POS, loadLinkedPos, reading);
  const scEntry = useLinkedMef(links?.SC, loadLinkedSc, reading);
  const riEntry = useLinkedMef(links?.RI, loadLinkedRi, reading);
  const hsEntry = useLinkedMef(links?.HS, loadLinkedHs, reading);
  const es = esEntry?.mef, sy = syEntry?.mef, da = daEntry?.mef?.mef, daRevision = daEntry?.mef?.revision, hr = hrEntry?.mef, ie = ieEntry?.mef, pos = posEntry?.mef, sc = scEntry?.mef, ri = riEntry?.mef, hs = hsEntry?.mef;
  const unavailable = useMemo(() => [
    ...failed("ES", esEntry), ...failed("SY", syEntry), ...failed("DA", daEntry), ...failed("HRA", hrEntry), ...failed("IE", ieEntry),
    ...failed("POS", posEntry), ...failed("SC", scEntry), ...failed("RI", riEntry), ...failed("HS", hsEntry),
  ], [esEntry, syEntry, daEntry, hrEntry, ieEntry, posEntry, scEntry, riEntry, hsEntry]);
  const base = useMemo<EsqUpstream>(() => ({ options, es, sy, da, daRevision, hr, ie, pos, sc, ri, hs, scReferenced: [], ...(unavailable.length === 0 ? {} : { unavailable }) }), [options, es, sy, da, daRevision, hr, ie, pos, sc, ri, hs, unavailable]);
  const live = useMemo(() => (esq === undefined ? undefined : liveEsqOf(withModelImported(esq, base), da)), [esq, base, da]);
  const scRoots = useMemo(() => [...(live === undefined ? [] : esqLinkRoots(live)), ...(sy === undefined ? [] : syLinkRoots(sy))], [live, sy]);
  const scBaseTable = useMemo(() => (live === undefined ? new Map<string, UncertainParameter>() : parameterTableOf(live, missionTimeSourcesOf(live, { sc, scReferenced: [] }))), [live, sc]);
  const scReferenced = useLinkedScSources(scRoots, scBaseTable);
  const refresh = useCallback((): Promise<void> => {
    setReading((count) => count + 1);
    return Promise.resolve();
  }, []);
  const upstream = useMemo<EsqUpstream>(() => ({ ...base, scReferenced }), [base, scReferenced]);
  return useMemo<EsqLinkedUpstream>(() => ({ upstream, refresh }), [upstream, refresh]);
}

function EsqWorkbookProvider({ data, editable, runtime, mutateEsq, upstream = EMPTY_UPSTREAM, ieSync = IE_SYNC_IDLE, replaceLinkedSy = KEEP_LINKED_SY, children }: {
  data: EsqWorkbookData;
  editable: boolean;
  runtime?: EsqWorkbookRuntime;
  mutateEsq: (mutator: EsqMutator) => void;
  upstream?: EsqUpstream;
  ieSync?: EsqIeSyncStatus;
  replaceLinkedSy?: (workbookId: string, mef: SystemsAnalysis) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<EsqWorkbookContextValue>(
    () => ({
      ...data,
      esq: liveEsqOf(data.esq, upstream.da),
      editable,
      runtime: runtime ?? { workbookId: null, projectId: null, revision: null, saveStatus: "saved" },
      mutateEsq,
      upstream,
      ieSync,
      replaceLinkedSy,
    }),
    [data, editable, mutateEsq, runtime, upstream, ieSync, replaceLinkedSy],
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
