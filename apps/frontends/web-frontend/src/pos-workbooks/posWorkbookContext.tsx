import React, { createContext, useContext } from "react";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface PosWorkbookData {
  pos: PlantOperatingStatesAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const PosWorkbookContext = createContext<PosWorkbookData | null>(null);

function PosWorkbookProvider({ data, children }: { data: PosWorkbookData; children: React.ReactNode }): JSX.Element {
  return <PosWorkbookContext.Provider value={data}>{children}</PosWorkbookContext.Provider>;
}

function usePosWorkbook(): PosWorkbookData {
  const ctx = useContext(PosWorkbookContext);
  if (ctx === null) throw new Error("usePosWorkbook must be used inside PosWorkbookProvider");
  return ctx;
}

export { PosWorkbookProvider, usePosWorkbook, type PosWorkbookData };
