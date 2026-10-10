import { Fragment, JSX, useEffect, useId, useMemo, useState } from "react";
import {
  type EsqActionFeasibility,
  type EsqBarrierEntry,
  type EsqBarrierMode,
  type EsqCell,
  type EsqCellSide,
  type EsqCredit,
  type EsqMechanism,
  type EsqPhenomenaLogic,
  type EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import type { AleatoryVariable, UncertainExpression, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { cellInputsKey, lawFieldNames, lawFieldValue } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { parameterUnit } from "interfaces-mef-types/esq/esq-measure-inputs";
import { ExpressionEditor, LawEditor, type ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import { expressionText, lawText } from "../newly-developed-methods/shared/uncertainText";
import type { LoadCapacityAnalysisResult, LoadCapacityRunSettings, LoadCapacitySampling } from "interfaces-shared-types/newly-developed-methods/load-capacity";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  ChecksRow,
  DetailRow,
  DetailToggle,
  EsqProvenanceChip,
  EsqTabs,
  FieldList,
  FormFoot,
  FormRow,
  ModalHead,
  pointText,
  rowClass,
  sciText,
  useElementWidth,
  useExpressionPoints,
} from "./esqShared";
import { missionTimeSourcesOf, parameterLabelOf, parameterTableOf } from "./esqModel";
import {
  CELL_USE_LABELS,
  FEASIBILITY_KEYS,
  FEASIBILITY_LABELS,
  MECHANISM_KIND_LABELS,
  MODE_KIND_LABELS,
  barriersViewOf,
  cellSamples,
  modeLabel,
  nextBarrierId,
  nextCellId,
  nextCreditId,
  nextMechanismId,
  nextModeId,
  numberText,
  sideSourceText,
  withBarrierEntry,
  withCell,
  withCellRun,
  withCredit,
  withMechanism,
  withPhenomenaLogic,
  type EsqBarrierFinding,
  type EsqBarrierView,
  type EsqBarrierWindowKind,
  type EsqBarriersView,
  type EsqCellView,
} from "./esqBarriers";
import { listEsqCellRuns, runEsqBarrierCell, type EsqCellRunEntry } from "./esqWorkbookApi";
import type { EsqWindowContext } from "./esqModelScreen";

type BarrierTab = "barriers" | "phenomena" | "capacity" | "hazards" | "credits" | "results" | "checks";

const TAB_HEADS: Record<BarrierTab, { title: string; sr: string }> = {
  barriers: { title: "Barriers and failure modes", sr: "ESQ-C10 · ESQ-C12" },
  phenomena: { title: "Phenomena and degradation", sr: "ESQ-C4 · ESQ-C12 · ESQ-C13" },
  capacity: { title: "Load and capacity", sr: "ESQ-A3 · ESQ-A9 · ESQ-C5 · ESQ-C14" },
  hazards: { title: "Hazard capacity", sr: "ESQ-C11 · ESQ-C15" },
  credits: { title: "Credits in harsh conditions", sr: "ESQ-C7 · ESQ-C8 · ESQ-C9" },
  results: { title: "Runs and values of record", sr: "ESQ-A3 · ESQ-N-11" },
  checks: { title: "Barrier checks", sr: "ESQ-C10 to ESQ-C15" },
};

const SEVERITY_TEXT: Record<EsqBarrierFinding["severity"], string> = { error: "Error", warning: "Warning", note: "Note" };

const BARRIER_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqBarrierWindowKind>(["esqBarrier", "esqMechanism", "esqCell", "esqCredit"]);

const BARRIER_WINDOW_LABELS: Record<EsqBarrierWindowKind, string> = {
  esqBarrier: "Barrier",
  esqMechanism: "Mechanism",
  esqCell: "Load and capacity",
  esqCredit: "Credit",
};

const SAMPLING_OPTIONS: readonly (readonly [LoadCapacitySampling, string])[] = [["LATIN_HYPERCUBE", "Latin hypercube"], ["MONTE_CARLO", "Monte Carlo"]];

const METHOD_TEXT: Record<string, string> = {
  POINT_BOTH: "Point load and point capacity",
  POINT_LOAD: "Capacity distribution at a point load",
  POINT_CAPACITY: "Load distribution against a point capacity",
  CLOSED_FORM_LOGNORMAL: "Closed form, lognormal pair",
  CLOSED_FORM_NORMAL: "Closed form, normal pair",
  QUADRATURE: "Adaptive quadrature",
};

const STATUS_TEXT: Record<string, string> = {
  INTACT: "Intact",
  BREACHED: "Breached",
  DEGRADED: "Degraded",
  BYPASSED: "Bypassed",
  DEINERTED: "Deinerted",
  DRAINED: "Drained",
  OPEN: "Open",
};

function listValue(items: readonly string[]): string {
  return items.length === 0 ? "—" : items.join(", ");
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function valueText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function signedFrom(text: string, apply: (value: number | undefined) => void): void {
  if (text.trim().length === 0) {
    apply(undefined);
    return;
  }
  const value = Number(text);
  if (Number.isFinite(value)) apply(value);
}

function statusText(status: string): string {
  return STATUS_TEXT[status] ?? status;
}

const DEFAULT_PROBABILITY = 1e-3;

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

function CellValue({ entry }: { entry: EsqCellView }): JSX.Element {
  const { esq, upstream } = useEsqWorkbook();
  const table = useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const typed = entry.cell.ofRecord === "TYPED" ? entry.expression : undefined;
  const id = entry.cell.id;
  const entries = useMemo(() => (typed === undefined ? [] : [{ key: id, expression: typed, unit: "PROBABILITY" as const }]), [typed, id]);
  const points = useExpressionPoints(entries, table);
  if (entry.runValue !== undefined) return <>{sciText(entry.runValue)}</>;
  if (typed !== undefined) return <>{pointText(points.get(id))}</>;
  return <>—</>;
}

function cellTitle(entry: EsqCellView): string {
  return `${entry.barrier?.name ?? entry.cell.barrierId} · ${modeLabel(entry.mode)}`;
}

function valueSource(cell: EsqCell): string {
  if (cell.ofRecord === "TYPED") return "Typed";
  if (cell.ofRecord === "RUN") return cell.run?.law !== undefined ? "Run, sampled law" : "Run";
  return "—";
}

function BarriersTable({ view, openWindow }: { view: EsqBarriersView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.barriers.length === 0) return <p className="posmuted">{view.imported ? "POS lists no barrier. Add one by hand." : "The Step 02 import holds no barriers. Import again in Step 02 to bring them in from POS."}</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Barriers">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Barrier</th><th>Failure modes</th><th>SC criterion</th></tr>
        </thead>
        <tbody>
          {view.barriers.map((barrier) => {
            const open = barrier.id === openId;
            const kinds = [...new Set(barrier.modes.map((mode) => MODE_KIND_LABELS[mode.kind].toLowerCase()))];
            const impacts = barrier.impacts.filter((impact) => impact.state !== "INTACT");
            return (
              <Fragment key={barrier.id}>
                <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(barrier.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={barrier.name} onToggle={() => setOpenId(open ? "" : barrier.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqBarrier", id: barrier.id }); }}>{barrier.name}</button>
                    {barrier.manual && <span className="esq-rowtable__tag">By hand</span>}
                    {!barrier.manual && barrier.record === undefined && <span className="esq-rowtable__tag">Not in POS</span>}
                  </td>
                  <td className="esq-rowtable__text">{barrier.modes.length === 0 ? "None yet" : `${barrier.modes.length} · ${kinds.join(", ")}`}</td>
                  <td className="esq-rowtable__text">{barrier.criterion === undefined ? "—" : barrier.criterion.id}</td>
                </tr>
                {open && (
                  <DetailRow span={4} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Sources", value: listValue(barrier.sourceNames) },
                      { label: "Not intact in", value: barrier.openStates.length === 0 ? "—" : barrier.openStates.map((state) => `${state.stateId} (${statusText(state.status).toLowerCase()})`).join(", ") },
                      { label: "Breach criteria", value: listValue(barrier.record?.breachCriteria ?? []) },
                      { label: "Modes", value: barrier.modes.length === 0 ? "—" : barrier.modes.map((mode) => `${modeLabel(mode)} (${MODE_KIND_LABELS[mode.kind].toLowerCase()}${blank(mode.location) ? "" : `, ${mode.location.trim()}`})`).join("; ") },
                      { label: "Criterion", value: barrier.criterion === undefined ? "—" : barrier.criterion.parameters.map((parameter) => `${parameter.parameter}: ${parameter.criterion}`).join("; ") },
                      { label: "IE barrier", value: listValue(barrier.entry?.impactRefs ?? []) },
                      { label: "Challenged at initiation", value: impacts.length === 0 ? "—" : impacts.map((impact) => `${impact.groupId ?? impact.initiatorName} ${statusText(impact.state).toLowerCase()}`).join(", ") },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MechanismsTable({ view, openWindow }: { view: EsqBarriersView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.mechanisms.length === 0) return <p className="posmuted">No mechanism yet. Add the phenomena that challenge each barrier and the degradation that weakens it.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Mechanisms">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Mechanism</th><th>Kind</th><th>Barrier</th><th>Status</th></tr>
        </thead>
        <tbody>
          {view.mechanisms.map((entry) => {
            const mechanism = entry.mechanism;
            const open = mechanism.id === openId;
            return (
              <Fragment key={mechanism.id}>
                <tr className={rowClass(mechanism.screening !== undefined, open)} onClick={() => { if (!open) setOpenId(mechanism.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={mechanism.id} onToggle={() => setOpenId(open ? "" : mechanism.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqMechanism", id: mechanism.id }); }}>{blank(mechanism.name) ? mechanism.id : mechanism.name}</button>
                  </td>
                  <td>{MECHANISM_KIND_LABELS[mechanism.kind]}</td>
                  <td className="esq-rowtable__text">{entry.barrier?.name ?? "Missing"}</td>
                  <td>{mechanism.screening === undefined ? "Retained" : `Screened ${mechanism.screening.criterion}`}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "ID", value: mechanism.id },
                      { label: "Failure modes", value: listValue(entry.modes.map((mode) => modeLabel(mode))) },
                      { label: mechanism.kind === "HAZARD" ? "Hazard group" : "Families", value: mechanism.kind === "HAZARD" ? textValue(mechanism.hazardGroup) : listValue(mechanism.familyIds) },
                      { label: "Credited equipment", value: listValue(mechanism.equipment ?? []) },
                      { label: "Dependency", value: textValue(mechanism.dependency) },
                      { label: mechanism.screening === undefined ? "Basis" : `${mechanism.screening.criterion} basis`, value: textValue(mechanism.screening === undefined ? mechanism.basis : mechanism.screening.basis) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LogicCard({ logic }: { logic: EsqPhenomenaLogic | undefined }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const id = useId();
  const current: EsqPhenomenaLogic = logic ?? { included: true, basis: "" };
  const dis = !editable;

  function save(next: EsqPhenomenaLogic): void {
    if (!editable) return;
    mutateEsq((draft) => withPhenomenaLogic(draft, next));
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="ESQ" title="Phenomena in the model logic" level={3} />
        <div className="esq-card-actions"><EsqProvenanceChip>ESQ-C6</EsqProvenanceChip></div>
      </div>
      <div className="esq-form">
        <FormRow label="Phenomena logic" htmlFor={`${id}-included`}>
          <select id={`${id}-included`} className="posfield__select" value={current.included ? "yes" : "no"} disabled={dis} onChange={(event) => save({ ...current, included: event.target.value === "yes" })}>
            <option value="yes">In the event trees and fault trees</option>
            <option value="no">Not in the model</option>
          </select>
        </FormRow>
        <FormRow label="Where it sits" htmlFor={`${id}-basis`} top>
          <WorkbookTextarea id={`${id}-basis`} className="posfield__textarea" rows={2} fitContent value={current.basis} disabled={dis} onChange={(event) => save({ ...current, basis: event.target.value })} />
        </FormRow>
        <FormRow label="Scrubbing" htmlFor={`${id}-scrub`}>
          <select id={`${id}-scrub`} className="posfield__select" value={current.scrubbing === undefined ? "" : current.scrubbing.credited ? "yes" : "no"} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { scrubbing: _old, ...rest } = current;
            save(value.length === 0 ? rest : { ...rest, scrubbing: { credited: value === "yes", basis: current.scrubbing?.basis ?? "" } });
          }}>
            <option value="">Not decided</option>
            <option value="yes">Credited</option>
            <option value="no">Not credited</option>
          </select>
        </FormRow>
        {current.scrubbing !== undefined && (
          <FormRow label="Scrubbing basis" htmlFor={`${id}-scrub-basis`} top>
            <WorkbookTextarea id={`${id}-scrub-basis`} className="posfield__textarea" rows={2} fitContent value={current.scrubbing.basis} disabled={dis} onChange={(event) => save({ ...current, scrubbing: { credited: current.scrubbing?.credited === true, basis: event.target.value } })} />
          </FormRow>
        )}
        <FormRow label="Beneficial failures" htmlFor={`${id}-benefit`}>
          <select id={`${id}-benefit`} className="posfield__select" value={current.beneficial === undefined ? "" : current.beneficial.credited ? "yes" : "no"} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { beneficial: _old, ...rest } = current;
            save(value.length === 0 ? rest : { ...rest, beneficial: { credited: value === "yes", basis: current.beneficial?.basis ?? "" } });
          }}>
            <option value="">Not decided</option>
            <option value="yes">Credited</option>
            <option value="no">Not credited</option>
          </select>
        </FormRow>
        {current.beneficial !== undefined && (
          <FormRow label="Beneficial basis" htmlFor={`${id}-benefit-basis`} top>
            <WorkbookTextarea id={`${id}-benefit-basis`} className="posfield__textarea" rows={2} fitContent value={current.beneficial.basis} disabled={dis} onChange={(event) => save({ ...current, beneficial: { credited: current.beneficial?.credited === true, basis: event.target.value } })} />
          </FormRow>
        )}
      </div>
    </div>
  );
}

function CellsTable({ entries, hazard, openWindow }: { entries: EsqCellView[]; hazard: boolean; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (entries.length === 0) {
    return <p className="posmuted">{hazard ? "No hazard cell yet. Add one for each barrier failure mode an external hazard can cause." : "No cell yet. Add one for each barrier failure mode that a family challenges."}</p>;
  }
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label={hazard ? "Hazard cells" : "Load and capacity cells"}>
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Cell</th><th>Barrier mode</th><th>{hazard ? "Hazard" : "Family"}</th><th>P(fail)</th></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const cell = entry.cell;
            const open = cell.id === openId;
            return (
              <Fragment key={cell.id}>
                <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(cell.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={cell.id} onToggle={() => setOpenId(open ? "" : cell.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqCell", id: cell.id }); }}>{cell.id}</button>
                  </td>
                  <td className="esq-rowtable__text">{cellTitle(entry)}</td>
                  <td className="esq-rowtable__text">{hazard ? textValue(cell.hazardGroup) : textValue(cell.familyId)}</td>
                  <td className="esq-rowtable__num"><CellValue entry={entry} />{entry.stale && cell.ofRecord === "RUN" && <span className="esq-rowtable__tag">Out of date</span>}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Variable", value: blank(cell.variable) ? "—" : `${cell.variable.trim()}${blank(cell.unit) ? "" : ` (${cell.unit.trim()})`}` },
                      { label: "Load", value: sideSourceText(cell.load, cell.unit) },
                      { label: "Capacity", value: sideSourceText(cell.capacity, cell.unit) },
                      { label: "Basis", value: cell.basis === "REALISTIC" ? "Realistic (CC-II)" : "Conservative (CC-I)" },
                      { label: "Goes to", value: cell.use === "SPLIT_FRACTION" ? (entry.usedBy.length === 0 ? "Split fraction, not yet linked in Step 02" : `Split fraction for ${listValue(entry.usedBy)}`) : CELL_USE_LABELS[cell.use] },
                      { label: "Value from", value: valueSource(cell) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CreditsTable({ view, openWindow }: { view: EsqBarriersView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.credits.length === 0) return <p className="posmuted">No credit yet. Record each piece of equipment and each action credited in harsh conditions or after a release.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Credits">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Credit</th><th>Kind</th><th>Families</th><th>Decision</th></tr>
        </thead>
        <tbody>
          {view.credits.map((entry) => {
            const credit = entry.credit;
            const open = credit.id === openId;
            const missing = FEASIBILITY_KEYS.filter((key) => credit.feasibility?.[key] !== true).map((key) => FEASIBILITY_LABELS[key].toLowerCase());
            return (
              <Fragment key={credit.id}>
                <tr className={rowClass(!credit.credited, open)} onClick={() => { if (!open) setOpenId(credit.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={credit.id} onToggle={() => setOpenId(open ? "" : credit.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqCredit", id: credit.id }); }}>{blank(credit.name) ? credit.id : credit.name}</button>
                  </td>
                  <td>{credit.kind === "EQUIPMENT" ? "Equipment" : "Action"}</td>
                  <td className="esq-rowtable__text">{listValue(credit.familyIds)}</td>
                  <td>{credit.credited ? "Credited" : "Not credited"}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: credit.kind === "EQUIPMENT" ? "SY record" : "HR event", value: textValue(credit.kind === "EQUIPMENT" ? credit.qualificationId : credit.actionId) },
                      { label: "Conditions", value: textValue(credit.environment) },
                      { label: "Beyond qualification", value: credit.beyondQualification ? "Yes" : "No" },
                      ...(credit.kind === "ACTION" ? [
                        { label: "Treatment", value: credit.treatment === "DETAILED" ? "Detailed" : credit.treatment === "CONSERVATIVE" ? "Conservative" : "—" },
                        { label: "Feasibility", value: missing.length === 0 ? "Shown for every condition" : `Not shown: ${missing.join(", ")}` },
                        { label: "HEP", value: entry.action?.hep === undefined ? "—" : expressionText(entry.action.hep) },
                      ] : []),
                      { label: credit.kind === "EQUIPMENT" ? "Survivability analysis" : "Feasibility record", value: textValue(credit.analysis) },
                      { label: "Basis", value: textValue(credit.basis) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChecksTable({ findings, openWindow }: { findings: EsqBarrierFinding[]; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label="Barrier checks">
        <thead><tr><th>Severity</th><th>Check</th><th>Item</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((finding, index) => {
            const target = finding.target;
            return (
              <tr key={`${finding.check}:${finding.item}:${index}`}>
                <td className={`esq-severity esq-severity--${finding.severity}`}>{SEVERITY_TEXT[finding.severity]}</td>
                <td>{finding.check}</td>
                <td className="esq-rowtable__text">
                  {target === undefined ? finding.item : (
                    <button type="button" className="esq-rowtable__name" onClick={() => openWindow({ kind: target.kind, id: target.id })}>{finding.item}</button>
                  )}
                </td>
                <td className="esq-rowtable__wrap">{finding.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Picker<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }): JSX.Element {
  return (
    <fieldset className="esq-run__picker">
      <legend>{legend}</legend>
      <div role="radiogroup" aria-label={legend}>
        {options.map(([option, label]) => (
          <label key={option} className={value === option ? "is-selected" : ""}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
  if (result === undefined) return <p className="esq-run__error" role="alert">{run.failure ?? "This run returned no result."}</p>;
  const sampled = result.uncertainty;
  const unit = blank(cell.unit) ? "" : ` (${cell.unit.trim()})`;
  const rows = curveRows(result);
  const band = rows.some((row) => row.p05 !== undefined);
  return (
    <>
      <FieldList items={[
        { label: "Method", value: METHOD_TEXT[result.method] ?? result.method },
        { label: "P(fail) at the central values", value: sciText(result.pointProbability) },
        { label: "Central load", value: lawText(result.pointLoad) },
        { label: "Central capacity", value: lawText(result.pointCapacity) },
        ...(sampled === null ? [] : [
          { label: "Mean over the samples", value: sciText(sampled.mean) },
          { label: "5th, median, 95th", value: `${sciText(sampled.p05)}, ${sciText(sampled.p50)}, ${sciText(sampled.p95)}` },
          { label: "Standard deviation", value: sciText(sampled.standardDeviation) },
          { label: "Samples and seed", value: `${sampled.samples} · seed ${sampled.seed}` },
        ]),
      ]} />
      <table className="postable esq-rowtable esq-run__families" aria-label="Conditional failure curve">
        <thead>
          <tr><th>{`Load${unit}`}</th><th>P(fail | load)</th>{band && <><th>5th</th><th>95th</th></>}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.load}:${index}`}>
              <td className="esq-rowtable__num">{numberText(row.load)}</td>
              <td className="esq-rowtable__num">{sciText(row.probability)}</td>
              {band && <><td className="esq-rowtable__num">{valueText(row.p05)}</td><td className="esq-rowtable__num">{valueText(row.p95)}</td></>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ValuesTable({ view }: { view: EsqBarriersView }): JSX.Element | null {
  const entries = [...view.cells, ...view.hazardCells];
  if (entries.length === 0) return null;
  return (
    <table className="postable esq-rowtable esq-run__families" aria-label="Values of record">
      <thead><tr><th>Cell</th><th>Barrier mode</th><th>P(fail)</th><th>From</th></tr></thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.cell.id}>
            <td className="esq-rowtable__text">{entry.cell.id}</td>
            <td className="esq-rowtable__text">{`${cellTitle(entry)} · ${entry.cell.hazardGroup ?? entry.cell.familyId ?? "—"}`}</td>
            <td className="esq-rowtable__num"><CellValue entry={entry} /></td>
            <td>{valueSource(entry.cell)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResultsPanel({ view }: { view: EsqBarriersView }): JSX.Element {
  const { editable, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const all = [...view.cells, ...view.hazardCells];
  const [cellId, setCellId] = useState(all[0]?.cell.id ?? "");
  const [settings, setSettings] = useState<LoadCapacityRunSettings>({ sampling: "LATIN_HYPERCUBE", samples: 10000, seed: 20261005, curvePoints: 41 });
  const [runs, setRuns] = useState<EsqCellRunEntry[]>([]);
  const [shownId, setShownId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const saveBlockedReason = analysisSaveBlock(runtime);
  const workbookId = runtime.workbookId;
  const entry = all.find((candidate) => candidate.cell.id === cellId);
  const sampledInputs = entry !== undefined && cellSamples(entry.cell);

  useEffect(() => {
    if (workbookId === null || cellId.length === 0) {
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
    if (workbookId === null || runtime.revision === null || entry === undefined) return;
    setRunning(true);
    setError(null);
    runEsqBarrierCell(workbookId, entry.cell.id, runtime.revision, settings)
      .then((response) => {
        if (response.run.status !== "SUCCEEDED") setError(response.run.failure?.message ?? "The run failed.");
        setShownId(response.run.id);
        setReload((n) => n + 1);
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setRunning(false));
  }

  const shown = runs.find((candidate) => candidate.id === shownId);
  const recorded = entry?.cell.run?.runId === shown?.id && entry?.cell.ofRecord === "RUN";

  function useAsRecord(): void {
    if (!editable || entry === undefined || shown?.result === undefined) return;
    const result = shown.result;
    const sampled = result.uncertainty;
    mutateEsq((draft: EventSequenceQuantification) => {
      const cell = draft.barrierWork?.cells?.find((candidate) => candidate.id === entry.cell.id);
      if (cell === undefined) return draft;
      return withCellRun(draft, cell.id, {
        runId: shown.id,
        revision: shown.revision,
        at: shown.requestedAt,
        method: result.method,
        inputs: cellInputsKey(cell),
        point: result.pointProbability,
        ...(sampled === null ? {} : { mean: sampled.mean, p05: sampled.p05, p50: sampled.p50, p95: sampled.p95, samples: sampled.samples, sampling: sampled.sampling, law: sampled.law }),
      });
    });
  }

  if (all.length === 0) return <p className="posmuted">No cell yet. Add one in the Capacity tab.</p>;
  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Load and capacity run controls">
        <div className="esq-run__row">
          <label className="esq-run__field" htmlFor={`${fieldId}-cell`}>
            <span>Cell</span>
            <select id={`${fieldId}-cell`} value={cellId} onChange={(event) => { setCellId(event.target.value); setShownId(""); setError(null); }}>
              {all.map((candidate) => <option key={candidate.cell.id} value={candidate.cell.id}>{`${candidate.cell.id} · ${cellTitle(candidate)} · ${candidate.cell.hazardGroup ?? candidate.cell.familyId ?? "—"}`}</option>)}
            </select>
          </label>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || !editable || saveBlockedReason !== null || entry === undefined || entry.problem !== undefined} onClick={run}>
            {running ? "Running…" : "Run cell"}
          </button>
        </div>
        <div className="esq-run__pickers">
          <Picker legend="Sampling" name={`${fieldId}-sampling`} value={settings.sampling} options={SAMPLING_OPTIONS} onChange={(sampling) => setSettings({ ...settings, sampling })} />
          <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-samples`}>
            <span>Samples</span>
            <input id={`${fieldId}-samples`} type="number" min={2} max={1000000} step={1} value={settings.samples} onChange={(event) => { const value = Math.round(Number(event.target.value)); if (Number.isFinite(value) && value >= 2 && value <= 1000000) setSettings({ ...settings, samples: value }); }} />
          </label>
          <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-seed`}>
            <span>Seed</span>
            <input id={`${fieldId}-seed`} type="number" min={0} step={1} value={settings.seed} onChange={(event) => { const value = Math.round(Number(event.target.value)); if (Number.isSafeInteger(value) && value >= 0) setSettings({ ...settings, seed: value }); }} />
          </label>
          <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-points`}>
            <span>Curve points</span>
            <input id={`${fieldId}-points`} type="number" min={2} max={1001} step={1} value={settings.curvePoints} onChange={(event) => { const value = Math.round(Number(event.target.value)); if (Number.isFinite(value) && value >= 2 && value <= 1001) setSettings({ ...settings, curvePoints: value }); }} />
          </label>
        </div>
        {entry !== undefined && !sampledInputs && <p className="esq-meta">This cell has no uncertain field, so the run gives the point probability without sampling.</p>}
      </div>
      {entry?.problem !== undefined && <p className="esq-run__notice" role="status">{entry.problem}</p>}
      {saveBlockedReason !== null && <p className="esq-run__notice" role="status">{saveBlockedReason}</p>}
      {error !== null && <p className="esq-run__error" role="alert">{error}</p>}
      {runs.length > 0 && (
        <div className="esq-bar">
          <label className="posfield__label" htmlFor={`${fieldId}-shown`}>Result</label>
          <select id={`${fieldId}-shown`} className="posfield__select" value={shownId} onChange={(event) => setShownId(event.target.value)}>
            {runs.map((candidate) => <option key={candidate.id} value={candidate.id}>{runLabel(candidate)}</option>)}
          </select>
          {editable && shown?.result !== undefined && (
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={recorded} onClick={useAsRecord}>{recorded ? "Value of record" : "Use as value of record"}</button>
          )}
        </div>
      )}
      <div className="esq-table-wrap">
        {shown === undefined || entry === undefined ? (
          <p className="posmuted">{workbookId === null ? "Runs are kept with a saved workbook." : "No run of this cell yet."}</p>
        ) : (
          <RunResult run={shown} cell={entry.cell} />
        )}
        <ValuesTable view={view} />
      </div>
    </div>
  );
}

function BarrierScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const view = useMemo(() => barriersViewOf(esq), [esq]);
  const hazardsShown = (view?.hazards.length ?? 0) > 0;
  const [tab, setTab] = useState<BarrierTab>("barriers");
  const tabId = useId();
  const active: BarrierTab = tab === "hazards" && !hazardsShown ? "barriers" : tab;
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: BarrierTab; label: string }[] = [
    { id: "barriers", label: `Barriers${count(view?.barriers.length ?? 0)}` },
    { id: "phenomena", label: `Phenomena${count(view?.mechanisms.length ?? 0)}` },
    { id: "capacity", label: `Capacity${count(view?.cells.length ?? 0)}` },
    ...(hazardsShown ? [{ id: "hazards" as const, label: `Hazards${count(view?.hazardCells.length ?? 0)}` }] : []),
    { id: "credits", label: `Credits${count(view?.credits.length ?? 0)}` },
    { id: "results", label: "Results" },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[active];

  function addBarrier(): void {
    const id = nextBarrierId(esq);
    mutateEsq((draft) => withBarrierEntry(draft, id, { barrierId: id, manual: { name: "", source: "", sourceNames: [] }, modes: [] }));
    openWindow({ kind: "esqBarrier", id });
  }

  function addMechanism(): void {
    const barrier = view?.barriers[0];
    if (barrier === undefined) return;
    const id = nextMechanismId(esq);
    mutateEsq((draft) => withMechanism(draft, id, { id, barrierId: barrier.id, modeIds: [], kind: "PHENOMENON", name: "", familyIds: [], basis: "" }));
    openWindow({ kind: "esqMechanism", id });
  }

  function addCell(hazard: boolean): void {
    const barrier = view?.barriers.find((candidate) => candidate.modes.length > 0);
    const mode = barrier?.modes[0];
    if (barrier === undefined || mode === undefined) return;
    const id = nextCellId(esq);
    const base: EsqCell = {
      id,
      barrierId: barrier.id,
      modeId: mode.id,
      mechanismIds: [],
      variable: "",
      unit: "",
      basis: esq.capabilityCategory === "CC-I" ? "CONSERVATIVE" : "REALISTIC",
      use: "SPLIT_FRACTION",
    };
    const hazardGroup = view?.hazards[0];
    const cell: EsqCell = hazard && hazardGroup !== undefined ? { ...base, hazardGroup } : base;
    mutateEsq((draft) => withCell(draft, id, cell));
    openWindow({ kind: "esqCell", id });
  }

  function addCredit(kind: EsqCredit["kind"]): void {
    const id = nextCreditId(esq);
    mutateEsq((draft) => withCredit(draft, id, { id, kind, name: "", familyIds: [], environment: "", beyondQualification: false, credited: false, analysis: "", basis: "" }));
    openWindow({ kind: "esqCredit", id });
  }

  const canAddCell = view !== undefined && view.barriers.some((barrier) => barrier.modes.length > 0);

  return (
    <div className="esq-step">
      <EsqTabs label="Barrier sections" tabs={tabs} active={active} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${active}`} tabIndex={0} className="esq-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {editable && view !== undefined && active === "barriers" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addBarrier}>Add barrier</button>}
              {editable && view !== undefined && active === "phenomena" && view.barriers.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMechanism}>Add mechanism</button>}
              {editable && canAddCell && active === "capacity" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addCell(false)}>Add cell</button>}
              {editable && canAddCell && active === "hazards" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addCell(true)}>Add hazard cell</button>}
              {editable && view !== undefined && active === "credits" && (
                <>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => addCredit("ACTION")}>Add action credit</button>
                  <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addCredit("EQUIPMENT")}>Add equipment credit</button>
                </>
              )}
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : active === "barriers" ? (
            <BarriersTable view={view} openWindow={openWindow} />
          ) : active === "phenomena" ? (
            <MechanismsTable view={view} openWindow={openWindow} />
          ) : active === "capacity" ? (
            <>
              {!canAddCell && <p className="posmuted">Give a barrier its failure modes first.</p>}
              <CellsTable entries={view.cells} hazard={false} openWindow={openWindow} />
            </>
          ) : active === "hazards" ? (
            <CellsTable entries={view.hazardCells} hazard openWindow={openWindow} />
          ) : active === "credits" ? (
            <CreditsTable view={view} openWindow={openWindow} />
          ) : active === "results" ? (
            <ResultsPanel view={view} />
          ) : (
            <ChecksTable findings={view.findings} openWindow={openWindow} />
          )}
        </div>
        {view !== undefined && active === "phenomena" && <LogicCard logic={view.logic} />}
      </div>
    </div>
  );
}

function TextRow({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id}>
      <WorkbookInput id={id} className="posfield__input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function AreaRow({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function NumberRow({ label, value, unit, disabled, onChange }: { label: string; value: number | undefined; unit?: string; disabled: boolean; onChange: (value: number | undefined) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id}>
      <WorkbookInput id={id} type="number" className="posfield__input esq-form__number" value={value ?? ""} disabled={disabled} onChange={(event) => signedFrom(event.target.value, onChange)} />
      {unit !== undefined && unit.length > 0 && <span className="esq-form__unit">{unit}</span>}
    </FormRow>
  );
}

function BarrierWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = barriersViewOf(esq);
  const barrier = view?.barriers.find((candidate) => candidate.id === id);
  if (view === undefined || barrier === undefined) return null;
  const entry: EsqBarrierEntry = barrier.entry ?? { barrierId: id, modes: [] };
  const dis = !editable;

  function save(next: EsqBarrierEntry): void {
    if (!editable) return;
    mutateEsq((draft) => withBarrierEntry(draft, id, next));
  }

  function setMode(index: number, next: EsqBarrierMode): void {
    save({ ...entry, modes: entry.modes.map((mode, position) => (position === index ? next : mode)) });
  }

  const manual = entry.manual;
  const sourceOptions = view.sources.map((name) => ({ value: name, label: name }));

  return (
    <>
      <ModalHead cap={`Barrier · ${barrier.manual ? "by hand" : "POS"} · ESQ-C10 · C12`} title={barrier.name} onClose={onClose} />
      <div className="modal__body esq-form">
        {manual !== undefined && (
          <>
            <TextRow label="Name" value={manual.name} disabled={dis} onChange={(name) => save({ ...entry, manual: { ...manual, name } })} />
            <AreaRow label="Source" value={manual.source} disabled={dis} onChange={(source) => save({ ...entry, manual: { ...manual, source } })} />
            <ChecksRow label="Holds" options={sourceOptions} selected={manual.sourceNames} disabled={dis} onChange={(sourceNames) => save({ ...entry, manual: { ...manual, sourceNames } })} />
          </>
        )}
        {manual === undefined && <p className="esq-meta">{`POS lists ${barrier.name} for ${barrier.sourceNames.length === 0 ? "no source" : listValue(barrier.sourceNames)}.`}</p>}
        <FormRow label="SC criterion" htmlFor={`${fieldId}-criterion`}>
          <select id={`${fieldId}-criterion`} className="posfield__select" value={entry.criterionId ?? ""} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { criterionId: _old, ...rest } = entry;
            save(value.length === 0 ? rest : { ...rest, criterionId: value });
          }}>
            <option value="">None</option>
            {view.criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{`${criterion.id} · ${criterion.parameters[0]?.parameter ?? criterion.barrierRef}`}</option>)}
          </select>
        </FormRow>
        {barrier.criterion !== undefined && (
          <p className="esq-meta">{`${barrier.criterion.parameters.map((parameter) => `${parameter.parameter}: ${parameter.criterion}.`).join(" ")} Capacity from ${listValue(barrier.criterion.capacityParameters)}. ${barrier.criterion.method === "REALISTIC" ? "Evaluated realistically." : "Evaluated conservatively."}`}</p>
        )}
        <ChecksRow label="IE barrier" options={view.impactRefs.map((ref) => ({ value: ref, label: ref }))} selected={entry.impactRefs ?? []} disabled={dis} onChange={(impactRefs) => {
          const { impactRefs: _old, ...rest } = entry;
          save(impactRefs.length === 0 ? rest : { ...rest, impactRefs });
        }} />
        {entry.modes.map((mode, index) => (
          <fieldset key={mode.id} className="esq-use">
            <legend className="esq-use__legend">{`${mode.id} · ${MODE_KIND_LABELS[mode.kind]}`}</legend>
            <TextRow label="Mode" value={mode.name} disabled={dis} onChange={(name) => setMode(index, { ...mode, name })} />
            <FormRow label="Kind" htmlFor={`${fieldId}-kind-${mode.id}`}>
              <select id={`${fieldId}-kind-${mode.id}`} className="posfield__select" value={mode.kind} disabled={dis} onChange={(event) => setMode(index, { ...mode, kind: event.target.value === "LOCALIZED" ? "LOCALIZED" : "GROSS" })}>
                <option value="GROSS">Gross</option>
                <option value="LOCALIZED">Localized</option>
              </select>
            </FormRow>
            <TextRow label="Location" value={mode.location} disabled={dis} onChange={(location) => setMode(index, { ...mode, location })} />
            {editable && <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => save({ ...entry, modes: entry.modes.filter((_, position) => position !== index) })}>Remove this mode</button>}
          </fieldset>
        ))}
        {editable && (
          <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => {
            const kind = entry.modes.some((mode) => mode.kind === "GROSS") && !entry.modes.some((mode) => mode.kind === "LOCALIZED") ? "LOCALIZED" : "GROSS";
            save({ ...entry, modes: [...entry.modes, { id: nextModeId(esq), name: "", kind, location: "" }] });
          }}>Add failure mode</button>
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && barrier.manual && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withBarrierEntry(draft, id, undefined)); onClose(); }}>Remove barrier</button>
        )}
      </FormFoot>
    </>
  );
}

function MechanismWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = barriersViewOf(esq);
  const entry = view?.mechanisms.find((candidate) => candidate.mechanism.id === id);
  if (view === undefined || entry === undefined) return null;
  const mechanism = entry.mechanism;
  const barrier = entry.barrier;
  const dis = !editable;

  function save(next: EsqMechanism): void {
    if (!editable) return;
    mutateEsq((draft) => withMechanism(draft, id, next));
  }

  const status = mechanism.screening === undefined ? "RETAINED" : mechanism.screening.criterion;

  return (
    <>
      <ModalHead cap={`Mechanism · ${MECHANISM_KIND_LABELS[mechanism.kind]} · ESQ-C12 · C13`} title={blank(mechanism.name) ? id : `${id} · ${mechanism.name}`} onClose={onClose} />
      <div className="modal__body esq-form">
        <TextRow label="Name" value={mechanism.name} disabled={dis} onChange={(name) => save({ ...mechanism, name })} />
        <FormRow label="Kind" htmlFor={`${fieldId}-kind`}>
          <select id={`${fieldId}-kind`} className="posfield__select" value={mechanism.kind} disabled={dis} onChange={(event) => {
            const kind = event.target.value === "DEGRADATION" ? "DEGRADATION" : event.target.value === "HAZARD" ? "HAZARD" : "PHENOMENON";
            const { hazardGroup: _old, ...rest } = mechanism;
            const hazardGroup = view.hazards[0];
            save(kind === "HAZARD" && hazardGroup !== undefined ? { ...rest, kind, hazardGroup } : { ...rest, kind });
          }}>
            <option value="PHENOMENON">Phenomenon that challenges the barrier</option>
            <option value="DEGRADATION">Degradation that weakens the barrier</option>
            <option value="HAZARD">External hazard mechanism</option>
          </select>
        </FormRow>
        {mechanism.kind === "HAZARD" && (
          <FormRow label="Hazard group" htmlFor={`${fieldId}-hazard`}>
            <select id={`${fieldId}-hazard`} className="posfield__select" value={mechanism.hazardGroup ?? ""} disabled={dis} onChange={(event) => save({ ...mechanism, hazardGroup: event.target.value })}>
              {mechanism.hazardGroup !== undefined && !view.hazards.includes(mechanism.hazardGroup) && <option value={mechanism.hazardGroup}>{`${mechanism.hazardGroup} · out of scope`}</option>}
              {view.hazards.length === 0 && mechanism.hazardGroup === undefined && <option value="">No external hazard in scope</option>}
              {view.hazards.map((hazard) => <option key={hazard} value={hazard}>{hazard}</option>)}
            </select>
          </FormRow>
        )}
        <FormRow label="Barrier" htmlFor={`${fieldId}-barrier`}>
          <select id={`${fieldId}-barrier`} className="posfield__select" value={mechanism.barrierId} disabled={dis} onChange={(event) => save({ ...mechanism, barrierId: event.target.value, modeIds: [] })}>
            {barrier === undefined && <option value={mechanism.barrierId}>{`${mechanism.barrierId} · missing`}</option>}
            {view.barriers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </FormRow>
        <ChecksRow label="Failure modes" options={(barrier?.modes ?? []).map((mode) => ({ value: mode.id, label: modeLabel(mode) }))} selected={mechanism.modeIds} disabled={dis} onChange={(modeIds) => save({ ...mechanism, modeIds })} />
        {mechanism.kind !== "HAZARD" && (
          <ChecksRow label="Families" options={view.families.map((family) => ({ value: family.id, label: family.id }))} selected={mechanism.familyIds} disabled={dis} onChange={(familyIds) => save({ ...mechanism, familyIds })} />
        )}
        <FormRow label="Status" htmlFor={`${fieldId}-status`}>
          <select id={`${fieldId}-status`} className="posfield__select" value={status} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { screening: _old, ...rest } = mechanism;
            save(value === "SCR-2" || value === "SCR-3" ? { ...rest, screening: { criterion: value, basis: mechanism.screening?.basis ?? "" } } : rest);
          }}>
            <option value="RETAINED">Retained</option>
            <option value="SCR-2">Screened by SCR-2</option>
            <option value="SCR-3">Screened by SCR-3</option>
          </select>
        </FormRow>
        {mechanism.screening !== undefined && (
          <AreaRow label="Screening basis" value={mechanism.screening.basis} disabled={dis} onChange={(basis) => save({ ...mechanism, screening: { criterion: mechanism.screening?.criterion ?? "SCR-2", basis } })} />
        )}
        <ChecksRow label="Credited equipment" options={view.systems.map((system) => ({ value: system, label: system }))} selected={mechanism.equipment ?? []} disabled={dis} onChange={(equipment) => {
          const { equipment: _old, ...rest } = mechanism;
          save(equipment.length === 0 ? rest : { ...rest, equipment });
        }} />
        {(mechanism.equipment ?? []).length > 0 && (
          <AreaRow label="Dependency" value={mechanism.dependency ?? ""} disabled={dis} onChange={(dependency) => save({ ...mechanism, dependency })} />
        )}
        <AreaRow label="Basis" value={mechanism.basis} disabled={dis} onChange={(basis) => save({ ...mechanism, basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withMechanism(draft, id, undefined)); onClose(); }}>Remove mechanism</button>}
      </FormFoot>
    </>
  );
}

function VariableRows({ variable, options, disabled, onChange }: { variable: AleatoryVariable; options: readonly ParameterOption[]; disabled: boolean; onChange: (next: AleatoryVariable) => void }): JSX.Element {
  const names = lawFieldNames(variable.law);
  return (
    <>
      <LawEditor law={variable.law} unit="QUANTITY" disabled={disabled} onChange={(law) => {
        const allowed = lawFieldNames(law);
        onChange({ law, fields: variable.fields.filter((entry) => allowed.includes(entry.field)) });
      }} />
      {names.length > 0 && (
        <ChecksRow label="Uncertain fields" options={names.map((name) => ({ value: name, label: fieldLabel(name) }))} selected={variable.fields.map((entry) => entry.field)} disabled={disabled} onChange={(selected) => onChange({
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
      {variable.fields.length > 0 && <p className="esq-meta">PRAXIS sets each uncertain field from its own law in every trial.</p>}
      {variable.fields.map((entry) => (
        <fieldset key={entry.field} className="esq-use">
          <legend className="esq-use__legend">{fieldLabel(entry.field)}</legend>
          <ExpressionEditor expression={entry.value} unit="QUANTITY" options={options} disabled={disabled} onChange={(value) => onChange({ law: variable.law, fields: variable.fields.map((current) => (current.field === entry.field ? { field: entry.field, value } : current)) })} />
        </fieldset>
      ))}
    </>
  );
}

function SideRows({ label, side, unit, capacity, disabled, onChange }: { label: string; side: EsqCellSide | undefined; unit: string; capacity: boolean; disabled: boolean; onChange: (next: EsqCellSide) => void }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const id = useId();
  const parameters = (esq.model?.parameters ?? []).filter((parameter) => holdsEstimate(parameter.quantificationModel) && parameter.estimate?.node === "VALUE");
  const fieldOptions = useMemo(() => daOptions(esq, ["QUANTITY", "FACTOR"], "QUANTITY"), [esq]);
  const from = side === undefined ? "" : side.source === "FRAGILITY" ? "fragility" : side.source === "DA" ? `da:${side.parameterId}` : "typed";
  const basis = side?.basis ?? "";
  const center = side?.source === "FRAGILITY" ? side.fragility.median : side?.source === "TYPED" && side.variable.law.family === "POINT" ? side.variable.law.value : 1;
  return (
    <fieldset className="esq-use">
      <legend className="esq-use__legend">{label}</legend>
      <FormRow label="From" htmlFor={`${id}-from`}>
        <select id={`${id}-from`} className="posfield__select" value={from} disabled={disabled} onChange={(event) => {
          const value = event.target.value;
          if (value === "fragility") onChange({ source: "FRAGILITY", fragility: { median: center > 0 ? center : 1, betaR: 0.25, betaU: 0.3 }, basis });
          else if (value.startsWith("da:")) onChange({ source: "DA", parameterId: value.slice(3), basis });
          else if (value === "typed") onChange({ source: "TYPED", variable: { law: { family: "POINT", value: center }, fields: [] }, basis });
        }}>
          {side === undefined && <option value="">Not set</option>}
          <option value="typed">Typed in ESQ</option>
          {(capacity || side?.source === "FRAGILITY") && <option value="fragility">Fragility (median and betas)</option>}
          {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`DA · ${parameter.id} · ${parameter.name}`}</option>)}
          {side?.source === "DA" && !parameters.some((parameter) => parameter.id === side.parameterId) && <option value={`da:${side.parameterId}`}>{`DA · ${side.parameterId} · not imported`}</option>}
        </select>
      </FormRow>
      {side?.source === "FRAGILITY" && (
        <>
          <NumberRow label="Median capacity" value={side.fragility.median} unit={unit} disabled={disabled} onChange={(median) => { if (median !== undefined) onChange({ ...side, fragility: { ...side.fragility, median } }); }} />
          <NumberRow label="Randomness beta" value={side.fragility.betaR} disabled={disabled} onChange={(betaR) => { if (betaR !== undefined) onChange({ ...side, fragility: { ...side.fragility, betaR } }); }} />
          <NumberRow label="Uncertainty beta" value={side.fragility.betaU} disabled={disabled} onChange={(betaU) => { if (betaU !== undefined) onChange({ ...side, fragility: { ...side.fragility, betaU } }); }} />
          <p className="esq-meta">PRAXIS fits the lognormal capacity and the law of its median from the betas.</p>
        </>
      )}
      {side?.source === "DA" && (
        <FormRow label="DA law">
          <span className="esq-form__note">{(() => {
            const estimate = parameters.find((parameter) => parameter.id === side.parameterId)?.estimate;
            return estimate?.node === "VALUE" ? lawText(estimate.value.law) : "Not imported";
          })()}</span>
        </FormRow>
      )}
      {side?.source === "TYPED" && <VariableRows variable={side.variable} options={fieldOptions} disabled={disabled} onChange={(variable) => onChange({ ...side, variable })} />}
      {side !== undefined && (
        <FormRow label="Basis" htmlFor={`${id}-basis`} top>
          <WorkbookTextarea id={`${id}-basis`} className="posfield__textarea" rows={2} fitContent value={side.basis} disabled={disabled} onChange={(event) => onChange({ ...side, basis: event.target.value })} />
        </FormRow>
      )}
    </fieldset>
  );
}

function CellWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = barriersViewOf(esq);
  const entry = [...(view?.cells ?? []), ...(view?.hazardCells ?? [])].find((candidate) => candidate.cell.id === id);
  if (view === undefined || entry === undefined) return null;
  const cell = entry.cell;
  const hazard = cell.hazardGroup !== undefined;
  const barrier = entry.barrier;
  const dis = !editable;
  const mechanisms = view.mechanisms.filter((candidate) => candidate.mechanism.barrierId === cell.barrierId && (hazard ? candidate.mechanism.kind === "HAZARD" : candidate.mechanism.kind !== "HAZARD"));
  const label = parameterLabelOf(esq);
  const probabilityOptions = daOptions(esq, ["PROBABILITY"], "PROBABILITY");

  function save(next: EsqCell): void {
    if (!editable) return;
    mutateEsq((draft) => withCell(draft, id, next));
  }

  return (
    <>
      <ModalHead cap={`Load and capacity · ${hazard ? "ESQ-C15" : "ESQ-A3 · C5 · C14"}`} title={`${id} · ${cellTitle(entry)}`} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Barrier" htmlFor={`${fieldId}-barrier`}>
          <select id={`${fieldId}-barrier`} className="posfield__select" value={cell.barrierId} disabled={dis} onChange={(event) => {
            const next = view.barriers.find((candidate) => candidate.id === event.target.value);
            save({ ...cell, barrierId: event.target.value, modeId: next?.modes[0]?.id ?? "", mechanismIds: [] });
          }}>
            {barrier === undefined && <option value={cell.barrierId}>{`${cell.barrierId} · missing`}</option>}
            {view.barriers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </FormRow>
        <FormRow label="Failure mode" htmlFor={`${fieldId}-mode`}>
          <select id={`${fieldId}-mode`} className="posfield__select" value={cell.modeId} disabled={dis} onChange={(event) => save({ ...cell, modeId: event.target.value })}>
            {entry.mode === undefined && <option value={cell.modeId}>{cell.modeId.length === 0 ? "None" : `${cell.modeId} · missing`}</option>}
            {(barrier?.modes ?? []).map((mode) => <option key={mode.id} value={mode.id}>{`${modeLabel(mode)} · ${MODE_KIND_LABELS[mode.kind].toLowerCase()}`}</option>)}
          </select>
        </FormRow>
        {hazard ? (
          <FormRow label="Hazard group" htmlFor={`${fieldId}-hazard`}>
            <select id={`${fieldId}-hazard`} className="posfield__select" value={cell.hazardGroup ?? ""} disabled={dis} onChange={(event) => save({ ...cell, hazardGroup: event.target.value })}>
              {cell.hazardGroup !== undefined && !view.hazards.includes(cell.hazardGroup) && <option value={cell.hazardGroup}>{`${cell.hazardGroup} · out of scope`}</option>}
              {view.hazards.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </FormRow>
        ) : (
          <FormRow label="Family" htmlFor={`${fieldId}-family`}>
            <select id={`${fieldId}-family`} className="posfield__select" value={cell.familyId ?? ""} disabled={dis} onChange={(event) => {
              const value = event.target.value;
              const { familyId: _old, ...rest } = cell;
              save(value.length === 0 ? rest : { ...rest, familyId: value });
            }}>
              <option value="">Not chosen</option>
              {cell.familyId !== undefined && !view.families.some((family) => family.id === cell.familyId) && <option value={cell.familyId}>{`${cell.familyId} · missing`}</option>}
              {view.families.map((family) => <option key={family.id} value={family.id}>{family.name.length > 0 ? `${family.id} · ${family.name}` : family.id}</option>)}
            </select>
          </FormRow>
        )}
        <ChecksRow label="Mechanisms" options={mechanisms.map((candidate) => ({ value: candidate.mechanism.id, label: blank(candidate.mechanism.name) ? candidate.mechanism.id : candidate.mechanism.name }))} selected={cell.mechanismIds} disabled={dis} onChange={(mechanismIds) => save({ ...cell, mechanismIds })} />
        <TextRow label="Variable" value={cell.variable} disabled={dis} onChange={(variable) => save({ ...cell, variable })} />
        <TextRow label="Unit" value={cell.unit} disabled={dis} onChange={(unit) => save({ ...cell, unit })} />
        <FormRow label="Basis" htmlFor={`${fieldId}-basis`}>
          <select id={`${fieldId}-basis`} className="posfield__select" value={cell.basis} disabled={dis} onChange={(event) => save({ ...cell, basis: event.target.value === "CONSERVATIVE" ? "CONSERVATIVE" : "REALISTIC" })}>
            <option value="CONSERVATIVE">Conservative (CC-I)</option>
            <option value="REALISTIC">Realistic (CC-II)</option>
          </select>
        </FormRow>
        <SideRows label={hazard ? "Load · hazard demand" : "Load · the challenge"} side={cell.load} unit={cell.unit} capacity={false} disabled={dis} onChange={(load) => save({ ...cell, load })} />
        <SideRows label={hazard ? "Capacity · fragility" : "Capacity"} side={cell.capacity} unit={cell.unit} capacity disabled={dis} onChange={(capacity) => save({ ...cell, capacity })} />
        <AreaRow label="In-service aging" value={cell.aging ?? ""} disabled={dis} onChange={(aging) => {
          const { aging: _old, ...rest } = cell;
          save(aging.trim().length === 0 ? rest : { ...rest, aging });
        }} />
        <FormRow label="Goes to" htmlFor={`${fieldId}-use`}>
          <select id={`${fieldId}-use`} className="posfield__select" value={cell.use} disabled={dis} onChange={(event) => save({ ...cell, use: event.target.value === "END_STATE_ATTRIBUTE" ? "END_STATE_ATTRIBUTE" : "SPLIT_FRACTION" })}>
            <option value="SPLIT_FRACTION">Split fraction on a branch</option>
            <option value="END_STATE_ATTRIBUTE">End-state attribute for MS</option>
          </select>
        </FormRow>
        {cell.use === "SPLIT_FRACTION" && <p className="esq-meta">{entry.usedBy.length === 0 ? "No Step 02 function takes this cell yet." : `Step 02 takes this cell for ${listValue(entry.usedBy)}.`}</p>}
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Typed value</legend>
          {cell.typed === undefined ? (
            !dis && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save({ ...cell, typed: { expression: probability(cell.run?.point ?? DEFAULT_PROBABILITY), basis: "" } })}>Type a value</button>
          ) : (
            <>
              <ExpressionEditor expression={cell.typed.expression} unit="PROBABILITY" options={probabilityOptions} disabled={dis} onChange={(expression) => { if (cell.typed !== undefined) save({ ...cell, typed: { ...cell.typed, expression } }); }} />
              <AreaRow label="Source" value={cell.typed.basis} disabled={dis} onChange={(basis) => { if (cell.typed !== undefined) save({ ...cell, typed: { ...cell.typed, basis } }); }} />
              {!dis && <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => {
                const { typed: _typed, ...rest } = cell;
                const { ofRecord: _record, ...without } = rest;
                save(cell.ofRecord === "TYPED" ? without : rest);
              }}>Remove the typed value</button>}
            </>
          )}
        </fieldset>
        <FormRow label="Value of record" htmlFor={`${fieldId}-record`}>
          <select id={`${fieldId}-record`} className="posfield__select" value={cell.ofRecord ?? ""} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { ofRecord: _old, ...rest } = cell;
            save(value === "RUN" || value === "TYPED" ? { ...rest, ofRecord: value } : rest);
          }}>
            <option value="">Not chosen</option>
            <option value="RUN" disabled={cell.run === undefined}>{cell.run === undefined ? "PRAXIS run, none kept yet" : `PRAXIS run · ${sciText(cell.run.mean ?? cell.run.point)}`}</option>
            <option value="TYPED" disabled={cell.typed === undefined}>{cell.typed === undefined ? "Typed, none entered" : `Typed · ${expressionText(cell.typed.expression, label)}`}</option>
          </select>
        </FormRow>
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Pre-operational assumption</legend>
          <AreaRow label="Design calculation" value={cell.assumption?.calculation ?? ""} disabled={dis} onChange={(calculation) => {
            const { assumption: _old, ...rest } = cell;
            const closure = cell.assumption?.closure ?? "";
            save(calculation.trim().length === 0 && closure.trim().length === 0 ? rest : { ...rest, assumption: { calculation, closure } });
          }} />
          <AreaRow label="How it closes" value={cell.assumption?.closure ?? ""} disabled={dis} onChange={(closure) => {
            const { assumption: _old, ...rest } = cell;
            const calculation = cell.assumption?.calculation ?? "";
            save(calculation.trim().length === 0 && closure.trim().length === 0 ? rest : { ...rest, assumption: { calculation, closure } });
          }} />
        </fieldset>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withCell(draft, id, undefined)); onClose(); }}>Remove cell</button>}
      </FormFoot>
    </>
  );
}

function CreditWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = barriersViewOf(esq);
  const entry = view?.credits.find((candidate) => candidate.credit.id === id);
  if (view === undefined || entry === undefined) return null;
  const credit = entry.credit;
  const dis = !editable;
  const equipment = credit.kind === "EQUIPMENT";

  function save(next: EsqCredit): void {
    if (!editable) return;
    mutateEsq((draft) => withCredit(draft, id, next));
  }

  const feasibility: EsqActionFeasibility = credit.feasibility ?? { procedure: false, training: false, cues: false, crew: false, time: false, access: false, equipment: false };
  const action = entry.action;
  const timing = action === undefined ? [] : [
    action.cueMinutes === undefined ? "" : `cue at ${action.cueMinutes} min`,
    action.availableMinutes === undefined ? "" : `${action.availableMinutes} min available`,
    action.requiredMinutes === undefined ? "" : `${action.requiredMinutes} min required`,
  ].filter((part) => part.length > 0);

  return (
    <>
      <ModalHead cap={`Credit · ${equipment ? "equipment · ESQ-C8 · C9" : "action · ESQ-C7 · C8"}`} title={blank(credit.name) ? id : `${id} · ${credit.name}`} onClose={onClose} />
      <div className="modal__body esq-form">
        {equipment ? (
          <FormRow label="SY record" htmlFor={`${fieldId}-record`}>
            <select id={`${fieldId}-record`} className="posfield__select" value={credit.qualificationId ?? ""} disabled={dis} onChange={(event) => {
              const record = view.qualifications.find((candidate) => candidate.id === event.target.value);
              const { qualificationId: _old, ...rest } = credit;
              if (record === undefined) { save(rest); return; }
              save({
                ...rest,
                qualificationId: record.id,
                name: blank(credit.name) ? listValue(record.components.length > 0 ? record.components : [record.systemId]) : credit.name,
                environment: blank(credit.environment) ? record.condition : credit.environment,
                beyondQualification: record.beyondQualification,
              });
            }}>
              <option value="">None</option>
              {view.qualifications.map((record) => <option key={record.id} value={record.id}>{`${record.id} · ${record.systemId}${record.beyondQualification ? " · beyond qualification" : ""}`}</option>)}
            </select>
          </FormRow>
        ) : (
          <FormRow label="HR event" htmlFor={`${fieldId}-action`}>
            <select id={`${fieldId}-action`} className="posfield__select" value={credit.actionId ?? ""} disabled={dis} onChange={(event) => {
              const record = view.actions.find((candidate) => candidate.id === event.target.value);
              const { actionId: _old, ...rest } = credit;
              if (record === undefined) { save(rest); return; }
              save({ ...rest, actionId: record.id, name: blank(credit.name) ? record.name : credit.name, ...(record.feasibility === undefined ? {} : { feasibility: record.feasibility }) });
            }}>
              <option value="">None</option>
              {view.actions.map((record) => <option key={record.id} value={record.id}>{`${record.id} · ${record.name}`}</option>)}
            </select>
          </FormRow>
        )}
        {action !== undefined && <p className="esq-meta">{[`HEP ${action.hep === undefined ? "—" : expressionText(action.hep)}`, ...timing, action.recoveryName === undefined ? "" : `HR recovery ${action.recoveryId ?? ""} ${action.recoveryName}`, action.feasibilityNote ?? ""].filter((part) => part.trim().length > 0).join(". ")}.</p>}
        {entry.qualification !== undefined && <p className="esq-meta">{entry.qualification.condition}</p>}
        <TextRow label="Name" value={credit.name} disabled={dis} onChange={(name) => save({ ...credit, name })} />
        <ChecksRow label="Families" options={view.families.map((family) => ({ value: family.id, label: family.id }))} selected={credit.familyIds} disabled={dis} onChange={(familyIds) => save({ ...credit, familyIds })} />
        <AreaRow label="Conditions" value={credit.environment} disabled={dis} onChange={(environment) => save({ ...credit, environment })} />
        <FormRow label="Qualification" htmlFor={`${fieldId}-beyond`}>
          <select id={`${fieldId}-beyond`} className="posfield__select" value={credit.beyondQualification ? "beyond" : "within"} disabled={dis} onChange={(event) => save({ ...credit, beyondQualification: event.target.value === "beyond" })}>
            <option value="within">Within its qualification limits</option>
            <option value="beyond">Beyond its qualification limits</option>
          </select>
        </FormRow>
        {!equipment && (
          <>
            <FormRow label="Treatment" htmlFor={`${fieldId}-treatment`}>
              <select id={`${fieldId}-treatment`} className="posfield__select" value={credit.treatment ?? ""} disabled={dis} onChange={(event) => {
                const value = event.target.value;
                const { treatment: _old, ...rest } = credit;
                save(value === "CONSERVATIVE" || value === "DETAILED" ? { ...rest, treatment: value } : rest);
              }}>
                <option value="">Not chosen</option>
                <option value="CONSERVATIVE">Conservative (CC-I)</option>
                <option value="DETAILED">Detailed (CC-II)</option>
              </select>
            </FormRow>
            <ChecksRow label="Feasibility shown" options={FEASIBILITY_KEYS.map((key) => ({ value: key, label: FEASIBILITY_LABELS[key] }))} selected={FEASIBILITY_KEYS.filter((key) => feasibility[key])} disabled={dis} onChange={(keys) => save({ ...credit, feasibility: { procedure: keys.includes("procedure"), training: keys.includes("training"), cues: keys.includes("cues"), crew: keys.includes("crew"), time: keys.includes("time"), access: keys.includes("access"), equipment: keys.includes("equipment") } })} />
          </>
        )}
        <AreaRow label={equipment ? "Survivability analysis" : "Feasibility record"} value={credit.analysis} disabled={dis} onChange={(analysis) => save({ ...credit, analysis })} />
        <FormRow label="Decision" htmlFor={`${fieldId}-credited`}>
          <select id={`${fieldId}-credited`} className="posfield__select" value={credit.credited ? "yes" : "no"} disabled={dis} onChange={(event) => save({ ...credit, credited: event.target.value === "yes" })}>
            <option value="no">Not credited</option>
            <option value="yes">Credited</option>
          </select>
        </FormRow>
        <AreaRow label="Basis" value={credit.basis} disabled={dis} onChange={(basis) => save({ ...credit, basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withCredit(draft, id, undefined)); onClose(); }}>Remove credit</button>}
      </FormFoot>
    </>
  );
}

function BarrierWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqBarrier": return <BarrierWindow id={context.id} onClose={onClose} />;
    case "esqMechanism": return <MechanismWindow id={context.id} onClose={onClose} />;
    case "esqCell": return <CellWindow id={context.id} onClose={onClose} />;
    case "esqCredit": return <CreditWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { BarrierScreen, BarrierWindows, BARRIER_WINDOW_KINDS, BARRIER_WINDOW_LABELS };
export type { EsqBarrierView };
