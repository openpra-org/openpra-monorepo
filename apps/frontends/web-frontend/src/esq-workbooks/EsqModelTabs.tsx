import { JSX, useId, useMemo, useState } from "react";
import type { EventTree, FunctionalEvent, FunctionalEventNetworkNode } from "interfaces-mef-types/es/event-sequence-analysis";
import type {
  EsqFamilyChoice,
  EsqFunctionNodeLink,
  EsqFunctionRule,
  EsqFunctionTarget,
  EsqInitiatorChoice,
  EsqModel,
  EsqParameterRecord,
  EsqSplitFractionTarget,
  EsqTreeRecord,
  EsqValueHolder,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { FaultTreeTopEventReference } from "interfaces-mef-types/modeling";
import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import { holdsEstimate, isComponentModel } from "interfaces-mef-types/da/data-analysis";
import { parameterLaw, parameterUnit } from "interfaces-mef-types/esq/esq-measure-inputs";
import { barrierWorkOf } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { legacyExpression } from "interfaces-mef-types/core/legacy-uncertainty-adapter";
import {
  EventTreeEditor,
  applyEventTreeOperation,
  createEmptyEventTree,
  validateEventTree,
  type EventTreeOperation,
  type EventTreeRepresentation,
} from "../newly-developed-methods/event-tree";
import { ExpressionEditor, MissionTimeEditor, type ModelForm, type ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import { useUncertaintyVersion } from "../newly-developed-methods/shared/useUncertainty";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { scMissionTimeOptions } from "../sc-workbooks/scMissionTimeLinks";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { PAGE, Pager, TabBar, paged } from "../es-workbooks/EsTiming";
import { cellRecordText } from "./esqBarriers";
import { FaultTreeDiagram, FaultTreeWindow, pointText, sciText, useExpressionPoints, type EsqPointEntry } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { END_STATE_LABELS, FREQUENCY_UNIT_OPTIONS } from "./esqViewData";
import {
  daParameterOptionsOf,
  familyIdTaken,
  missionTimeSourcesOf,
  missionTimeTableOf,
  modelImportReady,
  modelLinked,
  modelViewOf,
  nextFamilyId,
  nextTypedTreeCode,
  parameterLabelOf,
  parameterTableOf,
  reachedTreesOf,
  resolveLink,
  ruleScopeText,
  sequenceChoiceOf,
  splitViewsOf,
  stateWeightingOf,
  topOf,
  treeRuleOf,
  typedTreesOf,
  withDefaultLink,
  withDefaultLinkReason,
  withFamilyChoice,
  withFamilyRemoved,
  withFamilyRenamed,
  withFunctionLink,
  withHandFamily,
  withInitiatorChoice,
  withModelImported,
  withRuleChanged,
  withSequenceChoice,
  withSplitTarget,
  withTreeLink,
  withTreeMissionTime,
  withTypedTreeRemoved,
  withTypedTrees,
  withValueBinding,
  type EsqFindingSeverity,
  type EsqFunctionView,
  type EsqInitiatorView,
  type EsqModelFinding,
  type EsqModelView,
  type EsqSequenceView,
  type EsqValueView,
} from "./esqModel";
import "../es-workbooks/css/esSequences.css";
import "./css/esqModel.css";

type ModelTab = "trees" | "functions" | "families" | "initiators" | "splits" | "values" | "checks";

type ModelDialog =
  | { kind: "function"; id: string }
  | { kind: "family"; id: string }
  | { kind: "unfamilied" }
  | { kind: "initiator"; id: string }
  | { kind: "split"; key: string }
  | { kind: "value"; id: string }
  | { kind: "link"; treeId: string; functionalEventId: string; name: string }
  | { kind: "faultTreeView"; modelIds: string[] };

type LinkKind = "FAULT_TREE" | "NETWORK_NODE";

interface AxisOption {
  id: string;
  name: string;
}

const LINK_KINDS: readonly (readonly [LinkKind, string])[] = [["FAULT_TREE", "Fault tree top"], ["NETWORK_NODE", "Network node"]];

const MODEL_TABS: { id: ModelTab; label: string }[] = [
  { id: "trees", label: "Trees" },
  { id: "functions", label: "Functions" },
  { id: "families", label: "Families" },
  { id: "initiators", label: "Initiators" },
  { id: "splits", label: "Split fractions" },
  { id: "values", label: "Values" },
  { id: "checks", label: "Checks" },
];

const SEVERITY_TEXT: Record<EsqFindingSeverity, string> = { error: "Error", warning: "Warning", note: "Note" };

const SPLIT = "split";

const START_SPLIT: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.5 } } };

const START_FREQUENCY: UncertainExpression = { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 1e-2 } } };

const START_VALUE: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 1e-3 } } };

const START_MISSION_HOURS = 24;

const COMPONENT_MODELS: readonly ModelForm[] = ["MISSION", "STANDBY"];

const NO_MODELS: readonly ModelForm[] = [];

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function topKey(modelId: string, gateId: string): string {
  return `top:${modelId}:${gateId}`;
}

function targetValue(target: EsqFunctionTarget | undefined): string {
  if (target === undefined) return "";
  return target.kind === "SPLIT_FRACTION" ? SPLIT : topKey(target.top.modelId, target.top.gateId);
}

function targetFrom(value: string, model: EsqModel, current: EsqFunctionTarget | undefined, workbookId: string): EsqFunctionTarget | undefined {
  if (value === SPLIT) return current?.kind === "SPLIT_FRACTION" ? current : { kind: "SPLIT_FRACTION" };
  const top = model.tops.find((record) => topKey(record.modelId, record.gateId) === value);
  return top === undefined ? undefined : { kind: "FAULT_TREE", top: { workbookId, modelId: top.modelId, gateId: top.gateId } };
}

function targetText(model: EsqModel, target: EsqFunctionTarget | undefined): string {
  if (target === undefined) return "Not linked";
  if (target.kind === "SPLIT_FRACTION") return "Split fraction";
  return topOf(model, target.top)?.code ?? "Missing top";
}

function nodeText(link: EsqFunctionNodeLink): string {
  return link.label.length === 0 ? "Missing network node" : `Network node ${link.label}`;
}

function linkedToText(model: EsqModel, entry: EsqFunctionView): string {
  const labels = [...entry.targets.map((target) => targetText(model, target)), ...entry.nodes.map(nodeText)];
  const first = labels[0];
  if (first === undefined) return "Not linked";
  const head = labels.length === 1 ? first : `${labels.length} targets`;
  return entry.unlinked.length === 0 ? head : `${head}, ${entry.unlinked.length} not linked`;
}

function fallbackText(model: EsqModel, entry: EsqFunctionView, tree: EsqTreeRecord): string {
  const link = entry.link;
  const own = treeRuleOf(link, tree.id);
  const rest = link === undefined ? undefined : { ...link, rules: (link.rules ?? []).filter((rule) => rule !== own) };
  const resolved = resolveLink(entry.record, rest, tree);
  if (resolved.origin === "NONE") return "Not linked";
  const where = resolved.origin === "ES" ? (tree.typed === true ? "As drawn" : "From ES") : resolved.origin === "ESQ" ? "Every tree" : "Rule";
  return `${where} · ${resolved.node === undefined ? targetText(model, resolved.target) : nodeText(resolved.node)}`;
}

function syWorkbookOf(esq: EventSequenceQuantification, model: EsqModel): string {
  return esq.linkedWorkbooks?.SY ?? model.sources.find((source) => source.element === "SY")?.workbookId ?? "";
}

function topLabel(top: { code: string; name: string; systemName?: string }): string {
  return [top.code, top.name, top.systemName ?? ""].filter((part) => part.length > 0).join(" · ");
}

function axisOptions(entries: readonly AxisOption[]): AxisOption[] {
  const out: AxisOption[] = [];
  for (const entry of entries) {
    if (entry.id.trim().length > 0 && !out.some((known) => known.id === entry.id)) out.push(entry);
  }
  return out;
}

function treeAxes(esq: EventSequenceQuantification): { initiators: AxisOption[]; states: AxisOption[] } {
  const model = esq.model;
  const coverage = esq.modelIntegration.scopeCoverage;
  return {
    initiators: axisOptions([
      ...(model?.initiators ?? []).map((initiator) => ({ id: initiator.id, name: initiator.name })),
      ...coverage.initiatingEventGroups.map((id) => ({ id, name: id })),
      ...(model?.trees ?? []).filter((tree) => !tree.transferEntry).map((tree) => ({ id: tree.initiatorId, name: tree.initiatorId })),
    ]),
    states: axisOptions([
      ...(model?.states ?? []).map((state) => ({ id: state.id, name: state.name })),
      ...coverage.plantOperatingStates.map((id) => ({ id, name: id })),
      ...(model?.trees ?? []).flatMap((tree) => (tree.stateId === undefined ? [] : [{ id: tree.stateId, name: tree.stateId }])),
    ]),
  };
}

function looseSequences(view: EsqModelView): EsqSequenceView[] {
  return view.sequences.filter((sequence) => sequence.record.transferTreeId === undefined && (sequence.familyId === undefined || !view.families.some((family) => family.id === sequence.familyId)));
}

function releaseCategoriesOf(view: EsqModelView, current: string | undefined): string[] {
  const ids = new Set<string>();
  for (const family of view.model.families) for (const id of family.releaseCategoryIds) ids.add(id);
  for (const sequence of view.model.sequences) if (sequence.releaseCategoryId !== undefined) ids.add(sequence.releaseCategoryId);
  if (current !== undefined && current.trim().length > 0) ids.add(current.trim());
  return [...ids].sort();
}

function holderText(heldBy: EsqValueHolder, holderId: string | undefined): string {
  if (heldBy === "DA") return ` · DA · ${holderId ?? ""}`;
  if (heldBy === "HRA") return ` · HR · ${holderId ?? ""}`;
  return "";
}

function valueSourceOf(value: EsqValueView): string {
  if (value.typedHere) return "ESQ";
  if (value.heldBy === "DA") return "DA";
  if (value.heldBy === "HRA") return "HRA";
  return "SY";
}

function valueFromText(value: EsqValueView): string {
  if (value.typedHere) return "Typed";
  if (value.heldBy === "DA") return `DA · ${value.holderId ?? ""}`;
  if (value.heldBy === "HRA") return `HR · ${value.holderId ?? ""}`;
  return "SY";
}

function valueText(value: EsqValueView, point: string): string {
  if (value.expression !== undefined) return point;
  if (value.value === undefined) return "—";
  return `${sciText(value.value)}${value.event?.valueUnit === "PER_HOUR" && value.parameter === undefined && value.human === undefined ? " /h" : ""}`;
}

function initiatorFromText(entry: EsqInitiatorView): string {
  if (entry.source === "TYPED") return "Typed";
  if (entry.source === "DA") return `DA · ${entry.choice?.parameterId ?? "not set"}`;
  if (entry.record === undefined) return "Not in IE";
  return entry.record.heldBy === "DA" && entry.record.holderId !== undefined ? `IE · ${entry.record.holderId}` : "IE";
}

function splitFromText(target: EsqSplitFractionTarget): string {
  if (target.cellId !== undefined) return `Step 03 · ${target.cellId}`;
  if (target.parameterId !== undefined) return `DA · ${target.parameterId}`;
  return "Typed";
}

function lawOfText(expression: UncertainExpression | undefined, label: (key: string) => string): string {
  return expression === undefined ? "no value" : expressionText(expression, label);
}

function frequencyOptions(esq: EventSequenceQuantification): ParameterOption[] {
  const workbookId = esq.linkedWorkbooks?.DA;
  if (workbookId === undefined || workbookId.length === 0) return [];
  return (esq.model?.parameters ?? []).flatMap((parameter) => (parameter.quantificationModel === "FREQUENCY" && parameter.estimate !== undefined
    ? [{ reference: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId, entityId: parameter.id }, label: `DA · ${parameter.id} · ${parameter.name}`, unit: "PER_YEAR" as const }]
    : []));
}

function useParameterTools(): { table: Map<string, UncertainParameter>; label: (key: string) => string; scOptions: ParameterOption[] } {
  const { esq, upstream } = useEsqWorkbook();
  const sources = useMemo(() => missionTimeSourcesOf(esq, upstream), [esq, upstream]);
  const table = useMemo(() => parameterTableOf(esq, sources), [esq, sources]);
  const label = useMemo(() => parameterLabelOf(esq, sources), [esq, sources]);
  const scOptions = useMemo(() => sources.flatMap((source) => scMissionTimeOptions(source.workbookId, source.sc)), [sources]);
  return { table, label, scOptions };
}

function TargetSelect({ label, value, first, model, disabled, onChange }: { label: string; value: string; first?: string; model: EsqModel; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const known = value === "" || value === SPLIT || model.tops.some((top) => topKey(top.modelId, top.gateId) === value);
  return (
    <select className="posfield__select" aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {first !== undefined && <option value="">{first}</option>}
      {!known && <option value={value}>Missing top</option>}
      {model.tops.map((top) => <option key={topKey(top.modelId, top.gateId)} value={topKey(top.modelId, top.gateId)}>{topLabel(top)}</option>)}
      <option value={SPLIT}>Split fraction</option>
    </select>
  );
}

function ReasonCell({ label, value, editable, onChange }: { label: string; value: string; editable: boolean; onChange: (text: string) => void }): JSX.Element {
  const missing = value.trim().length === 0;
  if (!editable) return <>{value}</>;
  return (
    <>
      <WorkbookTextarea className="posfield__textarea esq-model-reason" rows={1} fitContent aria-label={label} aria-invalid={missing} value={value} onChange={(event) => onChange(event.target.value)} />
      {missing && <span className="esq-model-reason-error" role="alert">Reason required</span>}
    </>
  );
}

function TreePanel({ tree, initiators, states, onOpenTree, onOpenFaultTree, onLink }: {
  tree: EsqTreeRecord | undefined;
  initiators: readonly AxisOption[];
  states: readonly AxisOption[];
  onOpenTree: (id: string) => void;
  onOpenFaultTree: (modelIds: string[]) => void;
  onLink: (treeId: string, event: FunctionalEvent) => void;
}): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream, runtime } = useEsqWorkbook();
  const [representation, setRepresentation] = useState<EventTreeRepresentation>("event-tree");
  const [selection, setSelection] = useState<string | null>(null);
  const model = esq.model;
  if (tree === undefined || model === undefined) return null;
  const typed = tree.typed === true;
  const source: EventTree | undefined = typed ? typedTreesOf(esq).find((candidate) => candidate.uuid === tree.id) : upstream.es?.eventTrees?.find((candidate) => candidate.uuid === tree.id);
  if (source === undefined) return null;
  const author = typed && editable;
  const transfers = model.trees.filter((candidate) => candidate.id !== tree.id).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    sequenceIds: model.sequences.filter((sequence) => sequence.treeId === candidate.id).map((sequence) => sequence.id),
  }));
  const endStates = typed ? [] : (upstream.es?.endStateDefinitions ?? []).map((definition) => ({ id: definition.id, code: definition.code, name: definition.name, release: definition.kind === "RELEASE" }));
  const validation = typed
    ? validateEventTree(source, [...typedTreesOf(esq), ...model.trees.filter((candidate) => candidate.typed !== true).map((candidate) => candidate.id)])
      .filter((finding) => !finding.code.startsWith("ET_FREQUENCY") && finding.code !== "ET_FT_LINK_REQUIRED")
    : [];

  function applyOperation(operation: EventTreeOperation): void {
    if (!author || tree === undefined) return;
    const treeId = tree.id;
    const now = new Date().toISOString();
    mutateEsq((draft) => {
      const trees = typedTreesOf(draft);
      const current = trees.find((candidate) => candidate.uuid === treeId);
      if (current === undefined) return draft;
      const reserved = new Set((draft.model?.sequences ?? []).filter((sequence) => sequence.treeId !== treeId).map((sequence) => sequence.code));
      const next = applyEventTreeOperation(current, operation, reserved);
      return next === current ? draft : withTypedTrees(draft, trees.map((candidate) => (candidate.uuid === treeId ? next : candidate)), upstream, now);
    });
  }

  function faultTreeName(reference: FaultTreeTopEventReference): string | undefined {
    const top = model?.tops.find((candidate) => candidate.modelId === reference.modelId);
    return top === undefined ? undefined : topLabel({ code: top.code, name: top.name });
  }

  function networkNodeName(link: FunctionalEventNetworkNode): string | undefined {
    const reference = link.bayesianNetworkNode;
    const network = (upstream.sy?.dependencyBayesianNetworks ?? []).find((candidate) => candidate.modelId === reference.modelId);
    const node = network?.nodes.find((candidate) => candidate.id === reference.entityId);
    return network === undefined || node === undefined ? undefined : `${node.code} · ${node.name} · ${network.code}`;
  }

  return (
    <EventTreeEditor
      model={source}
      eventSequences={typed ? [] : upstream.es?.eventSequences ?? []}
      availableInitiatingEvents={[...initiators]}
      availableOperatingStates={[...states]}
      editFrequency={false}
      availableTransfers={transfers}
      representation={representation}
      capabilities={{ author, quantification: false, linkSelection: author }}
      selection={selection}
      validation={validation}
      saveState={runtime.saveStatus}
      onOperation={applyOperation}
      onRepresentationChange={setRepresentation}
      onSelectionChange={setSelection}
      faultTreeName={faultTreeName}
      networkNodeName={networkNodeName}
      {...(author ? { onSelectLink: (event: FunctionalEvent) => onLink(source.uuid, event) } : {})}
      {...(endStates.length === 0 ? {} : { endStateOptions: endStates })}
      onOpenReference={(reference) => {
        if ("targetEventTreeId" in reference) onOpenTree(reference.targetEventTreeId);
        else onOpenFaultTree([reference.modelId]);
      }}
    />
  );
}

function LinkDialog({ treeId, functionalEventId, name, onClose }: { treeId: string; functionalEventId: string; name: string; onClose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const tree = typedTreesOf(esq).find((candidate) => candidate.uuid === treeId);
  const functionalEvent = Object.values(tree?.functionalEvents ?? {}).find((candidate) => candidate.uuid === functionalEventId);
  const current = functionalEvent?.faultTreeTopEvent;
  const currentNode = functionalEvent?.networkNode;
  const [kind, setKind] = useState<LinkKind>(currentNode === undefined ? "FAULT_TREE" : "NETWORK_NODE");
  const [value, setValue] = useState(current === undefined ? "" : topKey(current.modelId, current.entityId));
  const [networkId, setNetworkId] = useState(currentNode?.bayesianNetworkNode.modelId ?? "");
  const [nodeId, setNodeId] = useState(currentNode?.bayesianNetworkNode.entityId ?? "");
  const [failingStateIds, setFailingStateIds] = useState<readonly string[]>(currentNode?.trueStateIds ?? []);
  const model = esq.model;
  const tops = model?.tops ?? [];
  const workbookId = model === undefined ? "" : syWorkbookOf(esq, model);
  const networks = upstream.sy?.dependencyBayesianNetworks ?? [];
  const network = networks.find((candidate) => candidate.modelId === networkId) ?? networks[0];
  const nodes = network?.nodes ?? [];
  const node = nodes.find((candidate) => candidate.id === nodeId) ?? nodes[0];
  const failing = node === undefined ? [] : failingStateIds.filter((stateId) => node.states.some((state) => state.id === stateId));
  const nodeReady = workbookId.length > 0 && network !== undefined && node !== undefined && failing.length > 0 && failing.length < node.states.length;
  const chosen = tops.find((record) => topKey(record.modelId, record.gateId) === value);

  function change(operation: EventTreeOperation): void {
    if (!editable) return;
    const now = new Date().toISOString();
    mutateEsq((draft) => {
      const trees = typedTreesOf(draft);
      const known = trees.find((candidate) => candidate.uuid === treeId);
      if (known === undefined) return draft;
      const next = applyEventTreeOperation(known, operation);
      return withTypedTrees(draft, trees.map((candidate) => (candidate.uuid === treeId ? next : candidate)), upstream, now);
    });
    onClose();
  }

  function save(): void {
    if (kind === "FAULT_TREE") {
      if (chosen === undefined) return;
      change({ kind: "SET_FAULT_TREE_REFERENCE", functionalEventId, reference: { referenceType: "FAULT_TREE_TOP_EVENT", workbookId, modelId: chosen.modelId, entityId: chosen.gateId } });
      return;
    }
    if (!nodeReady || network === undefined || node === undefined) return;
    change({
      kind: "SET_NETWORK_NODE",
      functionalEventId,
      link: {
        bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId, modelId: network.modelId, entityId: node.id },
        trueStateIds: node.states.filter((state) => failing.includes(state.id)).map((state) => state.id),
      },
    });
  }

  function remove(): void {
    change(currentNode === undefined
      ? { kind: "SET_FAULT_TREE_REFERENCE", functionalEventId, reference: undefined }
      : { kind: "SET_NETWORK_NODE", functionalEventId, link: undefined });
  }

  function showModel(modelId: string): void {
    const top = tops.find((record) => record.modelId === modelId);
    if (top !== undefined) setValue(topKey(top.modelId, top.gateId));
  }

  function selectNetwork(modelId: string): void {
    setNetworkId(modelId);
    setNodeId("");
    setFailingStateIds([]);
  }

  function selectNode(id: string): void {
    setNodeId(id);
    setFailingStateIds([]);
  }

  function toggleState(stateId: string): void {
    setFailingStateIds((known) => (known.includes(stateId) ? known.filter((id) => id !== stateId) : [...known, stateId]));
  }

  return (
    <DialogShell label="Link" onClose={onClose} fit>
      <DialogHead cap="Link · ESQ-A2" title={name} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-model-fields">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${fieldId}-kind`}>Link to</label>
            <select id={`${fieldId}-kind`} className="posfield__select" value={kind} disabled={!editable} onChange={(event) => setKind(LINK_KINDS.find(([option]) => option === event.target.value)?.[0] ?? "FAULT_TREE")}>
              {LINK_KINDS.map(([option, label]) => <option key={option} value={option}>{label}</option>)}
            </select>
          </div>
          {kind === "FAULT_TREE" ? (
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label" htmlFor={`${fieldId}-top`}>Fault tree top</label>
              <select id={`${fieldId}-top`} className="posfield__select" value={value} disabled={!editable || tops.length === 0} onChange={(event) => setValue(event.target.value)}>
                <option value="">Not linked</option>
                {tops.map((top) => <option key={topKey(top.modelId, top.gateId)} value={topKey(top.modelId, top.gateId)}>{topLabel(top)}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="posfield">
                <label className="posfield__label" htmlFor={`${fieldId}-network`}>Network</label>
                <select id={`${fieldId}-network`} className="posfield__select" value={network?.modelId ?? ""} disabled={!editable || networks.length === 0} onChange={(event) => selectNetwork(event.target.value)}>
                  {networks.length === 0 && <option value="">No network in the linked SY workbook</option>}
                  {networks.map((candidate) => <option key={candidate.modelId} value={candidate.modelId}>{`${candidate.code} · ${candidate.name}`}</option>)}
                </select>
              </div>
              <div className="posfield">
                <label className="posfield__label" htmlFor={`${fieldId}-node`}>Node</label>
                <select id={`${fieldId}-node`} className="posfield__select" value={node?.id ?? ""} disabled={!editable || nodes.length === 0} onChange={(event) => selectNode(event.target.value)}>
                  {nodes.map((candidate) => <option key={candidate.id} value={candidate.id}>{`${candidate.code} · ${candidate.name}`}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        {kind === "FAULT_TREE" && chosen !== undefined && <FaultTreeDiagram key={chosen.modelId} modelId={chosen.modelId} eventIds={[]} onModel={showModel} />}
        {kind === "NETWORK_NODE" && node !== undefined && (
          <fieldset className="esq-model-states" disabled={!editable}>
            <legend>{`States of ${node.code} in which ${name} fails`}</legend>
            {node.states.map((state) => (
              <label key={state.id}>
                <input type="checkbox" checked={failing.includes(state.id)} onChange={() => toggleState(state.id)} />
                <span>{`${state.code} · ${state.name}`}</span>
              </label>
            ))}
          </fieldset>
        )}
        {editable && (
          <div className="posrow es-dialog-actions">
            {(current !== undefined || currentNode !== undefined) && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove link</button>}
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={kind === "FAULT_TREE" ? chosen === undefined : !nodeReady} onClick={save}>Save</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function FunctionsPanel({ view, onOpen }: { view: EsqModelView; onOpen: (id: string) => void }): JSX.Element {
  const { editable } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(view.functions.length, page);
  const shown = view.functions.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <Pager rows={rows} noun="function" onPage={setPage} />
      </div>
      {view.functions.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Functions">
          <thead><tr><th scope="col">Function</th><th scope="col">Trees</th><th scope="col">Linked to</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((entry) => (
              <tr key={entry.record.id}>
                <td>
                  <span className="postable__name">{entry.record.name}</span>
                  {entry.record.name !== entry.record.id && <span className="postable__name-sub posmono">{entry.record.id}</span>}
                </td>
                <td className="posmono">{entry.trees.length}</td>
                <td>{entry.targets.length === 0 && entry.nodes.length === 0 ? <span className="esq-model-flag">Not linked</span> : linkedToText(view.model, entry)}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${entry.record.id}`} onClick={() => onOpen(entry.record.id)}>{actionLabel}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function FunctionDialog({ id, view, onClose }: { id: string; view: EsqModelView; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const entry = view.functions.find((candidate) => candidate.record.id === id);
  if (entry === undefined) return null;
  const record = entry.record;
  const model = view.model;
  const workbookId = syWorkbookOf(esq, model);
  const link = entry.link;
  const legacy = (link?.rules ?? []).filter((rule) => (rule.treeIds ?? []).length === 0);
  const defaultReason = entry.fromEs && link?.target !== undefined;
  const treeReason = (tree: EsqTreeRecord): boolean => tree.typed !== true && treeRuleOf(link, tree.id) !== undefined && [...record.esLinks, ...(record.nodeLinks ?? [])].some((candidate) => candidate.treeId === tree.id);
  const showReason = defaultReason || legacy.length > 0 || entry.trees.some(treeReason);
  const showActions = editable && legacy.length > 0;

  function setDefault(value: string): void {
    if (!editable) return;
    mutateEsq((draft) => withDefaultLink(draft, id, targetFrom(value, model, link?.target, workbookId)));
  }

  function setTree(tree: EsqTreeRecord, value: string): void {
    if (!editable) return;
    const known = treeRuleOf(link, tree.id);
    mutateEsq((draft) => withTreeLink(draft, id, tree.id, targetFrom(value, model, known?.target, workbookId)));
  }

  function setRule(rule: EsqFunctionRule, next: EsqFunctionRule | undefined): void {
    if (!editable) return;
    mutateEsq((draft) => withRuleChanged(draft, id, rule.id, next));
  }

  return (
    <DialogShell label="Function" onClose={onClose} fit>
      <DialogHead cap="Function · ESQ-A2" title={record.name === id ? id : `${id} · ${record.name}`} onClose={onClose} />
      <div className="modal__body esq-model-dialog">
        <table className="postable postable--mid esq-model-items" aria-label={`${id} links`}>
          <thead>
            <tr>
              <th scope="col">Tree</th>
              <th scope="col">Linked to</th>
              {showReason && <th scope="col" className="esq-model-reason-col">Reason for change</th>}
              {showActions && <th scope="col" className="es-records__act" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="postable__name">Every tree</span></td>
              <td><TargetSelect label="Every tree linked to" value={targetValue(link?.target)} first={entry.fromEs ? "As each tree links it" : "Not linked"} model={model} disabled={!editable} onChange={setDefault} /></td>
              {showReason && <td>{defaultReason && <ReasonCell label="Every tree reason for change" value={link?.reason ?? ""} editable={editable} onChange={(text) => mutateEsq((draft) => withDefaultLinkReason(draft, id, text))} />}</td>}
              {showActions && <td />}
            </tr>
            {entry.trees.map((tree) => {
              const own = treeRuleOf(link, tree.id);
              return (
                <tr key={tree.id}>
                  <td>
                    <span className="postable__name">{tree.code}</span>
                    {tree.name !== tree.code && <span className="postable__name-sub">{tree.name}</span>}
                  </td>
                  <td><TargetSelect label={`${tree.code} linked to`} value={targetValue(own?.target)} first={fallbackText(model, entry, tree)} model={model} disabled={!editable} onChange={(value) => setTree(tree, value)} /></td>
                  {showReason && <td>{own !== undefined && treeReason(tree) && <ReasonCell label={`${tree.code} reason for change`} value={own.reason} editable={editable} onChange={(text) => setRule(own, { ...own, reason: text })} />}</td>}
                  {showActions && <td />}
                </tr>
              );
            })}
            {legacy.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <span className="postable__name">{ruleScopeText(model, rule)}</span>
                  <span className="postable__name-sub">Rule</span>
                </td>
                <td>
                  <TargetSelect label={`${ruleScopeText(model, rule)} linked to`} value={targetValue(rule.target)} model={model} disabled={!editable} onChange={(value) => {
                    const target = targetFrom(value, model, rule.target, workbookId);
                    if (target !== undefined) setRule(rule, { ...rule, target });
                  }} />
                </td>
                {showReason && <td><ReasonCell label={`${ruleScopeText(model, rule)} reason`} value={rule.reason} editable={editable} onChange={(text) => setRule(rule, { ...rule, reason: text })} /></td>}
                {showActions && (
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove the rule for ${ruleScopeText(model, rule)}`} onClick={() => setRule(rule, undefined)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editable && link !== undefined && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withFunctionLink(draft, id, undefined))}>{entry.fromEs ? "Restore the ES links" : "Clear the links"}</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function MembersTable({ view, members, label }: { view: EsqModelView; members: readonly EsqSequenceView[]; label: string }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(members.length, page);
  const shown = members.slice(rows.start, rows.start + PAGE);
  const reasonNeeded = (member: EsqSequenceView): boolean => member.choice !== undefined && member.tree?.typed !== true;
  const showReason = members.some(reasonNeeded);

  function setFamily(member: EsqSequenceView, familyId: string): void {
    if (!editable || familyId.length === 0) return;
    const sequenceId = member.record.id;
    const original = member.record.familyId ?? "";
    mutateEsq((draft) => withSequenceChoice(draft, sequenceId, familyId === original ? undefined : { sequenceId, familyId, reason: sequenceChoiceOf(draft, sequenceId)?.reason ?? "" }));
  }

  return (
    <>
      <div className="es-records__bar">
        <Pager rows={rows} noun="sequence" onPage={setPage} />
      </div>
      {members.length > 0 && (
        <table className="postable postable--mid esq-model-items" aria-label={label}>
          <thead>
            <tr>
              <th scope="col">Sequence</th>
              <th scope="col">Family</th>
              {showReason && <th scope="col" className="esq-model-reason-col">Reason for change</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((member) => {
              const record = member.record;
              const known = member.familyId !== undefined && view.families.some((family) => family.id === member.familyId);
              const choice = member.choice;
              return (
                <tr key={record.id}>
                  <td>
                    <span className="postable__name">{record.code}</span>
                    {member.tree !== undefined && <span className="postable__name-sub">{member.tree.code}</span>}
                  </td>
                  <td>
                    <select className="posfield__select" aria-label={`${record.code} family`} value={known ? member.familyId ?? "" : ""} disabled={!editable} onChange={(event) => setFamily(member, event.target.value)}>
                      {!known && <option value="">Not set</option>}
                      {view.families.map((family) => <option key={family.id} value={family.id}>{family.name.length > 0 ? `${family.id} · ${family.name}` : family.id}</option>)}
                    </select>
                  </td>
                  {showReason && (
                    <td>
                      {choice !== undefined && reasonNeeded(member) && (
                        <ReasonCell label={`${record.code} reason for change`} value={choice.reason} editable={editable} onChange={(text) => mutateEsq((draft) => withSequenceChoice(draft, record.id, { ...choice, reason: text }))} />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function FamiliesPanel({ view, onOpen, onLoose }: { view: EsqModelView; onOpen: (id: string) => void; onLoose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const loose = looseSequences(view);
  const rows = paged(view.families.length, page);
  const shown = view.families.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";

  function add(): void {
    if (!editable) return;
    const id = nextFamilyId(esq);
    mutateEsq((draft) => withHandFamily(draft, id));
    onOpen(id);
  }

  return (
    <>
      <div className="es-records__bar">
        <Pager rows={rows} noun="family" plural="families" onPage={setPage} />
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add family</button>}
      </div>
      {(view.families.length > 0 || loose.length > 0) && (
        <table className="postable postable--mid es-records" aria-label="Families">
          <thead><tr><th scope="col">Family</th><th scope="col">Release category</th><th scope="col">Sequences</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((family) => (
              <tr key={family.id}>
                <td>
                  <span className="postable__name">{family.name.length > 0 ? family.name : family.id}</span>
                  <span className="postable__name-sub">{family.manual ? `${family.id} · Typed` : family.id}</span>
                </td>
                <td>{family.releaseCategoryId ?? (family.release ? <span className="esq-model-flag">Not set</span> : <span className="posmuted">None</span>)}</td>
                <td className="posmono">{family.members.length}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${family.id}`} onClick={() => onOpen(family.id)}>{actionLabel}</button>
                </td>
              </tr>
            ))}
            {loose.length > 0 && rows.current === rows.pages - 1 && (
              <tr>
                <td><span className="postable__name">Not in a family</span></td>
                <td><span className="posmuted">None</span></td>
                <td className="posmono">{loose.length}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} the sequences not in a family`} onClick={onLoose}>{actionLabel}</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}

function FamilyDialog({ id, view, onClose, onRenamed }: { id: string; view: EsqModelView; onClose: () => void; onRenamed: (id: string) => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [idError, setIdError] = useState("");
  const family = view.families.find((candidate) => candidate.id === id);
  if (family === undefined) return null;
  const choice = family.choice;
  const base: EsqFamilyChoice = choice ?? { familyId: id };
  const esCategories = family.record?.releaseCategoryIds ?? [];
  const showCategory = family.manual || esCategories.length !== 1;
  const categories = releaseCategoriesOf(view, choice?.releaseCategoryId);
  const categoryMissing = family.release && family.releaseCategoryId === undefined;

  function patch(next: Partial<EsqFamilyChoice>): void {
    if (!editable) return;
    mutateEsq((draft) => withFamilyChoice(draft, id, { ...base, ...next, familyId: id }));
  }

  function rename(text: string): void {
    if (!editable) return;
    const value = text.trim();
    if (value === id) {
      setIdError("");
      return;
    }
    if (value.length === 0) {
      setIdError("ID required");
      return;
    }
    if (familyIdTaken(esq, value, id)) {
      setIdError("ID already used");
      return;
    }
    setIdError("");
    mutateEsq((draft) => withFamilyRenamed(draft, id, value));
    onRenamed(value);
  }

  return (
    <DialogShell label="Family" onClose={onClose} fit>
      <DialogHead cap={family.manual ? "Typed family · ESQ-A1" : "Family · ESQ-A1"} title={family.name.length > 0 ? `${id} · ${family.name}` : id} onClose={onClose} />
      <div className="modal__body esq-model-dialog">
        <div className="posfield-grid esq-model-fields">
          {family.manual && (
            <>
              <div className="posfield">
                <label className="posfield__label" htmlFor={`${fieldId}-id`}>ID</label>
                <WorkbookInput id={`${fieldId}-id`} className="posfield__input posmono" value={id} disabled={!editable} aria-invalid={idError.length > 0} onChange={(event) => rename(event.target.value)} />
                {idError.length > 0 && <span className="esq-model-reason-error" role="alert">{idError}</span>}
              </div>
              <div className="posfield">
                <label className="posfield__label" htmlFor={`${fieldId}-name`}>Name</label>
                <WorkbookInput id={`${fieldId}-name`} className="posfield__input" value={choice?.name ?? ""} disabled={!editable} onChange={(event) => patch({ name: event.target.value })} />
              </div>
              <div className="posfield">
                <label className="posfield__label" htmlFor={`${fieldId}-end`}>End state</label>
                <select id={`${fieldId}-end`} className="posfield__select" value={choice?.endState ?? ""} disabled={!editable} onChange={(event) => patch({ endState: event.target.value.length === 0 ? undefined : event.target.value })}>
                  <option value="">Not set</option>
                  {Object.entries(END_STATE_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </div>
            </>
          )}
          {showCategory && (
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-category`}>Release category</label>
              <WorkbookInput id={`${fieldId}-category`} className="posfield__input posmono" list={`${fieldId}-categories`} value={choice?.releaseCategoryId ?? ""} disabled={!editable} aria-invalid={categoryMissing} onChange={(event) => patch({ releaseCategoryId: event.target.value.trim().length === 0 ? undefined : event.target.value.trim() })} />
              <datalist id={`${fieldId}-categories`}>
                {categories.map((category) => <option key={category} value={category} />)}
              </datalist>
              {categoryMissing && <span className="esq-model-reason-error" role="alert">Release category required</span>}
            </div>
          )}
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${fieldId}-grouping`}>Reason for grouping</label>
            <WorkbookTextarea id={`${fieldId}-grouping`} className="posfield__textarea" rows={2} fitContent value={choice?.groupingReason ?? ""} disabled={!editable} onChange={(event) => patch({ groupingReason: event.target.value })} />
          </div>
          {family.manual && (
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label" htmlFor={`${fieldId}-source`}>Where this family comes from</label>
              <WorkbookTextarea id={`${fieldId}-source`} className="posfield__textarea" rows={2} fitContent value={choice?.manual?.source ?? ""} disabled={!editable} onChange={(event) => patch({ manual: { source: event.target.value } })} />
            </div>
          )}
        </div>
        <div className="esq-model-section">
          <span className="posfield__label">Sequences</span>
          <MembersTable view={view} members={family.members} label={`${id} sequences`} />
        </div>
        {editable && family.manual && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withFamilyRemoved(draft, id)); onClose(); }}>Delete family</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function LooseDialog({ view, onClose }: { view: EsqModelView; onClose: () => void }): JSX.Element {
  const members = looseSequences(view);
  return (
    <DialogShell label="Not in a family" onClose={onClose} fit>
      <DialogHead cap="Families · ESQ-A1" title="Not in a family" onClose={onClose} />
      <div className="modal__body esq-model-dialog">
        <MembersTable view={view} members={members} label="Sequences not in a family" />
      </div>
    </DialogShell>
  );
}

function InitiatorsPanel({ view, onOpen }: { view: EsqModelView; onOpen: (id: string) => void }): JSX.Element {
  const { editable } = useEsqWorkbook();
  const { table } = useParameterTools();
  const [page, setPage] = useState(0);
  const rows = paged(view.initiators.length, page);
  const shown = useMemo(() => view.initiators.slice(rows.start, rows.start + PAGE), [view.initiators, rows.start]);
  const entries = useMemo(() => shown.flatMap((entry): EsqPointEntry[] => (entry.expression === undefined ? [] : [{ key: entry.id, expression: entry.expression, unit: "PER_YEAR" }])), [shown]);
  const points = useExpressionPoints(entries, table);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <Pager rows={rows} noun="initiator group" onPage={setPage} />
      </div>
      {view.initiators.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Initiators">
          <thead><tr><th scope="col">Initiator group</th><th scope="col">Frequency (/reactor-year)</th><th scope="col">From</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className="postable__name">{entry.name}</span>
                  {entry.name !== entry.id && <span className="postable__name-sub posmono">{entry.id}</span>}
                </td>
                <td className="posmono">{entry.expression === undefined ? <span className="esq-model-flag">Not set</span> : pointText(points.get(entry.id))}</td>
                <td>{initiatorFromText(entry)}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${entry.id}`} onClick={() => onOpen(entry.id)}>{actionLabel}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function numberFrom(text: string, apply: (value: number | undefined) => void): void {
  if (text.trim().length === 0) {
    apply(undefined);
    return;
  }
  const value = Number(text);
  if (Number.isFinite(value) && value >= 0) apply(value);
}

function InitiatorDialog({ id, view, onClose }: { id: string; view: EsqModelView; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const { label, scOptions } = useParameterTools();
  const fieldId = useId();
  const entry = view.initiators.find((candidate) => candidate.id === id);
  if (entry === undefined) return null;
  const choice = entry.choice;
  const weighting = stateWeightingOf(esq);
  const parameters = view.model.parameters.filter((parameter) => parameter.quantificationModel === "FREQUENCY" && holdsEstimate(parameter.quantificationModel));
  const options = frequencyOptions(esq);
  const base: EsqInitiatorChoice = choice ?? { groupId: id, source: "IE" };
  const typedStart = base.expression ?? entry.record?.frequency?.expression ?? START_FREQUENCY;
  const applicable = entry.states.filter((state) => state.applicable);
  const trees = reachedTreesOf(view.model, entry.trees);
  const sourceValue = base.source === "DA" ? `da:${base.parameterId ?? ""}` : base.source === "TYPED" ? "typed" : "ie";
  const ieUnit = FREQUENCY_UNIT_OPTIONS.find((option) => option.id === entry.record?.frequency?.basis)?.label.toLowerCase() ?? "";
  const ieText = entry.record?.frequency === undefined ? "Imported from IE" : `Imported from IE · ${expressionText(entry.record.frequency.expression, label)} ${ieUnit}`.trim();

  function save(next: EsqInitiatorChoice): void {
    if (!editable) return;
    const empty = next.source === "IE" && (next.shares ?? []).length === 0;
    mutateEsq((draft) => withInitiatorChoice(draft, id, empty ? undefined : next));
  }

  function setSource(value: string): void {
    const shares = base.shares === undefined ? {} : { shares: base.shares };
    if (value === "ie") save({ groupId: id, source: "IE", ...shares });
    else if (value === "typed") save({ groupId: id, source: "TYPED", ...shares, expression: typedStart, unit: base.unit ?? FREQUENCY_UNIT_OPTIONS.find((option) => option.id === entry?.record?.frequency?.basis)?.id ?? FrequencyUnit.PER_REACTOR_YEAR, ...(base.basis === undefined ? {} : { basis: base.basis }) });
    else save({ groupId: id, source: "DA", parameterId: value.slice(3), ...shares });
  }

  function setShare(stateId: string, percent: number | undefined): void {
    const rest = (base.shares ?? []).filter((share) => share.stateId !== stateId);
    save({ ...base, shares: percent === undefined ? rest : [...rest, { stateId, percent }] });
  }

  function setMissionTime(tree: EsqTreeRecord, missionTime: UncertainExpression | undefined): void {
    if (!editable) return;
    mutateEsq((draft) => withTreeMissionTime(draft, tree.id, missionTime));
  }

  return (
    <DialogShell label="Initiator group" onClose={onClose} fit>
      <DialogHead cap="Initiator group · ESQ-A2" title={entry.name === id ? id : `${id} · ${entry.name}`} onClose={onClose} />
      <div className="modal__body esq-model-dialog">
        <div className="posfield-grid esq-model-fields">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${fieldId}-from`}>Frequency from</label>
            <select id={`${fieldId}-from`} className="posfield__select" value={sourceValue} disabled={!editable} onChange={(event) => setSource(event.target.value)}>
              <option value="ie">{ieText}</option>
              {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`Imported from DA · ${parameter.id} · ${parameter.estimate === undefined ? "no estimate" : expressionText(parameter.estimate, label)}`}</option>)}
              {base.source === "DA" && base.parameterId !== undefined && !parameters.some((parameter) => parameter.id === base.parameterId) && <option value={sourceValue}>{`DA · ${base.parameterId} · not imported`}</option>}
              <option value="typed">Typed</option>
            </select>
          </div>
          {base.source === "TYPED" && (
            <>
              <div className="posfield posfield-grid--span2">
                <span className="posfield__label">Frequency</span>
                <ExpressionEditor expression={typedStart} unit="PER_YEAR" options={options} disabled={!editable} onChange={(expression) => save({ ...base, expression })} />
              </div>
              <div className="posfield">
                <label className="posfield__label" htmlFor={`${fieldId}-unit`}>Unit</label>
                <select id={`${fieldId}-unit`} className="posfield__select" value={base.unit ?? FrequencyUnit.PER_REACTOR_YEAR} disabled={!editable} onChange={(event) => {
                  const unit = FREQUENCY_UNIT_OPTIONS.find((option) => option.id === event.target.value)?.id;
                  if (unit !== undefined) save({ ...base, unit });
                }}>
                  {FREQUENCY_UNIT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <div className="posfield posfield-grid--span2">
                <label className="posfield__label" htmlFor={`${fieldId}-basis`}>Basis</label>
                <WorkbookTextarea id={`${fieldId}-basis`} className="posfield__textarea" rows={2} fitContent value={base.basis ?? ""} disabled={!editable} onChange={(event) => save({ ...base, basis: event.target.value })} />
              </div>
            </>
          )}
        </div>
        {weighting === "TYPED_SHARES" && applicable.length > 1 && (
          <div className="esq-model-section">
            <span className="posfield__label">Share by state</span>
            <table className="postable postable--mid esq-model-items" aria-label="Share by state">
              <thead><tr><th scope="col">Operating state</th><th scope="col">Share (%)</th></tr></thead>
              <tbody>
                {applicable.map((state) => (
                  <tr key={state.stateId}>
                    <td>
                      <span className="postable__name">{state.stateId}</span>
                      {state.name !== state.stateId && <span className="postable__name-sub">{state.name}</span>}
                    </td>
                    <td>
                      <WorkbookInput type="number" min="0" max="100" step="any" className="posfield__input posmono esq-model-share" aria-label={`${state.stateId} share`} value={base.shares?.find((share) => share.stateId === state.stateId)?.percent ?? ""} disabled={!editable} onChange={(event) => numberFrom(event.target.value, (percent) => setShare(state.stateId, percent))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {trees.length > 0 && (
          <div className="esq-model-section">
            <span className="posfield__label">Mission time</span>
            <table className="postable postable--mid esq-model-items" aria-label="Mission time">
              <thead><tr><th scope="col">Tree</th><th scope="col">Mission time</th></tr></thead>
              <tbody>
                {trees.map((tree) => (
                  <tr key={tree.id}>
                    <td>
                      <span className="postable__name">{tree.code}</span>
                      {tree.name !== tree.code && <span className="postable__name-sub">{tree.name}</span>}
                    </td>
                    <td>
                      <div className="esq-model-mission">
                        <select className="posfield__select" aria-label={`${tree.code} mission time from`} value={tree.missionTime === undefined ? "es" : "typed"} disabled={!editable} onChange={(event) => setMissionTime(tree, event.target.value === "typed" ? tree.esMissionTime ?? legacyExpression("HOURS", START_MISSION_HOURS) : undefined)}>
                          <option value="es">{tree.esMissionTime === undefined ? "Not in ES" : `Imported from ES · ${expressionText(tree.esMissionTime, label)}`}</option>
                          <option value="typed">Typed</option>
                        </select>
                        {tree.missionTime !== undefined && <MissionTimeEditor expression={tree.missionTime} options={scOptions} disabled={!editable} onChange={(next) => setMissionTime(tree, next)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function SplitsPanel({ view, onOpen }: { view: EsqModelView; onOpen: (key: string) => void }): JSX.Element {
  const { esq, editable } = useEsqWorkbook();
  const { table } = useParameterTools();
  const [page, setPage] = useState(0);
  const splits = useMemo(() => splitViewsOf(esq, view), [esq, view]);
  const rows = paged(splits.length, page);
  const shown = useMemo(() => splits.slice(rows.start, rows.start + PAGE), [splits, rows.start]);
  const entries = useMemo(() => shown.flatMap((split): EsqPointEntry[] => (split.expression === undefined ? [] : [{ key: split.key, expression: split.expression, unit: "PROBABILITY" }])), [shown]);
  const points = useExpressionPoints(entries, table);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <Pager rows={rows} noun="split fraction" onPage={setPage} />
      </div>
      {splits.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Split fractions">
          <thead><tr><th scope="col">Function</th><th scope="col">Applies to</th><th scope="col">Value</th><th scope="col">From</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((split) => (
              <tr key={split.key}>
                <td>
                  <span className="postable__name">{split.functionName}</span>
                  {split.functionName !== split.functionId && <span className="postable__name-sub posmono">{split.functionId}</span>}
                </td>
                <td>{split.scope}</td>
                <td className="posmono">{split.expression === undefined ? <span className="esq-model-flag">Not set</span> : pointText(points.get(split.key))}</td>
                <td>{splitFromText(split.target)}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} the split fraction of ${split.functionId}`} onClick={() => onOpen(split.key)}>{actionLabel}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function SplitDialog({ splitKey, view, onClose }: { splitKey: string; view: EsqModelView; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const { label } = useParameterTools();
  const fieldId = useId();
  const split = splitViewsOf(esq, view).find((candidate) => candidate.key === splitKey);
  if (split === undefined) return null;
  const target = split.target;
  const parameters = view.model.parameters.filter((parameter) => parameterUnit(parameter) === "PROBABILITY" && parameterLaw(parameter) !== undefined);
  const cells = (barrierWorkOf(esq).cells ?? []).filter((cell) => (cell.use === "SPLIT_FRACTION" && cell.screening === undefined) || cell.id === target.cellId);
  const from = target.cellId !== undefined ? `cell:${target.cellId}` : target.parameterId === undefined ? "typed" : `da:${target.parameterId}`;
  const functionId = split.functionId;
  const ruleId = split.ruleId;

  function save(next: EsqSplitFractionTarget): void {
    if (!editable) return;
    mutateEsq((draft) => withSplitTarget(draft, functionId, ruleId, next));
  }

  function setFrom(value: string): void {
    if (value.startsWith("cell:")) save({ kind: "SPLIT_FRACTION", cellId: value.slice(5) });
    else if (value.startsWith("da:")) save({ kind: "SPLIT_FRACTION", parameterId: value.slice(3) });
    else save({ kind: "SPLIT_FRACTION", expression: target.expression ?? START_SPLIT, ...(target.basis === undefined ? {} : { basis: target.basis }) });
  }

  return (
    <DialogShell label="Split fraction" onClose={onClose}>
      <DialogHead cap="Split fraction · ESQ-A2" title={`${split.functionName} · ${split.scope}`} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-model-fields">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${fieldId}-from`}>Value from</label>
            <select id={`${fieldId}-from`} className="posfield__select" value={from} disabled={!editable} onChange={(event) => setFrom(event.target.value)}>
              <option value="typed">Typed</option>
              {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`Imported from DA · ${parameter.id} · ${lawOfText(parameterLaw(parameter), label)}`}</option>)}
              {target.parameterId !== undefined && !parameters.some((parameter) => parameter.id === target.parameterId) && <option value={from}>{`DA · ${target.parameterId} · not imported`}</option>}
              {cells.map((cell) => <option key={cell.id} value={`cell:${cell.id}`}>{`Step 03 · ${cell.id}${cell.familyId === undefined ? "" : ` · ${cell.familyId}`} · ${cellRecordText(cell, label)}`}</option>)}
              {target.cellId !== undefined && !cells.some((cell) => cell.id === target.cellId) && <option value={from}>{`Step 03 · ${target.cellId} · removed`}</option>}
            </select>
          </div>
          {target.cellId === undefined && target.parameterId === undefined && (
            <>
              <div className="posfield posfield-grid--span2">
                <span className="posfield__label">Split fraction</span>
                <ExpressionEditor expression={target.expression ?? START_SPLIT} unit="PROBABILITY" options={daParameterOptionsOf(esq)} disabled={!editable} onChange={(expression) => save({ ...target, expression })} />
              </div>
              <div className="posfield posfield-grid--span2">
                <label className="posfield__label" htmlFor={`${fieldId}-basis`}>Basis</label>
                <WorkbookTextarea id={`${fieldId}-basis`} className="posfield__textarea" rows={2} fitContent value={target.basis ?? ""} disabled={!editable} onChange={(event) => save({ ...target, basis: event.target.value })} />
              </div>
            </>
          )}
        </div>
      </div>
    </DialogShell>
  );
}

function ValuesPanel({ view, onOpen }: { view: EsqModelView; onOpen: (id: string) => void }): JSX.Element {
  const { editable } = useEsqWorkbook();
  const { table } = useParameterTools();
  const fieldId = useId();
  const [system, setSystem] = useState("");
  const [from, setFrom] = useState("");
  const [page, setPage] = useState(0);
  const all = useMemo(() => view.values.filter((value) => value.kind === "EVENT"), [view.values]);
  const found = useMemo(() => all.filter((value) => (system.length === 0 || value.systemName === system) && (from.length === 0 || valueSourceOf(value) === from)), [all, system, from]);
  const rows = paged(found.length, page);
  const shown = useMemo(() => found.slice(rows.start, rows.start + PAGE), [found, rows.start]);
  const entries = useMemo(() => shown.flatMap((value): EsqPointEntry[] => (value.expression === undefined ? [] : [{ key: value.id, expression: value.expression, unit: "PROBABILITY" }])), [shown]);
  const points = useExpressionPoints(entries, table);
  const systems = [...new Set(all.flatMap((value) => (value.systemName === undefined ? [] : [value.systemName])))].sort();
  const actionLabel = editable ? "Edit" : "View";

  function filterBy(set: (value: string) => void, value: string): void {
    set(value);
    setPage(0);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-system`}>System</label>
            <select id={`${fieldId}-system`} className="posfield__select" value={system} onChange={(event) => filterBy(setSystem, event.target.value)}>
              <option value="">All systems</option>
              {systems.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-from`}>From</label>
            <select id={`${fieldId}-from`} className="posfield__select" value={from} onChange={(event) => filterBy(setFrom, event.target.value)}>
              <option value="">All sources</option>
              <option value="SY">SY</option>
              <option value="DA">DA</option>
              <option value="HRA">HR</option>
              <option value="ESQ">Typed</option>
            </select>
          </div>
        </div>
        <Pager rows={rows} noun="basic event" onPage={setPage} />
      </div>
      {found.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Values">
          <thead><tr><th scope="col">Basic event</th><th scope="col">Value</th><th scope="col">From</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((value) => (
              <tr key={value.id}>
                <td>
                  <span className="postable__name posmono">{value.code}</span>
                  {value.name.length > 0 && <span className="postable__name-sub">{value.name}</span>}
                </td>
                <td className="posmono">{value.problem !== undefined ? <span className="esq-model-flag">Cannot be used</span> : valueText(value, pointText(points.get(value.id)))}</td>
                <td>{valueFromText(value)}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${value.code}`} onClick={() => onOpen(value.id)}>{actionLabel}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function ValueDialog({ id, view, onClose }: { id: string; view: EsqModelView; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const { label, scOptions } = useParameterTools();
  const fieldId = useId();
  const value = view.values.find((candidate) => candidate.kind === "EVENT" && candidate.id === id);
  const event = value?.event;
  if (value === undefined || event === undefined) return null;
  const binding = value.binding;
  const typedHere = binding?.heldBy === "TYPED";
  const parameters = view.model.parameters.filter((parameter) => (value.component ? isComponentModel(parameter.quantificationModel) : !isComponentModel(parameter.quantificationModel) && parameter.parameterType !== "FREQUENCY" && parameter.parameterType !== "CCF_PARAMETER"));
  const syValue = event.expression !== undefined ? ` · ${expressionText(event.expression, label)}` : event.heldBy === "TYPED" && event.value !== undefined ? ` · ${sciText(event.value)}` : "";
  const current = binding === undefined ? "sy" : typedHere ? "typed" : `${binding.heldBy === "DA" ? "da" : "hr"}:${binding.holderId ?? ""}`;
  const options = [...daParameterOptionsOf(esq), ...scOptions];
  const reason = binding?.reason ?? "";

  function parameterText(parameter: EsqParameterRecord): string {
    if (!isComponentModel(parameter.quantificationModel)) return `Imported from DA · ${parameter.id} · ${lawOfText(parameterLaw(parameter), label)}`;
    return parameter.estimate === undefined ? `Imported from DA · ${parameter.id} · no estimate` : `Imported from DA · ${parameter.id} · ${expressionText(parameter.estimate, label)}`;
  }

  function setFrom(next: string): void {
    if (!editable || event === undefined) return;
    if (next === "sy") {
      mutateEsq((draft) => withValueBinding(draft, id, undefined));
      return;
    }
    if (next === "typed") {
      const start = event.expression ?? (event.value !== undefined && event.valueUnit !== "PER_HOUR" ? legacyExpression("PROBABILITY", event.value) : START_VALUE);
      mutateEsq((draft) => withValueBinding(draft, id, { eventId: id, heldBy: "TYPED", expression: start, reason }));
      return;
    }
    const heldBy = next.startsWith("da:") ? "DA" : "HRA";
    const holderId = next.slice(3);
    if (heldBy === event.heldBy && holderId === event.holderId) {
      mutateEsq((draft) => withValueBinding(draft, id, undefined));
      return;
    }
    mutateEsq((draft) => withValueBinding(draft, id, { eventId: id, heldBy, holderId, reason }));
  }

  function setReason(text: string): void {
    if (!editable || binding === undefined) return;
    mutateEsq((draft) => withValueBinding(draft, id, { ...binding, reason: text }));
  }

  return (
    <DialogShell label="Basic event" onClose={onClose}>
      <DialogHead cap="Basic event · ESQ-A8" title={event.name.length > 0 ? `${event.code} · ${event.name}` : event.code} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-model-fields">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${fieldId}-from`}>Value from</label>
            <select id={`${fieldId}-from`} className="posfield__select" value={current} disabled={!editable} onChange={(changeEvent) => setFrom(changeEvent.target.value)}>
              <option value="sy">{`Imported from SY${holderText(event.heldBy, event.holderId)}${syValue}`}</option>
              {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{parameterText(parameter)}</option>)}
              {binding?.heldBy === "DA" && !parameters.some((parameter) => parameter.id === binding.holderId) && <option value={current}>{`DA · ${binding.holderId ?? ""} · cannot set this event`}</option>}
              {view.model.humanEvents.map((human) => <option key={human.id} value={`hr:${human.id}`}>{`Imported from HR · ${human.id} · ${lawOfText(human.hep, label)}`}</option>)}
              <option value="typed">Typed</option>
            </select>
            {value.problem !== undefined && <span className="esq-model-reason-error" role="alert">Cannot be used</span>}
          </div>
          {typedHere && binding !== undefined && (
            <>
              <div className="posfield posfield-grid--span2">
                <span className="posfield__label">Value</span>
                <ExpressionEditor expression={binding.expression ?? START_VALUE} unit="PROBABILITY" options={options} models={value.component ? COMPONENT_MODELS : NO_MODELS} {...(event.missionTime === undefined ? {} : { defaultTime: event.missionTime })} disabled={!editable} onChange={(expression) => mutateEsq((draft) => withValueBinding(draft, id, { ...binding, expression }))} />
              </div>
              <div className="posfield posfield-grid--span2">
                <label className="posfield__label" htmlFor={`${fieldId}-basis`}>Basis</label>
                <WorkbookTextarea id={`${fieldId}-basis`} className="posfield__textarea" rows={2} fitContent value={reason} disabled={!editable} onChange={(changeEvent) => setReason(changeEvent.target.value)} />
              </div>
            </>
          )}
          {binding !== undefined && !typedHere && (
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label" htmlFor={`${fieldId}-reason`}>Reason for change</label>
              <WorkbookTextarea id={`${fieldId}-reason`} className="posfield__textarea" rows={2} fitContent aria-invalid={blank(reason)} value={reason} disabled={!editable} onChange={(changeEvent) => setReason(changeEvent.target.value)} />
              {blank(reason) && <span className="esq-model-reason-error" role="alert">Reason required</span>}
            </div>
          )}
        </div>
      </div>
    </DialogShell>
  );
}

function ChecksPanel({ findings, opens, onOpen }: { findings: readonly EsqModelFinding[]; opens: (finding: EsqModelFinding) => boolean; onOpen: (finding: EsqModelFinding) => void }): JSX.Element {
  const [page, setPage] = useState(0);
  const rows = paged(findings.length, page);
  const shown = findings.slice(rows.start, rows.start + PAGE);
  return (
    <>
      <div className="es-records__bar">
        <Pager rows={rows} noun="finding" onPage={setPage} />
      </div>
      {findings.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Checks">
          <thead><tr><th scope="col">Severity</th><th scope="col">Check</th><th scope="col">Item</th><th scope="col">Detail</th></tr></thead>
          <tbody>
            {shown.map((finding, index) => (
              <tr key={`${finding.check}:${finding.item}:${String(rows.start + index)}`}>
                <td className={`es-severity es-severity--${finding.severity}`}>{SEVERITY_TEXT[finding.severity]}</td>
                <td>{finding.check}</td>
                <td>{opens(finding) ? <button type="button" className="es-records__link" onClick={() => onOpen(finding)}>{finding.item}</button> : finding.item}</td>
                <td>{finding.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function EsqModelTabs(): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const [tab, setTab] = useState<ModelTab>("trees");
  const [treeId, setTreeId] = useState("");
  const [dialog, setDialog] = useState<ModelDialog | null>(null);
  const version = useUncertaintyVersion();
  const missionTimes = useMemo(() => missionTimeTableOf(esq, upstream), [esq, upstream]);
  const view = useMemo(() => (version < 0 ? undefined : modelViewOf(esq, upstream.options, missionTimes)), [esq, upstream.options, missionTimes, version]);
  const axes = useMemo(() => treeAxes(esq), [esq]);
  const ready = modelImportReady(esq, upstream);
  const linked = modelLinked(esq).length > 0;
  const imported = esq.model?.importedAt !== undefined;
  const trees = esq.model?.trees ?? [];
  const inScope = new Set((view?.trees ?? []).map((tree) => tree.id));
  const active = trees.find((tree) => tree.id === treeId) ?? view?.trees[0] ?? trees[0];
  const esTrees = trees.filter((tree) => tree.typed !== true);
  const drawnTrees = trees.filter((tree) => tree.typed === true);
  const canAdd = editable && (imported || ready);
  const showImport = editable && linked;

  function openTree(id: string): void {
    setTreeId(id);
    setTab("trees");
  }

  function importNow(): void {
    if (!editable || !ready) return;
    const now = new Date().toISOString();
    mutateEsq((draft) => withModelImported(draft, upstream, now));
  }

  function addTree(): void {
    if (!canAdd) return;
    const initiator = axes.initiators[0]?.id ?? "IE-1";
    const created: EventTree = { ...createEmptyEventTree(initiator, axes.states[0]?.id), label: nextTypedTreeCode(esq) };
    const now = new Date().toISOString();
    mutateEsq((draft) => withTypedTrees(draft, [...typedTreesOf(draft), created], upstream, now));
    openTree(created.uuid);
  }

  function removeTree(id: string): void {
    if (!editable) return;
    const now = new Date().toISOString();
    mutateEsq((draft) => withTypedTreeRemoved(draft, id, upstream, now));
    setTreeId("");
  }

  function treeOption(tree: EsqTreeRecord): string {
    const text = tree.name === tree.code ? tree.code : `${tree.code} · ${tree.name}`;
    return inScope.has(tree.id) ? text : `${text} · out of scope`;
  }

  function opens(finding: EsqModelFinding): boolean {
    const target = finding.target;
    if (target === undefined || view === undefined) return false;
    if (target.kind === "esqValue") return view.values.some((value) => value.kind === "EVENT" && value.id === target.id);
    if (target.kind === "esqTree") return trees.some((tree) => tree.id === target.id);
    return true;
  }

  function openFinding(finding: EsqModelFinding): void {
    const target = finding.target;
    if (target === undefined || view === undefined) return;
    switch (target.kind) {
      case "esqTree": openTree(target.id); return;
      case "esqFunction": setDialog({ kind: "function", id: target.id }); return;
      case "esqFamily": setDialog({ kind: "family", id: target.id }); return;
      case "esqInitiator": setDialog({ kind: "initiator", id: target.id }); return;
      case "esqValue": setDialog({ kind: "value", id: target.id }); return;
      case "esqSequence": {
        const familyId = view.sequences.find((sequence) => sequence.record.id === target.id)?.familyId;
        setDialog(familyId === undefined || !view.families.some((family) => family.id === familyId) ? { kind: "unfamilied" } : { kind: "family", id: familyId });
      }
    }
  }

  function renderPanel(): JSX.Element | null {
    if (tab === "trees") {
      return (
        <TreePanel
          key={active?.id ?? ""}
          tree={active}
          initiators={axes.initiators}
          states={axes.states}
          onOpenTree={openTree}
          onOpenFaultTree={(modelIds) => setDialog({ kind: "faultTreeView", modelIds })}
          onLink={(id, event) => setDialog({ kind: "link", treeId: id, functionalEventId: event.uuid, name: event.label ?? event.name })}
        />
      );
    }
    if (view === undefined) return null;
    switch (tab) {
      case "functions": return <FunctionsPanel view={view} onOpen={(id) => setDialog({ kind: "function", id })} />;
      case "families": return <FamiliesPanel view={view} onOpen={(id) => setDialog({ kind: "family", id })} onLoose={() => setDialog({ kind: "unfamilied" })} />;
      case "initiators": return <InitiatorsPanel view={view} onOpen={(id) => setDialog({ kind: "initiator", id })} />;
      case "splits": return <SplitsPanel view={view} onOpen={(key) => setDialog({ kind: "split", key })} />;
      case "values": return <ValuesPanel view={view} onOpen={(id) => setDialog({ kind: "value", id })} />;
      case "checks": return <ChecksPanel findings={view.findings} opens={opens} onOpen={openFinding} />;
    }
  }

  function renderDialog(): JSX.Element | null {
    if (dialog === null) return null;
    const close = (): void => setDialog(null);
    if (dialog.kind === "link") return <LinkDialog treeId={dialog.treeId} functionalEventId={dialog.functionalEventId} name={dialog.name} onClose={close} />;
    if (dialog.kind === "faultTreeView") return <FaultTreeWindow key={dialog.modelIds.join(",")} modelIds={dialog.modelIds} eventIds={[]} onClose={close} />;
    if (view === undefined) return null;
    switch (dialog.kind) {
      case "function": return <FunctionDialog id={dialog.id} view={view} onClose={close} />;
      case "family": return <FamilyDialog key={dialog.id} id={dialog.id} view={view} onClose={close} onRenamed={(id) => setDialog({ kind: "family", id })} />;
      case "unfamilied": return <LooseDialog view={view} onClose={close} />;
      case "initiator": return <InitiatorDialog id={dialog.id} view={view} onClose={close} />;
      case "split": return <SplitDialog splitKey={dialog.key} view={view} onClose={close} />;
      case "value": return <ValueDialog id={dialog.id} view={view} onClose={close} />;
    }
  }

  return (
    <>
      <div className="poscard es-seq-card">
        {(tab === "trees" || showImport) && (
          <div className="poscard__head es-seq-card__head esq-model-head">
            {tab === "trees" && (trees.length > 0 ? (
              <div className="es-seq-card__picker">
                <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
                <div className="es-seq-card__pick-row">
                  <select id={`${fieldId}-tree`} className="posfield__select" value={active?.id ?? ""} onChange={(event) => openTree(event.target.value)}>
                    {esTrees.length > 0 && <optgroup label="Imported from ES">{esTrees.map((tree) => <option key={tree.id} value={tree.id}>{treeOption(tree)}</option>)}</optgroup>}
                    {drawnTrees.length > 0 && <optgroup label="Drawn in ESQ">{drawnTrees.map((tree) => <option key={tree.id} value={tree.id}>{treeOption(tree)}</option>)}</optgroup>}
                  </select>
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!canAdd} onClick={addTree}>Add event tree</button>}
                  {editable && active?.typed === true && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeTree(active.id)}>Delete event tree</button>}
                </div>
              </div>
            ) : editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!canAdd} onClick={addTree}>Add event tree</button>)}
            {showImport && (
              <div className="esq-model-head__import">
                <button type="button" className={`posnav__btn posnav__btn--sm${imported ? "" : " posnav__btn--primary"}`} disabled={!ready} onClick={importNow}>{imported ? "Import again" : "Import from linked workbooks"}</button>
              </div>
            )}
          </div>
        )}
        <TabBar tabs={MODEL_TABS} tab={tab} label="Model sections" findings={view?.findings.length ?? 0} onTab={setTab} />
        <div className="es-seq-card__panel">{renderPanel()}</div>
      </div>
      {renderDialog()}
    </>
  );
}

export { EsqModelTabs };
