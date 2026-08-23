import React, { createContext, useContext, useMemo } from "react";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type {
  DynamicRun,
  EventSequence,
  EventTree,
} from "interfaces-mef-types/es/event-sequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface EsqLinkedInputs {
  posStates: { id: string; name: string; mode: string; durationHours: number }[];
  ieGroups: { id: string; name: string; frequency: number }[];
  esFamilies: { id: string; name: string }[];
  eventTrees: EventTree[];
  eventSequences: EventSequence[];
  dynamicRuns: DynamicRun[];
  scMissionTimes: { id: string; sequence: string; hours: number }[];
  sySystems: { id: string; name: string }[];
  hrActions: { id: string; hfe: string; mean: number }[];
  daParams: { id: string; name: string; value: number }[];
}

interface EsqWorkbookData {
  esq: EventSequenceQuantification;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  links: EsqLinkedInputs | null;
}

interface EsqWorkbookRuntime {
  workbookId: string | null;
  projectId: string | null;
  revision: number | null;
}

type EsqMutator = (esq: EventSequenceQuantification) => EventSequenceQuantification;

interface EsqWorkbookContextValue extends EsqWorkbookData {
  editable: boolean;
  runtime: EsqWorkbookRuntime;
  mutateEsq: (mutator: EsqMutator) => void;
}

const EsqWorkbookContext = createContext<EsqWorkbookContextValue | null>(null);

function EsqWorkbookProvider({ data, editable, runtime, mutateEsq, children }: {
  data: EsqWorkbookData;
  editable: boolean;
  runtime?: EsqWorkbookRuntime;
  mutateEsq: (mutator: EsqMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<EsqWorkbookContextValue>(
    () => ({
      ...data,
      editable,
      runtime: runtime ?? { workbookId: null, projectId: null, revision: null },
      mutateEsq,
    }),
    [data, editable, mutateEsq, runtime],
  );
  return <EsqWorkbookContext.Provider value={value}>{children}</EsqWorkbookContext.Provider>;
}

function useEsqWorkbook(): EsqWorkbookContextValue {
  const ctx = useContext(EsqWorkbookContext);
  if (ctx === null) throw new Error("useEsqWorkbook must be used inside EsqWorkbookProvider");
  return ctx;
}

export {
  EsqWorkbookProvider,
  useEsqWorkbook,
  type EsqWorkbookData,
  type EsqLinkedInputs,
  type EsqMutator,
  type EsqWorkbookRuntime,
};
