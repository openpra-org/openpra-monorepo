import { type JSX, useMemo } from "react";
import type { EndState } from "interfaces-mef-types/core/events";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import {
  ASSUMPTION_COLUMNS,
  assumptionRows,
  handoffName,
  joinedOrNone,
  recordLabel,
  TechnicalElementHandoff,
  type HandoffSectionView,
} from "../workbooks/workbookHandoff";
import { hoursText, useHoursPoints, type HoursState } from "./scMissionTimePoints";
import { useScWorkbook, type ScLinkedInputs } from "./scWorkbookContext";

function endStateLabel(endState: EndState): string {
  return String(endState) === "SUCCESSFUL_MITIGATION" ? "Safe stable state" : "Radionuclide release";
}

function scHandoffSections(sc: SuccessCriteriaDevelopment, points: ReadonlyMap<string, HoursState>, links: ScLinkedInputs | null): HandoffSectionView[] {
  const criterionCode = new Map(sc.overallSuccessCriteria.map((criterion) => [criterion.uuid, criterion.successCriteriaId]));
  const functionName = new Map((links?.esFunctions ?? []).map((entry) => [entry.id, entry.name]));
  const sequenceName = (id: string): string => recordLabel(id, links?.esSequenceInfo[id]?.scenario);
  return [
    {
      key: "success-criteria",
      columns: [{ label: "Criterion" }, { label: "Safety functions" }, { label: "Sequence" }, { label: "Risk significant" }],
      rows: sc.overallSuccessCriteria.map((criterion) => ({
        id: criterion.uuid,
        cells: [
          handoffName(criterion.successCriteriaId, criterion.description),
          joinedOrNone(criterion.keySafetyFunctions.map((id) => recordLabel(id, functionName.get(id)))),
          criterion.eventSequenceReference !== undefined ? sequenceName(criterion.eventSequenceReference) : criterion.eventSequenceFamilyReference !== undefined ? recordLabel(criterion.eventSequenceFamilyReference) : "None",
          criterion.isRiskSignificant ? "Yes" : "No",
        ],
      })),
    },
    {
      key: "system-criteria",
      columns: [{ label: "System" }, { label: "Required capacities" }, { label: "Dependencies" }, { label: "Overall criterion" }],
      rows: (sc.systemSuccessCriteria ?? []).map((system) => ({
        id: system.uuid,
        cells: [
          handoffName(system.systemId, system.description),
          joinedOrNone(system.requiredCapacities.map((capacity) => `${capacity.parameter}: ${capacity.value}`)),
          joinedOrNone((system.systemDependencies ?? []).map((dependency) => recordLabel(dependency.dependentSystemId))),
          criterionCode.get(system.overallSuccessCriteriaId) ?? (system.overallSuccessCriteriaId.length > 0 ? recordLabel(system.overallSuccessCriteriaId) : "None"),
        ],
      })),
    },
    {
      key: "end-states",
      columns: [{ label: "End state" }, { label: "Definition" }, { label: "Release categories" }, { label: "Parameters", numeric: true }],
      rows: sc.endStateDefinitions.map((definition) => ({
        id: definition.uuid,
        cells: [
          handoffName(definition.uuid, endStateLabel(definition.endState)),
          definition.definition,
          joinedOrNone([...new Set([...definition.releaseCategoryReferences, ...(definition.resultingReleaseCategoryId === undefined ? [] : [definition.resultingReleaseCategoryId])])].map((id) => recordLabel(id))),
          definition.determiningParameters.length,
        ],
      })),
    },
    {
      key: "mission-times",
      columns: [{ label: "Sequence" }, { label: "Component" }, { label: "Mission time", numeric: true }, { label: "Basis" }],
      rows: [
        ...sc.missionTimes.map((entry) => ({
          id: entry.uuid,
          cells: [sequenceName(entry.eventSequenceReference), "None", hoursText(points.get(entry.uuid)), entry.basis],
        })),
        ...(sc.componentMissionTimes ?? []).map((entry) => ({
          id: entry.uuid,
          cells: [sequenceName(entry.eventSequenceReference), recordLabel(entry.componentId), hoursText(points.get(entry.uuid)), entry.shorterMissionTimeJustification ?? "Direct"],
        })),
      ],
    },
    {
      key: "barrier-criteria",
      columns: [{ label: "Barrier" }, { label: "Protection criteria" }, { label: "Method" }, { label: "Loads", numeric: true }],
      rows: sc.radionuclideBarrierCriteria.map((barrier) => ({
        id: barrier.uuid,
        cells: [
          barrier.barrierId.length > 0 ? recordLabel(barrier.barrierId) : "Not set",
          joinedOrNone(barrier.protectionParameters.filter((parameter) => parameter.parameter.length > 0).map((parameter) => `${parameter.parameter}: ${parameter.criterion}`)),
          barrier.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic" : "Conservative",
          barrier.challengeLoads.length,
        ],
      })),
    },
    {
      key: "operator-criteria",
      columns: [{ label: "Action" }, { label: "Time available" }, { label: "Success criterion" }, { label: "Procedure" }],
      rows: (sc.humanActionSuccessCriteria ?? []).map((action) => ({
        id: action.uuid,
        cells: [handoffName(action.humanActionId, action.description), action.timeAvailable, action.successCriteria, action.procedureReference ?? "None"],
      })),
    },
    {
      key: "assumptions",
      columns: ASSUMPTION_COLUMNS,
      rows: assumptionRows(sc.modelUncertainty, sc.preOperationalAssumptions),
    },
  ];
}

function ScHandoffScreen(): JSX.Element {
  const { sc, links } = useScWorkbook();
  const entries = useMemo(
    () => [...sc.missionTimes, ...(sc.componentMissionTimes ?? [])].map((entry) => ({ key: entry.uuid, expression: entry.missionTime })),
    [sc.missionTimes, sc.componentMissionTimes],
  );
  const points = useHoursPoints(entries);
  return <TechnicalElementHandoff element="SC" sections={scHandoffSections(sc, points, links)} />;
}

export { ScHandoffScreen };
