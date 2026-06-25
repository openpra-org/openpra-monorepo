import React, { createContext, useContext, useMemo } from "react";
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

type IeMutator = (ie: InitiatingEventsAnalysis) => InitiatingEventsAnalysis;

interface IeWorkbookContextValue extends IeWorkbookData {
  editable: boolean;
  mutateIe: (mutator: IeMutator) => void;
}

const IeWorkbookContext = createContext<IeWorkbookContextValue | null>(null);

function IeWorkbookProvider({ data, editable, mutateIe, children }: {
  data: IeWorkbookData;
  editable: boolean;
  mutateIe: (mutator: IeMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<IeWorkbookContextValue>(() => ({ ...data, editable, mutateIe }), [data, editable, mutateIe]);
  return <IeWorkbookContext.Provider value={value}>{children}</IeWorkbookContext.Provider>;
}

function useIeWorkbook(): IeWorkbookContextValue {
  const ctx = useContext(IeWorkbookContext);
  if (ctx === null) throw new Error("useIeWorkbook must be used inside IeWorkbookProvider");
  return ctx;
}

export { IeWorkbookProvider, useIeWorkbook, type IeWorkbookData, type IeMutator };
