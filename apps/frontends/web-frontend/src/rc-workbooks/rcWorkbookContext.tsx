import React, { createContext, useContext, useMemo } from "react";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import type { EventSequenceFamilySource } from "../workbooks/riskWorkbookConnections";

interface RcWorkbookData {
  rc: RadiologicalConsequenceAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type RcMutator = (rc: RadiologicalConsequenceAnalysis) => RadiologicalConsequenceAnalysis;

interface RcWorkbookContextValue extends RcWorkbookData {
  editable: boolean;
  mutateRc: (mutator: RcMutator) => void;
  eventSequenceFamilySources: EventSequenceFamilySource[];
}

const RcWorkbookContext = createContext<RcWorkbookContextValue | null>(null);

function RcWorkbookProvider({ data, editable, mutateRc, eventSequenceFamilySources = [], children }: {
  data: RcWorkbookData;
  editable: boolean;
  mutateRc: (mutator: RcMutator) => void;
  eventSequenceFamilySources?: EventSequenceFamilySource[];
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<RcWorkbookContextValue>(
    () => ({ ...data, editable, mutateRc, eventSequenceFamilySources }),
    [data, editable, mutateRc, eventSequenceFamilySources],
  );
  return <RcWorkbookContext.Provider value={value}>{children}</RcWorkbookContext.Provider>;
}

function useRcWorkbook(): RcWorkbookContextValue {
  const ctx = useContext(RcWorkbookContext);
  if (ctx === null) throw new Error("useRcWorkbook must be used inside RcWorkbookProvider");
  return ctx;
}

export { RcWorkbookProvider, useRcWorkbook, type RcWorkbookData, type RcMutator };
