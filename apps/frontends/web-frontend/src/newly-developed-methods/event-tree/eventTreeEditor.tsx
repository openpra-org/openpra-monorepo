import { type JSX, useEffect, useMemo, useState } from "react";
import type { FunctionalEvent } from "interfaces-mef-types/es/event-sequence-analysis";
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

function EventTreeEditor(props: EventTreeEditorProps): JSX.Element {
  const {
    model,
    eventSequences,
    availableInitiatingEvents,
    availableTransfers,
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
    onOpenReference,
    onRun,
  } = props;
  const [hoveredSequenceId, setHoveredSequenceId] = useState<string | null>(null);
  const [past, setPast] = useState<typeof model[]>([]);
  const [future, setFuture] = useState<typeof model[]>([]);
  const [showValidation, setShowValidation] = useState(false);
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

  useEffect(() => {
    setPast([]);
    setFuture([]);
    onSelectionChange(null);
  }, [model.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const addFunctionalEvent = (): void => {
    const code = uniqueFunctionalEventCode(model);
    const id = crypto.randomUUID();
    const event: FunctionalEvent = {
      uuid: id,
      name: "New functional event",
      label: code,
      order: events.length,
    };
    commit({ kind: "ADD_FUNCTIONAL_EVENT", functionalEvent: event });
    onSelectionChange(id);
  };

  const selectSequence = (sequenceId: string): void => {
    onSelectionChange(sequenceId);
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
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={past.length === 0} onClick={undo} aria-label="Undo event-tree edit">Undo</button>
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={future.length === 0} onClick={redo} aria-label="Redo event-tree edit">Redo</button>
          </>}
          <button type="button" className={`posnav__btn posnav__btn--sm${errors.length === 0 ? "" : " posnav__btn--danger"}`} onClick={() => setShowValidation((current) => !current)}>{errors.length === 0 ? "Valid" : `${String(errors.length)} issue${errors.length === 1 ? "" : "s"}`}</button>
          {capabilities.quantification && onRun !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || errors.length > 0 || saveState === "saving"} onClick={onRun}>{running ? "Running…" : "Run"}</button>}
        </div>
      </header>

      {showValidation && (
        <div className="et-editor__validation" role="status">
          {validation.length === 0 ? <span>No validation findings.</span> : validation.map((finding) => <button key={`${finding.code}-${finding.entityId ?? "tree"}`} type="button" className={`et-editor__finding et-editor__finding--${finding.severity.toLowerCase()}`} onClick={() => onSelectionChange(finding.entityId ?? null)}><strong>{finding.code}</strong><span>{finding.message}</span></button>)}
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
          <div className="et-editor__events-bar">
            <div><strong>Ordered functional events</strong><span>{events.length === 0 ? " Add the branch questions that define every sequence path." : ` ${String(events.length)} events · ${String(presentation.sequences.length)} sequence paths`}</span></div>
            {capabilities.author && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addFunctionalEvent} disabled={events.length >= 10}>Add functional event</button>}
          </div>
          {events.length === 0 ? (
            <div className="et-editor__empty">Add the first functional event to generate complete success and failure paths.</div>
          ) : (
            <div className="estree">
              <div className="estree__bar">
                <span className="estree__bar-title">{REPRESENTATIONS.find((item) => item.id === representation)?.label}</span>
                <div className="estree__selector">
                  {REPRESENTATIONS.filter((item) => item.id !== "dynamic" || dynamicRun !== undefined).map((item) => <button key={item.id} type="button" className={`estree__selector-opt${item.id === representation ? " estree__selector-opt--active" : ""}`} onClick={() => onRepresentationChange(item.id)}>{item.label}</button>)}
                </div>
              </div>
              {representation === "event-tree" && <ClassicEventTreeDiagram view={presentation} activeSequenceId={activeSequenceId} showFrequency={showFrequency} onHover={setHoveredSequenceId} onSelect={selectSequence} />}
              {representation === "event-sequence-diagram" && <EventSequenceDiagram view={presentation} activeSequenceId={activeSequenceId} selectedEntityId={selection} showFrequency={showFrequency} onHover={setHoveredSequenceId} onSelectSequence={selectSequence} onSelectFunctionalEvent={onSelectionChange} />}
              {representation === "dynamic" && dynamicRun !== undefined && <DynamicEventSequenceDiagram run={dynamicRun} sequences={new Map(presentation.sequences.map((sequence) => [sequence.id, sequence]))} activeSequenceId={activeSequenceId} onHover={setHoveredSequenceId} onSelect={selectSequence} />}
              {representation === "table" && (
                <div className="et-editor__table-wrap"><table className="postable et-editor__table"><thead><tr><th>Sequence</th><th>Path</th><th>Result</th><th>Probability</th><th>Frequency</th></tr></thead><tbody>{presentation.sequences.map((sequence) => <tr key={sequence.id} className={selection === sequence.id ? "et-editor__table-row--selected" : ""} onMouseEnter={() => setHoveredSequenceId(sequence.id)} onMouseLeave={() => setHoveredSequenceId(null)} onClick={() => selectSequence(sequence.id)}><td className="posmono">{sequence.name}</td><td><div className="et-editor__path">{events.map((event) => <span key={event.uuid} className={`et-editor__path-step et-editor__path-step--${sequence.path[event.uuid] === "SUCCESS" ? "success" : "failure"}`}>{event.label ?? event.name} {sequence.path[event.uuid] === "SUCCESS" ? "S" : "F"}</span>)}</div></td><td>{sequence.transferTargetId === undefined ? (sequence.endState === "SUCCESSFUL_MITIGATION" ? "Safe state" : "Release") : `Transfer to ${sequence.transferTargetId}`}</td><td className="posmono">{formatExponential(sequence.conditionalProbability)}</td><td className="posmono">{formatExponential(sequence.annualFrequency)}</td></tr>)}</tbody></table></div>
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
                  {selectedEvent.faultTreeTopEvent === undefined ? <em>Not linked</em> : <button type="button" onClick={() => onOpenReference?.(selectedEvent.faultTreeTopEvent!)}>{selectedEvent.faultTreeTopEvent.modelId} · {selectedEvent.faultTreeTopEvent.entityId}</button>}
                  {capabilities.author && onSelectFaultTreeLink !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onSelectFaultTreeLink(selectedEvent)}>{selectedEvent.faultTreeTopEvent === undefined ? "Select top event" : "Change link"}</button>}
                  {capabilities.author && selectedEvent.faultTreeTopEvent !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => commit({ kind: "SET_FAULT_TREE_REFERENCE", functionalEventId: selectedEvent.uuid, reference: undefined })}>Remove link</button>}
                </div>
                {capabilities.author && <div className="et-editor__inspector-actions"><button type="button" className="posnav__btn posnav__btn--sm" disabled={(selectedEvent.order ?? 0) === 0} onClick={() => commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid, direction: -1 })}>Move earlier</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={(selectedEvent.order ?? 0) === events.length - 1} onClick={() => commit({ kind: "MOVE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid, direction: 1 })}>Move later</button><button type="button" className="posnav__btn posnav__btn--sm posnav__btn--danger" onClick={() => { if (window.confirm(`Delete ${selectedEvent.label ?? selectedEvent.name}? Sequence paths will be regenerated.`)) { commit({ kind: "DELETE_FUNCTIONAL_EVENT", functionalEventId: selectedEvent.uuid }); onSelectionChange(null); } }}>Delete</button></div>}
              </>
            )}
            {selectedSequence !== undefined && (
              <>
                <span className="et-editor__eyebrow">Sequence · {selectedSequence.id}</span>
                <h4>{selectedSequence.name}</h4>
                <div className="et-editor__path et-editor__path--vertical">{events.map((event) => <span key={event.uuid} className={`et-editor__path-step et-editor__path-step--${selectedSequence.path[event.uuid] === "SUCCESS" ? "success" : "failure"}`}>{event.label ?? event.name} · {selectedSequence.path[event.uuid] === "SUCCESS" ? "Success" : "Failure"}</span>)}</div>
                <label className="et-editor__field"><span>Sequence result</span><select disabled={!capabilities.author} value={selectedSequence.transferTargetId === undefined ? selectedSequence.endState : "TRANSFER"} onChange={(event) => {
                  if (event.target.value === "TRANSFER") {
                    const target = availableTransfers.find((candidate) => candidate.sequenceIds.length > 0);
                    if (target !== undefined) commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: target.id, targetSequenceId: target.sequenceIds[0] });
                  } else commit({ kind: "SET_SEQUENCE_END_STATE", sequenceId: selectedSequence.id, endState: event.target.value as "SUCCESSFUL_MITIGATION" | "RADIONUCLIDE_RELEASE" });
                }}><option value="SUCCESSFUL_MITIGATION">Safe stable state</option><option value="RADIONUCLIDE_RELEASE">Radionuclide release</option>{availableTransfers.length > 0 && <option value="TRANSFER">Transfer to event tree</option>}</select></label>
                {selectedSequence.transferTargetId !== undefined && <label className="et-editor__field"><span>Transfer target</span><select disabled={!capabilities.author} value={selectedSequence.transferTargetId} onChange={(event) => { const target = availableTransfers.find((candidate) => candidate.id === event.target.value); commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: event.target.value, targetSequenceId: target?.sequenceIds[0] }); }}>{availableTransfers.filter((tree) => tree.sequenceIds.length > 0).map((tree) => <option key={tree.id} value={tree.id}>{tree.id} · {tree.name}</option>)}</select></label>}
                {selectedSequence.transferTargetId !== undefined && <label className="et-editor__field"><span>Target sequence</span><select disabled={!capabilities.author} value={model.transfers?.[selectedSequence.id]?.targetSequenceId ?? ""} onChange={(event) => commit({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: selectedSequence.id, targetEventTreeId: selectedSequence.transferTargetId!, targetSequenceId: event.target.value })}><option value="" disabled>Select target sequence</option>{availableTransfers.find((tree) => tree.id === selectedSequence.transferTargetId)?.sequenceIds.map((sequenceId) => <option key={sequenceId} value={sequenceId}>{sequenceId}</option>)}</select></label>}
                {selectedSequence.transferTargetId !== undefined && onOpenReference !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onOpenReference({ targetEventTreeId: selectedSequence.transferTargetId! })}>Open transfer target</button>}
                {selectedSequence.conditionalProbability !== undefined && <div className="et-editor__sequence-result"><span>Conditional probability</span><strong className="posmono">{formatExponential(selectedSequence.conditionalProbability)}</strong><span>Annual frequency</span><strong className="posmono">{formatExponential(selectedSequence.annualFrequency)}</strong></div>}
              </>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

export { EventTreeEditor };
