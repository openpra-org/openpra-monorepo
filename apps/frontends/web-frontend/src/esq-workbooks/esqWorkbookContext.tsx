import type { RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type EsqLinkCode, type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type Workbook } from "interfaces-shared-types";
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
  return useMemo<EsqUpstream>(() => ({ options, es, sy, da, hr, ie, pos, sc, ri, hs }), [options, es, sy, da, hr, ie, pos, sc, ri, hs]);
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
