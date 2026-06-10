import React, { createContext, useContext } from "react";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface HrWorkbookData {
  hr: HumanReliabilityAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const HrWorkbookContext = createContext<HrWorkbookData | null>(null);

function HrWorkbookProvider({ data, children }: { data: HrWorkbookData; children: React.ReactNode }): JSX.Element {
  return <HrWorkbookContext.Provider value={data}>{children}</HrWorkbookContext.Provider>;
}

function useHrWorkbook(): HrWorkbookData {
  const ctx = useContext(HrWorkbookContext);
  if (ctx === null) throw new Error("useHrWorkbook must be used inside HrWorkbookProvider");
  return ctx;
}

export { HrWorkbookProvider, useHrWorkbook, type HrWorkbookData };
