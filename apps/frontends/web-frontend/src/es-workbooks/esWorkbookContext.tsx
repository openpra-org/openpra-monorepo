import React, { createContext, useContext } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type EsPosLinkStatus, type EsIeLinkStatus } from "./esWorkbookApi";

interface EsWorkbookData {
  es: EventSequenceAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  posLink: EsPosLinkStatus;
  ieLink: EsIeLinkStatus;
}

const EsWorkbookContext = createContext<EsWorkbookData | null>(null);

function EsWorkbookProvider({ data, children }: { data: EsWorkbookData; children: React.ReactNode }): JSX.Element {
  return <EsWorkbookContext.Provider value={data}>{children}</EsWorkbookContext.Provider>;
}

function useEsWorkbook(): EsWorkbookData {
  const ctx = useContext(EsWorkbookContext);
  if (ctx === null) throw new Error("useEsWorkbook must be used inside EsWorkbookProvider");
  return ctx;
}

export { EsWorkbookProvider, useEsWorkbook, type EsWorkbookData };
