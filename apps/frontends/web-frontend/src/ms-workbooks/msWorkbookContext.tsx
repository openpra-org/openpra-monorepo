import React, { createContext, useContext } from "react";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface MsWorkbookData {
  ms: MechanisticSourceTermAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const MsWorkbookContext = createContext<MsWorkbookData | null>(null);

function MsWorkbookProvider({ data, children }: { data: MsWorkbookData; children: React.ReactNode }): JSX.Element {
  return <MsWorkbookContext.Provider value={data}>{children}</MsWorkbookContext.Provider>;
}

function useMsWorkbook(): MsWorkbookData {
  const ctx = useContext(MsWorkbookContext);
  if (ctx === null) throw new Error("useMsWorkbook must be used inside MsWorkbookProvider");
  return ctx;
}

export { MsWorkbookProvider, useMsWorkbook, type MsWorkbookData };
