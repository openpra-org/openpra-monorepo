import React, { createContext, useContext } from "react";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type IePosLinkStatus } from "./ieWorkbookApi";

interface IeWorkbookData {
  ie: InitiatingEventsAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  posLink: IePosLinkStatus;
}

const IeWorkbookContext = createContext<IeWorkbookData | null>(null);

function IeWorkbookProvider({ data, children }: { data: IeWorkbookData; children: React.ReactNode }): JSX.Element {
  return <IeWorkbookContext.Provider value={data}>{children}</IeWorkbookContext.Provider>;
}

function useIeWorkbook(): IeWorkbookData {
  const ctx = useContext(IeWorkbookContext);
  if (ctx === null) throw new Error("useIeWorkbook must be used inside IeWorkbookProvider");
  return ctx;
}

export { IeWorkbookProvider, useIeWorkbook, type IeWorkbookData };
