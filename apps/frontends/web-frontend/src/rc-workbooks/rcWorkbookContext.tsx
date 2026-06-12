import React, { createContext, useContext } from "react";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface RcWorkbookData {
  rc: RadiologicalConsequenceAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const RcWorkbookContext = createContext<RcWorkbookData | null>(null);

function RcWorkbookProvider({ data, children }: { data: RcWorkbookData; children: React.ReactNode }): JSX.Element {
  return <RcWorkbookContext.Provider value={data}>{children}</RcWorkbookContext.Provider>;
}

function useRcWorkbook(): RcWorkbookData {
  const ctx = useContext(RcWorkbookContext);
  if (ctx === null) throw new Error("useRcWorkbook must be used inside RcWorkbookProvider");
  return ctx;
}

export { RcWorkbookProvider, useRcWorkbook, type RcWorkbookData };
