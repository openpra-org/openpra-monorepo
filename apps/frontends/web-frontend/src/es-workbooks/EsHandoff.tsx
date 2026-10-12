import { type JSX, useMemo } from "react";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import {
  ASSUMPTION_COLUMNS,
  assumptionRows,
  handoffName,
  joinedOrNone,
  recordLabel,
  TechnicalElementHandoff,
  type HandoffSectionView,
} from "../workbooks/workbookHandoff";
import { releaseCategoryRows } from "./esSelectors";
import { useEsWorkbook } from "./esWorkbookContext";

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
      key: "assumptions",
      columns: ASSUMPTION_COLUMNS,
      rows: [
        ...assumptionRows(es.modelUncertainty, es.preOperationalAssumptions),
        ...es.eventSequences.flatMap((sequence) => (sequence.sequenceSpecificAssumptions ?? []).map((entry, index) => ({ id: `sequence-${sequence.uuid}-${String(index)}`, cells: ["Sequence assumption", `${sequence.name} · ${entry.description}`, entry.assumptionId] }))),
        ...es.eventSequenceFamilies.flatMap((family) => (family.familySpecificAssumptions ?? []).map((entry, index) => ({ id: `family-${family.uuid}-${String(index)}`, cells: ["Family assumption", `${family.name} · ${entry.description}`, entry.assumptionId] }))),
        ...(es.sensitivityStudies ?? []).map((study) => ({ id: `study-${study.uuid}`, cells: ["Sensitivity study", study.name ?? study.description, joinedOrNone(study.variedParameters)] })),
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
