import React, { createContext, useContext } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface SyWorkbookData {
  sy: SystemsAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const SyWorkbookContext = createContext<SyWorkbookData | null>(null);

function SyWorkbookProvider({ data, children }: { data: SyWorkbookData; children: React.ReactNode }): JSX.Element {
  return <SyWorkbookContext.Provider value={data}>{children}</SyWorkbookContext.Provider>;
}

function useSyWorkbook(): SyWorkbookData {
  const ctx = useContext(SyWorkbookContext);
  if (ctx === null) throw new Error("useSyWorkbook must be used inside SyWorkbookProvider");
  return ctx;
}

export { SyWorkbookProvider, useSyWorkbook, type SyWorkbookData };
