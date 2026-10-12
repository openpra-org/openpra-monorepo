import { type JSX } from "react";
import { systemFaultTreeBasicEventIds } from "interfaces-mef-types/sy/system-models";
import {
  ASSUMPTION_COLUMNS,
  assumptionRows,
  handoffName,
  joinedOrNone,
  TechnicalElementHandoff,
  type HandoffRow,
  type HandoffSectionView,
} from "../workbooks/workbookHandoff";
import { hoursText } from "../sc-workbooks/scMissionTimePoints";
import { FAILURE_MODE_LABELS } from "./syViewData";
import { ccfModelText, groupTotal, memberEvents } from "./syCcf";
import { useExpressionPoints } from "./syBasicEventValues";
import { useSystemHours } from "./syMissionTimes";
import { eventSourceCell, eventValueCell, useEventCells } from "./SyBasicEvents";
import { PointValue } from "./syShared";
import { useSyWorkbook } from "./syWorkbookContext";

function SyHandoffScreen(): JSX.Element {
  const { sy, shortOf } = useSyWorkbook();
  const hours = useSystemHours(sy.systemDefinitions);
  const eventCells = useEventCells(sy.systemBasicEvents);
  const totaled = sy.commonCauseFailureGroups.flatMap((group) => {
    const total = groupTotal(group, sy);
    return total === undefined ? [] : [{ id: group.uuid, total }];
  });
  const totals = useExpressionPoints(totaled.map(({ total }) => total), eventCells.values.table);
  const totalById = new Map(totaled.map(({ id }, index) => [id, totals[index]]));
  const modelCode = new Map(sy.systemLogicModels.map((model) => [model.uuid, model.code]));
  const networks = sy.dependencyBayesianNetworks ?? [];
  const configurations = sy.dependencyHclConfigurations ?? [];

  const uncertaintyRows: HandoffRow[] = (sy.uncertaintyAnalyses ?? []).flatMap((analysis) => {
    const system = shortOf(analysis.system);
    return [
      ...analysis.modelUncertainties.map((entry, index) => ({ id: `model-${analysis.uuid}-${String(index)}`, cells: ["System uncertainty", `${system} · ${entry.description}`, entry.impact] })),
      ...(analysis.ccfUncertainties ?? []).map((entry, index) => ({ id: `ccf-${analysis.uuid}-${String(index)}`, cells: ["Common cause uncertainty", `${system} · ${entry.description}`, entry.impact] })),
      ...(analysis.dependencyUncertainties ?? []).map((entry, index) => ({ id: `dependency-${analysis.uuid}-${String(index)}`, cells: ["Dependency uncertainty", `${system} · ${entry.description}`, entry.impact] })),
      ...(analysis.successCriteriaUncertainties ?? []).map((entry, index) => ({ id: `criterion-${analysis.uuid}-${String(index)}`, cells: ["Success criterion uncertainty", `${system} · ${entry.description}`, entry.impact] })),
    ];
  });

  const sections: HandoffSectionView[] = [
    {
      key: "systems",
      columns: [{ label: "System" }, { label: "Abbreviation" }, { label: "Mission time", numeric: true }],
      rows: sy.systemDefinitions.map((system) => ({
        id: system.uuid,
        cells: [system.name, system.abbreviation ?? "None", system.missionTime === undefined ? "None" : hoursText(hours.get(system.uuid))],
      })),
    },
    {
      key: "fault-trees",
      columns: [{ label: "Fault tree" }, { label: "System" }, { label: "Top gate" }, { label: "Gates", numeric: true }, { label: "Events", numeric: true }, { label: "Transfers" }],
      rows: sy.systemLogicModels.map((model) => {
        const topId = model.topGate?.gateId;
        const top = topId === undefined ? undefined : model.gates.find((gate) => gate.id === topId);
        const transfers = model.leafNodes.flatMap((leaf) => (leaf.kind === "TRANSFER_REFERENCE" ? [modelCode.get(leaf.target.modelId) ?? leaf.code] : []));
        return {
          id: model.uuid,
          cells: [handoffName(model.code, model.name), shortOf(model.systemReference), top === undefined ? "None" : top.code, model.gates.length, systemFaultTreeBasicEventIds(model).length, joinedOrNone([...new Set(transfers)])],
        };
      }),
    },
    {
      key: "basic-events",
      columns: [{ label: "Event" }, { label: "Failure mode" }, { label: "Value" }, { label: "Value source" }],
      rows: sy.systemBasicEvents.map((event) => {
        const failureMode = event.failureMode ?? "";
        return {
          id: event.uuid,
          cells: [handoffName(event.code, event.name), failureMode.length === 0 ? "None" : FAILURE_MODE_LABELS[failureMode] ?? failureMode, eventValueCell(event, eventCells), eventSourceCell(event, eventCells)],
        };
      }),
    },
    {
      key: "common-cause-groups",
      columns: [{ label: "Group" }, { label: "Members" }, { label: "Factor model" }, { label: "Total", numeric: true }],
      rows: sy.commonCauseFailureGroups.map((group) => ({
        id: group.uuid,
        cells: [
          group.name.length > 0 ? group.name : "Unnamed group",
          joinedOrNone(memberEvents(group, sy).map((event) => event.code)),
          ccfModelText(group.factors),
          totalById.has(group.uuid) ? <PointValue state={totalById.get(group.uuid)} /> : "From the model",
        ],
      })),
    },
    {
      key: "dependency-networks",
      columns: [{ label: "Network" }, { label: "Nodes", numeric: true }, { label: "HCL configurations" }],
      rows: networks.map((network) => ({
        id: network.modelId,
        cells: [
          handoffName(network.code, network.name),
          network.nodes.length,
          joinedOrNone(configurations.filter((configuration) => configuration.bayesianNetwork.modelId === network.modelId).map((configuration) => configuration.code)),
        ],
      })),
    },
    {
      key: "qualification",
      columns: [{ label: "Kind" }, { label: "System" }, { label: "Item" }, { label: "Detail" }],
      rows: [
        ...(sy.environmentalDesignBasisConsiderations ?? []).map((item) => ({
          id: `environment-${item.uuid}`,
          cells: [
            "Environmental design basis",
            shortOf(item.systemReference),
            item.environmentalConditions.length > 0 ? item.environmentalConditions : "None",
            item.beyondQualification === true ? `${joinedOrNone(item.components)} · Beyond environmental qualification` : joinedOrNone(item.components),
          ],
        })),
        ...(sy.overCapacityConsiderations ?? []).map((item) => ({
          id: `capacity-${item.uuid}`,
          cells: ["Over capacity", shortOf(item.system), joinedOrNone(item.potentialExceedanceScenarios), item.treatment === "REALISTIC_JUSTIFIED" ? "Realistic" : "Conservative"],
        })),
      ],
    },
    {
      key: "assumptions",
      columns: ASSUMPTION_COLUMNS,
      rows: [...assumptionRows(sy.modelUncertainty, sy.preOperationalAssumptions), ...uncertaintyRows],
    },
  ];

  return <TechnicalElementHandoff element="SY" sections={sections} />;
}

export { SyHandoffScreen };
