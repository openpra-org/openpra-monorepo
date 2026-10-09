import { Fragment, JSX, useId, useMemo, useState } from "react";
import type {
  DataAnalysis,
  DataAnalysisParameter,
  DaCountBasis,
  DaMaintenanceActivity,
  DaMaintenanceBasis,
  DaMaintenanceKind,
  DaMaintenanceMethod,
  DaOutage,
  DaOutOfServiceRecord,
  DaRestorationBasis,
  DaRestorationFrom,
  DaRestorationKind,
  DaRestorationPart,
  DaRestorationTime,
  DaSourceEntry,
  DaSourceUse,
} from "interfaces-mef-types/da/data-analysis";
import { useUncertaintyVersion } from "../newly-developed-methods/shared/useUncertainty";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { ClampCell, DaProvenanceChip, DaTabs, DetailRow, FieldList, FormFoot, FormRow, ModalHead, PlotToggle, sciText } from "./daShared";
import { DistributionChart, useElementWidth, type DistributionSeries } from "./daDistributionChart";
import { SurvivalChart, survivalGrid } from "./daSurvivalChart";
import { lawSummary, pointState } from "./daLaws";
import {
  coincidentParameters,
  maintenanceEstimate,
  maintenanceMethodOf,
  maintenanceSpread,
  restorationEstimate,
  restorationMethodOf,
  restorationParameters,
  survivalCurve,
  trainParameters,
  unavailabilityFindings,
  type DaMaintenanceEstimate,
} from "./daUnavailability";
import { libraryEntries, nextCode, sourceUseBase, withStoredEntry } from "./daSourcing";
import { nextParameterId } from "./daSelectors";
import { useDaWorkbook } from "./daWorkbookContext";
import {
  COUNT_BASIS_LABELS,
  MAINTENANCE_KIND_LABELS,
  MAINTENANCE_METHOD_LABELS,
  RESTORATION_FROM_LABELS,
  RESTORATION_KIND_LABELS,
} from "./daViewData";
import { AreaRow, EstimateRows, LinesRow, NEED_PAGE, NeedChecksTable, NeedPager, PraxisValue, estimateText, numberFrom, spreadFields, statText, systemOptions, waitNote, type DaDrawerContext } from "./daScreens";
import { DISTRIBUTION_CHOICES, DistributionFields, EstimatePicker, NumberInput, TextRow, distributionDraft, distributionText, entrySearchText, useBuiltInEntries, waitingSources, type EstimateChoice } from "./daSourcesScreen";

type UnavailabilityTab = "maintenance" | "coincident" | "repair" | "recovery" | "outages" | "checks";

type WeightMode = "EQUAL" | "TYPED" | "FREQUENCY";

const TAB_HEADS: Record<UnavailabilityTab, { title: string; sr: string }> = {
  maintenance: { title: "Test and maintenance", sr: "DA-C13 to C17" },
  coincident: { title: "Coincident maintenance", sr: "DA-C18 · DA-C19" },
  repair: { title: "Repair", sr: "DA-C20 · DA-C21 · DA-D6" },
  recovery: { title: "Recovery", sr: "DA-C22 · DA-C23 · DA-D6" },
  outages: { title: "Outages", sr: "DA-C24 · DA-C26" },
  checks: { title: "Unavailability, repair and recovery checks", sr: "DA-C13 to C26 · DA-D6" },
};

const UNAVAILABILITY_WINDOW_KINDS: ReadonlySet<string> = new Set(["daMaintenance", "daRestoration", "daOutage"]);

const MAINTENANCE_KINDS: DaMaintenanceKind[] = ["TRAIN", "COINCIDENT"];

const MAINTENANCE_METHODS: DaMaintenanceMethod[] = ["PLANNED", "RECORDS", "GENERIC"];

const RESTORATION_KINDS: DaRestorationKind[] = ["REPAIR", "RECOVERY"];

const RESTORATION_FROMS: DaRestorationFrom[] = ["SOURCES", "RECORDS"];

const COUNT_BASES: DaCountBasis[] = ["RECORDS", "ANNUALIZED_PLAN", "PLANNED_SCHEDULE"];

function nameOf(parameter: DataAnalysisParameter): string {
  return parameter.name.trim().length > 0 ? parameter.name : "Unnamed";
}

function hoursText(value: number | undefined): string {
  return value === undefined ? "—" : `${Number(value.toPrecision(4)).toLocaleString()} h`;
}

function plainText(value: number | undefined): string {
  return value === undefined ? "—" : String(Number(value.toPrecision(6)));
}

function patchParameter(mutateDa: (mutator: (da: DataAnalysis) => DataAnalysis) => void, id: string, next: Partial<DataAnalysisParameter>): void {
  mutateDa((draft) => ({ ...draft, parameters: draft.parameters.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
}

function pageOf<T>(rows: readonly T[], page: number): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  return { current, shown: rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE) };
}

function MaintenanceDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const [focus, setFocus] = useState("ESTIMATE");
  const estimate = maintenanceEstimate(da, parameter);
  const method = estimate.method;
  const expression = estimate.estimate;
  const span = method === "RECORDS" ? "in the data window" : "a year";
  const curve = expression?.node === "VALUE" ? lawSummary(expression.value.unit, expression.value.law, true) : undefined;
  const published = estimate.published !== undefined && estimate.trains !== 1 ? lawSummary("FRACTION", estimate.published, true) : undefined;
  const series: DistributionSeries[] = [];
  if (curve?.status === "ready") series.push({ key: "ESTIMATE", label: "Unavailability", detail: "", summary: curve.value });
  if (published?.status === "ready") series.push({ key: "PUBLISHED", label: "Published, per train", detail: "", summary: published.value });
  const items = [
    { label: "Kind", value: MAINTENANCE_KIND_LABELS[estimate.kind] },
    { label: "Method", value: method === undefined ? "Not chosen" : MAINTENANCE_METHOD_LABELS[method] },
  ];
  if (method === "PLANNED" || method === "RECORDS") {
    items.push({ label: "Counted", value: estimate.counted.length === 0 ? "—" : estimate.counted.map((item) => `${item.label} ${hoursText(item.hours)}`).join(", ") });
    items.push({ label: "Not counted", value: estimate.left.length === 0 ? "—" : estimate.left.map((item) => `${item.label} (${item.why === "SUPPORT" ? `charged to ${item.chargedTo ?? "?"}` : "function stays available"})`).join(", ") });
    items.push({ label: `Hours out ${span}`, value: hoursText(estimate.countedHours) });
    if (estimate.kind === "TRAIN") items.push({ label: "Joint hours taken out", value: hoursText(estimate.overlapHours) });
    items.push({ label: `Hours required ${span}`, value: hoursText(estimate.requiredHours) });
  }
  if (method === "GENERIC") items.push({ label: "Published, per train", value: statText(estimate.perTrain) });
  if (estimate.kind === "TRAIN" && method !== "TYPED") items.push({ label: "Trains", value: String(estimate.trains) });
  if (method !== "TYPED" && method !== "GENERIC") items.push({ label: "Per train", value: statText(estimate.perTrain) });
  items.push({ label: "Distribution", value: estimateText(expression) });
  items.push(...spreadFields(maintenanceSpread(estimate)));
  const note = estimate.problem ?? (estimate.pending ? "Waiting for PRAXIS." : waitNote([curve, published]));
  return (
    <>
      <FieldList items={items} />
      {note !== undefined && <p className="posmuted">{note}</p>}
      {expression !== undefined && expression.node !== "VALUE" && note === undefined && <p className="da-needs__meta">The unavailability combines several uncertain values, so its percentiles come from sampling and it has no single curve.</p>}
      {series.length > 0 && <DistributionChart series={series} focusKey={series.some((item) => item.key === focus) ? focus : series[0]?.key} unit="fraction of time" onFocus={setFocus} />}
    </>
  );
}

function maintenanceValue(estimate: DaMaintenanceEstimate): JSX.Element {
  if (estimate.method === undefined) return <>—</>;
  if (estimate.problem !== undefined) return <span className="da-severity da-severity--error" title={estimate.problem}>Cannot compute</span>;
  if (estimate.pending) return <PraxisValue state={{ status: "pending" }} />;
  return <PraxisValue state={estimate.estimate === undefined ? undefined : pointState(estimate.estimate, "FRACTION")} />;
}

function RestorationDetail({ parameter }: { parameter: DataAnalysisParameter }): JSX.Element {
  const { da } = useDaWorkbook();
  const estimate = restorationEstimate(da, parameter);
  const method = estimate.method;
  const output = estimate.output;
  const window = estimate.window;
  const hours = useMemo(() => (window === undefined ? [] : survivalGrid(window)), [window]);
  const curves = useMemo(() => (window === undefined ? [] : survivalCurve(da, parameter, hours)), [da, parameter, hours, window]);
  const typed = method === "TYPED" ? parameter.uncertainty?.distribution : undefined;
  const subjectText = (parameter.restoration?.subject ?? "").trim();
  const items = [
    { label: "Subject", value: subjectText.length > 0 ? subjectText : "—" },
    { label: "Method", value: method === undefined ? "Not chosen" : RESTORATION_FROM_LABELS[method] },
    { label: "Time available", value: hoursText(window) },
    { label: "State and sequence", value: parameter.restoration?.sequence ?? "—" },
  ];
  if (method === "SOURCES") {
    items.push({ label: "Parts", value: estimate.parts.length === 0 ? "—" : estimate.parts.map((part) => `${part.label}${part.weight === undefined ? "" : ` ${Math.round(part.weight * 1000) / 10}%`}`).join(", ") });
    const atMedians = estimate.parts.every((part) => part.survival !== undefined && part.weight !== undefined) && estimate.parts.length > 0 ? estimate.parts.reduce((total, part) => total + (part.weight ?? 0) * (part.survival ?? 0), 0) : undefined;
    items.push({ label: "Mean", value: statText(output?.mean) });
    items.push({ label: "At the fitted medians", value: statText(atMedians) });
    items.push({ label: "Comparison mean", value: statText(estimate.comparisonMean) });
  }
  if (method === "RECORDS") items.push({ label: "Fit to the times", value: estimate.fit === undefined ? "—" : `median ${hoursText(estimate.fit.median)}, log spread ${plainText(estimate.fit.sigma)}, ${estimate.fit.count} times` });
  items.push({ label: "Distribution", value: output === undefined ? "—" : distributionText(output.distribution) });
  items.push({ label: "5th percentile", value: statText(output?.p05) });
  items.push({ label: "95th percentile", value: statText(output?.p95) });
  const subject = subjectText.length > 0 ? subjectText.toLowerCase() : "the function";
  return (
    <>
      <FieldList items={items} />
      {estimate.problem !== undefined && <p className="posmuted">{estimate.problem}</p>}
      {method !== "TYPED" && window !== undefined && curves.length > 0 && <SurvivalChart hours={hours} series={curves} window={window} subject={subject} />}
      {typed !== undefined && <DistributionChart series={[{ key: "TYPED", label: "Typed probability", detail: "", distribution: typed }]} unit="probability" />}
    </>
  );
}

function useTableFilter(): { page: number; setPage: (page: number) => void; show: string; setShow: (value: string) => void } {
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  return { page, setPage, show, setShow };
}

function MaintenanceTable({ kind, selected, onSelect, openDrawer }: { kind: DaMaintenanceKind; selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const filters = useTableFilter();
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = kind === "TRAIN" ? trainParameters(da) : coincidentParameters(da);
  if (parameters.length === 0) return <p className="posmuted">{kind === "TRAIN" ? "No test and maintenance parameter yet. Map the maintenance events in Step 03, or add one." : "No coincident maintenance yet. Add one for each planned activity that takes redundant equipment out together."}</p>;
  const rows = parameters.filter((parameter) => filters.show === "all" || maintenanceEstimate(da, parameter).estimate === undefined);
  const { current, shown } = pageOf(rows, filters.page);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={filters.show} onChange={(event) => { filters.setShow(event.target.value); filters.setPage(0); }}>
          <option value="all">All parameters</option>
          <option value="open">Not estimated</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={filters.setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label={kind === "TRAIN" ? "Test and maintenance" : "Coincident maintenance"}>
          <thead><tr><th className="da-rowtable__pick">Plot</th><th>Parameter</th><th>Name</th><th>{kind === "TRAIN" ? "Method" : "Equipment"}</th><th>Mean</th></tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const estimate = maintenanceEstimate(da, parameter);
              const method = estimate.method;
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                    <td className="da-rowtable__pick"><PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /></td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daMaintenance", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                    <td className="da-rowtable__text">{nameOf(parameter)}</td>
                    {kind === "TRAIN" ? <td className="da-rowtable__text">{method === undefined ? "Not chosen" : MAINTENANCE_METHOD_LABELS[method]}</td> : <ClampCell text={(parameter.maintenance?.equipment ?? []).join(", ")} />}
                    <td className="da-rowtable__num">{maintenanceValue(estimate)}</td>
                  </tr>
                  {open && <DetailRow span={5} width={wrapWidth - 18}><MaintenanceDetail parameter={parameter} /></DetailRow>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RestorationTable({ kind, selected, onSelect, openDrawer }: { kind: DaRestorationKind; selected: string; onSelect: (key: string) => void; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const filters = useTableFilter();
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const parameters = restorationParameters(da, kind);
  if (parameters.length === 0) return <p className="posmuted">{kind === "REPAIR" ? "No repair is credited. Add one for each component whose repair Systems Analysis models (SY-A31)." : "No recovery is credited. Add one for offsite power and each other function the sequences recover."}</p>;
  const rows = parameters.filter((parameter) => filters.show === "all" || restorationEstimate(da, parameter).output === undefined);
  const { current, shown } = pageOf(rows, filters.page);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={filters.show} onChange={(event) => { filters.setShow(event.target.value); filters.setPage(0); }}>
          <option value="all">All parameters</option>
          <option value="open">Not estimated</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={filters.setPage} />
      </div>
      <div className="da-table-wrap" ref={wrapRef}>
        <table className="postable da-rowtable" aria-label={kind === "REPAIR" ? "Repair" : "Recovery"}>
          <thead><tr><th className="da-rowtable__pick">Plot</th><th>Parameter</th><th>Name</th><th>Window</th><th>Mean</th></tr></thead>
          <tbody>
            {shown.map((parameter) => {
              const estimate = restorationEstimate(da, parameter);
              const open = parameter.uuid === selected;
              return (
                <Fragment key={parameter.uuid}>
                  <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) onSelect(parameter.uuid); }}>
                    <td className="da-rowtable__pick"><PlotToggle open={open} label={parameter.uuid} onToggle={() => onSelect(open ? "" : parameter.uuid)} /></td>
                    <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daRestoration", id: parameter.uuid }); }}>{parameter.uuid}</button></td>
                    <td className="da-rowtable__text">{nameOf(parameter)}</td>
                    <td className="da-rowtable__num">{hoursText(estimate.window)}</td>
                    <td className="da-rowtable__num">{estimate.output !== undefined ? statText(estimate.output.mean) : estimate.method === undefined ? "—" : <span className="da-severity da-severity--error">Cannot compute</span>}</td>
                  </tr>
                  {open && <DetailRow span={5} width={wrapWidth - 18}><RestorationDetail parameter={parameter} /></DetailRow>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OutagesTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const outages = da.outages ?? [];
  if (outages.length === 0) return <p className="posmuted">No outage yet. Add each shutdown evolution with its operating state, duration and count per year.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Outages">
        <thead><tr><th>Outage</th><th>Evolution</th><th>State</th><th>Hours</th><th>Per year</th></tr></thead>
        <tbody>
          {outages.map((outage) => (
            <tr key={outage.id}>
              <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daOutage", id: outage.id })}>{outage.id}</button></td>
              <ClampCell text={outage.evolution} />
              <td>{outage.stateId ?? "—"}</td>
              <td className="da-rowtable__num">{plainText(outage.hours)}</td>
              <td className="da-rowtable__num">{plainText(outage.perYear)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function newMaintenance(da: DataAnalysis, id: string, kind: DaMaintenanceKind): DataAnalysisParameter {
  return {
    uuid: id,
    name: "",
    parameterType: "UNAVAILABILITY",
    quantificationModel: "UNAVAILABILITY",
    valueMode: "CALCULATED",
    maintenance: { kind, method: da.plantStage === "OPERATIONAL" ? "RECORDS" : "PLANNED", requiredHoursPerYear: 8760 },
    implementsSrs: [{ sr: kind === "COINCIDENT" ? "DA-C18" : "DA-C13", hlr: "C" }],
  };
}

function newRestoration(id: string, kind: DaRestorationKind): DataAnalysisParameter {
  return {
    uuid: id,
    name: "",
    parameterType: "PROBABILITY",
    valueType: "MEAN",
    quantificationModel: "NON_RECOVERY",
    valueMode: "CALCULATED",
    restoration: { kind, subject: "", from: "SOURCES" },
    implementsSrs: [{ sr: kind === "REPAIR" ? "DA-C20" : "DA-C22", hlr: "C" }],
  };
}

function UnavailabilityScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const [tab, setTab] = useState<UnavailabilityTab>("maintenance");
  const [trainKey, setTrainKey] = useState("");
  const [coincidentKey, setCoincidentKey] = useState("");
  const [repairKey, setRepairKey] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const tabId = useId();
  const trains = trainParameters(da);
  const coincident = coincidentParameters(da);
  const repairs = restorationParameters(da, "REPAIR");
  const recoveries = restorationParameters(da, "RECOVERY");
  const outages = da.outages ?? [];
  const findings = unavailabilityFindings(da);
  const tabs: { id: UnavailabilityTab; label: string }[] = [
    { id: "maintenance", label: `Maintenance (${trains.length})` },
    { id: "coincident", label: `Coincident (${coincident.length})` },
    { id: "repair", label: `Repair (${repairs.length})` },
    { id: "recovery", label: `Recovery (${recoveries.length})` },
    { id: "outages", label: `Outages (${outages.length})` },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = TAB_HEADS[tab];
  function addParameter(): void {
    if (!editable) return;
    const id = nextParameterId(new Set(da.parameters.map((parameter) => parameter.uuid)));
    const parameter = tab === "maintenance" ? newMaintenance(da, id, "TRAIN") : tab === "coincident" ? newMaintenance(da, id, "COINCIDENT") : newRestoration(id, tab === "repair" ? "REPAIR" : "RECOVERY");
    mutateDa((draft) => ({ ...draft, parameters: [...draft.parameters, parameter] }));
    openDrawer({ kind: tab === "maintenance" || tab === "coincident" ? "daMaintenance" : "daRestoration", id });
  }
  function addOutage(): void {
    if (!editable) return;
    const id = nextCode("OG", outages.map((outage) => outage.id), 1);
    mutateDa((draft) => ({ ...draft, outages: [...(draft.outages ?? []), { id, evolution: "", outageType: "", hours: 0, perYear: 1, basis: draft.plantStage === "OPERATIONAL" ? "RECORDS" : "PLANNED_SCHEDULE" }] }));
    openDrawer({ kind: "daOutage", id });
  }
  const addLabel = tab === "maintenance" ? "Add unavailability" : tab === "coincident" ? "Add coincident maintenance" : tab === "repair" ? "Add repair" : tab === "recovery" ? "Add recovery" : tab === "outages" ? "Add outage" : "";
  return (
    <div className="da-step">
      <DaTabs label="Unavailability, repair and recovery sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="da-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && addLabel.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={tab === "outages" ? addOutage : addParameter}>{addLabel}</button>}
            </div>
          </div>
          {tab === "maintenance" ? (
            <MaintenanceTable kind="TRAIN" selected={trainKey} onSelect={setTrainKey} openDrawer={openDrawer} />
          ) : tab === "coincident" ? (
            <MaintenanceTable kind="COINCIDENT" selected={coincidentKey} onSelect={setCoincidentKey} openDrawer={openDrawer} />
          ) : tab === "repair" ? (
            <RestorationTable kind="REPAIR" selected={repairKey} onSelect={setRepairKey} openDrawer={openDrawer} />
          ) : tab === "recovery" ? (
            <RestorationTable kind="RECOVERY" selected={recoveryKey} onSelect={setRecoveryKey} openDrawer={openDrawer} />
          ) : tab === "outages" ? (
            <OutagesTable openDrawer={openDrawer} />
          ) : (
            <NeedChecksTable findings={findings} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

function YesNoRow({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id}>
      <select id={id} className="posfield__select" value={value ? "yes" : "no"} disabled={disabled} onChange={(event) => onChange(event.target.value === "yes")}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </FormRow>
  );
}

function ChargedRow({ value, disabled, onChange }: { value: string | undefined; disabled: boolean; onChange: (value: string | undefined) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const id = useId();
  const options = systemOptions(da);
  return (
    <FormRow label="Charged to" htmlFor={id}>
      <select id={id} className="posfield__select" value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value.length === 0 ? undefined : event.target.value)}>
        <option value="">This parameter</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.id === option.name ? option.id : `${option.id} · ${option.name}`}</option>)}
        {value !== undefined && !options.some((option) => option.id === value) && <option value={value}>{value}</option>}
      </select>
      <span className="da-form__unit">a support system outage counts against that system (DA-C15)</span>
    </FormRow>
  );
}

function ActivityBlock({ activity, disabled, onPatch, onRemove }: { activity: DaMaintenanceActivity; disabled: boolean; onPatch: (next: Partial<DaMaintenanceActivity>) => void; onRemove: () => void }): JSX.Element {
  const fieldId = useId();
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{activity.id}{activity.activity.trim().length > 0 ? ` · ${activity.activity}` : ""}</legend>
      <TextRow label="Activity" value={activity.activity} disabled={disabled} onChange={(text) => onPatch({ activity: text })} />
      <FormRow label="Times a year" htmlFor={`${fieldId}-count`}>
        <WorkbookInput id={`${fieldId}-count`} className="posfield__input da-form__number" type="number" min="0" step="any" value={activity.perYear} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (perYear) => onPatch({ perYear: perYear ?? 0 }))} />
      </FormRow>
      <FormRow label="Hours each" htmlFor={`${fieldId}-hours`}>
        <WorkbookInput id={`${fieldId}-hours`} className="posfield__input da-form__number" type="number" min="0" step="any" value={activity.hoursEach} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (hoursEach) => onPatch({ hoursEach: hoursEach ?? 0 }))} />
        <span className="da-form__unit">hours out of service each time</span>
      </FormRow>
      <FormRow label="Range">
        <NumberInput label="Low hours" value={activity.hoursLow} disabled={disabled} onChange={(hoursLow) => onPatch({ hoursLow })} />
        <span className="da-form__unit">to</span>
        <NumberInput label="High hours" value={activity.hoursHigh} disabled={disabled} onChange={(hoursHigh) => onPatch({ hoursHigh })} />
        <span className="da-form__unit">hours, 5th to 95th, optional</span>
      </FormRow>
      <YesNoRow label="Takes out the function" value={activity.disablesFunction} disabled={disabled} onChange={(disablesFunction) => onPatch({ disablesFunction })} />
      {activity.disablesFunction && <ChargedRow value={activity.chargedTo} disabled={disabled} onChange={(chargedTo) => onPatch({ chargedTo })} />}
      <AreaRow label={activity.disablesFunction ? "Assumption or basis" : "Why it stays available"} value={activity.reason ?? ""} disabled={disabled} onChange={(reason) => onPatch({ reason: reason.trim().length === 0 ? undefined : reason })} />
      <TextRow label="Reference" value={activity.reference ?? ""} disabled={disabled} onChange={(reference) => onPatch({ reference: reference.trim().length === 0 ? undefined : reference })} />
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this activity</button>}
    </fieldset>
  );
}

function OutOfServiceBlock({ record, disabled, onPatch, onRemove }: { record: DaOutOfServiceRecord; disabled: boolean; onPatch: (next: Partial<DaOutOfServiceRecord>) => void; onRemove: () => void }): JSX.Element {
  const fieldId = useId();
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{record.id}{record.activity.trim().length > 0 ? ` · ${record.activity}` : ""}</legend>
      <TextRow label="Date" value={record.date ?? ""} disabled={disabled} onChange={(date) => onPatch({ date: date.trim().length === 0 ? undefined : date })} />
      <TextRow label="Activity" value={record.activity} disabled={disabled} onChange={(text) => onPatch({ activity: text })} />
      <FormRow label="Hours" htmlFor={`${fieldId}-hours`}>
        <WorkbookInput id={`${fieldId}-hours`} className="posfield__input da-form__number" type="number" min="0" step="any" value={record.hours} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (hours) => onPatch({ hours: hours ?? 0 }))} />
        <span className="da-form__unit">from tag-out to return to service</span>
      </FormRow>
      <YesNoRow label="Takes out the function" value={record.disablesFunction} disabled={disabled} onChange={(disablesFunction) => onPatch({ disablesFunction })} />
      {record.disablesFunction && <ChargedRow value={record.chargedTo} disabled={disabled} onChange={(chargedTo) => onPatch({ chargedTo })} />}
      <TextRow label="Reference" value={record.reference ?? ""} disabled={disabled} onChange={(reference) => onPatch({ reference: reference.trim().length === 0 ? undefined : reference })} />
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this record</button>}
    </fieldset>
  );
}

function TypedValueRows({ parameter, disabled, onPatch }: { parameter: DataAnalysisParameter; disabled: boolean; onPatch: (next: Partial<DataAnalysisParameter>) => void }): JSX.Element {
  const fieldId = useId();
  const distribution = parameter.uncertainty?.distribution;
  return (
    <>
      <FormRow label="Value" htmlFor={`${fieldId}-value`}>
        <WorkbookInput id={`${fieldId}-value`} className="posfield__input da-form__number" type="number" min="0" step="any" value={parameter.value ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (value) => onPatch({ value }))} />
        <select aria-label="Value type" className="posfield__select" value={parameter.valueType ?? "MEAN"} disabled={disabled} onChange={(event) => onPatch({ valueType: event.target.value === "POINT_ESTIMATE" ? "POINT_ESTIMATE" : "MEAN" })}>
          <option value="MEAN">Mean</option>
          <option value="POINT_ESTIMATE">Point estimate</option>
        </select>
      </FormRow>
      <FormRow label="Distribution" htmlFor={`${fieldId}-distribution`}>
        <select id={`${fieldId}-distribution`} className="posfield__select" value={distribution?.type ?? ""} disabled={disabled} onChange={(event) => { const next = distributionDraft(event.target.value, distribution, parameter.value); onPatch({ uncertainty: next === undefined ? undefined : { ...(parameter.uncertainty ?? {}), distribution: next } }); }}>
          {DISTRIBUTION_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
        {distribution !== undefined && <DistributionFields value={distribution} disabled={disabled} onChange={(next) => onPatch({ uncertainty: { ...(parameter.uncertainty ?? {}), distribution: next } })} />}
      </FormRow>
    </>
  );
}

function MaintenanceWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  useUncertaintyVersion();
  const fieldId = useId();
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const basis: DaMaintenanceBasis = parameter.maintenance ?? { kind: "TRAIN", method: da.plantStage === "OPERATIONAL" ? "RECORDS" : "PLANNED" };
  const method = maintenanceMethodOf(parameter);
  const activities = basis.activities ?? [];
  const records = basis.records ?? [];
  const coincident = coincidentParameters(da).filter((candidate) => candidate.uuid !== id);
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (editable) patchParameter(mutateDa, id, next);
  }
  function patchBasis(next: Partial<DaMaintenanceBasis>): void {
    patch({ maintenance: { ...basis, ...next } });
  }
  function setMethod(value: string): void {
    if (value === "TYPED") {
      patch({ valueMode: "TYPED", maintenance: basis });
      return;
    }
    const next = MAINTENANCE_METHODS.find((candidate) => candidate === value);
    if (next !== undefined) patch({ valueMode: "CALCULATED", maintenance: { ...basis, method: next } });
  }
  function setActivities(next: DaMaintenanceActivity[]): void {
    patchBasis({ activities: next });
  }
  function setRecords(next: DaOutOfServiceRecord[]): void {
    patchBasis({ records: next });
  }
  function toggleOverlap(otherId: string, checked: boolean): void {
    const current = basis.overlapIds ?? [];
    const next = checked ? [...current, otherId] : current.filter((candidate) => candidate !== otherId);
    patchBasis({ overlapIds: next.length === 0 ? undefined : next });
  }
  function addActivity(): void {
    setActivities([...activities, { id: nextCode("A", activities.map((item) => item.id), 1), activity: "", perYear: 1, hoursEach: 0, disablesFunction: true }]);
  }
  function addRecord(): void {
    setRecords([...records, { id: nextCode("R", records.map((item) => item.id), 1), activity: "", hours: 0, disablesFunction: true }]);
  }
  const counted = method === "PLANNED" || method === "RECORDS";
  return (
    <>
      <ModalHead cap={`Unavailability · ${MAINTENANCE_KIND_LABELS[basis.kind]} · ${basis.kind === "COINCIDENT" ? "DA-C18 · DA-C19" : "DA-C13 to C17"}`} title={`${parameter.uuid} · ${nameOf(parameter)}`} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Name" value={parameter.name} disabled={dis} onChange={(name) => patch({ name })} />
        <FormRow label="Kind" htmlFor={fid("kind")}>
          <select id={fid("kind")} className="posfield__select" value={basis.kind} disabled={dis} onChange={(event) => { const next = MAINTENANCE_KINDS.find((candidate) => candidate === event.target.value); if (next !== undefined) patchBasis({ kind: next, trains: next === "COINCIDENT" ? undefined : basis.trains, overlapIds: next === "COINCIDENT" ? undefined : basis.overlapIds }); }}>
            {MAINTENANCE_KINDS.map((candidate) => <option key={candidate} value={candidate}>{MAINTENANCE_KIND_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Method" htmlFor={fid("method")}>
          <select id={fid("method")} className="posfield__select" value={method ?? ""} disabled={dis} onChange={(event) => setMethod(event.target.value)}>
            {method === undefined && <option value="">Not chosen</option>}
            {MAINTENANCE_METHODS.map((candidate) => <option key={candidate} value={candidate}>{MAINTENANCE_METHOD_LABELS[candidate]}</option>)}
            <option value="TYPED">{MAINTENANCE_METHOD_LABELS.TYPED}</option>
          </select>
        </FormRow>
        {method === "TYPED" && <EstimateRows parameter={parameter} disabled={dis} onPatch={patch} />}
        {counted && (
          <>
            <FormRow label="Required hours" htmlFor={fid("required")}>
              <WorkbookInput id={fid("required")} className="posfield__input da-form__number" type="number" min="0" step="any" value={basis.requiredHoursPerYear ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (requiredHoursPerYear) => patchBasis({ requiredHoursPerYear }))} />
              <span className="da-form__unit">hours a year the function is required</span>
            </FormRow>
            <AreaRow label="Which states they cover" value={basis.requiredReason ?? ""} disabled={dis} onChange={(text) => patchBasis({ requiredReason: text.trim().length === 0 ? undefined : text })} />
          </>
        )}
        {basis.kind === "TRAIN" && method !== "TYPED" && (
          <>
            <FormRow label="Trains" htmlFor={fid("trains")}>
              <WorkbookInput id={fid("trains")} className="posfield__input da-form__number" type="number" min="1" step="1" value={basis.trains ?? 1} disabled={dis} onChange={(event) => numberFrom(event.target.value, (trains) => patchBasis({ trains: trains === undefined || trains === 1 ? undefined : trains }))} />
              <span className="da-form__unit">trains the event covers, out one at a time</span>
            </FormRow>
            {((basis.trains ?? 1) !== 1 || (basis.trainsReason ?? "").length > 0) && <AreaRow label="Why more than one" value={basis.trainsReason ?? ""} disabled={dis} onChange={(text) => patchBasis({ trainsReason: text.trim().length === 0 ? undefined : text })} />}
          </>
        )}
        {basis.kind === "COINCIDENT" && (
          <>
            <LinesRow label="Equipment out together" items={basis.equipment ?? []} disabled={dis} onChange={(equipment) => patchBasis({ equipment: equipment.length === 0 ? undefined : equipment })} />
            <FormRow label="Scope" htmlFor={fid("scope")}>
              <select id={fid("scope")} className="posfield__select" value={basis.scope ?? "INTRASYSTEM"} disabled={dis} onChange={(event) => patchBasis({ scope: event.target.value === "INTERSYSTEM" ? "INTERSYSTEM" : "INTRASYSTEM" })}>
                <option value="INTRASYSTEM">Within one system</option>
                <option value="INTERSYSTEM">Across systems</option>
              </select>
            </FormRow>
          </>
        )}
        {basis.kind === "TRAIN" && counted && coincident.length > 0 && (
          <div className="da-form__row da-form__row--top" role="group" aria-labelledby={fid("overlaps")}>
            <span className="posfield__label da-form__label" id={fid("overlaps")}>Joint activities inside these hours</span>
            <div className="da-form__checks">
              {coincident.map((other) => (
                <label key={other.uuid} className="da-form__check">
                  <input type="checkbox" checked={(basis.overlapIds ?? []).includes(other.uuid)} disabled={dis} onChange={(event) => toggleOverlap(other.uuid, event.target.checked)} />
                  <span>{other.uuid} · {nameOf(other)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {method === "PLANNED" && activities.map((activity) => (
          <ActivityBlock
            key={activity.id}
            activity={activity}
            disabled={dis}
            onPatch={(next) => setActivities(activities.map((candidate) => (candidate.id === activity.id ? { ...candidate, ...next } : candidate)))}
            onRemove={() => setActivities(activities.filter((candidate) => candidate.id !== activity.id))}
          />
        ))}
        {method === "PLANNED" && activities.length === 0 && <p className="posmuted">No activity yet. Add each test and maintenance activity of the planned program.</p>}
        {method === "RECORDS" && records.map((record) => (
          <OutOfServiceBlock
            key={record.id}
            record={record}
            disabled={dis}
            onPatch={(next) => setRecords(records.map((candidate) => (candidate.id === record.id ? { ...candidate, ...next } : candidate)))}
            onRemove={() => setRecords(records.filter((candidate) => candidate.id !== record.id))}
          />
        ))}
        {method === "RECORDS" && records.length === 0 && <p className="posmuted">No record yet. Add each time the equipment was out of service in the data window.</p>}
        {method === "GENERIC" && <p className="posmuted">The value is the Step 04 prior, a fraction of time out of service, times the trains.</p>}
        <AreaRow label={method === "GENERIC" ? "Why the published value fits" : "Basis"} value={basis.basis ?? ""} disabled={dis} onChange={(text) => patchBasis({ basis: text.trim().length === 0 ? undefined : text })} />
        <FormRow label="Risk significant" htmlFor={fid("risk")}>
          <select id={fid("risk")} className="posfield__select" value={parameter.isRiskSignificant === true ? "yes" : "no"} disabled={dis} onChange={(event) => patch({ isRiskSignificant: event.target.value === "yes" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {method === "GENERIC" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daSourcing", id })}>Open applicability</button>}
        {editable && method === "PLANNED" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addActivity}>Add activity</button>}
        {editable && method === "RECORDS" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addRecord}>Add record</button>}
      </FormFoot>
    </>
  );
}

function useText(da: DataAnalysis, use: DaSourceUse): string {
  if (use.elicitationId !== undefined) return `${use.id} · ${use.elicitationId}`;
  const entry = (da.sources ?? []).find((source) => source.id === use.sourceId)?.entries.find((candidate) => candidate.id === use.entryId);
  if (entry === undefined) return sourceUseBase(da, use) === undefined ? `${use.id} · Missing source` : `${use.id} · ${use.sourceId ?? "?"} · ${use.entryId ?? "?"}`;
  return `${use.id} · ${entry.id} · ${entry.component}`;
}

function weightModeOf(part: DaRestorationPart): WeightMode {
  if (part.weightSourceId !== undefined || part.weightEntryId !== undefined) return "FREQUENCY";
  return part.weight !== undefined ? "TYPED" : "EQUAL";
}

function frequencyChoices(da: DataAnalysis, builtIn: ReadonlyMap<string, DaSourceEntry[]>): EstimateChoice[] {
  return (da.sources ?? []).flatMap((source) => libraryEntries(source, builtIn.get(source.catalogId ?? "")).filter((entry) => entry.quantity === "PER_YEAR").map((entry) => ({
    value: `${source.id}|${entry.id}`,
    label: `${source.id} · ${entry.id} · ${entry.component} · ${entry.failureMode}`,
    detail: entry.mean !== undefined ? `mean ${sciText(entry.mean)} per year` : "per year",
    search: `${source.id} ${source.name} ${entrySearchText(entry)}`.toLowerCase(),
  })));
}

function PartBlock({ parameter, part, title, disabled, choices, onPatch, onPickWeight, onRemove }: {
  parameter: DataAnalysisParameter;
  part: DaRestorationPart;
  title: string;
  disabled: boolean;
  choices: EstimateChoice[];
  onPatch: (next: Partial<DaRestorationPart>) => void;
  onPickWeight: (sourceId: string, entryId: string) => void;
  onRemove: () => void;
}): JSX.Element {
  const { da } = useDaWorkbook();
  const fieldId = useId();
  const fid = (name: string): string => `${fieldId}-${name}`;
  const uses = (parameter.sourceUses ?? []).filter((use) => use.verdict !== "REJECTED");
  const mode = weightModeOf(part);
  const weightKey = part.weightSourceId !== undefined && part.weightEntryId !== undefined ? `${part.weightSourceId}|${part.weightEntryId}` : "";
  function setMode(value: string): void {
    if (value === "EQUAL") onPatch({ weight: undefined, weightSourceId: undefined, weightEntryId: undefined });
    else if (value === "TYPED") onPatch({ weight: part.weight ?? 1, weightSourceId: undefined, weightEntryId: undefined });
    else if (value === "FREQUENCY") onPatch({ weight: undefined, weightSourceId: part.weightSourceId ?? "", weightEntryId: part.weightEntryId ?? "" });
  }
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{title}</legend>
      <FormRow label="Source" htmlFor={fid("use")}>
        <select id={fid("use")} className="posfield__select" value={part.useId} disabled={disabled} onChange={(event) => onPatch({ useId: event.target.value })}>
          {!uses.some((use) => use.id === part.useId) && <option value={part.useId}>{part.useId.length === 0 ? "Not chosen" : `${part.useId}, no longer applies`}</option>}
          {uses.map((use) => <option key={use.id} value={use.id}>{useText(da, use)}</option>)}
        </select>
      </FormRow>
      <FormRow label="Weight" htmlFor={fid("mode")}>
        <select id={fid("mode")} className="posfield__select" value={mode} disabled={disabled} onChange={(event) => setMode(event.target.value)}>
          <option value="EQUAL">Equal</option>
          <option value="TYPED">Typed</option>
          <option value="FREQUENCY">A published frequency</option>
        </select>
        {mode === "TYPED" && <NumberInput label="Weight" value={part.weight} disabled={disabled} onChange={(weight) => onPatch({ weight })} />}
      </FormRow>
      {mode === "FREQUENCY" && (
        <FormRow label="Frequency" htmlFor={fid("frequency")}>
          <EstimatePicker id={fid("frequency")} value={weightKey} choices={choices} disabled={disabled} onChoose={(value) => { const [sourceId, entryId] = value.split("|"); if (sourceId !== undefined && entryId !== undefined) onPickWeight(sourceId, entryId); }} />
        </FormRow>
      )}
      <FormRow label="Events behind the fit" htmlFor={fid("count")}>
        <WorkbookInput id={fid("count")} className="posfield__input da-form__number" type="number" min="2" step="1" value={part.sampleSize ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (sampleSize) => onPatch({ sampleSize }))} />
        <span className="da-form__unit">events, for the spread of a lognormal median</span>
      </FormRow>
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this part</button>}
    </fieldset>
  );
}

function TimeBlock({ time, disabled, onPatch, onRemove }: { time: DaRestorationTime; disabled: boolean; onPatch: (next: Partial<DaRestorationTime>) => void; onRemove: () => void }): JSX.Element {
  const fieldId = useId();
  return (
    <fieldset className="da-use">
      <legend className="da-use__legend">{time.id}</legend>
      <FormRow label="Hours" htmlFor={`${fieldId}-hours`}>
        <WorkbookInput id={`${fieldId}-hours`} className="posfield__input da-form__number" type="number" min="0" step="any" value={time.hours} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (hours) => onPatch({ hours: hours ?? 0 }))} />
        <span className="da-form__unit">from finding the loss to return to service</span>
      </FormRow>
      <TextRow label="Date" value={time.date ?? ""} disabled={disabled} onChange={(date) => onPatch({ date: date.trim().length === 0 ? undefined : date })} />
      <TextRow label="Reference" value={time.reference ?? ""} disabled={disabled} onChange={(reference) => onPatch({ reference: reference.trim().length === 0 ? undefined : reference })} />
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm da-use__remove" onClick={onRemove}>Remove this time</button>}
    </fieldset>
  );
}

function RestorationWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const sources = da.sources ?? [];
  const builtIn = useBuiltInEntries(sources);
  const choices = useMemo(() => frequencyChoices(da, builtIn), [da, builtIn]);
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const basis: DaRestorationBasis = parameter.restoration ?? { kind: "RECOVERY", subject: "", from: "SOURCES" };
  const method = restorationMethodOf(parameter);
  const parts = basis.parts ?? [];
  const comparison = basis.comparison ?? [];
  const times = basis.times ?? [];
  const waiting = waitingSources(sources, builtIn);
  const firstUse = (parameter.sourceUses ?? []).find((use) => use.verdict !== "REJECTED")?.id ?? "";
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (editable) patchParameter(mutateDa, id, next);
  }
  function patchBasis(next: Partial<DaRestorationBasis>): void {
    patch({ restoration: { ...basis, ...next } });
  }
  function setMethod(value: string): void {
    if (value === "TYPED") {
      patch({ valueMode: "TYPED", restoration: basis });
      return;
    }
    const next = RESTORATION_FROMS.find((candidate) => candidate === value);
    if (next !== undefined) patch({ valueMode: "CALCULATED", restoration: { ...basis, from: next } });
  }
  function withList(current: DaRestorationBasis, list: "parts" | "comparison", next: DaRestorationPart[]): DaRestorationBasis {
    return list === "parts" ? { ...current, parts: next } : { ...current, comparison: next };
  }
  function setList(list: "parts" | "comparison", next: DaRestorationPart[]): void {
    patch({ restoration: withList(basis, list, next) });
  }
  function pickWeight(list: "parts" | "comparison", index: number, sourceId: string, entryId: string): void {
    if (!editable) return;
    const source = sources.find((candidate) => candidate.id === sourceId);
    const entry = source === undefined ? undefined : libraryEntries(source, builtIn.get(source.catalogId ?? "")).find((candidate) => candidate.id === entryId);
    if (entry === undefined) return;
    mutateDa((draft) => {
      const kept = withStoredEntry(draft, sourceId, entry);
      return {
        ...kept,
        parameters: kept.parameters.map((candidate) => {
          const current = candidate.restoration;
          if (candidate.uuid !== id || current === undefined) return candidate;
          const items = (list === "parts" ? current.parts : current.comparison) ?? [];
          return { ...candidate, restoration: withList(current, list, items.map((item, at) => (at === index ? { ...item, weight: undefined, weightSourceId: sourceId, weightEntryId: entryId } : item))) };
        }),
      };
    });
  }
  function partBlocks(owner: DataAnalysisParameter, list: "parts" | "comparison", items: DaRestorationPart[]): JSX.Element[] {
    return items.map((part, index) => (
      <PartBlock
        key={`${list}-${index}`}
        parameter={owner}
        part={part}
        title={`${list === "parts" ? "Part" : "Comparison part"} ${index + 1}`}
        disabled={dis}
        choices={choices}
        onPatch={(next) => setList(list, items.map((item, at) => (at === index ? { ...item, ...next } : item)))}
        onPickWeight={(sourceId, entryId) => pickWeight(list, index, sourceId, entryId)}
        onRemove={() => setList(list, items.filter((_, at) => at !== index))}
      />
    ));
  }
  return (
    <>
      <ModalHead cap={`${RESTORATION_KIND_LABELS[basis.kind]} · ${basis.kind === "REPAIR" ? "DA-C20 · DA-C21" : "DA-C22 · DA-C23"} · DA-D6`} title={`${parameter.uuid} · ${nameOf(parameter)}`} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Name" value={parameter.name} disabled={dis} onChange={(name) => patch({ name })} />
        <FormRow label="Kind" htmlFor={fid("kind")}>
          <select id={fid("kind")} className="posfield__select" value={basis.kind} disabled={dis} onChange={(event) => { const next = RESTORATION_KINDS.find((candidate) => candidate === event.target.value); if (next !== undefined) patchBasis({ kind: next }); }}>
            {RESTORATION_KINDS.map((candidate) => <option key={candidate} value={candidate}>{RESTORATION_KIND_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <TextRow label={basis.kind === "REPAIR" ? "What is repaired" : "What is recovered"} value={basis.subject} disabled={dis} onChange={(subject) => patchBasis({ subject })} />
        <FormRow label="Method" htmlFor={fid("method")}>
          <select id={fid("method")} className="posfield__select" value={method ?? ""} disabled={dis} onChange={(event) => setMethod(event.target.value)}>
            {method === undefined && <option value="">Not chosen</option>}
            {RESTORATION_FROMS.map((candidate) => <option key={candidate} value={candidate}>{RESTORATION_FROM_LABELS[candidate]}</option>)}
            <option value="TYPED">{RESTORATION_FROM_LABELS.TYPED}</option>
          </select>
        </FormRow>
        {method === "TYPED" && <TypedValueRows parameter={parameter} disabled={dis} onPatch={patch} />}
        <FormRow label="Time available" htmlFor={fid("window")}>
          <WorkbookInput id={fid("window")} className="posfield__input da-form__number" type="number" min="0" step="any" value={basis.windowHours ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (windowHours) => patchBasis({ windowHours }))} />
          <span className="da-form__unit">hours before the {basis.kind === "REPAIR" ? "repair" : "recovery"} no longer helps</span>
        </FormRow>
        <AreaRow label="Where the time comes from" value={basis.windowReason ?? ""} disabled={dis} onChange={(text) => patchBasis({ windowReason: text.trim().length === 0 ? undefined : text })} />
        <TextRow label="State and sequence" value={basis.sequence ?? ""} disabled={dis} onChange={(text) => patchBasis({ sequence: text.trim().length === 0 ? undefined : text })} />
        {method === "SOURCES" && partBlocks(parameter, "parts", parts)}
        {method === "SOURCES" && parts.length === 0 && <p className="posmuted">No part yet. Consider the time sources in Step 04 Applicability, then add each one as a part.</p>}
        {method === "SOURCES" && partBlocks(parameter, "comparison", comparison)}
        {method === "SOURCES" && waiting > 0 && parts.some((part) => weightModeOf(part) === "FREQUENCY") && <p className="da-needs__meta">Loading the built-in estimates of {waiting} {waiting === 1 ? "source" : "sources"}.</p>}
        {method === "RECORDS" && times.map((time, index) => (
          <TimeBlock
            key={time.id}
            time={time}
            disabled={dis}
            onPatch={(next) => patchBasis({ times: times.map((item, at) => (at === index ? { ...item, ...next } : item)) })}
            onRemove={() => patchBasis({ times: times.filter((_, at) => at !== index) })}
          />
        ))}
        {method === "RECORDS" && times.length === 0 && <p className="posmuted">No time yet. Add each restoration time, from finding the loss to return to service.</p>}
        <AreaRow label="Basis" value={basis.basis ?? ""} disabled={dis} onChange={(text) => patchBasis({ basis: text.trim().length === 0 ? undefined : text })} />
      </div>
      <FormFoot onClose={onClose}>
        {method === "SOURCES" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onRetarget({ kind: "daSourcing", id })}>Open applicability</button>}
        {editable && method === "SOURCES" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBasis({ parts: [...parts, { useId: firstUse }] })}>Add part</button>}
        {editable && method === "SOURCES" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBasis({ comparison: [...comparison, { useId: firstUse }] })}>Add comparison part</button>}
        {editable && method === "RECORDS" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBasis({ times: [...times, { id: nextCode("T", times.map((item) => item.id), 1), hours: 0 }] })}>Add time</button>}
      </FormFoot>
    </>
  );
}

function OutageWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const outage = (da.outages ?? []).find((candidate) => candidate.id === id);
  if (outage === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const states = da.dataNeeds?.states ?? [];
  function patch(next: Partial<DaOutage>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, outages: (draft.outages ?? []).map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({ ...draft, outages: (draft.outages ?? []).filter((candidate) => candidate.id !== id) }));
  }
  return (
    <>
      <ModalHead cap="Outage · DA-C24 · DA-C26" title={outage.evolution.trim().length > 0 ? `${outage.id} · ${outage.evolution}` : outage.id} onClose={onClose} />
      <div className="modal__body da-form">
        <TextRow label="Evolution" value={outage.evolution} disabled={dis} onChange={(evolution) => patch({ evolution })} />
        <TextRow label="Outage type" value={outage.outageType} disabled={dis} onChange={(outageType) => patch({ outageType })} />
        <FormRow label="Operating state" htmlFor={fid("state")}>
          <select id={fid("state")} className="posfield__select" value={outage.stateId ?? ""} disabled={dis} onChange={(event) => patch({ stateId: event.target.value.length === 0 ? undefined : event.target.value })}>
            <option value="">Not chosen</option>
            {states.map((state) => <option key={state.id} value={state.id}>{state.id} · {state.name}</option>)}
            {outage.stateId !== undefined && !states.some((state) => state.id === outage.stateId) && <option value={outage.stateId}>{outage.stateId}</option>}
          </select>
        </FormRow>
        <TextRow label="Start" value={outage.start ?? ""} disabled={dis} onChange={(start) => patch({ start: start.trim().length === 0 ? undefined : start })} />
        <FormRow label="Hours from" htmlFor={fid("from")}>
          <select id={fid("from")} className="posfield__select" value={outage.valueFrom ?? "TYPED"} disabled={dis} onChange={(event) => patch({ valueFrom: event.target.value === "POS" ? "POS" : undefined })}>
            <option value="TYPED">Typed in DA</option>
            <option value="POS">Imported from the POS state</option>
          </select>
        </FormRow>
        {outage.valueFrom === "POS" ? <p className="da-needs__meta">The duration and the count follow the hours and entries a year that POS gives {outage.stateId ?? "the chosen state"}.</p> : (
          <>
            <FormRow label="Duration" htmlFor={fid("hours")}>
              <WorkbookInput id={fid("hours")} className="posfield__input da-form__number" type="number" min="0" step="any" value={outage.hours} disabled={dis} onChange={(event) => numberFrom(event.target.value, (hours) => patch({ hours: hours ?? 0 }))} />
              <span className="da-form__unit">hours in the state each time</span>
            </FormRow>
            <FormRow label="Outages a year" htmlFor={fid("count")}>
              <WorkbookInput id={fid("count")} className="posfield__input da-form__number" type="number" min="0" step="any" value={outage.perYear} disabled={dis} onChange={(event) => numberFrom(event.target.value, (perYear) => patch({ perYear: perYear ?? 0 }))} />
              <span className="da-form__unit">per calendar year</span>
            </FormRow>
          </>
        )}
        <LinesRow label="Maintenance configurations" items={outage.configurations ?? []} disabled={dis} onChange={(configurations) => patch({ configurations: configurations.length === 0 ? undefined : configurations })} />
        <FormRow label="Basis" htmlFor={fid("basis")}>
          <select id={fid("basis")} className="posfield__select" value={outage.basis} disabled={dis} onChange={(event) => { const next = COUNT_BASES.find((candidate) => candidate === event.target.value); if (next !== undefined) patch({ basis: next }); }}>
            {COUNT_BASES.map((candidate) => <option key={candidate} value={candidate}>{COUNT_BASIS_LABELS[candidate]}</option>)}
          </select>
        </FormRow>
        <TextRow label="Reference" value={outage.reference ?? ""} disabled={dis} onChange={(reference) => patch({ reference: reference.trim().length === 0 ? undefined : reference })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove outage</button>}
      </FormFoot>
    </>
  );
}

function UnavailabilityWindows({ context, onClose, onRetarget }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  switch (context.kind) {
    case "daMaintenance": return <MaintenanceWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daRestoration": return <RestorationWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daOutage": return <OutageWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { TypedValueRows, UNAVAILABILITY_WINDOW_KINDS, UnavailabilityScreen, UnavailabilityWindows, useText };
