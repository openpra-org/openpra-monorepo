import { Fragment, JSX, useId, useMemo, useState } from "react";
import { DistributionType } from "interfaces-mef-types/core/events";
import type {
  CcfParameterEstimation,
  DataAnalysis,
  DaBoundaryMatch,
  DaCcfEvent,
  DaCcfEvidence,
  DaCcfMethod,
  DaCcfTesting,
  DaEvidenceOrigin,
} from "interfaces-mef-types/da/data-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { DaProvenanceChip, DaTabs, DetailRow, DetailToggle, FieldList, FormFoot, FormRow, ModalHead, PlotToggle } from "./daShared";
import { DistributionChart, useElementWidth, type DistributionSeries } from "./daDistributionChart";
import { ccfEventCount, ccfFindings, ccfResult, ccfTemplates, memberParameterIds, mglValues, orderedValues, shareFromNeeds, templateEntryIds, type DaCcfResult } from "./daCcf";
import { libraryEntries, nextCode, withStoredEntry } from "./daSourcing";
import { useDaWorkbook } from "./daWorkbookContext";
import { BOUNDARY_MATCH_LABELS, CCF_METHOD_LABELS, CCF_MODEL_LABELS, CCF_TESTING_LABELS, EVIDENCE_ORIGIN_LABELS } from "./daViewData";
import { AreaRow, NEED_PAGE, NeedChecksTable, NeedPager, numberFrom, statText, type DaDrawerContext } from "./daScreens";
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

const STAGGERED_TOAST = "Staggered groups go to Systems Analysis as MGL values, which give the same combinations. Direct staggered alpha factors are coming soon.";

const TYPED_ALPHA_TOAST = "Systems Analysis cannot expand alpha factors as staggered yet. Type MGL values instead. Support is coming soon.";

const ORIGINS: DaEvidenceOrigin[] = ["TECHNOLOGY", "PLANT_RECORDS"];

const BOUNDARIES: DaBoundaryMatch[] = ["SAME", "ADJUSTED", "DIFFERENT"];

const TYPED_MODELS: CcfParameterEstimation["modelType"][] = ["ALPHA_FACTOR", "MGL", "BETA_FACTOR"];

function nameOf(estimate: CcfParameterEstimation): string {
  return estimate.name !== undefined && estimate.name.trim().length > 0 ? estimate.name : estimate.ccfGroupReference;
}

function factorText(value: number | undefined): string {
  if (value === undefined) return "—";
  return value !== 0 && Math.abs(value) < 1e-3 ? statText(value) : String(Number(value.toPrecision(5)));
}

function modelText(model: CcfParameterEstimation["modelType"] | string | undefined): string {
  if (model === undefined) return "—";
  return CCF_MODEL_LABELS[model] ?? model;
}

function factorsText(model: string, parameters: Record<string, number>): string {
  const values = model === "MGL" ? mglValues(parameters) : orderedValues(parameters);
  if (values.length === 0) return "—";
  if (model === "BETA_FACTOR") return `β ${factorText(values[0])}`;
  if (model === "MGL") return values.map((value, index) => `${["β", "γ", "δ"][index] ?? `ρ${index + 2}`} ${factorText(value)}`).join(", ");
  return values.map((value, index) => `α${index + 1} ${factorText(value)}`).join(", ");
}

function staggeredToast(estimate: CcfParameterEstimation): string | undefined {
  if (estimate.method !== "TYPED") return STAGGERED_TOAST;
  return estimate.modelType === "ALPHA_FACTOR" ? TYPED_ALPHA_TOAST : undefined;
}

function patchEstimate(mutateDa: (mutator: (da: DataAnalysis) => DataAnalysis) => void, id: string, next: Partial<CcfParameterEstimation>): void {
  mutateDa((draft) => ({ ...draft, ccfParameterEstimations: (draft.ccfParameterEstimations ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
}

function pageOf<T>(rows: readonly T[], page: number): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  return { current, shown: rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE) };
}

function GroupDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  const result = ccfResult(da, estimate);
  const share = shareFromNeeds(da, estimate);
  const syGroup = da.dataNeeds?.ccfGroups.find((candidate) => candidate.id === estimate.ccfGroupReference);
  const memberId = estimate.memberParameterId ?? share?.parameterIds[0];
  const member = memberId === undefined ? undefined : da.parameters.find((candidate) => candidate.uuid === memberId);
  return (
    <FieldList items={[
      { label: "Name", value: nameOf(estimate) },
      { label: "Members' parameter", value: member === undefined ? memberId ?? "—" : `${member.uuid} · ${member.name}` },
      { label: "Total probability", value: result.qt === undefined ? "—" : `${statText(result.qt)}${result.qtFrom === "SY" ? ", from Systems Analysis" : ""}` },
      { label: "Risk significant", value: estimate.isRiskSignificant === true ? "Yes" : "No" },
      { label: "Testing basis", value: estimate.testingReason ?? "—" },
      { label: "Boundary match", value: estimate.componentBoundaryConsistencyBasis.trim().length > 0 ? estimate.componentBoundaryConsistencyBasis : "—" },
      { label: "Members in SY", value: share === undefined ? "Not imported" : share.members.join(", ") },
      { label: "SY holds", value: syGroup?.modelType === undefined || syGroup.factors === undefined ? "—" : `${modelText(syGroup.modelType)}, ${factorsText(syGroup.modelType, syGroup.factors)}` },
    ]} />
  );
}

function EventsDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  const result = ccfResult(da, estimate);
  const items: { label: string; value: string }[] = [];
  for (const evidence of estimate.evidence ?? []) {
    const label = evidence.label !== undefined && evidence.label.trim().length > 0 ? evidence.label : evidence.id;
    items.push({ label, value: `${EVIDENCE_ORIGIN_LABELS[evidence.origin]}, ${evidence.independentFailures} independent ${evidence.independentFailures === 1 ? "failure" : "failures"} in ${evidence.population} components${evidence.included ? "" : ", left out"}` });
    for (const event of evidence.events) items.push({ label: `${event.id}${event.recordId === undefined ? "" : ` · ${event.recordId}`}`, value: `[${event.impact.map((value) => factorText(value)).join(", ")}]${event.included ? "" : ", left out"}${event.description === undefined ? "" : `. ${event.description}`}` });
  }
  if (result.counts !== undefined && result.method === "BAYES") items.push({ label: "Counts in the update", value: result.counts.map((value, index) => `n${index + 1} ${factorText(value)}`).join(", ") });
  return items.length === 0 ? <p className="posmuted">No shared-cause event yet.</p> : <FieldList items={items} />;
}

function FactorsDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  const [focus, setFocus] = useState("");
  const result = ccfResult(da, estimate);
  const series = useMemo<DistributionSeries[]>(() => {
    const list: DistributionSeries[] = [];
    const posterior = result.posterior;
    const prior = result.prior;
    if (posterior === undefined) return list;
    const total = posterior.reduce((sum, value) => sum + value, 0);
    const priorTotal = prior === undefined ? 0 : prior.reduce((sum, value) => sum + value, 0);
    posterior.forEach((value, index) => {
      if (index === 0) return;
      list.push({ key: `A${index + 1}`, label: `α${index + 1}`, detail: result.method === "BAYES" ? "updated" : "published", distribution: { type: DistributionType.BETA, alpha: value, betaParam: total - value } });
      const before = prior?.[index];
      if (result.method === "BAYES" && before !== undefined) list.push({ key: `P${index + 1}`, label: `α${index + 1} before the events`, detail: "published", distribution: { type: DistributionType.BETA, alpha: before, betaParam: priorTotal - before } });
    });
    return list;
  }, [result]);
  const template = result.template;
  const items = [
    { label: "Method", value: result.method === undefined ? "Not chosen" : CCF_METHOD_LABELS[result.method] },
    { label: "Template", value: template === undefined ? (estimate.priorTemplate ?? "—") : `${template.code} · ${template.component} · ${template.failureMode}` },
    { label: "Group size", value: estimate.groupSize === undefined ? "—" : String(estimate.groupSize) },
  ];
  if (result.prior !== undefined) items.push({ label: "Published Dirichlet", value: result.prior.map((value) => factorText(value)).join(", ") });
  if (result.method === "BAYES" && result.posterior !== undefined) items.push({ label: "Updated Dirichlet", value: result.posterior.map((value) => factorText(value)).join(", ") });
  for (const alpha of result.alphas) items.push({ label: `α${alpha.k}`, value: `${factorText(alpha.mean)}${alpha.p05 === undefined || alpha.p95 === undefined ? "" : `, 5th ${factorText(alpha.p05)}, 95th ${factorText(alpha.p95)}`}${alpha.prior === undefined ? "" : `, published ${factorText(alpha.prior)}`}` });
  return (
    <>
      <FieldList items={items} />
      {result.problem !== undefined && <p className="posmuted">{result.problem}</p>}
      {series.length > 0 && <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : series[series.length - (result.method === "BAYES" ? 2 : 1)]?.key} unit="fraction of failures" onFocus={setFocus} />}
    </>
  );
}

function ResultsDetail({ estimate }: { estimate: CcfParameterEstimation }): JSX.Element {
  const { da } = useDaWorkbook();
  const result = ccfResult(da, estimate);
  const size = estimate.groupSize ?? 0;
  const syGroup = da.dataNeeds?.ccfGroups.find((candidate) => candidate.id === estimate.ccfGroupReference);
  const items = [
    { label: "Testing", value: estimate.testing === undefined ? "Not set, non-staggered used" : CCF_TESTING_LABELS[estimate.testing] },
    { label: "Total probability", value: statText(result.qt) },
  ];
  for (const combination of result.combinations) items.push({ label: combination.k === 1 ? "One alone" : `${combination.k} of ${size}`, value: `${statText(combination.each)} each, ${combination.count} ${combination.count === 1 ? "combination" : "combinations"}` });
  const handoff = result.handoff;
  items.push({ label: "To Systems Analysis", value: handoff === undefined ? "—" : `${modelText(handoff.modelType)}, ${factorsText(handoff.modelType, handoff.parameters)}` });
  items.push({ label: "SY holds", value: syGroup?.modelType === undefined || syGroup.factors === undefined ? "—" : `${modelText(syGroup.modelType)}, ${factorsText(syGroup.modelType, syGroup.factors)}` });
  return (
    <>
      <FieldList items={items} />
      {result.problem !== undefined && <p className="posmuted">{result.problem}</p>}
      {handoff?.modelType === "MGL" && estimate.method !== "TYPED" && <p className="da-needs__meta da-needs__meta--lead">The testing is staggered, so Systems Analysis gets MGL values. They expand to exactly the staggered combinations.</p>}
    </>
  );
}

function useTableState(): { page: number; setPage: (page: number) => void; show: string; setShow: (value: string) => void } {
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  return { page, setPage, show, setShow };
}

function CcfTable({ tab, selected, onSelect, openDrawer }: { tab: Exclude<CcfTab, "checks">; selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
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
  const headers = tab === "groups" ? ["Group", "Size", "Testing", "Model"] : tab === "events" ? ["Group", "Events", "Independent"] : tab === "factors" ? ["Group", "Template", "Highest order"] : ["Group", "Total", "All fail"];
  const span = headers.length + 2;
  function cells(estimate: CcfParameterEstimation, result: DaCcfResult): JSX.Element {
    if (tab === "groups") return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__num">{estimate.groupSize ?? "—"}</td>
        <td className="da-rowtable__text">{estimate.testing === undefined ? "Not set" : CCF_TESTING_LABELS[estimate.testing]}</td>
        <td className="da-rowtable__text">{modelText(estimate.modelType)}</td>
      </>
    );
    if (tab === "events") return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__num">{ccfEventCount(estimate)}</td>
        <td className="da-rowtable__num">{(estimate.evidence ?? []).filter((evidence) => evidence.included).reduce((total, evidence) => total + evidence.independentFailures, 0)}</td>
      </>
    );
    const top = result.alphas[result.alphas.length - 1];
    if (tab === "factors") return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__text">{estimate.method === "TYPED" ? "Typed" : estimate.priorTemplate ?? "—"}</td>
        <td className="da-rowtable__num">{result.problem !== undefined ? <span className="da-severity da-severity--error">Cannot compute</span> : factorText(top?.mean)}</td>
      </>
    );
    const all = result.combinations[result.combinations.length - 1];
    return (
      <>
        <td className="da-rowtable__text">{estimate.ccfGroupReference}</td>
        <td className="da-rowtable__num">{statText(result.qt)}</td>
        <td className="da-rowtable__num">{result.problem !== undefined ? <span className="da-severity da-severity--error">Cannot compute</span> : statText(all?.each)}</td>
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
    modelType: "ALPHA_FACTOR",
    parameters: {},
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
  const [tab, setTab] = useState<CcfTab>("groups");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const tabId = useId();
  const estimates = da.ccfParameterEstimations ?? [];
  const findings = ccfFindings(da);
  const missing = missingGroups(da);
  const computed = estimates.filter((estimate) => ccfResult(da, estimate).problem === undefined).length;
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

function CcfGroupWindow({ id, onClose, onRetarget, onToast }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void; onToast: (message: string) => void }): JSX.Element | null {
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
    if (!editable || estimate === undefined) return;
    const testing = TESTINGS.find((candidate) => candidate === value);
    patch({ testing });
    const message = testing === "STAGGERED" ? staggeredToast(estimate) : undefined;
    if (message !== undefined) onToast(message);
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

function ImpactRow({ impact, size, disabled, onChange }: { impact: number[]; size: number; disabled: boolean; onChange: (impact: number[]) => void }): JSX.Element {
  const values = Array.from({ length: size }, (_, index) => impact[index] ?? 0);
  return (
    <FormRow label="Impact vector" top>
      <div className="da-form__checks">
        {values.map((value, index) => (
          <label key={index} className="da-form__check">
            <span className="da-form__unit">{index + 1} of {size}</span>
            <NumberInput label={`Share with ${index + 1} of ${size} failed`} value={value} disabled={disabled} onChange={(next) => onChange(values.map((current, at) => (at === index ? next ?? 0 : current)))} />
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
      <ImpactRow impact={event.impact} size={size} disabled={disabled} onChange={(impact) => onPatch({ impact })} />
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

function EvidenceBlock({ evidence, size, disabled, onPatch, onRemove }: { evidence: DaCcfEvidence; size: number; disabled: boolean; onPatch: (next: Partial<DaCcfEvidence>) => void; onRemove: () => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const fid = (name: string): string => `${fieldId}-${name}`;
  const set = (da.recordSets ?? []).find((candidate) => candidate.id === evidence.recordSetId);
  const records = (set?.records ?? []).map((record) => ({ id: record.id, description: record.description }));
  function patchEvent(eventId: string, next: Partial<DaCcfEvent>): void {
    onPatch({ events: evidence.events.map((event) => (event.id === eventId ? { ...event, ...next } : event)) });
  }
  function addEvent(): void {
    onPatch({ events: [...evidence.events, { id: nextCode("E", evidence.events.map((event) => event.id), 1), impact: Array.from({ length: size }, () => 0), included: true, reason: "" }] });
  }
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{evidence.id}{evidence.label !== undefined && evidence.label.trim().length > 0 ? ` · ${evidence.label}` : ""}</legend>
      <TextRow label="Name" value={evidence.label ?? ""} disabled={disabled} onChange={(label) => onPatch({ label: label.trim().length === 0 ? undefined : label })} />
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

function CcfEventsWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
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
  return (
    <>
      <ModalHead cap="Shared-cause events · DA-D8 · DA-D9" title={`${estimate.uuid} · ${nameOf(estimate)}`} onClose={onClose} />
      <div className="modal__body da-form">
        {size < 2 && <p className="posmuted">Set the group size first, so each impact vector has one value per number of failed components.</p>}
        {size >= 2 && evidence.map((item) => (
          <EvidenceBlock
            key={item.id}
            evidence={item}
            size={size}
            disabled={dis}
            onPatch={(next) => setEvidence(evidence.map((candidate) => (candidate.id === item.id ? { ...candidate, ...next } : candidate)))}
            onRemove={() => setEvidence(evidence.filter((candidate) => candidate.id !== item.id))}
          />
        ))}
        {size >= 2 && evidence.length === 0 && <p className="posmuted">No events yet. Add plant experience once the plant operates, or common cause events from the same technology before then.</p>}
      </div>
      <FormFoot onClose={onClose}>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daCcfFactors", id })}>Open factors</button>
        {editable && size >= 2 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={add}>Add evidence</button>}
      </FormFoot>
    </>
  );
}

function TypedFactorRows({ estimate, disabled, onPatch }: { estimate: CcfParameterEstimation; disabled: boolean; onPatch: (next: Partial<CcfParameterEstimation>) => void }): JSX.Element {
  const fieldId = useId();
  const size = estimate.groupSize ?? 2;
  const model = estimate.modelType;
  const keys = model === "BETA_FACTOR" ? ["beta"] : model === "MGL" ? Array.from({ length: Math.max(1, size - 1) }, (_, index) => ["beta", "gamma", "delta"][index] ?? `factor${index + 1}`) : Array.from({ length: size }, (_, index) => `alpha${index + 1}`);
  const labels = model === "BETA_FACTOR" ? ["β"] : model === "MGL" ? keys.map((_, index) => ["β", "γ", "δ"][index] ?? `ρ${index + 2}`) : keys.map((_, index) => `α${index + 1}`);
  return (
    <>
      <FormRow label="Model" htmlFor={`${fieldId}-model`}>
        <select id={`${fieldId}-model`} className="posfield__select" value={model} disabled={disabled} onChange={(event) => { const next = TYPED_MODELS.find((candidate) => candidate === event.target.value); if (next !== undefined) onPatch({ modelType: next, parameters: {} }); }}>
          {TYPED_MODELS.map((candidate) => <option key={candidate} value={candidate}>{modelText(candidate)}</option>)}
        </select>
      </FormRow>
      <FormRow label="Factors" top>
        <div className="da-form__checks">
          {keys.map((key, index) => (
            <label key={key} className="da-form__check">
              <span className="da-form__unit">{labels[index]}</span>
              <NumberInput label={labels[index] ?? key} value={estimate.parameters[key]} disabled={disabled} onChange={(value) => { const next = { ...estimate.parameters }; if (value === undefined) delete next[key]; else next[key] = value; onPatch({ parameters: next }); }} />
            </label>
          ))}
        </div>
      </FormRow>
    </>
  );
}

function CcfFactorsWindow({ id, onClose, onRetarget, onToast }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void; onToast: (message: string) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const sources = da.sources ?? [];
  const builtIn = useBuiltInEntries(sources);
  const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
  const size = estimate?.groupSize;
  const choices = useMemo<EstimateChoice[]>(() => sources.flatMap((source) => ccfTemplates(source.id, libraryEntries(source, builtIn.get(source.catalogId ?? ""))).filter((template) => size !== undefined && template.sizes.includes(size)).map((template) => ({
    value: `${source.id}|${template.code}`,
    label: `${source.id} · ${template.code} · ${template.component} · ${template.failureMode}`,
    detail: `groups of ${template.sizes.join(", ")}`,
    search: `${source.id} ${source.name} ${template.code} ${template.component} ${template.failureMode} ${template.table}`.toLowerCase(),
  }))), [sources, builtIn, size]);
  if (estimate === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const method = estimate.method;
  const waiting = waitingSources(sources, builtIn);
  function patch(next: Partial<CcfParameterEstimation>): void {
    if (editable) patchEstimate(mutateDa, id, next);
  }
  function chooseMethod(value: string): void {
    if (!editable || estimate === undefined) return;
    const next = METHODS.find((candidate) => candidate === value);
    patch({ method: next });
    if (next === "TYPED" && estimate.testing === "STAGGERED" && estimate.modelType === "ALPHA_FACTOR") onToast(TYPED_ALPHA_TOAST);
  }
  function patchTyped(next: Partial<CcfParameterEstimation>): void {
    if (!editable || estimate === undefined) return;
    patch(next);
    if (next.modelType === "ALPHA_FACTOR" && estimate.testing === "STAGGERED") onToast(TYPED_ALPHA_TOAST);
  }
  function pickTemplate(value: string): void {
    const [sourceId, code] = value.split("|");
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!editable || source === undefined || code === undefined || size === undefined) return;
    const library = libraryEntries(source, builtIn.get(source.catalogId ?? ""));
    const rows = templateEntryIds(code, size).map((entryId) => library.find((entry) => entry.id === entryId));
    mutateDa((draft) => {
      let next = draft;
      for (const row of rows) if (row !== undefined) next = withStoredEntry(next, source.id, row);
      return { ...next, ccfParameterEstimations: (next.ccfParameterEstimations ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, priorSourceId: source.id, priorTemplate: code } : candidate)) };
    });
  }
  const evidenceUsed = (estimate.evidence ?? []).some((item) => item.included);
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
        {method !== undefined && method !== "TYPED" && (
          <>
            <FormRow label="Template" htmlFor={fid("template")}>
              <EstimatePicker id={fid("template")} value={estimate.priorSourceId !== undefined && estimate.priorTemplate !== undefined ? `${estimate.priorSourceId}|${estimate.priorTemplate}` : ""} choices={choices} disabled={dis || size === undefined} onChoose={pickTemplate} />
            </FormRow>
            {size === undefined && <p className="posmuted">Set the group size first.</p>}
            {waiting > 0 && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
            <AreaRow label="Why it fits" value={estimate.priorReason ?? ""} disabled={dis} onChange={(text) => patch({ priorReason: text.trim().length === 0 ? undefined : text })} />
          </>
        )}
        {method === "TYPED" && <TypedFactorRows estimate={estimate} disabled={dis} onPatch={patchTyped} />}
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

function CcfWindows({ context, onClose, onRetarget, onToast }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void; onToast: (message: string) => void }): JSX.Element | null {
  switch (context.kind) {
    case "daCcfGroup": return <CcfGroupWindow id={context.id} onClose={onClose} onRetarget={onRetarget} onToast={onToast} />;
    case "daCcfEvents": return <CcfEventsWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daCcfFactors": return <CcfFactorsWindow id={context.id} onClose={onClose} onRetarget={onRetarget} onToast={onToast} />;
    default: return null;
  }
}

export { CCF_WINDOW_KINDS, CcfScreen, CcfWindows, STAGGERED_TOAST, TYPED_ALPHA_TOAST };
