import React, { createContext, useContext, useMemo } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";

interface SyLinkedSystem {
  id: string;
  name: string;
  capacities: string;
}

interface SyLinkedPosState {
  id: string;
  name: string;
  decayLabel: string;
  durationHours: number;
}

interface SyLinkedInputs {
  scName: string;
  posName: string;
  scSystems: SyLinkedSystem[];
  posStates: SyLinkedPosState[];
}

interface SyWorkbookData {
  sy: SystemsAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  links: SyLinkedInputs | null;
}

type SyMutator = (sy: SystemsAnalysis) => SystemsAnalysis;

interface SyWorkbookContextValue extends SyWorkbookData {
  editable: boolean;
  mutateSy: (mutator: SyMutator) => void;
  shortOf: (id: string) => string;
}

const SyWorkbookContext = createContext<SyWorkbookContextValue | null>(null);

function SyWorkbookProvider({ data, editable, mutateSy, children }: {
  data: SyWorkbookData;
  editable: boolean;
  mutateSy: (mutator: SyMutator) => void;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<SyWorkbookContextValue>(
    () => ({
      ...data,
      editable,
      mutateSy,
      shortOf: (id: string): string => {
        const def = data.sy.systemDefinitions.find((d) => d.uuid === id);
        return def?.abbreviation ?? def?.name ?? id;
      },
    }),
    [data, editable, mutateSy],
  );
  return <SyWorkbookContext.Provider value={value}>{children}</SyWorkbookContext.Provider>;
}

function useSyWorkbook(): SyWorkbookContextValue {
  const ctx = useContext(SyWorkbookContext);
  if (ctx === null) throw new Error("useSyWorkbook must be used inside SyWorkbookProvider");
  return ctx;
}

export { SyWorkbookProvider, useSyWorkbook, type SyWorkbookData, type SyLinkedInputs, type SyMutator };
