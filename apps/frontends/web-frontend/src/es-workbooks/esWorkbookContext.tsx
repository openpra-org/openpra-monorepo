import React, { createContext, useContext, useMemo } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type EsPosLinkStatus, type EsIeLinkStatus } from "./esWorkbookApi";

interface EsWorkbookData {
  projectId?: string;
  es: EventSequenceAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  posLink: EsPosLinkStatus;
  ieLink: EsIeLinkStatus;
}

type EsMutator = (es: EventSequenceAnalysis) => EventSequenceAnalysis;

interface EsWorkbookContextValue extends EsWorkbookData {
  editable: boolean;
  mutateEs: (mutator: EsMutator) => void;
}

const EsWorkbookContext = createContext<EsWorkbookContextValue | null>(null);

function EsWorkbookProvider({ data, editable, mutateEs, children }: {
  data: EsWorkbookData;
  editable: boolean;
  mutateEs: (mutator: EsMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<EsWorkbookContextValue>(
    () => ({ ...data, editable, mutateEs }),
    [data, editable, mutateEs],
  );
  return <EsWorkbookContext.Provider value={value}>{children}</EsWorkbookContext.Provider>;
}

function useEsWorkbook(): EsWorkbookContextValue {
  const ctx = useContext(EsWorkbookContext);
  if (ctx === null) throw new Error("useEsWorkbook must be used inside EsWorkbookProvider");
  return ctx;
}

export { EsWorkbookProvider, useEsWorkbook, type EsWorkbookData, type EsMutator };
