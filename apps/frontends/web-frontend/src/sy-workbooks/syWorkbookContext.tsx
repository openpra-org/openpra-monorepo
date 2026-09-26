import React, { createContext, useContext, useMemo } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";
import type { ParameterDistribution } from "interfaces-mef-types/core/events";
import { type Workbook } from "interfaces-shared-types";

interface SyLinkedSystem {
  id: string;
  systemId: string;
  name: string;
  capacities: string;
}

interface SyLinkedMissionTime {
  id: string;
  hours: number;
  sequence: string;
  basis: string;
}

interface SyLinkedPosState {
  id: string;
  name: string;
  mode: string;
  durationHours: number;
}

interface SyLinkedSafetyFunction {
  id: string;
  name: string;
  supportingSystems: string[];
}

interface SyLinkedInputs {
  scName: string;
  posName: string;
  esName: string;
  scSystems: SyLinkedSystem[];
  scMissionTimes: SyLinkedMissionTime[];
  posStates: SyLinkedPosState[];
  esSafetyFunctions: SyLinkedSafetyFunction[];
}

type SyLinkCode = "ES" | "SC" | "POS" | "DA" | "HRA";

interface SyUpstream {
  options: Record<SyLinkCode, Workbook[]>;
}

const EMPTY_UPSTREAM: SyUpstream = {
  options: { ES: [], SC: [], POS: [], DA: [], HRA: [] },
};

interface SyWorkbookData {
  sy: SystemsAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
  links: SyLinkedInputs | null;
}

interface SyWorkbookRuntime {
  workbookId: string | null;
  projectId: string | null;
  revision: number | null;
  saveStatus: RevisionedSaveStatus;
}

interface SyControlledParameterOption {
  workbookId: string;
  workbookName: string;
  parameterId: string;
  parameterName: string;
  parameterType: "FREQUENCY" | "PROBABILITY" | "UNAVAILABILITY" | "HUMAN_ERROR_PROBABILITY";
  value: number;
  uncertainty?: ParameterDistribution;
  failureModeId?: string;
  failureModeName?: string;
}

interface SyControlledFailureModeOption {
  workbookId: string;
  workbookName: string;
  failureModeId: string;
  name: string;
}

interface SyControlledHumanFailureOption {
  workbookId: string;
  workbookName: string;
  humanFailureEventId: string;
  humanFailureEventName: string;
  hfeTiming: "PRE_INITIATOR" | "AT_INITIATOR" | "POST_INITIATOR";
  quantificationId: string;
  methodology: string;
  value: number;
  valueKind: "MEAN" | "POINT_ESTIMATE";
}

type SyMutator = (sy: SystemsAnalysis) => SystemsAnalysis;

interface SyWorkbookContextValue extends SyWorkbookData {
  editable: boolean;
  runtime: SyWorkbookRuntime;
  upstream: SyUpstream;
  controlledParameters: SyControlledParameterOption[];
  controlledHumanFailures: SyControlledHumanFailureOption[];
  controlledFailureModes: SyControlledFailureModeOption[];
  mutateSy: (mutator: SyMutator) => void;
  shortOf: (id: string) => string;
}

const SyWorkbookContext = createContext<SyWorkbookContextValue | null>(null);

function SyWorkbookProvider({
  data,
  editable,
  mutateSy,
  runtime,
  controlledParameters,
  controlledHumanFailures,
  controlledFailureModes,
  upstream,
  children,
}: {
  data: SyWorkbookData;
  editable: boolean;
  mutateSy: (mutator: SyMutator) => void;
  runtime?: SyWorkbookRuntime;
  upstream?: SyUpstream;
  controlledParameters?: SyControlledParameterOption[];
  controlledHumanFailures?: SyControlledHumanFailureOption[];
  controlledFailureModes?: SyControlledFailureModeOption[];
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<SyWorkbookContextValue>(
    () => ({
      ...data,
      editable,
      runtime: runtime ?? { workbookId: null, projectId: null, revision: null, saveStatus: "saved" },
      upstream: upstream ?? EMPTY_UPSTREAM,
      controlledParameters: controlledParameters ?? [],
      controlledHumanFailures: controlledHumanFailures ?? [],
      controlledFailureModes: controlledFailureModes ?? [],
      mutateSy,
      shortOf: (id: string): string => {
        const def = data.sy.systemDefinitions.find((d) => d.uuid === id);
        return def?.abbreviation ?? def?.name ?? id;
      },
    }),
    [controlledFailureModes, controlledHumanFailures, controlledParameters, data, editable, mutateSy, runtime, upstream],
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
  type SyLinkedSafetyFunction,
  type SyLinkCode,
  type SyUpstream,
  type SyMutator,
  type SyWorkbookRuntime,
  type SyControlledParameterOption,
  type SyControlledHumanFailureOption,
  type SyControlledFailureModeOption,
  type SyLinkedMissionTime,
};
