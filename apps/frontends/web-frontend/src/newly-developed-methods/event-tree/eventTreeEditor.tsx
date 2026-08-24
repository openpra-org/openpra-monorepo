import { type JSX, useEffect, useMemo, useState } from "react";
import type { FunctionalEvent, SystemStatus } from "interfaces-mef-types/es/event-sequence-analysis";
import {
  applyEventTreeOperation,
  createEventTreePresentation,
  orderedFunctionalEvents,
  uniqueFunctionalEventCode,
} from "./eventTreeOperations";
import {
  ClassicEventTreeDiagram,
  DynamicEventSequenceDiagram,
  EventSequenceDiagram,
  formatExponential,
} from "./eventTreePresentation";
import type { EventTreeEditorProps, EventTreeOperation, EventTreeRepresentation } from "./eventTreeTypes";
import "./css/eventTree.css";

const REPRESENTATIONS: Array<{ id: EventTreeRepresentation; label: string }> = [
  { id: "event-sequence-diagram", label: "Event-sequence diagram" },
  { id: "event-tree", label: "Event tree" },
  { id: "table", label: "Sequence table" },
  { id: "dynamic", label: "Dynamic" },
];

const PATH_STATE: Record<SystemStatus, { label: string; short: string; className: string }> = {
  SUCCESS: { label: "Success", short: "S", className: "success" },
  FAILURE: { label: "Failure", short: "F", className: "failure" },
  BYPASSED: { label: "Bypassed", short: "B", className: "bypassed" },
};

type ContextMenu =
  | { kind: "functional-event"; id: string; x: number; y: number }
  | { kind: "sequence"; id: string; x: number; y: number };

function EventTreeEditor(props: EventTreeEditorProps): JSX.Element {
  const {
    model,
    eventSequences,
    availableInitiatingEvents,
    availableTransfers,
    sequenceFamilyOptions = [],
    releaseCategoryOptions = [],
    dynamicRun,
    representation,
    capabilities,
    selection,
    validation,
    saveState = "saved",
    analysisResult = null,
    resultIsStale = false,
    running = false,
    runError = null,
    onOperation,
    onRepresentationChange,
    onSelectionChange,
    onSelectFaultTreeLink,
    onUpdateEventSequence,
    onOpenReference,
    onRun,
  } = props;
  const [hoveredSequenceId, setHoveredSequenceId] = useState<string | null>(null);
  const [past, setPast] = useState<typeof model[]>([]);
  const [future, setFuture] = useState<typeof model[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const events = useMemo(() => orderedFunctionalEvents(model), [model]);
  const presentation = useMemo(
    () => createEventTreePresentation(model, eventSequences, analysisResult),
    [analysisResult, eventSequences, model],
  );
  const selectedEvent = events.find((event) => event.uuid === selection);
  const selectedSequence = presentation.sequences.find((sequence) => sequence.id === selection);
  const errors = validation.filter((finding) => finding.severity === "ERROR");
  const warnings = validation.filter((finding) => finding.severity === "WARNING");
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
    const next = applyEventTreeOperation(model, operation);
    if (next === model) return;
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
      `Delete ${functionalEvent.label ?? functionalEvent.name}?`,
      `${String(removedSequenceIds.length)} sequence path${removedSequenceIds.length === 1 ? "" : "s"} will be consolidated.`,
      `${String(classifications)} linked classification${classifications === 1 ? "" : "s"}, ${String(transfers)} transfer${transfers === 1 ? "" : "s"}, and ${String(results)} stored result${results === 1 ? "" : "s"} are affected.`,
      "Unaffected path identifiers and results will be preserved.",
    ].join("\n\n");
    if (!window.confirm(message)) return;
    commit({ kind: "DELETE_FUNCTIONAL_EVENT", functionalEventId: functionalEvent.uuid });
    onSelectionChange(null);
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
    if (!window.confirm(`${verb} ${functionalEvent.label ?? functionalEvent.name} on this route?\n\n${impact}`)) return;
    commit(operation);
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

  const showFrequency = analysisResult !== null;
  const resultByEndState = new Map((analysisResult?.endStateAggregates ?? []).map((aggregate) => [aggregate.endStateId, aggregate.annualFrequency]));
  const endStateLabel = (endStateId: string): string => {
    if (endStateId === model.endStateIds?.SUCCESSFUL_MITIGATION) return "Safe state";
    if (endStateId === model.endStateIds?.RADIONUCLIDE_RELEASE) return "Release";
    return endStateId;
  };

  return (
    <section className="et-editor" aria-label={`Event tree ${model.name}`} data-testid="event-tree-editor">
      <header className="et-editor__header">
        <div className="et-editor__identity">
          <span className="et-editor__eyebrow">Event tree · {model.uuid}</span>
          {capabilities.author ? (
            <input
              key={`${model.uuid}-${model.name}`}
              aria-label="Event-tree name"
              className="et-editor__name-input"
              defaultValue={model.name}
              onBlur={(event) => {
                const name = event.currentTarget.value.trim();
                if (name.length > 0 && name !== model.name) commit({ kind: "UPDATE_TREE", changes: { name } });
              }}
            />
          ) : <h3 className="et-editor__name">{model.name}</h3>}
        </div>
        <div className="et-editor__header-actions">
          {capabilities.author && <>
            <span className={`et-editor__save et-editor__save--${saveState}`}>{saveState === "saving" ? "Saving" : saveState === "failed" ? "Save failed" : "Saved"}</span>
          </>}
          {!capabilities.author && <span className="et-editor__mode" title="Structural editing is disabled in this view">Read only</span>}
          <button type="button" className={`posnav__btn posnav__btn--sm${errors.length === 0 ? "" : " posnav__btn--danger"}`} onClick={() => setShowValidation((current) => !current)}>{errors.length === 0 ? "Valid" : `${String(errors.length)} issue${errors.length === 1 ? "" : "s"}`}</button>
          {capabilities.quantification && onRun !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || errors.length > 0 || saveState === "saving"} onClick={onRun}>{running ? "Running…" : "Run"}</button>}
        </div>
      </header>

      {showValidation && (
        <div className="et-editor__validation" role="status">
          {validation.length === 0 ? <span>No validation findings.</span> : validation.map((finding) => (
            <button
              key={`${finding.code}-${finding.entityId ?? "tree"}`}
              type="button"
              className={`et-editor__finding et-editor__finding--${finding.severity.toLowerCase()}`}
              onClick={() => onSelectionChange(finding.entityId ?? null)}
            >
              <strong className="et-editor__finding-code">{finding.code}</strong>
              <span className="et-editor__finding-message">{finding.message}</span>
            </button>
          ))}
        </div>
      )}
      {warnings.length > 0 && !showValidation && <div className="et-editor__notice">{String(warnings.length)} validation warning{warnings.length === 1 ? "" : "s"}</div>}
      {runError !== null && <div className="et-editor__error" role="alert">{runError}</div>}
      {analysisResult !== null && (
        <div className={`et-editor__results${resultIsStale ? " et-editor__results--stale" : ""}`}>
          <strong>{resultIsStale ? "Previous result" : "Latest result"}</strong>
          <span>{analysisResult.sequences.length} quantified sequences</span>
          {analysisResult.endStateAggregates.map((aggregate) => <span key={aggregate.endStateId}>{endStateLabel(aggregate.endStateId)}: <span className="posmono">{formatExponential(resultByEndState.get(aggregate.endStateId))}/yr</span></span>)}
        </div>
      )}

      <div className="et-editor__setup">
        <label className="et-editor__field">
          <span>Initiating event</span>
          <select aria-label="Initiating event" value={model.initiatingEventId} disabled={!capabilities.author} onChange={(event) => {
            const selected = availableInitiatingEvents.find((option) => option.id === event.target.value);
            commit({ kind: "UPDATE_TREE", changes: {
              initiatingEventId: event.target.value,
              ...(model.initiatingEventFrequency === undefined && selected?.frequency !== undefined ? { initiatingEventFrequency: { value: selected.frequency } } : {}),
            } });
          }}>
            {!availableInitiatingEvents.some((option) => option.id === model.initiatingEventId) && <option value={model.initiatingEventId}>{model.initiatingEventId}</option>}
            {availableInitiatingEvents.map((option) => <option key={option.id} value={option.id}>{option.id} · {option.name}</option>)}
          </select>
        </label>
        <label className="et-editor__field">
          <span>Frequency / plant-year</span>
          <input key={`${model.uuid}-frequency-${String(model.initiatingEventFrequency?.value ?? "")}`} aria-label="Initiating-event frequency" type="number" min="0" step="any" disabled={!capabilities.author} defaultValue={model.initiatingEventFrequency?.value ?? ""} onBlur={(event) => {
            const value = Number(event.currentTarget.value);
            if (event.currentTarget.value.length > 0 && Number.isFinite(value) && value >= 0 && value !== model.initiatingEventFrequency?.value) commit({ kind: "UPDATE_TREE", changes: { initiatingEventFrequency: { value } } });
          }} />
        </label>
        <label className="et-editor__field">
          <span>Safe end-state ID</span>
          <input key={`${model.uuid}-safe-${model.endStateIds?.SUCCESSFUL_MITIGATION ?? ""}`} aria-label="Safe end-state identifier" placeholder="Workbook entity UUID" disabled={!capabilities.author} defaultValue={model.endStateIds?.SUCCESSFUL_MITIGATION ?? ""} onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value.length > 0 && value !== model.endStateIds?.SUCCESSFUL_MITIGATION) commit({ kind: "UPDATE_TREE", changes: { endStateIds: { ...model.endStateIds, SUCCESSFUL_MITIGATION: value } } });
          }} />
        </label>
        <label className="et-editor__field">
          <span>Release end-state ID</span>
          <input key={`${model.uuid}-release-${model.endStateIds?.RADIONUCLIDE_RELEASE ?? ""}`} aria-label="Release end-state identifier" placeholder="Workbook entity UUID" disabled={!capabilities.author} defaultValue={model.endStateIds?.RADIONUCLIDE_RELEASE ?? ""} onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value.length > 0 && value !== model.endStateIds?.RADIONUCLIDE_RELEASE) commit({ kind: "UPDATE_TREE", changes: { endStateIds: { ...model.endStateIds, RADIONUCLIDE_RELEASE: value } } });
          }} />
        </label>
      </div>

      <div className={`et-editor__workspace${selectedEvent !== undefined || selectedSequence !== undefined ? " et-editor__workspace--inspecting" : ""}`}>
        <div className="et-editor__main">
          {events.length === 0 ? (
            <div className="et-editor__empty">Add the first functional event to generate complete success and failure paths.</div>
          ) : (
            <div className="estree" onMouseDown={(event) => {
              if (event.button !== 0) return;
              const target = event.target;
              if (target instanceof Element && target.closest("button, input, select, textarea") === null) {
                setContextMenu(null);
                onSelectionChange(null);
              }
            }}>
              <div className="estree__bar">
                <span className="estree__bar-title">{REPRESENTATIONS.find((item) => item.id === representation)?.label}</span>
                {representation === "dynamic" && <span className="et-editor__mode">Read-only run view</span>}
                <div className="estree__selector">
                  {REPRESENTATIONS.filter((item) => item.id !== "dynamic" || dynamicRun !== undefined).map((item) => <button key={item.id} type="button" className={`estree__selector-opt${item.id === representation ? " estree__selector-opt--active" : ""}`} onClick={() => onRepresentationChange(item.id)}>{item.label}</button>)}
                </div>
                {capabilities.author && (
                  <div className="estree__history" aria-label="Event-tree edit history">
                    <button type="button" className="et-editor__icon-btn" disabled={past.length === 0} onClick={undo} aria-label="Undo event-tree edit" title="Undo">↶</button>
                    <button type="button" className="et-editor__icon-btn" disabled={future.length === 0} onClick={redo} aria-label="Redo event-tree edit" title="Redo">↷</button>
                  </div>
                )}
              </div>
              {representation === "event-tree" && <ClassicEventTreeDiagram view={presentation} activeSequenceId={activeSequenceId} selectedEntityId={selection} showFrequency={showFrequency} canEdit={capabilities.author} onHover={setHoveredSequenceId} onSelect={selectSequence} onSelectFunctionalEvent={selectFunctionalEvent} onFunctionalEventContext={openFunctionalEventContext} onSequenceContext={openSequenceContext} onReorderFunctionalEvent={(functionalEventId, targetIndex) => commit({ kind: "REORDER_FUNCTIONAL_EVENT", functionalEventId, targetIndex })} />}
              {representation === "event-sequence-diagram" && <EventSequenceDiagram view={presentation} activeSequenceId={activeSequenceId} selectedEntityId={selection} onHover={setHoveredSequenceId} onSelectSequence={selectSequence} onSelectFunctionalEvent={selectFunctionalEvent} onFunctionalEventContext={openFunctionalEventContext} onSequenceContext={openSequenceContext} />}
              {representation === "dynamic" && dynamicRun !== undefined && <DynamicEventSequenceDiagram run={dynamicRun} sequences={new Map(presentation.sequences.map((sequence) => [sequence.id, sequence]))} activeSequenceId={activeSequenceId} onHover={setHoveredSequenceId} onSelect={selectSequence} />}
              {representation === "table" && (
                <div className="et-editor__table-wrap"><table className="postable et-editor__table"><thead><tr><th>Sequence</th><th>Path</th><th>Result</th><th>Probability</th><th>Frequency</th></tr></thead><tbody>{presentation.sequences.map((sequence) => <tr key={sequence.id} className={selection === sequence.id ? "et-editor__table-row--selected" : ""} onMouseEnter={() => setHoveredSequenceId(sequence.id)} onMouseLeave={() => setHoveredSequenceId(null)} onClick={() => selectSequence(sequence.id)} onContextMenu={(contextEvent) => { contextEvent.preventDefault(); contextEvent.stopPropagation(); openSequenceContext(sequence.id, contextEvent.clientX, contextEvent.clientY); }}><td className="posmono">{sequence.name}</td><td><div className="et-editor__path">{events.map((event) => { const state = PATH_STATE[sequence.path[event.uuid] ?? "BYPASSED"]; return <span key={event.uuid} className={`et-editor__path-step et-editor__path-step--${state.className}`}>{event.label ?? event.name} {state.short}</span>; })}</div></td><td>{sequence.transferTargetId === undefined ? (sequence.endState === "SUCCESSFUL_MITIGATION" ? "Safe state" : "Release") : `Transfer to ${sequence.transferTargetId}`}</td><td className="posmono">{formatExponential(sequence.conditionalProbability)}</td><td className="posmono">{formatExponential(sequence.annualFrequency)}</td></tr>)}</tbody></table></div>
              )}
            </div>
          )}
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
                  <span>Fault-tree top event</span>
                  {selectedEvent.faultTreeTopEvent === undefined ? <span className="et-editor__reference-status">Not linked</span> : <button type="button" onClick={() => onOpenReference?.(selectedEvent.faultTreeTopEvent!)}>{selectedEvent.faultTreeTopEvent.modelId} · {selectedEvent.faultTreeTopEvent.entityId}</button>}
                  {capabilities.author && onSelectFaultTreeLink !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onSelectFaultTreeLink(selectedEvent)}>{selectedEvent.faultTreeTopEvent === undefined ? "Link fault tree" : "Change link"}</button>}
                  {capabilities.author && selectedEvent.faultTreeTopEvent !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => commit({ kind: "SET_FAULT_TREE_REFERENCE", functionalEventId: selectedEvent.uuid, reference: undefined })}>Remove link</button>}
                </div>
                <p className="et-editor__context-hint">Right-click this functional event in the diagram to insert, reorder, link, or delete it. In the classic view, drag its header to reorder it.</p>
              </>
            )}
            {selectedSequence !== undefined && (
              <>
                <span className="et-editor__eyebrow">Sequence · {selectedSequence.id}</span>
                <div className="et-editor__path et-editor__path--vertical">{events.map((event) => { const state = PATH_STATE[selectedSequence.path[event.uuid] ?? "BYPASSED"]; return <span key={event.uuid} className={`et-editor__path-step et-editor__path-step--${state.className}`}>{event.label ?? event.name} · {state.label}</span>; })}</div>
                <label className="et-editor__field"><span>Sequence result</span><select disabled={!capabilities.author} value={selectedSequence.transferTargetId === undefined ? selectedSequence.endState : "TRANSFER"} onChange={(event) => {
                  if (event.target.value === "TRANSFER") {
                    const target = availableTransfers.find((candidate) => candidate.sequenceIds.length > 0);
                    if (target !== undefined) commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: target.id, targetSequenceId: target.sequenceIds[0] });
                  } else commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: selectedSequence.id, endState: event.target.value as "SUCCESSFUL_MITIGATION" | "RADIONUCLIDE_RELEASE" });
                }}><option value="SUCCESSFUL_MITIGATION">Safe stable state</option><option value="RADIONUCLIDE_RELEASE">Radionuclide release</option>{availableTransfers.length > 0 && <option value="TRANSFER">Transfer to event tree</option>}</select></label>
                {selectedSequence.transferTargetId !== undefined && <label className="et-editor__field"><span>Transfer target</span><select disabled={!capabilities.author} value={selectedSequence.transferTargetId} onChange={(event) => { const target = availableTransfers.find((candidate) => candidate.id === event.target.value); commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: event.target.value, targetSequenceId: target?.sequenceIds[0] }); }}>{availableTransfers.filter((tree) => tree.sequenceIds.length > 0).map((tree) => <option key={tree.id} value={tree.id}>{tree.id} · {tree.name}</option>)}</select></label>}
                {selectedSequence.transferTargetId !== undefined && <label className="et-editor__field"><span>Target sequence</span><select disabled={!capabilities.author} value={model.transfers?.[selectedSequence.id]?.targetSequenceId ?? ""} onChange={(event) => commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: selectedSequence.transferTargetId!, targetSequenceId: event.target.value })}><option value="" disabled>Select target sequence</option>{availableTransfers.find((tree) => tree.id === selectedSequence.transferTargetId)?.sequenceIds.map((sequenceId) => <option key={sequenceId} value={sequenceId}>{sequenceId}</option>)}</select></label>}
                {selectedSequence.transferTargetId !== undefined && onOpenReference !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onOpenReference({ targetEventTreeId: selectedSequence.transferTargetId! })}>Open transfer target</button>}
                {selectedLinkedSequence !== undefined && onUpdateEventSequence !== undefined && (
                  <>
                    <label className="et-editor__field"><span>Sequence family</span><select disabled={!capabilities.author} value={selectedLinkedSequence.sequenceFamilyId ?? ""} onChange={(event) => onUpdateEventSequence(selectedLinkedSequence.uuid, { sequenceFamilyId: event.target.value || undefined })}><option value="">Unclassified</option>{sequenceFamilyOptions.map((option) => <option key={option.id} value={option.id}>{option.id} · {option.name}</option>)}</select></label>
                    <label className="et-editor__field"><span>Release category</span><select disabled={!capabilities.author || selectedSequence.endState === "SUCCESSFUL_MITIGATION"} value={selectedLinkedSequence.releaseCategoryId ?? ""} onChange={(event) => onUpdateEventSequence(selectedLinkedSequence.uuid, { releaseCategoryId: event.target.value || undefined })}><option value="">None</option>{releaseCategoryOptions.map((option) => <option key={option.id} value={option.id}>{option.id} · {option.name}</option>)}</select></label>
                  </>
                )}
                {selectedModelSequence?.eventSequenceId === undefined && <p className="et-editor__context-hint">Link this terminal path to an event-sequence record to assign its family or release category.</p>}
                {selectedSequence.conditionalProbability !== undefined && <div className="et-editor__sequence-result"><span>Conditional probability</span><strong className="posmono">{formatExponential(selectedSequence.conditionalProbability)}</strong><span>Annual frequency</span><strong className="posmono">{formatExponential(selectedSequence.annualFrequency)}</strong></div>}
                {selectedSequence.conditionalProbability !== undefined && <p className="et-editor__context-hint">Computed from the functional-event branch probabilities and the initiating-event frequency.</p>}
              </>
            )}
          </aside>
        )}
      </div>
      {contextMenu !== null && (
        <div className="et-editor__context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          {contextMenu.kind === "functional-event" && (() => {
            const functionalEvent = model.functionalEvents[contextMenu.id];
            if (functionalEvent === undefined) return null;
            const order = events.findIndex((event) => event.uuid === functionalEvent.uuid);
            return <>
              <div className="et-editor__context-title">{functionalEvent.label ?? functionalEvent.name}</div>
              <button type="button" role="menuitem" onClick={() => { onSelectionChange(functionalEvent.uuid); setContextMenu(null); }}>Open details</button>
              {functionalEvent.faultTreeTopEvent !== undefined && <button type="button" role="menuitem" onClick={() => { onOpenReference?.(functionalEvent.faultTreeTopEvent!); setContextMenu(null); }}>Open linked fault tree</button>}
              {capabilities.author && onSelectFaultTreeLink !== undefined && <button type="button" role="menuitem" onClick={() => { onSelectFaultTreeLink(functionalEvent); setContextMenu(null); }}>{functionalEvent.faultTreeTopEvent === undefined ? "Link fault-tree top event" : "Change fault-tree link"}</button>}
              {capabilities.author && functionalEvent.faultTreeTopEvent !== undefined && <button type="button" role="menuitem" onClick={() => { commit({ kind: "SET_FAULT_TREE_REFERENCE", functionalEventId: functionalEvent.uuid, reference: undefined }); setContextMenu(null); }}>Remove fault-tree link</button>}
              {capabilities.author && <div className="et-editor__context-separator" />}
              {capabilities.author && <button type="button" role="menuitem" disabled={events.length >= 10} onClick={() => { addFunctionalEvent(order); setContextMenu(null); }}>Insert functional event before</button>}
              {capabilities.author && <button type="button" role="menuitem" disabled={events.length >= 10} onClick={() => { addFunctionalEvent(order + 1); setContextMenu(null); }}>Insert functional event after</button>}
              {capabilities.author && <button type="button" role="menuitem" disabled={order <= 0} onClick={() => { commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: functionalEvent.uuid, direction: -1 }); setContextMenu(null); }}>Move earlier</button>}
              {capabilities.author && <button type="button" role="menuitem" disabled={order < 0 || order >= events.length - 1} onClick={() => { commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: functionalEvent.uuid, direction: 1 }); setContextMenu(null); }}>Move later</button>}
              {capabilities.author && <button type="button" role="menuitem" className="et-editor__context-danger" onClick={() => { setContextMenu(null); deleteFunctionalEvent(functionalEvent); }}>Delete functional event…</button>}
            </>;
          })()}
          {contextMenu.kind === "sequence" && (() => {
            const sequence = presentation.sequences.find((candidate) => candidate.id === contextMenu.id);
            if (sequence === undefined) return null;
            const transfer = availableTransfers.find((candidate) => candidate.sequenceIds.length > 0);
            return <>
              <div className="et-editor__context-title">{sequence.name}</div>
              <button type="button" role="menuitem" onClick={() => { onSelectionChange(sequence.id); setContextMenu(null); }}>Open details and pin path</button>
              {capabilities.author && <div className="et-editor__context-separator" />}
              {capabilities.author && <button type="button" role="menuitem" onClick={() => { commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: sequence.id, endState: "SUCCESSFUL_MITIGATION" }); setContextMenu(null); }}>Mark safe stable state</button>}
              {capabilities.author && <button type="button" role="menuitem" onClick={() => { commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: sequence.id, endState: "RADIONUCLIDE_RELEASE" }); setContextMenu(null); }}>Mark radionuclide release</button>}
              {capabilities.author && transfer !== undefined && <button type="button" role="menuitem" onClick={() => { commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: sequence.id, targetEventTreeId: transfer.id, targetSequenceId: transfer.sequenceIds[0] }); setContextMenu(null); }}>Transfer to another event tree</button>}
              {capabilities.author && <div className="et-editor__context-separator" />}
              {capabilities.author && <div className="et-editor__context-title">Functional-event applicability</div>}
              {capabilities.author && events.map((functionalEvent) => {
                const bypassed = (sequence.path[functionalEvent.uuid] ?? "BYPASSED") === "BYPASSED";
                return <button key={functionalEvent.uuid} type="button" role="menuitem" onClick={() => { setContextMenu(null); changeBypass(sequence.id, functionalEvent, !bypassed); }}>{bypassed ? "Restore S/F" : "Bypass"} · {functionalEvent.label ?? functionalEvent.name}</button>;
              })}
            </>;
          })()}
        </div>
      )}
    </section>
  );
}

export { EventTreeEditor };
