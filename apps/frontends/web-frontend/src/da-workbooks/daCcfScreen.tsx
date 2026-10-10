import { Fragment, JSX, useId, useMemo, useState } from "react";
import type {
  CcfParameterEstimation,
  DataAnalysis,
  DaBoundaryMatch,
  DaCcfEvent,
  DaCcfEvidence,
  DaCcfImportKind,
  DaCcfMethod,
  DaCcfTesting,
  DaEvidenceOrigin,
  DaSource,
  DaSourceEntry,
} from "interfaces-mef-types/da/data-analysis";
import { ccfFactorVector, type CcfFactorModel } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyLawSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { useUncertaintyVersion, type UncertaintyState } from "../newly-developed-methods/shared/useUncertainty";
import { CcfFactorEditor, ccfFactorDraft, type VectorOption } from "../newly-developed-methods/shared/uncertainEditor";
import { numberText } from "../newly-developed-methods/shared/uncertainText";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { DaProvenanceChip, DaTabs, DetailRow, DetailToggle, FieldList, FormFoot, FormRow, ModalHead, PlotToggle } from "./daShared";
import { DistributionChart, useElementWidth, type DistributionSeries } from "./daDistributionChart";
import { BFR_PARTS, KIND_LABELS, preciseText, MODEL_LABELS, ccfEventCount, ccfFindings, ccfLabelOf, ccfResult, ccfVectorLabel, factorsText, inlineFactors, kindOf, memberParameterIds, modelOfEstimate, shareFromNeeds, type DaCcfLevel, type DaCcfResult } from "./daCcf";
import { KIND_MODEL, ccfSurvey, evidenceChoiceRows, rowIdsFor, sizesFit, sizesText, type DaCcfEvidenceChoice, type DaCcfModel, type DaCcfSurvey } from "./daCcfRows";
import { lawSummary } from "./daLaws";
import { libraryEntries, nextCode, withStoredEntry } from "./daSourcing";
import { useDaWorkbook } from "./daWorkbookContext";
import { BOUNDARY_MATCH_LABELS, CCF_METHOD_LABELS, CCF_TESTING_LABELS, EVIDENCE_ORIGIN_LABELS } from "./daViewData";
import { AreaRow, NEED_PAGE, NeedChecksTable, NeedPager, numberFrom, statText, waitNote, type DaDrawerContext } from "./daScreens";
import { EstimatePicker, NumberInput, TextRow, useBuiltInEntries, waitingSources, type EstimateChoice } from "./daSourcesScreen";

type CcfTab = "groups" | "events" | "factors" | "results" | "checks";

const TAB_HEADS: Record<CcfTab, { title: string; sr: string }> = {
  groups: { title: "Groups", sr: "DA-D7 · DA-D8" },
  events: { title: "Shared-cause events", sr: "DA-D8 · DA-D9" },
  factors: { title: "Factors", sr: "DA-D7 · DA-D8" },
  results: { title: "Results", sr: "DA-D7" },
  checks: { title: "Common cause checks", sr: "DA-D7 · DA-D8 · DA-D9" },
};

const CCF_WINDOW_KINDS: ReadonlySet<string> = new Set(["daCcfGroup", "daCcfEvents", "daCcfFactors"]);

const TESTINGS: DaCcfTesting[] = ["STAGGERED", "NON_STAGGERED"];

const METHODS: DaCcfMethod[] = ["PRIOR", "BAYES", "TYPED"];

const MODELS: DaCcfModel[] = ["ALPHA_FACTOR", "MGL", "BETA_FACTOR", "PHI_FACTOR", "BINOMIAL_FAILURE_RATE"];

const ORIGINS: DaEvidenceOrigin[] = ["TECHNOLOGY", "PLANT_RECORDS"];

const BOUNDARIES: DaBoundaryMatch[] = ["SAME", "ADJUSTED", "DIFFERENT"];

const UNUSABLE_PAGE = 25;

function nameOf(estimate: CcfParameterEstimation): string {
  return estimate.name !== undefined && estimate.name.trim().length > 0 ? estimate.name : estimate.ccfGroupReference;
}

function factorText(value: number | undefined): string {
  if (value === undefined) return "—";
  return value !== 0 && Math.abs(value) < 1e-3 ? statText(value) : String(Number(value.toPrecision(5)));
}

function modelOf(model: DaCcfModel | undefined): string {
  return model === undefined ? "—" : MODEL_LABELS[model];
}

function heldFactors(estimate: CcfParameterEstimation, result: DaCcfResult): CcfFactorModel | undefined {
  return estimate.method === "TYPED" ? estimate.factors : estimate.factors ?? result.factors;
}

function patchEstimate(mutateDa: (mutator: (da: DataAnalysis) => DataAnalysis) => void, id: string, next: Partial<CcfParameterEstimation>): void {
  mutateDa((draft) => ({ ...draft, ccfParameterEstimations: (draft.ccfParameterEstimations ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
}

function pageOf<T>(rows: readonly T[], page: number, size = NEED_PAGE): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages - 1);
  return { current, shown: rows.slice(current * size, (current + 1) * size) };
}

function levelText(level: DaCcfLevel): string {
  const range = level.p05 === undefined || level.p95 === undefined ? "" : `, 5th ${factorText(level.p05)}, 95th ${factorText(level.p95)}`;
  const published = level.published === undefined ? "" : `, printed ${factorText(level.published)}`;
  return `${factorText(level.mean)}${range}${level.prior === undefined ? "" : `, published ${factorText(level.prior)}`}${published}`;
}

function importNotes(result: DaCcfResult): string[] {
  const imported = result.imported;
  if (imported === undefined) return [];
  const notes: string[] = [];
  if (imported.scale !== undefined && imported.originalSum !== undefined) notes.push(`The printed alpha factors add to ${preciseText(imported.originalSum)}, not 1. They are scaled by ${preciseText(imported.scale)} so they add to 1.`);
  if (imported.conversion === "ONE_PLUS_BETA") {
    const level = result.levels[0];
    const printed = level?.published;
    notes.push(`The source writes Qt = (1 + b) Qs. PRAXIS converts b to the standard b' = b / (1 + b)${printed === undefined ? "" : `, so ${factorText(printed)} becomes ${factorText(level?.mean)}`}.`);
  }
  if (imported.testing === "STAGGERED") notes.push("The report converted these MGL values from its alpha factors under staggered testing.");
  return notes;
}

function provenanceItems(result: DaCcfResult): { label: string; value: string }[] {
  const vector = result.vector;
  const imported = result.imported;
  const template = result.template;
  if (imported === undefined || template === undefined) return [];
  return [
    { label: "Dataset", value: template.sourceId },
    { label: "Kind", value: KIND_LABELS[imported.kind] },
    { label: "Set", value: template.component.length > 0 ? `${template.code} · ${template.component}` : template.code },
    { label: "Rows", value: imported.rowIds.join(", ") },
    { label: "Group size", value: String(imported.groupSize) },
    ...(imported.vectorId === undefined ? [] : [{ label: "Shared vector", value: vector === undefined ? imported.vectorId : ccfVectorLabel(vector) }]),
  ];
}

function GroupDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const result = ccfResult(da, estimate);
  const share = shareFromNeeds(da, estimate);
  const memberId = estimate.memberParameterId ?? share?.parameterIds[0];
  const member = memberId === undefined ? undefined : da.parameters.find((candidate) => candidate.uuid === memberId);
  const total = result.model === "BINOMIAL_FAILURE_RATE" ? "Not used, the model gives each combination" : result.qt === undefined ? (result.pending ? "…" : "—") : `${statText(result.qt)}${result.qtFrom === "SY" ? ", from Systems Analysis" : ""}`;
  return (
    <FieldList items={[
      { label: "Name", value: nameOf(estimate) },
      { label: "Members' parameter", value: member === undefined ? memberId ?? "—" : `${member.uuid} · ${member.name}` },
      { label: "Total probability", value: total },
      { label: "Risk significant", value: estimate.isRiskSignificant === true ? "Yes" : "No" },
      { label: "Testing basis", value: estimate.testingReason ?? "—" },
      { label: "Boundary match", value: estimate.componentBoundaryConsistencyBasis.trim().length > 0 ? estimate.componentBoundaryConsistencyBasis : "—" },
      { label: "Members in SY", value: share === undefined ? "Not imported" : share.members.join(", ") },
      { label: "SY holds", value: share?.factors === undefined ? "—" : factorsText(share.factors, ccfLabelOf(da)) },
    ]} />
  );
}

function EventsDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const result = ccfResult(da, estimate);
  const items: { label: string; value: string }[] = [];
  for (const evidence of estimate.evidence ?? []) {
    const label = evidence.label !== undefined && evidence.label.trim().length > 0 ? evidence.label : evidence.id;
    const size = evidence.impactSize ?? estimate.groupSize;
    items.push({ label: `${evidence.id} · ${label}`, value: `${EVIDENCE_ORIGIN_LABELS[evidence.origin]}, ${evidence.independentFailures} independent ${evidence.independentFailures === 1 ? "failure" : "failures"} in ${evidence.population} components, coded for a group of ${size ?? "?"}${evidence.included ? "" : ", left out"}` });
    if (evidence.counts !== undefined) items.push({ label: `${evidence.id} counts`, value: `[${evidence.counts.map((value) => factorText(value)).join(", ")}]${evidence.imported === undefined ? "" : `, from ${evidence.imported.sourceId} ${evidence.imported.set}`}` });
    if (evidence.multiplicities !== undefined) items.push({ label: `${evidence.id} events by number failed`, value: `${evidence.multiplicities.filter((item) => item.events > 0).map((item) => `${factorText(item.events)} failing ${item.failed}`).join(", ")}${evidence.imported === undefined ? "" : `, from ${evidence.imported.sourceId} ${evidence.imported.set}`}` });
    for (const event of evidence.events) items.push({ label: `${evidence.id} · ${event.id}${event.recordId === undefined ? "" : ` · ${event.recordId}`}`, value: `[${event.impact.map((value) => factorText(value)).join(", ")}]${event.included ? "" : ", left out"}${event.description === undefined ? "" : `. ${event.description}`}` });
  }
  for (const mapping of result.mappings) {
    if (mapping.from === mapping.to) continue;
    const dropped = mapping.noImpact === undefined || mapping.noImpact === 0 ? "" : `, ${factorText(mapping.noImpact)} events fail none of the ${mapping.to}`;
    items.push({ label: `${mapping.evidenceId} mapped`, value: `From a group of ${mapping.from} to ${mapping.to}${mapping.rho === undefined ? "" : `, rho ${numberText(mapping.rho)}`}${mapping.lethal === undefined ? "" : `, ${numberText(mapping.lethal)} lethal shocks`}: ${mapping.mapped === undefined ? "waiting for PRAXIS" : `[${mapping.mapped.map((value) => factorText(value)).join(", ")}]`}${dropped}` });
  }
  if (result.counts !== undefined && result.method === "BAYES") items.push({ label: "Counts in the update", value: result.counts.map((value, index) => `n${index + 1} ${factorText(value)}`).join(", ") });
  return items.length === 0 ? <p className="posmuted">No shared-cause event yet.</p> : <FieldList items={items} />;
}

function levelSeries(result: DaCcfResult): { series: DistributionSeries[]; states: UncertaintyState<UncertaintyLawSummary>[] } {
  const series: DistributionSeries[] = [];
  const states: UncertaintyState<UncertaintyLawSummary>[] = [];
  const bayes = result.method === "BAYES";
  for (const level of result.levels) {
    if (level.law === undefined || level.law.family === "POINT") continue;
    const state = lawSummary("FRACTION", level.law, true);
    states.push(state);
    if (state.status === "ready") series.push({ key: `L${level.k}`, label: level.label, detail: bayes ? "updated" : result.method === "TYPED" ? "typed" : "published", summary: state.value });
    if (!bayes || level.priorLaw === undefined || level.priorLaw.family === "POINT") continue;
    const prior = lawSummary("FRACTION", level.priorLaw, true);
    states.push(prior);
    if (prior.status === "ready") series.push({ key: `P${level.k}`, label: `${level.label} before the events`, detail: "published", summary: prior.value });
  }
  return { series, states };
}

function FactorsDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [focus, setFocus] = useState("");
  const result = ccfResult(da, estimate);
  const { series, states } = levelSeries(result);
  const items = [
    { label: "Source", value: result.method === undefined ? "Not chosen" : CCF_METHOD_LABELS[result.method] },
    { label: "Model", value: modelOf(result.model) },
    ...provenanceItems(result),
  ];
  if (result.prior !== undefined && result.imported?.kind === "ALPHA_DIRICHLET") items.push({ label: "Published Dirichlet", value: result.prior.map((value) => factorText(value)).join(", ") });
  if (result.method === "BAYES" && result.posterior !== undefined) items.push({ label: "Updated Dirichlet", value: result.posterior.map((value) => factorText(value)).join(", ") });
  for (const level of result.levels) items.push({ label: level.label, value: levelText(level) });
  const note = result.problem ?? (result.pending ? "Waiting for PRAXIS." : waitNote(states));
  const fallback = series.find((item) => item.key.startsWith("L") && item.key !== "L1") ?? series[0];
  return (
    <>
      <FieldList items={items} />
      {importNotes(result).map((text) => <p key={text} className="posmuted">{text}</p>)}
      {note !== undefined && <p className="posmuted">{note}</p>}
      {series.length > 0 && <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : fallback?.key} unit="fraction of failures" onFocus={setFocus} />}
    </>
  );
}

function ResultsDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const result = ccfResult(da, estimate);
  const size = estimate.groupSize ?? 0;
  const share = shareFromNeeds(da, estimate);
  const factors = heldFactors(estimate, result);
  const items = [
    { label: "Testing", value: estimate.testing === undefined ? "Not set, non-staggered used" : CCF_TESTING_LABELS[estimate.testing] },
    { label: "Total probability", value: result.model === "BINOMIAL_FAILURE_RATE" ? "Not used, the model gives each combination" : statText(result.qt) },
  ];
  for (const combination of result.combinations) items.push({ label: combination.k === 1 ? "One alone" : `${combination.k} of ${size}`, value: `${statText(combination.each)} each, ${combination.count} ${combination.count === 1 ? "combination" : "combinations"}` });
  const label = ccfLabelOf(da);
  items.push({ label: "To Systems Analysis", value: factors === undefined ? "—" : factorsText(factors, label) });
  items.push({ label: "SY holds", value: share?.factors === undefined ? "—" : factorsText(share.factors, label) });
  return (
    <>
      <FieldList items={items} />
      {result.problem !== undefined && <p className="posmuted">{result.problem}</p>}
      {result.problem === undefined && result.pending && <p className="posmuted">Waiting for PRAXIS.</p>}
    </>
  );
}

function useTableState(): { page: number; setPage: (page: number) => void; show: string; setShow: (value: string) => void } {
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  return { page, setPage, show, setShow };
}

function templateCell(estimate: CcfParameterEstimation): string {
  if (estimate.method === "TYPED") return "Typed";
  return estimate.priorTemplate ?? "—";
}

function CcfTable({ tab, selected, onSelect, openDrawer }: { tab: Exclude<CcfTab, "checks">; selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const state = useTableState();
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const estimates = da.ccfParameterEstimations ?? [];
  if (estimates.length === 0) return <p className="posmuted">No common cause estimate yet. Import the Systems Analysis groups in Step 02, then add their estimates.</p>;
  const rows = estimates.filter((estimate) => {
    if (state.show === "all") return true;
    if (tab === "events") return state.show === "with" ? ccfEventCount(estimate) > 0 : ccfEventCount(estimate) === 0;
    return ccfResult(da, estimate).problem !== undefined;
  });
  const { current, shown } = pageOf(rows, state.page);
  const windowKind = tab === "groups" ? "daCcfGroup" : tab === "events" ? "daCcfEvents" : "daCcfFactors";
  const headers = tab === "groups" ? ["Group", "Size", "Testing", "Model"] : tab === "events" ? ["Group", "Events", "Independent"] : tab === "factors" ? ["Group", "Source", "Highest order"] : ["Group", "Total", "All fail"];
  const span = headers.length + 2;
  function computed(result: DaCcfResult, value: number | undefined): JSX.Element {
    if (result.problem !== undefined) return <span className="da-severity da-severity--error">Cannot compute</span>;
    if (result.pending) return <span title="Waiting for PRAXIS">…</span>;
    return <>{statText(value)}</>;
  }
  function cells(estimate: CcfParameterEstimation, result: DaCcfResult): JSX.Element {
    if (tab === "groups") return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__num">{estimate.groupSize ?? "—"}</td>
        <td className="da-rowtable__text">{estimate.testing === undefined ? "Not set" : CCF_TESTING_LABELS[estimate.testing]}</td>
        <td className="da-rowtable__text">{modelOf(modelOfEstimate(estimate))}</td>
      </>
    );
    if (tab === "events") return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__num">{ccfEventCount(estimate)}</td>
        <td className="da-rowtable__num">{(estimate.evidence ?? []).filter((evidence) => evidence.included).reduce((total, evidence) => total + evidence.independentFailures, 0)}</td>
      </>
    );
    const top = result.levels[result.levels.length - 1];
    if (tab === "factors") return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__text">{templateCell(estimate)}</td>
        <td className="da-rowtable__num">{computed(result, top?.mean)}</td>
      </>
    );
    const all = result.combinations[result.combinations.length - 1];
    return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__num">{result.model === "BINOMIAL_FAILURE_RATE" ? "Model" : statText(result.qt)}</td>
        <td className="da-rowtable__num">{computed(result, all?.each)}</td>
      </>
    );
  }
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={state.show} onChange={(event) => { state.setShow(event.target.value); state.setPage(0); }}>
          <option value="all">All estimates</option>
          {tab === "events" ? <><option value="with">With events</option><option value="without">Without events</option></> : <option value="open">Not computed</option>}
        </select>
        <NeedPager total={rows.length} page={current} onPage={state.setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label={TAB_HEADS[tab].title}>
          <thead><tr><th className="da-rowtable__pick">{tab === "factors" ? "Plot" : "Details"}</th><th>Estimate</th>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {shown.map((estimate) => {
              const result = ccfResult(da, estimate);
              const open = estimate.uuid === selected;
              return (
                <Fragment key={estimate.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(estimate.uuid); }}>
                    <td className="da-rowtable__pick">{tab === "factors" ? <PlotToggle open={open} label={estimate.uuid} onToggle={() => onSelect(open ? "" : estimate.uuid)} /> : <DetailToggle open={open} label={estimate.uuid} onToggle={() => onSelect(open ? "" : estimate.uuid)} />}</td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: windowKind, id: estimate.uuid }); }}>{estimate.uuid}</button></td>
                    {cells(estimate, result)}
                  </tr>
                  {open && (
                    <DetailRow span={span} width={wrapWidth - 18}>
                      {tab === "groups" ? <GroupDetail estimate={estimate} /> : tab === "events" ? <EventsDetail estimate={estimate} /> : tab === "factors" ? <FactorsDetail estimate={estimate} /> : <ResultsDetail estimate={estimate} />}
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

function newEstimate(da: DataAnalysis, id: string, groupId: string, name: string, size: number | undefined, memberParameterId: string | undefined): CcfParameterEstimation {
  const estimate: CcfParameterEstimation = {
    uuid: id,
    ccfGroupReference: groupId,
    name,
    parameterSource: da.plantStage === "OPERATIONAL" ? "PLANT_EXPERIENCE_CONSISTENT" : "GENERIC",
    componentBoundaryConsistencyBasis: "",
    implementsSrs: [{ sr: "DA-D7", hlr: "D" }, { sr: "DA-D8", hlr: "D" }],
  };
  if (size !== undefined) estimate.groupSize = size;
  if (memberParameterId !== undefined) estimate.memberParameterId = memberParameterId;
  return estimate;
}

function missingGroups(da: DataAnalysis): { id: string; name: string; size: number; estimateRef?: string; parameterId?: string }[] {
  const needs = da.dataNeeds;
  if (needs === undefined) return [];
  const estimates = da.ccfParameterEstimations ?? [];
  const byGroup = new Set(estimates.map((estimate) => estimate.ccfGroupReference));
  const byId = new Set(estimates.map((estimate) => estimate.uuid));
  return needs.ccfGroups.filter((need) => need.included && !byGroup.has(need.id) && (need.estimateRef === undefined || !byId.has(need.estimateRef))).map((need) => {
    const parameterIds = memberParameterIds(needs, need.memberIds);
    return { id: need.id, name: need.name, size: need.memberIds.length, estimateRef: need.estimateRef, parameterId: parameterIds.length === 1 ? parameterIds[0] : undefined };
  });
}

function CcfScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  useUncertaintyVersion();
  const [tab, setTab] = useState<CcfTab>("groups");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const tabId = useId();
  const estimates = da.ccfParameterEstimations ?? [];
  const findings = ccfFindings(da);
  const missing = missingGroups(da);
  const computed = estimates.filter((estimate) => { const result = ccfResult(da, estimate); return result.problem === undefined && !result.pending; }).length;
  const events = estimates.reduce((total, estimate) => total + ccfEventCount(estimate), 0);
  const tabs: { id: CcfTab; label: string }[] = [
    { id: "groups", label: `Groups (${estimates.length})` },
    { id: "events", label: `Events (${events})` },
    { id: "factors", label: `Factors (${computed} of ${estimates.length})` },
    { id: "results", label: `Results (${computed})` },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = TAB_HEADS[tab];
  function addEstimate(): void {
    if (!editable) return;
    const id = nextCode("DA-CCF", estimates.map((estimate) => estimate.uuid));
    mutateDa((draft) => ({ ...draft, ccfParameterEstimations: [...(draft.ccfParameterEstimations ?? []), newEstimate(draft, id, "", "", undefined, undefined)] }));
    openDrawer({ kind: "daCcfGroup", id });
  }
  function addImported(): void {
    if (!editable || missing.length === 0) return;
    mutateDa((draft) => {
      const taken = (draft.ccfParameterEstimations ?? []).map((estimate) => estimate.uuid);
      const added = missing.map((group) => {
        const id = group.estimateRef !== undefined && !taken.includes(group.estimateRef) ? group.estimateRef : nextCode("DA-CCF", taken);
        taken.push(id);
        return newEstimate(draft, id, group.id, group.name, group.size, group.parameterId);
      });
      return { ...draft, ccfParameterEstimations: [...(draft.ccfParameterEstimations ?? []), ...added] };
    });
  }
  return (
    <div className="da-step">
      <DaTabs label="Common cause sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="da-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && tab === "groups" && missing.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addImported}>Add {missing.length} imported {missing.length === 1 ? "group" : "groups"}</button>}
              {editable && tab === "groups" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addEstimate}>Add estimate</button>}
            </div>
          </div>
          {tab === "checks" ? (
            <NeedChecksTable findings={findings} openDrawer={openDrawer} />
          ) : (
            <CcfTable key={tab} tab={tab} selected={keys[tab] ?? ""} onSelect={(key) => setKeys((current) => ({ ...current, [tab]: key }))} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

function withTesting(estimate: CcfParameterEstimation, testing: DaCcfTesting | undefined): Partial<CcfParameterEstimation> {
  const factors = estimate.factors;
  if (estimate.method === "TYPED" && factors?.model === "ALPHA_FACTOR" && testing !== undefined) return { testing, factors: { ...factors, testing } };
  return { testing };
}

function CcfGroupWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
  if (estimate === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const groups = da.dataNeeds?.ccfGroups ?? [];
  function patch(next: Partial<CcfParameterEstimation>): void {
    if (editable) patchEstimate(mutateDa, id, next);
  }
  function chooseGroup(value: string): void {
    const group = groups.find((candidate) => candidate.id === value);
    patch(group === undefined ? { ccfGroupReference: value } : { ccfGroupReference: value, groupSize: group.memberIds.length, name: estimate?.name !== undefined && estimate.name.trim().length > 0 ? estimate.name : group.name });
  }
  function chooseTesting(value: string): void {
    if (estimate === undefined) return;
    patch(withTesting(estimate, TESTINGS.find((candidate) => candidate === value)));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, ccfParameterEstimations: (draft.ccfParameterEstimations ?? []).filter((candidate) => candidate.uuid !== id) }));
  }
  return (
    <>
      <ModalHead cap="Common cause group · DA-D7 · DA-D8" title={`${estimate.uuid} · ${nameOf(estimate)}`} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Name" value={estimate.name ?? ""} disabled={dis} onChange={(name) => patch({ name })} />
        {groups.length > 0 ? (
          <FormRow label="SY group" htmlFor={fid("group")}>
            <select id={fid("group")} className="posfield__select" value={estimate.ccfGroupReference} disabled={dis} onChange={(event) => chooseGroup(event.target.value)}>
              {!groups.some((group) => group.id === estimate.ccfGroupReference) && <option value={estimate.ccfGroupReference}>{estimate.ccfGroupReference.length === 0 ? "Not chosen" : estimate.ccfGroupReference}</option>}
              {groups.map((group) => <option key={group.id} value={group.id}>{group.id} · {group.name}</option>)}
            </select>
          </FormRow>
        ) : (
          <TextRow label="SY group" value={estimate.ccfGroupReference} disabled={dis} onChange={(ccfGroupReference) => patch({ ccfGroupReference })} />
        )}
        <FormRow label="Group size" htmlFor={fid("size")}>
          <WorkbookInput id={fid("size")} className="posfield__input da-form__number" type="number" min="2" step="1" value={estimate.groupSize ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (groupSize) => patch({ groupSize }))} />
          <span className="da-form__unit">redundant components in the group</span>
        </FormRow>
        <FormRow label="Members' parameter" htmlFor={fid("member")}>
          <select id={fid("member")} className="posfield__select" value={estimate.memberParameterId ?? ""} disabled={dis} onChange={(event) => patch({ memberParameterId: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">From the SY members</option>
            {da.parameters.map((parameter) => <option key={parameter.uuid} value={parameter.uuid}>{parameter.uuid} · {parameter.name}</option>)}
          </select>
        </FormRow>
        <FormRow label="Testing" htmlFor={fid("testing")}>
          <select id={fid("testing")} className="posfield__select" value={estimate.testing ?? ""} disabled={dis} onChange={(event) => chooseTesting(event.target.value)}>
            <option value="">Not set</option>
            {TESTINGS.map((candidate) => <option key={candidate} value={candidate}>{CCF_TESTING_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <AreaRow label="Testing basis" value={estimate.testingReason ?? ""} disabled={dis} onChange={(text) => patch({ testingReason: text.trim().length === 0 ? undefined : text })} />
        <FormRow label="Risk significant" htmlFor={fid("risk")}>
          <select id={fid("risk")} className="posfield__select" value={estimate.isRiskSignificant === true ? "yes" : "no"} disabled={dis} onChange={(event) => patch({ isRiskSignificant: event.target.value === "yes" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
        <AreaRow label="Boundary match" value={estimate.componentBoundaryConsistencyBasis} disabled={dis} onChange={(componentBoundaryConsistencyBasis) => patch({ componentBoundaryConsistencyBasis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove estimate</button>}
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daCcfEvents", id })}>Open events</button>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daCcfFactors", id })}>Open factors</button>
      </FormFoot>
    </>
  );
}

function resized(values: readonly number[], size: number): number[] | undefined {
  if (values.slice(size).some((value) => value !== 0)) return undefined;
  return Array.from({ length: size }, (_, index) => values[index] ?? 0);
}

function ImpactRow({ label, impact, size, disabled, onChange }: { label: string; impact: number[]; size: number; disabled: boolean; onChange: (impact: number[]) => void }): JSX.Element {
  const values = Array.from({ length: size }, (_, index) => impact[index] ?? 0);
  return (
    <FormRow label={label} top>
      <div className="da-form__checks">
        {values.map((value, index) => (
          <label key={index} className="da-form__check">
            <span className="da-form__unit">{index + 1} of {size}</span>
            <NumberInput label={`${label}, ${index + 1} of ${size} failed`} value={value} disabled={disabled} onChange={(next) => onChange(values.map((current, at) => (at === index ? next ?? 0 : current)))} />
          </label>
        ))}
      </div>
    </FormRow>
  );
}

function EventBlock({ event, size, records, disabled, onPatch, onRemove }: { event: DaCcfEvent; size: number; records: { id: string; description: string }[]; disabled: boolean; onPatch: (next: Partial<DaCcfEvent>) => void; onRemove: () => void }): JSX.Element {
  const fieldId = useId();
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{event.id}{event.recordId === undefined ? "" : ` · ${event.recordId}`}</legend>
      {records.length > 0 && (
        <FormRow label="Record" htmlFor={`${fieldId}-record`}>
          <select id={`${fieldId}-record`} className="posfield__select" value={event.recordId ?? ""} disabled={disabled} onChange={(change) => onPatch({ recordId: change.target.value.length === 0 ? undefined : change.target.value })}>
            <option value="">No record</option>
            {records.map((record) => <option key={record.id} value={record.id}>{record.id} · {record.description}</option>)}
          </select>
        </FormRow>
      )}
      <TextRow label="Description" value={event.description ?? ""} disabled={disabled} onChange={(description) => onPatch({ description: description.trim().length === 0 ? undefined : description })} />
      <TextRow label="Date" value={event.date ?? ""} disabled={disabled} onChange={(date) => onPatch({ date: date.trim().length === 0 ? undefined : date })} />
      <ImpactRow label="Impact vector" impact={event.impact} size={size} disabled={disabled} onChange={(impact) => onPatch({ impact })} />
      <FormRow label="Lethal shock" htmlFor={`${fieldId}-lethal`}>
        <select id={`${fieldId}-lethal`} className="posfield__select" value={event.lethal === true ? "yes" : "no"} disabled={disabled} onChange={(change) => onPatch({ lethal: change.target.value === "yes" ? true : undefined })}>
          <option value="no">No</option>
          <option value="yes">Yes, the cause fails every member</option>
        </select>
      </FormRow>
      <FormRow label="In the update" htmlFor={`${fieldId}-included`}>
        <select id={`${fieldId}-included`} className="posfield__select" value={event.included ? "yes" : "no"} disabled={disabled} onChange={(change) => onPatch({ included: change.target.value === "yes" })}>
          <option value="yes">Included</option>
          <option value="no">Left out</option>
        </select>
      </FormRow>
      <AreaRow label={event.included ? "How the impact was judged" : "Why it is left out"} value={event.reason} disabled={disabled} onChange={(reason) => onPatch({ reason })} />
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this event</button>}
    </fieldset>
  );
}

function EvidenceBlock({ evidence, groupSize, disabled, onPatch, onRemove }: { evidence: DaCcfEvidence; groupSize: number; disabled: boolean; onPatch: (next: Partial<DaCcfEvidence>) => void; onRemove: () => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const [sizeNote, setSizeNote] = useState("");
  const fid = (name: string): string => `${fieldId}-${name}`;
  const set = (da.recordSets ?? []).find((candidate) => candidate.id === evidence.recordSetId);
  const records = (set?.records ?? []).map((record) => ({ id: record.id, description: record.description }));
  const size = evidence.impactSize ?? groupSize;
  function patchEvent(eventId: string, next: Partial<DaCcfEvent>): void {
    onPatch({ events: evidence.events.map((event) => (event.id === eventId ? { ...event, ...next } : event)) });
  }
  function addEvent(): void {
    onPatch({ events: [...evidence.events, { id: nextCode("E", evidence.events.map((event) => event.id), 1), impact: Array.from({ length: size }, () => 0), included: true, reason: "" }] });
  }
  function changeSize(value: number | undefined): void {
    if (value === undefined || !Number.isInteger(value) || value < 2) {
      setSizeNote("The impact vectors need a group of two or more components.");
      return;
    }
    const counts = evidence.counts === undefined ? undefined : resized(evidence.counts, value);
    const impacts = evidence.events.map((event) => resized(event.impact, value));
    const beyond = (evidence.multiplicities ?? []).some((item) => item.failed > value && item.events > 0);
    if ((evidence.counts !== undefined && counts === undefined) || impacts.some((impact) => impact === undefined) || beyond) {
      setSizeNote(`Some values fail more than ${value} components. Clear them first.`);
      return;
    }
    setSizeNote("");
    onPatch({
      impactSize: value === groupSize ? undefined : value,
      ...(counts === undefined ? {} : { counts }),
      events: evidence.events.map((event, index) => ({ ...event, impact: impacts[index] ?? event.impact })),
      ...(value >= groupSize ? { mappingRho: undefined, lethalShocks: undefined } : {}),
    });
  }
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{evidence.id}{evidence.label !== undefined && evidence.label.trim().length > 0 ? ` · ${evidence.label}` : ""}</legend>
      <TextRow label="Name" value={evidence.label ?? ""} disabled={disabled} onChange={(label) => onPatch({ label: label.trim().length === 0 ? undefined : label })} />
      {evidence.imported !== undefined && <p className="da-needs__meta">From {evidence.imported.sourceId} {evidence.imported.set}, rows {evidence.imported.rowIds.join(", ")}.</p>}
      <FormRow label="Origin" htmlFor={fid("origin")}>
        <select id={fid("origin")} className="posfield__select" value={evidence.origin} disabled={disabled} onChange={(event) => { const next = ORIGINS.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ origin: next }); }}>
          {ORIGINS.map((candidate) => <option key={candidate} value={candidate}>{EVIDENCE_ORIGIN_LABELS[candidate]}</option>)}
        </select>
      </FormRow>
      <FormRow label="Record set" htmlFor={fid("set")}>
        <select id={fid("set")} className="posfield__select" value={evidence.recordSetId ?? ""} disabled={disabled} onChange={(event) => onPatch({ recordSetId: event.target.value.length === 0 ? undefined : event.target.value })}>
          <option value="">No record set</option>
          {(da.recordSets ?? []).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id} · {candidate.name}</option>)}
        </select>
      </FormRow>
      <FormRow label="Population" htmlFor={fid("population")}>
        <WorkbookInput id={fid("population")} className="posfield__input da-form__number" type="number" min="1" step="any" value={evidence.population} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (population) => onPatch({ population: population ?? 0 }))} />
        <span className="da-form__unit">components observed together</span>
      </FormRow>
      <FormRow label="Independent failures" htmlFor={fid("independent")}>
        <WorkbookInput id={fid("independent")} className="posfield__input da-form__number" type="number" min="0" step="any" value={evidence.independentFailures} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (independentFailures) => onPatch({ independentFailures: independentFailures ?? 0 }))} />
        <span className="da-form__unit">single failures in that population, scaled to the group size</span>
      </FormRow>
      <FormRow label="Coded for" htmlFor={fid("coded")}>
        <WorkbookInput id={fid("coded")} className="posfield__input da-form__number" type="number" min="2" step="1" value={size} disabled={disabled} onChange={(event) => numberFrom(event.target.value, changeSize)} />
        <span className="da-form__unit">components per impact vector, mapped to {groupSize} in PRAXIS</span>
      </FormRow>
      {sizeNote.length > 0 && <p className="posmuted">{sizeNote}</p>}
      {size < groupSize && (
        <FormRow label="Rho" htmlFor={fid("rho")}>
          <WorkbookInput id={fid("rho")} className="posfield__input da-form__number" type="number" min="0" max="1" step="any" value={evidence.mappingRho ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (mappingRho) => onPatch({ mappingRho: mappingRho !== undefined && mappingRho <= 1 ? mappingRho : undefined }))} />
          <span className="da-form__unit">chance a non-lethal shock fails each added component, for mapping up</span>
        </FormRow>
      )}
      {size < groupSize && (
        <FormRow label="Lethal shocks" htmlFor={fid("lethal")}>
          <WorkbookInput id={fid("lethal")} className="posfield__input da-form__number" type="number" min="0" step="any" value={evidence.lethalShocks ?? 0} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (lethalShocks) => onPatch({ lethalShocks: lethalShocks === undefined || lethalShocks === 0 ? undefined : lethalShocks }))} />
          <span className="da-form__unit">events failing all {size} that were lethal shocks</span>
        </FormRow>
      )}
      {evidence.counts !== undefined && <ImpactRow label="Event counts" impact={evidence.counts} size={size} disabled={disabled} onChange={(counts) => onPatch({ counts })} />}
      {evidence.multiplicities !== undefined && (
        <ImpactRow
          label="Events by number failed"
          impact={Array.from({ length: size }, (_, index) => (evidence.multiplicities ?? []).filter((item) => item.failed === index + 1).reduce((total, item) => total + item.events, 0))}
          size={size}
          disabled={disabled}
          onChange={(values) => onPatch({ multiplicities: values.map((events, index) => ({ failed: index + 1, events })) })}
        />
      )}
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
      {evidence.events.map((event) => (
        <EventBlock
          key={event.id}
          event={event}
          size={size}
          records={records}
          disabled={disabled}
          onPatch={(next) => patchEvent(event.id, next)}
          onRemove={() => onPatch({ events: evidence.events.filter((candidate) => candidate.id !== event.id) })}
        />
      ))}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addEvent}>Add event</button>}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this evidence</button>}
    </fieldset>
  );
}

function useSurveys(sources: readonly DaSource[]): { surveys: { source: DaSource; library: DaSourceEntry[]; survey: DaCcfSurvey }[]; waiting: number } {
  const builtIn = useBuiltInEntries(sources);
  const surveys = useMemo(() => sources.map((source) => {
    const library = libraryEntries(source, builtIn.get(source.catalogId ?? ""));
    return { source, library, survey: ccfSurvey(source, library) };
  }), [sources, builtIn]);
  return { surveys, waiting: waitingSources(sources, builtIn) };
}

function evidenceFromChoice(choice: DaCcfEvidenceChoice, id: string, groupSize: number, origin: DaEvidenceOrigin): DaCcfEvidence {
  const top = choice.counts.filter((count) => count.count > 0).reduce((max, count) => Math.max(max, count.k), 0);
  const size = choice.size ?? Math.max(2, top);
  const held = choice.kind === "MULTIPLICITY"
    ? { multiplicities: choice.counts.filter((count) => count.k >= 1).map((count) => ({ failed: count.k, events: count.count })) }
    : { counts: Array.from({ length: size }, (_, index) => choice.counts.filter((count) => count.k === index + 1).reduce((total, count) => total + count.count, 0)) };
  return {
    id,
    label: `${choice.set} · ${choice.component}`,
    origin,
    population: size,
    independentFailures: choice.independent ?? 0,
    ...(size === groupSize ? {} : { impactSize: size }),
    ...held,
    imported: { sourceId: choice.sourceId, kind: choice.kind, set: choice.set, rowIds: evidenceChoiceRows(choice) },
    events: [],
    boundary: "SAME",
    reason: "",
    included: true,
  };
}

function CcfEventsWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const { surveys, waiting } = useSurveys(da.sources ?? []);
  const evidenceChoices = useMemo(() => surveys.flatMap(({ survey }) => survey.evidence), [surveys]);
  const choices = useMemo<EstimateChoice[]>(() => evidenceChoices.map((choice) => ({
    value: `${choice.sourceId}|${choice.set}`,
    label: `${choice.sourceId} · ${choice.set} · ${choice.component}`,
    detail: choice.size === undefined ? `${choice.counts.length} counts` : `group of ${choice.size}`,
    search: `${choice.sourceId} ${choice.set} ${choice.component} ${choice.failureMode} ${choice.table}`.toLowerCase(),
  })), [evidenceChoices]);
  const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
  if (estimate === undefined) return null;
  const dis = !editable;
  const evidence = estimate.evidence ?? [];
  const size = estimate.groupSize ?? 0;
  function setEvidence(next: DaCcfEvidence[]): void {
    if (editable) patchEstimate(mutateDa, id, { evidence: next });
  }
  function add(): void {
    setEvidence([...evidence, { id: nextCode("EV", evidence.map((item) => item.id), 1), origin: da.plantStage === "OPERATIONAL" ? "PLANT_RECORDS" : "TECHNOLOGY", population: size > 0 ? size : 2, independentFailures: 0, events: [], boundary: "SAME", reason: "", included: true }]);
  }
  function importEvidence(value: string): void {
    const choice = evidenceChoices.find((candidate) => `${candidate.sourceId}|${candidate.set}` === value);
    const library = surveys.find((entry) => entry.source.id === choice?.sourceId)?.library ?? [];
    if (!editable || choice === undefined || size < 2) return;
    const rows = evidenceChoiceRows(choice).flatMap((rowId) => library.filter((entry) => entry.id === rowId));
    mutateDa((draft) => {
      let next = draft;
      for (const row of rows) next = withStoredEntry(next, choice.sourceId, row);
      return { ...next, ccfParameterEstimations: (next.ccfParameterEstimations ?? []).map((candidate) => {
        if (candidate.uuid !== id) return candidate;
        const held = candidate.evidence ?? [];
        return { ...candidate, evidence: [...held, evidenceFromChoice(choice, nextCode("EV", held.map((item) => item.id), 1), size, "TECHNOLOGY")] };
      }) };
    });
  }
  return (
    <>
      <ModalHead cap="Shared-cause events · DA-D8 · DA-D9" title={`${estimate.uuid} · ${nameOf(estimate)}`} onClose={onClose} />
      <div className="modal__body da-form">
        {size < 2 && <p className="posmuted">Set the group size first, so each impact vector can be mapped to the group.</p>}
        {size >= 2 && editable && (
          <FormRow label="Import events" htmlFor={`${fieldId}-import`}>
            <EstimatePicker id={`${fieldId}-import`} value="" choices={choices} disabled={dis} onChoose={importEvidence} />
          </FormRow>
        )}
        {size >= 2 && editable && choices.length === 0 && <p className="da-needs__meta">No dataset in Step 03 holds impact vectors or counts of failed components. Add the CCF 2020 or ICDE dataset there, or type the events.</p>}
        {waiting > 0 && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
        {size >= 2 && evidence.map((item) => (
          <EvidenceBlock
            key={item.id}
            evidence={item}
            groupSize={size}
            disabled={dis}
            onPatch={(next) => setEvidence(evidence.map((candidate) => (candidate.id === item.id ? { ...candidate, ...next } : candidate)))}
            onRemove={() => setEvidence(evidence.filter((candidate) => candidate.id !== item.id))}
          />
        ))}
        {size >= 2 && evidence.length === 0 && <p className="posmuted">No events yet. Import counts from a dataset, add plant experience once the plant operates, or type common cause events from the same technology.</p>}
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daCcfFactors", id })}>Open factors</button>
        {editable && size >= 2 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={add}>Add evidence</button>}
      </FormFoot>
    </>
  );
}

function UnusableRows({ surveys }: { surveys: readonly { source: DaSource; survey: DaCcfSurvey }[] }): JSX.Element | null {
  const [sourceId, setSourceId] = useState("all");
  const [page, setPage] = useState(0);
  const filterId = useId();
  const all = surveys.flatMap(({ survey }) => survey.unusable);
  if (all.length === 0) return null;
  const listed = surveys.filter(({ survey }) => survey.unusable.length > 0);
  const rows = sourceId === "all" ? all : all.filter((row) => row.sourceId === sourceId);
  const { current, shown } = pageOf(rows, page, UNUSABLE_PAGE);
  return (
    <details className="da-use">
      <summary className="da-use__legend">Rows DA cannot use ({all.length})</summary>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Dataset</label>
        <select id={filterId} className="posfield__select" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setPage(0); }}>
          <option value="all">All datasets</option>
          {listed.map(({ source, survey }) => <option key={source.id} value={source.id}>{source.id} · {survey.unusable.length}</option>)}
        </select>
        <span className="da-needs__pager">{current * UNUSABLE_PAGE + 1} to {Math.min(rows.length, (current + 1) * UNUSABLE_PAGE)} of {rows.length}</span>
        <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        <button type="button" className="posnav__btn posnav__btn--sm" disabled={(current + 1) * UNUSABLE_PAGE >= rows.length} onClick={() => setPage(current + 1)}>Next</button>
      </div>
      <table className="postable da-rowtable" aria-label="Rows DA cannot use">
        <thead><tr><th>Row</th><th>Why</th></tr></thead>
        <tbody>
          {shown.map((row) => (
            <tr key={`${row.sourceId}|${row.rowId}`}>
              <td className="da-rowtable__text">{row.sourceId} · {row.rowId}</td>
              <td className="da-rowtable__text">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function datasetModel(estimate: CcfParameterEstimation, picked: DaCcfModel | undefined): DaCcfModel {
  if (estimate.method === "BAYES") return modelOfEstimate(estimate) ?? picked ?? "ALPHA_FACTOR";
  if (estimate.priorKind !== undefined || estimate.priorTemplate !== undefined) return KIND_MODEL[kindOf(estimate)];
  return picked ?? estimate.factors?.model ?? "ALPHA_FACTOR";
}

function vectorOptions(da: DataAnalysis, self: string | undefined, factors: CcfFactorModel | undefined): VectorOption[] {
  const linked = factors === undefined ? undefined : ccfFactorVector(factors);
  const workbookId = self ?? (linked?.node === "PARAMETER" ? linked.reference.workbookId : undefined);
  if (workbookId === undefined) return [];
  return (da.ccfVectors ?? []).map((vector) => ({ reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId: vector.id }, label: ccfVectorLabel(vector), length: vector.groupSize }));
}

function CcfFactorsWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa, upstream } = useDaWorkbook();
  useUncertaintyVersion();
  const fieldId = useId();
  const [picked, setPicked] = useState<DaCcfModel | undefined>(undefined);
  const { surveys, waiting } = useSurveys(da.sources ?? []);
  const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
  const size = estimate?.groupSize;
  const model = estimate === undefined ? "ALPHA_FACTOR" : datasetModel(estimate, picked);
  const bayes = estimate?.method === "BAYES";
  const choices = useMemo<EstimateChoice[]>(() => surveys.flatMap(({ source, survey }) => survey.choices.filter((choice) => (bayes ? model !== "BINOMIAL_FAILURE_RATE" : choice.model === model) && size !== undefined && sizesFit(choice.sizes, size)).map((choice) => ({
    value: `${source.id}|${choice.kind}|${choice.template}`,
    label: `${source.id} · ${choice.template} · ${choice.component}${choice.failureMode.length > 0 ? ` · ${choice.failureMode}` : ""}`,
    detail: `${KIND_LABELS[choice.kind]}, ${sizesText(choice.sizes)}${choice.converts ? ", converted" : ""}`,
    search: `${source.id} ${source.name} ${choice.template} ${choice.component} ${choice.failureMode} ${choice.table} ${KIND_LABELS[choice.kind]}`.toLowerCase(),
  }))), [surveys, model, size, bayes]);
  if (estimate === undefined) return null;
  const result = ccfResult(da, estimate);
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const method = estimate.method;
  const testing = estimate.testing ?? "NON_STAGGERED";
  function patch(next: Partial<CcfParameterEstimation>): void {
    if (editable) patchEstimate(mutateDa, id, next);
  }
  function chooseMethod(value: string): void {
    if (estimate === undefined) return;
    const next = METHODS.find((candidate) => candidate === value);
    if (next === "TYPED") {
      const held = estimate.factors === undefined ? ccfFactorDraft(model, size ?? 2, testing) : inlineFactors(da, estimate.factors);
      patch({ method: next, factors: held, imported: undefined });
      return;
    }
    if (next === "BAYES") {
      patch({ method: next, model: estimate.model ?? model });
      return;
    }
    patch({ method: next, model: undefined, priorWeight: undefined, groupDemands: undefined });
  }
  function chooseModel(value: string): void {
    const next = MODELS.find((candidate) => candidate === value);
    if (next === undefined || estimate === undefined) return;
    setPicked(next);
    if (bayes) {
      if (next !== model) patch({ model: next, factors: undefined, imported: undefined });
      return;
    }
    if (next !== model) patch({ priorKind: undefined, priorTemplate: undefined, priorSourceId: undefined, factors: undefined, imported: undefined });
  }
  function typeFactors(factors: CcfFactorModel): void {
    patch(factors.model === "ALPHA_FACTOR" ? { factors, testing: factors.testing } : { factors });
  }
  function pickSet(value: string): void {
    const [sourceId, kindText, template] = value.split("|");
    const found = surveys.find((entry) => entry.source.id === sourceId);
    const choice = found?.survey.choices.find((candidate) => candidate.kind === kindText && candidate.template === template);
    if (!editable || found === undefined || choice === undefined || template === undefined || size === undefined) return;
    const kind: DaCcfImportKind = choice.kind;
    const ids = rowIdsFor(kind, template, size, found.library);
    const rows = ids.flatMap((rowId) => found.library.filter((entry) => entry.id === rowId));
    mutateDa((draft) => {
      let next = draft;
      for (const row of rows) next = withStoredEntry(next, found.source.id, row);
      return { ...next, ccfParameterEstimations: (next.ccfParameterEstimations ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, priorSourceId: found.source.id, priorKind: kind, priorTemplate: template } : candidate)) };
    });
  }
  const evidenceUsed = (estimate.evidence ?? []).some((item) => item.included);
  const imported = method === "PRIOR" || method === "BAYES";
  const bfr = bayes && model === "BINOMIAL_FAILURE_RATE";
  const pointPrior = bayes && !bfr && estimate.priorTemplate !== undefined && kindOf(estimate) !== "ALPHA_DIRICHLET";
  const pickedValue = estimate.priorSourceId !== undefined && estimate.priorTemplate !== undefined ? `${estimate.priorSourceId}|${kindOf(estimate)}|${estimate.priorTemplate}` : "";
  const notes = importNotes(result);
  return (
    <>
      <ModalHead cap="Factors · DA-D7 · DA-D8 · DA-D9" title={`${estimate.uuid} · ${nameOf(estimate)}`} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="Method" htmlFor={fid("method")}>
          <select id={fid("method")} className="posfield__select" value={method ?? ""} disabled={dis} onChange={(event) => chooseMethod(event.target.value)}>
            {method === undefined && <option value="">Not chosen</option>}
            {METHODS.map((candidate) => <option key={candidate} value={candidate}>{CCF_METHOD_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        {imported && (
          <>
            <FormRow label="Model" htmlFor={fid("model")}>
              <select id={fid("model")} className="posfield__select" value={model} disabled={dis} onChange={(event) => chooseModel(event.target.value)}>
                {MODELS.map((candidate) => <option key={candidate} value={candidate}>{MODEL_LABELS[candidate]}</option>)}
              </select>
            </FormRow>
            {bayes && <p className="da-needs__meta">{bfr ? "PRAXIS updates the four parts from the events, each with a Jeffreys prior." : `The dataset values become a Dirichlet prior on the alpha factors. PRAXIS updates it with the events and gives the result as ${MODEL_LABELS[model].toLowerCase()} factors.`}</p>}
            {bfr && (
              <FormRow label="Demands on the group" htmlFor={fid("demands")}>
                <WorkbookInput id={fid("demands")} className="posfield__input da-form__number" type="number" min="0" step="any" value={estimate.groupDemands ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (groupDemands) => patch({ groupDemands }))} />
                <span className="da-form__unit">demands or tests over the period of the events</span>
              </FormRow>
            )}
            {!bfr && (
              <FormRow label="Dataset values" htmlFor={fid("template")}>
                <EstimatePicker id={fid("template")} value={pickedValue} choices={choices} disabled={dis || size === undefined} onChoose={pickSet} />
              </FormRow>
            )}
            {pointPrior && (
              <FormRow label="Prior events" htmlFor={fid("weight")}>
                <WorkbookInput id={fid("weight")} className="posfield__input da-form__number" type="number" min="0" step="any" value={estimate.priorWeight ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (priorWeight) => patch({ priorWeight }))} />
                <span className="da-form__unit">events the dataset values are worth in the update</span>
              </FormRow>
            )}
            {size === undefined && <p className="posmuted">Set the group size first.</p>}
            {!bfr && size !== undefined && choices.length === 0 && waiting === 0 && <p className="da-needs__meta">No dataset in Step 03 holds {MODEL_LABELS[model].toLowerCase()} values for a group of {size}. Type them by hand, or add a dataset in Step 03.</p>}
            {waiting > 0 && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
            {provenanceItems(result).length > 0 && <FieldList items={provenanceItems(result)} />}
            {notes.map((text) => <p key={text} className="da-needs__meta">{text}</p>)}
            {result.problem !== undefined && <p className="posmuted">{result.problem}</p>}
            {!bfr && <UnusableRows surveys={surveys} />}
            <AreaRow label={bfr ? "Why the events fit" : "Why it fits"} value={estimate.priorReason ?? ""} disabled={dis} onChange={(text) => patch({ priorReason: text.trim().length === 0 ? undefined : text })} />
          </>
        )}
        {method === "TYPED" && estimate.factors !== undefined && (
          <FormRow label="Factors" top>
            <CcfFactorEditor factors={estimate.factors} groupSize={size ?? 2} vectorOptions={vectorOptions(da, upstream.workbookId, estimate.factors)} disabled={dis} onChange={typeFactors} />
          </FormRow>
        )}
        {method === "TYPED" && estimate.factors?.model === "BINOMIAL_FAILURE_RATE" && <p className="da-needs__meta">{BFR_PARTS.map((part) => part.label).join(", ")}. The model gives every combination, so the group takes no separate total.</p>}
        {(method === "BAYES" || evidenceUsed) && (
          <>
            <FormRow label="Exclusions match" htmlFor={fid("exclusions")}>
              <select id={fid("exclusions")} className="posfield__select" value={estimate.genericExclusionConsistencyConfirmed === true ? "yes" : "no"} disabled={dis} onChange={(event) => patch({ genericExclusionConsistencyConfirmed: event.target.value === "yes" })}>
                <option value="no">Not confirmed</option>
                <option value="yes">Confirmed</option>
              </select>
              <span className="da-form__unit">events left out of the independent data are left out here too (DA-D9)</span>
            </FormRow>
            <AreaRow label="How they were matched" value={estimate.genericExclusionConsistencyBasis ?? ""} disabled={dis} onChange={(text) => patch({ genericExclusionConsistencyBasis: text.trim().length === 0 ? undefined : text })} />
          </>
        )}
        <AreaRow label="Basis" value={estimate.estimateReason ?? ""} disabled={dis} onChange={(text) => patch({ estimateReason: text.trim().length === 0 ? undefined : text })} />
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daCcfGroup", id })}>Open group</button>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daCcfEvents", id })}>Open events</button>
      </FormFoot>
    </>
  );
}

function CcfWindows({ context, onClose, onRetarget }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  switch (context.kind) {
    case "daCcfGroup": return <CcfGroupWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daCcfEvents": return <CcfEventsWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daCcfFactors": return <CcfFactorsWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    default: return null;
  }
}

export { CCF_WINDOW_KINDS, CcfScreen, CcfWindows };
