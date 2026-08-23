import React, { createContext, useContext, useMemo } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";

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

interface SyWorkbookRuntime {
  workbookId: string | null;
  revision: number | null;
  saveStatus: RevisionedSaveStatus;
}

type SyMutator = (sy: SystemsAnalysis) => SystemsAnalysis;

interface SyWorkbookContextValue extends SyWorkbookData {
  editable: boolean;
  runtime: SyWorkbookRuntime;
  mutateSy: (mutator: SyMutator) => void;
  shortOf: (id: string) => string;
}

const SyWorkbookContext = createContext<SyWorkbookContextValue | null>(null);

function SyWorkbookProvider({ data, editable, mutateSy, runtime, children }: {
  data: SyWorkbookData;
  editable: boolean;
  mutateSy: (mutator: SyMutator) => void;
  runtime?: SyWorkbookRuntime;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<SyWorkbookContextValue>(
    () => ({
      ...data,
      editable,
      runtime: runtime ?? { workbookId: null, revision: null, saveStatus: "saved" },
      mutateSy,
      shortOf: (id: string): string => {
        const def = data.sy.systemDefinitions.find((d) => d.uuid === id);
        return def?.abbreviation ?? def?.name ?? id;
      },
    }),
    [data, editable, mutateSy, runtime],
  );
  return <SyWorkbookContext.Provider value={value}>{children}</SyWorkbookContext.Provider>;
}

function useSyWorkbook(): SyWorkbookContextValue {
  const ctx = useContext(SyWorkbookContext);
  if (ctx === null) throw new Error("useSyWorkbook must be used inside SyWorkbookProvider");
  return ctx;
}

export {
  SyWorkbookProvider,
  useSyWorkbook,
  type SyWorkbookData,
  type SyLinkedInputs,
  type SyMutator,
  type SyWorkbookRuntime,
};
