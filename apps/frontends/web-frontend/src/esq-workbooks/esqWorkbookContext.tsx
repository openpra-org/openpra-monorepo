import React, { createContext, useContext } from "react";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface EsqWorkbookData {
  esq: EventSequenceQuantification;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

const EsqWorkbookContext = createContext<EsqWorkbookData | null>(null);

function EsqWorkbookProvider({ data, children }: { data: EsqWorkbookData; children: React.ReactNode }): JSX.Element {
  return <EsqWorkbookContext.Provider value={data}>{children}</EsqWorkbookContext.Provider>;
}

function useEsqWorkbook(): EsqWorkbookData {
  const ctx = useContext(EsqWorkbookContext);
  if (ctx === null) throw new Error("useEsqWorkbook must be used inside EsqWorkbookProvider");
  return ctx;
}

export { EsqWorkbookProvider, useEsqWorkbook, type EsqWorkbookData };
