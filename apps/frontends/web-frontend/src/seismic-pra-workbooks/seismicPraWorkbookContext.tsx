import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

type SeismicPraVariant = "htgr" | "sfr";

function seismicPraVariant(mef: Pick<SeismicPRA, "uuid">): SeismicPraVariant | null {
  if (mef.uuid === "SEISMIC-PRA-HTGR") return "htgr";
  if (mef.uuid === "SEISMIC-PRA-SFR") return "sfr";
  return null;
}

interface SeismicPraLinkedInputs {
  variant: SeismicPraVariant;
  posStates: {
    id: string;
    name: string;
    mode: string;
    durationHours: number;
    materialSources: string[];
  }[];
  ieGroups: {
    id: string;
    name: string;
    meanFrequency?: number;
    applicableStates: string[];
    riskImportance: string;
  }[];
  esFamilies: {
    id: string;
    name: string;
    endState: string;
    memberCount?: number;
  }[];
  scMissionTimes: {
    id: string;
    eventSequence: string;
    hours: number;
    riskSignificant?: boolean;
  }[];
  sySystems: {
    id: string;
    name: string;
    missionTimeHours?: number;
    applicableStates: string[];
    basicEventCount?: number;
  }[];
  hrActions: {
    id: string;
    name: string;
    timing: string;
    affectedSystems: string[];
    humanErrorProbability?: number;
  }[];
  daParameters: {
    id: string;
    name: string;
    parameterType: string;
    value: number;
    basicEvent: string;
    system: string;
  }[];
}

type SeismicPraMutator = (mef: SeismicPRA) => SeismicPRA;
interface SeismicPraWorkbookContextValue {
  mef: SeismicPRA;
  linkedInputs: SeismicPraLinkedInputs | null;
  editable: boolean;
  mutate: (mutator: SeismicPraMutator) => void;
}

const SeismicPraWorkbookContext = createContext<SeismicPraWorkbookContextValue | null>(null);

function SeismicPraWorkbookProvider({ mef, linkedInputs, editable, mutate, children }: {
  mef: SeismicPRA;
  linkedInputs: SeismicPraLinkedInputs | null;
  editable: boolean;
  mutate: (mutator: SeismicPraMutator) => void;
  children: ReactNode;
}): JSX.Element {
  const value = useMemo(() => ({ mef, linkedInputs, editable, mutate }), [mef, linkedInputs, editable, mutate]);
  return <SeismicPraWorkbookContext.Provider value={value}>{children}</SeismicPraWorkbookContext.Provider>;
}

function useSeismicPraWorkbook(): SeismicPraWorkbookContextValue {
  const value = useContext(SeismicPraWorkbookContext);
  if (value === null) throw new Error("useSeismicPraWorkbook must be used inside SeismicPraWorkbookProvider");
  return value;
}

export {
  seismicPraVariant,
  SeismicPraWorkbookProvider,
  useSeismicPraWorkbook,
  type SeismicPraLinkedInputs,
  type SeismicPraMutator,
  type SeismicPraVariant,
};
