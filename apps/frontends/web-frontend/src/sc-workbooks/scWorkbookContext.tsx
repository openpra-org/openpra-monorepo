import React, { createContext, useContext, useMemo } from "react";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface ScWorkbookData {
  sc: SuccessCriteriaDevelopment;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type ScMutator = (sc: SuccessCriteriaDevelopment) => SuccessCriteriaDevelopment;

interface ScWorkbookContextValue extends ScWorkbookData {
  editable: boolean;
  mutateSc: (mutator: ScMutator) => void;
}

const ScWorkbookContext = createContext<ScWorkbookContextValue | null>(null);

function ScWorkbookProvider({ data, editable, mutateSc, children }: {
  data: ScWorkbookData;
  editable: boolean;
  mutateSc: (mutator: ScMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<ScWorkbookContextValue>(
    () => ({ ...data, editable, mutateSc }),
    [data, editable, mutateSc],
  );
  return <ScWorkbookContext.Provider value={value}>{children}</ScWorkbookContext.Provider>;
}

function useScWorkbook(): ScWorkbookContextValue {
  const ctx = useContext(ScWorkbookContext);
  if (ctx === null) throw new Error("useScWorkbook must be used inside ScWorkbookProvider");
  return ctx;
}

export { ScWorkbookProvider, useScWorkbook, type ScWorkbookData, type ScMutator };
