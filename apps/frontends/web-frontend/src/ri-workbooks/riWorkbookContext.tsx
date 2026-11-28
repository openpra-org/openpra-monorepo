import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type RiLinkedWorkbooks, type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { type Workbook } from "interfaces-shared-types";
import { RI_LINK_CODES, type RiLinkCode } from "./riViewData";
import { loadLinkedEs, loadLinkedEsq, loadLinkedMs, loadLinkedPos, loadLinkedRc } from "./riWorkbookApi";

interface RiWorkbookData {
  ri: RiskIntegration;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type RiMutator = (ri: RiskIntegration) => RiskIntegration;

interface RiUpstream {
  options: Record<RiLinkCode, Workbook[]>;
  pos?: PlantOperatingStatesAnalysis;
  es?: EventSequenceAnalysis;
  esq?: EventSequenceQuantification;
  ms?: MechanisticSourceTermAnalysis;
  rc?: RadiologicalConsequenceAnalysis;
  unavailable?: readonly RiLinkCode[];
}

interface RiLinkedUpstream {
  upstream: RiUpstream;
  refresh: () => Promise<void>;
}

interface RiWorkbookContextValue extends RiWorkbookData {
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
  upstream: RiUpstream;
}

interface LinkedMef<T> {
  id: string;
  mef?: T;
}

const RiWorkbookContext = createContext<RiWorkbookContextValue | null>(null);

const EMPTY_UPSTREAM: RiUpstream = {
  options: { POS: [], ES: [], ESQ: [], MS: [], RC: [] },
};

function useLinkedMef<T>(id: string | undefined, load: (id: string) => Promise<T>, reading: number): LinkedMef<T> | undefined {
  const [value, setValue] = useState<LinkedMef<T> | undefined>(undefined);
  useEffect(() => {
    if (id === undefined) {
      setValue(undefined);
      return;
    }
    let cancelled = false;
    load(id)
      .then((mef) => { if (!cancelled) setValue({ id, mef }); })
      .catch(() => { if (!cancelled) setValue({ id }); });
    return () => { cancelled = true; };
  }, [id, load, reading]);
  return value !== undefined && value.id === id ? value : undefined;
}

function useRiUpstream(links: RiLinkedWorkbooks | undefined, options: Record<RiLinkCode, Workbook[]>): RiLinkedUpstream {
  const [reading, setReading] = useState(0);
  const pos = useLinkedMef(links?.POS, loadLinkedPos, reading);
  const es = useLinkedMef(links?.ES, loadLinkedEs, reading);
  const esq = useLinkedMef(links?.ESQ, loadLinkedEsq, reading);
  const ms = useLinkedMef(links?.MS, loadLinkedMs, reading);
  const rc = useLinkedMef(links?.RC, loadLinkedRc, reading);
  const refresh = useCallback((): Promise<void> => {
    setReading((count) => count + 1);
    return Promise.resolve();
  }, []);
  const upstream = useMemo<RiUpstream>(() => {
    const read: Record<RiLinkCode, boolean> = {
      POS: pos === undefined || pos.mef !== undefined,
      ES: es === undefined || es.mef !== undefined,
      ESQ: esq === undefined || esq.mef !== undefined,
      MS: ms === undefined || ms.mef !== undefined,
      RC: rc === undefined || rc.mef !== undefined,
    };
    const unavailable = RI_LINK_CODES.filter((code) => !read[code]);
    return {
      options,
      ...(pos?.mef === undefined ? {} : { pos: pos.mef }),
      ...(es?.mef === undefined ? {} : { es: es.mef }),
      ...(esq?.mef === undefined ? {} : { esq: esq.mef }),
      ...(ms?.mef === undefined ? {} : { ms: ms.mef }),
      ...(rc?.mef === undefined ? {} : { rc: rc.mef }),
      ...(unavailable.length === 0 ? {} : { unavailable }),
    };
  }, [options, pos, es, esq, ms, rc]);
  return useMemo<RiLinkedUpstream>(() => ({ upstream, refresh }), [upstream, refresh]);
}

function RiWorkbookProvider({ data, editable, mutateRi, upstream = EMPTY_UPSTREAM, children }: {
  data: RiWorkbookData;
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
  upstream?: RiUpstream;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<RiWorkbookContextValue>(
    () => ({ ...data, editable, mutateRi, upstream }),
    [data, editable, mutateRi, upstream],
  );
  return <RiWorkbookContext.Provider value={value}>{children}</RiWorkbookContext.Provider>;
}

function useRiWorkbook(): RiWorkbookContextValue {
  const ctx = useContext(RiWorkbookContext);
  if (ctx === null) throw new Error("useRiWorkbook must be used inside RiWorkbookProvider");
  return ctx;
}

export { RiWorkbookProvider, useRiWorkbook, useRiUpstream, EMPTY_UPSTREAM, type RiWorkbookData, type RiMutator, type RiUpstream };
