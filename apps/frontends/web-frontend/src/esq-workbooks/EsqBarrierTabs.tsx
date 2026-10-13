import { JSX, useEffect, useId, useMemo, useState } from "react";
import type {
  EsqActionFeasibility,
  EsqBarrierEntry,
  EsqCell,
  EsqCellSide,
  EsqCredit,
  EsqMechanism,
  EsqMechanismKind,
  EsqPhenomenaLogic,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { AleatoryVariable, UncertainExpression, UncertainParameter, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import { cellInputsKey, lawFieldNames, lawFieldValue } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { parameterUnit } from "interfaces-mef-types/esq/esq-measure-inputs";
import type { LoadCapacityAnalysisResult, LoadCapacityRunSettings, LoadCapacitySampling } from "interfaces-shared-types/newly-developed-methods/load-capacity";
import { ExpressionEditor, LawEditor, type ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import { lawText } from "../newly-developed-methods/shared/uncertainText";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { PAGE, Pager, TabBar, paged } from "../es-workbooks/EsTiming";
import { pointText, sciText, useExpressionPoints, type EsqPointEntry } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { missionTimeSourcesOf, parameterTableOf } from "./esqModel";
import {
  FEASIBILITY_KEYS,
  FEASIBILITY_LABELS,
  MECHANISM_KIND_LABELS,
  MODE_KIND_LABELS,
  barriersViewOf,
  creditDraft,
  modeLabel,
  newCell,
  nextCreditId,
  numberText,
  withBarrierPatch,
  withCell,
  withCellBarrier,
  withCellEsPhenomenon,
  withCellMechanism,
  withCellNewBarrier,
  withCellNewMode,
  withCellNewPhenomenon,
  withCellRun,
  withCredit,
  withMechanism,
  withMode,
  withPhenomenaLogic,
  type EsqBarrierFinding,
  type EsqBarriersView,
  type EsqCellView,
  type EsqCreditRow,
} from "./esqBarriers";
import { listEsqCellRuns, runEsqBarrierCell, type EsqCellRunEntry } from "./esqWorkbookApi";
import "../es-workbooks/css/esSequences.css";
import "./css/esqBarrier.css";

type BarrierTab = "cells" | "credits" | "checks";

type BarrierDialog = { kind: "cell"; id: string } | { kind: "credit"; key: string } | { kind: "logic" };

interface CheckOption {
  id: string;
  label: string;
}

const BARRIER_TABS: { id: BarrierTab; label: string }[] = [
  { id: "cells", label: "Cells" },
  { id: "credits", label: "Credits" },
  { id: "checks", label: "Checks" },
];

const SEVERITY_TEXT: Record<EsqBarrierFinding["severity"], string> = { error: "Error", warning: "Warning", note: "Note" };

const SAMPLING_OPTIONS: readonly (readonly [LoadCapacitySampling, string])[] = [["LATIN_HYPERCUBE", "Latin hypercube"], ["MONTE_CARLO", "Monte Carlo"]];

const METHOD_TEXT: Record<string, string> = {
  POINT_BOTH: "Point load and point capacity",
  POINT_LOAD: "Capacity distribution at a point load",
  POINT_CAPACITY: "Load distribution against a point capacity",
  CLOSED_FORM_LOGNORMAL: "Closed form, lognormal pair",
  CLOSED_FORM_NORMAL: "Closed form, normal pair",
  QUADRATURE: "Adaptive quadrature",
};

const NEW = "__new__";

const DEFAULT_PROBABILITY = 1e-3;

const DEFAULT_SETTINGS: LoadCapacityRunSettings = { sampling: "LATIN_HYPERCUBE", samples: 10000, seed: 20261005, curvePoints: 41 };

const NO_FEASIBILITY: EsqActionFeasibility = { procedure: false, training: false, cues: false, crew: false, time: false, access: false, equipment: false };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function quantity(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "QUANTITY", law: { family: "POINT", value } } };
}

function probability(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function fieldLabel(field: string): string {
  const inner = field.startsWith("law.");
  const name = inner ? field.slice("law.".length) : field;
  let words = "";
  for (const character of name) words += character >= "A" && character <= "Z" ? ` ${character.toLowerCase()}` : character;
  const text = inner ? `inner ${words}` : words;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function numberFrom(text: string, apply: (value: number | undefined) => void): void {
  if (text.trim().length === 0) {
    apply(undefined);
    return;
  }
  const value = Number(text);
  if (Number.isFinite(value)) apply(value);
}

function daOptions(esq: EventSequenceQuantification, units: readonly UncertainUnit[], as: UncertainUnit): ParameterOption[] {
  const workbookId = esq.linkedWorkbooks?.DA;
  if (workbookId === undefined || workbookId.length === 0) return [];
  return (esq.model?.parameters ?? []).flatMap((parameter) => {
    const estimate = parameter.estimate;
    if (!holdsEstimate(parameter.quantificationModel) || estimate === undefined) return [];
    const unit = estimate.node === "VALUE" ? estimate.value.unit : parameterUnit(parameter);
    return units.includes(unit) ? [{ reference: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId, entityId: parameter.id }, label: `DA · ${parameter.id} · ${parameter.name}`, unit: as }] : [];
  });
}

function useParameterTable(): Map<string, UncertainParameter> {
  const { esq, upstream } = useEsqWorkbook();
  return useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
}

function phenomenonValue(entry: EsqCellView): string {
  const first = entry.phenomena[0];
  if (first === undefined) return "";
  return first.fromEs ? `es:${first.mechanism.phenomenonId ?? ""}` : `typed:${first.mechanism.id}`;
}

function CheckGroup({ label, options, values, editable, onChange }: { label: string; options: readonly CheckOption[]; values: readonly string[]; editable: boolean; onChange: (values: string[]) => void }): JSX.Element {
  const all = [...options, ...values.filter((value) => !options.some((option) => option.id === value)).map((value) => ({ id: value, label: value }))];
  return (
    <div className="posfield posfield-grid--span2 es-dialog-list" role="group" aria-label={label}>
      <span className="posfield__label">{label}</span>
      <div className="es-dialog-checks">
        {all.map((option) => (
          <label key={option.id} className="es-dialog-check">
            <input type="checkbox" checked={values.includes(option.id)} disabled={!editable} onChange={(event) => onChange(event.target.checked ? [...values, option.id] : values.filter((value) => value !== option.id))} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, value, editable, wide = false, onChange }: { label: string; value: string; editable: boolean; wide?: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <div className={wide ? "posfield posfield-grid--span2" : "posfield"}>
      <label className="posfield__label" htmlFor={id}>{label}</label>
      <WorkbookInput id={id} className="posfield__input" value={value} disabled={!editable} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function AreaField({ label, value, editable, required = false, onChange }: { label: string; value: string; editable: boolean; required?: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  const missing = required && blank(value);
  return (
    <div className="posfield posfield-grid--span2">
      <label className="posfield__label" htmlFor={id}>{label}</label>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent aria-invalid={missing} value={value} disabled={!editable} onChange={(event) => onChange(event.target.value)} />
      {missing && <span className="esq-barrier-error" role="alert">Required</span>}
    </div>
  );
}

function NumberField({ label, value, editable, onChange }: { label: string; value: number | undefined; editable: boolean; onChange: (value: number | undefined) => void }): JSX.Element {
  const id = useId();
  return (
    <div className="posfield">
      <label className="posfield__label" htmlFor={id}>{label}</label>
      <WorkbookInput id={id} type="number" step="any" className="posfield__input posmono esq-barrier-number" value={value ?? ""} disabled={!editable} onChange={(event) => numberFrom(event.target.value, onChange)} />
    </div>
  );
}

function CellsPanel({ view, onOpen, onLogic }: { view: EsqBarriersView; onOpen: (id: string) => void; onLogic: () => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const table = useParameterTable();
  const fieldId = useId();
  const [barrierFilter, setBarrierFilter] = useState("");
  const [page, setPage] = useState(0);
  const found = useMemo(() => view.cells.filter((entry) => barrierFilter.length === 0 || entry.cell.barrierId === barrierFilter), [view.cells, barrierFilter]);
  const rows = paged(found.length, page);
  const shown = useMemo(() => found.slice(rows.start, rows.start + PAGE), [found, rows.start]);
  const entries = useMemo(() => shown.flatMap((entry): EsqPointEntry[] => (entry.cell.ofRecord === "TYPED" && entry.expression !== undefined ? [{ key: entry.cell.id, expression: entry.expression, unit: "PROBABILITY" }] : [])), [shown]);
  const points = useExpressionPoints(entries, table);
  const actionLabel = editable ? "Edit" : "View";

  function add(): void {
    if (!editable) return;
    const cell = newCell(esq);
    mutateEsq((draft) => withCell(draft, cell.id, cell));
    onOpen(cell.id);
  }

  function valueOf(entry: EsqCellView): JSX.Element {
    const cell = entry.cell;
    if (cell.screening !== undefined) return <>{`Screened ${cell.screening.criterion}`}</>;
    if (entry.runValue !== undefined) return <>{sciText(entry.runValue)}</>;
    if (cell.ofRecord === "TYPED" && entry.expression !== undefined) return <>{pointText(points.get(cell.id))}</>;
    return <span className="esq-barrier-flag">Not set</span>;
  }

  function scopeOf(cell: EsqCell): JSX.Element {
    if (cell.hazardGroup !== undefined) return <>{cell.hazardGroup}</>;
    if (cell.familyId !== undefined) return <>{cell.familyId}</>;
    return cell.screening === undefined ? <span className="esq-barrier-flag">Not set</span> : <span className="posmuted">None</span>;
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-barrier`}>Barrier</label>
            <select id={`${fieldId}-barrier`} className="posfield__select" value={barrierFilter} onChange={(event) => { setBarrierFilter(event.target.value); setPage(0); }}>
              <option value="">All barriers</option>
              {view.barriers.map((barrier) => <option key={barrier.id} value={barrier.id}>{barrier.name}</option>)}
            </select>
          </div>
        </div>
        <div className="es-records__actions">
          <Pager rows={rows} noun="cell" onPage={setPage} />
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLogic}>Phenomena logic</button>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add cell</button>}
        </div>
      </div>
      {found.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Cells">
          <thead><tr><th scope="col">Barrier mode</th><th scope="col">Phenomenon</th><th scope="col">Family</th><th scope="col">P(fail)</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((entry) => {
              const cell = entry.cell;
              const phenomenon = entry.phenomena[0];
              return (
                <tr key={cell.id}>
                  <td>
                    {entry.mode === undefined ? <span className="esq-barrier-flag">Not set</span> : <span className="postable__name">{modeLabel(entry.mode)}</span>}
                    <span className="postable__name-sub">{entry.barrier?.name ?? cell.id}</span>
                  </td>
                  <td>
                    {phenomenon === undefined ? <span className="esq-barrier-flag">Not set</span> : <span className="postable__name">{phenomenon.name}</span>}
                    {phenomenon !== undefined && <span className="postable__name-sub">{phenomenon.fromEs ? "ES" : MECHANISM_KIND_LABELS[phenomenon.mechanism.kind]}</span>}
                  </td>
                  <td>{scopeOf(cell)}</td>
                  <td className="posmono">{valueOf(entry)}</td>
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${cell.id}`} onClick={() => onOpen(cell.id)}>{actionLabel}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function BarrierFields({ entry, view }: { entry: EsqCellView; view: EsqBarriersView }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const cell = entry.cell;
  const barrier = entry.barrier;
  const imported = view.barriers.filter((candidate) => candidate.record !== undefined);
  const typed = view.barriers.filter((candidate) => candidate.record === undefined);
  const manual = barrier?.entry?.manual;
  const criterionId = barrier?.entry?.criterionId;
  const impactRefs = barrier?.entry?.impactRefs ?? [];

  function setBarrier(value: string): void {
    if (!editable) return;
    if (value === NEW) mutateEsq((draft) => withCellNewBarrier(draft, cell.id));
    else if (value.length > 0) mutateEsq((draft) => withCellBarrier(draft, cell.id, value));
  }

  function patch(fn: (current: EsqBarrierEntry) => EsqBarrierEntry): void {
    if (!editable || barrier === undefined) return;
    const barrierId = barrier.id;
    mutateEsq((draft) => withBarrierPatch(draft, barrierId, fn));
  }

  function setCriterion(value: string): void {
    patch((current) => {
      const next: EsqBarrierEntry = { ...current };
      if (value.length === 0) delete next.criterionId;
      else next.criterionId = value;
      return next;
    });
  }

  function setImpactRefs(values: string[]): void {
    patch((current) => {
      const next: EsqBarrierEntry = { ...current };
      if (values.length === 0) delete next.impactRefs;
      else next.impactRefs = values;
      return next;
    });
  }

  return (
    <div className="posfield-grid esq-barrier-fields">
      <div className="posfield">
        <label className="posfield__label" htmlFor={`${fieldId}-barrier`}>Barrier</label>
        <select id={`${fieldId}-barrier`} className="posfield__select" value={barrier?.id ?? ""} disabled={!editable} onChange={(event) => setBarrier(event.target.value)}>
          {barrier === undefined && <option value="">{blank(cell.barrierId) ? "Not set" : `${cell.barrierId} · missing`}</option>}
          {imported.length > 0 && <optgroup label="Imported from POS">{imported.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</optgroup>}
          {typed.length > 0 && <optgroup label="Typed">{typed.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</optgroup>}
          <option value={NEW}>Add a typed barrier</option>
        </select>
      </div>
      {barrier !== undefined && (view.criteria.length > 0 || criterionId !== undefined) && (
        <div className="posfield">
          <label className="posfield__label" htmlFor={`${fieldId}-criterion`}>SC criterion</label>
          <select id={`${fieldId}-criterion`} className="posfield__select" value={criterionId ?? ""} disabled={!editable} onChange={(event) => setCriterion(event.target.value)}>
            <option value="">None</option>
            {criterionId !== undefined && !view.criteria.some((criterion) => criterion.id === criterionId) && <option value={criterionId}>{`${criterionId} · not in SC`}</option>}
            {view.criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{`Imported from SC · ${criterion.id} · ${criterion.parameters[0]?.parameter ?? criterion.barrierRef}`}</option>)}
          </select>
        </div>
      )}
      {manual !== undefined && barrier !== undefined && (
        <>
          <TextField label="Barrier name" value={manual.name} editable={editable} onChange={(name) => patch((current) => ({ ...current, manual: { ...manual, name } }))} />
          <AreaField label="Where the barrier comes from" value={manual.source} editable={editable} onChange={(source) => patch((current) => ({ ...current, manual: { ...manual, source } }))} />
          <CheckGroup label="Sources it holds" options={view.sources.map((name) => ({ id: name, label: name }))} values={manual.sourceNames} editable={editable} onChange={(sourceNames) => patch((current) => ({ ...current, manual: { ...manual, sourceNames } }))} />
        </>
      )}
      {barrier !== undefined && (view.impactRefs.length > 0 || impactRefs.length > 0) && (
        <CheckGroup label="IE barrier" options={view.impactRefs.map((ref) => ({ id: ref, label: ref }))} values={impactRefs} editable={editable} onChange={setImpactRefs} />
      )}
    </div>
  );
}

function ModeFields({ entry }: { entry: EsqCellView }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const cell = entry.cell;
  const barrier = entry.barrier;
  if (barrier === undefined) return null;
  const mode = entry.mode;
  const barrierId = barrier.id;

  function setMode(value: string): void {
    if (!editable) return;
    if (value === NEW) mutateEsq((draft) => withCellNewMode(draft, cell.id));
    else if (value.length > 0) mutateEsq((draft) => withCell(draft, cell.id, { ...cell, modeId: value }));
  }

  return (
    <div className="posfield-grid esq-barrier-fields">
      <div className="posfield">
        <label className="posfield__label" htmlFor={`${fieldId}-mode`}>Failure mode</label>
        <select id={`${fieldId}-mode`} className="posfield__select" value={mode?.id ?? ""} disabled={!editable} onChange={(event) => setMode(event.target.value)}>
          {mode === undefined && <option value="">{blank(cell.modeId) ? "Not set" : `${cell.modeId} · missing`}</option>}
          {barrier.modes.map((candidate) => <option key={candidate.id} value={candidate.id}>{`${modeLabel(candidate)} · ${MODE_KIND_LABELS[candidate.kind].toLowerCase()}`}</option>)}
          <option value={NEW}>Add a failure mode</option>
        </select>
      </div>
      {mode !== undefined && (
        <>
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-kind`}>Kind</label>
            <select id={`${fieldId}-kind`} className="posfield__select" value={mode.kind} disabled={!editable} onChange={(event) => { if (editable) mutateEsq((draft) => withMode(draft, barrierId, { ...mode, kind: event.target.value === "LOCALIZED" ? "LOCALIZED" : "GROSS" })); }}>
              <option value="GROSS">Gross</option>
              <option value="LOCALIZED">Localized</option>
            </select>
          </div>
          <TextField label="Mode name" value={mode.name} editable={editable} onChange={(name) => { if (editable) mutateEsq((draft) => withMode(draft, barrierId, { ...mode, name })); }} />
          <TextField label="Location" value={mode.location} editable={editable} onChange={(location) => { if (editable) mutateEsq((draft) => withMode(draft, barrierId, { ...mode, location })); }} />
        </>
      )}
    </div>
  );
}

function PhenomenonFields({ entry, view }: { entry: EsqCellView; view: EsqBarriersView }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const cell = entry.cell;
  if (entry.barrier === undefined) return null;
  const current = entry.phenomena[0];
  const value = phenomenonValue(entry);
  const typed = view.phenomena.filter((candidate) => !candidate.fromEs && (candidate.mechanism.barrierId === cell.barrierId || candidate.mechanism.id === current?.mechanism.id));
  const mechanism = current?.mechanism;
  const quantified = cell.screening === undefined;

  function setPhenomenon(next: string): void {
    if (!editable) return;
    if (next === NEW) mutateEsq((draft) => withCellNewPhenomenon(draft, cell.id));
    else if (next.startsWith("es:")) mutateEsq((draft) => withCellEsPhenomenon(draft, cell.id, next.slice(3)));
    else if (next.startsWith("typed:")) mutateEsq((draft) => withCellMechanism(draft, cell.id, next.slice(6)));
    else mutateEsq((draft) => withCellMechanism(draft, cell.id, undefined));
  }

  function save(next: EsqMechanism): void {
    if (!editable) return;
    mutateEsq((draft) => withMechanism(draft, next.id, next));
  }

  function setKind(kind: EsqMechanismKind): void {
    if (mechanism === undefined) return;
    const next: EsqMechanism = { ...mechanism, kind };
    if (kind === "HAZARD") {
      const group = cell.hazardGroup ?? view.hazards[0];
      if (group !== undefined) next.hazardGroup = group;
    } else {
      delete next.hazardGroup;
    }
    save(next);
  }

  return (
    <div className="posfield-grid esq-barrier-fields">
      <div className="posfield posfield-grid--span2">
        <label className="posfield__label" htmlFor={`${fieldId}-phenomenon`}>Phenomenon</label>
        <select id={`${fieldId}-phenomenon`} className="posfield__select" value={value} disabled={!editable} onChange={(event) => setPhenomenon(event.target.value)}>
          <option value="">Not set</option>
          {current?.fromEs === true && current.record === undefined && <option value={value}>{`${current.name} · not in ES`}</option>}
          {view.esPhenomena.length > 0 && <optgroup label="Imported from ES">{view.esPhenomena.map((record) => <option key={record.id} value={`es:${record.id}`}>{record.phenomenon.length > 0 && record.phenomenon !== record.name ? `${record.name} · ${record.phenomenon}` : record.name}</option>)}</optgroup>}
          {typed.length > 0 && <optgroup label="Typed">{typed.map((candidate) => <option key={candidate.mechanism.id} value={`typed:${candidate.mechanism.id}`}>{candidate.name}</option>)}</optgroup>}
          <option value={NEW}>Add a typed phenomenon</option>
        </select>
      </div>
      {mechanism !== undefined && current !== undefined && !current.fromEs && (
        <>
          <TextField label="Phenomenon name" value={mechanism.name} editable={editable} onChange={(name) => save({ ...mechanism, name })} />
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-kind`}>Kind</label>
            <select id={`${fieldId}-kind`} className="posfield__select" value={mechanism.kind} disabled={!editable} onChange={(event) => setKind(event.target.value === "DEGRADATION" ? "DEGRADATION" : event.target.value === "HAZARD" ? "HAZARD" : "PHENOMENON")}>
              <option value="PHENOMENON">Phenomenon that challenges the barrier</option>
              <option value="DEGRADATION">Degradation that weakens the barrier</option>
              <option value="HAZARD">External hazard mechanism</option>
            </select>
          </div>
          {mechanism.kind === "HAZARD" && (
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-hazard`}>Hazard group</label>
              <select id={`${fieldId}-hazard`} className="posfield__select" value={mechanism.hazardGroup ?? ""} disabled={!editable} onChange={(event) => save({ ...mechanism, hazardGroup: event.target.value })}>
                {mechanism.hazardGroup === undefined && <option value="">Not set</option>}
                {mechanism.hazardGroup !== undefined && !view.hazards.includes(mechanism.hazardGroup) && <option value={mechanism.hazardGroup}>{`${mechanism.hazardGroup} · out of scope`}</option>}
                {view.hazards.map((hazard) => <option key={hazard} value={hazard}>{hazard}</option>)}
              </select>
            </div>
          )}
          <CheckGroup label="Credited equipment it affects" options={view.systems.map((system) => ({ id: system, label: system }))} values={mechanism.equipment ?? []} editable={editable} onChange={(equipment) => {
            const next: EsqMechanism = { ...mechanism };
            if (equipment.length === 0) delete next.equipment;
            else next.equipment = equipment;
            save(next);
          }} />
          {quantified && <AreaField label="Basis" value={mechanism.basis} editable={editable} required onChange={(basis) => save({ ...mechanism, basis })} />}
        </>
      )}
      {mechanism !== undefined && current !== undefined && quantified && current.affected.length > 0 && (
        <AreaField label="Dependency on credited equipment" value={mechanism.dependency ?? ""} editable={editable} required onChange={(dependency) => save({ ...mechanism, dependency })} />
      )}
    </div>
  );
}

function ScopeFields({ entry, view }: { entry: EsqCellView; view: EsqBarriersView }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const cell = entry.cell;
  const status = cell.screening === undefined ? "QUANTIFIED" : cell.screening.criterion;
  const scope = cell.hazardGroup !== undefined ? `hazard:${cell.hazardGroup}` : cell.familyId !== undefined ? `family:${cell.familyId}` : "";
  const knownFamily = cell.familyId === undefined || view.families.some((family) => family.id === cell.familyId);
  const knownHazard = cell.hazardGroup === undefined || view.hazards.includes(cell.hazardGroup);

  function save(next: EsqCell): void {
    if (!editable) return;
    mutateEsq((draft) => withCell(draft, cell.id, next));
  }

  function setStatus(value: string): void {
    const next: EsqCell = { ...cell };
    if (value === "SCR-2" || value === "SCR-3") next.screening = { criterion: value, basis: cell.screening?.basis ?? "" };
    else delete next.screening;
    save(next);
  }

  function setScope(value: string): void {
    const next: EsqCell = { ...cell };
    delete next.familyId;
    delete next.hazardGroup;
    if (value.startsWith("family:")) next.familyId = value.slice(7);
    else if (value.startsWith("hazard:")) next.hazardGroup = value.slice(7);
    save(next);
  }

  return (
    <div className="posfield-grid esq-barrier-fields">
      <div className="posfield">
        <label className="posfield__label" htmlFor={`${fieldId}-status`}>Status</label>
        <select id={`${fieldId}-status`} className="posfield__select" value={status} disabled={!editable} onChange={(event) => setStatus(event.target.value)}>
          <option value="QUANTIFIED">Quantified</option>
          <option value="SCR-2">Screened by SCR-2</option>
          <option value="SCR-3">Screened by SCR-3</option>
        </select>
      </div>
      {cell.screening === undefined ? (
        <div className="posfield">
          <label className="posfield__label" htmlFor={`${fieldId}-scope`}>Applies to</label>
          <select id={`${fieldId}-scope`} className="posfield__select" value={scope} disabled={!editable} onChange={(event) => setScope(event.target.value)}>
            <option value="">Not set</option>
            {!knownFamily && <option value={scope}>{`${cell.familyId ?? ""} · missing`}</option>}
            {!knownHazard && <option value={scope}>{`${cell.hazardGroup ?? ""} · out of scope`}</option>}
            {view.families.length > 0 && <optgroup label="Families">{view.families.map((family) => <option key={family.id} value={`family:${family.id}`}>{family.name.length > 0 ? `${family.id} · ${family.name}` : family.id}</option>)}</optgroup>}
            {view.hazards.length > 0 && <optgroup label="External hazards">{view.hazards.map((hazard) => <option key={hazard} value={`hazard:${hazard}`}>{hazard}</option>)}</optgroup>}
          </select>
        </div>
      ) : (
        <AreaField label="Screening basis" value={cell.screening.basis} editable={editable} required onChange={(basis) => { if (cell.screening !== undefined) save({ ...cell, screening: { ...cell.screening, basis } }); }} />
      )}
    </div>
  );
}

function VariableFields({ label, variable, options, editable, onChange }: { label: string; variable: AleatoryVariable; options: readonly ParameterOption[]; editable: boolean; onChange: (next: AleatoryVariable) => void }): JSX.Element {
  const names = lawFieldNames(variable.law);
  return (
    <>
      <div className="posfield posfield-grid--span2">
        <span className="posfield__label">{label}</span>
        <LawEditor law={variable.law} unit="QUANTITY" disabled={!editable} onChange={(law) => {
          const allowed = lawFieldNames(law);
          onChange({ law, fields: variable.fields.filter((entry) => allowed.includes(entry.field)) });
        }} />
      </div>
      {names.length > 0 && (
        <CheckGroup label="Uncertain fields" options={names.map((name) => ({ id: name, label: fieldLabel(name) }))} values={variable.fields.map((entry) => entry.field)} editable={editable} onChange={(selected) => onChange({
          law: variable.law,
          fields: names.flatMap((name) => {
            if (!selected.includes(name)) return [];
            const kept = variable.fields.find((entry) => entry.field === name);
            if (kept !== undefined) return [kept];
            const value = lawFieldValue(variable.law, name);
            return value === undefined ? [] : [{ field: name, value: quantity(value) }];
          }),
        })} />
      )}
      {variable.fields.map((entry) => (
        <div key={entry.field} className="posfield posfield-grid--span2">
          <span className="posfield__label">{fieldLabel(entry.field)}</span>
          <ExpressionEditor expression={entry.value} unit="QUANTITY" options={options} disabled={!editable} onChange={(value) => onChange({ law: variable.law, fields: variable.fields.map((current) => (current.field === entry.field ? { field: entry.field, value } : current)) })} />
        </div>
      ))}
    </>
  );
}

function SideFields({ label, side, unit, capacity, onChange }: { label: string; side: EsqCellSide | undefined; unit: string; capacity: boolean; onChange: (next: EsqCellSide) => void }): JSX.Element {
  const { esq, editable } = useEsqWorkbook();
  const id = useId();
  const parameters = (esq.model?.parameters ?? []).filter((parameter) => holdsEstimate(parameter.quantificationModel) && parameter.estimate?.node === "VALUE");
  const fieldOptions = useMemo(() => daOptions(esq, ["QUANTITY", "FACTOR"], "QUANTITY"), [esq]);
  const from = side === undefined ? "" : side.source === "FRAGILITY" ? "fragility" : side.source === "DA" ? `da:${side.parameterId}` : "typed";
  const basis = side?.basis ?? "";
  const center = side?.source === "FRAGILITY" ? side.fragility.median : side?.source === "TYPED" && side.variable.law.family === "POINT" ? side.variable.law.value : 1;
  const suffix = blank(unit) ? "" : ` (${unit.trim()})`;

  function setFrom(value: string): void {
    if (value === "fragility") onChange({ source: "FRAGILITY", fragility: { median: center > 0 ? center : 1, betaR: 0.25, betaU: 0.3 }, basis });
    else if (value.startsWith("da:")) onChange({ source: "DA", parameterId: value.slice(3), basis });
    else if (value === "typed") onChange({ source: "TYPED", variable: { law: { family: "POINT", value: center }, fields: [] }, basis });
  }

  return (
    <>
      <div className="posfield">
        <label className="posfield__label" htmlFor={`${id}-from`}>{`${label} from`}</label>
        <select id={`${id}-from`} className="posfield__select" value={from} disabled={!editable} onChange={(event) => setFrom(event.target.value)}>
          {side === undefined && <option value="">Not set</option>}
          <option value="typed">Typed</option>
          {(capacity || side?.source === "FRAGILITY") && <option value="fragility">Fragility</option>}
          {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`Imported from DA · ${parameter.id} · ${parameter.estimate?.node === "VALUE" ? lawText(parameter.estimate.value.law) : parameter.name}`}</option>)}
          {side?.source === "DA" && !parameters.some((parameter) => parameter.id === side.parameterId) && <option value={`da:${side.parameterId}`}>{`DA · ${side.parameterId} · not imported`}</option>}
        </select>
      </div>
      {side?.source === "FRAGILITY" && (
        <>
          <NumberField label={`Median capacity${suffix}`} value={side.fragility.median} editable={editable} onChange={(median) => { if (median !== undefined) onChange({ ...side, fragility: { ...side.fragility, median } }); }} />
          <NumberField label="Randomness beta" value={side.fragility.betaR} editable={editable} onChange={(betaR) => { if (betaR !== undefined) onChange({ ...side, fragility: { ...side.fragility, betaR } }); }} />
          <NumberField label="Uncertainty beta" value={side.fragility.betaU} editable={editable} onChange={(betaU) => { if (betaU !== undefined) onChange({ ...side, fragility: { ...side.fragility, betaU } }); }} />
        </>
      )}
      {side?.source === "TYPED" && <VariableFields label={`${label}${suffix}`} variable={side.variable} options={fieldOptions} editable={editable} onChange={(variable) => onChange({ ...side, variable })} />}
      {side !== undefined && <AreaField label={`${label} basis`} value={side.basis} editable={editable} required onChange={(text) => onChange({ ...side, basis: text })} />}
    </>
  );
}

function LoadFields({ entry }: { entry: EsqCellView }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const cell = entry.cell;

  function save(next: EsqCell): void {
    if (!editable) return;
    mutateEsq((draft) => withCell(draft, cell.id, next));
  }

  return (
    <div className="posfield-grid esq-barrier-fields">
      <TextField label="Variable" value={cell.variable} editable={editable} onChange={(variable) => save({ ...cell, variable })} />
      <TextField label="Unit" value={cell.unit} editable={editable} onChange={(unit) => save({ ...cell, unit })} />
      <div className="posfield">
        <label className="posfield__label" htmlFor={`${fieldId}-basis`}>Basis</label>
        <select id={`${fieldId}-basis`} className="posfield__select" value={cell.basis} disabled={!editable} onChange={(event) => save({ ...cell, basis: event.target.value === "CONSERVATIVE" ? "CONSERVATIVE" : "REALISTIC" })}>
          <option value="CONSERVATIVE">Conservative (CC-I)</option>
          <option value="REALISTIC">Realistic (CC-II)</option>
        </select>
      </div>
      <SideFields label="Load" side={cell.load} unit={cell.unit} capacity={false} onChange={(load) => save({ ...cell, load })} />
      <SideFields label="Capacity" side={cell.capacity} unit={cell.unit} capacity onChange={(capacity) => save({ ...cell, capacity })} />
      <AreaField label="In-service aging" value={cell.aging ?? ""} editable={editable} onChange={(aging) => {
        const next: EsqCell = { ...cell };
        if (blank(aging)) delete next.aging;
        else next.aging = aging;
        save(next);
      }} />
    </div>
  );
}

function curveRows(result: LoadCapacityAnalysisResult): LoadCapacityAnalysisResult["curve"] {
  const curve = result.curve;
  if (curve.length <= 11) return curve;
  const rows: LoadCapacityAnalysisResult["curve"] = [];
  for (let index = 0; index < 11; index += 1) {
    const point = curve[Math.round((index * (curve.length - 1)) / 10)];
    if (point !== undefined) rows.push(point);
  }
  return rows;
}

function runLabel(run: EsqCellRunEntry): string {
  const when = `${new Date(run.requestedAt).toLocaleString()} · revision ${run.revision}`;
  if (run.status !== "SUCCEEDED") return `${when} · ${run.status.toLowerCase()}`;
  const settings = run.settings;
  const sampled = run.result?.uncertainty;
  return `${when} · ${sampled == null ? "point" : `${settings === undefined ? "sampled" : `${SAMPLING_OPTIONS.find(([key]) => key === settings.sampling)?.[1] ?? settings.sampling}, ${settings.samples} samples`}`}`;
}

function RunResult({ run, cell }: { run: EsqCellRunEntry; cell: EsqCell }): JSX.Element {
  const result = run.result;
  if (result === undefined) return <p className="es-scope-error" role="alert">{run.failure ?? "This run returned no result."}</p>;
  const sampled = result.uncertainty;
  const unit = blank(cell.unit) ? "" : ` (${cell.unit.trim()})`;
  const rows = curveRows(result);
  const band = rows.some((row) => row.p05 !== undefined);
  const values: [string, string][] = [
    ["Method", METHOD_TEXT[result.method] ?? result.method],
    ["P(fail) at the central values", sciText(result.pointProbability)],
    ["Central load", lawText(result.pointLoad)],
    ["Central capacity", lawText(result.pointCapacity)],
    ...(sampled === null ? [] : [
      ["Mean over the samples", sciText(sampled.mean)] as [string, string],
      ["5th, median, 95th", `${sciText(sampled.p05)}, ${sciText(sampled.p50)}, ${sciText(sampled.p95)}`] as [string, string],
      ["Standard deviation", sciText(sampled.standardDeviation)] as [string, string],
      ["Samples and seed", `${sampled.samples} · seed ${sampled.seed}`] as [string, string],
    ]),
  ];
  return (
    <>
      <table className="postable postable--mid esq-barrier-table" aria-label="Run result">
        <thead><tr><th scope="col">Result</th><th scope="col">Value</th></tr></thead>
        <tbody>{values.map(([name, value]) => <tr key={name}><td>{name}</td><td className="posmono">{value}</td></tr>)}</tbody>
      </table>
      <table className="postable postable--mid esq-barrier-table" aria-label="Conditional failure curve">
        <thead><tr><th scope="col">{`Load${unit}`}</th><th scope="col">P(fail | load)</th>{band && <><th scope="col">5th</th><th scope="col">95th</th></>}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.load}:${index}`}>
              <td className="posmono">{numberText(row.load)}</td>
              <td className="posmono">{sciText(row.probability)}</td>
              {band && <><td className="posmono">{row.p05 === undefined ? "None" : sciText(row.p05)}</td><td className="posmono">{row.p95 === undefined ? "None" : sciText(row.p95)}</td></>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function RunFields({ entry }: { entry: EsqCellView }): JSX.Element {
  const { editable, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [settings, setSettings] = useState<LoadCapacityRunSettings>(DEFAULT_SETTINGS);
  const [runs, setRuns] = useState<EsqCellRunEntry[]>([]);
  const [shownId, setShownId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const blocked = analysisSaveBlock(runtime);
  const workbookId = runtime.workbookId;
  const cell = entry.cell;
  const cellId = cell.id;

  useEffect(() => {
    if (workbookId === null) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    listEsqCellRuns(workbookId, cellId)
      .then((loaded) => {
        if (cancelled) return;
        setRuns(loaded);
        setShownId((current) => (loaded.some((run) => run.id === current) ? current : loaded.find((run) => run.status === "SUCCEEDED")?.id ?? loaded[0]?.id ?? ""));
      })
      .catch((caught: Error) => { if (!cancelled) setError(caught.message); });
    return () => { cancelled = true; };
  }, [workbookId, cellId, reload]);

  function run(): void {
    if (workbookId === null || runtime.revision === null) return;
    setRunning(true);
    setError(null);
    runEsqBarrierCell(workbookId, cellId, runtime.revision, settings)
      .then((response) => {
        if (response.run.status !== "SUCCEEDED") setError(response.run.failure?.message ?? "The run failed.");
        setShownId(response.run.id);
        setReload((n) => n + 1);
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setRunning(false));
  }

  const shown = runs.find((candidate) => candidate.id === shownId);
  const recorded = cell.run?.runId === shown?.id && cell.ofRecord === "RUN";

  function useAsRecord(): void {
    if (!editable || shown?.result === undefined) return;
    const result = shown.result;
    const sampled = result.uncertainty;
    const runId = shown.id;
    const revision = shown.revision;
    const at = shown.requestedAt;
    mutateEsq((draft: EventSequenceQuantification) => {
      const current = draft.barrierWork?.cells?.find((candidate) => candidate.id === cellId);
      if (current === undefined) return draft;
      return withCellRun(draft, cellId, {
        runId,
        revision,
        at,
        method: result.method,
        inputs: cellInputsKey(current),
        point: result.pointProbability,
        ...(sampled === null ? {} : { mean: sampled.mean, p05: sampled.p05, p50: sampled.p50, p95: sampled.p95, samples: sampled.samples, sampling: sampled.sampling, law: sampled.law }),
      });
    });
  }

  const disabled = running || !editable || blocked !== null || entry.problem !== undefined;

  return (
    <div className="esq-barrier-section">
      <div className="posfield-grid esq-barrier-fields">
        <div className="posfield">
          <label className="posfield__label" htmlFor={`${fieldId}-sampling`}>Sampling</label>
          <select id={`${fieldId}-sampling`} className="posfield__select" value={settings.sampling} onChange={(event) => setSettings({ ...settings, sampling: event.target.value === "MONTE_CARLO" ? "MONTE_CARLO" : "LATIN_HYPERCUBE" })}>
            {SAMPLING_OPTIONS.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </select>
        </div>
        <div className="posfield">
          <label className="posfield__label" htmlFor={`${fieldId}-samples`}>Samples</label>
          <input id={`${fieldId}-samples`} type="number" min={2} max={1000000} step={1} className="posfield__input posmono esq-barrier-number" value={settings.samples} onChange={(event) => { const value = Math.round(Number(event.target.value)); if (Number.isFinite(value) && value >= 2 && value <= 1000000) setSettings({ ...settings, samples: value }); }} />
        </div>
        <div className="posfield">
          <label className="posfield__label" htmlFor={`${fieldId}-seed`}>Seed</label>
          <input id={`${fieldId}-seed`} type="number" min={0} step={1} className="posfield__input posmono esq-barrier-number" value={settings.seed} onChange={(event) => { const value = Math.round(Number(event.target.value)); if (Number.isSafeInteger(value) && value >= 0) setSettings({ ...settings, seed: value }); }} />
        </div>
        <div className="posfield">
          <label className="posfield__label" htmlFor={`${fieldId}-points`}>Curve points</label>
          <input id={`${fieldId}-points`} type="number" min={2} max={1001} step={1} className="posfield__input posmono esq-barrier-number" value={settings.curvePoints} onChange={(event) => { const value = Math.round(Number(event.target.value)); if (Number.isFinite(value) && value >= 2 && value <= 1001) setSettings({ ...settings, curvePoints: value }); }} />
        </div>
      </div>
      <div className="posrow es-dialog-actions">
        {entry.problem !== undefined && <span className="esq-barrier-flag" title={entry.problem}>Cannot run</span>}
        <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled} title={blocked ?? entry.problem} onClick={run}>{running ? "Running" : "Run the cell"}</button>
      </div>
      {error !== null && <p className="es-scope-error" role="alert">{error}</p>}
      {runs.length > 0 && (
        <div className="posfield-grid esq-barrier-fields">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${fieldId}-shown`}>Run</label>
            <select id={`${fieldId}-shown`} className="posfield__select" value={shownId} onChange={(event) => setShownId(event.target.value)}>
              {runs.map((candidate) => <option key={candidate.id} value={candidate.id}>{runLabel(candidate)}</option>)}
            </select>
          </div>
        </div>
      )}
      {shown !== undefined && <RunResult run={shown} cell={cell} />}
      {editable && shown?.result !== undefined && (
        <div className="posrow es-dialog-actions">
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={recorded} onClick={useAsRecord}>{recorded ? "Value of record" : "Use as value of record"}</button>
        </div>
      )}
    </div>
  );
}

function ValueFields({ entry }: { entry: EsqCellView }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const cell = entry.cell;
  const options = useMemo(() => daOptions(esq, ["PROBABILITY"], "PROBABILITY"), [esq]);
  const preOperational = esq.plantStage !== "OPERATIONAL" || cell.assumption !== undefined;

  function save(next: EsqCell): void {
    if (!editable) return;
    mutateEsq((draft) => withCell(draft, cell.id, next));
  }

  function setRecord(value: string): void {
    const next: EsqCell = { ...cell };
    if (value === "RUN" && cell.run !== undefined) next.ofRecord = "RUN";
    else if (value === "TYPED") {
      next.ofRecord = "TYPED";
      if (next.typed === undefined) next.typed = { expression: probability(cell.run?.point ?? DEFAULT_PROBABILITY), basis: "" };
    } else delete next.ofRecord;
    save(next);
  }

  function setAssumption(calculation: string, closure: string): void {
    const next: EsqCell = { ...cell };
    if (blank(calculation) && blank(closure)) delete next.assumption;
    else next.assumption = { calculation, closure };
    save(next);
  }

  return (
    <div className="posfield-grid esq-barrier-fields">
      <div className="posfield">
        <label className="posfield__label" htmlFor={`${fieldId}-use`}>Goes to</label>
        <select id={`${fieldId}-use`} className="posfield__select" value={cell.use} disabled={!editable} onChange={(event) => save({ ...cell, use: event.target.value === "END_STATE_ATTRIBUTE" ? "END_STATE_ATTRIBUTE" : "SPLIT_FRACTION" })}>
          <option value="SPLIT_FRACTION">Split fraction in Step 02</option>
          <option value="END_STATE_ATTRIBUTE">End-state attribute for MS</option>
        </select>
      </div>
      <div className="posfield">
        <label className="posfield__label" htmlFor={`${fieldId}-record`}>Value of record</label>
        <select id={`${fieldId}-record`} className="posfield__select" value={cell.ofRecord ?? ""} disabled={!editable} onChange={(event) => setRecord(event.target.value)}>
          {cell.ofRecord === undefined && <option value="">Not set</option>}
          {cell.run !== undefined && <option value="RUN">{`Calculated · ${sciText(cell.run.mean ?? cell.run.point)}`}</option>}
          <option value="TYPED">Typed</option>
        </select>
      </div>
      {cell.ofRecord === "TYPED" && cell.typed !== undefined && (
        <>
          <div className="posfield posfield-grid--span2">
            <span className="posfield__label">Typed P(fail)</span>
            <ExpressionEditor expression={cell.typed.expression} unit="PROBABILITY" options={options} disabled={!editable} onChange={(expression) => { if (cell.typed !== undefined) save({ ...cell, typed: { ...cell.typed, expression } }); }} />
          </div>
          <AreaField label="Source of the typed value" value={cell.typed.basis} editable={editable} required onChange={(basis) => { if (cell.typed !== undefined) save({ ...cell, typed: { ...cell.typed, basis } }); }} />
        </>
      )}
      {preOperational && (
        <>
          <AreaField label="Design calculation behind the cell" value={cell.assumption?.calculation ?? ""} editable={editable} required={esq.plantStage !== "OPERATIONAL"} onChange={(calculation) => setAssumption(calculation, cell.assumption?.closure ?? "")} />
          <AreaField label="How the assumption closes" value={cell.assumption?.closure ?? ""} editable={editable} onChange={(closure) => setAssumption(cell.assumption?.calculation ?? "", closure)} />
        </>
      )}
    </div>
  );
}

function CellDialog({ id, view, onClose }: { id: string; view: EsqBarriersView; onClose: () => void }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const entry = view.cells.find((candidate) => candidate.cell.id === id);
  if (entry === undefined) return null;
  const cell = entry.cell;
  const title = entry.mode === undefined ? cell.id : `${cell.id} · ${modeLabel(entry.mode)}`;
  const quantified = cell.screening === undefined;

  return (
    <DialogShell label="Cell" onClose={onClose} fit>
      <DialogHead cap={`Cell · ${cell.hazardGroup === undefined ? "ESQ-A3 · C5 · C10 · C12 to C14" : "ESQ-C11 · C15"}`} title={title} onClose={onClose} />
      <div className="modal__body esq-barrier-dialog">
        <div className="esq-barrier-section">
          <span className="esq-barrier-head">Barrier</span>
          <BarrierFields entry={entry} view={view} />
          <ModeFields entry={entry} />
        </div>
        <div className="esq-barrier-section">
          <span className="esq-barrier-head">Phenomenon</span>
          <PhenomenonFields entry={entry} view={view} />
          <ScopeFields entry={entry} view={view} />
        </div>
        {quantified && (
          <>
            <div className="esq-barrier-section">
              <span className="esq-barrier-head">Load and capacity</span>
              <LoadFields entry={entry} />
            </div>
            <div className="esq-barrier-section">
              <span className="esq-barrier-head">Run</span>
              <RunFields entry={entry} />
            </div>
            <div className="esq-barrier-section">
              <span className="esq-barrier-head">Value</span>
              <ValueFields entry={entry} />
            </div>
          </>
        )}
        {editable && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withCell(draft, id, undefined)); onClose(); }}>Delete cell</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function LogicDialog({ view, onClose }: { view: EsqBarriersView; onClose: () => void }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const id = useId();
  const current: EsqPhenomenaLogic = view.logic ?? { included: true, basis: "" };

  function save(next: EsqPhenomenaLogic): void {
    if (!editable) return;
    mutateEsq((draft) => withPhenomenaLogic(draft, next));
  }

  function setCredit(key: "scrubbing" | "beneficial", value: string): void {
    const next: EsqPhenomenaLogic = { ...current };
    if (value.length === 0) delete next[key];
    else next[key] = { credited: value === "yes", basis: current[key]?.basis ?? "" };
    save(next);
  }

  const scrubbing = current.scrubbing;
  const beneficial = current.beneficial;

  return (
    <DialogShell label="Phenomena logic" onClose={onClose}>
      <DialogHead cap="Phenomena logic · ESQ-C6" title="Phenomena in the model logic" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-barrier-fields">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${id}-included`}>Phenomena logic</label>
            <select id={`${id}-included`} className="posfield__select" value={current.included ? "yes" : "no"} disabled={!editable} onChange={(event) => save({ ...current, included: event.target.value === "yes" })}>
              <option value="yes">In the event trees and fault trees</option>
              <option value="no">Not in the model</option>
            </select>
          </div>
          <AreaField label="Where it sits" value={current.basis} editable={editable} required onChange={(basis) => save({ ...current, basis })} />
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${id}-scrubbing`}>Scrubbing</label>
            <select id={`${id}-scrubbing`} className="posfield__select" value={scrubbing === undefined ? "" : scrubbing.credited ? "yes" : "no"} disabled={!editable} onChange={(event) => setCredit("scrubbing", event.target.value)}>
              <option value="">Not decided</option>
              <option value="yes">Credited</option>
              <option value="no">Not credited</option>
            </select>
          </div>
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${id}-beneficial`}>Beneficial failures</label>
            <select id={`${id}-beneficial`} className="posfield__select" value={beneficial === undefined ? "" : beneficial.credited ? "yes" : "no"} disabled={!editable} onChange={(event) => setCredit("beneficial", event.target.value)}>
              <option value="">Not decided</option>
              <option value="yes">Credited</option>
              <option value="no">Not credited</option>
            </select>
          </div>
          {scrubbing !== undefined && <AreaField label="Scrubbing basis" value={scrubbing.basis} editable={editable} required={scrubbing.credited} onChange={(basis) => save({ ...current, scrubbing: { ...scrubbing, basis } })} />}
          {beneficial !== undefined && <AreaField label="Beneficial failure basis" value={beneficial.basis} editable={editable} required={beneficial.credited} onChange={(basis) => save({ ...current, beneficial: { ...beneficial, basis } })} />}
        </div>
      </div>
    </DialogShell>
  );
}

function CreditsPanel({ view, onOpen }: { view: EsqBarriersView; onOpen: (key: string) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(view.credits.length, page);
  const shown = view.credits.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";

  function add(kind: EsqCredit["kind"]): void {
    if (!editable) return;
    const id = nextCreditId(esq);
    mutateEsq((draft) => withCredit(draft, id, { id, kind, name: "", familyIds: [], environment: "", beyondQualification: false, credited: false, analysis: "", basis: "" }));
    onOpen(id);
  }

  function sourceOf(row: EsqCreditRow): string {
    if (row.qualification !== undefined) return `Imported from SY · ${row.qualification.id}`;
    if (row.credit?.qualificationId !== undefined) return `SY · ${row.credit.qualificationId}`;
    if (row.credit?.actionId !== undefined) return `Imported from HR · ${row.credit.actionId}`;
    return "Typed";
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="credit" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => add("ACTION")}>Add action credit</button>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => add("EQUIPMENT")}>Add equipment credit</button>}
        </div>
      </div>
      {view.credits.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Credits">
          <thead><tr><th scope="col">Credit</th><th scope="col">Kind</th><th scope="col">Families</th><th scope="col">Decision</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.key}>
                <td>
                  <span className="postable__name">{row.name}</span>
                  <span className="postable__name-sub">{sourceOf(row)}</span>
                </td>
                <td>{row.kind === "EQUIPMENT" ? "Equipment" : "Action"}</td>
                <td>{(row.credit?.familyIds ?? []).length === 0 ? <span className="posmuted">None</span> : (row.credit?.familyIds ?? []).join(", ")}</td>
                <td>{row.credit === undefined ? <span className="esq-barrier-flag">Not decided</span> : row.credit.credited ? "Credited" : "Not credited"}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${row.name}`} onClick={() => onOpen(row.key)}>{actionLabel}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function CreditDialog({ rowKey, view, onClose }: { rowKey: string; view: EsqBarriersView; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const row = view.credits.find((candidate) => candidate.key === rowKey);
  if (row === undefined) return null;
  const credit: EsqCredit | undefined = row.credit ?? (row.qualification === undefined ? undefined : creditDraft(esq, row.qualification));
  if (credit === undefined) return null;
  const equipment = credit.kind === "EQUIPMENT";
  const feasibility = credit.feasibility ?? NO_FEASIBILITY;
  const creditId = credit.id;
  const decided = row.credit !== undefined;

  function save(next: EsqCredit): void {
    if (!editable) return;
    mutateEsq((draft) => withCredit(draft, creditId, next));
  }

  function setQualification(value: string): void {
    if (credit === undefined) return;
    const record = view.qualifications.find((candidate) => candidate.id === value);
    const next: EsqCredit = { ...credit };
    if (record === undefined) {
      delete next.qualificationId;
      save(next);
      return;
    }
    save({ ...next, qualificationId: record.id, environment: blank(credit.environment) ? record.condition : credit.environment, beyondQualification: record.beyondQualification });
  }

  function setAction(value: string): void {
    if (credit === undefined) return;
    const record = view.actions.find((candidate) => candidate.id === value);
    const next: EsqCredit = { ...credit };
    if (record === undefined) {
      delete next.actionId;
      save(next);
      return;
    }
    save({ ...next, actionId: record.id, name: blank(credit.name) ? record.name : credit.name, ...(record.feasibility === undefined ? {} : { feasibility: record.feasibility }) });
  }

  function setTreatment(value: string): void {
    if (credit === undefined) return;
    const next: EsqCredit = { ...credit };
    if (value === "CONSERVATIVE" || value === "DETAILED") next.treatment = value;
    else delete next.treatment;
    save(next);
  }

  return (
    <DialogShell label="Credit" onClose={onClose}>
      <DialogHead cap={equipment ? "Equipment credit · ESQ-C8 · C9" : "Action credit · ESQ-C7 · C8"} title={blank(credit.name) ? credit.id : credit.name} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-barrier-fields">
          {equipment ? (
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label" htmlFor={`${fieldId}-record`}>SY record</label>
              <select id={`${fieldId}-record`} className="posfield__select" value={credit.qualificationId ?? ""} disabled={!editable} onChange={(event) => setQualification(event.target.value)}>
                <option value="">Typed</option>
                {credit.qualificationId !== undefined && !view.qualifications.some((record) => record.id === credit.qualificationId) && <option value={credit.qualificationId}>{`${credit.qualificationId} · not in SY`}</option>}
                {view.qualifications.map((record) => <option key={record.id} value={record.id}>{`Imported from SY · ${record.id} · ${record.systemId}${record.beyondQualification ? " · beyond qualification" : ""}`}</option>)}
              </select>
            </div>
          ) : (
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label" htmlFor={`${fieldId}-action`}>HR action</label>
              <select id={`${fieldId}-action`} className="posfield__select" value={credit.actionId ?? ""} disabled={!editable} onChange={(event) => setAction(event.target.value)}>
                <option value="">Typed</option>
                {credit.actionId !== undefined && !view.actions.some((record) => record.id === credit.actionId) && <option value={credit.actionId}>{`${credit.actionId} · not in HR`}</option>}
                {view.actions.map((record) => <option key={record.id} value={record.id}>{`Imported from HR · ${record.id} · ${record.name}`}</option>)}
              </select>
            </div>
          )}
          <TextField label="Name" value={credit.name} editable={editable} wide onChange={(name) => save({ ...credit, name })} />
          <CheckGroup label="Families" options={view.families.map((family) => ({ id: family.id, label: family.name.length > 0 ? `${family.id} · ${family.name}` : family.id }))} values={credit.familyIds} editable={editable} onChange={(familyIds) => save({ ...credit, familyIds })} />
          <AreaField label="Conditions" value={credit.environment} editable={editable} onChange={(environment) => save({ ...credit, environment })} />
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-beyond`}>Qualification</label>
            <select id={`${fieldId}-beyond`} className="posfield__select" value={credit.beyondQualification ? "beyond" : "within"} disabled={!editable} onChange={(event) => save({ ...credit, beyondQualification: event.target.value === "beyond" })}>
              <option value="within">Within its qualification limits</option>
              <option value="beyond">Beyond its qualification limits</option>
            </select>
          </div>
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-treatment`}>Treatment</label>
            <select id={`${fieldId}-treatment`} className="posfield__select" value={credit.treatment ?? ""} disabled={!editable} onChange={(event) => setTreatment(event.target.value)}>
              <option value="">Not set</option>
              <option value="CONSERVATIVE">Conservative (CC-I)</option>
              <option value="DETAILED">Detailed (CC-II)</option>
            </select>
          </div>
          {!equipment && (
            <CheckGroup label="Feasibility shown" options={FEASIBILITY_KEYS.map((key) => ({ id: key, label: FEASIBILITY_LABELS[key] }))} values={FEASIBILITY_KEYS.filter((key) => feasibility[key])} editable={editable} onChange={(keys) => save({ ...credit, feasibility: { procedure: keys.includes("procedure"), training: keys.includes("training"), cues: keys.includes("cues"), crew: keys.includes("crew"), time: keys.includes("time"), access: keys.includes("access"), equipment: keys.includes("equipment") } })} />
          )}
          <AreaField label={equipment ? "Survivability analysis" : "Feasibility record"} value={credit.analysis} editable={editable} required={credit.credited && (credit.beyondQualification || !equipment)} onChange={(analysis) => save({ ...credit, analysis })} />
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-credited`}>Decision</label>
            <select id={`${fieldId}-credited`} className="posfield__select" value={decided ? credit.credited ? "yes" : "no" : ""} disabled={!editable} onChange={(event) => { if (event.target.value.length > 0) save({ ...credit, credited: event.target.value === "yes" }); }}>
              {!decided && <option value="">Not decided</option>}
              <option value="no">Not credited</option>
              <option value="yes">Credited</option>
            </select>
          </div>
          <AreaField label="Basis" value={credit.basis} editable={editable} required={decided} onChange={(basis) => save({ ...credit, basis })} />
        </div>
        {editable && decided && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withCredit(draft, creditId, undefined)); onClose(); }}>Delete credit</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function ChecksPanel({ findings, opens, onOpen }: { findings: readonly EsqBarrierFinding[]; opens: (finding: EsqBarrierFinding) => boolean; onOpen: (finding: EsqBarrierFinding) => void }): JSX.Element {
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

function EsqBarrierTabs(): JSX.Element {
  const { esq } = useEsqWorkbook();
  const view = useMemo(() => barriersViewOf(esq), [esq]);
  const [tab, setTab] = useState<BarrierTab>("cells");
  const [dialog, setDialog] = useState<BarrierDialog | null>(null);

  function creditKey(id: string): string | undefined {
    return view?.credits.find((row) => row.credit?.id === id)?.key;
  }

  function opens(finding: EsqBarrierFinding): boolean {
    const target = finding.target;
    if (target === undefined || view === undefined) return false;
    if (target.kind === "cell") return view.cells.some((entry) => entry.cell.id === target.id);
    if (target.kind === "credit") return creditKey(target.id) !== undefined;
    if (target.kind === "qualification") return view.credits.some((row) => row.key === `sy:${target.id}`);
    return true;
  }

  function openFinding(finding: EsqBarrierFinding): void {
    const target = finding.target;
    if (target === undefined) return;
    if (target.kind === "cell") setDialog({ kind: "cell", id: target.id });
    else if (target.kind === "credit") {
      const key = creditKey(target.id);
      if (key !== undefined) setDialog({ kind: "credit", key });
    } else if (target.kind === "qualification") setDialog({ kind: "credit", key: `sy:${target.id}` });
    else setDialog({ kind: "logic" });
  }

  function renderPanel(): JSX.Element | null {
    if (view === undefined) return null;
    switch (tab) {
      case "cells": return <CellsPanel view={view} onOpen={(id) => setDialog({ kind: "cell", id })} onLogic={() => setDialog({ kind: "logic" })} />;
      case "credits": return <CreditsPanel view={view} onOpen={(key) => setDialog({ kind: "credit", key })} />;
      case "checks": return <ChecksPanel findings={view.findings} opens={opens} onOpen={openFinding} />;
    }
  }

  function renderDialog(): JSX.Element | null {
    if (dialog === null || view === undefined) return null;
    const close = (): void => setDialog(null);
    switch (dialog.kind) {
      case "cell": return <CellDialog id={dialog.id} view={view} onClose={close} />;
      case "credit": return <CreditDialog rowKey={dialog.key} view={view} onClose={close} />;
      case "logic": return <LogicDialog view={view} onClose={close} />;
    }
  }

  return (
    <>
      <div className="poscard es-seq-card">
        <TabBar tabs={BARRIER_TABS} tab={tab} label="Barrier sections" findings={view?.findings.length ?? 0} onTab={setTab} />
        <div className="es-seq-card__panel">{renderPanel()}</div>
      </div>
      {renderDialog()}
    </>
  );
}

export { EsqBarrierTabs };
