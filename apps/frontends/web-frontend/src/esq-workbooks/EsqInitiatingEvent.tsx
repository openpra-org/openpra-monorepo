import { JSX, useId } from "react";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import type { EsqInitiatorRecord, EsqTreeRecord } from "interfaces-mef-types/esq/event-sequence-quantification";
import { daParameterExpression, esqItemCode } from "interfaces-mef-types/esq/esq-run-inputs";
import { applyEventTreeOperation } from "../newly-developed-methods/event-tree";
import { ExpressionEditor, type ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { initiatorRecordOf, linkOf, newTypedInitiator, nextTypedInitiatorCode, typedTreesOf, withTypedInitiator, withTypedInitiatorRecord, withTypedTrees } from "./esqModel";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { FREQUENCY_UNIT_OPTIONS } from "./esqViewData";
import "./css/esqInitiatingEvent.css";

interface EsqStateOption {
  id: string;
  name: string;
}

const START_FREQUENCY: UncertainExpression = { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 1e-2 } } };

function stateText(state: EsqStateOption): string {
  return state.name.length > 0 && state.name !== state.id ? `${state.id} · ${state.name}` : state.id;
}

function sourceOf(record: EsqInitiatorRecord): string {
  if (record.frequency === undefined) return "";
  return record.heldBy === "DA" && record.holderId !== undefined ? `da:${record.holderId}` : "typed";
}

function withoutHolder(record: EsqInitiatorRecord): EsqInitiatorRecord {
  const { holderId: _holderId, ...rest } = record;
  return rest;
}

function EsqInitiatingEventEditor({ tree, drawn, states, frequencyOptions, label }: {
  tree: EsqTreeRecord;
  drawn: boolean;
  states: readonly EsqStateOption[];
  frequencyOptions: readonly ParameterOption[];
  label: (key: string) => string;
}): JSX.Element {
  const { esq, editable, mutateEsq, upstream, ieSync } = useEsqWorkbook();
  const fieldId = useId();
  const id = tree.initiatorId;
  const record = initiatorRecordOf(esq, id);
  const source = sourceOf(record);
  const daParameters = (esq.model?.parameters ?? []).filter((parameter) => parameter.quantificationModel === "FREQUENCY" && holdsEstimate(parameter.quantificationModel));
  const daLinked = linkOf(esq, "DA") !== undefined;
  const ieLinked = linkOf(esq, "IE") !== undefined;
  const unit = record.frequency?.basis ?? FrequencyUnit.PER_REACTOR_YEAR;

  function save(change: (current: EsqInitiatorRecord) => EsqInitiatorRecord): void {
    if (!editable) return;
    const now = new Date().toISOString();
    mutateEsq((draft) => withTypedInitiator(draft, change(initiatorRecordOf(draft, id)), upstream, now));
  }

  function setSource(value: string): void {
    if (value === "typed") {
      save((current) => ({ ...withoutHolder(current), heldBy: "TYPED", frequency: { expression: current.heldBy === "DA" || current.frequency === undefined ? START_FREQUENCY : current.frequency.expression, basis: current.frequency?.basis ?? FrequencyUnit.PER_REACTOR_YEAR } }));
      return;
    }
    if (!value.startsWith("da:")) return;
    const parameterId = value.slice(3);
    const expression = daParameterExpression(esq, parameterId);
    if (expression === undefined) return;
    save((current) => ({ ...current, heldBy: "DA", holderId: parameterId, frequency: { expression, basis: current.frequency?.basis ?? FrequencyUnit.PER_PLANT_YEAR } }));
  }

  function toggleState(stateId: string, on: boolean): void {
    save((current) => ({ ...current, stateIds: on ? [...current.stateIds.filter((known) => known !== stateId), stateId] : current.stateIds.filter((known) => known !== stateId) }));
  }

  function createInitiator(): void {
    if (!editable || !drawn) return;
    const now = new Date().toISOString();
    mutateEsq((draft) => {
      const code = nextTypedInitiatorCode(draft, upstream.ie);
      const withRecord = withTypedInitiatorRecord(draft, newTypedInitiator(code, tree.stateId));
      const trees = typedTreesOf(withRecord).map((candidate) => (candidate.uuid === tree.id ? applyEventTreeOperation(candidate, { kind: "UPDATE_TREE", changes: { initiatingEventId: code } }) : candidate));
      return withTypedTrees(withRecord, trees, upstream, now);
    });
  }

  return (
    <div className="esq-ie-editor">
      <span className="esq-ie-editor__eyebrow">Initiating event · {esqItemCode(id, record.name, "Unnamed")}</span>
      <label className="esq-ie-editor__field" htmlFor={`${fieldId}-name`}>
        <span>Name</span>
        <WorkbookInput id={`${fieldId}-name`} className="posfield__input" value={record.name} disabled={!editable} onChange={(event) => {
          const name = event.target.value.trim();
          save((current) => ({ ...current, name: name.length > 0 ? name : current.id }));
        }} />
      </label>
      <label className="esq-ie-editor__field" htmlFor={`${fieldId}-description`}>
        <span>Description</span>
        <WorkbookTextarea id={`${fieldId}-description`} className="posfield__textarea" rows={3} fitContent value={record.description ?? ""} disabled={!editable} onChange={(event) => {
          const description = event.target.value.trim();
          save((current) => {
            const { description: _previous, ...rest } = current;
            return description.length > 0 ? { ...rest, description } : rest;
          });
        }} />
      </label>
      {states.length > 0 && (
        <fieldset className="esq-ie-editor__states">
          <legend>Operating states</legend>
          {states.map((state) => (
            <label key={state.id} className="esq-ie-editor__state">
              <input type="checkbox" checked={record.stateIds.includes(state.id)} disabled={!editable} onChange={(event) => toggleState(state.id, event.target.checked)} />
              <span>{stateText(state)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label className="esq-ie-editor__field" htmlFor={`${fieldId}-source`}>
        <span>Frequency from</span>
        <select id={`${fieldId}-source`} className="posfield__select" value={source} disabled={!editable} onChange={(event) => setSource(event.target.value)}>
          {source === "" && <option value="">Not set</option>}
          <option value="typed">Typed</option>
          {daLinked && daParameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`DA · ${parameter.id} · ${parameter.estimate === undefined ? "no estimate" : expressionText(parameter.estimate, label)}`}</option>)}
          {source.startsWith("da:") && !daParameters.some((parameter) => `da:${parameter.id}` === source) && <option value={source}>{`DA · ${source.slice(3)} · not imported`}</option>}
        </select>
      </label>
      {source === "typed" && record.frequency !== undefined && (
        <div className="esq-ie-editor__field" role="group" aria-label="Frequency">
          <span>Frequency</span>
          <ExpressionEditor expression={record.frequency.expression} unit="PER_YEAR" options={frequencyOptions} disabled={!editable} onChange={(expression) => save((current) => ({ ...withoutHolder(current), heldBy: "TYPED", frequency: { expression, basis: current.frequency?.basis ?? FrequencyUnit.PER_REACTOR_YEAR } }))} />
        </div>
      )}
      <label className="esq-ie-editor__field" htmlFor={`${fieldId}-unit`}>
        <span>Unit</span>
        <select id={`${fieldId}-unit`} className="posfield__select" value={unit} disabled={!editable || record.frequency === undefined} onChange={(event) => {
          const basis = FREQUENCY_UNIT_OPTIONS.find((option) => option.id === event.target.value)?.id;
          if (basis === undefined) return;
          save((current) => (current.frequency === undefined ? current : { ...current, frequency: { ...current.frequency, basis } }));
        }}>
          {!FREQUENCY_UNIT_OPTIONS.some((option) => option.id === unit) && <option value={unit}>{unit}</option>}
          {FREQUENCY_UNIT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      {editable && drawn && (
        <div className="esq-ie-editor__actions">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={createInitiator}>New initiating event</button>
        </div>
      )}
      {ieLinked && ieSync.state === "FAILED" && <p className="esq-ie-editor__notice" role="status">The IE workbook was not updated: {ieSync.message ?? "it did not accept the change."}</p>}
      {ieLinked && ieSync.state === "EXAMPLE" && <p className="esq-ie-editor__notice" role="status">The linked IE workbook is an example, so it is not updated.</p>}
    </div>
  );
}

export { EsqInitiatingEventEditor, type EsqStateOption };
