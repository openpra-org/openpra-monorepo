import { type JSX, useMemo } from "react";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import {
  ASSUMPTION_COLUMNS,
  assumptionRows,
  handoffName,
  joinedOrNone,
  recordLabel,
  TechnicalElementHandoff,
  type HandoffSectionView,
} from "../workbooks/workbookHandoff";
import { formatDuration, formatFrequency, quantStatesView, stateLabel } from "./posSelectors";
import { usePosWorkbook } from "./posWorkbookContext";

const LOCATION_LABEL: Record<string, string> = { IN_CORE: "In-core", EX_CORE: "Ex-core" };

function titled(value: string): string {
  return value.length === 0 ? value : value.charAt(0) + value.slice(1).toLowerCase().split("_").join(" ");
}

function posHandoffSections(pos: PlantOperatingStatesAnalysis): HandoffSectionView[] {
  const states = pos.plantOperatingStates;
  const stateName = new Map(states.map((state) => [state.uuid, stateLabel(state.name)]));
  const preOperational = [
    ...(pos.preOperationalAssumptions ?? []),
    ...pos.plantEvolutions.flatMap((evolution) => evolution.preOperationalAssumptions ?? []),
    ...states.flatMap((state) => state.preOperationalAssumptions ?? []),
    ...(pos.plantOperatingStateGroups ?? []).flatMap((group) => group.preOperationalAssumptions ?? []),
  ];
  return [
    {
      key: "operating-states",
      columns: [{ label: "State" }, { label: "Mode" }, { label: "Mean duration", numeric: true }, { label: "Entry frequency", numeric: true }, { label: "Time fraction", numeric: true }],
      rows: quantStatesView(pos).map((state) => ({
        id: state.uuid,
        cells: [
          handoffName(state.uuid, stateLabel(state.name)),
          titled(state.mode),
          formatDuration(state.durationHours),
          state.frequencyPerYear === 0 ? (state.mode === "POWER" ? "Base state" : "0/yr") : formatFrequency(state.frequencyPerYear),
          `${(state.durationFraction * 100).toFixed(1)} %`,
        ],
      })),
    },
    {
      key: "sources-and-barriers",
      columns: [{ label: "State" }, { label: "Kind" }, { label: "Item" }, { label: "Location or status" }, { label: "Detail" }],
      rows: states.flatMap((state) => [
        ...state.radioactiveMaterialSources.map((source, index) => ({
          id: `${state.uuid}-source-${String(index)}`,
          cells: [recordLabel(state.uuid, stateLabel(state.name)), "Source", source.name, LOCATION_LABEL[source.location] ?? source.location, `Barriers: ${joinedOrNone(source.barriers)}`],
        })),
        ...state.radionuclideTransportBarriers.map((barrier, index) => ({
          id: `${state.uuid}-barrier-${String(index)}`,
          cells: [
            recordLabel(state.uuid, stateLabel(state.name)),
            "Barrier",
            barrier.name,
            barrier.status === undefined ? "None" : titled(barrier.status),
            `Breach: ${joinedOrNone(barrier.breachCriteria)} · Monitoring: ${joinedOrNone(barrier.monitoringParameters)}`,
          ],
        })),
      ]),
    },
    {
      key: "hazard-groups",
      columns: [{ label: "Hazard group" }, { label: "Conditions sufficient" }, { label: "Modifications", numeric: true }, { label: "Basis" }],
      rows: (pos.hazardGroupReviews ?? []).map((review, index) => ({
        id: `${review.hazardGroup}-${String(index)}`,
        cells: [
          review.hazardGroup,
          review.conditionsRemainSufficient ? "Yes" : "No",
          review.hazardBarrierEffectivenessChanges.length + review.propagationPathwayModifications.length + review.sscFragilityModifications.length,
          review.basis,
        ],
      })),
    },
    {
      key: "screening",
      columns: [{ label: "State" }, { label: "Decision" }, { label: "Justification" }],
      rows: pos.screeningRecords.map((record, index) => ({
        id: `${record.posId}-${String(index)}`,
        cells: [
          handoffName(record.posId, stateName.get(record.posId) ?? ""),
          record.retained ? "Retained" : `Screened${record.criterion === undefined ? "" : ` · ${record.criterion}`}`,
          record.justification,
        ],
      })),
    },
    {
      key: "assumptions",
      columns: ASSUMPTION_COLUMNS,
      rows: assumptionRows(pos.modelUncertainty, preOperational),
    },
  ];
}

function PosHandoffScreen(): JSX.Element {
  const { pos } = usePosWorkbook();
  const sections = useMemo(() => posHandoffSections(pos), [pos]);
  return <TechnicalElementHandoff element="POS" sections={sections} />;
}

export { PosHandoffScreen };
