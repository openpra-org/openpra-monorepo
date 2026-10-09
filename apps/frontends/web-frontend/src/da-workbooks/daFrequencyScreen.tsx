import { Fragment, JSX, useId, useMemo, useState } from "react";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaBoundaryMatch,
  DaEvidence,
  DaEvidenceOrigin,
  DaFrequencyBasis,
  DaFrequencyComparison,
  DaFrequencyMethod,
  DaFrequencyPart,
  DaFrequencyPer,
  DaInitiatorCategory,
  DaInitiatorNeed,
  DaPriorForm,
  DaSourceEntry,
} from "interfaces-mef-types/da/data-analysis";
import { expressionReferences } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyLawSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { useUncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { DaProvenanceChip, DaTabs, DetailRow, DetailToggle, FieldList, FormFoot, FormRow, ModalHead, PlotToggle } from "./daShared";
import { DistributionChart, useElementWidth, type DistributionSeries } from "./daDistributionChart";
import { frequencyEstimate, frequencyFindings, frequencyParameters, modulesOf, perLabel, shareOf, stateShares, type DaFrequencyComputation, type DaFrequencyEstimate, type DaFrequencyPartEstimate } from "./daFrequencies";
import { expressionSpread, lawSummary, parameterPoint, pointState, quantileOf } from "./daLaws";
import { libraryEntries, nextCode, withStoredEntry } from "./daSourcing";
import { nextParameterId } from "./daSelectors";
import { useDaWorkbook } from "./daWorkbookContext";
import {
  BOUNDARY_MATCH_LABELS,
  EVIDENCE_ORIGIN_LABELS,
  FREQUENCY_METHOD_LABELS,
  FREQUENCY_MODE_LABELS,
  FREQUENCY_PER_LABELS,
  INITIATOR_CATEGORY_LABELS,
  PRIOR_FORM_LABELS,
} from "./daViewData";
import { AreaRow, EstimateRows, NEED_PAGE, NeedChecksTable, NeedPager, PraxisValue, estimateText, praxisText, spreadFields, statText, waitNote, type DaDrawerContext } from "./daScreens";
import { EstimatePicker, NumberInput, TextRow, entrySearchText, useBuiltInEntries, waitingSources, type EstimateChoice } from "./daSourcesScreen";
import { useText } from "./daUnavailabilityScreen";

type FrequencyTab = "groups" | "evidence" | "estimates" | "comparison" | "checks";

type FrequencyMode = "CALCULATED" | "TYPED" | "LINKED";

const TAB_HEADS: Record<FrequencyTab, { title: string; sr: string }> = {
  groups: { title: "Groups", sr: "IE-C8 · DA-D1" },
  evidence: { title: "Evidence", sr: "IE-C1 · IE-C6 · IE-C7" },
  estimates: { title: "Estimates", sr: "DA-D1 · DA-D3 · IE-C19" },
  comparison: { title: "Comparison", sr: "IE-C16" },
  checks: { title: "Initiating event checks", sr: "IE-C1 to C19 · DA-D1 to D3" },
};

const COMPUTATION_LABELS: Record<DaFrequencyComputation, string> = {
  PRIOR: "Source as it is",
  POSTERIOR: "Bayes update with Poisson events",
};

const FREQUENCY_WINDOW_KINDS: ReadonlySet<string> = new Set(["daFrequency"]);

const CATEGORIES: DaInitiatorCategory[] = ["I", "II", "III", "IV"];

const PERS: DaFrequencyPer[] = ["CRITICAL_YEAR", "CALENDAR_YEAR", "SHUTDOWN_YEAR"];

const METHODS: DaFrequencyMethod[] = ["PRIOR", "BAYES"];

const FORMS: DaPriorForm[] = ["AS_PUBLISHED", "CONSTRAINED_NONINFORMATIVE", "JEFFREYS"];

const ORIGINS: DaEvidenceOrigin[] = ["TECHNOLOGY", "PLANT_RECORDS"];

const BOUNDARIES: DaBoundaryMatch[] = ["SAME", "ADJUSTED", "DIFFERENT"];

function nameOf(parameter: DataAnalysisParameter): string {
  return parameter.name.trim().length > 0 ? parameter.name : "Unnamed";
}

function modeOf(parameter: DataAnalysisParameter): FrequencyMode {
  if (parameter.valueMode === "LINKED") return "LINKED";
  if (parameter.valueMode === "CALCULATED") return "CALCULATED";
  return "TYPED";
}

function needOf(da: DataAnalysis, parameter: DataAnalysisParameter): DaInitiatorNeed | undefined {
  const needs = da.dataNeeds?.initiators ?? [];
  if (parameter.valueLink?.element === "IE") return needs.find((need) => need.id === parameter.valueLink?.needId);
  return needs.find((need) => need.parameterId === parameter.uuid);
}

function needPoint(need: DaInitiatorNeed | undefined): UncertaintyState<number> | undefined {
  const expression = need?.frequency?.expression;
  if (expression === undefined || expressionReferences(expression).length > 0) return undefined;
  return pointState(expression, "PER_YEAR");
}

function groupText(da: DataAnalysis, parameter: DataAnalysisParameter): string {
  return needOf(da, parameter)?.id ?? parameter.basicEventRef ?? "—";
}

function patchParameter(mutateDa: (mutator: (da: DataAnalysis) => DataAnalysis) => void, id: string, next: Partial<DataAnalysisParameter>): void {
  mutateDa((draft) => ({ ...draft, parameters: draft.parameters.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
}

function ratioText(ratio: number | undefined): string {
  if (ratio === undefined) return "—";
  return ratio >= 1 ? `${Number(ratio.toPrecision(2))} times` : `1/${Number((1 / ratio).toPrecision(2))}`;
}

function largestGap(estimate: DaFrequencyEstimate): number | undefined {
  const ratios = estimate.comparisons.flatMap((comparison) => (comparison.ratio === undefined ? [] : [comparison.ratio]));
  if (ratios.length === 0) return undefined;
  return ratios.reduce((worst, ratio) => (Math.max(ratio, 1 / ratio) > Math.max(worst, 1 / worst) ? ratio : worst));
}

function evidenceTotals(estimate: DaFrequencyEstimate): { events: number; years: number } {
  let events = 0;
  let years = 0;
  for (const part of estimate.parts) {
    for (const item of part.evidence) {
      if (!item.evidence.included || item.term === undefined) continue;
      events += item.term.failures;
      years += item.term.exposure;
    }
  }
  return { events, years };
}

function orderedParameters(da: DataAnalysis): DataAnalysisParameter[] {
  const order = new Map((da.dataNeeds?.initiators ?? []).map((need, index) => [need.parameterId ?? need.id, index]));
  return frequencyParameters(da).map((parameter, index) => ({ parameter, index })).sort((a, b) => (order.get(a.parameter.uuid) ?? 1e6 + a.index) - (order.get(b.parameter.uuid) ?? 1e6 + b.index)).map(({ parameter }) => parameter);
}

function GroupDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const need = needOf(da, parameter);
  const shares = stateShares(da.dataNeeds?.states ?? []);
  const states = (need?.stateIds ?? parameter.stateIds ?? []).map((id) => `${id} ${shares.get(id) === undefined ? "(no duration)" : `${Number(((shares.get(id) ?? 0) * 100).toPrecision(3))}%`}`);
  const basis = parameter.frequency;
  const held = need?.frequency;
  const ieValue = held === undefined ? "—" : `${praxisText(needPoint(need))} ${held.basis.split("-").join(" ")}, ${need?.valueHeldBy === "DA" ? `imported from ${need.valueHolderId ?? "DA"}` : "typed in IE"}`;
  return (
    <FieldList items={[
      { label: "Group", value: need === undefined ? "Not imported" : `${need.id} · ${need.name}` },
      { label: "Members", value: need === undefined || need.memberIds.length === 0 ? "—" : need.memberIds.join(", ") },
      { label: "States", value: states.length === 0 ? "—" : states.join(", ") },
      { label: "Modules", value: `${modulesOf(da)}${basis?.siteWide === true ? ", one event strikes them all" : ""}` },
      { label: "Category", value: basis?.category === undefined ? "Not sorted" : INITIATOR_CATEGORY_LABELS[basis.category] },
      { label: "Why this category", value: basis?.categoryReason ?? "—" },
      { label: "IE holds", value: ieValue },
    ]} />
  );
}

function EvidenceDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const estimate = frequencyEstimate(da, parameter);
  const items = estimate.parts.flatMap((part) => part.evidence.map((item) => ({
    label: `${part.part.label} · ${item.label}`,
    value: item.problem !== undefined ? item.problem : `${item.failures ?? "?"} events in ${item.exposure === undefined ? "?" : Number(item.exposure.toPrecision(5))} years, ${perLabel(part.part.per)}${item.evidence.included ? "" : ", left out"}${item.evidence.reason.trim().length > 0 ? `. ${item.evidence.reason}` : ""}`,
  })));
  return items.length === 0 ? <p className="posmuted">No events counted. The estimate rests on its sources.</p> : <FieldList items={items} />;
}

function summaryText(state: UncertaintyState<UncertaintyLawSummary> | undefined): string {
  if (state === undefined) return "—";
  if (state.status === "pending") return "…";
  if (state.status === "failed") return `PRAXIS failed: ${state.error}`;
  return `mean ${statText(state.value.mean)}, 5th ${statText(quantileOf(state.value, 0.05))}, 95th ${statText(quantileOf(state.value, 0.95))}`;
}

function partItems(da: DataAnalysis, estimate: DaFrequencyEstimate, part: DaFrequencyPartEstimate): { label: string; value: string }[] {
  const basis = part.posterior === undefined ? undefined : lawSummary("PER_YEAR", part.posterior, true);
  const plant = part.law === undefined ? undefined : lawSummary("PER_YEAR", part.law, true);
  const share = part.part.per === "CALENDAR_YEAR" ? "no state share" : `share ${Number(((part.share.share ?? 0) * 100).toPrecision(3))}% (${part.share.counted.join(", ")})`;
  return [
    { label: part.part.label, value: part.problem ?? `${part.use === undefined ? "No source" : useText(da, part.use)}, ${PRIOR_FORM_LABELS[part.form].toLowerCase()}, ${part.method === undefined ? "no method" : FREQUENCY_METHOD_LABELS[part.method].toLowerCase()}${part.computation === undefined ? "" : `, ${COMPUTATION_LABELS[part.computation].toLowerCase()}`}` },
    { label: `${part.part.label}, ${perLabel(part.part.per)}`, value: summaryText(basis) },
    { label: `${part.part.label}, to the plant`, value: part.factor === undefined ? "—" : `${share}${estimate.siteWide ? ", site-wide" : `, × ${estimate.modules} modules`}, ${summaryText(plant)}` },
  ];
}

function estimateSeries(estimate: DaFrequencyEstimate): { series: DistributionSeries[]; states: (UncertaintyState<UncertaintyLawSummary> | undefined)[] } {
  const series: DistributionSeries[] = [];
  const states: (UncertaintyState<UncertaintyLawSummary> | undefined)[] = [];
  const single = estimate.parts.length === 1;
  for (const part of estimate.parts) {
    if (part.law === undefined) continue;
    const state = lawSummary("PER_YEAR", part.law, true);
    states.push(state);
    if (state.status === "ready") series.push(single ? { key: "total", label: "Estimate", detail: "per plant-year", summary: state.value } : { key: `part-${part.part.id}`, label: part.part.label, detail: "contribution", summary: state.value });
    if (!single || part.prior === undefined || part.computation !== "POSTERIOR") continue;
    const prior = lawSummary("PER_YEAR", part.prior, true);
    states.push(prior);
    if (prior.status === "ready") series.push({ key: `prior-${part.part.id}`, label: "Before the events", detail: `${part.form === "CONSTRAINED_NONINFORMATIVE" ? "widened source" : "source"}, ${perLabel(part.part.per)}`, summary: prior.value });
  }
  return { series, states };
}

function EstimateDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [focus, setFocus] = useState("");
  const estimate = frequencyEstimate(da, parameter);
  const mode = modeOf(parameter);
  if (mode !== "CALCULATED") {
    const held = parameter.estimate;
    const law = held?.node === "VALUE" ? lawSummary("PER_YEAR", held.value.law, true) : undefined;
    return (
      <>
        <FieldList items={[
          { label: "Value from", value: FREQUENCY_MODE_LABELS[mode] },
          { label: "Estimate", value: estimateText(held) },
          { label: "Mean", value: praxisText(parameterPoint(parameter), " per plant-year") },
          ...spreadFields(held === undefined ? undefined : expressionSpread(held, "PER_YEAR")),
        ]} />
        {law?.status === "ready" && <DistributionChart series={[{ key: "value", label: parameter.uuid, detail: "per plant-year", summary: law.value }]} unit="per plant-year" />}
      </>
    );
  }
  const { series, states } = estimateSeries(estimate);
  const items = estimate.parts.flatMap((part) => partItems(da, estimate, part));
  const held = estimate.estimate;
  items.push({ label: "Estimate", value: held === undefined ? estimate.problem ?? (estimate.pending ? "…" : "—") : estimateText(held) });
  if (held !== undefined) items.push({ label: "Mean", value: praxisText(pointState(held, "PER_YEAR"), " per plant-year") }, ...spreadFields(expressionSpread(held, "PER_YEAR")));
  const note = waitNote(states);
  return (
    <>
      <FieldList items={items} />
      {note !== undefined && <p className="posmuted">{note}</p>}
      {series.length > 0 && <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : series[0]?.key} unit="per plant-year" onFocus={setFocus} />}
    </>
  );
}

function ComparisonDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const estimate = frequencyEstimate(da, parameter);
  const need = needOf(da, parameter);
  const items = estimate.comparisons.map((comparison) => ({
    label: `${comparison.label}, ${perLabel(comparison.comparison.per)}`,
    value: comparison.problem ?? (comparison.pending ? "…" : `${statText(comparison.value)} per plant-year, the estimate is ${ratioText(comparison.ratio)}${comparison.comparison.reason !== undefined && comparison.comparison.reason.trim().length > 0 ? `. ${comparison.comparison.reason}` : ""}`),
  }));
  const theirs = need?.valueHeldBy === "DA" ? undefined : needPoint(need);
  const ours = estimate.estimate === undefined ? undefined : pointState(estimate.estimate, "PER_YEAR");
  if (theirs !== undefined) items.push({ label: "IE's typed value", value: `${praxisText(theirs, " per plant-year")}${theirs.status === "ready" && ours?.status === "ready" && theirs.value > 0 ? `, the estimate is ${ratioText(ours.value / theirs.value)}` : ""}` });
  return items.length === 0 ? <p className="posmuted">No comparison yet. Compare with a generic or earlier value in the frequency window (IE-C16).</p> : <FieldList items={items} />;
}

function FrequencyTable({ tab, selected, onSelect, openDrawer }: { tab: Exclude<FrequencyTab, "checks">; selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = orderedParameters(da);
  if (parameters.length === 0) return <p className="posmuted">No frequency parameter yet. Import the IE groups in Step 02, then add their parameters.</p>;
  const rows = parameters.filter((parameter) => {
    if (show === "all") return true;
    const mode = modeOf(parameter);
    if (show === "CALCULATED" || show === "TYPED" || show === "LINKED") return mode === show;
    return frequencyEstimate(da, parameter).problem !== undefined && mode === "CALCULATED";
  });
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE);
  const headers = tab === "groups" ? ["Group", "Category", "Value from"] : tab === "evidence" ? ["Group", "Events", "Years"] : tab === "estimates" ? ["Group", "Mean"] : ["Group", "Estimate", "Largest gap"];
  const span = headers.length + 2;
  function cells(parameter: DataAnalysisParameter): JSX.Element {
    const estimate = frequencyEstimate(da, parameter);
    const mode = modeOf(parameter);
    const group = <td className="da-rowtable__text">{groupText(da, parameter)}</td>;
    if (tab === "groups") return <>{group}<td className="da-rowtable__text">{parameter.frequency?.category ?? "—"}</td><td className="da-rowtable__text">{FREQUENCY_MODE_LABELS[mode]}</td></>;
    if (tab === "evidence") {
      const totals = evidenceTotals(estimate);
      return <>{group}<td className="da-rowtable__num">{mode === "CALCULATED" ? totals.events : "—"}</td><td className="da-rowtable__num">{mode === "CALCULATED" ? Number(totals.years.toPrecision(4)) : "—"}</td></>;
    }
    if (tab === "estimates") return <>{group}<td className="da-rowtable__num">{mode === "CALCULATED" && estimate.problem !== undefined ? <span className="da-severity da-severity--error">Cannot compute</span> : <PraxisValue state={parameterPoint(parameter)} />}</td></>;
    return <>{group}<td className="da-rowtable__num"><PraxisValue state={parameterPoint(parameter)} /></td><td className="da-rowtable__num">{ratioText(largestGap(estimate))}</td></>;
  }
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={show} onChange={(event) => { setShow(event.target.value); setPage(0); }}>
          <option value="all">All groups</option>
          <option value="CALCULATED">Estimated in DA</option>
          <option value="TYPED">Typed in DA</option>
          <option value="LINKED">Imported from IE</option>
          <option value="open">Not computed</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label={TAB_HEADS[tab].title}>
          <thead><tr><th className="da-rowtable__pick">{tab === "estimates" ? "Plot" : "Details"}</th><th>Parameter</th>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                    <td className="da-rowtable__pick">{tab === "estimates" ? <PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /> : <DetailToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} />}</td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daFrequency", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                    {cells(parameter)}
                  </tr>
                  {open && (
                    <DetailRow span={span} width={wrapWidth - 18}>
                      {tab === "groups" ? <GroupDetail parameter={parameter} /> : tab === "evidence" ? <EvidenceDetail parameter={parameter} /> : tab === "estimates" ? <EstimateDetail parameter={parameter} /> : <ComparisonDetail parameter={parameter} />}
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

function unmappedGroups(da: DataAnalysis): DaInitiatorNeed[] {
  const ids = new Set(da.parameters.map((parameter) => parameter.uuid));
  return (da.dataNeeds?.initiators ?? []).filter((need) => need.included && (need.parameterId === undefined || !ids.has(need.parameterId)));
}

function FrequencyScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  useUncertaintyVersion();
  const [tab, setTab] = useState<FrequencyTab>("groups");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const tabId = useId();
  const parameters = frequencyParameters(da);
  const findings = frequencyFindings(da);
  const missing = unmappedGroups(da);
  const estimated = parameters.filter((parameter) => { if (parameter.valueMode !== "CALCULATED") return false; const estimate = frequencyEstimate(da, parameter); return estimate.problem === undefined && !estimate.pending; }).length;
  const events = parameters.reduce((total, parameter) => total + (parameter.valueMode === "CALCULATED" ? evidenceTotals(frequencyEstimate(da, parameter)).events : 0), 0);
  const tabs: { id: FrequencyTab; label: string }[] = [
    { id: "groups", label: `Groups (${parameters.length})` },
    { id: "evidence", label: `Evidence (${events})` },
    { id: "estimates", label: `Estimates (${estimated} of ${parameters.length})` },
    { id: "comparison", label: "Comparison" },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = TAB_HEADS[tab];
  function addImported(): void {
    if (!editable || missing.length === 0) return;
    mutateDa((draft) => {
      const ids = new Set(draft.parameters.map((parameter) => parameter.uuid));
      const created = new Map<string, string>();
      const added = missing.map((need): DataAnalysisParameter => {
        const id = nextParameterId(ids);
        ids.add(id);
        created.set(need.id, id);
        return { uuid: id, name: need.name, parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", valueMode: "CALCULATED", stateIds: [...need.stateIds], basicEventRef: need.id, frequency: { parts: [] }, implementsSrs: [{ sr: "DA-D1", hlr: "D" }, { sr: "DA-D3", hlr: "D" }] };
      });
      const needs = draft.dataNeeds;
      return {
        ...draft,
        parameters: [...draft.parameters, ...added],
        dataNeeds: needs === undefined ? needs : { ...needs, initiators: needs.initiators.map((need) => (created.has(need.id) ? { ...need, parameterId: created.get(need.id) } : need)) },
      };
    });
  }
  return (
    <div className="da-step">
      <DaTabs label="Initiating event sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="da-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && tab === "groups" && missing.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addImported}>Add {missing.length} {missing.length === 1 ? "parameter" : "parameters"} for imported groups</button>}
            </div>
          </div>
          {tab === "checks" ? (
            <NeedChecksTable findings={findings} openDrawer={openDrawer} />
          ) : (
            <FrequencyTable key={tab} tab={tab} selected={keys[tab] ?? ""} onSelect={(key) => setKeys((current) => ({ ...current, [tab]: key }))} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

function StatesRow({ per, value, disabled, onChange }: { per: DaFrequencyPer; value: string[]; disabled: boolean; onChange: (value: string[]) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const states = da.dataNeeds?.states ?? [];
  const shares = stateShares(states);
  const share = shareOf(da, per, value);
  return (
    <FormRow label="States" top>
      <div className="da-form__checks">
        {states.length === 0 && <span className="posmuted">Import the POS states in Step 02 to convert the frequency to the plant.</span>}
        {states.map((state) => (
          <label key={state.id} className="da-form__check">
            <input type="checkbox" checked={value.includes(state.id)} disabled={disabled} onChange={(event) => onChange(event.target.checked ? [...value, state.id] : value.filter((id) => id !== state.id))} />
            <span>{state.id} · {state.name}{shares.get(state.id) === undefined ? "" : `, ${Number(((shares.get(state.id) ?? 0) * 100).toPrecision(3))}%`}</span>
          </label>
        ))}
        {per !== "CALENDAR_YEAR" && states.length > 0 && <span className="da-form__unit">{share.share === undefined ? "No counted state yet" : `${Number((share.share * 100).toPrecision(3))}% of the year counts`}</span>}
      </div>
    </FormRow>
  );
}

function FrequencyEvidenceBlock({ evidence, disabled, choices, onPatch, onPick, onRemove }: { evidence: DaEvidence; disabled: boolean; choices: EstimateChoice[]; onPatch: (next: Partial<DaEvidence>) => void; onPick: (sourceId: string, entryId: string) => void; onRemove: () => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const fid = (name: string): string => `${fieldId}-${name}`;
  const key = evidence.sourceId !== undefined && evidence.entryId !== undefined ? `${evidence.sourceId}|${evidence.entryId}` : "";
  const needsEntry = evidence.failuresFrom === "ENTRY" || evidence.exposureFrom === "ENTRY";
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{evidence.id}{evidence.label !== undefined && evidence.label.trim().length > 0 ? ` · ${evidence.label}` : ""}</legend>
      <TextRow label="Name" value={evidence.label ?? ""} disabled={disabled} onChange={(label) => onPatch({ label: label.trim().length === 0 ? undefined : label })} />
      <FormRow label="Origin" htmlFor={fid("origin")}>
        <select id={fid("origin")} className="posfield__select" value={evidence.origin} disabled={disabled} onChange={(event) => { const next = ORIGINS.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ origin: next }); }}>
          {ORIGINS.map((candidate) => <option key={candidate} value={candidate}>{EVIDENCE_ORIGIN_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      <FormRow label="Events from" htmlFor={fid("events-from")}>
        <select id={fid("events-from")} className="posfield__select" value={evidence.failuresFrom} disabled={disabled} onChange={(event) => onPatch({ failuresFrom: event.target.value === "ENTRY" ? "ENTRY" : event.target.value === "RECORDS" ? "RECORDS" : "TYPED" })}>
          <option value="TYPED">Typed</option>
          <option value="ENTRY">A library estimate</option>
          <option value="RECORDS">Judged records</option>
        </select>
        {evidence.failuresFrom === "TYPED" && <><NumberInput label="Events" value={evidence.failures} disabled={disabled} onChange={(failures) => onPatch({ failures })} /><span className="da-form__unit">events</span></>}
      </FormRow>
      {evidence.failuresFrom === "RECORDS" && (
        <FormRow label="Record set" htmlFor={fid("set")}>
          <select id={fid("set")} className="posfield__select" value={evidence.recordSetId ?? ""} disabled={disabled} onChange={(event) => onPatch({ recordSetId: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">Not chosen</option>
            {(da.recordSets ?? []).map((set) => <option key={set.id} value={set.id}>{set.id} · {set.name}</option>)}
          </select>
        </FormRow>
      )}
      <FormRow label="Years from" htmlFor={fid("years-from")}>
        <select id={fid("years-from")} className="posfield__select" value={evidence.exposureFrom === "ENTRY" ? "ENTRY" : "TYPED"} disabled={disabled} onChange={(event) => onPatch({ exposureFrom: event.target.value === "ENTRY" ? "ENTRY" : "TYPED", unit: "YEARS" })}>
          <option value="TYPED">Typed</option>
          <option value="ENTRY">A library estimate</option>
        </select>
        {evidence.exposureFrom !== "ENTRY" && <><NumberInput label="Years" value={evidence.exposure} disabled={disabled} onChange={(exposure) => onPatch({ exposure, unit: "YEARS" })} /><span className="da-form__unit">years in the part's basis</span></>}
      </FormRow>
      {needsEntry && (
        <FormRow label="Library estimate" htmlFor={fid("entry")}>
          <EstimatePicker id={fid("entry")} value={key} choices={choices} disabled={disabled} onChoose={(value) => { const [sourceId, entryId] = value.split("|"); if (sourceId !== undefined && entryId !== undefined) onPick(sourceId, entryId); }} />
        </FormRow>
      )}
      <TextRow label="From year" value={evidence.yearsFrom ?? ""} disabled={disabled} onChange={(text) => onPatch({ yearsFrom: text.trim().length === 0 ? undefined : text })} />
      <TextRow label="To year" value={evidence.yearsTo ?? ""} disabled={disabled} onChange={(text) => onPatch({ yearsTo: text.trim().length === 0 ? undefined : text })} />
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
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove these events</button>}
    </fieldset>
  );
}

function FrequencyPartBlock({ parameter, part, members, disabled, choices, onPatch, onPick, onRemove }: { parameter: DataAnalysisParameter; part: DaFrequencyPart; members: string[]; disabled: boolean; choices: EstimateChoice[]; onPatch: (next: Partial<DaFrequencyPart>) => void; onPick: (evidenceId: string, sourceId: string, entryId: string) => void; onRemove: () => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const fid = (name: string): string => `${fieldId}-${name}`;
  const uses = (parameter.sourceUses ?? []).filter((use) => use.verdict !== "REJECTED");
  const evidence = part.evidence ?? [];
  function setEvidence(next: DaEvidence[]): void {
    onPatch({ evidence: next });
  }
  function addEvidence(): void {
    setEvidence([...evidence, { id: nextCode("EV", evidence.map((item) => item.id), 1), origin: da.plantStage === "OPERATIONAL" ? "PLANT_RECORDS" : "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", unit: "YEARS", boundary: "SAME", reason: "", included: true }]);
  }
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{part.id} · {part.label}</legend>
      <TextRow label="Name" value={part.label} disabled={disabled} onChange={(label) => onPatch({ label })} />
      {members.length > 0 && (
        <FormRow label="Initiators" top>
          <div className="da-form__checks">
            {members.map((member) => (
              <label key={member} className="da-form__check">
                <input type="checkbox" checked={(part.memberIds ?? []).includes(member)} disabled={disabled} onChange={(event) => onPatch({ memberIds: event.target.checked ? [...(part.memberIds ?? []), member] : (part.memberIds ?? []).filter((id) => id !== member) })} />
                <span>{member}</span>
              </label>
            ))}
          </div>
        </FormRow>
      )}
      <FormRow label="Counted per" htmlFor={fid("per")}>
        <select id={fid("per")} className="posfield__select" value={part.per} disabled={disabled} onChange={(event) => { const next = PERS.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ per: next }); }}>
          {PERS.map((candidate) => <option key={candidate} value={candidate}>{FREQUENCY_PER_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      {part.per !== "CALENDAR_YEAR" && <StatesRow per={part.per} value={part.stateIds ?? []} disabled={disabled} onChange={(stateIds) => onPatch({ stateIds })} />}
      <FormRow label="Source" htmlFor={fid("use")}>
        <select id={fid("use")} className="posfield__select" value={part.useId ?? ""} disabled={disabled} onChange={(event) => onPatch({ useId: event.target.value.length === 0 ? undefined : event.target.value })}>
          <option value="">{uses.length === 0 ? "Consider sources in Step 04 first" : "No source"}</option>
          {uses.map((use) => <option key={use.id} value={use.id}>{useText(da, use)}</option>)}
        </select>
      </FormRow>
      <FormRow label="Prior form" htmlFor={fid("form")}>
        <select id={fid("form")} className="posfield__select" value={part.priorForm ?? "AS_PUBLISHED"} disabled={disabled} onChange={(event) => { const next = FORMS.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ priorForm: next }); }}>
          {FORMS.map((candidate) => <option key={candidate} value={candidate}>{PRIOR_FORM_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      <FormRow label="Method" htmlFor={fid("method")}>
        <select id={fid("method")} className="posfield__select" value={part.method ?? ""} disabled={disabled} onChange={(event) => onPatch({ method: METHODS.find((candidate) => candidate === event.target.value) })}>
          {part.method === undefined && <option value="">Not chosen</option>}
          {METHODS.map((candidate) => <option key={candidate} value={candidate}>{FREQUENCY_METHOD_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      {evidence.map((item) => (
        <FrequencyEvidenceBlock
          key={item.id}
          evidence={item}
          disabled={disabled}
          choices={choices}
          onPatch={(next) => setEvidence(evidence.map((candidate) => (candidate.id === item.id ? { ...candidate, ...next } : candidate)))}
          onPick={(sourceId, entryId) => onPick(item.id, sourceId, entryId)}
          onRemove={() => setEvidence(evidence.filter((candidate) => candidate.id !== item.id))}
        />
      ))}
      <AreaRow label="Basis" value={part.reason ?? ""} disabled={disabled} onChange={(text) => onPatch({ reason: text.trim().length === 0 ? undefined : text })} />
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addEvidence}>Add events</button>}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this part</button>}
    </fieldset>
  );
}

function ComparisonBlock({ parameter, comparison, disabled, onPatch, onRemove }: { parameter: DataAnalysisParameter; comparison: DaFrequencyComparison; disabled: boolean; onPatch: (next: Partial<DaFrequencyComparison>) => void; onRemove: () => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const uses = parameter.sourceUses ?? [];
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{comparison.id}</legend>
      <FormRow label="Compared with" htmlFor={`${fieldId}-use`}>
        <select id={`${fieldId}-use`} className="posfield__select" value={comparison.useId} disabled={disabled} onChange={(event) => onPatch({ useId: event.target.value })}>
          {!uses.some((use) => use.id === comparison.useId) && <option value={comparison.useId}>{comparison.useId.length === 0 ? "Not chosen" : comparison.useId}</option>}
          {uses.map((use) => <option key={use.id} value={use.id}>{useText(da, use)}</option>)}
        </select>
      </FormRow>
      <FormRow label="Counted per" htmlFor={`${fieldId}-per`}>
        <select id={`${fieldId}-per`} className="posfield__select" value={comparison.per} disabled={disabled} onChange={(event) => { const next = PERS.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ per: next }); }}>
          {PERS.map((candidate) => <option key={candidate} value={candidate}>{FREQUENCY_PER_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      <AreaRow label="Why a gap is acceptable" value={comparison.reason ?? ""} disabled={disabled} onChange={(text) => onPatch({ reason: text.trim().length === 0 ? undefined : text })} />
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this comparison</button>}
    </fieldset>
  );
}

function countChoices(da: DataAnalysis, builtIn: ReadonlyMap<string, DaSourceEntry[]>): EstimateChoice[] {
  return (da.sources ?? []).flatMap((source) => libraryEntries(source, builtIn.get(source.catalogId ?? "")).filter((entry) => entry.quantity === "PER_YEAR" && (entry.failures !== undefined || entry.exposure !== undefined)).map((entry) => ({
    value: `${source.id}|${entry.id}`,
    label: `${source.id} · ${entry.id} · ${entry.component} · ${entry.failureMode}`,
    detail: `${entry.failures ?? "?"} events in ${entry.exposure ?? "?"} years`,
    search: `${source.id} ${source.name} ${entrySearchText(entry)}`.toLowerCase(),
  })));
}

function FrequencyWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const sources = da.sources ?? [];
  const builtIn = useBuiltInEntries(sources);
  const choices = useMemo(() => countChoices(da, builtIn), [da, builtIn]);
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const mode = modeOf(parameter);
  const need = needOf(da, parameter);
  const basis: DaFrequencyBasis = parameter.frequency ?? { parts: [] };
  const waiting = waitingSources(sources, builtIn);
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (editable) patchParameter(mutateDa, id, next);
  }
  function patchBasis(next: Partial<DaFrequencyBasis>): void {
    patch({ frequency: { ...basis, ...next } });
  }
  function setMode(value: string): void {
    if (value === "LINKED") {
      if (need !== undefined) patch({ valueMode: "LINKED", valueLink: { element: "IE", needId: need.id } });
      return;
    }
    patch({ valueMode: value === "TYPED" ? "TYPED" : "CALCULATED", valueLink: undefined, frequency: basis });
  }
  function setParts(parts: DaFrequencyPart[]): void {
    patchBasis({ parts });
  }
  function addPart(): void {
    const partId = nextCode("P", basis.parts.map((part) => part.id), 1);
    setParts([...basis.parts, { id: partId, label: basis.parts.length === 0 ? "Whole group" : `Part ${basis.parts.length + 1}`, per: "CRITICAL_YEAR", stateIds: (parameter?.stateIds ?? []).filter((state) => (da.dataNeeds?.states ?? []).some((candidate) => candidate.id === state && (candidate.mode === "POWER" || candidate.mode === "STARTUP"))), priorForm: "AS_PUBLISHED", method: "PRIOR" }]);
  }
  function setComparisons(comparisons: DaFrequencyComparison[]): void {
    patchBasis({ comparisons });
  }
  function pick(partId: string, evidenceId: string, sourceId: string, entryId: string): void {
    if (!editable) return;
    const source = sources.find((candidate) => candidate.id === sourceId);
    const entry = source === undefined ? undefined : libraryEntries(source, builtIn.get(source.catalogId ?? "")).find((candidate) => candidate.id === entryId);
    if (entry === undefined) return;
    mutateDa((draft) => {
      const kept = withStoredEntry(draft, sourceId, entry);
      return {
        ...kept,
        parameters: kept.parameters.map((candidate) => {
          const current = candidate.frequency;
          if (candidate.uuid !== id || current === undefined) return candidate;
          return { ...candidate, frequency: { ...current, parts: current.parts.map((part) => (part.id !== partId ? part : { ...part, evidence: (part.evidence ?? []).map((item) => (item.id === evidenceId ? { ...item, sourceId, entryId } : item)) })) } };
        }),
      };
    });
  }
  return (
    <>
      <ModalHead cap="Initiating event frequency · DA-D1 · IE-C8" title={`${parameter.uuid} · ${nameOf(parameter)}`} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Name" value={parameter.name} disabled={dis} onChange={(name) => patch({ name })} />
        <FormRow label="Value from" htmlFor={fid("mode")}>
          <select id={fid("mode")} className="posfield__select" value={mode} disabled={dis} onChange={(event) => setMode(event.target.value)}>
            <option value="CALCULATED">{FREQUENCY_MODE_LABELS.CALCULATED}</option>
            <option value="TYPED">{FREQUENCY_MODE_LABELS.TYPED}</option>
            <option value="LINKED" disabled={need === undefined}>{FREQUENCY_MODE_LABELS.LINKED}</option>
          </select>
        </FormRow>
        {mode === "LINKED" && <p className="da-needs__meta">{need === undefined ? "No imported IE group maps to this parameter." : `The value follows IE's ${need.id}${need.valueHeldBy === "DA" ? ", which IE imports from DA. Pick one owner." : "."}`}</p>}
        {mode === "TYPED" && <EstimateRows parameter={parameter} disabled={dis} onPatch={patch} />}
        {mode === "CALCULATED" && (
          <>
            <FormRow label="Category" htmlFor={fid("category")}>
              <select id={fid("category")} className="posfield__select" value={basis.category ?? ""} disabled={dis} onChange={(event) => patchBasis({ category: CATEGORIES.find((candidate) => candidate === event.target.value) })}>
                {basis.category === undefined && <option value="">Not sorted</option>}
                {CATEGORIES.map((candidate) => <option key={candidate} value={candidate}>{INITIATOR_CATEGORY_LABELS[candidate]}</option>)}
              </select>
            </FormRow>
            <AreaRow label="Why this category" value={basis.categoryReason ?? ""} disabled={dis} onChange={(text) => patchBasis({ categoryReason: text.trim().length === 0 ? undefined : text })} />
            <FormRow label="Strikes the site" htmlFor={fid("site")}>
              <select id={fid("site")} className="posfield__select" value={basis.siteWide === undefined ? "" : basis.siteWide ? "yes" : "no"} disabled={dis} onChange={(event) => patchBasis({ siteWide: event.target.value === "" ? undefined : event.target.value === "yes" })}>
                <option value="">Not stated</option>
                <option value="no">No, each module on its own</option>
                <option value="yes">Yes, every module at once</option>
              </select>
              <span className="da-form__unit">{modulesOf(da)} {modulesOf(da) === 1 ? "module" : "modules"} per plant</span>
            </FormRow>
            {basis.siteWide === true && <AreaRow label="Why it strikes the site" value={basis.siteWideReason ?? ""} disabled={dis} onChange={(text) => patchBasis({ siteWideReason: text.trim().length === 0 ? undefined : text })} />}
            {basis.parts.map((part) => (
              <FrequencyPartBlock
                key={part.id}
                parameter={parameter}
                part={part}
                members={need?.memberIds ?? []}
                disabled={dis}
                choices={choices}
                onPatch={(next) => setParts(basis.parts.map((candidate) => (candidate.id === part.id ? { ...candidate, ...next } : candidate)))}
                onPick={(evidenceId, sourceId, entryId) => pick(part.id, evidenceId, sourceId, entryId)}
                onRemove={() => setParts(basis.parts.filter((candidate) => candidate.id !== part.id))}
              />
            ))}
            {basis.parts.length === 0 && <p className="posmuted">No part yet. Consider the sources in Step 04 Applicability, then add the whole group as one part, or one part per initiator or per operating mode.</p>}
            {(basis.comparisons ?? []).map((comparison) => (
              <ComparisonBlock
                key={comparison.id}
                parameter={parameter}
                comparison={comparison}
                disabled={dis}
                onPatch={(next) => setComparisons((basis.comparisons ?? []).map((candidate) => (candidate.id === comparison.id ? { ...candidate, ...next } : candidate)))}
                onRemove={() => setComparisons((basis.comparisons ?? []).filter((candidate) => candidate.id !== comparison.id))}
              />
            ))}
            {waiting > 0 && basis.parts.some((part) => (part.evidence ?? []).some((item) => item.failuresFrom === "ENTRY" || item.exposureFrom === "ENTRY")) && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
            <AreaRow label="Basis" value={basis.basis ?? ""} disabled={dis} onChange={(text) => patchBasis({ basis: text.trim().length === 0 ? undefined : text })} />
          </>
        )}
        <FormRow label="Risk significant" htmlFor={fid("risk")}>
          <select id={fid("risk")} className="posfield__select" value={parameter.isRiskSignificant === true ? "yes" : "no"} disabled={dis} onChange={(event) => patch({ isRiskSignificant: event.target.value === "yes" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daSourcing", id })}>Consider sources</button>
        {editable && mode === "CALCULATED" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setComparisons([...(basis.comparisons ?? []), { id: nextCode("C", (basis.comparisons ?? []).map((comparison) => comparison.id), 1), useId: "", per: "CRITICAL_YEAR" }])}>Add comparison</button>}
        {editable && mode === "CALCULATED" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addPart}>Add part</button>}
      </FormFoot>
    </>
  );
}

function FrequencyWindows({ context, onClose, onRetarget }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  return context.kind === "daFrequency" ? <FrequencyWindow id={context.id} onClose={onClose} onRetarget={onRetarget} /> : null;
}

export { FREQUENCY_WINDOW_KINDS, FrequencyScreen, FrequencyWindows };
