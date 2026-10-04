import { Fragment, JSX, KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaBoundaryMatch,
  DaElicitation,
  DaElicitationExpert,
  DaEstimateQuantity,
  DaEvidenceKind,
  DaExpertRole,
  DaJudgmentLevel,
  DaSource,
  DaSourceEntry,
  DaSourceOrigin,
  DaSourceUse,
  DaSourceVerdict,
  DaTransferFactor,
} from "interfaces-mef-types/da/data-analysis";
import { DA_SOURCE_CATALOG, daCatalogSource } from "interfaces-mef-types/da/generic-sources";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { DaProvenanceChip, DaTabs, FormFoot, FormRow, ModalHead, sciText } from "./daShared";
import { distributionQuantile, judgmentComponent } from "./daDistributions";
import { DistributionChart, useElementWidth, type DistributionSeries } from "./daDistributionChart";
import { useDaWorkbook } from "./daWorkbookContext";
import {
  BOUNDARY_MATCH_LABELS,
  EVIDENCE_KIND_LABELS,
  EXPERT_ROLE_LABELS,
  EXPOSURE_LABELS,
  JUDGMENT_LEVEL_LABELS,
  QUANTITY_LABELS,
  SOURCE_ORIGIN_LABELS,
  VERDICT_LABELS,
} from "./daViewData";
import { modelSpecOf } from "./daSelectors";
import {
  EVIDENCE_ORDER,
  IMPORT_FIELDS,
  catalogDataset,
  catalogEntries,
  elicitationResult,
  elicitationUsers,
  entriesFromRows,
  entryDistribution,
  entryFit,
  entryUsers,
  guessMapping,
  libraryCount,
  libraryEntries,
  needsHoursPerYear,
  needsSourcing,
  nextCode,
  parameterPrior,
  parseDelimited,
  sourceFindings,
  sourceUsers,
  sourceUseBase,
  sourceUseResult,
  needsStandbyHours,
  withStoredEntry,
  withoutElicitation,
  withoutSource,
  type DaFitBasis,
  type DaImportField,
} from "./daSourcing";
import { AreaRow, NEED_PAGE, NeedChecksTable, NeedPager, listCell, numberFrom, statText, type DaDrawerContext } from "./daScreens";

type SourcesTab = "library" | "estimates" | "applicability" | "judgment" | "checks";

const SOURCE_TAB_HEADS: Record<SourcesTab, { title: string; sr: string }> = {
  library: { title: "Source library", sr: "DA-C1 · DA-C2" },
  estimates: { title: "Estimates", sr: "DA-C1" },
  applicability: { title: "Applicability", sr: "DA-C1 · DA-C2 · DA-D1 · DA-D2" },
  judgment: { title: "Expert judgment", sr: "Section 4.2 · DA-D2" },
  checks: { title: "Source checks", sr: "DA-C1 · DA-C2 · DA-D2 · 4.2" },
};

const SOURCE_WINDOW_KINDS: ReadonlySet<string> = new Set(["daSource", "daEntry", "daSourcing", "daElicitation", "daCatalog", "daImport"]);

const WIDE_WINDOW_KINDS: ReadonlySet<string> = new Set(["daCatalog", "daImport"]);

const DISTRIBUTION_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "None" },
  { value: DistributionType.BETA, label: "Beta" },
  { value: DistributionType.GAMMA, label: "Gamma" },
  { value: DistributionType.LOGNORMAL, label: "Lognormal" },
  { value: DistributionType.NORMAL, label: "Normal" },
  { value: DistributionType.WEIBULL, label: "Weibull" },
  { value: DistributionType.EXPONENTIAL, label: "Exponential" },
  { value: DistributionType.POINT_ESTIMATE, label: "Point estimate" },
];

const QUANTITY_ORDER: DaEstimateQuantity[] = ["PER_DEMAND", "PER_HOUR", "PER_YEAR", "FRACTION", "PROBABILITY", "HOURS", "FACTOR"];

const PICK_LIMIT = 60;

const Z95 = 1.6448536269514722;

const FIT_NOTES: Record<DaFitBasis, string> = {
  PRINTED: "",
  MEDIAN_P95: "The source prints no distribution, so a lognormal is fitted to its median and 95th percentile.",
  MEAN_P05_P95: "The source prints no distribution, so a lognormal is fitted to its mean, 5th and 95th percentiles.",
  MEAN_INTERVAL: "The source prints no distribution, so a lognormal is fitted to its mean and 95% interval.",
  COUNTS: "The source prints no distribution, so the Jeffreys distribution of its counts is shown.",
  MEAN: "The source prints only a mean, so it is shown as a point value.",
  MEDIAN: "The source prints only a median, so it is shown as a point value.",
};

function entrySearchText(entry: DaSourceEntry): string {
  return `${entry.id} ${entry.component} ${entry.failureMode} ${entry.table ?? ""}`.toLowerCase();
}

function searchWords(text: string): string[] {
  return text.trim().toLowerCase().split(" ").filter((word) => word.length > 0);
}

function matchesWords(text: string, words: readonly string[]): boolean {
  return words.every((word) => text.includes(word));
}

function parameterText(value: number): string {
  const size = Math.abs(value);
  return size >= 0.01 && size < 1e5 ? String(Number(value.toPrecision(3))) : sciText(value);
}

function distributionText(d: ParameterDistribution | undefined): string {
  if (d === undefined) return "—";
  switch (d.type) {
    case DistributionType.BETA: return `Beta(${parameterText(d.alpha)}, ${parameterText(d.betaParam)})`;
    case DistributionType.GAMMA: return `Gamma(${parameterText(d.shape)}, ${parameterText(d.rate)})`;
    case DistributionType.LOGNORMAL: return `Lognormal(${parameterText(d.median)}, EF ${parameterText(d.errorFactor)})`;
    case DistributionType.NORMAL: return `Normal(${parameterText(d.mean)}, ${parameterText(d.stdDev)})`;
    case DistributionType.WEIBULL: return d.location === 0 ? `Weibull(${parameterText(d.scale)}, ${parameterText(d.shape)})` : `Weibull(${parameterText(d.scale)}, ${parameterText(d.shape)}, from ${parameterText(d.location)})`;
    case DistributionType.EXPONENTIAL: return `Exponential(${parameterText(d.failureRate)})`;
    case DistributionType.POINT_ESTIMATE: return `Point(${parameterText(d.value)})`;
    default: return d.type;
  }
}

function dataText(entry: DaSourceEntry): string {
  if (entry.failures === undefined || entry.exposure === undefined) return "—";
  return `${entry.failures} in ${sciText(entry.exposure)} ${EXPOSURE_LABELS[entry.quantity]}`;
}

function yearsText(from: string | undefined, to: string | undefined): string {
  if (from === undefined && to === undefined) return "—";
  if (from === undefined) return `to ${to ?? ""}`;
  if (to === undefined) return `from ${from}`;
  return `${from} to ${to}`;
}

function isQuantity(value: string): value is DaEstimateQuantity {
  return QUANTITY_ORDER.some((quantity) => quantity === value);
}

function evidenceKindOf(value: string): DaEvidenceKind | undefined {
  return EVIDENCE_ORDER.find((kind) => kind === value);
}

function useBuiltInEntries(sources: readonly DaSource[]): ReadonlyMap<string, DaSourceEntry[]> {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, DaSourceEntry[]>>(new Map());
  const wanted = [...new Set(sources.flatMap((source) => (source.catalogId !== undefined && catalogDataset(source.catalogId) !== undefined ? [source.catalogId] : [])))].sort().join("|");
  useEffect(() => {
    let live = true;
    for (const catalogId of wanted.split("|").filter((value) => value.length > 0)) {
      catalogEntries(catalogId)
        .then((entries) => { if (live) setLoaded((current) => (current.has(catalogId) ? current : new Map([...current, [catalogId, entries]]))); })
        .catch(() => undefined);
    }
    return () => { live = false; };
  }, [wanted]);
  return loaded;
}

function waitingSources(sources: readonly DaSource[], builtIn: ReadonlyMap<string, DaSourceEntry[]>): number {
  return sources.filter((source) => source.catalogId !== undefined && catalogDataset(source.catalogId) !== undefined && !builtIn.has(source.catalogId)).length;
}

function PlotToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }): JSX.Element {
  return (
    <button type="button" className="da-rowtable__plot" aria-expanded={open} aria-label={`${open ? "Hide" : "Plot"} the distribution of ${label}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
      {open ? "Hide" : "Plot"}
    </button>
  );
}

function DetailRow({ span, width, children }: { span: number; width: number; children: ReactNode }): JSX.Element {
  return (
    <tr className="da-rowtable__detail-row">
      <td colSpan={span} className="da-rowtable__detail">
        <div className="da-rowtable__detail-inner" style={width > 0 ? { width: `${width}px` } : undefined}>{children}</div>
      </td>
    </tr>
  );
}

function EstimateDetail({ entry }: { entry: DaSourceEntry }): JSX.Element {
  const fit = entryFit(entry);
  if (fit === undefined) return <p className="posmuted">This estimate has no value to plot.</p>;
  return (
    <>
      {fit.basis !== "PRINTED" && <p className="da-needs__meta da-needs__meta--lead">{FIT_NOTES[fit.basis]}</p>}
      <DistributionChart series={[{ key: entry.id, label: entry.id, detail: "", distribution: fit.distribution }]} unit={QUANTITY_LABELS[entry.quantity]} />
    </>
  );
}

function ParameterDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const results = (parameter.sourceUses ?? []).flatMap((use) => {
    const result = sourceUseResult(da, use);
    return result === undefined ? [] : [{ use, result }];
  });
  const focusKey = focus !== undefined && results.some((item) => item.use.id === focus) ? focus : results.find((item) => item.use.id === parameter.priorUseId)?.use.id ?? results[0]?.use.id;
  const anchor = results.find((item) => item.use.id === focusKey);
  if (anchor === undefined) return <p className="posmuted">No considered source has a value to plot yet.</p>;
  const plotted = results.filter((item) => item.result.quantity === anchor.result.quantity);
  const series: DistributionSeries[] = plotted.map(({ use, result }) => ({
    key: use.id,
    label: use.elicitationId ?? `${use.sourceId ?? "?"} · ${use.entryId ?? "?"}`,
    detail: [use.id === parameter.priorUseId ? "Prior" : "", VERDICT_LABELS[use.verdict], use.verdict === "SCALED" ? "nominal factors" : ""].filter((part) => part.length > 0).join(", "),
    distribution: result.distribution,
  }));
  const left = results.length - plotted.length;
  return (
    <>
      <p className="da-needs__meta da-needs__meta--lead">Each curve is a considered source after its unit conversion and transfer factors.</p>
      <DistributionChart series={series} focusKey={focusKey} unit={QUANTITY_LABELS[anchor.result.quantity]} onFocus={setFocus} />
      {left > 0 && <p className="da-needs__meta">{left} considered {left === 1 ? "source is" : "sources are"} in another unit and {left === 1 ? "is" : "are"} not plotted.</p>}
    </>
  );
}

function JudgmentDetail({ elicitation }: { elicitation: DaElicitation }): JSX.Element {
  const [focus, setFocus] = useState("POOLED");
  const pooled = elicitationResult(elicitation);
  const evaluators = elicitation.experts.filter((expert) => expert.role === "EVALUATOR");
  const stated = evaluators.some((expert) => expert.weight !== undefined);
  const experts: DistributionSeries[] = evaluators.flatMap((expert) => {
    const part = expert.p05 === undefined || expert.median === undefined || expert.p95 === undefined ? undefined : judgmentComponent(expert.p05, expert.median, expert.p95, 1);
    if (part === undefined) return [];
    return [{ key: expert.id, label: expert.name.trim().length > 0 ? expert.name : expert.id, detail: stated ? `weight ${expert.weight ?? 0}` : "", distribution: { type: DistributionType.LOGNORMAL, median: Math.exp(part.mu), errorFactor: Math.exp(Z95 * part.sigma) } }];
  });
  const series: DistributionSeries[] = [...(pooled === undefined ? [] : [{ key: "POOLED", label: "Pooled result", detail: elicitation.pooling === "LINEAR" ? "Linear pool, fitted lognormal" : "Logarithmic pool", distribution: pooled.distribution }]), ...experts];
  if (series.length === 0) return <p className="posmuted">No evaluator has given a full set of percentiles yet.</p>;
  return (
    <>
      <p className="da-needs__meta da-needs__meta--lead">Each expert curve is a lognormal with that expert's median and the spread of their 5th and 95th percentiles.</p>
      <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : series[0]?.key} unit={QUANTITY_LABELS[elicitation.quantity]} onFocus={setFocus} />
    </>
  );
}

function LibraryTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const sources = da.sources ?? [];
  if (sources.length === 0) return <p className="posmuted">The library is empty. Add the published sources from the catalog, then technology evidence and other sources by hand.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Source library">
        <thead><tr><th>Source</th><th>Name</th><th>Evidence</th><th>Origin</th><th>Years</th><th>Estimates</th><th>Used by</th></tr></thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id}>
              <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daSource", id: source.id })}>{source.id}</button></td>
              <td className="da-rowtable__wrap">{source.name.trim().length > 0 ? source.name : "Unnamed"}</td>
              <td>{EVIDENCE_KIND_LABELS[source.kind]}</td>
              <td>{SOURCE_ORIGIN_LABELS[source.origin]}</td>
              <td>{yearsText(source.yearsFrom, source.yearsTo)}</td>
              <td className="da-rowtable__num">{libraryCount(source)}</td>
              <td>{listCell(sourceUsers(da, source.id), "parameters")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EstimatesTable({ sourceId, setSourceId, selected, onSelect, openDrawer }: { sourceId: string; setSourceId: (id: string) => void; selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [page, setPage] = useState(0);
  const [used, setUsed] = useState("all");
  const [unit, setUnit] = useState("");
  const [search, setSearch] = useState("");
  const filterId = useId();
  const sources = da.sources ?? [];
  const listed = sources.filter((source) => sourceId === "" || source.id === sourceId);
  const builtIn = useBuiltInEntries(listed);
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (sources.length === 0) return <p className="posmuted">Add a source to the library first.</p>;
  const words = searchWords(search);
  const waiting = waitingSources(listed, builtIn);
  const rows = listed
    .flatMap((source) => libraryEntries(source, builtIn.get(source.catalogId ?? "")).map((entry) => ({ source, entry })))
    .filter(({ entry }) => (unit === "" || entry.quantity === unit) && matchesWords(entrySearchText(entry), words))
    .filter(({ source, entry }) => used === "all" || entryUsers(da, source.id, entry.id).length > 0);
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={`${filterId}-source`}>Source</label>
        <select id={`${filterId}-source`} className="posfield__select" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setPage(0); }}>
          <option value="">All sources</option>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.id} · {source.name}</option>)}
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-unit`}>Unit</label>
        <select id={`${filterId}-unit`} className="posfield__select" value={unit} onChange={(event) => { setUnit(event.target.value); setPage(0); }}>
          <option value="">All units</option>
          {QUANTITY_ORDER.map((quantity) => <option key={quantity} value={quantity}>{QUANTITY_LABELS[quantity]}</option>)}
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-used`}>Show</label>
        <select id={`${filterId}-used`} className="posfield__select" value={used} onChange={(event) => { setUsed(event.target.value); setPage(0); }}>
          <option value="all">All estimates</option>
          <option value="used">Used by a parameter</option>
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-search`}>Search</label>
        <input id={`${filterId}-search`} className="posfield__input da-pick__search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      {waiting > 0 && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
      {rows.length === 0 ? <p className="posmuted">{words.length > 0 || unit !== "" ? "No estimate matches." : waiting > 0 ? "" : "No estimate yet. Add a built-in source, import a file, or add an estimate by hand."}</p> : (
        <div className="da-table-wrap" ref={wrapRef}>
          <table className="postable da-rowtable" aria-label="Estimates">
            <thead><tr><th className="da-rowtable__pick">Plot</th><th>Source</th><th>Estimate</th><th>Component</th><th>Failure mode</th><th>Unit</th><th>Distribution</th><th>Mean</th><th>5th</th><th>95th</th><th>Data</th><th>Years</th></tr></thead>
            <tbody>
              {shown.map(({ source, entry }) => {
                const distribution = entryDistribution(entry);
                const key = `${source.id}|${entry.id}`;
                const open = key === selected;
                return (
                  <Fragment key={key}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(key); }}>
                    <td className="da-rowtable__pick"><PlotToggle open={open} label={entry.id} onToggle={() => onSelect(open ? "" : key)} /></td>
                    <td>{source.id}</td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daEntry", id: `${source.id}|${entry.id}` }); }}>{entry.id}</button></td>
                    <td className="da-rowtable__wrap">{entry.component.trim().length > 0 ? entry.component : "—"}</td>
                    <td className="da-rowtable__wrap">{entry.failureMode.trim().length > 0 ? entry.failureMode : "—"}</td>
                    <td>{QUANTITY_LABELS[entry.quantity]}</td>
                    <td>{distributionText(entry.distribution ?? distribution)}</td>
                    <td className="da-rowtable__num">{statText(entry.mean)}</td>
                    <td className="da-rowtable__num">{statText(entry.p05)}</td>
                    <td className="da-rowtable__num">{statText(entry.p95)}</td>
                    <td>{dataText(entry)}</td>
                    <td>{yearsText(entry.yearsFrom, entry.yearsTo)}</td>
                  </tr>
                  {open && <DetailRow span={12} width={wrapWidth - 16}><EstimateDetail entry={entry} /></DetailRow>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ApplicabilityTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = da.parameters.filter(needsSourcing);
  const linked = da.parameters.length - parameters.length;
  if (da.parameters.length === 0) return <p className="posmuted">Define the parameters in Step 03 first.</p>;
  const rows = parameters.filter((parameter) => show === "all" || parameterPrior(da, parameter) === undefined);
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE);
  const sources = new Map((da.sources ?? []).map((source) => [source.id, source]));
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={`${filterId}-show`}>Show</label>
        <select id={`${filterId}-show`} className="posfield__select" value={show} onChange={(event) => { setShow(event.target.value); setPage(0); }}>
          <option value="all">All parameters</option>
          <option value="open">No prior yet</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label="Applicability">
          <thead><tr><th className="da-rowtable__pick">Plot</th><th>Parameter</th><th>Name</th><th>Model</th><th>Evidence</th><th>Prior from</th><th>Prior mean</th><th>5th</th><th>95th</th><th>Unit</th><th>Considered</th></tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const prior = parameterPrior(da, parameter);
              const use = (parameter.sourceUses ?? []).find((candidate) => candidate.id === parameter.priorUseId);
              const from = use === undefined ? "—" : use.elicitationId !== undefined ? use.elicitationId : `${sources.get(use.sourceId ?? "")?.id ?? "?"} · ${use.entryId ?? "?"}`;
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                  <td className="da-rowtable__pick"><PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /></td>
                  <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daSourcing", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                  <td className="da-rowtable__wrap">{parameter.name.trim().length > 0 ? parameter.name : "Unnamed"}</td>
                  <td>{modelSpecOf(parameter.quantificationModel)?.label ?? "Not set"}</td>
                  <td>{parameter.evidenceKind === undefined ? "—" : EVIDENCE_KIND_LABELS[parameter.evidenceKind]}</td>
                  <td>{from}{use?.verdict === "SCALED" ? " · scaled" : ""}</td>
                  <td className="da-rowtable__num">{statText(prior?.mean)}</td>
                  <td className="da-rowtable__num">{statText(prior?.p05)}</td>
                  <td className="da-rowtable__num">{statText(prior?.p95)}</td>
                  <td>{prior === undefined ? "—" : QUANTITY_LABELS[prior.quantity]}</td>
                  <td className="da-rowtable__num">{(parameter.sourceUses ?? []).length}</td>
                </tr>
                {open && <DetailRow span={11} width={wrapWidth - 16}><ParameterDetail parameter={parameter} /></DetailRow>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {linked > 0 && <p className="da-needs__meta">{linked} {linked === 1 ? "parameter takes its value" : "parameters take their values"} from SY, IE or HR by link, so the owner workbook is the source.</p>}
    </>
  );
}

function JudgmentTable({ selected, onSelect, openDrawer }: { selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const elicitations = da.elicitations ?? [];
  if (elicitations.length === 0) return <p className="posmuted">No elicitation. Use one only where no applicable data exist (DA-D2), following Section 4.2.</p>;
  return (
    <div className="da-table-wrap" ref={wrapRef}>
      <table className="postable da-rowtable" aria-label="Expert judgment">
        <thead><tr><th className="da-rowtable__pick">Plot</th><th>Elicitation</th><th>Issue</th><th>Unit</th><th>Evaluators</th><th>Pooling</th><th>Mean</th><th>5th</th><th>95th</th><th>Owner</th><th>Used by</th></tr></thead>
        <tbody>
          {elicitations.map((elicitation) => {
            const pooled = elicitationResult(elicitation);
            const result = pooled === undefined ? undefined : { mean: pooled.mean, p05: distributionQuantile(pooled.distribution, 0.05), p95: distributionQuantile(pooled.distribution, 0.95) };
            const open = elicitation.id === selected;
            return (
              <Fragment key={elicitation.id}>
              <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(elicitation.id); }}>
                <td className="da-rowtable__pick"><PlotToggle open={open} label={elicitation.id} onToggle={() => onSelect(open ? "" : elicitation.id)} /></td>
                <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daElicitation", id: elicitation.id }); }}>{elicitation.id}</button></td>
                <td className="da-rowtable__wrap">{elicitation.issue.trim().length > 0 ? elicitation.issue : "—"}</td>
                <td>{QUANTITY_LABELS[elicitation.quantity]}</td>
                <td className="da-rowtable__num">{elicitation.experts.filter((expert) => expert.role === "EVALUATOR").length}</td>
                <td>{elicitation.pooling === "LINEAR" ? "Linear" : "Logarithmic"}</td>
                <td className="da-rowtable__num">{statText(result?.mean)}</td>
                <td className="da-rowtable__num">{statText(result?.p05)}</td>
                <td className="da-rowtable__num">{statText(result?.p95)}</td>
                <td className="da-rowtable__wrap">{elicitation.integrator.trim().length > 0 ? elicitation.integrator : "—"}</td>
                <td>{listCell(elicitationUsers(da, elicitation.id), "parameters")}</td>
              </tr>
              {open && <DetailRow span={11} width={wrapWidth - 16}><JudgmentDetail elicitation={elicitation} /></DetailRow>}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SourcesScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const [tab, setTab] = useState<SourcesTab>("library");
  const [sourceId, setSourceId] = useState("");
  const [entryKey, setEntryKey] = useState("");
  const [parameterKey, setParameterKey] = useState("");
  const [elicitationKey, setElicitationKey] = useState("");
  const tabId = useId();
  const findings = sourceFindings(da);
  const sources = da.sources ?? [];
  const entryCount = sources.reduce((sum, source) => sum + libraryCount(source), 0);
  const sourced = da.parameters.filter(needsSourcing);
  const withPrior = sourced.filter((parameter) => parameterPrior(da, parameter) !== undefined).length;
  const selected = sources.find((source) => source.id === sourceId);
  const tabs: { id: SourcesTab; label: string }[] = [
    { id: "library", label: `Library (${sources.length})` },
    { id: "estimates", label: `Estimates (${entryCount})` },
    { id: "applicability", label: `Applicability (${withPrior} of ${sourced.length})` },
    { id: "judgment", label: `Expert judgment (${(da.elicitations ?? []).length})` },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = SOURCE_TAB_HEADS[tab];

  function addSource(): void {
    if (!editable) return;
    const id = nextCode("SRC", sources.map((source) => source.id));
    mutateDa((draft) => ({ ...draft, sources: [...(draft.sources ?? []), { id, name: "", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR", covers: "", boundaryConvention: "", failureCounting: "", quality: "", reference: "", entries: [] }] }));
    openDrawer({ kind: "daSource", id });
  }
  function addEntry(): void {
    if (!editable || selected === undefined) return;
    const id = nextCode("E", selected.entries.map((entry) => entry.id), 3);
    mutateDa((draft) => ({ ...draft, sources: (draft.sources ?? []).map((source) => (source.id === selected.id ? { ...source, entries: [...source.entries, { id, component: "", failureMode: "", quantity: "PER_DEMAND" }] } : source)) }));
    openDrawer({ kind: "daEntry", id: `${selected.id}|${id}` });
  }
  function addElicitation(): void {
    if (!editable) return;
    const id = nextCode("EJ", (da.elicitations ?? []).map((elicitation) => elicitation.id));
    mutateDa((draft) => ({ ...draft, elicitations: [...(draft.elicitations ?? []), { id, issue: "", objective: "", quantity: "PER_DEMAND", importance: "MEDIUM", complexity: "MEDIUM", structure: "PANEL", experts: [], pooling: "LINEAR", integrator: "", responsibility: "INTEGRATOR" }] }));
    openDrawer({ kind: "daElicitation", id });
  }

  return (
    <div className="da-step">
      <DaTabs label="Source sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="da-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && tab === "library" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "daCatalog", id: "catalog" })}>Add from catalog</button>}
              {editable && tab === "library" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}>Add source</button>}
              {editable && tab === "estimates" && <button type="button" className="posnav__btn posnav__btn--sm" disabled={selected === undefined} onClick={() => { if (selected !== undefined) openDrawer({ kind: "daImport", id: selected.id }); }}>Import file</button>}
              {editable && tab === "estimates" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={selected === undefined} onClick={addEntry}>Add estimate</button>}
              {editable && tab === "judgment" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addElicitation}>Add elicitation</button>}
            </div>
          </div>
          {tab === "estimates" && editable && selected === undefined && sources.length > 0 && <p className="da-needs__meta da-needs__meta--lead">Choose one source to import or add estimates into it.</p>}
          {tab === "library" ? (
            <LibraryTable openDrawer={openDrawer} />
          ) : tab === "estimates" ? (
            <EstimatesTable sourceId={sourceId} setSourceId={setSourceId} selected={entryKey} onSelect={setEntryKey} openDrawer={openDrawer} />
          ) : tab === "applicability" ? (
            <ApplicabilityTable selected={parameterKey} onSelect={setParameterKey} openDrawer={openDrawer} />
          ) : tab === "judgment" ? (
            <JudgmentTable selected={elicitationKey} onSelect={setElicitationKey} openDrawer={openDrawer} />
          ) : (
            <NeedChecksTable findings={findings} openDrawer={openDrawer} />
          )}
        </div>
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

function NumberInput({ label, value, disabled, onChange }: { label: string; value: number | undefined; disabled: boolean; onChange: (value: number | undefined) => void }): JSX.Element {
  return <WorkbookInput aria-label={label} className="posfield__input da-form__number" type="number" min="0" step="any" value={value ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, onChange)} />;
}

function YearsRow({ from, to, disabled, onChange }: { from: string | undefined; to: string | undefined; disabled: boolean; onChange: (from: string | undefined, to: string | undefined) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="Years" htmlFor={id}>
      <WorkbookInput id={id} aria-label="Years from" className="posfield__input da-form__number" value={from ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value.trim().length === 0 ? undefined : event.target.value.trim(), to)} />
      <span className="da-form__unit">to</span>
      <WorkbookInput aria-label="Years to" className="posfield__input da-form__number" value={to ?? ""} disabled={disabled} onChange={(event) => onChange(from, event.target.value.trim().length === 0 ? undefined : event.target.value.trim())} />
    </FormRow>
  );
}

function SourceWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const source = (da.sources ?? []).find((candidate) => candidate.id === id);
  if (source === undefined) return null;
  const dis = !editable;
  const origins: DaSourceOrigin[] = ["SAME_TECHNOLOGY", "OTHER_NUCLEAR", "NONNUCLEAR"];
  function patch(next: Partial<DaSource>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, sources: (draft.sources ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...withoutSource(draft, id), sources: (draft.sources ?? []).filter((candidate) => candidate.id !== id) }));
  }
  return (
    <>
      <ModalHead cap={`Source · ${EVIDENCE_KIND_LABELS[source.kind]} · DA-C1`} title={source.name.trim().length > 0 ? `${source.id} · ${source.name}` : source.id} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Name" value={source.name} disabled={dis} onChange={(name) => patch({ name })} />
        <FormRow label="Evidence" htmlFor={`${fieldId}-kind`}>
          <select id={`${fieldId}-kind`} className="posfield__select" value={source.kind} disabled={dis} onChange={(event) => { const kind = evidenceKindOf(event.target.value); if (kind !== undefined) patch({ kind }); }}>
            {EVIDENCE_ORDER.map((kind) => <option key={kind} value={kind}>{EVIDENCE_KIND_LABELS[kind]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Origin" htmlFor={`${fieldId}-origin`}>
          <select id={`${fieldId}-origin`} className="posfield__select" value={source.origin} disabled={dis} onChange={(event) => { const origin = origins.find((candidate) => candidate === event.target.value); if (origin !== undefined) patch({ origin }); }}>
            {origins.map((origin) => <option key={origin} value={origin}>{SOURCE_ORIGIN_LABELS[origin]}</option>)}
          </select>
        </FormRow>
        <AreaRow label="What it covers" value={source.covers} disabled={dis} onChange={(covers) => patch({ covers })} />
        <YearsRow from={source.yearsFrom} to={source.yearsTo} disabled={dis} onChange={(yearsFrom, yearsTo) => patch({ yearsFrom, yearsTo })} />
        <AreaRow label="How it draws boundaries" value={source.boundaryConvention} disabled={dis} onChange={(boundaryConvention) => patch({ boundaryConvention })} />
        <AreaRow label="How it counts failures" value={source.failureCounting} disabled={dis} onChange={(failureCounting) => patch({ failureCounting })} />
        <AreaRow label="Quality" value={source.quality} disabled={dis} onChange={(quality) => patch({ quality })} />
        <AreaRow label="Reference" value={source.reference} disabled={dis} onChange={(reference) => patch({ reference })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove source</button>}
      </FormFoot>
    </>
  );
}

function distributionDraft(type: string, current: ParameterDistribution | undefined, mean: number | undefined): ParameterDistribution | undefined {
  const base = mean ?? 1e-3;
  switch (type) {
    case DistributionType.BETA: return current?.type === DistributionType.BETA ? current : { type: DistributionType.BETA, alpha: 0.5, betaParam: Math.max(0.5 / base - 0.5, 1) };
    case DistributionType.GAMMA: return current?.type === DistributionType.GAMMA ? current : { type: DistributionType.GAMMA, shape: 0.5, rate: 0.5 / base };
    case DistributionType.LOGNORMAL: return current?.type === DistributionType.LOGNORMAL ? current : { type: DistributionType.LOGNORMAL, median: base, errorFactor: 10 };
    case DistributionType.NORMAL: return current?.type === DistributionType.NORMAL ? current : { type: DistributionType.NORMAL, mean: base, stdDev: base / 2 };
    case DistributionType.WEIBULL: return current?.type === DistributionType.WEIBULL ? current : { type: DistributionType.WEIBULL, scale: base, shape: 1, location: 0 };
    case DistributionType.EXPONENTIAL: return current?.type === DistributionType.EXPONENTIAL ? current : { type: DistributionType.EXPONENTIAL, failureRate: 1 / base };
    case DistributionType.POINT_ESTIMATE: return { type: DistributionType.POINT_ESTIMATE, value: base };
    default: return undefined;
  }
}

function DistributionFields({ value, disabled, onChange }: { value: ParameterDistribution; disabled: boolean; onChange: (value: ParameterDistribution) => void }): JSX.Element | null {
  switch (value.type) {
    case DistributionType.BETA: return (
      <>
        <span className="da-form__unit">α</span><NumberInput label="Alpha" value={value.alpha} disabled={disabled} onChange={(alpha) => { if (alpha !== undefined) onChange({ ...value, alpha }); }} />
        <span className="da-form__unit">β</span><NumberInput label="Beta" value={value.betaParam} disabled={disabled} onChange={(betaParam) => { if (betaParam !== undefined) onChange({ ...value, betaParam }); }} />
      </>
    );
    case DistributionType.GAMMA: return (
      <>
        <span className="da-form__unit">α</span><NumberInput label="Shape" value={value.shape} disabled={disabled} onChange={(shape) => { if (shape !== undefined) onChange({ ...value, shape }); }} />
        <span className="da-form__unit">β</span><NumberInput label="Rate" value={value.rate} disabled={disabled} onChange={(rate) => { if (rate !== undefined) onChange({ ...value, rate }); }} />
      </>
    );
    case DistributionType.LOGNORMAL: return (
      <>
        <span className="da-form__unit">median</span><NumberInput label="Median" value={value.median} disabled={disabled} onChange={(median) => { if (median !== undefined) onChange({ ...value, median }); }} />
        <span className="da-form__unit">EF</span><NumberInput label="Error factor" value={value.errorFactor} disabled={disabled} onChange={(errorFactor) => { if (errorFactor !== undefined) onChange({ ...value, errorFactor }); }} />
      </>
    );
    case DistributionType.NORMAL: return (
      <>
        <span className="da-form__unit">mean</span><NumberInput label="Normal mean" value={value.mean} disabled={disabled} onChange={(mean) => { if (mean !== undefined) onChange({ ...value, mean }); }} />
        <span className="da-form__unit">sd</span><NumberInput label="Standard deviation" value={value.stdDev} disabled={disabled} onChange={(stdDev) => { if (stdDev !== undefined) onChange({ ...value, stdDev }); }} />
      </>
    );
    case DistributionType.WEIBULL: return (
      <>
        <span className="da-form__unit">scale</span><NumberInput label="Weibull scale" value={value.scale} disabled={disabled} onChange={(scale) => { if (scale !== undefined) onChange({ ...value, scale }); }} />
        <span className="da-form__unit">shape</span><NumberInput label="Weibull shape" value={value.shape} disabled={disabled} onChange={(shape) => { if (shape !== undefined) onChange({ ...value, shape }); }} />
        <span className="da-form__unit">from</span><NumberInput label="Weibull location" value={value.location} disabled={disabled} onChange={(location) => { if (location !== undefined) onChange({ ...value, location }); }} />
      </>
    );
    case DistributionType.EXPONENTIAL: return (
      <>
        <span className="da-form__unit">rate</span><NumberInput label="Exponential rate" value={value.failureRate} disabled={disabled} onChange={(failureRate) => { if (failureRate !== undefined) onChange({ ...value, failureRate }); }} />
      </>
    );
    case DistributionType.POINT_ESTIMATE: return <NumberInput label="Point value" value={value.value} disabled={disabled} onChange={(point) => { if (point !== undefined) onChange({ ...value, value: point }); }} />;
    default: return null;
  }
}

function EntryWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const [sourceId, entryId] = id.split("|");
  const source = (da.sources ?? []).find((candidate) => candidate.id === sourceId);
  const builtIn = useBuiltInEntries(source === undefined ? [] : [source]);
  const stored = source?.entries.find((candidate) => candidate.id === entryId);
  const published = builtIn.get(source?.catalogId ?? "")?.find((candidate) => candidate.id === entryId);
  const entry = stored ?? published;
  if (source === undefined || entry === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<DaSourceEntry>): void {
    if (!editable || entry === undefined) return;
    const copy = { ...entry, ...next };
    mutateDa((draft) => ({ ...draft, sources: (draft.sources ?? []).map((candidate) => (candidate.id !== sourceId ? candidate : stored === undefined ? { ...candidate, entries: [...candidate.entries, copy] } : { ...candidate, entries: candidate.entries.map((row) => (row.id === entryId ? copy : row)) })) }));
  }
  function remove(): void {
    if (!editable || sourceId === undefined || entryId === undefined) return;
    onClose();
    mutateDa((draft) => ({ ...withoutSource(draft, sourceId, entryId), sources: (draft.sources ?? []).map((candidate) => (candidate.id === sourceId ? { ...candidate, entries: candidate.entries.filter((row) => row.id !== entryId) } : candidate)) }));
  }
  function reset(): void {
    if (!editable || published === undefined) return;
    mutateDa((draft) => ({ ...draft, sources: (draft.sources ?? []).map((candidate) => (candidate.id === sourceId ? { ...candidate, entries: candidate.entries.map((row) => (row.id === entryId ? published : row)) } : candidate)) }));
  }
  const changed = stored !== undefined && published !== undefined && JSON.stringify(stored) !== JSON.stringify(published);
  const distribution = entry.distribution;
  return (
    <>
      <ModalHead cap={`Estimate · ${source.id} · DA-C1`} title={entry.component.trim().length > 0 ? `${entry.id} · ${entry.component}` : entry.id} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Component" value={entry.component} disabled={dis} onChange={(component) => patch({ component })} />
        <AreaRow label="Failure mode" value={entry.failureMode} disabled={dis} onChange={(failureMode) => patch({ failureMode })} />
        <FormRow label="Unit" htmlFor={`${fieldId}-unit`}>
          <select id={`${fieldId}-unit`} className="posfield__select" value={entry.quantity} disabled={dis} onChange={(event) => { if (isQuantity(event.target.value)) patch({ quantity: event.target.value }); }}>
            {QUANTITY_ORDER.map((quantity) => <option key={quantity} value={quantity}>{QUANTITY_LABELS[quantity]}</option>)}
          </select>
        </FormRow>
        <TextRow label="Table in the source" value={entry.table ?? ""} disabled={dis} onChange={(table) => patch({ table: table.trim().length === 0 ? undefined : table })} />
        <FormRow label="Distribution" htmlFor={`${fieldId}-dist`}>
          <select id={`${fieldId}-dist`} className="posfield__select" value={distribution?.type ?? ""} disabled={dis} onChange={(event) => patch({ distribution: distributionDraft(event.target.value, distribution, entry.mean) })}>
            {DISTRIBUTION_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
          {distribution !== undefined && <DistributionFields value={distribution} disabled={dis} onChange={(next) => patch({ distribution: next })} />}
        </FormRow>
        <FormRow label="Mean" htmlFor={`${fieldId}-mean`}>
          <WorkbookInput id={`${fieldId}-mean`} className="posfield__input da-form__number" type="number" min="0" step="any" value={entry.mean ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (mean) => patch({ mean }))} />
          <span className="da-form__unit">{QUANTITY_LABELS[entry.quantity]}</span>
        </FormRow>
        <FormRow label="Percentiles" htmlFor={`${fieldId}-p05`}>
          <span className="da-form__unit">5th</span><WorkbookInput id={`${fieldId}-p05`} aria-label="5th percentile" className="posfield__input da-form__number" type="number" min="0" step="any" value={entry.p05 ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (p05) => patch({ p05 }))} />
          <span className="da-form__unit">50th</span><NumberInput label="Median" value={entry.median} disabled={dis} onChange={(median) => patch({ median })} />
          <span className="da-form__unit">95th</span><NumberInput label="95th percentile" value={entry.p95} disabled={dis} onChange={(p95) => patch({ p95 })} />
        </FormRow>
        <FormRow label="Outer percentiles" htmlFor={`${fieldId}-p025`}>
          <span className="da-form__unit">2.5th</span><WorkbookInput id={`${fieldId}-p025`} aria-label="2.5th percentile" className="posfield__input da-form__number" type="number" min="0" step="any" value={entry.p025 ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (p025) => patch({ p025 }))} />
          <span className="da-form__unit">97.5th</span><NumberInput label="97.5th percentile" value={entry.p975} disabled={dis} onChange={(p975) => patch({ p975 })} />
        </FormRow>
        <FormRow label="Data" htmlFor={`${fieldId}-failures`}>
          <WorkbookInput id={`${fieldId}-failures`} aria-label="Failures" className="posfield__input da-form__number" type="number" min="0" step="any" value={entry.failures ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (failures) => patch({ failures }))} />
          <span className="da-form__unit">failures in</span>
          <NumberInput label="Exposure" value={entry.exposure} disabled={dis} onChange={(exposure) => patch({ exposure })} />
          <span className="da-form__unit">{EXPOSURE_LABELS[entry.quantity]}</span>
        </FormRow>
        <FormRow label="Population" htmlFor={`${fieldId}-population`}>
          <WorkbookInput id={`${fieldId}-population`} className="posfield__input da-form__number" type="number" min="0" step="1" value={entry.population ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (population) => patch({ population }))} />
          <span className="da-form__unit">components or trains in the data</span>
        </FormRow>
        <YearsRow from={entry.yearsFrom} to={entry.yearsTo} disabled={dis} onChange={(yearsFrom, yearsTo) => patch({ yearsFrom, yearsTo })} />
        <TextRow label="Method" value={entry.method ?? ""} disabled={dis} onChange={(method) => patch({ method: method.trim().length === 0 ? undefined : method })} />
        <AreaRow label="Boundary" value={entry.boundaryNote ?? ""} disabled={dis} onChange={(boundaryNote) => patch({ boundaryNote: boundaryNote.trim().length === 0 ? undefined : boundaryNote })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && changed && <button type="button" className="posnav__btn posnav__btn--sm" onClick={reset}>Restore the published values</button>}
        {editable && published === undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove estimate</button>}
      </FormFoot>
    </>
  );
}

function CatalogAction({ sourceId, users, editable, onAdd, onRemove, onOpen }: { sourceId: string | undefined; users: number; editable: boolean; onAdd: () => void; onRemove: (sourceId: string) => void; onOpen: (sourceId: string) => void }): JSX.Element | null {
  if (sourceId === undefined) return editable ? <button type="button" className="posnav__btn posnav__btn--sm" onClick={onAdd}>Add</button> : null;
  return (
    <div className="da-catalog__action">
      <span className="da-catalog__in">In library as <button type="button" className="da-rowtable__name" onClick={() => onOpen(sourceId)}>{sourceId}</button></span>
      {editable && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove ${sourceId} from the library`} onClick={() => onRemove(sourceId)}>Remove</button>}
      {users > 0 && <span className="da-catalog__used">Used by {users} {users === 1 ? "parameter" : "parameters"}. Removing it also takes it out of their sources.</span>}
    </div>
  );
}

function CatalogWindow({ onClose, onRetarget }: { onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const inLibrary = new Map((da.sources ?? []).flatMap((source) => (source.catalogId === undefined ? [] : [[source.catalogId, source.id] as const])));
  function add(catalogId: string): void {
    if (!editable) return;
    const id = nextCode("SRC", (da.sources ?? []).map((source) => source.id));
    const source = daCatalogSource(catalogId, id);
    if (source === undefined) return;
    mutateDa((draft) => ({ ...draft, sources: [...(draft.sources ?? []), source] }));
  }
  function remove(sourceId: string): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...withoutSource(draft, sourceId), sources: (draft.sources ?? []).filter((candidate) => candidate.id !== sourceId) }));
  }
  return (
    <>
      <ModalHead cap="Source catalog · DA-C1" title="Published data sources" onClose={onClose} />
      <div className="modal__body da-form">
        <div className="da-table-wrap da-pick">
          <table className="postable da-rowtable" aria-label="Published data sources">
            <thead><tr><th>Source</th><th>What it provides</th><th>Evidence</th><th>Built-in data</th><th /></tr></thead>
            <tbody>
              {DA_SOURCE_CATALOG.map((entry) => (
                <tr key={entry.id}>
                  <td className="da-rowtable__wrap">{entry.name}</td>
                  <td className="da-rowtable__wrap">{entry.provides}</td>
                  <td>{EVIDENCE_KIND_LABELS[entry.kind]}</td>
                  <td>{entry.estimates.toLocaleString()} estimates</td>
                  <td className="da-catalog__cell"><CatalogAction sourceId={inLibrary.get(entry.id)} users={sourceUsers(da, inLibrary.get(entry.id) ?? "").length} editable={editable} onAdd={() => add(entry.id)} onRemove={remove} onOpen={(id) => onRetarget({ kind: "daSource", id })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function ImportWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Partial<Record<DaImportField, number>> | undefined>(undefined);
  const [quantity, setQuantity] = useState("");
  const source = (da.sources ?? []).find((candidate) => candidate.id === id);
  const builtIn = useBuiltInEntries(source === undefined ? [] : [source]);
  if (source === undefined) return null;
  const table = text.trim().length === 0 ? [] : parseDelimited(text);
  const headers = table[0] ?? [];
  const body = table.slice(1);
  const active = mapping ?? guessMapping(headers);
  const fixed = isQuantity(quantity) ? quantity : undefined;
  const result = entriesFromRows(body, active, fixed, libraryEntries(source, builtIn.get(source.catalogId ?? "")).map((entry) => entry.id));
  function load(next: string): void {
    setText(next);
    setMapping(undefined);
  }
  function setField(field: DaImportField, value: string): void {
    const next: Partial<Record<DaImportField, number>> = {};
    for (const spec of IMPORT_FIELDS) {
      const index = spec.field === field ? (value.length === 0 ? undefined : Number(value)) : active[spec.field];
      if (index !== undefined) next[spec.field] = index;
    }
    setMapping(next);
  }
  function importRows(): void {
    if (!editable || result.entries.length === 0) return;
    mutateDa((draft) => ({ ...draft, sources: (draft.sources ?? []).map((candidate) => (candidate.id === id ? { ...candidate, entries: [...candidate.entries, ...result.entries] } : candidate)) }));
    onClose();
  }
  return (
    <>
      <ModalHead cap={`Import · ${source.id} · DA-C1`} title={`Import estimates into ${source.name.trim().length > 0 ? source.name : source.id}`} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="File" htmlFor={`${fieldId}-file`}>
          <input id={`${fieldId}-file`} type="file" accept=".csv,.tsv,.txt" disabled={!editable} onChange={(event) => { const file = event.target.files?.[0]; if (file !== undefined) void file.text().then(load); }} />
        </FormRow>
        <FormRow label="Or paste rows" htmlFor={`${fieldId}-paste`} top>
          <textarea id={`${fieldId}-paste`} className="posfield__textarea" rows={4} value={text} disabled={!editable} onChange={(event) => load(event.target.value)} />
        </FormRow>
        {headers.length > 0 && (
          <>
            <FormRow label="Unit for all rows" htmlFor={`${fieldId}-unit`}>
              <select id={`${fieldId}-unit`} className="posfield__select" value={quantity} onChange={(event) => setQuantity(event.target.value)}>
                <option value="">From the unit or distribution column</option>
                {QUANTITY_ORDER.map((value) => <option key={value} value={value}>{QUANTITY_LABELS[value]}</option>)}
              </select>
            </FormRow>
            <div className="da-import__map">
              {IMPORT_FIELDS.map((spec) => (
                <label key={spec.field} className="da-import__field">
                  <span className="da-form__unit">{spec.label}</span>
                  <select className="posfield__select" value={active[spec.field] === undefined ? "" : String(active[spec.field])} onChange={(event) => setField(spec.field, event.target.value)}>
                    <option value="">Not mapped</option>
                    {headers.map((header, index) => <option key={`${header}-${index}`} value={String(index)}>{header.length > 0 ? header : `Column ${index + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="da-needs__meta">{result.entries.length} {result.entries.length === 1 ? "row is" : "rows are"} ready to import. {result.skipped} {result.skipped === 1 ? "row lacks" : "rows lack"} a unit, a name or a value and will be skipped.</p>
          </>
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={result.entries.length === 0} onClick={importRows}>Import {result.entries.length} {result.entries.length === 1 ? "row" : "rows"}</button>}
      </FormFoot>
    </>
  );
}

interface EstimateChoice {
  value: string;
  label: string;
  detail: string;
  search: string;
}

function pickDetail(entry: DaSourceEntry): string {
  if (entry.mean !== undefined) return `mean ${sciText(entry.mean)}`;
  if (entry.distribution?.type === DistributionType.POINT_ESTIMATE) return `value ${sciText(entry.distribution.value)}`;
  if (entry.median !== undefined) return `median ${sciText(entry.median)}`;
  return dataText(entry);
}

function entryChoices(da: DataAnalysis, builtIn: ReadonlyMap<string, DaSourceEntry[]>): EstimateChoice[] {
  const entries = (da.sources ?? []).flatMap((source) => libraryEntries(source, builtIn.get(source.catalogId ?? "")).filter((entry) => entry.quantity !== "FACTOR").map((entry) => {
    const label = `${source.id} · ${entry.id} · ${entry.component} · ${entry.failureMode}`;
    const detail = `${pickDetail(entry)} · ${QUANTITY_LABELS[entry.quantity]}`;
    return { value: `S|${source.id}|${entry.id}`, label, detail, search: `${source.id} ${source.name} ${entrySearchText(entry)}`.toLowerCase() };
  }));
  const judgments = (da.elicitations ?? []).map((elicitation) => ({
    value: `J|${elicitation.id}`,
    label: `${elicitation.id} · ${elicitation.issue}`,
    detail: `Expert judgment · ${QUANTITY_LABELS[elicitation.quantity]}`,
    search: `${elicitation.id} ${elicitation.issue} expert judgment`.toLowerCase(),
  }));
  return [...entries, ...judgments];
}

function EstimatePicker({ id, value, choices, disabled, onChoose }: { id: string; value: string; choices: EstimateChoice[]; disabled: boolean; onChoose: (value: string) => void }): JSX.Element {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const current = choices.find((choice) => choice.value === value);
  const words = searchWords(query);
  const found = choices.filter((choice) => matchesWords(choice.search, words));
  const shown = found.slice(0, PICK_LIMIT);
  function close(): void {
    setOpen(false);
    setQuery("");
  }
  function choose(choice: EstimateChoice): void {
    onChoose(choice.value);
    close();
  }
  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const choice = shown[active];
      if (choice !== undefined) choose(choice);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }
  return (
    <div className="da-picker">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="posfield__input da-picker__input"
        placeholder={current === undefined ? "Search by source, code, component or failure mode" : current.label}
        value={open ? query : current?.label ?? ""}
        disabled={disabled}
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={close}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKey}
      />
      {open && (
        <ul id={listId} role="listbox" className="da-picker__list">
          {shown.map((choice, index) => (
            <li
              key={choice.value}
              role="option"
              aria-selected={index === active}
              className={`da-picker__option${index === active ? " da-picker__option--active" : ""}`}
              onMouseDown={(event) => { event.preventDefault(); choose(choice); }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="da-picker__label">{choice.label}</span>
              <span className="da-picker__detail">{choice.detail}</span>
            </li>
          ))}
          {found.length === 0 && <li className="da-picker__more">No estimate matches.</li>}
          {found.length > shown.length && <li className="da-picker__more">{shown.length} of {found.length} shown. Type more words to narrow the list.</li>}
        </ul>
      )}
    </div>
  );
}

function choiceKey(use: DaSourceUse): string {
  return use.elicitationId !== undefined ? `J|${use.elicitationId}` : use.sourceId !== undefined && use.entryId !== undefined ? `S|${use.sourceId}|${use.entryId}` : "";
}

function FactorRows({ factors, disabled, onChange }: { factors: DaTransferFactor[]; disabled: boolean; onChange: (factors: DaTransferFactor[]) => void }): JSX.Element {
  function patch(id: string, next: Partial<DaTransferFactor>): void {
    onChange(factors.map((factor) => (factor.id === id ? { ...factor, ...next } : factor)));
  }
  return (
    <div className="da-factors">
      {factors.map((factor) => (
        <div key={factor.id} className="da-factor">
          <div className="da-factor__line">
            <WorkbookInput aria-label="Factor name" placeholder="Factor" className="posfield__input" value={factor.name} disabled={disabled} onChange={(event) => patch(factor.id, { name: event.target.value })} />
            <span className="da-form__unit">low</span><NumberInput label="Low" value={factor.low} disabled={disabled} onChange={(low) => { if (low !== undefined) patch(factor.id, { low }); }} />
            <span className="da-form__unit">nominal</span><NumberInput label="Nominal" value={factor.nominal} disabled={disabled} onChange={(nominal) => { if (nominal !== undefined) patch(factor.id, { nominal }); }} />
            <span className="da-form__unit">high</span><NumberInput label="High" value={factor.high} disabled={disabled} onChange={(high) => { if (high !== undefined) patch(factor.id, { high }); }} />
            {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange(factors.filter((candidate) => candidate.id !== factor.id))}>Remove</button>}
          </div>
          <WorkbookInput aria-label="Factor basis" placeholder="Basis" className="posfield__input" value={factor.basis} disabled={disabled} onChange={(event) => patch(factor.id, { basis: event.target.value })} />
        </div>
      ))}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-factors__add" onClick={() => onChange([...factors, { id: nextCode("F", factors.map((factor) => factor.id), 1), name: "", nominal: 1, low: 1, high: 1, basis: "" }])}>Add factor</button>}
    </div>
  );
}

function UseBlock({ parameter, use, disabled, builtIn, onPatch, onPick, onRemove, onPrior }: { parameter: DataAnalysisParameter; use: DaSourceUse; disabled: boolean; builtIn: ReadonlyMap<string, DaSourceEntry[]>; onPatch: (next: Partial<DaSourceUse>) => void; onPick: (sourceId: string, entryId: string) => void; onRemove: () => void; onPrior: () => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const choices = useMemo(() => entryChoices(da, builtIn), [da, builtIn]);
  const verdicts: DaSourceVerdict[] = ["APPLIES", "SCALED", "REJECTED"];
  const boundaries: DaBoundaryMatch[] = ["SAME", "ADJUSTED", "DIFFERENT"];
  const key = choiceKey(use);
  const base = sourceUseBase(da, use);
  const needsHours = needsStandbyHours(da, use, parameter.quantificationModel);
  const needsYearHours = needsHoursPerYear(da, use, parameter.quantificationModel);
  const isPrior = parameter.priorUseId === use.id;
  function choose(value: string): void {
    const parts = value.split("|");
    if (parts[0] === "J") onPatch({ elicitationId: parts[1], sourceId: undefined, entryId: undefined, hoursPerYear: undefined, standbyHours: undefined });
    else if (parts[0] === "S" && parts[1] !== undefined && parts[2] !== undefined) onPick(parts[1], parts[2]);
  }
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{base?.label ?? "New source"}</legend>
      <FormRow label="Estimate" htmlFor={`${fieldId}-from`}>
        <EstimatePicker id={`${fieldId}-from`} value={key} choices={choices} disabled={disabled} onChoose={choose} />
      </FormRow>
      <FormRow label="Verdict" htmlFor={`${fieldId}-verdict`}>
        <select id={`${fieldId}-verdict`} className="posfield__select" value={use.verdict} disabled={disabled} onChange={(event) => { const verdict = verdicts.find((candidate) => candidate === event.target.value); if (verdict !== undefined) onPatch({ verdict }); }}>
          {verdicts.map((verdict) => <option key={verdict} value={verdict}>{VERDICT_LABELS[verdict]}</option>)}
        </select>
        <label className="da-form__check">
          <input type="radio" name={`prior-${parameter.uuid}`} checked={isPrior} disabled={disabled || use.verdict === "REJECTED"} onChange={onPrior} />
          <span>Prior</span>
        </label>
      </FormRow>
      <FormRow label="Boundary" htmlFor={`${fieldId}-boundary`}>
        <select id={`${fieldId}-boundary`} className="posfield__select" value={use.boundary} disabled={disabled} onChange={(event) => { const boundary = boundaries.find((candidate) => candidate === event.target.value); if (boundary !== undefined) onPatch({ boundary }); }}>
          {boundaries.map((boundary) => <option key={boundary} value={boundary}>{BOUNDARY_MATCH_LABELS[boundary]}</option>)}
        </select>
      </FormRow>
      <AreaRow label={use.verdict === "REJECTED" ? "Why it does not apply" : "Why it applies"} value={use.reason} disabled={disabled} onChange={(reason) => onPatch({ reason })} />
      {(needsYearHours || use.hoursPerYear !== undefined) && (
        <FormRow label="Hours per year" htmlFor={`${fieldId}-year`}>
          <WorkbookInput id={`${fieldId}-year`} className="posfield__input da-form__number" type="number" min="0" step="any" value={use.hoursPerYear ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (hoursPerYear) => onPatch({ hoursPerYear }))} />
          <span className="da-form__unit">hours of exposure in a year, 8760 for a calendar year</span>
        </FormRow>
      )}
      {(needsHours || use.standbyHours !== undefined) && (
        <FormRow label="Exposure hours" htmlFor={`${fieldId}-hours`}>
          <WorkbookInput id={`${fieldId}-hours`} className="posfield__input da-form__number" type="number" min="0" step="any" value={use.standbyHours ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (standbyHours) => onPatch({ standbyHours }))} />
          <span className="da-form__unit">hours per demand, half the test interval for a standby failure</span>
        </FormRow>
      )}
      {use.verdict === "SCALED" && (
        <FormRow label="Transfer factors" htmlFor={`${fieldId}-factors`} top>
          <FactorRows factors={use.factors ?? []} disabled={disabled} onChange={(factors) => onPatch({ factors })} />
        </FormRow>
      )}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this source</button>}
    </fieldset>
  );
}

function SourcingWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const sources = da.sources ?? [];
  const builtIn = useBuiltInEntries(sources);
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const uses = parameter.sourceUses ?? [];
  const prior = parameterPrior(da, parameter);
  const waiting = waitingSources(sources, builtIn);
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, parameters: draft.parameters.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function patchUse(useId: string, next: Partial<DaSourceUse>): void {
    patch({ sourceUses: uses.map((use) => (use.id === useId ? { ...use, ...next } : use)), priorUseId: next.verdict === "REJECTED" && parameter?.priorUseId === useId ? undefined : parameter?.priorUseId });
  }
  function addUse(): void {
    const useId = nextCode("U", uses.map((use) => use.id), 1);
    patch({ sourceUses: [...uses, { id: useId, verdict: "APPLIES", boundary: "SAME", reason: "" }], priorUseId: parameter?.priorUseId ?? useId });
  }
  function removeUse(useId: string): void {
    patch({ sourceUses: uses.filter((use) => use.id !== useId), priorUseId: parameter?.priorUseId === useId ? undefined : parameter?.priorUseId });
  }
  function pickEntry(useId: string, sourceId: string, entryId: string): void {
    if (!editable) return;
    const source = sources.find((candidate) => candidate.id === sourceId);
    const entry = source === undefined ? undefined : libraryEntries(source, builtIn.get(source.catalogId ?? "")).find((candidate) => candidate.id === entryId);
    if (entry === undefined) return;
    mutateDa((draft) => {
      const kept = withStoredEntry(draft, sourceId, entry);
      return { ...kept, parameters: kept.parameters.map((candidate) => (candidate.uuid !== id ? candidate : { ...candidate, sourceUses: (candidate.sourceUses ?? []).map((use) => (use.id === useId ? { ...use, sourceId, entryId, elicitationId: undefined, hoursPerYear: undefined, standbyHours: undefined } : use)) })) };
    });
  }
  return (
    <>
      <ModalHead cap={`Applicability · ${modelSpecOf(parameter.quantificationModel)?.label ?? "No model"} · DA-C1`} title={parameter.name.trim().length > 0 ? `${parameter.uuid} · ${parameter.name}` : parameter.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="Evidence rung" htmlFor={`${fieldId}-rung`}>
          <select id={`${fieldId}-rung`} className="posfield__select" value={parameter.evidenceKind ?? ""} disabled={dis} onChange={(event) => patch({ evidenceKind: evidenceKindOf(event.target.value) })}>
            {parameter.evidenceKind === undefined && <option value="">Not set</option>}
            {EVIDENCE_ORDER.map((kind) => <option key={kind} value={kind}>{EVIDENCE_KIND_LABELS[kind]}</option>)}
          </select>
        </FormRow>
        <AreaRow label="Why not more direct" value={parameter.evidenceReason ?? ""} disabled={dis} onChange={(evidenceReason) => patch({ evidenceReason: evidenceReason.trim().length === 0 ? undefined : evidenceReason })} />
        {uses.map((use) => (
          <UseBlock key={use.id} parameter={parameter} use={use} disabled={dis} builtIn={builtIn} onPatch={(next) => patchUse(use.id, next)} onPick={(sourceId, entryId) => pickEntry(use.id, sourceId, entryId)} onRemove={() => removeUse(use.id)} onPrior={() => patch({ priorUseId: use.id })} />
        ))}
        {waiting > 0 && uses.length > 0 && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
        {uses.length === 0 && <p className="posmuted">No source is considered yet.</p>}
        {prior === undefined && uses.length > 0 && <p className="posmuted">Mark the source the estimate starts from as the prior.</p>}
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addUse}>Consider a source</button>}
      </FormFoot>
    </>
  );
}

function ExpertRows({ experts, disabled, onChange }: { experts: DaElicitationExpert[]; disabled: boolean; onChange: (experts: DaElicitationExpert[]) => void }): JSX.Element {
  const roles: DaExpertRole[] = ["EVALUATOR", "PROPONENT", "RESOURCE"];
  function patch(id: string, next: Partial<DaElicitationExpert>): void {
    onChange(experts.map((expert) => (expert.id === id ? { ...expert, ...next } : expert)));
  }
  return (
    <div className="da-experts">
      {experts.map((expert) => (
        <fieldset key={expert.id} className="da-use">
          <legend className="da-use__legend">{expert.name.trim().length > 0 ? expert.name : expert.id}</legend>
          <div className="da-factor__line">
            <WorkbookInput aria-label="Expert" placeholder="Name or label" className="posfield__input" value={expert.name} disabled={disabled} onChange={(event) => patch(expert.id, { name: event.target.value })} />
            <select aria-label="Role" className="posfield__select" value={expert.role} disabled={disabled} onChange={(event) => { const role = roles.find((candidate) => candidate === event.target.value); if (role !== undefined) patch(expert.id, { role }); }}>
              {roles.map((role) => <option key={role} value={role}>{EXPERT_ROLE_LABELS[role]}</option>)}
            </select>
            <label className="da-form__check"><input type="checkbox" checked={expert.outside} disabled={disabled} onChange={(event) => patch(expert.id, { outside: event.target.checked })} /><span>Outside the team</span></label>
          </div>
          <WorkbookInput aria-label="Expertise" placeholder="Expertise" className="posfield__input" value={expert.expertise} disabled={disabled} onChange={(event) => patch(expert.id, { expertise: event.target.value })} />
          {expert.role === "EVALUATOR" && (
            <div className="da-factor__line">
              <span className="da-form__unit">5th</span><NumberInput label="5th percentile" value={expert.p05} disabled={disabled} onChange={(p05) => patch(expert.id, { p05 })} />
              <span className="da-form__unit">50th</span><NumberInput label="50th percentile" value={expert.median} disabled={disabled} onChange={(median) => patch(expert.id, { median })} />
              <span className="da-form__unit">95th</span><NumberInput label="95th percentile" value={expert.p95} disabled={disabled} onChange={(p95) => patch(expert.id, { p95 })} />
              <span className="da-form__unit">weight</span><NumberInput label="Weight" value={expert.weight} disabled={disabled} onChange={(weight) => patch(expert.id, { weight })} />
            </div>
          )}
          <div className="da-factor__line">
            <label className="da-form__check"><input type="checkbox" checked={expert.acceptsResponsibility} disabled={disabled} onChange={(event) => patch(expert.id, { acceptsResponsibility: event.target.checked })} /><span>Accepts responsibility for this judgment</span></label>
            {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange(experts.filter((candidate) => candidate.id !== expert.id))}>Remove</button>}
          </div>
        </fieldset>
      ))}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-factors__add" onClick={() => onChange([...experts, { id: nextCode("X", experts.map((expert) => expert.id), 1), name: "", role: "EVALUATOR", outside: true, expertise: "", acceptsResponsibility: false }])}>Add expert</button>}
    </div>
  );
}

function ElicitationWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const elicitation = (da.elicitations ?? []).find((candidate) => candidate.id === id);
  if (elicitation === undefined) return null;
  const dis = !editable;
  const levels: DaJudgmentLevel[] = ["LOW", "MEDIUM", "HIGH"];
  function patch(next: Partial<DaElicitation>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, elicitations: (draft.elicitations ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withoutElicitation(draft, id));
  }
  return (
    <>
      <ModalHead cap="Expert elicitation · Section 4.2" title={elicitation.issue.trim().length > 0 ? `${elicitation.id} · ${elicitation.issue}` : elicitation.id} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Technical issue" value={elicitation.issue} disabled={dis} onChange={(issue) => patch({ issue })} />
        <AreaRow label="Objective and use" value={elicitation.objective} disabled={dis} onChange={(objective) => patch({ objective })} />
        <FormRow label="Unit" htmlFor={`${fieldId}-unit`}>
          <select id={`${fieldId}-unit`} className="posfield__select" value={elicitation.quantity} disabled={dis} onChange={(event) => { if (isQuantity(event.target.value)) patch({ quantity: event.target.value }); }}>
            {QUANTITY_ORDER.map((value) => <option key={value} value={value}>{QUANTITY_LABELS[value]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Importance" htmlFor={`${fieldId}-importance`}>
          <select id={`${fieldId}-importance`} className="posfield__select" value={elicitation.importance} disabled={dis} onChange={(event) => { const importance = levels.find((level) => level === event.target.value); if (importance !== undefined) patch({ importance }); }}>
            {levels.map((level) => <option key={level} value={level}>{JUDGMENT_LEVEL_LABELS[level]}</option>)}
          </select>
          <span className="da-form__unit">complexity</span>
          <select aria-label="Complexity" className="posfield__select" value={elicitation.complexity} disabled={dis} onChange={(event) => { const complexity = levels.find((level) => level === event.target.value); if (complexity !== undefined) patch({ complexity }); }}>
            {levels.map((level) => <option key={level} value={level}>{JUDGMENT_LEVEL_LABELS[level]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Process" htmlFor={`${fieldId}-structure`}>
          <select id={`${fieldId}-structure`} className="posfield__select" value={elicitation.structure} disabled={dis} onChange={(event) => patch({ structure: event.target.value === "SINGLE_EVALUATOR" ? "SINGLE_EVALUATOR" : "PANEL" })}>
            <option value="PANEL">Panel of evaluators with an integrator</option>
            <option value="SINGLE_EVALUATOR">One evaluator who also integrates</option>
          </select>
        </FormRow>
        <AreaRow label="Why outside experts" value={elicitation.outsideReason ?? ""} disabled={dis} onChange={(outsideReason) => patch({ outsideReason: outsideReason.trim().length === 0 ? undefined : outsideReason })} />
        <FormRow label="Experts" htmlFor={`${fieldId}-experts`} top>
          <ExpertRows experts={elicitation.experts} disabled={dis} onChange={(experts) => patch({ experts })} />
        </FormRow>
        <FormRow label="Pooling" htmlFor={`${fieldId}-pooling`}>
          <select id={`${fieldId}-pooling`} className="posfield__select" value={elicitation.pooling} disabled={dis} onChange={(event) => patch({ pooling: event.target.value === "LOGARITHMIC" ? "LOGARITHMIC" : "LINEAR" })}>
            <option value="LINEAR">Linear pool of the evaluators</option>
            <option value="LOGARITHMIC">Logarithmic pool of the evaluators</option>
          </select>
        </FormRow>
        <TextRow label="Owner of the result" value={elicitation.integrator} disabled={dis} onChange={(integrator) => patch({ integrator })} />
        <FormRow label="Responsibility" htmlFor={`${fieldId}-resp`}>
          <select id={`${fieldId}-resp`} className="posfield__select" value={elicitation.responsibility} disabled={dis} onChange={(event) => patch({ responsibility: event.target.value === "SHARED" ? "SHARED" : "INTEGRATOR" })}>
            <option value="INTEGRATOR">Held by the integrator</option>
            <option value="SHARED">Shared with the experts</option>
          </select>
        </FormRow>
        <FormRow label="Completed" htmlFor={`${fieldId}-date`}>
          <WorkbookInput id={`${fieldId}-date`} className="posfield__input da-form__date" type="date" value={elicitation.completed ?? ""} disabled={dis} onChange={(event) => patch({ completed: event.target.value.length === 0 ? undefined : event.target.value })} />
        </FormRow>
        <TextRow label="Record" value={elicitation.reference ?? ""} disabled={dis} onChange={(reference) => patch({ reference: reference.trim().length === 0 ? undefined : reference })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove elicitation</button>}
      </FormFoot>
    </>
  );
}

function SourceWindows({ context, onClose, onRetarget }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  switch (context.kind) {
    case "daSource": return <SourceWindow id={context.id} onClose={onClose} />;
    case "daEntry": return <EntryWindow id={context.id} onClose={onClose} />;
    case "daSourcing": return <SourcingWindow id={context.id} onClose={onClose} />;
    case "daElicitation": return <ElicitationWindow id={context.id} onClose={onClose} />;
    case "daCatalog": return <CatalogWindow onClose={onClose} onRetarget={onRetarget} />;
    case "daImport": return <ImportWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { SOURCE_WINDOW_KINDS, SourceWindows, SourcesScreen, WIDE_WINDOW_KINDS, distributionText };
