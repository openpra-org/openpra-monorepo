import React, { createContext, useContext, useMemo } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";
import type { CcfFactorModel, UncertainExpression, UncertainParameter, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import type { ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import { type Workbook } from "interfaces-shared-types";

interface SyLinkedSupport {
  systemId: string;
  nature: string;
}

interface SyLinkedSystem {
  id: string;
  systemId: string;
  name: string;
  capacities: string;
  supports: SyLinkedSupport[];
}

interface SyLinkedInitiatingEvent {
  id: string;
  name: string;
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
  scMissionTimeOptions: ParameterOption[];
  scMissionTimeTable: ReadonlyMap<string, UncertainParameter>;
  posStates: SyLinkedPosState[];
  esSafetyFunctions: SyLinkedSafetyFunction[];
  esInitiatingEvents: SyLinkedInitiatingEvent[];
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
  estimate: UncertainExpression;
  unit: UncertainUnit;
  failureModeId?: string;
  failureModeName?: string;
  componentBoundaryId?: string;
}

interface SyControlledLegacyParameterOption {
  workbookId: string;
  workbookName: string;
  parameterId: string;
  parameterName: string;
  parameterType: "FREQUENCY" | "FAILURE_RATE" | "PROBABILITY" | "UNAVAILABILITY" | "HUMAN_ERROR_PROBABILITY";
  value: number;
  rateUnit?: "HOUR" | "YEAR";
}

interface SyControlledComponentBoundaryOption {
  workbookId: string;
  workbookName: string;
  boundaryId: string;
  name: string;
  systemId: string;
  description: string;
  includedItems: string[];
  excludedItems: string[];
  boundaryBasis: string;
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

interface SyControlledCoincidentMaintenanceOption {
  workbookId: string;
  workbookName: string;
  recordId: string;
  description: string;
  equipment: string[];
  scope: "INTRASYSTEM" | "INTERSYSTEM";
  basis: "ACTUAL_PLANT_EXPERIENCE" | "PREOP_ASSUMPTION";
  value?: number;
}

interface SyControlledCcfEstimateOption {
  workbookId: string;
  workbookName: string;
  estimateId: string;
  groupReference: string;
  factors: CcfFactorModel;
  source?: string;
  riskSignificant: boolean;
}

type SyMutator = (sy: SystemsAnalysis) => SystemsAnalysis;

interface SyWorkbookContextValue extends SyWorkbookData {
  editable: boolean;
  runtime: SyWorkbookRuntime;
  upstream: SyUpstream;
  controlledParameters: SyControlledParameterOption[];
  controlledLegacyParameters: SyControlledLegacyParameterOption[];
  controlledHumanFailures: SyControlledHumanFailureOption[];
  controlledFailureModes: SyControlledFailureModeOption[];
  controlledCoincidentMaintenance: SyControlledCoincidentMaintenanceOption[];
  controlledCcfEstimates: SyControlledCcfEstimateOption[];
  controlledComponentBoundaries: SyControlledComponentBoundaryOption[];
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
  controlledLegacyParameters,
  controlledHumanFailures,
  controlledFailureModes,
  controlledCoincidentMaintenance,
  controlledCcfEstimates,
  controlledComponentBoundaries,
  upstream,
  children,
}: {
  data: SyWorkbookData;
  editable: boolean;
  mutateSy: (mutator: SyMutator) => void;
  runtime?: SyWorkbookRuntime;
  upstream?: SyUpstream;
  controlledParameters?: SyControlledParameterOption[];
  controlledLegacyParameters?: SyControlledLegacyParameterOption[];
  controlledHumanFailures?: SyControlledHumanFailureOption[];
  controlledFailureModes?: SyControlledFailureModeOption[];
  controlledCoincidentMaintenance?: SyControlledCoincidentMaintenanceOption[];
  controlledCcfEstimates?: SyControlledCcfEstimateOption[];
  controlledComponentBoundaries?: SyControlledComponentBoundaryOption[];
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<SyWorkbookContextValue>(
    () => ({
      ...data,
      editable,
      runtime: runtime ?? { workbookId: null, projectId: null, revision: null, saveStatus: "saved" },
      upstream: upstream ?? EMPTY_UPSTREAM,
      controlledParameters: controlledParameters ?? [],
      controlledLegacyParameters: controlledLegacyParameters ?? [],
      controlledHumanFailures: controlledHumanFailures ?? [],
      controlledFailureModes: controlledFailureModes ?? [],
      controlledCoincidentMaintenance: controlledCoincidentMaintenance ?? [],
      controlledCcfEstimates: controlledCcfEstimates ?? [],
      controlledComponentBoundaries: controlledComponentBoundaries ?? [],
      mutateSy,
      shortOf: (id: string): string => {
        const def = data.sy.systemDefinitions.find((d) => d.uuid === id);
        return def?.abbreviation ?? def?.name ?? id;
      },
    }),
    [controlledCcfEstimates, controlledComponentBoundaries, controlledCoincidentMaintenance, controlledFailureModes, controlledHumanFailures, controlledLegacyParameters, controlledParameters, data, editable, mutateSy, runtime, upstream],
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
  type SyControlledLegacyParameterOption,
  type SyControlledHumanFailureOption,
  type SyControlledFailureModeOption,
  type SyControlledCoincidentMaintenanceOption,
  type SyControlledCcfEstimateOption,
  type SyControlledComponentBoundaryOption,
  type SyLinkedInitiatingEvent,
  type SyLinkedSupport,
};
