import React, { createContext, useContext } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface RiWorkbookData {
  ri: RiskIntegration;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const RiWorkbookContext = createContext<RiWorkbookData | null>(null);

function RiWorkbookProvider({ data, children }: { data: RiWorkbookData; children: React.ReactNode }): JSX.Element {
  return <RiWorkbookContext.Provider value={data}>{children}</RiWorkbookContext.Provider>;
}

function useRiWorkbook(): RiWorkbookData {
  const ctx = useContext(RiWorkbookContext);
  if (ctx === null) throw new Error("useRiWorkbook must be used inside RiWorkbookProvider");
  return ctx;
}

export { RiWorkbookProvider, useRiWorkbook, type RiWorkbookData };
