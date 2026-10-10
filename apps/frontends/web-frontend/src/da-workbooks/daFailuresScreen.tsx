import { Fragment, JSX, useId, useMemo, useState } from "react";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DataModificationAdjustment,
  DaBoundaryMatch,
  DaCountBasis,
  DaDemandCount,
  DaDemandKind,
  DaEvidence,
  DaEvidenceOrigin,
  DaEvidenceUnit,
  DaFailureRecord,
  DaHourCount,
  DaPopulationHyperprior,
  DaPriorForm,
  DaPriorPart,
  DaRecordJudgment,
  DaRecordSet,
  DaSourceEntry,
  DaSourceUse,
  DaTrendBasis,
  DaTrendBin,
  FailureEventClassification,
} from "interfaces-mef-types/da/data-analysis";
import { probabilityEvidence, type BaseLaw, type DiscreteOutcome, type EvidenceTerm, type Law, type TruncatedLaw } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyLawSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { LawEditor } from "../newly-developed-methods/shared/uncertainEditor";
import { useUncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { lawText } from "../newly-developed-methods/shared/uncertainText";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { ClampCell, DaProvenanceChip, DaTabs, DetailRow, FieldList, FormFoot, FormRow, ModalHead, PlotToggle, sciText } from "./daShared";
import { DistributionChart, useElementWidth, type DistributionSeries } from "./daDistributionChart";
import { expressionPoint, expressionSpread, lawSummary, parameterPoint, parameterSpread, pointState, quantileOf } from "./daLaws";
import {
  MU_REACH,
  SIGMA_HIGH,
  SIGMA_LOW,
  estimateExpression,
  estimateSummary,
  estimateUnit,
  evidenceAloneLaw,
  failureFindings,
  failureParameters,
  hyperpriorOf,
  linkedTestInterval,
  methodOf,
  parameterEstimate,
  priorSummary,
  priorWorth,
  publishedSummary,
  recordUsers,
  withoutRecordSet,
  type DaFailureEstimate,
  type DaScale,
} from "./daFailures";
import { libraryEntries, nextCode, parseDelimited, weightedUses, withStoredEntry } from "./daSourcing";
import { countedRecords, decimalYear, recordCount, termsFailures } from "./daEvidenceChecks";
import { modelSpecOf } from "./daSelectors";
import { useDaWorkbook } from "./daWorkbookContext";
import {
  BOUNDARY_MATCH_LABELS,
  COMPUTATION_LABELS,
  COUNT_BASIS_LABELS,
  DEMAND_KIND_LABELS,
  ESTIMATE_METHOD_LABELS,
  EVIDENCE_KIND_LABELS,
  EVIDENCE_ORIGIN_LABELS,
  EVIDENCE_UNIT_LABELS,
  EXPOSURE_LABELS,
  JUDGMENT_LABELS,
  PRIOR_FORM_LABELS,
} from "./daViewData";
import { AreaRow, EstimateRows, LinesRow, NEED_PAGE, NeedChecksTable, NeedPager, PraxisValue, estimateText, listCell, numberFrom, praxisText, spreadFields, statText, waitNote, type DaDrawerContext } from "./daScreens";
import { EstimatePicker, NumberInput, TextRow, YearsRow, entrySearchText, useBuiltInEntries, waitingSources, yearsText, type EstimateChoice } from "./daSourcesScreen";
import { useText } from "./daUnavailabilityScreen";

type FailuresTab = "priors" | "evidence" | "records" | "exposure" | "estimates" | "checks";

const TAB_HEADS: Record<FailuresTab, { title: string; sr: string }> = {
  priors: { title: "Priors", sr: "DA-D1 · DA-D4 · DA-D5" },
  evidence: { title: "Evidence", sr: "DA-C2 · DA-C3 · DA-C4" },
  records: { title: "Records", sr: "DA-C4 · DA-C5 · DA-C6 · DA-D10" },
  exposure: { title: "Demands and hours", sr: "DA-C7 to C12" },
  estimates: { title: "Estimates", sr: "DA-D1 to D5" },
  checks: { title: "Component failure checks", sr: "DA-C3 to C12 · DA-D1 to D5 · DA-D10" },
};

const FAILURE_WINDOW_KINDS: ReadonlySet<string> = new Set(["daPrior", "daEvidence", "daEstimate", "daRecordSet", "daRecord", "daRecordImport", "daRule", "daDesignChange", "daDemand", "daHours"]);

const FAILURE_WIDE_KINDS: ReadonlySet<string> = new Set(["daRecordImport"]);

const PRIOR_FORMS: DaPriorForm[] = ["AS_PUBLISHED", "CONSTRAINED_NONINFORMATIVE", "JEFFREYS"];

const JUDGMENTS: DaRecordJudgment[] = ["OPEN", "FAILURE", "NOT_FAILURE", "REPEAT", "EXCLUDED"];

const DEMAND_KINDS: DaDemandKind[] = ["SURVEILLANCE", "MAINTENANCE", "OTHER_COMPONENT", "OPERATIONAL"];

const COUNT_BASES: DaCountBasis[] = ["RECORDS", "ANNUALIZED_PLAN", "PLANNED_SCHEDULE"];

const BOUNDARIES: DaBoundaryMatch[] = ["SAME", "ADJUSTED", "DIFFERENT"];

const UNITS: DaEvidenceUnit[] = ["DEMANDS", "HOURS", "YEARS"];

const RECORD_FIELDS: { field: "id" | "date" | "unit" | "description" | "reference"; label: string; guesses: string[] }[] = [
  { field: "id", label: "Record", guesses: ["id", "record", "workorder", "wo", "number", "ler"] },
  { field: "date", label: "Date", guesses: ["date", "eventdate", "when", "start"] },
  { field: "unit", label: "Component", guesses: ["component", "unit", "equipment", "tag", "machine"] },
  { field: "description", label: "Description", guesses: ["description", "event", "problem", "summary", "text"] },
  { field: "reference", label: "Reference", guesses: ["reference", "source", "document", "report"] },
];

function nameOf(parameter: DataAnalysisParameter): string {
  return parameter.name.trim().length > 0 ? parameter.name : "Unnamed";
}

function plainCount(value: number | undefined): string {
  if (value === undefined) return "—";
  return Number.isInteger(value) && Math.abs(value) < 1e6 ? value.toLocaleString() : sciText(value);
}

function summaryValue(state: UncertaintyState<UncertaintyLawSummary> | undefined, read: (summary: UncertaintyLawSummary) => number | undefined): UncertaintyState<number> | undefined {
  if (state === undefined || state.status !== "ready") return state;
  const value = read(state.value);
  return value === undefined ? undefined : { status: "ready", value };
}

function priorText(estimate: DaFailureEstimate): string {
  if (estimate.prior !== undefined) return lawText(estimate.prior);
  return estimate.form === "JEFFREYS" && estimate.scale === "RATE" ? "Gamma (shape 0.5, rate 0)" : "—";
}

function worthText(estimate: DaFailureEstimate): string {
  const scale = estimate.scale;
  if (estimate.prior === undefined || scale === undefined) return estimate.form === "JEFFREYS" ? "None" : "—";
  const state = priorSummary(estimate);
  if (state === undefined) return "—";
  if (state.status !== "ready") return praxisText(state);
  const weight = priorWorth(state.value, scale);
  if (weight === undefined) return "—";
  return `${plainCount(Math.round(weight))} ${scale === "RATE" ? "h" : estimate.thetaUnit.includes("mission") ? "missions" : "demands"}`;
}

function exposureText(estimate: DaFailureEstimate): string {
  if (estimate.terms.length === 0) return "—";
  const tests = estimate.terms.filter((term) => term.likelihood === "STANDBY_DEMAND");
  const counts = estimate.terms.filter((term) => term.likelihood !== "STANDBY_DEMAND");
  const parts: string[] = [];
  if (counts.length > 0) {
    const total = counts.reduce((sum, term) => sum + term.exposure, 0);
    if (estimate.scale === "RATE") parts.push(`${plainCount(total)} h`);
    else parts.push(counts.every(probabilityEvidence) ? `${plainCount(total)} demands` : `${plainCount(total)} demand-equivalents`);
  }
  if (tests.length > 0) parts.push(`${plainCount(tests.reduce((sum, term) => sum + term.exposure, 0))} test demands`);
  return parts.join(" and ");
}

function failuresText(estimate: DaFailureEstimate): string {
  return estimate.terms.length === 0 ? "—" : String(Number(termsFailures(estimate.terms).toPrecision(3)));
}

function rateText(estimate: DaFailureEstimate): string {
  if (estimate.terms.length === 0 || estimate.terms.some((term) => term.likelihood === "STANDBY_DEMAND")) return "—";
  const exposure = estimate.terms.reduce((sum, term) => sum + term.exposure, 0);
  return exposure > 0 ? statText(termsFailures(estimate.terms) / exposure) : "—";
}

function ratioText(estimate: DaFailureEstimate): string {
  const unit = estimateUnit(estimate);
  const published = estimate.published;
  if (estimate.estimate === undefined || published === undefined || unit === undefined || publishedSummary(estimate) === undefined) return "—";
  const before = estimateExpression(estimate, published.law);
  if (before === undefined) return "—";
  const after = expressionPoint(estimate.estimate, unit);
  const prior = expressionPoint(before, unit);
  const note = waitNote([after, prior]);
  if (note !== undefined) return note === "Waiting for PRAXIS." ? "…" : note;
  if (after.status !== "ready" || prior.status !== "ready" || !(prior.value.point > 0)) return "—";
  return `×${Number((after.value.point / prior.value.point).toPrecision(2))}`;
}

function estimateValue(parameter: DataAnalysisParameter, estimate: DaFailureEstimate): JSX.Element {
  if (estimate.method === "TYPED") return <PraxisValue state={parameterPoint(parameter)} />;
  if (estimate.problem !== undefined) return <span className="da-severity da-severity--error" title={estimate.problem}>Cannot compute</span>;
  const unit = estimateUnit(estimate);
  if (estimate.pending) return <PraxisValue state={{ status: "pending" }} />;
  return <PraxisValue state={estimate.estimate === undefined || unit === undefined ? undefined : pointState(estimate.estimate, unit)} />;
}

function useFailureFilters(): { page: number; setPage: (page: number) => void; show: string; setShow: (value: string) => void } {
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  return { page, setPage, show, setShow };
}

function pageOf<T>(rows: readonly T[], page: number): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  return { current, shown: rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE) };
}

function PriorDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [focus, setFocus] = useState("USED");
  const estimate = parameterEstimate(da, parameter);
  const used = priorSummary(estimate);
  const published = estimate.form === "AS_PUBLISHED" ? undefined : publishedSummary(estimate);
  const series: DistributionSeries[] = [];
  if (used?.status === "ready") series.push({ key: "USED", label: "Prior used", detail: PRIOR_FORM_LABELS[estimate.form], summary: used.value });
  if (published?.status === "ready" && estimate.published !== undefined) series.push({ key: "PUBLISHED", label: "Step 04 prior", detail: estimate.published.label, summary: published.value });
  const note = estimate.priorPending ? "Waiting for PRAXIS to form the prior." : estimate.priorProblem ?? waitNote([used, published]);
  return (
    <>
      <FieldList items={[
        { label: "Model", value: modelSpecOf(parameter.quantificationModel)?.label ?? "Not set" },
        { label: "Prior from", value: estimate.published?.label ?? "—" },
        { label: "Distribution", value: priorText(estimate) },
        { label: "5th percentile", value: praxisText(summaryValue(used, (summary) => quantileOf(summary, 0.05))) },
        { label: "95th percentile", value: praxisText(summaryValue(used, (summary) => quantileOf(summary, 0.95))) },
        { label: "Worth", value: worthText(estimate) },
      ]} />
      <p className="da-needs__meta">Worth is the evidence the prior is equal to. Plant or technology counts of that size move the estimate halfway to the data.</p>
      {note !== undefined && <p className="posmuted">{note}</p>}
      {series.length === 0 ? note === undefined && <p className="posmuted">{estimate.form === "JEFFREYS" ? "The Jeffreys prior for a rate has no density to plot. It adds half a failure and nothing else." : "No prior to plot. Choose it in Step 04 Applicability."}</p> : (
        <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : series[0]?.key} unit={estimate.thetaUnit} onFocus={setFocus} />
      )}
    </>
  );
}

function EvidenceDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [focus, setFocus] = useState("DATA");
  const estimate = parameterEstimate(da, parameter);
  const scale = estimate.scale;
  const law = scale === undefined ? undefined : evidenceAloneLaw(estimate.terms, scale);
  const alone = law === undefined || estimate.lawUnit === undefined ? undefined : lawSummary(estimate.lawUnit, law, true);
  const prior = priorSummary(estimate);
  const series: DistributionSeries[] = [];
  if (alone?.status === "ready") series.push({ key: "DATA", label: "Evidence alone", detail: `${failuresText(estimate)} in ${exposureText(estimate)}`, summary: alone.value });
  if (prior?.status === "ready") series.push({ key: "PRIOR", label: "Prior used", detail: PRIOR_FORM_LABELS[estimate.form], summary: prior.value });
  const included = estimate.evidence.filter((item) => item.evidence.included);
  const rate = rateText(estimate);
  const note = waitNote([alone, prior]);
  return (
    <>
      <FieldList items={[
        { label: "Rung", value: parameter.evidenceKind === undefined ? "—" : EVIDENCE_KIND_LABELS[parameter.evidenceKind] },
        { label: "In update", value: estimate.evidence.length === 0 ? "—" : `${included.length} of ${estimate.evidence.length}` },
        { label: "Data rate", value: rate === "—" ? "—" : `${rate} ${estimate.thetaUnit}` },
        { label: "Years", value: included.length === 1 ? yearsText(included[0]?.yearsFrom, included[0]?.yearsTo) : included.length > 1 ? `${included.length} periods` : "—" },
      ]} />
      {law === undefined ? <p className="posmuted">No evidence is in the update yet.</p> : (
        <>
          <p className="da-needs__meta da-needs__meta--lead">The evidence curve is the Jeffreys distribution of the counts in the update, so it shows what the data say on their own.</p>
          {note !== undefined && <p className="posmuted">{note}</p>}
          {series.length > 0 && <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : series[0]?.key} unit={estimate.thetaUnit} onFocus={setFocus} />}
        </>
      )}
    </>
  );
}

function typedSeries(parameter: DataAnalysisParameter): { series: DistributionSeries[]; state?: UncertaintyState<UncertaintyLawSummary> } {
  const typed = parameter.estimate;
  if (typed?.node !== "VALUE") return { series: [] };
  const state = lawSummary(typed.value.unit, typed.value.law, true);
  return { series: state.status === "ready" ? [{ key: "ESTIMATE", label: "Typed estimate", detail: "", summary: state.value }] : [], state };
}

function calculatedSeries(estimate: DaFailureEstimate): { series: DistributionSeries[]; states: (UncertaintyState<UncertaintyLawSummary> | undefined)[] } {
  const series: DistributionSeries[] = [];
  const states: (UncertaintyState<UncertaintyLawSummary> | undefined)[] = [];
  const add = (key: string, label: string, detail: string, state: UncertaintyState<UncertaintyLawSummary> | undefined): void => {
    states.push(state);
    if (state?.status === "ready") series.push({ key, label, detail, summary: state.value });
  };
  add("ESTIMATE", "Estimate", estimate.computation === undefined ? "" : COMPUTATION_LABELS[estimate.computation], estimateSummary(estimate));
  const scale = estimate.scale;
  const unit = estimate.lawUnit;
  const pooled = estimate.method === "POPULATION" || estimate.method === "EMPIRICAL_BAYES";
  if (estimate.method === "TREND") return { series, states };
  if (!pooled && estimate.terms.length > 0) add("PRIOR", "Prior used", PRIOR_FORM_LABELS[estimate.form], priorSummary(estimate));
  if (scale === undefined || unit === undefined) return { series, states };
  if (pooled) {
    for (const item of estimate.evidence.filter((entry) => entry.evidence.included)) {
      const law = item.term === undefined ? undefined : evidenceAloneLaw([item.term], scale);
      if (law !== undefined) add(item.evidence.id, item.label, "evidence alone", lawSummary(unit, law, true));
    }
  } else {
    const law = evidenceAloneLaw(estimate.terms, scale);
    if (law !== undefined) add("DATA", "Evidence alone", `${failuresText(estimate)} in ${exposureText(estimate)}`, lawSummary(unit, law, true));
  }
  return { series, states };
}

function EstimateDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [focus, setFocus] = useState("ESTIMATE");
  const estimate = parameterEstimate(da, parameter);
  const method = estimate.method;
  const typed = method === "TYPED";
  const unit = estimateUnit(estimate);
  const typedPlot = typed ? typedSeries(parameter) : undefined;
  const calculated = typed ? undefined : calculatedSeries(estimate);
  const series = typedPlot?.series ?? calculated?.series ?? [];
  const spread = typed ? parameterSpread(parameter) : estimate.estimate === undefined || unit === undefined ? undefined : expressionSpread(estimate.estimate, unit);
  const fields = (
    <FieldList items={[
      { label: "Computation", value: typed ? "—" : estimate.problem !== undefined ? "Cannot compute" : estimate.computation === undefined ? "—" : COMPUTATION_LABELS[estimate.computation] },
      { label: "Distribution", value: typed ? estimateText(parameter.estimate) : estimate.posterior === undefined ? "—" : lawText(estimate.posterior) },
      ...spreadFields(spread),
      { label: "From prior", value: typed ? "—" : ratioText(estimate) },
    ]} />
  );
  const note = estimate.problem ?? (estimate.pending ? "Waiting for PRAXIS." : waitNote(typedPlot?.state === undefined ? calculated?.states ?? [] : [typedPlot.state]));
  if (series.length === 0) {
    return (
      <>
        {fields}
        <p className="posmuted">{note ?? (typed && parameter.estimate !== undefined ? "The typed estimate is a model of other values, so its percentiles come from sampling and it has no single curve." : "No estimate to plot yet.")}</p>
      </>
    );
  }
  const lead = typed ? "" : [
    estimate.missionTime !== undefined ? "The curves show the failure rate per hour. The estimate is the probability over the mission of the mapped basic events from that rate." : "",
    estimate.computation === "POPULATION" ? "Each evidence set is one member of a lognormal population. Its log-mean and log-spread take the priors in the estimate window. The estimate is the predictive distribution for a new member, or the posterior of the chosen set." : "",
    estimate.computation === "EMPIRICAL_BAYES" ? "Each evidence set is one member. PRAXIS fits a gamma or beta population to all members by maximum marginal likelihood. The estimate is that population, or the posterior of the chosen set under it." : "",
    estimate.computation === "TREND" ? `The rate follows a loglinear trend over ${estimate.trendBins?.length ?? 0} yearly rows with flat priors. The estimate is the rate in the chosen year.` : "",
  ].filter((part) => part.length > 0).join(" ");
  return (
    <>
      {fields}
      {lead.length > 0 && <p className="da-needs__meta da-needs__meta--lead">{lead}</p>}
      {note !== undefined && <p className="posmuted">{note}</p>}
      <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : series[0]?.key} unit={typed ? estimate.unit : estimate.thetaUnit} onFocus={setFocus} />
    </>
  );
}

function PriorsTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const filters = useFailureFilters();
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = failureParameters(da);
  if (parameters.length === 0) return <p className="posmuted">No component failure parameter yet. Define them in Step 03.</p>;
  const rows = parameters.filter((parameter) => filters.show === "all" || (filters.show === "changed" ? (parameter.priorForm ?? "AS_PUBLISHED") !== "AS_PUBLISHED" : parameterEstimate(da, parameter).published === undefined));
  const { current, shown } = pageOf(rows, filters.page);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={filters.show} onChange={(event) => { filters.setShow(event.target.value); filters.setPage(0); }}>
          <option value="all">All parameters</option>
          <option value="changed">Not as published</option>
          <option value="none">No prior</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={filters.setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label="Priors">
          <thead><tr><th className="da-rowtable__pick">Plot</th><th>Parameter</th><th>Name</th><th>Form</th><th>Mean</th><th>Unit</th></tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const estimate = parameterEstimate(da, parameter);
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                    <td className="da-rowtable__pick"><PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /></td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daPrior", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                    <td className="da-rowtable__text">{nameOf(parameter)}</td>
                    <td className="da-rowtable__text">{PRIOR_FORM_LABELS[estimate.form]}</td>
                    <td className="da-rowtable__num"><PraxisValue state={estimate.priorPending ? { status: "pending" } : summaryValue(priorSummary(estimate), (summary) => summary.mean)} /></td>
                    <td>{estimate.thetaUnit}</td>
                  </tr>
                  {open && <DetailRow span={6} width={wrapWidth - 18}><PriorDetail parameter={parameter} /></DetailRow>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EvidenceTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const filters = useFailureFilters();
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = failureParameters(da);
  if (parameters.length === 0) return <p className="posmuted">No component failure parameter yet. Define them in Step 03.</p>;
  const rows = parameters.filter((parameter) => filters.show === "all" || (filters.show === "with" ? (parameter.evidence ?? []).length > 0 : (parameter.evidence ?? []).length === 0));
  const { current, shown } = pageOf(rows, filters.page);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={filters.show} onChange={(event) => { filters.setShow(event.target.value); filters.setPage(0); }}>
          <option value="all">All parameters</option>
          <option value="with">With evidence</option>
          <option value="without">Without evidence</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={filters.setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label="Evidence">
          <thead><tr><th className="da-rowtable__pick">Plot</th><th>Parameter</th><th>Name</th><th>Evidence</th><th>Failures</th><th>Exposure</th></tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const estimate = parameterEstimate(da, parameter);
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                    <td className="da-rowtable__pick"><PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /></td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daEvidence", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                    <td className="da-rowtable__text">{nameOf(parameter)}</td>
                    <td className="da-rowtable__text">{listCell(estimate.evidence.map((item) => item.label), "sets")}</td>
                    <td className="da-rowtable__num">{failuresText(estimate)}</td>
                    <td className="da-rowtable__num">{exposureText(estimate)}</td>
                  </tr>
                  {open && <DetailRow span={6} width={wrapWidth - 18}><EvidenceDetail parameter={parameter} /></DetailRow>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EstimatesTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const filters = useFailureFilters();
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = failureParameters(da);
  if (parameters.length === 0) return <p className="posmuted">No component failure parameter yet. Define them in Step 03.</p>;
  const rows = parameters.filter((parameter) => {
    const method = methodOf(parameter);
    if (filters.show === "open") return method === undefined || parameterEstimate(da, parameter).problem !== undefined;
    if (filters.show === "typed") return method === "TYPED";
    if (filters.show === "updated") return method === "BAYES" || method === "POPULATION" || method === "EMPIRICAL_BAYES" || method === "TREND";
    return true;
  });
  const { current, shown } = pageOf(rows, filters.page);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={filters.show} onChange={(event) => { filters.setShow(event.target.value); filters.setPage(0); }}>
          <option value="all">All parameters</option>
          <option value="updated">Updated with evidence</option>
          <option value="typed">Typed</option>
          <option value="open">Not estimated</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={filters.setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label="Estimates">
          <thead><tr><th className="da-rowtable__pick">Plot</th><th>Parameter</th><th>Name</th><th>Method</th><th>Value</th><th>Unit</th></tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const estimate = parameterEstimate(da, parameter);
              const method = estimate.method;
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                    <td className="da-rowtable__pick"><PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /></td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daEstimate", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                    <td className="da-rowtable__text">{nameOf(parameter)}</td>
                    <td className="da-rowtable__text">{method === undefined ? "Not chosen" : ESTIMATE_METHOD_LABELS[method]}</td>
                    <td className="da-rowtable__num">{estimateValue(parameter, estimate)}</td>
                    <td>{estimate.unit}</td>
                  </tr>
                  {open && <DetailRow span={6} width={wrapWidth - 18}><EstimateDetail parameter={parameter} /></DetailRow>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RulesCard({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const rules = da.failureEventClassifications ?? [];
  const groups = new Map((da.componentGroupings ?? []).map((group) => [group.uuid, group.name]));
  const modes = new Map((da.failureModes ?? []).map((mode) => [mode.uuid, mode.name]));
  function add(): void {
    if (!editable) return;
    const uuid = nextCode("FD", rules.map((rule) => rule.uuid), 1);
    mutateDa((draft) => ({ ...draft, failureEventClassifications: [...(draft.failureEventClassifications ?? []), { uuid, failureDefinitionBasis: "", degradedStatesCountedAsFailures: [], degradedStatesNotCounted: [], repeatedFailureCountingApplied: true, implementsSrs: [{ sr: "DA-C5", hlr: "C" }, { sr: "DA-C6", hlr: "C" }] }] }));
    openDrawer({ kind: "daRule", id: uuid });
  }
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Counting rules" level={3} />
        <div className="da-card-actions">
          <DaProvenanceChip>DA-C5 · DA-C6</DaProvenanceChip>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add rule</button>}
        </div>
      </div>
      {rules.length === 0 ? <p className="posmuted">No counting rule yet. Write down what counts as a failure before judging records.</p> : (
        <div className="da-table-wrap">
          <table className="postable da-rowtable" aria-label="Counting rules">
            <thead><tr><th>Rule</th><th>Applies to</th><th>Failure definition</th></tr></thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.uuid}>
                  <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daRule", id: rule.uuid })}>{rule.uuid}</button></td>
                  <td className="da-rowtable__text">{[rule.componentGroupRef === undefined ? "" : groups.get(rule.componentGroupRef) ?? rule.componentGroupRef, rule.failureModeRef === undefined ? "" : modes.get(rule.failureModeRef) ?? rule.failureModeRef].filter((part) => part.length > 0).join(" · ") || "All components"}</td>
                  <ClampCell text={rule.failureDefinitionBasis} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordSetsCard({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const sets = da.recordSets ?? [];
  function add(): void {
    if (!editable) return;
    const id = nextCode("RS", sets.map((set) => set.id));
    mutateDa((draft) => ({ ...draft, recordSets: [...(draft.recordSets ?? []), { id, name: "", origin: draft.plantStage === "OPERATIONAL" ? "PLANT_RECORDS" : "TECHNOLOGY", reference: "", records: [] }] }));
    openDrawer({ kind: "daRecordSet", id });
  }
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Record sets" level={3} />
        <div className="da-card-actions">
          <DaProvenanceChip>DA-C3 · DA-C4</DaProvenanceChip>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add set</button>}
        </div>
      </div>
      {sets.length === 0 ? <p className="posmuted">No record set yet. Add one for the plant's maintenance records, or for an itemized technology source.</p> : (
        <div className="da-table-wrap">
          <table className="postable da-rowtable" aria-label="Record sets">
            <thead><tr><th>Set</th><th>Name</th><th>Years</th><th>Records</th><th>Counted</th><th>Used by</th></tr></thead>
            <tbody>
              {sets.map((set) => (
                <tr key={set.id}>
                  <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daRecordSet", id: set.id })}>{set.id}</button></td>
                  <td className="da-rowtable__text">{set.name.trim().length > 0 ? set.name : "Unnamed"}</td>
                  <td>{yearsText(set.yearsFrom, set.yearsTo)}</td>
                  <td className="da-rowtable__num">{set.records.length}</td>
                  <td className="da-rowtable__num">{set.records.filter((record) => record.judgment === "FAILURE").length}</td>
                  <td className="da-rowtable__text">{listCell(recordUsers(da, set.id), "parameters")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordsCard({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const sets = da.recordSets ?? [];
  const [setId, setSetId] = useState("");
  const [judgment, setJudgment] = useState("");
  const [page, setPage] = useState(0);
  const filterId = useId();
  const active = sets.find((set) => set.id === setId) ?? sets[0];
  function add(): void {
    if (!editable || active === undefined) return;
    const id = nextCode("R", active.records.map((record) => record.id), 3);
    mutateDa((draft) => ({ ...draft, recordSets: (draft.recordSets ?? []).map((set) => (set.id === active.id ? { ...set, records: [...set.records, { id, description: "", judgment: "OPEN" }] } : set)) }));
    openDrawer({ kind: "daRecord", id: `${active.id}|${id}` });
  }
  const rows = (active?.records ?? []).filter((record) => judgment === "" || record.judgment === judgment);
  const { current, shown } = pageOf(rows, page);
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Records" level={3} />
        <div className="da-card-actions">
          <DaProvenanceChip>DA-C4 · DA-C5 · DA-C6</DaProvenanceChip>
          {editable && active !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "daRecordImport", id: active.id })}>Import records</button>}
          {editable && active !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add record</button>}
        </div>
      </div>
      {active === undefined ? <p className="posmuted">Add a record set first.</p> : (
        <>
          <div className="da-needs__bar">
            <label className="posfield__label" htmlFor={`${filterId}-set`}>Set</label>
            <select id={`${filterId}-set`} className="posfield__select" value={active.id} onChange={(event) => { setSetId(event.target.value); setPage(0); }}>
              {sets.map((set) => <option key={set.id} value={set.id}>{set.id} · {set.name}</option>)}
            </select>
            <label className="posfield__label" htmlFor={`${filterId}-judgment`}>Judgment</label>
            <select id={`${filterId}-judgment`} className="posfield__select" value={judgment} onChange={(event) => { setJudgment(event.target.value); setPage(0); }}>
              <option value="">All records</option>
              {JUDGMENTS.map((value) => <option key={value} value={value}>{JUDGMENT_LABELS[value]}</option>)}
            </select>
            <NeedPager total={rows.length} page={current} onPage={setPage} />
          </div>
          {rows.length === 0 ? <p className="posmuted">{active.records.length === 0 ? "No record in this set yet. Import them from a file or add them by hand." : "No record matches."}</p> : (
            <div className="da-table-wrap">
              <table className="postable da-rowtable" aria-label="Records">
                <thead><tr><th>Record</th><th>Date</th><th>Description</th><th>Judgment</th><th>Parameter</th></tr></thead>
                <tbody>
                  {shown.map((record) => (
                    <tr key={record.id}>
                      <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daRecord", id: `${active.id}|${record.id}` })}>{record.id}</button></td>
                      <td>{record.date ?? "—"}</td>
                      <ClampCell text={record.description} />
                      <td className={record.judgment === "OPEN" ? "da-severity da-severity--warning" : undefined}>{JUDGMENT_LABELS[record.judgment]}{record.judgment === "REPEAT" && record.repeatOf !== undefined ? ` of ${record.repeatOf}` : ""}</td>
                      <td>{record.parameterId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DesignChangesCard({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const changes = da.dataModificationAdjustments ?? [];
  function add(): void {
    if (!editable) return;
    const uuid = nextCode("DMOD", changes.map((change) => change.uuid), 1);
    mutateDa((draft) => ({ ...draft, dataModificationAdjustments: [...(draft.dataModificationAdjustments ?? []), { uuid, modificationDescription: "", affectedParameterIds: [], pastDataDisposition: "RETAINED_WITH_JUSTIFICATION", basis: "", implementsSrs: [{ sr: "DA-D10", hlr: "D" }] }] }));
    openDrawer({ kind: "daDesignChange", id: uuid });
  }
  const disposition: Record<DataModificationAdjustment["pastDataDisposition"], string> = { ADJUSTED: "Adjusted", DISCARDED: "Older data dropped", RETAINED_WITH_JUSTIFICATION: "Kept with a reason" };
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Design changes" level={3} />
        <div className="da-card-actions">
          <DaProvenanceChip>DA-D10</DaProvenanceChip>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add design change</button>}
        </div>
      </div>
      {changes.length === 0 ? <p className="posmuted">No design change limits the data.</p> : (
        <div className="da-table-wrap">
          <table className="postable da-rowtable" aria-label="Design changes">
            <thead><tr><th>Change</th><th>Description</th><th>Effective</th><th>Older data</th></tr></thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.uuid}>
                  <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daDesignChange", id: change.uuid })}>{change.uuid}</button></td>
                  <ClampCell text={change.modificationDescription} />
                  <td>{change.effectiveDate ?? "—"}</td>
                  <td className="da-rowtable__text">{disposition[change.pastDataDisposition]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function groupName(da: DataAnalysis, groupId: string): string {
  const group = (da.componentGroupings ?? []).find((candidate) => candidate.uuid === groupId);
  return group === undefined ? (groupId.length > 0 ? groupId : "—") : `${group.uuid} · ${group.name}`;
}

function DemandsCard({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const rows = da.demandCounts ?? [];
  function add(): void {
    if (!editable) return;
    const id = nextCode("DM", rows.map((row) => row.id));
    mutateDa((draft) => ({ ...draft, demandCounts: [...(draft.demandCounts ?? []), { id, groupId: "", kind: "SURVEILLANCE", activity: "", count: 0, failureModeIds: [], basis: draft.plantStage === "OPERATIONAL" ? "RECORDS" : "PLANNED_SCHEDULE" }] }));
    openDrawer({ kind: "daDemand", id });
  }
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Demands" level={3} />
        <div className="da-card-actions">
          <DaProvenanceChip>DA-C7 · DA-C8 · DA-C9 · DA-C12</DaProvenanceChip>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add demands</button>}
        </div>
      </div>
      {rows.length === 0 ? <p className="posmuted">No demand count yet. Add the tests, maintenance acts and operations that demand each population.</p> : (
        <div className="da-table-wrap">
          <table className="postable da-rowtable" aria-label="Demands">
            <thead><tr><th>Row</th><th>Population</th><th>Activity</th><th>Demands</th><th>Basis</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daDemand", id: row.id })}>{row.id}</button></td>
                  <td className="da-rowtable__text">{groupName(da, row.groupId)}</td>
                  <ClampCell text={row.activity} />
                  <td className="da-rowtable__num">{plainCount(row.count)}</td>
                  <td className="da-rowtable__text">{COUNT_BASIS_LABELS[row.basis]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HoursCard({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const rows = da.hourCounts ?? [];
  function add(): void {
    if (!editable) return;
    const id = nextCode("EX", rows.map((row) => row.id));
    mutateDa((draft) => ({ ...draft, hourCounts: [...(draft.hourCounts ?? []), { id, groupId: "", basis: draft.plantStage === "OPERATIONAL" ? "RECORDS" : "PLANNED_SCHEDULE" }] }));
    openDrawer({ kind: "daHours", id });
  }
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Hours" level={3} />
        <div className="da-card-actions">
          <DaProvenanceChip>DA-C10 · DA-C11</DaProvenanceChip>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add hours</button>}
        </div>
      </div>
      {rows.length === 0 ? <p className="posmuted">No hours yet. Add the run and standby hours of each population.</p> : (
        <div className="da-table-wrap">
          <table className="postable da-rowtable" aria-label="Hours">
            <thead><tr><th>Row</th><th>Population</th><th>Run hours</th><th>Standby hours</th><th>Basis</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daHours", id: row.id })}>{row.id}</button></td>
                  <td className="da-rowtable__text">{groupName(da, row.groupId)}</td>
                  <td className="da-rowtable__num">{plainCount(row.runHours)}</td>
                  <td className="da-rowtable__num">{plainCount(row.standbyHours)}</td>
                  <td className="da-rowtable__text">{COUNT_BASIS_LABELS[row.basis]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FailuresScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [tab, setTab] = useState<FailuresTab>("priors");
  const [priorKey, setPriorKey] = useState("");
  const [evidenceKey, setEvidenceKey] = useState("");
  const [estimateKey, setEstimateKey] = useState("");
  const tabId = useId();
  const parameters = failureParameters(da);
  const findings = failureFindings(da);
  const withEvidence = parameters.filter((parameter) => (parameter.evidence ?? []).length > 0).length;
  const estimated = parameters.filter((parameter) => parameter.estimate !== undefined && methodOf(parameter) !== undefined).length;
  const records = (da.recordSets ?? []).reduce((sum, set) => sum + set.records.length, 0);
  const counts = (da.demandCounts ?? []).length + (da.hourCounts ?? []).length;
  const tabs: { id: FailuresTab; label: string }[] = [
    { id: "priors", label: `Priors (${parameters.length})` },
    { id: "evidence", label: `Evidence (${withEvidence} of ${parameters.length})` },
    { id: "records", label: `Records (${records})` },
    { id: "exposure", label: `Demands and hours (${counts})` },
    { id: "estimates", label: `Estimates (${estimated} of ${parameters.length})` },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = TAB_HEADS[tab];
  const single = tab === "priors" || tab === "evidence" || tab === "estimates" || tab === "checks";
  return (
    <div className="da-step">
      <DaTabs label="Component failure sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="da-step__panel">
        {single && (
          <div className="poscard">
            <div className="poscard__head">
              <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
              <div className="da-card-actions">
                <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              </div>
            </div>
            {tab === "priors" ? (
              <PriorsTable selected={priorKey} onSelect={setPriorKey} openDrawer={openDrawer} />
            ) : tab === "evidence" ? (
              <EvidenceTable selected={evidenceKey} onSelect={setEvidenceKey} openDrawer={openDrawer} />
            ) : tab === "estimates" ? (
              <EstimatesTable selected={estimateKey} onSelect={setEstimateKey} openDrawer={openDrawer} />
            ) : (
              <NeedChecksTable findings={findings} openDrawer={openDrawer} />
            )}
          </div>
        )}
        {tab === "records" && (
          <>
            <RulesCard openDrawer={openDrawer} />
            <RecordSetsCard openDrawer={openDrawer} />
            <RecordsCard openDrawer={openDrawer} />
            <DesignChangesCard openDrawer={openDrawer} />
          </>
        )}
        {tab === "exposure" && (
          <>
            <DemandsCard openDrawer={openDrawer} />
            <HoursCard openDrawer={openDrawer} />
          </>
        )}
      </div>
    </div>
  );
}

function patchParameter(mutateDa: (mutator: (da: DataAnalysis) => DataAnalysis) => void, id: string, next: Partial<DataAnalysisParameter>): void {
  mutateDa((draft) => ({ ...draft, parameters: draft.parameters.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
}

function PriorWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const form = parameter.priorForm ?? "AS_PUBLISHED";
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (editable) patchParameter(mutateDa, id, next);
  }
  return (
    <>
      <ModalHead cap={`Prior · ${modelSpecOf(parameter.quantificationModel)?.label ?? "No model"} · DA-D1`} title={`${parameter.uuid} · ${nameOf(parameter)}`} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="Form" htmlFor={`${fieldId}-form`}>
          <select id={`${fieldId}-form`} className="posfield__select" value={form} disabled={dis} onChange={(event) => { const next = PRIOR_FORMS.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ priorForm: next }); }}>
            {PRIOR_FORMS.map((candidate) => <option key={candidate} value={candidate}>{PRIOR_FORM_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        {(form !== "AS_PUBLISHED" || (parameter.priorFormReason ?? "").length > 0) && (
          <AreaRow label="Why this form" value={parameter.priorFormReason ?? ""} disabled={dis} onChange={(text) => patch({ priorFormReason: text.trim().length === 0 ? undefined : text })} />
        )}
        <PriorSourcesRow uses={parameter.sourceUses ?? []} primaryId={parameter.priorUseId} parts={parameter.priorParts} disabled={dis} onChange={(priorUseId, priorParts) => patch({ priorUseId, priorParts })} />
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daSourcing", id })}>Open applicability</button>
      </FormFoot>
    </>
  );
}

function countChoices(da: DataAnalysis, builtIn: ReadonlyMap<string, DaSourceEntry[]>): EstimateChoice[] {
  return (da.sources ?? []).flatMap((source) => libraryEntries(source, builtIn.get(source.catalogId ?? "")).filter((entry) => entry.failures !== undefined && entry.exposure !== undefined).map((entry) => ({
    value: `${source.id}|${entry.id}`,
    label: `${source.id} · ${entry.id} · ${entry.component} · ${entry.failureMode}`,
    detail: `${entry.failures ?? 0} in ${sciText(entry.exposure ?? 0)} ${EXPOSURE_LABELS[entry.quantity]}`,
    search: `${source.id} ${source.name} ${entrySearchText(entry)}`.toLowerCase(),
  })));
}

function OutcomesRows({ outcomes, noun, disabled, onChange }: { outcomes: DiscreteOutcome[]; noun: string; disabled: boolean; onChange: (next: DiscreteOutcome[]) => void }): JSX.Element {
  function patchAt(index: number, next: Partial<DiscreteOutcome>): void {
    onChange(outcomes.map((outcome, at) => (at === index ? { ...outcome, ...next } : outcome)));
  }
  return (
    <>
      {outcomes.map((outcome, index) => (
        <FormRow key={index} label={`Possible count ${index + 1}`}>
          <NumberInput label={`Possible count ${index + 1}`} value={outcome.value} disabled={disabled} onChange={(value) => patchAt(index, { value: value ?? 0 })} />
          <span className="da-form__unit">{noun} with weight</span>
          <NumberInput label={`Weight of count ${index + 1}`} value={outcome.weight} disabled={disabled} onChange={(weight) => patchAt(index, { weight: weight ?? 0 })} />
          {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange(outcomes.filter((_, at) => at !== index))}>Remove</button>}
        </FormRow>
      ))}
      {outcomes.length === 0 && <p className="posmuted">No possible count yet. Add each count the evidence could hold, with its weight.</p>}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange([...outcomes, { value: outcomes.length, weight: 1 }])}>Add a possible count</button>}
    </>
  );
}

function FailuresFromSelect({ id, evidence, disabled, onPatch }: { id: string; evidence: DaEvidence; disabled: boolean; onPatch: (next: Partial<DaEvidence>) => void }): JSX.Element {
  function choose(value: string): void {
    const next: DaEvidence["failuresFrom"] = value === "ENTRY" ? "ENTRY" : value === "RECORDS" ? "RECORDS" : value === "UNCERTAIN" ? "UNCERTAIN" : "TYPED";
    onPatch({ failuresFrom: next, failureOutcomes: next === "UNCERTAIN" ? evidence.failureOutcomes ?? [{ value: evidence.failures ?? 0, weight: 1 }] : evidence.failureOutcomes });
  }
  return (
    <select id={id} className="posfield__select" value={evidence.failuresFrom} disabled={disabled} onChange={(event) => choose(event.target.value)}>
      <option value="TYPED">Typed</option>
      <option value="UNCERTAIN">Several possible counts</option>
      <option value="ENTRY">A library estimate</option>
      <option value="RECORDS">Judged records</option>
    </select>
  );
}

function PriorSourcesRow({ uses, primaryId, parts, disabled, onChange }: { uses: DaSourceUse[]; primaryId: string | undefined; parts: DaPriorPart[] | undefined; disabled: boolean; onChange: (primaryId: string | undefined, parts: DaPriorPart[] | undefined) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const open = uses.filter((use) => use.verdict !== "REJECTED");
  const current = weightedUses(uses, primaryId, parts).map((part) => ({ useId: part.use.id, weight: part.weight }));
  function emit(next: DaPriorPart[]): void {
    onChange(next[0]?.useId, next.length >= 2 ? next : undefined);
  }
  function toggle(useId: string, on: boolean): void {
    emit(on ? [...current, { useId, weight: 1 }] : current.filter((part) => part.useId !== useId));
  }
  function weigh(useId: string, weight: number | undefined): void {
    if (weight === undefined || !(weight > 0)) return;
    emit(current.map((part) => (part.useId === useId ? { ...part, weight } : part)));
  }
  return (
    <FormRow label="Prior sources" top>
      <div className="da-form__checks">
        {open.length === 0 && <span className="posmuted">Consider sources in Step 04 Applicability first.</span>}
        {open.map((use) => {
          const part = current.find((candidate) => candidate.useId === use.id);
          return (
            <label key={use.id} className="da-form__check">
              <input type="checkbox" checked={part !== undefined} disabled={disabled} onChange={(event) => toggle(use.id, event.target.checked)} />
              <span>{useText(da, use)}</span>
              {part !== undefined && current.length >= 2 && <NumberInput label={`Weight of ${use.id}`} value={part.weight} disabled={disabled} onChange={(weight) => weigh(use.id, weight)} />}
            </label>
          );
        })}
        {current.length >= 2 && <span className="da-form__unit">The prior is a mixture of these sources by weight.</span>}
      </div>
    </FormRow>
  );
}

function TargetRow({ method, evidence, value, disabled, onChange }: { method: "POPULATION" | "EMPIRICAL_BAYES"; evidence: DaEvidence[]; value: string | undefined; disabled: boolean; onChange: (value: string | undefined) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="Estimate for" htmlFor={id}>
      <select id={id} className="posfield__select" value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value.length === 0 ? undefined : event.target.value)}>
        <option value="">{method === "POPULATION" ? "A new member of the population" : "The fitted population"}</option>
        {evidence.map((item) => <option key={item.id} value={item.id}>{item.id}{item.label !== undefined ? ` · ${item.label}` : ""}</option>)}
      </select>
    </FormRow>
  );
}

function EvidenceBlock({ parameter, evidence, scale, unit, disabled, choices, sets, onPatch, onPick, onRemove }: {
  parameter: DataAnalysisParameter;
  evidence: DaEvidence;
  scale: DaScale | undefined;
  unit: DaEvidenceUnit | undefined;
  disabled: boolean;
  choices: EstimateChoice[];
  sets: DaRecordSet[];
  onPatch: (next: Partial<DaEvidence>) => void;
  onPick: (sourceId: string, entryId: string) => void;
  onRemove: () => void;
}): JSX.Element {
  const fieldId = useId();
  const fid = (name: string): string => `${fieldId}-${name}`;
  const origins: DaEvidenceOrigin[] = ["TECHNOLOGY", "PLANT_RECORDS"];
  const needsEntry = evidence.failuresFrom === "ENTRY" || evidence.exposureFrom === "ENTRY";
  const needsPerDemand = (scale === "PROBABILITY" && (unit === "HOURS" || unit === "YEARS")) || evidence.hoursPerDemand !== undefined;
  const needsPerYear = unit === "YEARS" || evidence.hoursPerYear !== undefined;
  const testDemands = parameter.quantificationModel === "STANDBY_RATE" && unit === "DEMANDS";
  const { da } = useDaWorkbook();
  const linkedInterval = testDemands ? linkedTestInterval(da, parameter) : undefined;
  const key = evidence.sourceId !== undefined && evidence.entryId !== undefined ? `${evidence.sourceId}|${evidence.entryId}` : "";
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{evidence.id}{evidence.label !== undefined && evidence.label.trim().length > 0 ? ` · ${evidence.label}` : ""}</legend>
      <TextRow label="Name" value={evidence.label ?? ""} disabled={disabled} onChange={(label) => onPatch({ label: label.trim().length === 0 ? undefined : label })} />
      <FormRow label="Origin" htmlFor={fid("origin")}>
        <select id={fid("origin")} className="posfield__select" value={evidence.origin} disabled={disabled} onChange={(event) => { const next = origins.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ origin: next }); }}>
          {origins.map((candidate) => <option key={candidate} value={candidate}>{EVIDENCE_ORIGIN_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      <FormRow label="Failures from" htmlFor={fid("failures-from")}>
        <FailuresFromSelect id={fid("failures-from")} evidence={evidence} disabled={disabled} onPatch={onPatch} />
        {evidence.failuresFrom === "TYPED" && <><NumberInput label="Failures" value={evidence.failures} disabled={disabled} onChange={(failures) => onPatch({ failures })} /><span className="da-form__unit">failures</span></>}
      </FormRow>
      {evidence.failuresFrom === "UNCERTAIN" && <OutcomesRows outcomes={evidence.failureOutcomes ?? []} noun="failures" disabled={disabled} onChange={(failureOutcomes) => onPatch({ failureOutcomes })} />}
      {evidence.failuresFrom === "RECORDS" && (
        <FormRow label="Record set" htmlFor={fid("set")}>
          <select id={fid("set")} className="posfield__select" value={evidence.recordSetId ?? ""} disabled={disabled} onChange={(event) => onPatch({ recordSetId: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">Not chosen</option>
            {sets.map((set) => <option key={set.id} value={set.id}>{set.id} · {set.name}</option>)}
          </select>
        </FormRow>
      )}
      <FormRow label="Exposure from" htmlFor={fid("exposure-from")}>
        <select id={fid("exposure-from")} className="posfield__select" value={evidence.exposureFrom} disabled={disabled} onChange={(event) => onPatch({ exposureFrom: event.target.value === "ENTRY" ? "ENTRY" : event.target.value === "DEMANDS_AND_HOURS" ? "DEMANDS_AND_HOURS" : "TYPED" })}>
          <option value="TYPED">Typed</option>
          <option value="ENTRY">A library estimate</option>
          <option value="DEMANDS_AND_HOURS">Demands and hours</option>
        </select>
        {evidence.exposureFrom === "TYPED" && (
          <>
            <NumberInput label="Exposure" value={evidence.exposure} disabled={disabled} onChange={(exposure) => onPatch({ exposure })} />
            <select aria-label="Exposure unit" className="posfield__select" value={evidence.unit ?? ""} disabled={disabled} onChange={(event) => onPatch({ unit: UNITS.find((candidate) => candidate === event.target.value) })}>
              {evidence.unit === undefined && <option value="">Unit</option>}
              {UNITS.map((candidate) => <option key={candidate} value={candidate}>{EVIDENCE_UNIT_LABELS[candidate]}</option>)}
            </select>
          </>
        )}
      </FormRow>
      {needsEntry && (
        <FormRow label="Library estimate" htmlFor={fid("entry")}>
          <EstimatePicker id={fid("entry")} value={key} choices={choices} disabled={disabled} onChoose={(value) => { const [sourceId, entryId] = value.split("|"); if (sourceId !== undefined && entryId !== undefined) onPick(sourceId, entryId); }} />
        </FormRow>
      )}
      {testDemands && (
        <>
          <FormRow label="Test interval" htmlFor={fid("interval")}>
            <WorkbookInput id={fid("interval")} className="posfield__input da-form__number" type="number" min="0" step="any" value={evidence.testIntervalHours ?? ""} placeholder={linkedInterval === undefined ? undefined : String(linkedInterval)} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (testIntervalHours) => onPatch({ testIntervalHours }))} />
            <span className="da-form__unit">{linkedInterval === undefined ? "hours between tests" : `hours, ${linkedInterval} from the basic events unless typed`}</span>
          </FormRow>
          <FormRow label="Demands are" htmlFor={fid("demand-kind")}>
            <select id={fid("demand-kind")} className="posfield__select" value={evidence.standbyDemand ?? "TEST"} disabled={disabled} onChange={(event) => onPatch({ standbyDemand: event.target.value === "RANDOM" ? "RANDOM" : "TEST" })}>
              <option value="TEST">Tests at the end of each interval</option>
              <option value="RANDOM">Real demands at random times</option>
            </select>
          </FormRow>
        </>
      )}
      {needsPerDemand && (
        <FormRow label="Hours per demand" htmlFor={fid("per-demand")}>
          <WorkbookInput id={fid("per-demand")} className="posfield__input da-form__number" type="number" min="0" step="any" value={evidence.hoursPerDemand ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (hoursPerDemand) => onPatch({ hoursPerDemand }))} />
          <span className="da-form__unit">{parameter.quantificationModel === "MISSION_PROBABILITY" ? "the mission time unless typed" : "half the test interval for a standby failure"}</span>
        </FormRow>
      )}
      {needsPerYear && (
        <FormRow label="Hours per year" htmlFor={fid("per-year")}>
          <WorkbookInput id={fid("per-year")} className="posfield__input da-form__number" type="number" min="0" step="any" value={evidence.hoursPerYear ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (hoursPerYear) => onPatch({ hoursPerYear }))} />
          <span className="da-form__unit">8760 for a calendar year</span>
        </FormRow>
      )}
      <YearsRow from={evidence.yearsFrom} to={evidence.yearsTo} disabled={disabled} onChange={(yearsFrom, yearsTo) => onPatch({ yearsFrom, yearsTo })} />
      <FormRow label="Boundary" htmlFor={fid("boundary")}>
        <select id={fid("boundary")} className="posfield__select" value={evidence.boundary} disabled={disabled} onChange={(event) => { const next = BOUNDARIES.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ boundary: next }); }}>
          {BOUNDARIES.map((candidate) => <option key={candidate} value={candidate}>{BOUNDARY_MATCH_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      <AreaRow label="Why it applies" value={evidence.reason} disabled={disabled} onChange={(reason) => onPatch({ reason })} />
      <FormRow label="In the update" htmlFor={fid("included")}>
        <select id={fid("included")} className="posfield__select" value={evidence.included ? "yes" : "no"} disabled={disabled} onChange={(event) => onPatch({ included: event.target.value === "yes", exclusionReason: event.target.value === "yes" ? undefined : evidence.exclusionReason ?? "" })}>
          <option value="yes">Included</option>
          <option value="no">Left out</option>
        </select>
      </FormRow>
      {!evidence.included && <AreaRow label="Why it is left out" value={evidence.exclusionReason ?? ""} disabled={disabled} onChange={(exclusionReason) => onPatch({ exclusionReason })} />}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this evidence</button>}
    </fieldset>
  );
}

function EvidenceWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  useUncertaintyVersion();
  const sources = da.sources ?? [];
  const builtIn = useBuiltInEntries(sources);
  const choices = useMemo(() => countChoices(da, builtIn), [da, builtIn]);
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const evidence = parameter.evidence ?? [];
  const estimate = parameterEstimate(da, parameter);
  const units = new Map(estimate.evidence.map((item) => [item.evidence.id, item.unit]));
  const waiting = waitingSources(sources, builtIn);
  function setEvidence(next: DaEvidence[]): void {
    if (editable) patchParameter(mutateDa, id, { evidence: next });
  }
  function add(): void {
    const evidenceId = nextCode("EV", evidence.map((item) => item.id), 1);
    const operating = da.plantStage === "OPERATIONAL";
    const model = parameter?.quantificationModel;
    setEvidence([...evidence, { id: evidenceId, origin: operating ? "PLANT_RECORDS" : "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", unit: model === "DEMAND_PROBABILITY" || model === "OTHER_PROBABILITY" || model === "HUMAN_ERROR" ? "DEMANDS" : "HOURS", boundary: "SAME", reason: "", included: true }]);
  }
  function pick(evidenceId: string, sourceId: string, entryId: string): void {
    if (!editable) return;
    const source = sources.find((candidate) => candidate.id === sourceId);
    const entry = source === undefined ? undefined : libraryEntries(source, builtIn.get(source.catalogId ?? "")).find((candidate) => candidate.id === entryId);
    if (entry === undefined) return;
    mutateDa((draft) => {
      const kept = withStoredEntry(draft, sourceId, entry);
      return { ...kept, parameters: kept.parameters.map((candidate) => (candidate.uuid !== id ? candidate : { ...candidate, evidence: (candidate.evidence ?? []).map((item) => (item.id === evidenceId ? { ...item, sourceId, entryId } : item)) })) };
    });
  }
  return (
    <>
      <ModalHead cap={`Evidence · ${modelSpecOf(parameter.quantificationModel)?.label ?? "No model"} · DA-C3 · DA-C4`} title={`${parameter.uuid} · ${nameOf(parameter)}`} onClose={onClose} />
      <div className="modal__body da-form">
        {evidence.map((item) => (
          <EvidenceBlock
            key={item.id}
            parameter={parameter}
            evidence={item}
            scale={estimate.scale}
            unit={units.get(item.id)}
            disabled={dis}
            choices={choices}
            sets={da.recordSets ?? []}
            onPatch={(next) => setEvidence(evidence.map((candidate) => (candidate.id === item.id ? { ...candidate, ...next } : candidate)))}
            onPick={(sourceId, entryId) => pick(item.id, sourceId, entryId)}
            onRemove={() => setEvidence(evidence.filter((candidate) => candidate.id !== item.id))}
          />
        ))}
        {waiting > 0 && evidence.some((item) => item.failuresFrom === "ENTRY" || item.exposureFrom === "ENTRY") && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
        {evidence.length === 0 && <p className="posmuted">No evidence yet. Before operation, add tests, prototypes and other facilities of the same technology. Once operating, add the plant's own records.</p>}
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daEstimate", id })}>Open estimate</button>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={add}>Add evidence</button>}
      </FormFoot>
    </>
  );
}

function hyperLaw(law: Law): BaseLaw | TruncatedLaw | undefined {
  switch (law.family) {
    case "MIXTURE":
    case "PRODUCT":
    case "POSTERIOR":
    case "POPULATION":
    case "EMPIRICAL_BAYES":
    case "DURATION":
    case "TREND":
      return undefined;
    default:
      return law;
  }
}

function HyperpriorRows({ value, terms, disabled, onChange }: { value: DaPopulationHyperprior | undefined; terms: readonly EvidenceTerm[]; disabled: boolean; onChange: (next: DaPopulationHyperprior | undefined) => void }): JSX.Element | null {
  if (terms.length === 0) return null;
  const hyper = hyperpriorOf({ populationHyperprior: value }, terms);
  return (
    <>
      <FormRow label="Log-mean prior" top>
        <LawEditor law={hyper.mu} unit="FACTOR" wrappers={["TRUNCATED"]} disabled={disabled} onChange={(law) => { const mu = hyperLaw(law); if (mu !== undefined) onChange({ ...hyper, mu }); }} />
      </FormRow>
      <FormRow label="Log-spread prior" top>
        <LawEditor law={hyper.sigma} unit="FACTOR" wrappers={["TRUNCATED"]} disabled={disabled} onChange={(law) => { const sigma = hyperLaw(law); if (sigma !== undefined) onChange({ ...hyper, sigma }); }} />
      </FormRow>
      {value === undefined ? (
        <p className="posmuted">These are the default flat priors. The log-mean is uniform from {MU_REACH} below the lowest set's log-rate to {MU_REACH} above the highest. The log-spread is uniform from {SIGMA_LOW} to {SIGMA_HIGH}.</p>
      ) : !disabled && (
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange(undefined)}>Use the default priors</button>
      )}
    </>
  );
}

function recordYears(da: DataAnalysis, parameter: DataAnalysisParameter, setId: string | undefined): Map<number, number> {
  const counted = new Map<number, number>();
  const set = (da.recordSets ?? []).find((candidate) => candidate.id === setId);
  for (const record of countedRecords(set, parameter.uuid)) {
    const at = decimalYear(record.date);
    if (at !== undefined) counted.set(Math.floor(at), (counted.get(Math.floor(at)) ?? 0) + recordCount([record]).failures);
  }
  return counted;
}

function TrendRows({ parameter, disabled, onPatch }: { parameter: DataAnalysisParameter; disabled: boolean; onPatch: (next: Partial<DataAnalysisParameter>) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const basis: DaTrendBasis = parameter.trend ?? { failuresFrom: "TYPED", bins: [] };
  const records = basis.failuresFrom === "RECORDS";
  const counted = records ? recordYears(da, parameter, basis.recordSetId) : new Map<number, number>();
  function set(next: Partial<DaTrendBasis>): void {
    onPatch({ trend: { ...basis, ...next } });
  }
  function patchBin(index: number, next: Partial<DaTrendBin>): void {
    set({ bins: basis.bins.map((bin, at) => (at === index ? { ...bin, ...next } : bin)) });
  }
  function addYear(): void {
    const last = basis.bins[basis.bins.length - 1];
    const start = decimalYear(da.dataPlan?.dataWindowStart);
    const year = last === undefined ? (start === undefined ? new Date().getFullYear() : Math.floor(start)) : last.year + 1;
    set({ bins: [...basis.bins, { year, exposure: last?.exposure ?? 0 }] });
  }
  function addRecordYears(): void {
    const have = new Set(basis.bins.map((bin) => bin.year));
    const missing = [...counted.keys()].filter((year) => !have.has(year));
    set({ bins: [...basis.bins, ...missing.map((year) => ({ year, exposure: 0 }))].sort((a, b) => a.year - b.year) });
  }
  return (
    <>
      <FormRow label="Failures from" htmlFor={`${fieldId}-from`}>
        <select id={`${fieldId}-from`} className="posfield__select" value={basis.failuresFrom} disabled={disabled} onChange={(event) => set({ failuresFrom: event.target.value === "RECORDS" ? "RECORDS" : "TYPED" })}>
          <option value="TYPED">Typed for each year</option>
          <option value="RECORDS">Judged records by year</option>
        </select>
      </FormRow>
      {records && (
        <FormRow label="Record set" htmlFor={`${fieldId}-set`}>
          <select id={`${fieldId}-set`} className="posfield__select" value={basis.recordSetId ?? ""} disabled={disabled} onChange={(event) => set({ recordSetId: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">Not chosen</option>
            {(da.recordSets ?? []).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id} · {candidate.name}</option>)}
          </select>
        </FormRow>
      )}
      {basis.bins.map((bin, index) => (
        <FormRow key={index} label={`Year ${index + 1}`}>
          <NumberInput label={`Year ${index + 1}`} value={bin.year} disabled={disabled} onChange={(year) => { if (year !== undefined) patchBin(index, { year }); }} />
          {records ? <span className="da-form__unit">{counted.get(bin.year) ?? 0} counted failures in</span> : (
            <>
              <NumberInput label={`Failures in year ${index + 1}`} value={bin.failures} disabled={disabled} onChange={(failures) => patchBin(index, { failures })} />
              <span className="da-form__unit">failures in</span>
            </>
          )}
          <NumberInput label={`Hours in year ${index + 1}`} value={bin.exposure} disabled={disabled} onChange={(exposure) => patchBin(index, { exposure: exposure ?? 0 })} />
          <span className="da-form__unit">h</span>
          {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => set({ bins: basis.bins.filter((_, at) => at !== index) })}>Remove</button>}
        </FormRow>
      ))}
      {basis.bins.length === 0 && <p className="posmuted">No year yet. Add each year with its failures and hours of exposure.</p>}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addYear}>Add a year</button>}
      {!disabled && records && counted.size > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addRecordYears}>Add the years of the counted records</button>}
      <FormRow label="Estimate for year" htmlFor={`${fieldId}-at`}>
        <WorkbookInput id={`${fieldId}-at`} className="posfield__input da-form__number" type="number" step="any" value={basis.at ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (at) => set({ at }))} />
      </FormRow>
    </>
  );
}

function EstimateWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const method = methodOf(parameter);
  const included = (parameter.evidence ?? []).filter((item) => item.included);
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (editable) patchParameter(mutateDa, id, next);
  }
  function setMethod(value: string): void {
    if (value === "TYPED") patch({ valueMode: "TYPED", estimateMethod: undefined });
    else if (value === "PRIOR" || value === "BAYES" || value === "POPULATION" || value === "EMPIRICAL_BAYES" || value === "TREND") patch({ valueMode: "CALCULATED", estimateMethod: value });
  }
  return (
    <>
      <ModalHead cap={`Estimate · ${modelSpecOf(parameter.quantificationModel)?.label ?? "No model"} · DA-D1 to D3`} title={`${parameter.uuid} · ${nameOf(parameter)}`} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="Method" htmlFor={fid("method")}>
          <select id={fid("method")} className="posfield__select" value={method ?? ""} disabled={dis} onChange={(event) => setMethod(event.target.value)}>
            {method === undefined && <option value="">Not chosen</option>}
            <option value="PRIOR">{ESTIMATE_METHOD_LABELS.PRIOR}</option>
            <option value="BAYES">{ESTIMATE_METHOD_LABELS.BAYES}</option>
            <option value="POPULATION">{ESTIMATE_METHOD_LABELS.POPULATION}</option>
            <option value="EMPIRICAL_BAYES">{ESTIMATE_METHOD_LABELS.EMPIRICAL_BAYES}</option>
            <option value="TREND">{ESTIMATE_METHOD_LABELS.TREND}</option>
            <option value="TYPED">{ESTIMATE_METHOD_LABELS.TYPED}</option>
          </select>
        </FormRow>
        {(method === "POPULATION" || method === "EMPIRICAL_BAYES") && <TargetRow method={method} evidence={included} value={parameter.populationTargetId} disabled={dis} onChange={(populationTargetId) => patch({ populationTargetId })} />}
        {method === "POPULATION" && <HyperpriorRows value={parameter.populationHyperprior} terms={parameterEstimate(da, parameter).terms} disabled={dis} onChange={(populationHyperprior) => patch({ populationHyperprior })} />}
        {method === "TREND" && <TrendRows parameter={parameter} disabled={dis} onPatch={patch} />}
        {method === "TYPED" && <EstimateRows parameter={parameter} disabled={dis} onPatch={patch} />}
        <FormRow label="Risk significant" htmlFor={fid("risk")}>
          <select id={fid("risk")} className="posfield__select" value={parameter.isRiskSignificant === true ? "yes" : "no"} disabled={dis} onChange={(event) => patch({ isRiskSignificant: event.target.value === "yes" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
        <AreaRow label={method === "TYPED" ? "Where it comes from" : "Reasons"} value={parameter.estimateReason ?? ""} disabled={dis} onChange={(text) => patch({ estimateReason: text.trim().length === 0 ? undefined : text })} />
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daPrior", id })}>Open prior</button>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daEvidence", id })}>Open evidence</button>
      </FormFoot>
    </>
  );
}

function RecordSetWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const set = (da.recordSets ?? []).find((candidate) => candidate.id === id);
  if (set === undefined) return null;
  const dis = !editable;
  const origins: DaEvidenceOrigin[] = ["TECHNOLOGY", "PLANT_RECORDS"];
  function patch(next: Partial<DaRecordSet>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, recordSets: (draft.recordSets ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withoutRecordSet(draft, id));
  }
  return (
    <>
      <ModalHead cap="Record set · DA-C3 · DA-C4" title={set.name.trim().length > 0 ? `${set.id} · ${set.name}` : set.id} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Name" value={set.name} disabled={dis} onChange={(name) => patch({ name })} />
        <FormRow label="Origin" htmlFor={`${fieldId}-origin`}>
          <select id={`${fieldId}-origin`} className="posfield__select" value={set.origin} disabled={dis} onChange={(event) => { const next = origins.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ origin: next }); }}>
            {origins.map((candidate) => <option key={candidate} value={candidate}>{EVIDENCE_ORIGIN_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Library source" htmlFor={`${fieldId}-source`}>
          <select id={`${fieldId}-source`} className="posfield__select" value={set.sourceId ?? ""} disabled={dis} onChange={(event) => patch({ sourceId: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">None</option>
            {(da.sources ?? []).map((source) => <option key={source.id} value={source.id}>{source.id} · {source.name}</option>)}
          </select>
        </FormRow>
        <YearsRow from={set.yearsFrom} to={set.yearsTo} disabled={dis} onChange={(yearsFrom, yearsTo) => patch({ yearsFrom, yearsTo })} />
        <AreaRow label="Reference" value={set.reference} disabled={dis} onChange={(reference) => patch({ reference })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove set</button>}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daRecordImport", id })}>Import records</button>}
      </FormFoot>
    </>
  );
}

function RecordWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const [setId, recordId] = id.split("|");
  const set = (da.recordSets ?? []).find((candidate) => candidate.id === setId);
  const record = set?.records.find((candidate) => candidate.id === recordId);
  if (set === undefined || record === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const parameters = failureParameters(da);
  function patch(next: Partial<DaFailureRecord>): void {
    if (!editable || set === undefined) return;
    mutateDa((draft) => ({ ...draft, recordSets: (draft.recordSets ?? []).map((candidate) => (candidate.id !== set.id ? candidate : { ...candidate, records: candidate.records.map((row) => (row.id === recordId ? { ...row, ...next } : row)) })) }));
  }
  function remove(): void {
    if (!editable || set === undefined) return;
    onClose();
    mutateDa((draft) => ({ ...draft, recordSets: (draft.recordSets ?? []).map((candidate) => (candidate.id !== set.id ? candidate : { ...candidate, records: candidate.records.filter((row) => row.id !== recordId) })) }));
  }
  const counted = record.judgment === "FAILURE" || record.judgment === "REPEAT" || record.judgment === "EXCLUDED";
  return (
    <>
      <ModalHead cap={`Record · ${set.id} · DA-C5 · DA-C6`} title={`${record.id}${record.unit !== undefined ? ` · ${record.unit}` : ""}`} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Date" value={record.date ?? ""} disabled={dis} onChange={(date) => patch({ date: date.trim().length === 0 ? undefined : date.trim() })} />
        <TextRow label="Component" value={record.unit ?? ""} disabled={dis} onChange={(unit) => patch({ unit: unit.trim().length === 0 ? undefined : unit })} />
        <AreaRow label="Description" value={record.description} disabled={dis} onChange={(description) => patch({ description })} />
        <TextRow label="Reference" value={record.reference ?? ""} disabled={dis} onChange={(reference) => patch({ reference: reference.trim().length === 0 ? undefined : reference })} />
        <FormRow label="Judgment" htmlFor={fid("judgment")}>
          <select id={fid("judgment")} className="posfield__select" value={record.judgment} disabled={dis} onChange={(event) => { const next = JUDGMENTS.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ judgment: next, repeatOf: next === "REPEAT" ? record.repeatOf : undefined }); }}>
            {JUDGMENTS.map((candidate) => <option key={candidate} value={candidate}>{JUDGMENT_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        {counted && (
          <FormRow label="Parameter" htmlFor={fid("parameter")}>
            <select id={fid("parameter")} className="posfield__select" value={record.parameterId ?? ""} disabled={dis} onChange={(event) => patch({ parameterId: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">None</option>
              {parameters.map((parameter) => <option key={parameter.uuid} value={parameter.uuid}>{parameter.uuid} · {nameOf(parameter)}</option>)}
            </select>
          </FormRow>
        )}
        {record.judgment === "FAILURE" && (
          <FormRow label="Count" htmlFor={fid("count")}>
            <select id={fid("count")} className="posfield__select" value={record.countOutcomes === undefined ? "ONE" : "SEVERAL"} disabled={dis} onChange={(event) => patch({ countOutcomes: event.target.value === "SEVERAL" ? [{ value: 0, weight: 1 }, { value: 1, weight: 1 }] : undefined })}>
              <option value="ONE">One failure</option>
              <option value="SEVERAL">Several possible counts</option>
            </select>
          </FormRow>
        )}
        {record.judgment === "FAILURE" && record.countOutcomes !== undefined && <OutcomesRows outcomes={record.countOutcomes} noun="failures" disabled={dis} onChange={(countOutcomes) => patch({ countOutcomes })} />}
        {record.judgment === "REPEAT" && (
          <FormRow label="Repeat of" htmlFor={fid("repeat")}>
            <select id={fid("repeat")} className="posfield__select" value={record.repeatOf ?? ""} disabled={dis} onChange={(event) => patch({ repeatOf: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">Not chosen</option>
              {set.records.filter((row) => row.id !== record.id).map((row) => <option key={row.id} value={row.id}>{row.id}{row.date !== undefined ? ` · ${row.date}` : ""}</option>)}
            </select>
          </FormRow>
        )}
        {record.judgment !== "OPEN" && <AreaRow label="Reason" value={record.reason ?? ""} disabled={dis} onChange={(reason) => patch({ reason: reason.trim().length === 0 ? undefined : reason })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove record</button>}
      </FormFoot>
    </>
  );
}

function headerKey(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")) out += ch;
  return out;
}

function RecordImportWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Partial<Record<"id" | "date" | "unit" | "description" | "reference", number>> | undefined>(undefined);
  const set = (da.recordSets ?? []).find((candidate) => candidate.id === id);
  if (set === undefined) return null;
  const table = text.trim().length === 0 ? [] : parseDelimited(text);
  const headers = table[0] ?? [];
  const body = table.slice(1);
  const guessed: Partial<Record<"id" | "date" | "unit" | "description" | "reference", number>> = {};
  const taken = new Set<number>();
  for (const spec of RECORD_FIELDS) {
    const index = headers.findIndex((header, position) => !taken.has(position) && spec.guesses.includes(headerKey(header)));
    if (index !== -1) {
      guessed[spec.field] = index;
      taken.add(index);
    }
  }
  const active = mapping ?? guessed;
  const existing = new Set(set.records.map((record) => record.id));
  const rows: DaFailureRecord[] = [];
  for (const row of body) {
    const cell = (field: "id" | "date" | "unit" | "description" | "reference"): string => {
      const index = active[field];
      return index === undefined ? "" : (row[index] ?? "").trim();
    };
    const description = cell("description");
    if (description.length === 0) continue;
    let recordId = cell("id");
    if (recordId.length === 0 || existing.has(recordId)) recordId = nextCode("R", [...existing], 3);
    existing.add(recordId);
    const record: DaFailureRecord = { id: recordId, description, judgment: "OPEN" };
    if (cell("date").length > 0) record.date = cell("date");
    if (cell("unit").length > 0) record.unit = cell("unit");
    if (cell("reference").length > 0) record.reference = cell("reference");
    rows.push(record);
  }
  function setField(field: "id" | "date" | "unit" | "description" | "reference", value: string): void {
    const next: Partial<Record<"id" | "date" | "unit" | "description" | "reference", number>> = {};
    for (const spec of RECORD_FIELDS) {
      const index = spec.field === field ? (value.length === 0 ? undefined : Number(value)) : active[spec.field];
      if (index !== undefined) next[spec.field] = index;
    }
    setMapping(next);
  }
  function importRows(): void {
    if (!editable || rows.length === 0) return;
    mutateDa((draft) => ({ ...draft, recordSets: (draft.recordSets ?? []).map((candidate) => (candidate.id === id ? { ...candidate, records: [...candidate.records, ...rows] } : candidate)) }));
    onClose();
  }
  return (
    <>
      <ModalHead cap={`Import · ${set.id} · DA-C3`} title={`Import records into ${set.name.trim().length > 0 ? set.name : set.id}`} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="File" htmlFor={`${fieldId}-file`}>
          <input id={`${fieldId}-file`} type="file" accept=".csv,.tsv,.txt" disabled={!editable} onChange={(event) => { const file = event.target.files?.[0]; if (file !== undefined) void file.text().then((next) => { setText(next); setMapping(undefined); }); }} />
        </FormRow>
        <FormRow label="Or paste rows" htmlFor={`${fieldId}-paste`} top>
          <textarea id={`${fieldId}-paste`} className="posfield__textarea" rows={4} value={text} disabled={!editable} onChange={(event) => { setText(event.target.value); setMapping(undefined); }} />
        </FormRow>
        {headers.length > 0 && (
          <>
            <div className="da-import__map">
              {RECORD_FIELDS.map((spec) => (
                <label key={spec.field} className="da-import__field">
                  <span className="da-form__unit">{spec.label}</span>
                  <select className="posfield__select" value={active[spec.field] === undefined ? "" : String(active[spec.field])} onChange={(event) => setField(spec.field, event.target.value)}>
                    <option value="">Not mapped</option>
                    {headers.map((header, index) => <option key={`${header}-${index}`} value={String(index)}>{header.length > 0 ? header : `Column ${index + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="da-needs__meta">{rows.length} {rows.length === 1 ? "record is" : "records are"} ready to import, each not judged yet. {body.length - rows.length} {body.length - rows.length === 1 ? "row has" : "rows have"} no description and will be skipped.</p>
          </>
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={rows.length === 0} onClick={importRows}>Import {rows.length} {rows.length === 1 ? "record" : "records"}</button>}
      </FormFoot>
    </>
  );
}

function RuleWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const rule = (da.failureEventClassifications ?? []).find((candidate) => candidate.uuid === id);
  if (rule === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<FailureEventClassification>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, failureEventClassifications: (draft.failureEventClassifications ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, failureEventClassifications: (draft.failureEventClassifications ?? []).filter((candidate) => candidate.uuid !== id) }));
  }
  return (
    <>
      <ModalHead cap="Counting rule · DA-C5 · DA-C6" title={rule.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="Population" htmlFor={`${fieldId}-group`}>
          <select id={`${fieldId}-group`} className="posfield__select" value={rule.componentGroupRef ?? ""} disabled={dis} onChange={(event) => patch({ componentGroupRef: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">All components</option>
            {(da.componentGroupings ?? []).map((group) => <option key={group.uuid} value={group.uuid}>{group.uuid} · {group.name}</option>)}
          </select>
        </FormRow>
        <FormRow label="Failure mode" htmlFor={`${fieldId}-mode`}>
          <select id={`${fieldId}-mode`} className="posfield__select" value={rule.failureModeRef ?? ""} disabled={dis} onChange={(event) => patch({ failureModeRef: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">All modes</option>
            {(da.failureModes ?? []).map((mode) => <option key={mode.uuid} value={mode.uuid}>{mode.name}</option>)}
          </select>
        </FormRow>
        <AreaRow label="Failure definition" value={rule.failureDefinitionBasis} disabled={dis} onChange={(failureDefinitionBasis) => patch({ failureDefinitionBasis })} />
        <LinesRow label="Counted states" items={rule.degradedStatesCountedAsFailures} disabled={dis} onChange={(degradedStatesCountedAsFailures) => patch({ degradedStatesCountedAsFailures })} />
        <LinesRow label="Not counted" items={rule.degradedStatesNotCounted} disabled={dis} onChange={(degradedStatesNotCounted) => patch({ degradedStatesNotCounted })} />
        <FormRow label="Repeats" htmlFor={`${fieldId}-repeats`}>
          <select id={`${fieldId}-repeats`} className="posfield__select" value={rule.repeatedFailureCountingApplied ? "once" : "each"} disabled={dis} onChange={(event) => patch({ repeatedFailureCountingApplied: event.target.value === "once" })}>
            <option value="once">One repetitive cause counts once, with one demand</option>
            <option value="each">Each occurrence counts</option>
          </select>
        </FormRow>
        <LinesRow label="Basis documents" items={rule.basisDocuments ?? []} disabled={dis} onChange={(items) => patch({ basisDocuments: items.length === 0 ? undefined : items })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove rule</button>}
      </FormFoot>
    </>
  );
}

function DesignChangeWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const change = (da.dataModificationAdjustments ?? []).find((candidate) => candidate.uuid === id);
  if (change === undefined) return null;
  const dis = !editable;
  const dispositions: DataModificationAdjustment["pastDataDisposition"][] = ["RETAINED_WITH_JUSTIFICATION", "ADJUSTED", "DISCARDED"];
  const dispositionText: Record<DataModificationAdjustment["pastDataDisposition"], string> = { RETAINED_WITH_JUSTIFICATION: "Kept with a reason", ADJUSTED: "Adjusted", DISCARDED: "Older data dropped" };
  function patch(next: Partial<DataModificationAdjustment>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, dataModificationAdjustments: (draft.dataModificationAdjustments ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, dataModificationAdjustments: (draft.dataModificationAdjustments ?? []).filter((candidate) => candidate.uuid !== id) }));
  }
  function toggle(parameterId: string, checked: boolean): void {
    if (change === undefined) return;
    patch({ affectedParameterIds: checked ? [...change.affectedParameterIds, parameterId] : change.affectedParameterIds.filter((candidate) => candidate !== parameterId) });
  }
  return (
    <>
      <ModalHead cap="Design change · DA-D10" title={change.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Description" value={change.modificationDescription} disabled={dis} onChange={(modificationDescription) => patch({ modificationDescription })} />
        <FormRow label="Effective" htmlFor={`${fieldId}-date`}>
          <WorkbookInput id={`${fieldId}-date`} className="posfield__input da-form__number" value={change.effectiveDate ?? ""} disabled={dis} onChange={(event) => patch({ effectiveDate: event.target.value.trim().length === 0 ? undefined : event.target.value.trim() })} />
          <span className="da-form__unit">year, year-month or date</span>
        </FormRow>
        <FormRow label="Older data" htmlFor={`${fieldId}-disposition`}>
          <select id={`${fieldId}-disposition`} className="posfield__select" value={change.pastDataDisposition} disabled={dis} onChange={(event) => { const next = dispositions.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ pastDataDisposition: next }); }}>
            {dispositions.map((candidate) => <option key={candidate} value={candidate}>{dispositionText[candidate]}</option>)}
          </select>
        </FormRow>
        <div className="da-form__row da-form__row--top" role="group" aria-labelledby={`${fieldId}-parameters`}>
          <span className="posfield__label da-form__label" id={`${fieldId}-parameters`}>Parameters</span>
          <div className="da-form__checks">
            {failureParameters(da).map((parameter) => (
              <label key={parameter.uuid} className="da-form__check" title={nameOf(parameter)}>
                <input type="checkbox" checked={change.affectedParameterIds.includes(parameter.uuid)} disabled={dis} onChange={(event) => toggle(parameter.uuid, event.target.checked)} />
                <span>{parameter.uuid}</span>
              </label>
            ))}
          </div>
        </div>
        <AreaRow label="Basis" value={change.basis} disabled={dis} onChange={(basis) => patch({ basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove design change</button>}
      </FormFoot>
    </>
  );
}

function PopulationRow({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const id = useId();
  return (
    <FormRow label="Population" htmlFor={id}>
      <select id={id} className="posfield__select" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not chosen</option>
        {(da.componentGroupings ?? []).map((group) => <option key={group.uuid} value={group.uuid}>{group.uuid} · {group.name}</option>)}
      </select>
    </FormRow>
  );
}

function BasisRow({ value, disabled, onChange }: { value: DaCountBasis; disabled: boolean; onChange: (value: DaCountBasis) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="Basis" htmlFor={id}>
      <select id={id} className="posfield__select" value={value} disabled={disabled} onChange={(event) => { const next = COUNT_BASES.find((candidate) => candidate === event.target.value); if (next !== undefined) onChange(next); }}>
        {COUNT_BASES.map((candidate) => <option key={candidate} value={candidate}>{COUNT_BASIS_LABELS[candidate]}</option>)}
      </select>
    </FormRow>
  );
}

function DemandWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const row = (da.demandCounts ?? []).find((candidate) => candidate.id === id);
  if (row === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<DaDemandCount>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, demandCounts: (draft.demandCounts ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, demandCounts: (draft.demandCounts ?? []).filter((candidate) => candidate.id !== id) }));
  }
  function toggle(modeId: string, checked: boolean): void {
    if (row === undefined) return;
    patch({ failureModeIds: checked ? [...row.failureModeIds, modeId] : row.failureModeIds.filter((candidate) => candidate !== modeId) });
  }
  return (
    <>
      <ModalHead cap="Demands · DA-C7 · DA-C12" title={row.activity.trim().length > 0 ? `${row.id} · ${row.activity}` : row.id} onClose={onClose} />
      <div className="modal__body da-form">
        <PopulationRow value={row.groupId} disabled={dis} onChange={(groupId) => patch({ groupId })} />
        <FormRow label="Source" htmlFor={`${fieldId}-kind`}>
          <select id={`${fieldId}-kind`} className="posfield__select" value={row.kind} disabled={dis} onChange={(event) => { const next = DEMAND_KINDS.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ kind: next }); }}>
            {DEMAND_KINDS.map((candidate) => <option key={candidate} value={candidate}>{DEMAND_KIND_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <TextRow label="Activity" value={row.activity} disabled={dis} onChange={(activity) => patch({ activity })} />
        <FormRow label="Demands" htmlFor={`${fieldId}-count`}>
          <WorkbookInput id={`${fieldId}-count`} className="posfield__input da-form__number" type="number" min="0" step="any" value={row.count} disabled={dis} onChange={(event) => numberFrom(event.target.value, (count) => { if (count !== undefined) patch({ count }); })} />
          <span className="da-form__unit">{row.basis === "RECORDS" ? "in the data window, post-maintenance tests left out" : "per year, post-maintenance tests left out"}</span>
        </FormRow>
        <BasisRow value={row.basis} disabled={dis} onChange={(basis) => patch({ basis })} />
        <div className="da-form__row da-form__row--top" role="group" aria-labelledby={`${fieldId}-modes`}>
          <span className="posfield__label da-form__label" id={`${fieldId}-modes`}>Modes tested</span>
          <div className="da-form__checks">
            {(da.failureModes ?? []).map((mode) => (
              <label key={mode.uuid} className="da-form__check">
                <input type="checkbox" checked={row.failureModeIds.includes(mode.uuid)} disabled={dis} onChange={(event) => toggle(mode.uuid, event.target.checked)} />
                <span>{mode.name}</span>
              </label>
            ))}
          </div>
        </div>
        <TextRow label="Reference" value={row.reference ?? ""} disabled={dis} onChange={(reference) => patch({ reference: reference.trim().length === 0 ? undefined : reference })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove demands</button>}
      </FormFoot>
    </>
  );
}

function HoursWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const row = (da.hourCounts ?? []).find((candidate) => candidate.id === id);
  if (row === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<DaHourCount>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, hourCounts: (draft.hourCounts ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, hourCounts: (draft.hourCounts ?? []).filter((candidate) => candidate.id !== id) }));
  }
  const period = row.basis === "RECORDS" ? "hours in the data window" : "hours per year";
  return (
    <>
      <ModalHead cap="Hours · DA-C10 · DA-C11" title={row.id} onClose={onClose} />
      <div className="modal__body da-form">
        <PopulationRow value={row.groupId} disabled={dis} onChange={(groupId) => patch({ groupId })} />
        <FormRow label="Run hours" htmlFor={`${fieldId}-run`}>
          <WorkbookInput id={`${fieldId}-run`} className="posfield__input da-form__number" type="number" min="0" step="any" value={row.runHours ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (runHours) => patch({ runHours }))} />
          <span className="da-form__unit">{period}</span>
        </FormRow>
        <FormRow label="Standby hours" htmlFor={`${fieldId}-standby`}>
          <WorkbookInput id={`${fieldId}-standby`} className="posfield__input da-form__number" type="number" min="0" step="any" value={row.standbyHours ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (standbyHours) => patch({ standbyHours }))} />
          <span className="da-form__unit">{period}</span>
        </FormRow>
        <BasisRow value={row.basis} disabled={dis} onChange={(basis) => patch({ basis })} />
        <TextRow label="Reference" value={row.reference ?? ""} disabled={dis} onChange={(reference) => patch({ reference: reference.trim().length === 0 ? undefined : reference })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove hours</button>}
      </FormFoot>
    </>
  );
}

function FailureWindows({ context, onClose, onRetarget }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  switch (context.kind) {
    case "daPrior": return <PriorWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daEvidence": return <EvidenceWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daEstimate": return <EstimateWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daRecordSet": return <RecordSetWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daRecord": return <RecordWindow id={context.id} onClose={onClose} />;
    case "daRecordImport": return <RecordImportWindow id={context.id} onClose={onClose} />;
    case "daRule": return <RuleWindow id={context.id} onClose={onClose} />;
    case "daDesignChange": return <DesignChangeWindow id={context.id} onClose={onClose} />;
    case "daDemand": return <DemandWindow id={context.id} onClose={onClose} />;
    case "daHours": return <HoursWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { FAILURE_WIDE_KINDS, FAILURE_WINDOW_KINDS, FailureWindows, FailuresFromSelect, FailuresScreen, HyperpriorRows, OutcomesRows, PriorSourcesRow, TargetRow };
