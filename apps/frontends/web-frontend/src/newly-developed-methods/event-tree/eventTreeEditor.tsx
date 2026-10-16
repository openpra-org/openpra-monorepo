import { PagedResults, ResultCsvButton, ResultWarnings } from "../shared/resultPresentation";
import { eventTreeResultRecords } from "../shared/probabilityResultExport";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import { renderFaultTreePng } from "../fault-tree/faultTreeImage";
import { eventTreeOutcomeRank, type EventSequence, type EventTreeOutcome, type FunctionalEvent } from "interfaces-mef-types/es/event-sequence-analysis";
import { DEFAULT_ANNUALIZATION_CONVENTION, type AnnualizationBasis, type EventTreeInitiatingEventFrequency } from "interfaces-mef-types/modeling";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import {
  applyEventTreeOperation,
  createEventTreePresentation,
  eventTreeMoveProblem,
  initiatingFrequencyUnit,
  orderedFunctionalEvents,
  uniqueFunctionalEventCode,
  type FrequencyParameterTable,
  type InitiatingFrequencyUnit,
} from "./eventTreeOperations";
import { ExpressionEditor, type ParameterOption } from "../shared/uncertainEditor";
import {
  ClassicEventTreeDiagram,
  EventSequenceDiagram,
  EventTreeIcon,
  formatExponential,
} from "./eventTreePresentation";
import type { EventTreeBranchPoint, EventTreeEditorProps, EventTreeOperation, EventTreeRepresentation } from "./eventTreeTypes";
import { useEditorConfirmation } from "../shared";
import { EventTreeTransferResults } from "./eventTreeTransferResults";
import { eventTreeResultName } from "./eventTreeResultLabels";
import "./css/eventTree.css";

const REPRESENTATIONS: Array<{ id: EventTreeRepresentation; label: string }> = [
  { id: "event-tree", label: "Event tree" },
  { id: "event-sequence-diagram", label: "ESD" },
  { id: "table", label: "Sequence table" },
];

function pathState(outcome: EventTreeOutcome | undefined): { label: string; short: string; className: string } {
  if (outcome === "SUCCESS") return { label: "Success", short: "S", className: "success" };
  if (outcome === "FAILURE") return { label: "Failure", short: "F", className: "failure" };
  if (outcome === undefined || outcome === "BYPASSED") return { label: "Bypassed", short: "B", className: "bypassed" };
  const position = String(eventTreeOutcomeRank(outcome) + 1);
  return { label: `Branch ${position}`, short: position, className: "branch" };
}

const FREQUENCY_UNITS: Array<{ id: InitiatingFrequencyUnit; label: string }> = [
  { id: "PER_YEAR", label: "Per year" },
  { id: "PER_HOUR", label: "Per hour" },
];

const ANNUALIZATION_BASES: Array<{ id: AnnualizationBasis; label: string }> = [
  { id: "PLANT_YEAR", label: "Plant year" },
  { id: "CALENDAR_YEAR", label: "Calendar year" },
  { id: "REACTOR_YEAR", label: "Reactor year" },
  { id: "CRITICAL_YEAR", label: "Critical year" },
];

const NO_FREQUENCY_OPTIONS: readonly ParameterOption[] = [];

const NO_FREQUENCY_PARAMETERS: FrequencyParameterTable = new Map();

function newFrequencyExpression(): UncertainExpression {
  return { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: Number.NaN } } };
}

type ContextMenu =
  | { kind: "functional-event"; id: string; x: number; y: number }
  | { kind: "sequence"; id: string; x: number; y: number }
  | { kind: "branch"; branch: EventTreeBranchPoint; x: number; y: number };

function linkedOf(event: FunctionalEvent): boolean {
  return event.faultTreeTopEvent !== undefined || event.networkNode !== undefined;
}

function unlinkOperation(event: FunctionalEvent): EventTreeOperation {
  return event.networkNode === undefined
    ? { kind: "SET_FAULT_TREE_REFERENCE", functionalEventId: event.uuid, reference: undefined }
    : { kind: "SET_NETWORK_NODE", functionalEventId: event.uuid, link: undefined };
}

function EventTreeEditor(props: EventTreeEditorProps): JSX.Element {
  const {
    model,
    eventSequences,
    availableInitiatingEvents,
    availableOperatingStates,
    availableTransfers,
    editFrequency = true,
    frequencyOptions = NO_FREQUENCY_OPTIONS,
    frequencyParameters = NO_FREQUENCY_PARAMETERS,
    sequenceFamilyOptions = [],
    releaseCategoryOptions = [],
    representation,
    capabilities,
    selection,
    validation,
    saveState = "saved",
    analysisResult = null,
    sequenceValues,
    resultIsStale = false,
    running = false,
    runError = null,
    onOperation,
    onRepresentationChange,
    onSelectionChange,
    onSelectLink,
    faultTreeName,
    networkNodeName,
    onUpdateEventSequence,
    onClassifySequence,
    sequenceFamilySource,
    releaseCategorySource,
    endStateOptions,
    onAddEndState,
    onEditEndState,
    onOpenReference,
    breadcrumb,
    onRun,
  } = props;
  const [hoveredSequenceId, setHoveredSequenceId] = useState<string | null>(null);
  const [past, setPast] = useState<typeof model[]>([]);
  const [future, setFuture] = useState<typeof model[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<EventTreeBranchPoint | null>(null);
  const [applicabilityEventId, setApplicabilityEventId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [exportingImage, setExportingImage] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const events = useMemo(() => orderedFunctionalEvents(model), [model]);
  const presentation = useMemo(() => {
    const created = createEventTreePresentation(model, eventSequences, analysisResult);
    const valued = sequenceValues === undefined ? created : {
      ...created,
      sequences: created.sequences.map((sequence) => {
        const value = sequenceValues.get(sequence.id);
        return value === undefined ? sequence : { ...sequence, conditionalProbability: value.conditionalProbability, annualFrequency: value.annualFrequency };
      }),
    };
    if (endStateOptions === undefined) return valued;
    const codes = new Map(endStateOptions.map((option) => [option.id, option.code]));
    return { ...valued, sequences: valued.sequences.map((sequence) => ({ ...sequence, endStateLabel: (sequence.endStateId === undefined ? undefined : codes.get(sequence.endStateId)) ?? "Not assigned" })) };
  }, [analysisResult, endStateOptions, eventSequences, model, sequenceValues]);
  const selectedEvent = events.find((event) => event.uuid === selection);
  const selectedSequence = presentation.sequences.find((sequence) => sequence.id === selection);
  const errors = validation.filter((finding) => finding.severity === "ERROR");
  const activeSequenceId = hoveredSequenceId ?? selectedSequence?.id ?? null;
  const selectedModelSequence = selectedSequence === undefined ? undefined : model.sequences[selectedSequence.id];
  const selectedLinkedSequence = selectedModelSequence?.eventSequenceId === undefined
    ? undefined
    : eventSequences.find((sequence) => sequence.uuid === selectedModelSequence.eventSequenceId);

  useEffect(() => {
    setPast([]);
    setFuture([]);
    onSelectionChange(null);
  }, [model.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selection !== null) setSelectedBranch(null);
  }, [selection]);

  useEffect(() => {
    if (contextMenu === null) return;
    const close = (): void => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const commit = (operation: EventTreeOperation): void => {
    if (!capabilities.author) return;
    const problem = eventTreeMoveProblem(model, operation);
    if (problem !== undefined) {
      setOperationError(problem);
      return;
    }
    const next = applyEventTreeOperation(model, operation);
    if (next === model) return;
    setOperationError(null);
    setPast((current) => [...current.slice(-49), model]);
    setFuture([]);
    onOperation(operation);
  };

  const undo = (): void => {
    const previous = past[past.length - 1];
    if (previous === undefined) return;
    setPast((current) => current.slice(0, -1));
    setFuture((current) => [model, ...current].slice(0, 50));
    onOperation({ kind: "REPLACE", model: previous });
  };

  const redo = (): void => {
    const next = future[0];
    if (next === undefined) return;
    setFuture((current) => current.slice(1));
    setPast((current) => [...current.slice(-49), model]);
    onOperation({ kind: "REPLACE", model: next });
  };

  const addFunctionalEvent = (index = events.length): void => {
    const code = uniqueFunctionalEventCode(model);
    const id = crypto.randomUUID();
    const event: FunctionalEvent = {
      uuid: id,
      name: "New functional event",
      label: code,
      order: index,
    };
    commit({ kind: "ADD_FUNCTIONAL_EVENT", functionalEvent: event, index });
    onSelectionChange(id);
  };

  const deleteFunctionalEvent = (functionalEvent: FunctionalEvent): void => {
    const preview = applyEventTreeOperation(model, { kind: "DELETE_FUNCTIONAL_EVENT", functionalEventId: functionalEvent.uuid });
    const removedSequenceIds = Object.keys(model.sequences).filter((id) => preview.sequences[id] === undefined);
    const classifications = removedSequenceIds.filter((id) => model.sequences[id]?.eventSequenceId !== undefined).length;
    const transfers = removedSequenceIds.filter((id) => model.transfers?.[id] !== undefined).length;
    const resultIds = new Set((analysisResult?.sequences ?? []).map((result) => result.sequenceId));
    const results = removedSequenceIds.filter((id) => resultIds.has(id)).length;
    const message = [
      `${String(removedSequenceIds.length)} sequence path${removedSequenceIds.length === 1 ? "" : "s"} will be consolidated.`,
      `${String(classifications)} linked classification${classifications === 1 ? "" : "s"}, ${String(transfers)} transfer${transfers === 1 ? "" : "s"}, and ${String(results)} stored result${results === 1 ? "" : "s"} are affected.`,
      "Unaffected path identifiers and results will be preserved.",
    ].join("\n\n");
    requestConfirmation({
      title: `Delete ${functionalEvent.label ?? functionalEvent.name}?`,
      message,
      confirmLabel: "Delete functional event",
      tone: "danger",
    }, () => {
      commit({ kind: "DELETE_FUNCTIONAL_EVENT", functionalEventId: functionalEvent.uuid });
      onSelectionChange(null);
    });
  };

  const changeBypass = (sequenceId: string, functionalEvent: FunctionalEvent, bypassed: boolean): void => {
    const operation: EventTreeOperation = {
      kind: "SET_FUNCTIONAL_EVENT_BYPASS",
      sequenceId,
      functionalEventId: functionalEvent.uuid,
      bypassed,
    };
    const preview = applyEventTreeOperation(model, operation);
    if (preview === model) return;
    const beforeIds = new Set(Object.keys(model.sequences));
    const afterIds = new Set(Object.keys(preview.sequences));
    const removedIds = [...beforeIds].filter((id) => !afterIds.has(id));
    const added = [...afterIds].filter((id) => !beforeIds.has(id)).length;
    const linked = removedIds.filter((id) => model.sequences[id]?.eventSequenceId !== undefined).length;
    const transfers = removedIds.filter((id) => model.transfers?.[id] !== undefined).length;
    const verb = bypassed ? "Bypass" : "Restore success/failure branching for";
    const impact = bypassed
      ? `${String(removedIds.length)} opposite-outcome path${removedIds.length === 1 ? "" : "s"} will be consolidated; ${String(linked)} linked classification${linked === 1 ? "" : "s"} and ${String(transfers)} transfer${transfers === 1 ? "" : "s"} are affected.`
      : `${String(added)} path${added === 1 ? "" : "s"} will be created to restore both outcomes.`;
    requestConfirmation({
      title: `${verb} ${functionalEvent.label ?? functionalEvent.name} on this route?`,
      message: impact,
      confirmLabel: bypassed ? "Bypass event" : "Restore branching",
    }, () => commit(operation));
  };

  const openFunctionalEventContext = (id: string, x: number, y: number): void => {
    onSelectionChange(null);
    setContextMenu({ kind: "functional-event", id, x: Math.max(8, Math.min(x, window.innerWidth - 250)), y: Math.max(8, Math.min(y, window.innerHeight - 420)) });
  };

  const openSequenceContext = (id: string, x: number, y: number): void => {
    onSelectionChange(null);
    setContextMenu({ kind: "sequence", id, x: Math.max(8, Math.min(x, window.innerWidth - 250)), y: Math.max(8, Math.min(y, window.innerHeight - 250)) });
  };

  const selectSequence = (sequenceId: string): void => {
    setContextMenu(null);
    onSelectionChange(sequenceId);
  };

  const selectFunctionalEvent = (functionalEventId: string): void => {
    setContextMenu(null);
    onSelectionChange(functionalEventId);
  };

  const exportImage = async (): Promise<void> => {
    const diagram = diagramRef.current?.querySelector<HTMLElement>(".et-editor__diagram-content > *");
    if (diagram === undefined || diagram === null) return;
    setExportingImage(true);
    setFileError(null);
    try {
      const png = await renderFaultTreePng(diagram, 24);
      const fileName = `${model.label ?? model.name}.png`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(png.blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "The PNG export failed.");
    } finally {
      setExportingImage(false);
    }
  };

  const branchName = (outcome: EventTreeOutcome): string => {
    const label = pathState(outcome).label.toLowerCase();
    return outcome === "SUCCESS" || outcome === "FAILURE" ? `${label} branch` : label;
  };

  const removeBranch = (functionalEvent: FunctionalEvent, sequenceId: string, label: string): void => {
    const operation: EventTreeOperation = { kind: "REMOVE_BRANCH", sequenceId, functionalEventId: functionalEvent.uuid };
    const preview = applyEventTreeOperation(model, operation);
    if (preview === model) return;
    const removed = Object.keys(model.sequences).filter((id) => preview.sequences[id] === undefined).length;
    requestConfirmation({
      title: `Remove the ${label} of ${functionalEvent.label ?? functionalEvent.name}?`,
      message: `${String(removed)} sequence${removed === 1 ? "" : "s"} on this branch will be deleted.`,
      confirmLabel: "Remove branch",
      tone: "danger",
    }, () => commit(operation));
  };

  const endStateBranch = (path: Readonly<Record<string, EventTreeOutcome>>): FunctionalEvent | undefined =>
    [...events].reverse().find((event) => (path[event.uuid] ?? "BYPASSED") !== "BYPASSED");

  const deleteEndState = (sequenceId: string, path: Readonly<Record<string, EventTreeOutcome>>): void => {
    const functionalEvent = endStateBranch(path);
    if (functionalEvent === undefined) return;
    const operation: EventTreeOperation = { kind: "REMOVE_BRANCH", sequenceId, functionalEventId: functionalEvent.uuid };
    if (applyEventTreeOperation(model, operation) === model) return;
    requestConfirmation({
      title: "Delete this end state?",
      message: `This removes the ${branchName(path[functionalEvent.uuid] ?? "BYPASSED")} of ${functionalEvent.label ?? functionalEvent.name} that leads to it.`,
      confirmLabel: "Delete end state",
      tone: "danger",
    }, () => commit(operation));
  };

  const branchActions = (branch: EventTreeBranchPoint, done: () => void, className: string): JSX.Element | null => {
    const functionalEvent = events[branch.fe];
    const anchor = branch.outcomes.find((outcome) => outcome.sequence !== undefined)?.sequence;
    if (functionalEvent === undefined || anchor === undefined) return null;
    const removable = branch.outcomes.length > 1;
    const full = branch.outcomes.length >= 2;
    return (
      <>
        <button type="button" className={className} disabled={full} onClick={() => { done(); commit({ kind: "ADD_BRANCH", sequenceId: anchor, functionalEventId: functionalEvent.uuid, position: "TOP" }); }}>Add upper branch</button>
        <button type="button" className={className} disabled={full} onClick={() => { done(); commit({ kind: "ADD_BRANCH", sequenceId: anchor, functionalEventId: functionalEvent.uuid, position: "BOTTOM" }); }}>Add lower branch</button>
        {removable && branch.outcomes.map((outcome) => {
          const label = branchName(outcome.state);
          return <button key={outcome.state} type="button" className={className} disabled={outcome.sequence === undefined} onClick={() => { done(); if (outcome.sequence !== undefined) removeBranch(functionalEvent, outcome.sequence, label); }}>Remove {label}</button>;
        })}
      </>
    );
  };

  const renderRail = (): JSX.Element => {
    const order = selectedEvent === undefined ? -1 : events.findIndex((event) => event.uuid === selectedEvent.uuid);
    const transfer = availableTransfers.find((candidate) => candidate.sequenceIds.length > 0);
    return (
      <aside className="et-editor__rail" aria-label="Event-tree node actions" onMouseDown={(event) => event.stopPropagation()}>
        {selectedBranch !== null && selectedEvent === undefined && selectedSequence === undefined ? (
          <>
            <div className="et-editor__rail-title">{events[selectedBranch.fe]?.label ?? events[selectedBranch.fe]?.name ?? "Branch point"}</div>
            {branchActions(selectedBranch, () => setSelectedBranch(null), "et-editor__rail-item")}
          </>
        ) : selectedEvent !== undefined ? (
          <>
            <div className="et-editor__rail-title">{selectedEvent.label ?? selectedEvent.name}</div>
            <button type="button" className="et-editor__rail-item" disabled={events.length >= 10} onClick={() => addFunctionalEvent(order)}>Insert event before</button>
            <button type="button" className="et-editor__rail-item" disabled={events.length >= 10} onClick={() => addFunctionalEvent(order + 1)}>Insert event after</button>
            <button type="button" className="et-editor__rail-item" disabled={order <= 0} onClick={() => commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid, direction: -1 })}>Move earlier</button>
            <button type="button" className="et-editor__rail-item" disabled={order < 0 || order >= events.length - 1} onClick={() => commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid, direction: 1 })}>Move later</button>
            <div className="et-editor__rail-separator" />
            {onSelectLink !== undefined && <button type="button" className="et-editor__rail-item" onClick={() => onSelectLink(selectedEvent)}>{linkedOf(selectedEvent) ? "Change link" : "Link"}</button>}
            <button type="button" className="et-editor__rail-item" disabled={!linkedOf(selectedEvent)} onClick={() => commit(unlinkOperation(selectedEvent))}>Remove link</button>
            <div className="et-editor__rail-separator" />
            <button type="button" className="et-editor__rail-item et-editor__rail-item--danger" onClick={() => deleteFunctionalEvent(selectedEvent)}>Delete functional event</button>
          </>
        ) : selectedSequence !== undefined ? (
          <>
            <div className="et-editor__rail-title">End state</div>
            {endStateOptions === undefined && <button type="button" className="et-editor__rail-item" disabled={selectedSequence.transferTargetId === undefined && selectedSequence.endState === "SUCCESSFUL_MITIGATION"} onClick={() => commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: selectedSequence.id, endState: "SUCCESSFUL_MITIGATION" })}>Mark safe stable state</button>}
            {endStateOptions === undefined && <button type="button" className="et-editor__rail-item" disabled={selectedSequence.transferTargetId === undefined && selectedSequence.endState === "RADIONUCLIDE_RELEASE"} onClick={() => commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: selectedSequence.id, endState: "RADIONUCLIDE_RELEASE" })}>Mark radionuclide release</button>}
            {endStateOptions !== undefined && onAddEndState !== undefined && <button type="button" className="et-editor__rail-item" onClick={() => onAddEndState(selectedSequence.id)}>New end state</button>}
            <button type="button" className="et-editor__rail-item" disabled={transfer === undefined || selectedSequence.transferTargetId !== undefined} onClick={() => { if (transfer !== undefined) commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: transfer.id }); }}>Transfer to another tree</button>
            <div className="et-editor__rail-separator" />
            <div className="et-editor__rail-title">Applicability</div>
            {(() => {
              const functionalEvent = events.find((event) => event.uuid === applicabilityEventId) ?? events[0];
              if (functionalEvent === undefined) return null;
              const bypassed = (selectedSequence.path[functionalEvent.uuid] ?? "BYPASSED") === "BYPASSED";
              return (
                <>
                  <select className="et-editor__rail-select" aria-label="Functional event" value={functionalEvent.uuid} onChange={(event) => setApplicabilityEventId(event.target.value)}>
                    {events.map((event) => <option key={event.uuid} value={event.uuid}>{event.label ?? event.name}</option>)}
                  </select>
                  <button type="button" className="et-editor__rail-item" onClick={() => changeBypass(selectedSequence.id, functionalEvent, !bypassed)}>{bypassed ? "Restore success and failure" : "Bypass on this path"}</button>
                </>
              );
            })()}
            <div className="et-editor__rail-separator" />
            <button type="button" className="et-editor__rail-item et-editor__rail-item--danger" disabled={endStateBranch(selectedSequence.path) === undefined} onClick={() => deleteEndState(selectedSequence.id, selectedSequence.path)}>Delete end state</button>
          </>
        ) : (
          <>
            <div className="et-editor__rail-title">Node actions</div>
            <button type="button" className="et-editor__rail-item" disabled={events.length >= 10} onClick={() => addFunctionalEvent()}>Add functional event</button>
          </>
        )}
      </aside>
    );
  };

  const frequency = model.initiatingEventFrequency;
  const frequencyUnit = frequency === undefined ? "PER_YEAR" : initiatingFrequencyUnit(frequency.expression, frequencyParameters);
  const annualization = frequency?.annualization ?? DEFAULT_ANNUALIZATION_CONVENTION;
  const setFrequency = (changes: Partial<EventTreeInitiatingEventFrequency>): void => {
    const expression = changes.expression ?? frequency?.expression;
    if (expression === undefined) return;
    commit({ kind: "UPDATE_TREE", changes: { initiatingEventFrequency: { expression, annualization: changes.annualization ?? annualization } } });
  };

  const showFrequency = analysisResult !== null || sequenceValues !== undefined;
  const resultByEndState = new Map((analysisResult?.endStateAggregates ?? []).map((aggregate) => [aggregate.endStateId, aggregate.annualFrequency]));
  const endStateLabel = (endStateId: string): string => {
    if (endStateId === model.endStateIds?.SUCCESSFUL_MITIGATION) return "Safe state";
    if (endStateId === model.endStateIds?.RADIONUCLIDE_RELEASE) return "Release";
    return endStateId;
  };

  return (
    <section className="et-editor" aria-label={`Event tree ${model.name}`} data-testid="event-tree-editor">
      {capabilities.quantification && onRun !== undefined && (
        <header className="et-editor__header">
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || errors.length > 0 || saveState === "saving"} onClick={onRun}>{running ? "Running…" : "Run"}</button>
        </header>
      )}
      {runError !== null && <div className="et-editor__error" role="alert">{runError}</div>}
      {analysisResult !== null && (
        <div className={`et-editor__results${resultIsStale ? " et-editor__results--stale" : ""}`}>
          <strong>{resultIsStale ? "Previous result" : "Latest result"}</strong>
          <span>{analysisResult.sequences.length} quantified sequences</span>
          <ResultCsvButton filename={`et-${analysisResult.runId}.csv`} records={() => eventTreeResultRecords(analysisResult, eventTreeResultName(model, availableTransfers)).map((row) => ({ ...row, stale: resultIsStale }))} />
          {analysisResult.endStateAggregates.map((aggregate) => <span key={aggregate.endStateId}>{endStateLabel(aggregate.endStateId)}: <span className="posmono">{formatExponential(resultByEndState.get(aggregate.endStateId))}/yr</span></span>)}
        </div>
      )}

      {analysisResult !== null && <ResultWarnings issues={analysisResult.validationIssues} />}

      <div className="et-editor__setup">
        <label className="posfield et-editor__wide">
          <span className="posfield__label">Name</span>
          <input
            key={`${model.uuid}-${model.name}`}
            className="posfield__input"
            aria-label="Event tree name"
            defaultValue={model.name}
            disabled={!capabilities.author}
            onBlur={(event) => {
              const name = event.currentTarget.value.trim();
              if (name.length > 0 && name !== model.name) commit({ kind: "UPDATE_TREE", changes: { name } });
            }}
          />
        </label>
        <label className="posfield">
          <span className="posfield__label">Initiating event</span>
          <select className="posfield__select" aria-label="Initiating event" value={model.initiatingEventId} disabled={!capabilities.author} onChange={(event) => {
            const selected = availableInitiatingEvents.find((option) => option.id === event.target.value);
            commit({ kind: "UPDATE_TREE", changes: {
              initiatingEventId: event.target.value,
              ...(frequency === undefined && selected?.frequency !== undefined ? { initiatingEventFrequency: selected.frequency } : {}),
            } });
          }}>
            {!availableInitiatingEvents.some((option) => option.id === model.initiatingEventId) && <option value={model.initiatingEventId}>{model.initiatingEventId}</option>}
            {availableInitiatingEvents.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}
          </select>
        </label>
        {availableOperatingStates !== undefined && (
          <label className="posfield">
            <span className="posfield__label">Operating state</span>
            <select className="posfield__select" aria-label="Operating state" value={model.plantOperatingStateId ?? ""} disabled={!capabilities.author} onChange={(event) => {
              if (event.target.value.length > 0) commit({ kind: "UPDATE_TREE", changes: { plantOperatingStateId: event.target.value } });
            }}>
              {(model.plantOperatingStateId === undefined || model.plantOperatingStateId.length === 0) && <option value="">None</option>}
              {model.plantOperatingStateId !== undefined && model.plantOperatingStateId.length > 0 && !availableOperatingStates.some((option) => option.id === model.plantOperatingStateId) && <option value={model.plantOperatingStateId}>{model.plantOperatingStateId}</option>}
              {availableOperatingStates.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}
            </select>
          </label>
        )}
        {editFrequency && <>
        <div className="posfield et-editor__wide et-editor__frequency" role="group" aria-label="Initiating event frequency">
          <span className="posfield__label">Initiating event frequency</span>
          <ExpressionEditor expression={frequency?.expression ?? newFrequencyExpression()} unit={frequencyUnit} options={frequencyOptions} disabled={!capabilities.author} onChange={(expression) => setFrequency({ expression })} />
        </div>
        <label className="posfield">
          <span className="posfield__label">Frequency unit</span>
          <select className="posfield__select" aria-label="Initiating event frequency unit" value={frequencyUnit} disabled={!capabilities.author || frequency?.expression.node !== "VALUE"} onChange={(event) => {
            const unit = FREQUENCY_UNITS.find((option) => option.id === event.target.value)?.id;
            if (frequency?.expression.node !== "VALUE" || unit === undefined) return;
            setFrequency({ expression: { node: "VALUE", value: { unit, law: frequency.expression.value.law } } });
          }}>
            {FREQUENCY_UNITS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="posfield">
          <span className="posfield__label">Annualization basis</span>
          <select className="posfield__select" aria-label="Annualization basis" value={annualization.basis} disabled={!capabilities.author || frequency === undefined} onChange={(event) => {
            const basis = ANNUALIZATION_BASES.find((option) => option.id === event.target.value)?.id;
            if (basis !== undefined) setFrequency({ annualization: { ...annualization, basis } });
          }}>
            {ANNUALIZATION_BASES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="posfield">
          <span className="posfield__label">Exposure hours per year</span>
          <input key={`${model.uuid}-annual-hours-${String(annualization.hoursPerYear)}`} className="posfield__input" aria-label="Exposure hours per year" type="number" min="0" step="any" disabled={!capabilities.author || frequency === undefined} defaultValue={annualization.hoursPerYear} onBlur={(event) => {
            const hoursPerYear = Number(event.currentTarget.value);
            if (!Number.isFinite(hoursPerYear) || hoursPerYear <= 0) return;
            if (hoursPerYear !== annualization.hoursPerYear) setFrequency({ annualization: { ...annualization, hoursPerYear } });
          }} />
        </label>
        </>}
      </div>

      <div className={`et-editor__workspace${selectedEvent !== undefined || selectedSequence !== undefined ? " et-editor__workspace--inspecting" : ""}`}>
        <div className="et-editor__main">
          {events.length === 0 ? (
            <div className="et-editor__empty">
              <span>This event tree has no functional event yet.</span>
              {capabilities.author && (
                <button
                  type="button"
                  className="posnav__btn posnav__btn--sm posnav__btn--primary"
                  onClick={() => addFunctionalEvent()}
                >
                  Add functional event
                </button>
              )}
            </div>
          ) : (
            <div className="estree" ref={diagramRef} onMouseDown={(event) => {
              if (event.button !== 0) return;
              const target = event.target;
              if (target instanceof Element && target.closest("button, input, select, textarea") === null) {
                setContextMenu(null);
                setSelectedBranch(null);
                onSelectionChange(null);
              }
            }}>
              <div className="estree__bar">
                <div className="estree__commands" aria-label="Event-tree document commands">
                  {capabilities.author && (
                    <>
                      <button type="button" className="et-editor__icon-btn" disabled={past.length === 0} onClick={undo} aria-label="Undo" title="Undo"><EventTreeIcon name="undo" /></button>
                      <button type="button" className="et-editor__icon-btn" disabled={future.length === 0} onClick={redo} aria-label="Redo" title="Redo"><EventTreeIcon name="redo" /></button>
                    </>
                  )}
                  <details className="et-editor__menu">
                    <summary className="et-editor__icon-btn" role="button" aria-label="File" title="File" aria-haspopup="menu"><EventTreeIcon name="file" /></summary>
                    <div className="et-editor__menu-popover" role="menu">
                      <button type="button" className="et-editor__menu-item" disabled={representation === "table" || exportingImage} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void exportImage(); }}>Export high-resolution PNG</button>
                    </div>
                  </details>
                </div>
                <div className="estree__selector">
                  {REPRESENTATIONS.map((item) => <button key={item.id} type="button" className={`estree__selector-opt${item.id === representation ? " estree__selector-opt--active" : ""}`} onClick={() => onRepresentationChange(item.id)}>{item.label}</button>)}
                </div>
                {breadcrumb !== undefined && (
                  <nav className="et-editor__breadcrumb" aria-label="Transfer path">
                    <ol className="et-editor__crumbs">
                      {breadcrumb.steps.map((label, at) => (
                        <li key={at} className="et-editor__crumb-item">
                          {at === breadcrumb.current
                            ? <span className="et-editor__crumb et-editor__crumb--current" aria-current="page" title={label}>{label}</span>
                            : <button type="button" className="et-editor__crumb" title={label} onClick={() => breadcrumb.onSelect(at)}>{label}</button>}
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}
              </div>
              {fileError !== null && <div className="et-editor__error" role="alert">{fileError}</div>}
              {operationError !== null && <div className="et-editor__error" role="alert">{operationError}</div>}
              <div className="estree__body">
                {capabilities.author && renderRail()}
                <div className="estree__view">
                  {representation === "event-tree" && <ClassicEventTreeDiagram view={presentation} activeSequenceId={activeSequenceId} selectedEntityId={selection} showFrequency={showFrequency} frequencyParameters={frequencyParameters} canEdit={capabilities.author} onHover={setHoveredSequenceId} onSelect={selectSequence} onSelectFunctionalEvent={selectFunctionalEvent} onFunctionalEventContext={openFunctionalEventContext} onSequenceContext={openSequenceContext} onReorderFunctionalEvent={(functionalEventId, targetIndex) => commit({ kind: "REORDER_FUNCTIONAL_EVENT", functionalEventId, targetIndex })} selectedBranchKey={selectedBranch?.key ?? null} onSelectBranch={(branch) => { setContextMenu(null); onSelectionChange(null); setSelectedBranch(branch); }} onBranchContext={(branch, x, y) => { onSelectionChange(null); setSelectedBranch(branch); setContextMenu({ kind: "branch", branch, x: Math.max(8, Math.min(x, window.innerWidth - 250)), y: Math.max(8, Math.min(y, window.innerHeight - 200)) }); }} />}
                  {representation === "event-sequence-diagram" && <EventSequenceDiagram view={presentation} activeSequenceId={activeSequenceId} selectedEntityId={selection} onHover={setHoveredSequenceId} onSelectSequence={selectSequence} onSelectFunctionalEvent={selectFunctionalEvent} onFunctionalEventContext={openFunctionalEventContext} onSequenceContext={openSequenceContext} />}
                  {representation === "table" && (
                    <PagedResults items={presentation.sequences} label="Event-tree sequences" resetKey={`${model.uuid}:${analysisResult?.runId ?? "unquantified"}`} >{(page) => <div className="et-editor__table-wrap"><table className="postable et-editor__table"><thead><tr><th>Sequence</th><th>Path</th><th>Result</th><th>Probability</th><th>Frequency</th></tr></thead><tbody>{page.map((sequence) => <tr key={sequence.id} className={selection === sequence.id ? "et-editor__table-row--selected" : ""} onMouseEnter={() => setHoveredSequenceId(sequence.id)} onMouseLeave={() => setHoveredSequenceId(null)} onClick={() => selectSequence(sequence.id)} onContextMenu={(contextEvent) => { contextEvent.preventDefault(); contextEvent.stopPropagation(); openSequenceContext(sequence.id, contextEvent.clientX, contextEvent.clientY); }}><td className="posmono">{sequence.name}</td><td><div className="et-editor__path">{events.map((event) => { const state = pathState(sequence.path[event.uuid]); return <span key={event.uuid} className={`et-editor__path-step et-editor__path-step--${state.className}`}>{event.label ?? event.name} {state.short}</span>; })}</div></td><td>{sequence.transferTargetId === undefined ? (sequence.endState === "SUCCESSFUL_MITIGATION" ? "Safe state" : "Release") : `Transfer to ${sequence.transferTargetId}`}</td><td className="posmono">{formatExponential(sequence.conditionalProbability)}</td><td className="posmono">{formatExponential(sequence.annualFrequency)}</td></tr>)}</tbody></table></div>}</PagedResults>
                  )}
                </div>
              </div>
            </div>
          )}
          <EventTreeTransferResults model={model} availableTransfers={availableTransfers} analysisResult={analysisResult} />
        </div>

        {(selectedEvent !== undefined || selectedSequence !== undefined) && (
          <aside className="et-editor__inspector" aria-label="Event-tree selection inspector">
            <button type="button" className="et-editor__inspector-close" onClick={() => onSelectionChange(null)} aria-label="Close inspector">×</button>
            {selectedEvent !== undefined && (
              <>
                <span className="et-editor__eyebrow">Functional event · {selectedEvent.label ?? selectedEvent.uuid}</span>
                <label className="et-editor__field"><span>Name</span><input key={`${selectedEvent.uuid}-${selectedEvent.name}`} defaultValue={selectedEvent.name} disabled={!capabilities.author} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name.length > 0 && name !== selectedEvent.name) commit({ kind: "UPDATE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid, changes: { name } }); }} /></label>
                <label className="et-editor__field"><span>Code</span><input key={`${selectedEvent.uuid}-${selectedEvent.label ?? ""}`} defaultValue={selectedEvent.label ?? ""} disabled={!capabilities.author} onBlur={(event) => { const label = event.currentTarget.value.trim(); if (label.length > 0 && label !== selectedEvent.label) commit({ kind: "UPDATE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid, changes: { label } }); }} /></label>
                <label className="et-editor__field"><span>Description</span><textarea key={`${selectedEvent.uuid}-${selectedEvent.description ?? ""}`} defaultValue={selectedEvent.description ?? ""} disabled={!capabilities.author} rows={3} onBlur={(event) => { if (event.currentTarget.value !== (selectedEvent.description ?? "")) commit({ kind: "UPDATE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid, changes: { description: event.currentTarget.value } }); }} /></label>
                <div className="et-editor__reference">
                  <span>{selectedEvent.networkNode === undefined ? "Fault-tree top event" : "Network node"}</span>
                  {selectedEvent.faultTreeTopEvent !== undefined && (() => {
                    const reference = selectedEvent.faultTreeTopEvent;
                    return <button type="button" onClick={() => { if (capabilities.author && onSelectLink !== undefined) onSelectLink(selectedEvent); else onOpenReference?.(reference); }}>{faultTreeName?.(reference) ?? "Linked fault tree"}</button>;
                  })()}
                  {selectedEvent.networkNode !== undefined && (() => {
                    const link = selectedEvent.networkNode;
                    return <button type="button" disabled={!capabilities.author || onSelectLink === undefined} onClick={() => onSelectLink?.(selectedEvent)}>{networkNodeName?.(link) ?? "Linked network node"}</button>;
                  })()}
                  {capabilities.author && (onSelectLink !== undefined || linkedOf(selectedEvent)) && (
                    <div className="et-editor__reference-actions">
                      {onSelectLink !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onSelectLink(selectedEvent)}>{linkedOf(selectedEvent) ? "Change link" : "Link"}</button>}
                      {linkedOf(selectedEvent) && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => commit(unlinkOperation(selectedEvent))}>Remove link</button>}
                    </div>
                  )}
                </div>
              </>
            )}
            {selectedSequence !== undefined && (
              <>
                <span className="et-editor__eyebrow">End state</span>
                {endStateOptions !== undefined ? (() => {
                  const assigned = selectedSequence.transferTargetId === undefined ? endStateOptions.find((option) => option.id === selectedSequence.endStateId) : undefined;
                  const value = selectedSequence.transferTargetId !== undefined ? "TRANSFER" : assigned?.id ?? "";
                  return (
                    <>
                      <label className="et-editor__field"><span>End state{assigned?.source !== undefined && <small className="et-editor__field-source"> ({assigned.source})</small>}</span><select disabled={!capabilities.author} value={value} onChange={(event) => {
                        if (event.target.value === "TRANSFER") {
                          const target = availableTransfers.find((candidate) => candidate.sequenceIds.length > 0);
                          if (target !== undefined) commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: target.id });
                          return;
                        }
                        const option = endStateOptions.find((candidate) => candidate.id === event.target.value);
                        if (option !== undefined) commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: selectedSequence.id, endState: option.release ? "RADIONUCLIDE_RELEASE" : "SUCCESSFUL_MITIGATION", endStateId: option.id });
                      }}>
                        {value === "" && <option value="">Not assigned</option>}
                        {endStateOptions.map((option) => <option key={option.id} value={option.id}>{option.code} · {option.name}</option>)}
                        {availableTransfers.length > 0 && <option value="TRANSFER">Transfer to another event tree</option>}
                      </select></label>
                      {capabilities.author && (onAddEndState !== undefined || (onEditEndState !== undefined && assigned !== undefined)) && (
                        <div className="et-editor__reference-actions">
                          {onAddEndState !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onAddEndState(selectedSequence.id)}>New end state</button>}
                          {onEditEndState !== undefined && assigned !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onEditEndState(assigned.id)}>Edit end state</button>}
                        </div>
                      )}
                    </>
                  );
                })() : (
                <label className="et-editor__field"><span>End state</span><select disabled={!capabilities.author} value={selectedSequence.transferTargetId === undefined ? selectedSequence.endState : "TRANSFER"} onChange={(event) => {
                  if (event.target.value === "TRANSFER") {
                    const target = availableTransfers.find((candidate) => candidate.sequenceIds.length > 0);
                    if (target !== undefined) commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: target.id });
                  } else commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: selectedSequence.id, endState: event.target.value as "SUCCESSFUL_MITIGATION" | "RADIONUCLIDE_RELEASE" });
                }}><option value="SUCCESSFUL_MITIGATION">Safe stable state</option><option value="RADIONUCLIDE_RELEASE">Radionuclide release</option>{availableTransfers.length > 0 && <option value="TRANSFER">Transfer to another event tree</option>}</select></label>
                )}
                {selectedSequence.transferTargetId !== undefined && <label className="et-editor__field"><span>Transfer target</span><select disabled={!capabilities.author} value={selectedSequence.transferTargetId} onChange={(event) => { commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: event.target.value }); }}>{availableTransfers.filter((tree) => tree.sequenceIds.length > 0).map((tree) => <option key={tree.id} value={tree.id}>{tree.id} · {tree.name}</option>)}</select></label>}
                {selectedSequence.transferTargetId !== undefined && onOpenReference !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onOpenReference({ targetEventTreeId: selectedSequence.transferTargetId! })}>Open transfer target</button>}
                {(() => {
                  const classify = (changes: Partial<Pick<EventSequence, "sequenceFamilyId" | "releaseCategoryId">>): void => {
                    if (onClassifySequence !== undefined) onClassifySequence(selectedSequence.id, changes);
                    else if (selectedLinkedSequence !== undefined) onUpdateEventSequence?.(selectedLinkedSequence.uuid, changes);
                  };
                  if (onClassifySequence === undefined && (selectedLinkedSequence === undefined || onUpdateEventSequence === undefined)) return null;
                  const releasing = selectedSequence.transferTargetId === undefined && selectedSequence.endState === "RADIONUCLIDE_RELEASE";
                  return (
                    <>
                      <label className="et-editor__field"><span>Sequence family{sequenceFamilySource !== undefined && <small className="et-editor__field-source"> ({sequenceFamilySource})</small>}</span><select disabled={!capabilities.author} value={selectedLinkedSequence?.sequenceFamilyId ?? ""} onChange={(event) => classify({ sequenceFamilyId: event.target.value || undefined })}><option value="">None</option>{sequenceFamilyOptions.map((option) => <option key={option.id} value={option.id}>{option.id} · {option.name}</option>)}</select></label>
                      {endStateOptions === undefined && <label className="et-editor__field"><span>Release category{releaseCategorySource !== undefined && <small className="et-editor__field-source"> ({releaseCategorySource})</small>}</span><select disabled={!capabilities.author || !releasing} value={selectedLinkedSequence?.releaseCategoryId ?? ""} onChange={(event) => classify({ releaseCategoryId: event.target.value || undefined })}><option value="">None</option>{releaseCategoryOptions.map((option) => <option key={option.id} value={option.id}>{option.name.length > 0 && option.name !== option.id ? `${option.id} · ${option.name}` : option.id}</option>)}</select></label>}
                    </>
                  );
                })()}
                {selectedSequence.conditionalProbability !== undefined && <div className="et-editor__sequence-result"><span>Conditional probability</span><strong className="posmono">{formatExponential(selectedSequence.conditionalProbability)}</strong><span>Annual frequency</span><strong className="posmono">{formatExponential(selectedSequence.annualFrequency)}</strong></div>}
              </>
            )}
          </aside>
        )}
      </div>
      {validation.length > 0 && (
        <section className="et-editor__validation" aria-label="Event tree validation">
          <h3>Validation · {validation.length} issue{validation.length === 1 ? "" : "s"}</h3>
          <ul className="et-editor__issues">
            {validation.map((finding, index) => (
              <li key={`${finding.code}-${finding.entityId ?? "tree"}-${String(index)}`}>
                <button type="button" className="et-editor__issue" onClick={() => { if (finding.entityId !== undefined) onSelectionChange(finding.entityId); }}>
                  <strong className={`et-editor__issue-severity et-editor__issue-severity--${finding.severity.toLowerCase()}`}>{finding.severity}</strong>{finding.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {contextMenu !== null && (
        <div className="et-editor__context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          {contextMenu.kind === "functional-event" && (() => {
            const functionalEvent = model.functionalEvents[contextMenu.id];
            if (functionalEvent === undefined) return null;
            const order = events.findIndex((event) => event.uuid === functionalEvent.uuid);
            return <>
              <div className="et-editor__context-title">{functionalEvent.label ?? functionalEvent.name}</div>
              <button type="button" role="menuitem" onClick={() => { onSelectionChange(functionalEvent.uuid); setContextMenu(null); }}>Open details</button>
              {!capabilities.author && functionalEvent.faultTreeTopEvent !== undefined && <button type="button" role="menuitem" onClick={() => { onOpenReference?.(functionalEvent.faultTreeTopEvent!); setContextMenu(null); }}>Open linked fault tree</button>}
              {capabilities.author && onSelectLink !== undefined && <button type="button" role="menuitem" onClick={() => { onSelectLink(functionalEvent); setContextMenu(null); }}>{linkedOf(functionalEvent) ? "Change link" : "Link"}</button>}
              {capabilities.author && linkedOf(functionalEvent) && <button type="button" role="menuitem" onClick={() => { commit(unlinkOperation(functionalEvent)); setContextMenu(null); }}>Remove link</button>}
              {capabilities.author && <div className="et-editor__context-separator" />}
              {capabilities.author && <button type="button" role="menuitem" disabled={events.length >= 10} onClick={() => { addFunctionalEvent(order); setContextMenu(null); }}>Insert functional event before</button>}
              {capabilities.author && <button type="button" role="menuitem" disabled={events.length >= 10} onClick={() => { addFunctionalEvent(order + 1); setContextMenu(null); }}>Insert functional event after</button>}
              {capabilities.author && <button type="button" role="menuitem" disabled={order <= 0} onClick={() => { commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: functionalEvent.uuid, direction: -1 }); setContextMenu(null); }}>Move earlier</button>}
              {capabilities.author && <button type="button" role="menuitem" disabled={order < 0 || order >= events.length - 1} onClick={() => { commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: functionalEvent.uuid, direction: 1 }); setContextMenu(null); }}>Move later</button>}
              {capabilities.author && <button type="button" role="menuitem" className="et-editor__context-danger" onClick={() => { setContextMenu(null); deleteFunctionalEvent(functionalEvent); }}>Delete functional event…</button>}
            </>;
          })()}
          {contextMenu.kind === "branch" && (
            <>
              <div className="et-editor__context-title">{events[contextMenu.branch.fe]?.label ?? events[contextMenu.branch.fe]?.name ?? "Branch point"}</div>
              {branchActions(contextMenu.branch, () => setContextMenu(null), "et-editor__context-item")}
            </>
          )}
          {contextMenu.kind === "sequence" && (() => {
            const sequence = presentation.sequences.find((candidate) => candidate.id === contextMenu.id);
            if (sequence === undefined) return null;
            const transfer = availableTransfers.find((candidate) => candidate.sequenceIds.length > 0);
            return <>
              <div className="et-editor__context-title">{sequence.name}</div>
              <button type="button" role="menuitem" onClick={() => { onSelectionChange(sequence.id); setContextMenu(null); }}>Open details and pin path</button>
              {capabilities.author && <div className="et-editor__context-separator" />}
              {capabilities.author && endStateOptions === undefined && <button type="button" role="menuitem" onClick={() => { commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: sequence.id, endState: "SUCCESSFUL_MITIGATION" }); setContextMenu(null); }}>Mark safe stable state</button>}
              {capabilities.author && endStateOptions === undefined && <button type="button" role="menuitem" onClick={() => { commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: sequence.id, endState: "RADIONUCLIDE_RELEASE" }); setContextMenu(null); }}>Mark radionuclide release</button>}
              {capabilities.author && endStateOptions !== undefined && endStateOptions.map((option) => <button key={option.id} type="button" role="menuitem" onClick={() => { commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: sequence.id, endState: option.release ? "RADIONUCLIDE_RELEASE" : "SUCCESSFUL_MITIGATION", endStateId: option.id }); setContextMenu(null); }}>{option.code} · {option.name}</button>)}
              {capabilities.author && transfer !== undefined && <button type="button" role="menuitem" onClick={() => { commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: sequence.id, targetEventTreeId: transfer.id }); setContextMenu(null); }}>Transfer to another event tree</button>}
              {capabilities.author && <div className="et-editor__context-separator" />}
              {capabilities.author && <div className="et-editor__context-title">Functional-event applicability</div>}
              {capabilities.author && events.map((functionalEvent) => {
                const bypassed = (sequence.path[functionalEvent.uuid] ?? "BYPASSED") === "BYPASSED";
                return <button key={functionalEvent.uuid} type="button" role="menuitem" onClick={() => { setContextMenu(null); changeBypass(sequence.id, functionalEvent, !bypassed); }}>{bypassed ? "Restore S/F" : "Bypass"} · {functionalEvent.label ?? functionalEvent.name}</button>;
              })}
              {capabilities.author && <div className="et-editor__context-separator" />}
              {capabilities.author && <button type="button" role="menuitem" className="et-editor__context-danger" disabled={endStateBranch(sequence.path) === undefined} onClick={() => { setContextMenu(null); deleteEndState(sequence.id, sequence.path); }}>Delete end state…</button>}
            </>;
          })()}
        </div>
      )}
      {confirmationDialog}
    </section>
  );
}

export { EventTreeEditor };
