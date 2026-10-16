import { type JSX, useMemo } from "react";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import {
  ASSUMPTION_COLUMNS,
  assumptionRows,
  handoffName,
  joinedOrNone,
  recordLabel,
  TechnicalElementHandoff,
  type HandoffSectionView,
} from "../workbooks/workbookHandoff";
import { basisText, frequencyText } from "../newly-developed-methods/ie-frequency-quantification/frequencySources";
import { pointText, useFrequencyPoints, type FrequencyPoint } from "../newly-developed-methods/ie-frequency-quantification/frequencyValues";
import { linkedDaOption, useDaFrequencyTable, type IeDaFrequencyOption } from "./ieDaLinks";
import { useIeWorkbook } from "./ieWorkbookContext";

const NO_DA_OPTIONS: IeDaFrequencyOption[] = [];

function titled(value: string): string {
  return value.length === 0 ? value : value.charAt(0) + value.slice(1).toLowerCase().split("_").join(" ");
}

function ieHandoffSections(ie: InitiatingEventsAnalysis, daOptions: readonly IeDaFrequencyOption[], points: ReadonlyMap<string, FrequencyPoint>, stateNames: ReadonlyMap<string, string>): HandoffSectionView[] {
  const groups = ie.initiatingEventGroups;
  const initiators = ie.initiators;
  const initiatorName = new Map(initiators.map((initiator) => [initiator.uuid, initiator.name]));
  const states = (ids: readonly string[]): string => joinedOrNone(ids.map((id) => recordLabel(id, stateNames.get(id))));
  const identity = ie.metadata.plantIdentity;
  return [
    {
      key: "initiator-groups",
      columns: [{ label: "Group" }, { label: "Members" }, { label: "Bounding initiator" }, { label: "Applicable states" }],
      rows: groups.map((group) => ({
        id: group.uuid,
        cells: [
          handoffName(group.uuid, group.name),
          joinedOrNone(group.memberInitiatorIds.map((id) => recordLabel(id, initiatorName.get(id)))),
          group.boundingInitiatorId.length === 0 ? "None" : recordLabel(group.boundingInitiatorId, initiatorName.get(group.boundingInitiatorId)),
          states(group.applicableStates),
        ],
      })),
    },
    {
      key: "frequencies",
      columns: [{ label: "Group" }, { label: "Mean frequency", numeric: true }, { label: "Basis" }, { label: "DA source" }],
      rows: groups.map((group) => {
        const source = group.controlledDataSource;
        const option = linkedDaOption(group, daOptions);
        return {
          id: group.uuid,
          cells: [
            handoffName(group.uuid, group.name),
            group.frequency === undefined ? "None" : pointText(points.get(group.uuid)),
            group.frequency === undefined ? "None" : basisText(group.frequency.basis),
            source === undefined ? "Typed in IE" : option === undefined ? `${recordLabel(source.entityId)} · unavailable` : handoffName(option.parameterId, option.workbookName),
          ],
        };
      }),
    },
    {
      key: "barrier-impacts",
      columns: [{ label: "Initiator" }, { label: "Barrier" }, { label: "State" }, { label: "Timing" }, { label: "Mechanism" }],
      rows: initiators.flatMap((initiator) => initiator.barrierImpacts.map((impact, index) => ({
        id: `${initiator.uuid}-${String(index)}`,
        cells: [handoffName(initiator.uuid, initiator.name), recordLabel(impact.barrierId), titled(impact.state), impact.timing, impact.mechanism],
      }))),
    },
    {
      key: "screened-initiators",
      columns: [{ label: "Initiator" }, { label: "Status" }, { label: "Frequency", numeric: true }, { label: "Criterion" }, { label: "Basis" }],
      rows: initiators.filter((initiator) => initiator.screeningStatus === ScreeningStatus.SCREENED_OUT).map((initiator) => ({
        id: initiator.uuid,
        cells: [
          handoffName(initiator.uuid, initiator.name),
          titled(initiator.screeningStatus),
          frequencyText(typeof initiator.frequency === "number" ? initiator.frequency : initiator.frequency.value),
          initiator.screeningCriterion ?? "None",
          initiator.screeningBasis ?? "",
        ],
      })),
    },
    {
      key: "module-count",
      columns: [{ label: "Plant" }, { label: "Modules", numeric: true }],
      rows: [{ id: "modules", cells: [identity?.name ?? "", identity?.numberOfModules ?? 1] }],
    },
    {
      key: "assumptions",
      columns: ASSUMPTION_COLUMNS,
      rows: assumptionRows(ie.modelUncertainty, [
        ...(ie.preOperationalAssumptions ?? []),
        ...initiators.flatMap((initiator) => initiator.preOperationalAssumptions ?? []),
      ]),
    },
  ];
}

function IeHandoffScreen(): JSX.Element {
  const { ie, daFrequencies, posLink } = useIeWorkbook();
  const stateNames = useMemo(() => new Map(posLink.states.map((state) => [state.id, state.name])), [posLink.states]);
  const daOptions = daFrequencies ?? NO_DA_OPTIONS;
  const daTable = useDaFrequencyTable(daOptions);
  const entries = useMemo(() => ie.initiatingEventGroups.flatMap((group) => (group.frequency === undefined ? [] : [{ key: group.uuid, expression: group.frequency.expression }])), [ie.initiatingEventGroups]);
  const points = useFrequencyPoints(entries, daTable);
  return <TechnicalElementHandoff element="IE" sections={ieHandoffSections(ie, daOptions, points, stateNames)} />;
}

export { IeHandoffScreen };
