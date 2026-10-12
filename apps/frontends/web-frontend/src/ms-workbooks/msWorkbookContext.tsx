import React, { createContext, useContext, useMemo } from "react";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { NO_MS_UPSTREAM, type MsUpstream } from "./msLinks";

interface MsWorkbookData {
  ms: MechanisticSourceTermAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type MsMutator = (ms: MechanisticSourceTermAnalysis) => MechanisticSourceTermAnalysis;

interface MsWorkbookContextValue extends MsWorkbookData {
  editable: boolean;
  mutateMs: (mutator: MsMutator) => void;
  upstream: MsUpstream;
}

const MsWorkbookContext = createContext<MsWorkbookContextValue | null>(null);

function MsWorkbookProvider({ data, editable, mutateMs, upstream = NO_MS_UPSTREAM, children }: {
  data: MsWorkbookData;
  editable: boolean;
  mutateMs: (mutator: MsMutator) => void;
  upstream?: MsUpstream;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<MsWorkbookContextValue>(
    () => ({ ...data, editable, mutateMs, upstream }),
    [data, editable, mutateMs, upstream],
  );
  return <MsWorkbookContext.Provider value={value}>{children}</MsWorkbookContext.Provider>;
}

function useMsWorkbook(): MsWorkbookContextValue {
  const ctx = useContext(MsWorkbookContext);
  if (ctx === null) throw new Error("useMsWorkbook must be used inside MsWorkbookProvider");
  return ctx;
}

export { MsWorkbookProvider, useMsWorkbook, type MsWorkbookData, type MsMutator };
