import React, { createContext, useContext, useMemo } from "react";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface DaLinkedInputs {
  posStates: { id: string; name: string; mode: string; durationHours: number }[];
  esFamilies: { id: string; name: string }[];
}

interface DaWorkbookData {
  da: DataAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  links: DaLinkedInputs | null;
}

type DaMutator = (da: DataAnalysis) => DataAnalysis;

interface DaWorkbookContextValue extends DaWorkbookData {
  editable: boolean;
  mutateDa: (mutator: DaMutator) => void;
}

const DaWorkbookContext = createContext<DaWorkbookContextValue | null>(null);

function DaWorkbookProvider({ data, editable, mutateDa, children }: {
  data: DaWorkbookData;
  editable: boolean;
  mutateDa: (mutator: DaMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<DaWorkbookContextValue>(
    () => ({ ...data, editable, mutateDa }),
    [data, editable, mutateDa],
  );
  return <DaWorkbookContext.Provider value={value}>{children}</DaWorkbookContext.Provider>;
}

function useDaWorkbook(): DaWorkbookContextValue {
  const ctx = useContext(DaWorkbookContext);
  if (ctx === null) throw new Error("useDaWorkbook must be used inside DaWorkbookProvider");
  return ctx;
}

export { DaWorkbookProvider, useDaWorkbook, type DaWorkbookData, type DaLinkedInputs, type DaMutator };
