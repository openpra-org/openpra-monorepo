import React, { createContext, useContext, useMemo } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface SyWorkbookData {
  sy: SystemsAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type SyMutator = (sy: SystemsAnalysis) => SystemsAnalysis;

interface SyWorkbookContextValue extends SyWorkbookData {
  editable: boolean;
  mutateSy: (mutator: SyMutator) => void;
}

const SyWorkbookContext = createContext<SyWorkbookContextValue | null>(null);

function SyWorkbookProvider({ data, editable, mutateSy, children }: {
  data: SyWorkbookData;
  editable: boolean;
  mutateSy: (mutator: SyMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<SyWorkbookContextValue>(
    () => ({ ...data, editable, mutateSy }),
    [data, editable, mutateSy],
  );
  return <SyWorkbookContext.Provider value={value}>{children}</SyWorkbookContext.Provider>;
}

function useSyWorkbook(): SyWorkbookContextValue {
  const ctx = useContext(SyWorkbookContext);
  if (ctx === null) throw new Error("useSyWorkbook must be used inside SyWorkbookProvider");
  return ctx;
}

export { SyWorkbookProvider, useSyWorkbook, type SyWorkbookData, type SyMutator };
