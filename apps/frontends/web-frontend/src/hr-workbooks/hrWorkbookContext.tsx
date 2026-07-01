import React, { createContext, useContext, useMemo } from "react";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface HrWorkbookData {
  hr: HumanReliabilityAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type HrMutator = (hr: HumanReliabilityAnalysis) => HumanReliabilityAnalysis;

interface HrWorkbookContextValue extends HrWorkbookData {
  editable: boolean;
  mutateHr: (mutator: HrMutator) => void;
}

const HrWorkbookContext = createContext<HrWorkbookContextValue | null>(null);

function HrWorkbookProvider({ data, editable, mutateHr, children }: {
  data: HrWorkbookData;
  editable: boolean;
  mutateHr: (mutator: HrMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<HrWorkbookContextValue>(
    () => ({ ...data, editable, mutateHr }),
    [data, editable, mutateHr],
  );
  return <HrWorkbookContext.Provider value={value}>{children}</HrWorkbookContext.Provider>;
}

function useHrWorkbook(): HrWorkbookContextValue {
  const ctx = useContext(HrWorkbookContext);
  if (ctx === null) throw new Error("useHrWorkbook must be used inside HrWorkbookProvider");
  return ctx;
}

export { HrWorkbookProvider, useHrWorkbook, type HrWorkbookData, type HrMutator };
