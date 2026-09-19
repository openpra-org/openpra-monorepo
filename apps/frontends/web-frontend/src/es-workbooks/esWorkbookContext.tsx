import React, { createContext, useContext, useMemo } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type EsPosLinkStatus, type EsIeLinkStatus } from "./esWorkbookApi";

interface EsFaultTreeSource {
  workbookId: string;
  workbookName: string;
  mef: SystemsAnalysis;
}

interface EsWorkbookData {
  projectId?: string;
  faultTreeSource?: EsFaultTreeSource;
  es: EventSequenceAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  posLink: EsPosLinkStatus;
  ieLink: EsIeLinkStatus;
}

interface EsWorkbookRuntime {
  workbookId: string | null;
  revision: number | null;
  saveState: "saving" | "saved" | "failed";
}

type EsMutator = (es: EventSequenceAnalysis) => EventSequenceAnalysis;

interface EsWorkbookContextValue extends EsWorkbookData {
  editable: boolean;
  runtime: EsWorkbookRuntime;
  mutateEs: (mutator: EsMutator) => void;
}

const EsWorkbookContext = createContext<EsWorkbookContextValue | null>(null);

function EsWorkbookProvider({ data, editable, runtime, mutateEs, children }: {
  data: EsWorkbookData;
  editable: boolean;
  runtime?: EsWorkbookRuntime;
  mutateEs: (mutator: EsMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<EsWorkbookContextValue>(
    () => ({ ...data, editable, runtime: runtime ?? { workbookId: null, revision: null, saveState: "saved" }, mutateEs }),
    [data, editable, mutateEs, runtime],
  );
  return <EsWorkbookContext.Provider value={value}>{children}</EsWorkbookContext.Provider>;
}

function useEsWorkbook(): EsWorkbookContextValue {
  const ctx = useContext(EsWorkbookContext);
  if (ctx === null) throw new Error("useEsWorkbook must be used inside EsWorkbookProvider");
  return ctx;
}

export { EsWorkbookProvider, useEsWorkbook, type EsFaultTreeSource, type EsWorkbookData, type EsMutator, type EsWorkbookRuntime };
