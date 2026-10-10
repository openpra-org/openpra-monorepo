import React, { createContext, useContext, useMemo } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type EsPosLinkStatus, type EsIeLinkStatus } from "./esWorkbookApi";
import { type IeDaFrequencyOption } from "../ie-workbooks/ieDaLinks";

interface EsFaultTreeSource {
  workbookId: string;
  workbookName: string;
  mef: SystemsAnalysis;
}

interface EsUpstream {
  sc?: SuccessCriteriaDevelopment;
  sy?: SystemsAnalysis;
}

interface EsWorkbookData {
  projectId?: string;
  faultTreeSource?: EsFaultTreeSource;
  es: EventSequenceAnalysis;
  upstream?: EsUpstream;
  posLink: EsPosLinkStatus;
  ieLink: EsIeLinkStatus;
  daFrequencies?: IeDaFrequencyOption[];
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

export { EsWorkbookProvider, useEsWorkbook, type EsFaultTreeSource, type EsUpstream, type EsWorkbookData, type EsMutator, type EsWorkbookRuntime };
