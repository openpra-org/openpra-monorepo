import { Fragment, JSX, useId, useState } from "react";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import type { PreOperationalAssumption } from "interfaces-mef-types/core/documentation";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaPriorForm,
  DaSensitivityCase,
  DaSensitivityKind,
  DaUncertaintyAlternative,
  DaUncertaintySource,
} from "interfaces-mef-types/da/data-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { ClampCell, DaProvenanceChip, DaTabs, DetailRow, DetailToggle, FieldList, FormFoot, FormRow, ModalHead, PlotToggle } from "./daShared";
import { DistributionChart, useElementWidth } from "./daDistributionChart";
import { correlationGroups, distributionSummary, sensitivityResult, uncertaintyFindings } from "./daUncertainty";
import { nextCode } from "./daSourcing";
import { useDaWorkbook } from "./daWorkbookContext";
import { CCF_TESTING_LABELS, PRIOR_FORM_LABELS, SENSITIVITY_KIND_LABELS } from "./daViewData";
import { AreaRow, LinesRow, NEED_PAGE, NeedChecksTable, NeedPager, statText, type DaDrawerContext } from "./daScreens";
import { NumberInput, TextRow } from "./daSourcesScreen";
import { TypedValueRows, useText } from "./daUnavailabilityScreen";

type UncertaintyTab = "distributions" | "correlation" | "register" | "sensitivity" | "assumptions" | "checks";

const TAB_HEADS: Record<UncertaintyTab, { title: string; sr: string }> = {
  distributions: { title: "Distributions", sr: "DA-D3" },
  correlation: { title: "Correlation", sr: "DA-D3" },
  register: { title: "Register", sr: "DA-A5 · DA-E2" },
  sensitivity: { title: "Sensitivity cases", sr: "DA-A5 · DA-E2" },
  assumptions: { title: "Pre-operational assumptions", sr: "DA-A6 · DA-E3" },
  checks: { title: "Uncertainty checks", sr: "DA-A5 · DA-A6 · DA-D3 · DA-E2 · DA-E3" },
};

const UNCERTAINTY_WINDOW_KINDS: ReadonlySet<string> = new Set(["daDistribution", "daUncertaintySource", "daSensitivity", "daAssumption"]);

const KINDS: DaSensitivityKind[] = ["FACTOR", "PRIOR_FORM", "SOURCE", "TESTING", "RANGE"];

const FORMS: DaPriorForm[] = ["AS_PUBLISHED", "CONSTRAINED_NONINFORMATIVE", "JEFFREYS"];

const STATUS_LABELS: Record<PreOperationalAssumption["status"], string> = { OPEN: "Open", IN_PROGRESS: "In progress", CLOSED: "Closed" };

const STATUSES: PreOperationalAssumption["status"][] = ["OPEN", "IN_PROGRESS", "CLOSED"];

const LEVELS: ImportanceLevel[] = [ImportanceLevel.HIGH, ImportanceLevel.MEDIUM, ImportanceLevel.LOW];

const LEVEL_LABELS: Record<ImportanceLevel, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

function nameOf(parameter: DataAnalysisParameter): string {
  return parameter.name.trim().length > 0 ? parameter.name : "Unnamed";
}

function unitOf(parameter: DataAnalysisParameter): string {
  if (parameter.parameterType === "FREQUENCY") return "per plant-year";
  if (parameter.parameterType === "FAILURE_RATE") return "per hour";
  return "probability";
}

function pageOf<T>(rows: readonly T[], page: number): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  return { current, shown: rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE) };
}

function factorText(value: number | undefined): string {
  return value === undefined ? "—" : String(Number(value.toPrecision(3)));
}

function DistributionDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  const summary = distributionSummary(da, parameter);
  const unit = unitOf(parameter);
  return (
    <>
      <FieldList items={[
        { label: "Value", value: `${statText(parameter.value)} ${unit}, ${parameter.valueType === "MEAN" ? "a mean" : "a point value"}` },
        { label: "Distribution", value: summary.distribution === undefined ? "None" : summary.family },
        { label: "Percentiles", value: summary.mean === undefined ? "—" : `5th ${statText(summary.p05)}, median ${statText(summary.median)}, 95th ${statText(summary.p95)}` },
        { label: "95th over median", value: factorText(summary.errorFactor) },
        { label: "Coefficient of variation", value: factorText(summary.cv) },
        { label: "Risk significant", value: parameter.isRiskSignificant === true ? "Yes" : "No" },
        { label: "Characterization", value: parameter.uncertaintyNote ?? "—" },
      ]} />
      {summary.problem !== undefined && <p className="posmuted">{summary.problem}</p>}
      {summary.distribution !== undefined && summary.problem === undefined && <DistributionChart series={[{ key: parameter.uuid, label: parameter.uuid, detail: unit, distribution: summary.distribution }]} unit={unit} />}
    </>
  );
}

function DistributionsTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = da.parameters.filter((parameter) => parameter.value !== undefined || parameter.uncertainty !== undefined);
  const rows = parameters.filter((parameter) => {
    if (show === "all") return true;
    const summary = distributionSummary(da, parameter);
    if (show === "none") return summary.distribution === undefined || summary.family === "Point";
    return parameter.isRiskSignificant === true;
  });
  const { current, shown } = pageOf(rows, page);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={show} onChange={(event) => { setShow(event.target.value); setPage(0); }}>
          <option value="all">All parameters</option>
          <option value="significant">Risk significant</option>
          <option value="none">No distribution</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label="Distributions">
          <thead><tr><th className="da-rowtable__pick">Plot</th><th>Parameter</th><th>Family</th><th>Mean</th><th>95th / median</th></tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const summary = distributionSummary(da, parameter);
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                    <td className="da-rowtable__pick"><PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /></td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daDistribution", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                    <td className="da-rowtable__text">{summary.family}</td>
                    <td className="da-rowtable__num">{statText(summary.mean ?? parameter.value)}</td>
                    <td className="da-rowtable__num">{factorText(summary.errorFactor)}</td>
                  </tr>
                  {open && <DetailRow span={5} width={wrapWidth - 18}><DistributionDetail parameter={parameter} /></DetailRow>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CorrelationTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [page, setPage] = useState(0);
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const groups = correlationGroups(da);
  if (groups.length === 0) return <p className="posmuted">No parameter is shared by two or more basic events yet. Map the imported events in Step 03.</p>;
  const { current, shown } = pageOf(groups, page);
  return (
    <>
      <div className="da-needs__bar">
        <span className="da-needs__meta">Each Monte Carlo trial draws a shared parameter once, so every basic event and common cause total that uses it moves together.</span>
        <NeedPager total={groups.length} page={current} onPage={setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label="Correlation groups">
          <thead><tr><th className="da-rowtable__pick">Details</th><th>Parameter</th><th>Shared by</th><th>Pair mean factor</th></tr></thead>
          <tbody>
            {shown.map((group) => {
              const open = group.parameter.uuid === selected;
              return (
                <Fragment key={group.parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(group.parameter.uuid); }}>
                    <td className="da-rowtable__pick"><DetailToggle open={open} label={group.parameter.uuid} onToggle={() => onSelect(open ? "" : group.parameter.uuid)} /></td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daDistribution", id: group.parameter.uuid }); }}>{group.parameter.uuid}</button></td>
                    <td className="da-rowtable__num">{group.draws}</td>
                    <td className="da-rowtable__num">{factorText(group.pairFactor)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={4} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Parameter", value: nameOf(group.parameter) },
                        { label: "Basic events", value: group.events.length === 0 ? "—" : group.events.map((event) => event.code).join(", ") },
                        { label: "Common cause totals", value: group.estimates.length === 0 ? "—" : group.estimates.join(", ") },
                        { label: "Pair mean factor", value: group.pairFactor === undefined ? "—" : `Two of these events in parallel average ${factorText(group.pairFactor)} times what independent draws would give.` },
                      ]} />
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RegisterTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const register = da.uncertaintyRegister ?? [];
  if (register.length === 0) return <p className="posmuted">No register entry yet. List each source of model uncertainty and the assumption behind it.</p>;
  return (
    <div className="da-table-wrap" ref={wrapRef}>
      <table className="postable da-rowtable" aria-label="Register">
        <thead><tr><th className="da-rowtable__pick">Details</th><th>Entry</th><th>Source</th><th>Key</th></tr></thead>
        <tbody>
          {register.map((source) => {
            const open = source.id === selected;
            return (
              <Fragment key={source.id}>
                <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(source.id); }}>
                  <td className="da-rowtable__pick"><DetailToggle open={open} label={source.id} onToggle={() => onSelect(open ? "" : source.id)} /></td>
                  <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daUncertaintySource", id: source.id }); }}>{source.id}</button></td>
                  <ClampCell text={source.source} />
                  <td className="da-rowtable__text">{source.key ? "Yes" : "No"}</td>
                </tr>
                {open && (
                  <DetailRow span={4} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Impact", value: source.impact || "—" },
                      { label: "Parameters", value: [...source.parameterIds, ...(source.estimateIds ?? [])].join(", ") || "—" },
                      { label: "Assumption", value: source.assumption ?? "—" },
                      { label: "Assumption basis", value: source.assumptionBasis ?? "—" },
                      ...source.alternatives.map((alternative) => ({ label: `Alternative ${alternative.id}`, value: `${alternative.alternative}. Not chosen: ${alternative.reasonNotSelected}` })),
                      { label: "Sensitivity cases", value: (source.sensitivityIds ?? []).join(", ") || "—" },
                      { label: "Pre-operational assumptions", value: (source.assumptionIds ?? []).join(", ") || "—" },
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

function SensitivityTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const cases = da.sensitivityCases ?? [];
  if (cases.length === 0) return <p className="posmuted">No sensitivity case yet. Each key register entry needs one.</p>;
  return (
    <div className="da-table-wrap" ref={wrapRef}>
      <table className="postable da-rowtable" aria-label="Sensitivity cases">
        <thead><tr><th className="da-rowtable__pick">Details</th><th>Case</th><th>Changes</th><th>Low</th><th>High</th></tr></thead>
        <tbody>
          {cases.map((item) => {
            const result = sensitivityResult(da, item);
            const open = item.id === selected;
            return (
              <Fragment key={item.id}>
                <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(item.id); }}>
                  <td className="da-rowtable__pick"><DetailToggle open={open} label={item.id} onToggle={() => onSelect(open ? "" : item.id)} /></td>
                  <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daSensitivity", id: item.id }); }}>{item.id}</button></td>
                  <td className="da-rowtable__text">{item.parameterId ?? item.estimateId ?? "—"}</td>
                  <td className="da-rowtable__num">{result.problem !== undefined ? <span className="da-severity da-severity--error">Cannot compute</span> : statText(result.low)}</td>
                  <td className="da-rowtable__num">{result.problem !== undefined ? "—" : statText(result.high)}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Name", value: item.name || "—" },
                      { label: "Kind", value: SENSITIVITY_KIND_LABELS[item.kind] },
                      { label: "Changes", value: result.label },
                      { label: "Base", value: `${statText(result.base)} ${result.unit}` },
                      { label: "Range", value: result.problem ?? `${statText(result.low)} to ${statText(result.high)} ${result.unit}` },
                      { label: "Why", value: item.reason || "—" },
                      { label: "Results", value: item.results ?? "—" },
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

function AssumptionsTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const assumptions = da.preOperationalAssumptions ?? [];
  if (assumptions.length === 0) return <p className="posmuted">No pre-operational assumption yet.</p>;
  return (
    <div className="da-table-wrap" ref={wrapRef}>
      <table className="postable da-rowtable" aria-label="Pre-operational assumptions">
        <thead><tr><th className="da-rowtable__pick">Details</th><th>Assumption</th><th>Area</th><th>Status</th></tr></thead>
        <tbody>
          {assumptions.map((assumption) => {
            const open = assumption.assumptionId === selected;
            return (
              <Fragment key={assumption.assumptionId}>
                <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(assumption.assumptionId); }}>
                  <td className="da-rowtable__pick"><DetailToggle open={open} label={assumption.assumptionId} onToggle={() => onSelect(open ? "" : assumption.assumptionId)} /></td>
                  <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daAssumption", id: assumption.assumptionId }); }}>{assumption.assumptionId}</button></td>
                  <ClampCell text={assumption.influenceOnDefinition} />
                  <td className="da-rowtable__text">{STATUS_LABELS[assumption.status]}</td>
                </tr>
                {open && (
                  <DetailRow span={4} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Assumption", value: assumption.description },
                      { label: "Parameters", value: assumption.affectedElementIds.join(", ") || "—" },
                      { label: "Risk impact", value: LEVEL_LABELS[assumption.riskImpact] },
                      { label: "Closure basis", value: assumption.closureBasis || "—" },
                      { label: "Planned actions", value: assumption.plannedClosureActions.join(". ") || "—" },
                      { label: "Limitations", value: assumption.limitations.join(". ") || "—" },
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

function UncertaintyScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const [tab, setTab] = useState<UncertaintyTab>("distributions");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const tabId = useId();
  const findings = uncertaintyFindings(da);
  const register = da.uncertaintyRegister ?? [];
  const cases = da.sensitivityCases ?? [];
  const assumptions = da.preOperationalAssumptions ?? [];
  const groups = correlationGroups(da);
  const tabs: { id: UncertaintyTab; label: string }[] = [
    { id: "distributions", label: "Distributions" },
    { id: "correlation", label: `Correlation (${groups.length})` },
    { id: "register", label: `Register (${register.length})` },
    { id: "sensitivity", label: `Sensitivity (${cases.length})` },
    { id: "assumptions", label: `Assumptions (${assumptions.length})` },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = TAB_HEADS[tab];
  function addSource(): void {
    if (!editable) return;
    const id = nextCode("MU", register.map((source) => source.id), 1);
    mutateDa((draft) => ({ ...draft, uncertaintyRegister: [...(draft.uncertaintyRegister ?? []), { id, source: "", impact: "", parameterIds: [], alternatives: [], key: false }] }));
    openDrawer({ kind: "daUncertaintySource", id });
  }
  function addCase(): void {
    if (!editable) return;
    const id = nextCode("SS", cases.map((item) => item.id), 1);
    mutateDa((draft) => ({ ...draft, sensitivityCases: [...(draft.sensitivityCases ?? []), { id, name: "", kind: "RANGE", reason: "" }] }));
    openDrawer({ kind: "daSensitivity", id });
  }
  function addAssumption(): void {
    if (!editable) return;
    const id = nextCode("PA", assumptions.map((assumption) => assumption.assumptionId), 1);
    mutateDa((draft) => ({ ...draft, preOperationalAssumptions: [...(draft.preOperationalAssumptions ?? []), { uuid: id, assumptionId: id, description: "", influenceOnDefinition: "", status: "OPEN", limitations: [], riskImpact: ImportanceLevel.MEDIUM, closureBasis: "", plannedClosureActions: [], affectedElementIds: [] }] }));
    openDrawer({ kind: "daAssumption", id });
  }
  const select = (key: string): void => setKeys((current) => ({ ...current, [tab]: key }));
  const selected = keys[tab] ?? "";
  return (
    <div className="da-step">
      <DaTabs label="Uncertainty sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="da-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && tab === "register" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}>Add entry</button>}
              {editable && tab === "sensitivity" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCase}>Add case</button>}
              {editable && tab === "assumptions" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAssumption}>Add assumption</button>}
            </div>
          </div>
          {tab === "distributions" && <DistributionsTable selected={selected} onSelect={select} openDrawer={openDrawer} />}
          {tab === "correlation" && <CorrelationTable selected={selected} onSelect={select} openDrawer={openDrawer} />}
          {tab === "register" && <RegisterTable selected={selected} onSelect={select} openDrawer={openDrawer} />}
          {tab === "sensitivity" && <SensitivityTable selected={selected} onSelect={select} openDrawer={openDrawer} />}
          {tab === "assumptions" && <AssumptionsTable selected={selected} onSelect={select} openDrawer={openDrawer} />}
          {tab === "checks" && <NeedChecksTable findings={findings} openDrawer={openDrawer} />}
        </div>
      </div>
    </div>
  );
}

function IdPicker({ label, value, options, disabled, onChange }: { label: string; value: string[]; options: { id: string; label: string }[]; disabled: boolean; onChange: (value: string[]) => void }): JSX.Element {
  const id = useId();
  const free = options.filter((option) => !value.includes(option.id));
  return (
    <FormRow label={label} htmlFor={id} top>
      <div className="da-form__checks">
        {value.map((item) => (
          <span key={item} className="da-form__check">
            <span>{options.find((option) => option.id === item)?.label ?? `${item}, missing`}</span>
            {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove ${item}`} onClick={() => onChange(value.filter((other) => other !== item))}>Remove</button>}
          </span>
        ))}
        {!disabled && free.length > 0 && (
          <select id={id} className="posfield__select" value="" onChange={(event) => { if (event.target.value.length > 0) onChange([...value, event.target.value]); }}>
            <option value="">Add</option>
            {free.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        )}
      </div>
    </FormRow>
  );
}

function DistributionWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (editable) mutateDa((draft) => ({ ...draft, parameters: draft.parameters.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  const typed = parameter.valueMode === "TYPED" || parameter.valueMode === undefined;
  return (
    <>
      <ModalHead cap="Distribution · DA-D3" title={`${parameter.uuid} · ${nameOf(parameter)}`} onClose={onClose} />
      <div className="modal__body da-form">
        {typed ? <TypedValueRows parameter={parameter} disabled={dis} onPatch={patch} /> : <p className="da-needs__meta">{parameter.valueMode === "LINKED" ? "The value and its distribution follow the workbook it is imported from." : "The distribution comes from the estimate in its own step."}</p>}
        <AreaRow label="Characterization" value={parameter.uncertaintyNote ?? ""} disabled={dis} onChange={(text) => patch({ uncertaintyNote: text.trim().length === 0 ? undefined : text })} />
        <FormRow label="Risk significant" htmlFor={`${fieldId}-risk`}>
          <select id={`${fieldId}-risk`} className="posfield__select" value={parameter.isRiskSignificant === true ? "yes" : "no"} disabled={dis} onChange={(event) => patch({ isRiskSignificant: event.target.value === "yes" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daParameter", id })}>Open parameter</button>
      </FormFoot>
    </>
  );
}

function AlternativeBlock({ alternative, disabled, onPatch, onRemove }: { alternative: DaUncertaintyAlternative; disabled: boolean; onPatch: (next: Partial<DaUncertaintyAlternative>) => void; onRemove: () => void }): JSX.Element {
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{alternative.id}</legend>
      <AreaRow label="Alternative" value={alternative.alternative} disabled={disabled} onChange={(text) => onPatch({ alternative: text })} />
      <AreaRow label="Why not chosen" value={alternative.reasonNotSelected} disabled={disabled} onChange={(text) => onPatch({ reasonNotSelected: text })} />
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this alternative</button>}
    </fieldset>
  );
}

function SourceWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const source = (da.uncertaintyRegister ?? []).find((candidate) => candidate.id === id);
  if (source === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<DaUncertaintySource>): void {
    if (editable) mutateDa((draft) => ({ ...draft, uncertaintyRegister: (draft.uncertaintyRegister ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, uncertaintyRegister: (draft.uncertaintyRegister ?? []).filter((candidate) => candidate.id !== id) }));
  }
  const parameters = da.parameters.map((parameter) => ({ id: parameter.uuid, label: `${parameter.uuid} · ${nameOf(parameter)}` }));
  const estimates = (da.ccfParameterEstimations ?? []).map((estimate) => ({ id: estimate.uuid, label: `${estimate.uuid} · ${estimate.name ?? estimate.ccfGroupReference}` }));
  const cases = (da.sensitivityCases ?? []).map((item) => ({ id: item.id, label: `${item.id} · ${item.name}` }));
  const assumptions = (da.preOperationalAssumptions ?? []).map((assumption) => ({ id: assumption.assumptionId, label: `${assumption.assumptionId} · ${assumption.influenceOnDefinition}` }));
  return (
    <>
      <ModalHead cap="Model uncertainty · DA-A5 · DA-E2" title={source.id} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="What is uncertain" value={source.source} disabled={dis} onChange={(text) => patch({ source: text })} />
        <AreaRow label="Impact" value={source.impact} disabled={dis} onChange={(text) => patch({ impact: text })} />
        <IdPicker label="Parameters" value={source.parameterIds} options={parameters} disabled={dis} onChange={(parameterIds) => patch({ parameterIds })} />
        {estimates.length > 0 && <IdPicker label="Common cause estimates" value={source.estimateIds ?? []} options={estimates} disabled={dis} onChange={(estimateIds) => patch({ estimateIds: estimateIds.length === 0 ? undefined : estimateIds })} />}
        <AreaRow label="Related assumption" value={source.assumption ?? ""} disabled={dis} onChange={(text) => patch({ assumption: text.trim().length === 0 ? undefined : text })} />
        <AreaRow label="Assumption basis" value={source.assumptionBasis ?? ""} disabled={dis} onChange={(text) => patch({ assumptionBasis: text.trim().length === 0 ? undefined : text })} />
        {source.alternatives.map((alternative) => (
          <AlternativeBlock
            key={alternative.id}
            alternative={alternative}
            disabled={dis}
            onPatch={(next) => patch({ alternatives: source.alternatives.map((candidate) => (candidate.id === alternative.id ? { ...candidate, ...next } : candidate)) })}
            onRemove={() => patch({ alternatives: source.alternatives.filter((candidate) => candidate.id !== alternative.id) })}
          />
        ))}
        <FormRow label="Key source" htmlFor={`${fieldId}-key`}>
          <select id={`${fieldId}-key`} className="posfield__select" value={source.key ? "yes" : "no"} disabled={dis} onChange={(event) => patch({ key: event.target.value === "yes" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
        {source.key && <AreaRow label="Why it is key" value={source.keyReason ?? ""} disabled={dis} onChange={(text) => patch({ keyReason: text.trim().length === 0 ? undefined : text })} />}
        <IdPicker label="Sensitivity cases" value={source.sensitivityIds ?? []} options={cases} disabled={dis} onChange={(sensitivityIds) => patch({ sensitivityIds: sensitivityIds.length === 0 ? undefined : sensitivityIds })} />
        <IdPicker label="Pre-operational assumptions" value={source.assumptionIds ?? []} options={assumptions} disabled={dis} onChange={(assumptionIds) => patch({ assumptionIds: assumptionIds.length === 0 ? undefined : assumptionIds })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove entry</button>}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ alternatives: [...source.alternatives, { id: nextCode("A", source.alternatives.map((alternative) => alternative.id), 1), alternative: "", reasonNotSelected: "" }] })}>Add alternative</button>}
      </FormFoot>
    </>
  );
}

function SensitivityWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const item = (da.sensitivityCases ?? []).find((candidate) => candidate.id === id);
  if (item === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const result = sensitivityResult(da, item);
  const parameter = da.parameters.find((candidate) => candidate.uuid === item.parameterId);
  function patch(next: Partial<DaSensitivityCase>): void {
    if (editable) mutateDa((draft) => ({ ...draft, sensitivityCases: (draft.sensitivityCases ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, sensitivityCases: (draft.sensitivityCases ?? []).filter((candidate) => candidate.id !== id) }));
  }
  const uses = parameter?.sourceUses ?? [];
  return (
    <>
      <ModalHead cap="Sensitivity case · DA-A5 · DA-E2" title={`${item.id}${item.name.trim().length > 0 ? ` · ${item.name}` : ""}`} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Name" value={item.name} disabled={dis} onChange={(name) => patch({ name })} />
        <FormRow label="Changes" htmlFor={fid("kind")}>
          <select id={fid("kind")} className="posfield__select" value={item.kind} disabled={dis} onChange={(event) => { const next = KINDS.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ kind: next }); }}>
            {KINDS.map((candidate) => <option key={candidate} value={candidate}>{SENSITIVITY_KIND_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        {item.kind === "TESTING" ? (
          <>
            <FormRow label="Estimate" htmlFor={fid("estimate")}>
              <select id={fid("estimate")} className="posfield__select" value={item.estimateId ?? ""} disabled={dis} onChange={(event) => patch({ estimateId: event.target.value.length === 0 ? undefined : event.target.value })}>
                <option value="">Not chosen</option>
                {(da.ccfParameterEstimations ?? []).map((estimate) => <option key={estimate.uuid} value={estimate.uuid}>{estimate.uuid} · {estimate.name ?? estimate.ccfGroupReference}</option>)}
              </select>
            </FormRow>
            <FormRow label="Other scheme" htmlFor={fid("testing")}>
              <select id={fid("testing")} className="posfield__select" value={item.testing ?? ""} disabled={dis} onChange={(event) => patch({ testing: event.target.value === "STAGGERED" ? "STAGGERED" : event.target.value === "NON_STAGGERED" ? "NON_STAGGERED" : undefined })}>
                <option value="">Not chosen</option>
                <option value="STAGGERED">{CCF_TESTING_LABELS.STAGGERED}</option>
                <option value="NON_STAGGERED">{CCF_TESTING_LABELS.NON_STAGGERED}</option>
              </select>
            </FormRow>
          </>
        ) : (
          <FormRow label="Parameter" htmlFor={fid("parameter")}>
            <select id={fid("parameter")} className="posfield__select" value={item.parameterId ?? ""} disabled={dis} onChange={(event) => patch({ parameterId: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">Not chosen</option>
              {da.parameters.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{candidate.uuid} · {nameOf(candidate)}</option>)}
            </select>
          </FormRow>
        )}
        {(item.kind === "FACTOR" || item.kind === "SOURCE") && (
          <FormRow label={item.kind === "FACTOR" ? "Source use" : "Other source"} htmlFor={fid("use")}>
            <select id={fid("use")} className="posfield__select" value={item.useId ?? ""} disabled={dis} onChange={(event) => patch({ useId: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">Not chosen</option>
              {uses.filter((use) => item.kind === "SOURCE" || (use.factors ?? []).length > 0).map((use) => <option key={use.id} value={use.id}>{useText(da, use)}</option>)}
            </select>
          </FormRow>
        )}
        {item.kind === "PRIOR_FORM" && (
          <FormRow label="Other prior form" htmlFor={fid("form")}>
            <select id={fid("form")} className="posfield__select" value={item.priorForm ?? ""} disabled={dis} onChange={(event) => patch({ priorForm: FORMS.find((candidate) => candidate === event.target.value) })}>
              <option value="">Not chosen</option>
              {FORMS.map((candidate) => <option key={candidate} value={candidate}>{PRIOR_FORM_LABELS[candidate]}</option>)}
            </select>
          </FormRow>
        )}
        {item.kind === "RANGE" && (
          <FormRow label="Range" htmlFor={fid("low")}>
            <NumberInput label="Low" value={item.low} disabled={dis} onChange={(low) => patch({ low })} />
            <NumberInput label="High" value={item.high} disabled={dis} onChange={(high) => patch({ high })} />
            <span className="da-form__unit">{result.unit}</span>
          </FormRow>
        )}
        <AreaRow label="What it tests" value={item.reason} disabled={dis} onChange={(reason) => patch({ reason })} />
        <AreaRow label="Results" value={item.results ?? ""} disabled={dis} onChange={(text) => patch({ results: text.trim().length === 0 ? undefined : text })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove case</button>}
      </FormFoot>
    </>
  );
}

function AssumptionWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const assumption = (da.preOperationalAssumptions ?? []).find((candidate) => candidate.assumptionId === id);
  if (assumption === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<PreOperationalAssumption>): void {
    if (editable) mutateDa((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).map((candidate) => (candidate.assumptionId === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).filter((candidate) => candidate.assumptionId !== id) }));
  }
  const parameters = da.parameters.map((parameter) => ({ id: parameter.uuid, label: `${parameter.uuid} · ${nameOf(parameter)}` }));
  return (
    <>
      <ModalHead cap="Pre-operational assumption · DA-A6 · DA-E3" title={assumption.assumptionId} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Area" value={assumption.influenceOnDefinition} disabled={dis} onChange={(influenceOnDefinition) => patch({ influenceOnDefinition })} />
        <AreaRow label="Assumption" value={assumption.description} disabled={dis} onChange={(description) => patch({ description })} />
        <IdPicker label="Parameters" value={assumption.affectedElementIds} options={parameters} disabled={dis} onChange={(affectedElementIds) => patch({ affectedElementIds })} />
        <FormRow label="Status" htmlFor={`${fieldId}-status`}>
          <select id={`${fieldId}-status`} className="posfield__select" value={assumption.status} disabled={dis} onChange={(event) => { const next = STATUSES.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ status: next }); }}>
            {STATUSES.map((candidate) => <option key={candidate} value={candidate}>{STATUS_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Risk impact" htmlFor={`${fieldId}-impact`}>
          <select id={`${fieldId}-impact`} className="posfield__select" value={assumption.riskImpact} disabled={dis} onChange={(event) => { const next = LEVELS.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ riskImpact: next }); }}>
            {LEVELS.map((candidate) => <option key={candidate} value={candidate}>{LEVEL_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <AreaRow label="How it closes" value={assumption.closureBasis} disabled={dis} onChange={(closureBasis) => patch({ closureBasis })} />
        <LinesRow label="Planned actions" items={assumption.plannedClosureActions} disabled={dis} onChange={(plannedClosureActions) => patch({ plannedClosureActions })} />
        <LinesRow label="Limitations" items={assumption.limitations} disabled={dis} onChange={(limitations) => patch({ limitations })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove assumption</button>}
      </FormFoot>
    </>
  );
}

function UncertaintyWindows({ context, onClose, onRetarget }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  switch (context.kind) {
    case "daDistribution": return <DistributionWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daUncertaintySource": return <SourceWindow id={context.id} onClose={onClose} />;
    case "daSensitivity": return <SensitivityWindow id={context.id} onClose={onClose} />;
    case "daAssumption": return <AssumptionWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { UNCERTAINTY_WINDOW_KINDS, UncertaintyScreen, UncertaintyWindows };
