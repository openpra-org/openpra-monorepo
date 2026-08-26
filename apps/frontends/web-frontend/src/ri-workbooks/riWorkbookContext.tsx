import React, { createContext, useContext, useMemo } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import type { RiRiskSources } from "../workbooks/riskWorkbookConnections";

interface RiWorkbookData {
  ri: RiskIntegration;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type RiMutator = (ri: RiskIntegration) => RiskIntegration;

interface RiWorkbookContextValue extends RiWorkbookData {
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
  riskSources: RiRiskSources;
}

const RiWorkbookContext = createContext<RiWorkbookContextValue | null>(null);

const EMPTY_RISK_SOURCES: RiRiskSources = {
  eventSequenceFamilies: [],
  familyQuantifications: [],
  consequenceResults: [],
};

function RiWorkbookProvider({ data, editable, mutateRi, riskSources = EMPTY_RISK_SOURCES, children }: {
  data: RiWorkbookData;
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
  riskSources?: RiRiskSources;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<RiWorkbookContextValue>(
    () => ({ ...data, editable, mutateRi, riskSources }),
    [data, editable, mutateRi, riskSources],
  );
  return <RiWorkbookContext.Provider value={value}>{children}</RiWorkbookContext.Provider>;
}

function useRiWorkbook(): RiWorkbookContextValue {
  const ctx = useContext(RiWorkbookContext);
  if (ctx === null) throw new Error("useRiWorkbook must be used inside RiWorkbookProvider");
  return ctx;
}

export { RiWorkbookProvider, useRiWorkbook, type RiWorkbookData, type RiMutator };
