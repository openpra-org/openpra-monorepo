import React, { createContext, useContext } from "react";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface ScWorkbookData {
  sc: SuccessCriteriaDevelopment;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const ScWorkbookContext = createContext<ScWorkbookData | null>(null);

function ScWorkbookProvider({ data, children }: { data: ScWorkbookData; children: React.ReactNode }): JSX.Element {
  return <ScWorkbookContext.Provider value={data}>{children}</ScWorkbookContext.Provider>;
}

function useScWorkbook(): ScWorkbookData {
  const ctx = useContext(ScWorkbookContext);
  if (ctx === null) throw new Error("useScWorkbook must be used inside ScWorkbookProvider");
  return ctx;
}

export { ScWorkbookProvider, useScWorkbook, type ScWorkbookData };
