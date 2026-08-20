import React, { createContext, useContext, useMemo } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface RiWorkbookData {
  ri: RiskIntegration;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type RiMutator = (ri: RiskIntegration) => RiskIntegration;

interface RiWorkbookContextValue extends RiWorkbookData {
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
}

const RiWorkbookContext = createContext<RiWorkbookContextValue | null>(null);

function RiWorkbookProvider({ data, editable, mutateRi, children }: {
  data: RiWorkbookData;
  editable: boolean;
  mutateRi: (mutator: RiMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<RiWorkbookContextValue>(
    () => ({ ...data, editable, mutateRi }),
    [data, editable, mutateRi],
  );
  return <RiWorkbookContext.Provider value={value}>{children}</RiWorkbookContext.Provider>;
}

function useRiWorkbook(): RiWorkbookContextValue {
  const ctx = useContext(RiWorkbookContext);
  if (ctx === null) throw new Error("useRiWorkbook must be used inside RiWorkbookProvider");
  return ctx;
}

export { RiWorkbookProvider, useRiWorkbook, type RiWorkbookData, type RiMutator };
