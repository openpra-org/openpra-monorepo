import React, { createContext, useContext } from "react";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface DaWorkbookData {
  da: DataAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const DaWorkbookContext = createContext<DaWorkbookData | null>(null);

function DaWorkbookProvider({ data, children }: { data: DaWorkbookData; children: React.ReactNode }): JSX.Element {
  return <DaWorkbookContext.Provider value={data}>{children}</DaWorkbookContext.Provider>;
}

function useDaWorkbook(): DaWorkbookData {
  const ctx = useContext(DaWorkbookContext);
  if (ctx === null) throw new Error("useDaWorkbook must be used inside DaWorkbookProvider");
  return ctx;
}

export { DaWorkbookProvider, useDaWorkbook, type DaWorkbookData };
