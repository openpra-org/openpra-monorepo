import { type JSX, useMemo } from "react";
import type { HepQuantification, HumanReliabilityAnalysis, RecoveryAction } from "interfaces-mef-types/hr/human-reliability-analysis";
import {
  ASSUMPTION_COLUMNS,
  assumptionRows,
  handoffName,
  joinedOrNone,
  recordLabel,
  TechnicalElementHandoff,
  type HandoffSectionView,
} from "../workbooks/workbookHandoff";
import { quantificationHepText, type HrDaHepOption } from "./hrDaLinks";
import { hepText } from "./hrShared";
import { DEPENDENCE_LEVELS, HFE_TIMING } from "./hrViewData";
import { useHrWorkbook } from "./hrWorkbookContext";

const RECOVERY_LEVELS: Record<RecoveryAction["appliedAtLevel"], string> = { CUTSET: "Cutset", SCENARIO: "Scenario", SEQUENCE: "Sequence" };

function minutes(value: number | undefined): string {
  return value === undefined ? "None" : `${String(value)} min`;
}

function hepCell(quantification: HepQuantification | undefined, daHeps: readonly HrDaHepOption[]): string {
  return quantification === undefined ? "None" : quantificationHepText(quantification, daHeps);
}

function hrHandoffSections(hr: HumanReliabilityAnalysis, daHeps: readonly HrDaHepOption[]): HandoffSectionView[] {
  const recoveries = hr.recoveryActions ?? [];
  const recoveryQuantifications = new Set(recoveries.map((recovery) => recovery.hepQuantificationId));
  const ownQuantification = new Map<string, HepQuantification>();
  for (const quantification of hr.hepQuantifications) {
    if (!recoveryQuantifications.has(quantification.uuid) && !ownQuantification.has(quantification.hfeId)) ownQuantification.set(quantification.hfeId, quantification);
  }
  const hfeName = new Map(hr.humanFailureEvents.map((hfe) => [hfe.uuid, hfe.name]));
  return [
    {
      key: "human-failure-events",
      columns: [{ label: "Event" }, { label: "Timing" }, { label: "Assessment" }, { label: "HEP" }],
      rows: hr.humanFailureEvents.map((hfe) => {
        const quantification = ownQuantification.get(hfe.uuid);
        return {
          id: hfe.uuid,
          cells: [
            handoffName(hfe.uuid, hfe.name),
            HFE_TIMING[hfe.hfeTiming]?.label ?? hfe.hfeTiming,
            quantification === undefined ? "None" : quantification.assessmentType === "DETAILED_ASSESSMENT" ? "Detailed" : "Conservative",
            hepCell(quantification, daHeps),
          ],
        };
      }),
    },
    {
      key: "operator-actions",
      columns: [{ label: "Action" }, { label: "Cue" }, { label: "Time available", numeric: true }, { label: "Time required", numeric: true }],
      rows: hr.humanFailureEvents.filter((hfe) => hfe.hfeTiming === "POST_INITIATOR").map((hfe) => {
        const quantification = ownQuantification.get(hfe.uuid);
        const cue = hfe.responseDetail?.cueDescription ?? "";
        return {
          id: hfe.uuid,
          cells: [handoffName(hfe.uuid, hfe.name), cue.length > 0 ? cue : "None", minutes(quantification?.timeAvailableMinutes), minutes(quantification?.timeRequiredMinutes)],
        };
      }),
    },
    {
      key: "recovery-actions",
      columns: [{ label: "Recovery" }, { label: "Event" }, { label: "Level" }, { label: "HEP" }],
      rows: recoveries.map((recovery) => ({
        id: recovery.uuid,
        cells: [
          handoffName(recovery.uuid, recovery.name),
          recordLabel(recovery.hfeId, hfeName.get(recovery.hfeId)),
          RECOVERY_LEVELS[recovery.appliedAtLevel],
          hepCell(hr.hepQuantifications.find((quantification) => quantification.uuid === recovery.hepQuantificationId), daHeps),
        ],
      })),
    },
    {
      key: "dependence",
      columns: [{ label: "Events" }, { label: "Scope" }, { label: "Dependence" }, { label: "Joint HEP", numeric: true }],
      rows: [
        {
          id: `floor-${hr.jointHepFloor.uuid}`,
          cells: [handoffName("Joint HEP floor", hr.jointHepFloor.justification), "All sets", "Minimum", hepText(hr.jointHepFloor.minimumJointProbability)],
        },
        ...hr.dependencyAssessments.map((assessment) => ({
          id: assessment.uuid,
          cells: [
            joinedOrNone(assessment.hfeIds.map((id) => recordLabel(id, hfeName.get(id)))),
            assessment.scope === "WITHIN_SEQUENCE" ? `Within sequence${assessment.eventSequenceId === undefined ? "" : ` · ${recordLabel(assessment.eventSequenceId)}`}` : "Pre-initiator set",
            DEPENDENCE_LEVELS[assessment.dependenceLevel] ?? assessment.dependenceLevel,
            hepText(assessment.jointHep),
          ],
        })),
      ],
    },
    {
      key: "assumptions",
      columns: ASSUMPTION_COLUMNS,
      rows: assumptionRows(hr.modelUncertainty, hr.preOperationalAssumptions),
    },
  ];
}

function HrHandoffScreen(): JSX.Element {
  const { hr, daHeps } = useHrWorkbook();
  const sections = useMemo(() => hrHandoffSections(hr, daHeps ?? []), [hr, daHeps]);
  return <TechnicalElementHandoff element="HRA" sections={sections} />;
}

export { HrHandoffScreen };
