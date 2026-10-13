import { type JSX, useMemo } from "react";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import {
  handoffName,
  joinedOrNone,
  readableId,
  recordLabel,
  TechnicalElementHandoff,
  type HandoffSectionView,
} from "../workbooks/workbookHandoff";
import { releaseCategoryRows } from "./esSelectors";
import { CATEGORY_TEXT, minutesText } from "./EsTiming";
import { AREAS, IMPACTS, STATUSES } from "./EsUncertainty";
import { useEsWorkbook } from "./esWorkbookContext";

function textOrNone(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "None" : text;
}

function esHandoffSections(es: EventSequenceAnalysis, linkedNames: ReadonlyMap<string, string>): HandoffSectionView[] {
  const trees = es.eventTrees ?? [];
  const treeCode = new Map(trees.map((tree) => [tree.uuid, tree.label !== undefined && tree.label.length > 0 ? tree.label : tree.name]));
  const endStateCode = new Map((es.endStateDefinitions ?? []).map((definition) => [definition.id, definition.code]));
  const familyName = new Map(es.eventSequenceFamilies.map((family) => [family.uuid, family.name]));
  const sequenceName = new Map(es.eventSequences.map((sequence) => [sequence.uuid, sequence.name]));
  const scope = es.scopeDefinition;
  const scopeGroups: [string, string[]][] = [
    ["Operating state", scope.plantOperatingStateIds],
    ["Initiator group", scope.initiatingEventIds],
    ["Source", scope.radioactiveMaterialSources],
    ["Barrier", scope.radionuclideBarriers],
  ];
  const networks = es.dependencyBayesianNetworks ?? [];
  const configurations = es.dependencyHclConfigurations ?? [];
  return [
    {
      key: "scope",
      columns: [{ label: "Kind" }, { label: "Item" }],
      rows: scopeGroups.flatMap(([kind, items]) => items.map((item, index) => ({ id: `${kind}-${String(index)}-${item}`, cells: [kind, recordLabel(item, linkedNames.get(item))] }))),
    },
    {
      key: "safety-functions",
      columns: [{ label: "Function" }, { label: "Supporting systems" }, { label: "SC record" }],
      rows: es.keySafetyFunctions.map((entry) => ({ id: entry.id, cells: [handoffName(entry.id, entry.name), joinedOrNone(entry.supportingSystems.map((id) => recordLabel(id))), entry.successCriteriaId === undefined ? "None" : recordLabel(entry.successCriteriaId)] })),
    },
    {
      key: "event-trees",
      columns: [{ label: "Tree" }, { label: "Initiator group" }, { label: "Operating state" }, { label: "Functional events", numeric: true }, { label: "Sequences", numeric: true }],
      rows: trees.map((tree) => ({
        id: tree.uuid,
        cells: [handoffName(treeCode.get(tree.uuid) ?? tree.uuid, tree.name), recordLabel(tree.initiatingEventId, linkedNames.get(tree.initiatingEventId)), tree.plantOperatingStateId === undefined ? "None" : recordLabel(tree.plantOperatingStateId, linkedNames.get(tree.plantOperatingStateId)), Object.keys(tree.functionalEvents).length, Object.keys(tree.sequences).length],
      })),
    },
    {
      key: "sequences",
      columns: [{ label: "Sequence" }, { label: "Tree" }, { label: "End state" }, { label: "Family" }, { label: "Release category" }],
      rows: es.eventSequences.map((sequence) => ({
        id: sequence.uuid,
        cells: [
          sequence.name,
          sequence.eventTreeId === undefined ? "None" : treeCode.get(sequence.eventTreeId) ?? recordLabel(sequence.eventTreeId),
          sequence.endStateId === undefined ? sequence.endState : endStateCode.get(sequence.endStateId) ?? recordLabel(sequence.endStateId),
          sequence.sequenceFamilyId === undefined ? "None" : recordLabel(sequence.sequenceFamilyId, familyName.get(sequence.sequenceFamilyId)),
          sequence.releaseCategoryId ?? "None",
        ],
      })),
    },
    {
      key: "families",
      columns: [{ label: "Family" }, { label: "Members", numeric: true }, { label: "Release categories" }, { label: "End state" }],
      rows: es.eventSequenceFamilies.map((family) => ({
        id: family.uuid,
        cells: [
          handoffName(family.uuid, family.name),
          family.memberSequenceIds.length,
          joinedOrNone(family.releaseCategoryIds ?? []),
          family.endStateId === undefined ? family.endState : endStateCode.get(family.endStateId) ?? recordLabel(family.endStateId),
        ],
      })),
    },
    {
      key: "release-categories",
      columns: [{ label: "Category" }, { label: "End states" }, { label: "Sequences", numeric: true }],
      rows: releaseCategoryRows(es).map((category) => ({ id: category.id, cells: [handoffName(category.id, category.name), joinedOrNone(category.endStateCodes), category.sequenceCount] })),
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
      key: "screening",
      columns: [{ label: "Sequence" }, { label: "Decision" }, { label: "Basis" }],
      rows: es.screeningRecords.map((record) => ({
        id: record.sequenceId,
        cells: [recordLabel(record.sequenceId, sequenceName.get(record.sequenceId)), record.retained ? "Retained" : `Screened${record.criterion === undefined ? "" : ` · ${record.criterion}`}`, record.justification],
      })),
    },
    {
      key: "timing",
      subsections: [
        {
          key: "timelines",
          name: "Timelines",
          columns: [{ label: "Sequence" }, { label: "Milestone" }, { label: "Time", numeric: true }, { label: "Kind" }, { label: "Basis" }, { label: "Analysis references" }],
          rows: es.eventSequences.flatMap((sequence) => (sequence.timing ?? []).map((entry) => ({
            id: `${sequence.uuid}-${entry.uuid}`,
            cells: [sequence.name, entry.event, minutesText(entry.timeAfterInitiator), CATEGORY_TEXT[entry.category ?? "AUTOMATIC"], textOrNone(entry.basis), joinedOrNone(entry.deterministicAnalysisReferences ?? [])],
          }))),
        },
        {
          key: "operator-windows",
          name: "Operator windows",
          columns: [{ label: "Action" }, { label: "Cue" }, { label: "Window", numeric: true }, { label: "Required", numeric: true }, { label: "Margin", numeric: true }],
          rows: (es.operatorActionWindows ?? []).map((item) => ({
            id: item.uuid,
            cells: [
              handoffName(item.humanActionId, item.action),
              textOrNone(item.cue),
              `${minutesText(item.windowStartMinutes)} to ${minutesText(item.windowEndMinutes)}`,
              minutesText(item.requiredMinutes),
              minutesText(item.windowEndMinutes - item.windowStartMinutes - item.requiredMinutes),
            ],
          })),
        },
        {
          key: "phenomena",
          name: "Phenomena",
          columns: [{ label: "Condition" }, { label: "Phenomenon" }, { label: "Onset" }, { label: "Affected systems" }],
          rows: (es.dependencyModels?.phenomenologicalDependencies ?? []).map((condition) => ({
            id: condition.uuid,
            cells: [condition.name, textOrNone(condition.phenomenon), textOrNone(condition.onsetTiming), joinedOrNone(condition.affectedSystems)],
          })),
        },
        {
          key: "repair-credit",
          name: "Repair credit",
          columns: [{ label: "Sequence" }, { label: "Equipment" }, { label: "Credited" }, { label: "Time", numeric: true }, { label: "Access" }],
          rows: (es.repairCreditRecords ?? []).map((record) => ({
            id: record.uuid,
            cells: [
              record.eventSequenceId.length === 0 ? "None" : recordLabel(record.eventSequenceId, sequenceName.get(record.eventSequenceId)),
              textOrNone(record.equipment),
              record.repairCredited ? "Yes" : "No",
              record.timeMinutes === undefined ? "None" : minutesText(record.timeMinutes),
              textOrNone(record.access),
            ],
          })),
        },
      ],
    },
    {
      key: "dynamic-runs",
      subsections: [
        {
          key: "runs",
          name: "Runs",
          columns: [{ label: "Event tree" }, { label: "Initiator group" }, { label: "Operating state" }, { label: "Trials", numeric: true }, { label: "Run date" }],
          rows: (es.dynamicRuns ?? []).map((run) => ({
            id: run.uuid,
            cells: [
              run.eventTreeId === undefined ? "None" : treeCode.get(run.eventTreeId) ?? recordLabel(run.eventTreeId),
              recordLabel(run.initiatingEventId, linkedNames.get(run.initiatingEventId)),
              recordLabel(run.plantOperatingStateId, linkedNames.get(run.plantOperatingStateId)),
              run.trials === undefined ? "None" : run.trials,
              textOrNone(run.runDate),
            ],
          })),
        },
        {
          key: "branches",
          name: "Branches",
          columns: [{ label: "Event tree" }, { label: "Condition" }, { label: "Outcome" }, { label: "Probability", numeric: true }, { label: "Timing" }, { label: "Leads to" }],
          rows: (es.dynamicRuns ?? []).flatMap((run) => Object.values(run.esdNodes).flatMap((node) => node.branches.map((branch, index) => ({
            id: `${run.uuid}-${node.id}-${String(index)}`,
            cells: [
              run.eventTreeId === undefined ? "None" : treeCode.get(run.eventTreeId) ?? recordLabel(run.eventTreeId),
              node.condition,
              branch.outcome,
              branch.probability === undefined ? "None" : `${(branch.probability * 100).toFixed(1)}%`,
              textOrNone(branch.timing),
              branch.sequenceId !== undefined
                ? sequenceName.get(branch.sequenceId) ?? readableId(branch.sequenceId) ?? "Unresolved sequence"
                : branch.targetNodeId !== undefined ? run.esdNodes[branch.targetNodeId]?.condition ?? "Unresolved condition" : "None",
            ],
          })))),
        },
      ],
    },
    {
      key: "uncertainty",
      subsections: [
        {
          key: "register",
          name: "Register",
          columns: [{ label: "Uncertainty" }, { label: "Area" }, { label: "Families" }, { label: "Key" }, { label: "Case or reason" }],
          rows: es.modelUncertainty.uncertaintySources.map((source, index) => {
            const cases = source.id === undefined ? [] : (es.sensitivityStudies ?? []).filter((study) => study.modelUncertaintyId === source.id);
            return {
              id: source.id ?? `source-${String(index)}`,
              cells: [
                textOrNone(source.source),
                AREAS.find((area) => area.id === source.area)?.label ?? "None",
                joinedOrNone((source.familyIds ?? []).map((id) => recordLabel(id, familyName.get(id)))),
                source.key === true ? "Yes" : "No",
                cases.length > 0 ? cases.map((study) => study.name ?? study.description).join(", ") : textOrNone(source.noCaseReason),
              ],
            };
          }),
        },
        {
          key: "sensitivity-proposals",
          name: "Sensitivity proposals",
          columns: [{ label: "Case" }, { label: "Uncertainty" }, { label: "Varied" }, { label: "Expected effect" }],
          rows: (es.sensitivityStudies ?? []).map((study) => ({
            id: study.uuid,
            cells: [
              textOrNone(study.name ?? study.description),
              study.modelUncertaintyId === undefined ? "None" : es.modelUncertainty.uncertaintySources.find((source) => source.id === study.modelUncertaintyId)?.source ?? "Unresolved uncertainty",
              joinedOrNone(study.variedParameters),
              textOrNone(study.impact),
            ],
          })),
        },
        {
          key: "pre-operational",
          name: "Pre-operational",
          columns: [{ label: "Assumption" }, { label: "Status" }, { label: "Risk impact" }, { label: "How it closes" }],
          rows: (es.preOperationalAssumptions ?? []).map((assumption) => ({
            id: assumption.uuid,
            cells: [
              handoffName(assumption.assumptionId, assumption.description),
              STATUSES.find((status) => status.id === assumption.status)?.label ?? assumption.status,
              IMPACTS.find((impact) => impact.id === assumption.riskImpact)?.label ?? assumption.riskImpact,
              assumption.closureBasis.trim().length > 0 ? assumption.closureBasis : joinedOrNone(assumption.plannedClosureActions),
            ],
          })),
        },
        {
          key: "sequence-family-assumptions",
          name: "Sequence and family assumptions",
          columns: [{ label: "Applies to" }, { label: "Assumption" }, { label: "Status" }],
          rows: [
            ...es.eventSequences.flatMap((sequence) => (sequence.sequenceSpecificAssumptions ?? []).map((entry, index) => ({ id: `sequence-${sequence.uuid}-${String(index)}`, cells: [sequence.name, handoffName(entry.assumptionId, entry.description), STATUSES.find((status) => status.id === entry.status)?.label ?? entry.status] }))),
            ...es.eventSequenceFamilies.flatMap((family) => (family.familySpecificAssumptions ?? []).map((entry, index) => ({ id: `family-${family.uuid}-${String(index)}`, cells: [family.name, handoffName(entry.assumptionId, entry.description), STATUSES.find((status) => status.id === entry.status)?.label ?? entry.status] }))),
          ],
        },
      ],
    },
  ];
}

function EsHandoffScreen(): JSX.Element {
  const { es, posLink, ieLink } = useEsWorkbook();
  const linkedNames = useMemo(() => new Map([...posLink.states, ...ieLink.groups].map((entry) => [entry.id, entry.name])), [posLink.states, ieLink.groups]);
  const sections = useMemo(() => esHandoffSections(es, linkedNames), [es, linkedNames]);
  return <TechnicalElementHandoff element="ES" sections={sections} />;
}

export { EsHandoffScreen };
