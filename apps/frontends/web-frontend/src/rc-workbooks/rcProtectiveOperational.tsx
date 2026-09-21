import { useEffect, useRef, useState, type JSX } from "react";
import type { RcEarlyResponseCohort, RcEarlyResponseExposure, RcEarlyResponseModel } from "interfaces-mef-types/rc/early-response";
import { RcEarlyResponseModelSchema } from "interfaces-mef-types/zod/rc/early-response";
import { blankEarlyResponseModel } from "interfaces-shared-types/rc-workbooks/early-response-parser";
import { earlyResponseIssues } from "interfaces-shared-types/rc-workbooks/early-response";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RcSiteReceptorsPanel } from "./rcSiteReceptors";
import { RCIcon } from "./rcIcons";
import "./css/rcEarlyResponse.css";

type Tab = "population" | "cohorts" | "decisions" | "detail";
const tabs: { id: Tab; label: string }[] = [
  { id: "population", label: "Population" }, { id: "cohorts", label: "Response cohorts" },
  { id: "decisions", label: "Movement and relocation" }, { id: "detail", label: "Detailed inputs" },
];
const message = (error: unknown) => error instanceof Error ? error.message : "Could not save response inputs";
const number = (value: string) => value === "" ? undefined : Number(value);
const exposureFields: { key: keyof RcEarlyResponseExposure; label: string }[] = [
  { key: "cloudshineFactor", label: "Cloudshine factor (unitless)" }, { key: "inhalationFactor", label: "Inhalation factor (unitless)" },
  { key: "skinFactor", label: "Skin factor (unitless)" }, { key: "groundshineFactor", label: "Groundshine factor (unitless)" },
  { key: "breathingRateCubicMetresPerSecond", label: "Breathing rate (m³/s)" },
];
const numbers = (value: string, count?: number, max?: number) => {
  if (!value.trim()) return undefined;
  const parts = value.split(/[\s,]+/).filter(Boolean).map(Number);
  if (parts.some(n => !Number.isFinite(n) || n < 0 || max !== undefined && n > max) || count !== undefined && parts.length !== count)
    throw new Error(`Enter ${count ?? "the required"} nonnegative values${max !== undefined ? ` up to ${max}` : ""}.`);
  return parts;
};

export function RcProtectiveOperational({ initialSiteTab }: { openDrawer: (context: { kind: string; id: string }) => void; initialSiteTab?: "location" | "receptors" }): JSX.Element {
  return <><RcSiteReceptorsPanel initialTab={initialSiteTab} /><RcEarlyResponseEditor /></>;
}

function RcEarlyResponseEditor(): JSX.Element {
  const { rc, editable, earlyResponse: actions } = useRcWorkbook();
  const canEdit = editable && Boolean(actions);
  const saved = rc.protectiveActionParameters.earlyResponseModel;
  const [draft, setDraft] = useState<RcEarlyResponseModel>();
  const model = draft ?? saved;
  const [tab, setTab] = useState<Tab>("population"), [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [raw, setRaw] = useState("");
  const [json, setJson] = useState(""), [jsonDirty, setJsonDirty] = useState(false);
  const [lists, setLists] = useState({ shelter: "", evacuation: "", speeds: "", rain: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const cohort = model?.cohorts[selected];
  const dirty = Boolean(draft), conflict = dirty && Boolean(saved) && saved!.revision !== draft!.revision;
  const arrayPending = Boolean(cohort && (
    lists.shelter !== (cohort.evacuation.shelterDelaySecondsByBand?.join(", ") ?? "") ||
    lists.evacuation !== (cohort.evacuation.evacuationDelaySecondsByBand?.join(", ") ?? "") ||
    lists.speeds !== (cohort.evacuation.phaseSpeedsMetresPerSecond?.join(", ") ?? "") ||
    lists.rain !== (cohort.evacuation.precipitationMultipliers?.join(", ") ?? "")));
  const issues = model ? earlyResponseIssues(model, rc.protectiveActionParameters.siteAndReceptors) : [];
  const structural = model ? RcEarlyResponseModelSchema.safeParse(model) : undefined;
  useEffect(() => { setDraft(undefined); setRaw(""); setError(""); }, [saved?.revision]);
  useEffect(() => { setLists({ shelter: cohort?.evacuation.shelterDelaySecondsByBand?.join(", ") ?? "",
    evacuation: cohort?.evacuation.evacuationDelaySecondsByBand?.join(", ") ?? "",
    speeds: cohort?.evacuation.phaseSpeedsMetresPerSecond?.join(", ") ?? "",
    rain: cohort?.evacuation.precipitationMultipliers?.join(", ") ?? "" }); }, [selected, cohort?.id, saved?.revision]);
  const edit = (fn: (current: RcEarlyResponseModel) => RcEarlyResponseModel) => {
    setDraft(current => fn(structuredClone(current ?? saved ?? blankEarlyResponseModel()))); setError("");
  };
  const editCohort = (fn: (current: RcEarlyResponseCohort) => RcEarlyResponseCohort) => edit(current => ({ ...current,
    cohorts: current.cohorts.map((item, index) => index === selected ? fn(item) : item),
  }));
  const editEvac = (patch: Partial<RcEarlyResponseCohort["evacuation"]>) => editCohort(item => ({ ...item, evacuation: { ...item.evacuation, ...patch } }));
  const field = (label: string, value: number | undefined, change: (value: number | undefined) => void, min = 0) =>
    <label>{label}<WorkbookInput className="posfield__input posmono" type="number" step="any" min={min} value={value ?? ""} disabled={!canEdit || busy}
      onChange={event => change(number(event.target.value))} /></label>;
  const choice = <T extends string>(label: string, value: T, choices: { value: T; label: string }[], change: (value: T) => void) =>
    <label>{label}<select className="posfield__input" value={value} disabled={!canEdit || busy} onChange={event => change(event.target.value as T)}>
      {choices.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select></label>;
  const save = async () => {
    if (!draft || !actions || !structural?.success || conflict || jsonDirty || arrayPending) return;
    setBusy(true); setError("");
    try { await actions.save(saved?.revision ?? 0, draft); setDraft(undefined); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const changeTab = (next: Tab) => {
    if (arrayPending || jsonDirty && next !== "detail") { setError("Apply or discard the current input edits first."); return; }
    if (next === "detail" && tab !== "detail") { setJson(JSON.stringify(model, null, 2)); setJsonDirty(false); }
    setTab(next);
  };
  const arrayField = (label: string, key: keyof typeof lists, property: "shelterDelaySecondsByBand" | "evacuationDelaySecondsByBand" | "phaseSpeedsMetresPerSecond" | "precipitationMultipliers", count?: number, max?: number) =>
    <label>{label}<WorkbookInput className="posfield__input posmono" value={lists[key]} disabled={!canEdit || busy}
      onChange={event => setLists(current => ({ ...current, [key]: event.target.value }))} onBlur={() => {
        try {
          const parsed = numbers(lists[key], count, max);
          if (property === "phaseSpeedsMetresPerSecond" && parsed?.some(n => n === 0)) throw new Error("Phase speeds must be positive.");
          editEvac({ [property]: parsed }); setError("");
          setLists(current => ({ ...current, [key]: parsed?.join(", ") ?? "" }));
        } catch (cause) { setError(message(cause)); }
      }} /></label>;

  return <div className="poscard rc-response-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Early response" level={3} /></div>
    <section className="rc-response" aria-label="Early response inputs">
      <div className="rc-response-file"><div><span>Response input file</span><strong>{saved?.originalFile?.filename ?? "No file selected"}</strong><small>.inp · .txt · .json</small></div>
        <div className="rc-response-actions">{canEdit && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy || dirty} onClick={() => fileRef.current?.click()}>
          {saved?.originalFile ? <RCIcon.Refresh /> : <RCIcon.Plus />} {saved?.originalFile ? "Replace file" : "Import file"}</button>}
          {saved?.originalFile && actions && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={async () => {
            if (raw) { setRaw(""); return; } setBusy(true);
            try { setRaw(await actions.readOriginal(saved.originalFile!.documentId)); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
          }}><RCIcon.Eye /> {raw ? "Hide file" : "View file"}</button>}</div></div>
      {raw && <pre className="rc-response-raw">{raw}</pre>}
      {!model && <div className="rc-response-empty">{canEdit ? <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setDraft(blankEarlyResponseModel())}>Create response model</button> : "No response model"}</div>}
      {model && <>
        <div className="rc-response-tabs" role="tablist" aria-label="Response input groups">{tabs.map(item => <button type="button" key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => changeTab(item.id)}>{item.label}</button>)}</div>
        {tab === "population" && <div className="rc-response-panel" role="tabpanel"><h3>Population and result weighting</h3><div className="rc-response-fields">
          {choice("Population source", model.population.source, [{ value: "UNSET", label: "Choose" }, { value: "SITE_FILE", label: "Site file" }, { value: "UNIFORM", label: "Uniform density" }], value => edit(m => ({ ...m, population: { ...m.population, source: value } })))}
          {choice("Result weighting", model.population.weighting, [{ value: "UNSET", label: "Choose" }, { value: "PEOPLE", label: "People" }, { value: "TIME", label: "Time" }, { value: "SUMPOP", label: "Summed population" }], value => edit(m => ({ ...m, population: { ...m.population, weighting: value } })))}
          {field("Early phase (s)", model.earlyPhaseDurationSeconds, value => edit(m => ({ ...m, earlyPhaseDurationSeconds: value })))}
          {choice("Fine azimuth divisions (count)", String(model.fineGridAzimuthSubdivisions ?? "") as "" | "3" | "5" | "7", [{ value: "", label: "Choose" }, { value: "3", label: "3" }, { value: "5", label: "5" }, { value: "7", label: "7" }], value => edit(m => ({ ...m, fineGridAzimuthSubdivisions: value ? Number(value) as 3 | 5 | 7 : undefined })))}
        </div>
          {model.population.source === "UNIFORM" && <div className="rc-response-fields rc-response-subgroup">
            {field("First populated band (index)", model.population.uniform?.firstPopulatedBand, value => edit(m => ({ ...m, population: { ...m.population, uniform: { ...m.population.uniform, firstPopulatedBand: value } as NonNullable<RcEarlyResponseModel["population"]["uniform"]> } })), 1)}
            {field("Density (people/km²)", model.population.uniform?.densityPeoplePerSquareKm, value => edit(m => ({ ...m, population: { ...m.population, uniform: { ...m.population.uniform, densityPeoplePerSquareKm: value } as NonNullable<RcEarlyResponseModel["population"]["uniform"]> } })))}
            {field("Land fraction (unitless, 0–1)", model.population.uniform?.landFraction, value => edit(m => ({ ...m, population: { ...m.population, uniform: { ...m.population.uniform, landFraction: value } as NonNullable<RcEarlyResponseModel["population"]["uniform"]> } })))}</div>}
          {model.population.weighting === "SUMPOP" && <div className="rc-response-fields rc-response-subgroup">
            {choice("Population allocation", model.population.sumpop?.allocation ?? "UNSET" as "UNSET" | "COHORT_ARRAYS" | "SPATIAL_DISTRIBUTIONS",
              [{ value: "UNSET", label: "Choose" }, { value: "COHORT_ARRAYS", label: "Cohort cell arrays" }, { value: "SPATIAL_DISTRIBUTIONS", label: "Spatial distributions" }], value => edit(m => ({ ...m, population: { ...m.population,
                sumpop: value === "UNSET" ? undefined : { ...m.population.sumpop, allocation: value } } })))}</div>}
          <label className="rc-response-wide">Source reference<WorkbookInput className="posfield__input" value={model.sourceReference ?? ""} disabled={!canEdit || busy} onChange={event => edit(m => ({ ...m, sourceReference: event.target.value }))} /></label>
        </div>}
        {tab === "cohorts" && <div className="rc-response-panel" role="tabpanel"><div className="rc-response-heading"><h3>Response cohorts</h3>{canEdit && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => {
          edit(m => ({ ...m, cohorts: [...m.cohorts, { id: `cohort-${Date.now()}`, name: `Cohort ${m.cohorts.length + 1}`, evacuation: { shape: "UNSET" } }] })); setSelected(model.cohorts.length);
        }}><RCIcon.Plus /> Add cohort</button>}</div>
          <div className="rc-response-cohorts" role="tablist" aria-label="Cohorts">{model.cohorts.map((item, index) => <button key={item.id} type="button" role="tab" aria-selected={selected === index} onClick={() => { if (arrayPending) setError("Finish the band and travel values first."); else setSelected(index); }}>{item.name}</button>)}</div>
          {cohort && <><div className="rc-response-fields">
            <label>Cohort name<WorkbookInput className="posfield__input" value={cohort.name} disabled={!canEdit || busy} onChange={event => editCohort(item => ({ ...item, name: event.target.value }))} /></label>
            {field("Result weight (unitless, 0–1)", cohort.resultWeightFraction, value => editCohort(item => ({ ...item, resultWeightFraction: value })))}
            {choice("Evacuation zone", cohort.evacuation.shape, [{ value: "UNSET", label: "Choose" }, { value: "NONE", label: "No evacuation" }, { value: "CIRCULAR", label: "Circular" }, { value: "KEYHOLE", label: "Keyhole" }], value => editEvac({ shape: value }))}
            {field("Shelter / evacuation outer band (index)", cohort.evacuation.shelterAndEvacuationOuterBand, value => editEvac({ shelterAndEvacuationOuterBand: value }), 1)}
            {field("Movement outer band (index)", cohort.evacuation.movementOuterBand, value => editEvac({ movementOuterBand: value }), 1)}
            {cohort.evacuation.shape === "KEYHOLE" && <>
              {field("Inner circular band (index)", cohort.evacuation.keyhole?.innerCircularBand, value => editEvac({ keyhole: { ...cohort.evacuation.keyhole, innerCircularBand: value } }))}
              {field("Keyhole sectors (count)", cohort.evacuation.keyhole?.sectorCount, value => editEvac({ keyhole: { ...cohort.evacuation.keyhole, sectorCount: value } }), 1)}
            </>}
            {choice("Timing reference", cohort.evacuation.referencePoint ?? "UNSET" as "UNSET" | "ALARM" | "ARRIVAL", [{ value: "UNSET", label: "Choose" }, { value: "ALARM", label: "Alarm" }, { value: "ARRIVAL", label: "Plume arrival" }], value => editEvac({ referencePoint: value === "UNSET" ? undefined : value }))}
            {field("Notification after accident (s)", cohort.evacuation.notificationAfterAccidentSeconds, value => editEvac({ notificationAfterAccidentSeconds: value }))}
            {choice("Travel point", cohort.evacuation.travelPoint ?? "UNSET" as "UNSET" | "BOUNDARY" | "CENTERPOINT", [{ value: "UNSET", label: "Choose" }, { value: "BOUNDARY", label: "Cell boundary" }, { value: "CENTERPOINT", label: "Cell center" }], value => editEvac({ travelPoint: value === "UNSET" ? undefined : value }))}
            {field("First phase duration (s)", cohort.evacuation.firstPhaseDurationSeconds, value => editEvac({ firstPhaseDurationSeconds: value }))}
            {field("Middle phase duration (s)", cohort.evacuation.middlePhaseDurationSeconds, value => editEvac({ middlePhaseDurationSeconds: value }))}
            {field("Return after evacuation (s)", cohort.evacuation.returnAfterEvacuationSeconds, value => editEvac({ returnAfterEvacuationSeconds: value }))}
          </div><h3>Band and travel values</h3><div className="rc-response-fields">
            {arrayField("Shelter delays by band (s)", "shelter", "shelterDelaySecondsByBand", cohort.evacuation.shelterAndEvacuationOuterBand)}
            {arrayField("Evacuation delays by band (s)", "evacuation", "evacuationDelaySecondsByBand", cohort.evacuation.shelterAndEvacuationOuterBand)}
            {arrayField("Phase speeds (m/s; 3 values)", "speeds", "phaseSpeedsMetresPerSecond", 3)}
            {arrayField("Rain multipliers (unitless ×3)", "rain", "precipitationMultipliers", 3, 1)}
          </div><table className="rc-response-table"><thead><tr><th>Band</th><th>Shelter delay (s)</th><th>Evacuation delay (s)</th></tr></thead><tbody>{Array.from({ length: Math.max(cohort.evacuation.shelterDelaySecondsByBand?.length ?? 0, cohort.evacuation.evacuationDelaySecondsByBand?.length ?? 0) }, (_, index) => <tr key={index}><td>{index + 1}</td><td>{cohort.evacuation.shelterDelaySecondsByBand?.[index] ?? "—"}</td><td>{cohort.evacuation.evacuationDelaySecondsByBand?.[index] ?? "—"}</td></tr>)}</tbody></table>
            <h3>Exposure factors</h3><div className="rc-response-exposure">{(["normal", "sheltering", "evacuation", "projected"] as const).map(phase => <div key={phase} className="rc-response-exposure-set"><h4>{phase[0].toUpperCase() + phase.slice(1)}</h4>
              {exposureFields.map(({ key, label }) => <div key={key}>{field(label, cohort.exposure?.[phase]?.[key], value => editCohort(item => ({ ...item,
                exposure: { ...item.exposure, [phase]: { ...item.exposure?.[phase], [key]: value } },
              })), key === "breathingRateCubicMetresPerSecond" ? 0.000000000001 : 0)}</div>)}</div>)}</div>
            <label className="rc-response-wide">Critical organ<WorkbookInput className="posfield__input" value={cohort.criticalOrgan ?? ""} disabled={!canEdit || busy}
              onChange={event => editCohort(item => ({ ...item, criticalOrgan: event.target.value || undefined }))} /></label>
            {canEdit && <button type="button" className="posnav__btn posnav__btn--sm rc-response-remove" onClick={() => { edit(m => ({ ...m, cohorts: m.cohorts.filter((_, i) => i !== selected) })); setSelected(Math.max(0, selected - 1)); }}>Remove cohort</button>}</>}
        </div>}
        {tab === "decisions" && <div className="rc-response-panel" role="tabpanel"><h3>Movement and protective decisions</h3><div className="rc-response-fields">
          {choice("Movement model", model.movement.model, [{ value: "UNSET", label: "Choose" }, { value: "NONE", label: "None" }, { value: "RADIAL", label: "Radial" }, { value: "NETWORK", label: "Network" }], value => edit(m => ({ ...m, movement: { ...m.movement, model: value } })))}
          {field("Keyhole forecast (s)", model.movement.keyholeForecastSeconds, value => edit(m => ({ ...m, movement: { ...m.movement, keyholeForecastSeconds: value } })))}
          {choice("Iodine protection", model.iodineProtection, [{ value: "UNSET", label: "Choose" }, { value: "ON", label: "On" }, { value: "OFF", label: "Off" }], value => edit(m => ({ ...m, iodineProtection: value })))}
        </div><div className="rc-response-heading"><h3>Relocation</h3>{canEdit && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => edit(m => ({ ...m,
          relocation: m.relocation ? undefined : { projectionMode: "UNSET", normal: {}, hotSpot: {} } }))}>{model.relocation ? "Remove relocation" : "Add relocation"}</button>}</div>
          {model.relocation && <div className="rc-response-fields">
            {choice("Projection mode", model.relocation.projectionMode, [{ value: "UNSET", label: "Choose" }, { value: "ORIGL", label: "Original" }, { value: "TOTAL", label: "Total" }, { value: "AVOIDABLE", label: "Avoidable" }], value => edit(m => ({ ...m, relocation: { ...m.relocation!, projectionMode: value } })))}
            {field("Projection period (s)", model.relocation.projectionPeriodSeconds, value => edit(m => ({ ...m, relocation: { ...m.relocation!, projectionPeriodSeconds: value } })))}
            {field("Normal action delay (s)", model.relocation.normal.actionDelaySeconds, value => edit(m => ({ ...m, relocation: { ...m.relocation!, normal: { ...m.relocation!.normal, actionDelaySeconds: value } } })))}
            {field("Normal threshold (Sv)", model.relocation.normal.thresholdSv, value => edit(m => ({ ...m, relocation: { ...m.relocation!, normal: { ...m.relocation!.normal, thresholdSv: value } } })))}
            {field("Hot-spot action delay (s)", model.relocation.hotSpot.actionDelaySeconds, value => edit(m => ({ ...m, relocation: { ...m.relocation!, hotSpot: { ...m.relocation!.hotSpot, actionDelaySeconds: value } } })))}
            {field("Hot-spot threshold (Sv)", model.relocation.hotSpot.thresholdSv, value => edit(m => ({ ...m, relocation: { ...m.relocation!, hotSpot: { ...m.relocation!.hotSpot, thresholdSv: value } } })))}
          </div>}</div>}
        {tab === "detail" && <div className="rc-response-panel" role="tabpanel"><div className="rc-response-heading"><h3>Full response model</h3>
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={jsonDirty} onClick={() => {
            const blob = new Blob([JSON.stringify({ ...model, originalFile: undefined, revision: 1 }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob), link = document.createElement("a");
            link.href = url; link.download = "rc-early-response.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Download JSON</button></div>
          <textarea className="posfield__input rc-response-json posmono" aria-label="Full response model JSON" spellCheck={false} value={json} disabled={!canEdit || busy}
            onChange={event => { setJson(event.target.value); setJsonDirty(true); }} />
          {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" disabled={!jsonDirty || busy} onClick={() => {
            try {
              const parsed = RcEarlyResponseModelSchema.parse(JSON.parse(json));
              if (JSON.stringify(parsed.originalFile) !== JSON.stringify(saved?.originalFile) || JSON.stringify(parsed.unassignedRecords) !== JSON.stringify(saved?.unassignedRecords)) throw new Error("Imported file and records are read-only.");
              setDraft(parsed); setJsonDirty(false); setError("");
            } catch (cause) { setError(message(cause)); }
          }}>Apply model edits</button>}
          {canEdit && jsonDirty && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setJson(JSON.stringify(model, null, 2)); setJsonDirty(false); setError(""); }}>Discard JSON edits</button>}
          {!!model.unassignedRecords?.length && <details className="rc-response-source-records"><summary>{model.unassignedRecords.length} source records for review</summary><table className="rc-response-table"><thead><tr><th>Cohort</th><th>Record</th><th>Value</th></tr></thead><tbody>{model.unassignedRecords.slice(0, 100).map((record, index) => <tr key={index}><td>{record.cohortId}</td><td>{record.card}</td><td>{record.value}</td></tr>)}</tbody></table></details>}
        </div>}
        {!!issues.length && <details className="rc-response-checks"><summary>{issues.length} items to complete</summary><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
        {conflict && <p className="rc-response-error" role="alert">Response data changed. Discard edits and reload.</p>}
        {!!error && <p className="rc-response-error" role="alert">{error}</p>}
        <footer className="rc-response-footer">{canEdit && <><button type="button" className="posnav__btn posnav__btn--sm" disabled={!dirty || busy} onClick={() => { setDraft(undefined); setJsonDirty(false); setError(""); }}>Discard edits</button>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!dirty || busy || !structural?.success || conflict || jsonDirty || arrayPending} onClick={() => void save()}>Save response inputs</button></>}</footer>
      </>}
      <WorkbookInput ref={fileRef} type="file" hidden accept=".inp,.txt,.json" disabled={!canEdit || busy || dirty} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file || !actions) return;
        setBusy(true); setError("");
        try { await actions.importFile(saved?.revision ?? 0, file); setRaw(""); setSelected(0); }
        catch (cause) { setError(message(cause)); } finally { setBusy(false); }
      }} />
    </section>
  </div>;
}
