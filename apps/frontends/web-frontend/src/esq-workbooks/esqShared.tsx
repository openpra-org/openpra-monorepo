import { JSX, ReactNode, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { EsqModel, EsqSolveRun, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { sampledInputsOf } from "interfaces-mef-types/esq/esq-measure-inputs";
import { esqTreeRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods";
import { cancelAnalysisRun, runProgressText, type RunProgressListener } from "../newly-developed-methods/shared/analysisRunWait";
import { getEsqRunDetails } from "./esqWorkbookApi";
import { useEsqWorkbook } from "./esqWorkbookContext";
import type { UncertainExpression, UncertainParameter, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyExpressionSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { parametersFor, useExpressionSummaries, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { PAGE, Pager as EsPager, paged } from "../es-workbooks/EsTiming";
import type { EsqSolveWindowKind } from "./esqSolve";
import type { EsqResultsWindowKind } from "./esqResults";
import type { EsqUncertaintyWindowKind } from "./esqUncertainty";
import type { EsqSensitivityWindowKind } from "./esqSensitivity";
import type { EsqHandoffWindowKind } from "./esqHandoff";
import { ESQIcon } from "./esqIcons";
import "./css/esqDialog.css";

interface EsqWindowContext {
  kind:
    | EsqSolveWindowKind
    | EsqResultsWindowKind
    | EsqUncertaintyWindowKind
    | EsqSensitivityWindowKind
    | EsqHandoffWindowKind;
  id: string;
}

const LIST_PAGE = 50;

function Pager({ total, page, onPage }: { total: number; page: number; onPage: (page: number) => void }): JSX.Element {
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE));
  const current = Math.min(page, pages - 1);
  const first = current * LIST_PAGE + 1;
  const last = Math.min(total, (current + 1) * LIST_PAGE);
  return (
    <span className="esq-pager">
      <span className="esq-count">{total === 0 ? "None" : `${first} to ${last} of ${total}`}</span>
      {pages > 1 && <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => onPage(current - 1)}>Previous</button>}
      {pages > 1 && <button type="button" className="posnav__btn posnav__btn--sm" disabled={current >= pages - 1} onClick={() => onPage(current + 1)}>Next</button>}
    </span>
  );
}

function pageOf<T>(rows: readonly T[], page: number): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / LIST_PAGE));
  const current = Math.min(page, pages - 1);
  return { current, shown: rows.slice(current * LIST_PAGE, (current + 1) * LIST_PAGE) };
}

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function EsqProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return <span className="esprov">{children}</span>;
}

function FormRow({ label, htmlFor, top = false, children }: { label: string; htmlFor?: string; top?: boolean; children: ReactNode }): JSX.Element {
  return (
    <div className={`esq-form__row${top ? " esq-form__row--top" : ""}`}>
      <label className="posfield__label esq-form__label" htmlFor={htmlFor}>{label}</label>
      <div className="esq-form__control">{children}</div>
    </div>
  );
}

function toggled(list: readonly string[], item: string, on: boolean): string[] {
  return on ? [...list.filter((entry) => entry !== item), item] : list.filter((entry) => entry !== item);
}

function ChecksRow({ label, options, selected, disabled, onChange }: { label: string; options: readonly { value: string; label: string }[]; selected: readonly string[]; disabled: boolean; onChange: (next: string[]) => void }): JSX.Element {
  return (
    <FormRow label={label} top>
      {options.length === 0 ? <span className="esq-form__unit">None available</span> : (
        <div className="esq-form__checks">
          {options.map((option) => (
            <label key={option.value} className="esq-form__check">
              <input type="checkbox" checked={selected.includes(option.value)} disabled={disabled} onChange={(event) => onChange(toggled(selected, option.value, event.target.checked))} />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </FormRow>
  );
}

function FormFoot({ onClose, children }: { onClose: () => void; children?: ReactNode }): JSX.Element {
  return (
    <div className="modal__foot esq-form__foot">
      {children}
      <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary esq-form__done" onClick={onClose}>Done</button>
    </div>
  );
}

function ModalHead({ cap, title, onClose }: { cap: string; title: string; onClose: () => void }): JSX.Element {
  return (
    <div className="modal__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        <h2 className="modal__title">{title}</h2>
      </div>
      <button type="button" className="modal__close" onClick={onClose} aria-label="Close"><ESQIcon.Close /></button>
    </div>
  );
}

function DetailToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }): JSX.Element {
  return (
    <button type="button" className="esq-rowtable__plot" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} the details of ${label}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
      {open ? "Hide" : "Show"}
    </button>
  );
}

function DetailRow({ span, width, children }: { span: number; width: number; children: ReactNode }): JSX.Element {
  return (
    <tr className="esq-rowtable__detail-row">
      <td colSpan={span} className="esq-rowtable__detail">
        <div className="esq-rowtable__detail-inner" style={width > 0 ? { width: `${width}px` } : undefined}>{children}</div>
      </td>
    </tr>
  );
}

function FieldList({ items }: { items: { label: string; value: string }[] }): JSX.Element {
  return (
    <dl className="esq-fields">
      {items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
  );
}

function rowClass(muted: boolean, open: boolean): string | undefined {
  const names = [muted ? "esq-rowtable__muted" : "", open ? "esq-rowtable__row--on" : ""].filter((name) => name.length > 0);
  return names.length === 0 ? undefined : names.join(" ");
}

function useElementWidth(fallback: number): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const start = Math.round(node.getBoundingClientRect().width);
    if (start > 0) setWidth(start);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next !== undefined && next > 0) setWidth(Math.round(next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function EsqTabs<T extends string>({ label, tabs, active, onChange, idBase, className }: {
  label: string;
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  idBase: string;
  className: string;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = tabs.findIndex((t) => t.id === active);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    const next = tabs[nextIndex];
    if (next === undefined) return;
    onChange(next.id);
    ref.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  }

  return (
    <div className={className} role="tablist" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`${idBase}-${t.id}`}
          aria-controls={`${idBase}-panel`}
          aria-selected={t.id === active}
          tabIndex={t.id === active ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface FailedTree {
  treeId: string;
  failure: string | null;
}

interface NetworkOption {
  key: string;
  owner: "ES" | "SY";
  workbookId: string;
  configuration: WorkbookHclConfiguration;
}

function linkedWorkbookId(id: string | undefined): string | undefined {
  return id === undefined || id.length === 0 || id.startsWith("example") ? undefined : id;
}

function trimmedText(text: string | null | undefined): string | undefined {
  return typeof text === "string" && text.trim().length > 0 ? text.trim() : undefined;
}

function networkLabel(option: NetworkOption): string {
  const code = trimmedText(option.configuration.code);
  const name = trimmedText(option.configuration.name);
  return `${option.owner} · ${code !== undefined && name !== undefined && code !== name ? `${code} · ${name}` : code ?? name ?? option.configuration.modelId}`;
}

function networkOptionsOf(esq: EventSequenceQuantification, es: EventSequenceAnalysis | undefined, sy: SystemsAnalysis | undefined): NetworkOption[] {
  const esId = linkedWorkbookId(esq.linkedWorkbooks?.ES);
  const syId = linkedWorkbookId(esq.linkedWorkbooks?.SY);
  const own = (owner: "ES" | "SY", workbookId: string | undefined, configurations: readonly WorkbookHclConfiguration[] | undefined): NetworkOption[] => (workbookId === undefined
    ? []
    : (configurations ?? []).map((configuration) => ({ key: `${workbookId}:${configuration.modelId}`, owner, workbookId, configuration })));
  return [...own("ES", esId, es?.dependencyHclConfigurations), ...own("SY", syId, sy?.dependencyHclConfigurations)];
}

interface Runner {
  running: boolean;
  live: AnalysisRunMetadata | null;
  error: string | null;
  failed: FailedTree[];
  progress: RunProgressListener;
  start: (task: () => Promise<void>) => void;
  fail: (message: string, trees: FailedTree[]) => void;
  failRun: (workbookId: string, run: AnalysisRunMetadata, model: EsqModel | undefined, label?: string) => Promise<void>;
}

type FindingSeverity = "error" | "warning" | "note";

interface FindingRow<K extends string> {
  severity: FindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: K; id: string };
}

const CUT_OFF_EXPONENTS = [-8, -9, -10, -11, -12, -13, -14, -15, -16];

const DEFAULT_EXPONENT = -14;

const SEVERITY_TEXT: Record<FindingSeverity, string> = { error: "Error", warning: "Warning", note: "Note" };

function dateText(at: string): string {
  return new Date(at).toLocaleString();
}

function decade(exponent: number): number {
  return Number(`1e${exponent}`);
}

function exponentOf(run: EsqSolveRun | undefined): number {
  const lowest = run?.basis === "FREQUENCY" ? run.cutOffs?.[run.cutOffs.length - 1] : undefined;
  const exponent = lowest === undefined ? DEFAULT_EXPONENT : Math.round(Math.log10(lowest));
  return CUT_OFF_EXPONENTS.includes(exponent) ? exponent : DEFAULT_EXPONENT;
}

function treeLabel(model: EsqModel, treeId: string): string {
  const tree = model.trees.find((candidate) => candidate.id === treeId);
  if (tree === undefined) return treeId;
  return tree.stateId === undefined ? tree.code : `${tree.code} · ${tree.stateId}`;
}

function failedTrees(summary: { trees: { treeId: string; status: string; failure: string | null }[] }): FailedTree[] {
  return summary.trees.filter((tree) => tree.status === "FAILED").map((tree) => ({ treeId: tree.treeId, failure: tree.failure }));
}

function runFailure(workbookId: string, run: AnalysisRunMetadata, model: EsqModel | undefined): Promise<{ message: string; trees: FailedTree[] }> {
  const message = run.status === "CANCELLED" ? "The run was stopped before it finished." : run.failure?.message ?? "The run did not finish and gave no reason.";
  const treeOf = new Map((model?.trees ?? []).map((tree) => [esqTreeRunId(tree.id), tree.id]));
  return getEsqRunDetails(workbookId, run.id)
    .then((details) => ({
      message,
      trees: (details.members ?? []).flatMap((member) => (member.run.status === "FAILED"
        ? [{ treeId: treeOf.get(member.run.owner.modelId) ?? member.run.owner.modelId, failure: member.run.failure?.message ?? null }]
        : [])),
    }))
    .catch((caught: Error) => ({ message: `${message} The failed event trees could not be listed. ${caught.message}`, trees: [] }));
}

function useRunner(): Runner {
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<AnalysisRunMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedTree[]>([]);
  return {
    running,
    live,
    error,
    failed,
    progress: setLive,
    start: (task) => {
      setRunning(true);
      setLive(null);
      setError(null);
      setFailed([]);
      task()
        .catch((caught: Error) => setError(caught.message))
        .finally(() => {
          setRunning(false);
          setLive(null);
        });
    },
    fail: (message, trees) => {
      setError(message);
      setFailed(trees);
    },
    failRun: (workbookId, run, model, label) => runFailure(workbookId, run, model).then((outcome) => {
      setError(label === undefined ? outcome.message : `${label}: ${outcome.message}`);
      setFailed(outcome.trees);
    }),
  };
}

function RunProgress({ runner }: { runner: Runner }): JSX.Element | null {
  const { runtime, editable } = useEsqWorkbook();
  const live = runner.live;
  if (!runner.running || live === null) return null;
  const text = runProgressText(live);
  const workbookId = runtime.workbookId;
  const active = live.status === "QUEUED" || live.status === "RUNNING";
  return (
    <div className="esq-bar">
      <p className="esq-meta" role="status">{text}</p>
      {editable && active && workbookId !== null && (
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => {
          cancelAnalysisRun("esq", workbookId, live.id).catch((caught: Error) => runner.fail(caught.message, []));
        }}>Stop</button>
      )}
    </div>
  );
}

function RunState({ runner, model, blocked }: { runner: Runner; model: EsqModel; blocked: string | null }): JSX.Element {
  return (
    <>
      <RunProgress runner={runner} />
      {blocked !== null && <p className="esq-run__notice" role="status">{blocked}</p>}
      {runner.error !== null && <p className="esq-run__error" role="alert">{runner.error}</p>}
      {runner.failed.length > 0 && (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Failed event trees">
            <thead><tr><th>Event tree</th><th>Why it failed</th></tr></thead>
            <tbody>
              {runner.failed.map((tree) => (
                <tr key={tree.treeId}>
                  <td className="esq-rowtable__text">{treeLabel(model, tree.treeId)}</td>
                  <td className="esq-rowtable__wrap">{tree.failure ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CutOffField({ id, value, onChange }: { id: string; value: number; onChange: (value: number) => void }): JSX.Element {
  return (
    <label className="esq-run__field esq-run__field--small" htmlFor={id}>
      <span>Cutoff (/yr)</span>
      <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {CUT_OFF_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{`1E${exponent}`}</option>)}
      </select>
    </label>
  );
}

function FindingsTable<K extends string>({ label, findings, openWindow }: { label: string; findings: readonly FindingRow<K>[]; openWindow: (ctx: { kind: K; id: string }) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label={label}>
        <thead><tr><th>Severity</th><th>Check</th><th>Item</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((finding, index) => {
            const target = finding.target;
            return (
              <tr key={`${finding.check}:${finding.item}:${index}`}>
                <td className={`esq-severity esq-severity--${finding.severity}`}>{SEVERITY_TEXT[finding.severity]}</td>
                <td className="esq-rowtable__text">{finding.check}</td>
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

interface CheckOption {
  id: string;
  label: string;
}

interface CheckRow {
  severity: FindingSeverity;
  check: string;
  item: string;
  detail: string;
}

function numberFrom(text: string, apply: (value: number | undefined) => void): void {
  if (text.trim().length === 0) {
    apply(undefined);
    return;
  }
  const value = Number(text);
  if (Number.isFinite(value)) apply(value);
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
  const missing = required && value.trim().length === 0;
  return (
    <div className="posfield posfield-grid--span2">
      <label className="posfield__label" htmlFor={id}>{label}</label>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent aria-invalid={missing} value={value} disabled={!editable} onChange={(event) => onChange(event.target.value)} />
      {missing && <span className="esq-dialog-error" role="alert">Required</span>}
    </div>
  );
}

function NumberField({ label, value, editable, onChange }: { label: string; value: number | undefined; editable: boolean; onChange: (value: number | undefined) => void }): JSX.Element {
  const id = useId();
  return (
    <div className="posfield">
      <label className="posfield__label" htmlFor={id}>{label}</label>
      <WorkbookInput id={id} type="number" step="any" className="posfield__input posmono esq-dialog-number" value={value ?? ""} disabled={!editable} onChange={(event) => numberFrom(event.target.value, onChange)} />
    </div>
  );
}

function ChecksPanel<F extends CheckRow>({ findings, opens, onOpen }: { findings: readonly F[]; opens: (finding: F) => boolean; onOpen: (finding: F) => void }): JSX.Element {
  const [page, setPage] = useState(0);
  const rows = paged(findings.length, page);
  const shown = findings.slice(rows.start, rows.start + PAGE);
  return (
    <>
      <div className="es-records__bar">
        <EsPager rows={rows} noun="finding" onPage={setPage} />
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

function sciText(v: number): string {
  if (!Number.isFinite(v) || v === 0) return String(v);
  const [mantissa, exponent] = v.toExponential(2).split("e");
  const power = Number(exponent);
  const digits = String(Number(mantissa));
  return power === 0 ? digits : `${digits}E${power}`;
}

interface EsqPointEntry {
  key: string;
  expression: UncertainExpression;
  unit: UncertainUnit;
}

function useExpressionPoints(entries: readonly EsqPointEntry[], table: ReadonlyMap<string, UncertainParameter>): Map<string, UncertaintyState<UncertaintyExpressionSummary>> {
  const queries = useMemo(() => entries.map((entry) => ({ expression: entry.expression, unit: entry.unit, probabilities: [], parameters: parametersFor([entry.expression], table) })), [entries, table]);
  const states = useExpressionSummaries(queries);
  return new Map(entries.flatMap((entry, index) => {
    const state = states[index];
    return state === undefined ? [] : [[entry.key, state] as const];
  }));
}

function useInputPoints(esq: EventSequenceQuantification, table: ReadonlyMap<string, UncertainParameter>): Map<string, number> {
  const entries = useMemo(() => sampledInputsOf(esq).flatMap((input) => (input.expression === undefined || input.unit !== "PROBABILITY" ? [] : [{ key: input.key, expression: input.expression, unit: input.unit }])), [esq]);
  const states = useExpressionPoints(entries, table);
  return new Map([...states].flatMap(([key, state]) => (state.status === "ready" ? [[key, state.value.point] as const] : [])));
}

function pointText(state: UncertaintyState<UncertaintyExpressionSummary> | undefined): string {
  if (state === undefined || state.status === "failed") return "—";
  return state.status === "pending" ? "…" : sciText(state.value.point);
}

function valText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return v.toExponential(1).replace("e", "E");
}

function freqText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return `${v.toExponential(1).replace("e", "E")}/yr`;
}

function pctText(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

export {
  AreaField,
  Badge,
  CheckGroup,
  ChecksPanel,
  CUT_OFF_EXPONENTS,
  NumberField,
  Pager,
  TextField,
  pageOf,
  type EsqWindowContext,
  ChecksRow,
  CutOffField,
  FindingsTable,
  RunProgress,
  RunState,
  dateText,
  decade,
  exponentOf,
  failedTrees,
  networkLabel,
  networkOptionsOf,
  treeLabel,
  useRunner,
  type FailedTree,
  type NetworkOption,
  type FindingRow,
  type FindingSeverity,
  type Runner,
  DetailRow,
  DetailToggle,
  EsqProvenanceChip,
  EsqTabs,
  FieldList,
  FormFoot,
  FormRow,
  ModalHead,
  rowClass,
  sciText,
  pointText,
  useElementWidth,
  useExpressionPoints,
  useInputPoints,
  valText,
  freqText,
  pctText,
  type BadgeKind,
  type EsqPointEntry,
};
