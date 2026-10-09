import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { type Workbook } from "interfaces-shared-types";
import type { RiRiskSources } from "../workbooks/riskWorkbookConnections";
import { type RiLinkCode } from "./riViewData";
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
}

interface RiWorkbookContextValue extends RiWorkbookData {
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
  riskSources: RiRiskSources;
  upstream: RiUpstream;
}

const RiWorkbookContext = createContext<RiWorkbookContextValue | null>(null);

const EMPTY_RISK_SOURCES: RiRiskSources = {
  eventSequenceFamilies: [],
  familyQuantifications: [],
  consequenceResults: [],
};

const EMPTY_UPSTREAM: RiUpstream = {
  options: { POS: [], ES: [], ESQ: [], MS: [], RC: [] },
};

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

function useRiUpstream(ri: RiskIntegration | undefined, options: Record<RiLinkCode, Workbook[]>): RiUpstream {
  const links = ri?.applicationContext?.linkedWorkbooks;
  const pos = useLinkedMef(links?.POS, loadLinkedPos);
  const es = useLinkedMef(links?.ES, loadLinkedEs);
  const esq = useLinkedMef(links?.ESQ, loadLinkedEsq);
  const ms = useLinkedMef(links?.MS, loadLinkedMs);
  const rc = useLinkedMef(links?.RC, loadLinkedRc);
  return useMemo<RiUpstream>(() => ({ options, pos, es, esq, ms, rc }), [options, pos, es, esq, ms, rc]);
}

function RiWorkbookProvider({ data, editable, mutateRi, riskSources = EMPTY_RISK_SOURCES, upstream = EMPTY_UPSTREAM, children }: {
  data: RiWorkbookData;
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
  riskSources?: RiRiskSources;
  upstream?: RiUpstream;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<RiWorkbookContextValue>(
    () => ({ ...data, editable, mutateRi, riskSources, upstream }),
    [data, editable, mutateRi, riskSources, upstream],
  );
  return <RiWorkbookContext.Provider value={value}>{children}</RiWorkbookContext.Provider>;
}

function useRiWorkbook(): RiWorkbookContextValue {
  const ctx = useContext(RiWorkbookContext);
  if (ctx === null) throw new Error("useRiWorkbook must be used inside RiWorkbookProvider");
  return ctx;
}

export { RiWorkbookProvider, useRiWorkbook, useRiUpstream, EMPTY_UPSTREAM, type RiWorkbookData, type RiMutator, type RiUpstream };
