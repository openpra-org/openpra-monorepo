import { useEffect, useId, useMemo, useRef, useState, type JSX } from "react";
import type {
  RcWeatherInputs,
  RcWeatherModel,
  RcWeatherPage,
  RcWeatherSettings,
  RcWeatherTrialPage,
  RcWindSectors,
} from "interfaces-mef-types/rc/weather";
import { RcWeatherDatesSchema, RcWeatherModelSchema, RcWeatherSettingsSchema } from "interfaces-mef-types/zod/rc/weather";
import { sameWeatherSite, weatherIsReviewed, weatherIssues, weatherQualityIssues, weatherRecoveryPercent, weatherSectorCount, weatherSourceDistance, windToward } from "interfaces-shared-types/rc-workbooks/weather";
import { defaultWeatherModel, weatherBinDefinitions, weatherTreatmentNames } from "interfaces-shared-types/rc-workbooks/weather-trials";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcMeteorology.css";

type Tab = "records" | "dataset" | "quality" | "treatment" | "trials";
const tabs: { id: Tab; label: string }[] = [
  { id: "records", label: "Weather records" }, { id: "dataset", label: "Dataset" }, { id: "quality", label: "Quality basis" },
  { id: "treatment", label: "Weather treatment" }, { id: "trials", label: "Generated trials" },
];
const stabilityClasses = ["A", "B", "C", "D", "E", "F", "G"] as const;
const scientific = (value: number) => value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < 1e-3);
const show = (value: number | undefined) => value === undefined || !Number.isFinite(value) ? "—" : scientific(value) ? value.toExponential() : Number(value.toFixed(5)).toString();
const inputValue = (value: number | undefined) => value === undefined ? "" : scientific(value) ? value.toExponential() : value;
const numberValue = (value: string): number | undefined => value === "" ? undefined : Number(value);
const numberList = (value: string): number[] | undefined => {
  if (!value.trim()) return undefined;
  const parsed = value.split(",").map(item => Number(item.trim()));
  return parsed.every(Number.isFinite) ? parsed : [];
};
const failureMessage = (error: unknown) => error instanceof Error ? error.message : "Could not update weather inputs";
const recordRange = (data: NonNullable<RcWeatherInputs["data"]>) => data.first.day === data.last.day
  ? `Day ${data.first.day}, period ${data.first.period} to ${data.last.period}`
  : `Day ${data.first.day}, period ${data.first.period} to day ${data.last.day}, period ${data.last.period}`;
const methods = { TEMPERATURE_GRADIENT: "Temperature gradient", TURNER: "Turner’s method", SRDT: "Solar radiation and temperature gradient" };

export function RcMeteorologyPanel({ onReviewSite, onEditBasis, onEditQuality }: { onReviewSite?: () => void; onEditBasis?: () => void; onEditQuality?: () => void }): JSX.Element {
  const { rc, editable, weather: actions, weatherDraft, setWeatherDraft, weatherDates, setWeatherDates } = useRcWorkbook();
  const analysis = rc.meteorologicalData;
  const saved = rc.meteorologicalData.weatherInputs, draft = editable ? weatherDraft : undefined;
  const settings = draft?.settings ?? saved?.settings ?? {}, model = draft?.model ?? saved?.model;
  const revision = draft?.baseRevision ?? saved?.revision ?? 0, dirty = Boolean(draft);
  const weather: RcWeatherInputs = { ...saved, revision, settings, model, trialSet: dirty ? undefined : saved?.trialSet };
  const data = weather.data, config = weather.configuration, trialSet = weather.trialSet;
  const site = rc.protectiveActionParameters.siteAndReceptors, siteSettings = site?.settings ?? {};
  const count = weatherSectorCount(weather), distance = weatherSourceDistance(weather, siteSettings);
  const issues = weatherIssues(weather, siteSettings, site?.geometry, !dirty);
  const reviewed = !dirty && weatherIsReviewed(weather, siteSettings, site?.geometry);
  const conflict = dirty && revision !== (saved?.revision ?? 0);
  const valid = RcWeatherSettingsSchema.safeParse(settings).success && RcWeatherModelSchema.safeParse(model).success;
  const [source, setSource] = useState<"import" | "collect">("import"), [tab, setTab] = useState<Tab>("records");
  const [recordPage, setRecordPage] = useState(0), [trialPage, setTrialPage] = useState(0), [selectedRecord, setSelectedRecord] = useState(0);
  const [records, setRecords] = useState<RcWeatherPage>(), [trials, setTrials] = useState<RcWeatherTrialPage>();
  const [busy, setBusy] = useState(false), [loadingRecords, setLoadingRecords] = useState(false), [loadingTrials, setLoadingTrials] = useState(false);
  const [error, setError] = useState(""), [loadError, setLoadError] = useState(""), [retry, setRetry] = useState(0);
  const [raw, setRaw] = useState<{ documentId: string; text: string }>();
  const input = useRef<HTMLInputElement>(null), importKind = useRef<"weather" | "configuration">("weather"), tablist = useRef<HTMLDivElement>(null), id = useId();
  const disabled = !editable || !actions || busy, request = weather.collectionRequest, datesDraft = editable ? weatherDates : undefined;
  const dates = datesDraft ?? (request ? { start: request.start, end: request.end } : { start: "", end: "" });
  const recordOffset = Math.min(recordPage, Math.max(0, Math.ceil((data?.recordCount ?? 0) / 6) - 1)) * 6;
  const trialOffset = Math.min(trialPage, Math.max(0, Math.ceil((trialSet?.trialCount ?? 0) / 6) - 1)) * 6;

  useEffect(() => { setRecordPage(0); setSelectedRecord(0); setRaw(undefined); }, [weather.weatherFile?.documentId]);
  useEffect(() => { setTrialPage(0); }, [trialSet?.generatedAt]);
  useEffect(() => {
    let cancelled = false;
    setRecords(undefined); setLoadError("");
    if (tab !== "records" || !saved?.weatherFile || !actions) { setLoadingRecords(false); return; }
    setLoadingRecords(true);
    void actions.readRecords(recordOffset).then(result => {
      if (cancelled) return;
      if (result.revision !== saved.revision) { setLoadError("Weather inputs changed. Reload the workbook."); return; }
      setRecords(result); setSelectedRecord(0);
    }).catch(error => { if (!cancelled) setLoadError(failureMessage(error)); }).finally(() => { if (!cancelled) setLoadingRecords(false); });
    return () => { cancelled = true; };
  }, [actions, recordOffset, retry, saved?.revision, saved?.weatherFile, tab]);
  useEffect(() => {
    let cancelled = false;
    setTrials(undefined); setLoadError("");
    if (tab !== "trials" || !trialSet || !actions || dirty) { setLoadingTrials(false); return; }
    setLoadingTrials(true);
    void actions.readTrials(trialOffset).then(result => {
      if (cancelled) return;
      if (result.revision !== saved?.revision) { setLoadError("Weather inputs changed. Reload the workbook."); return; }
      setTrials(result);
    }).catch(error => { if (!cancelled) setLoadError(failureMessage(error)); }).finally(() => { if (!cancelled) setLoadingTrials(false); });
    return () => { cancelled = true; };
  }, [actions, dirty, retry, saved?.revision, tab, trialOffset, trialSet]);

  const initialModel = (): RcWeatherModel => model ?? (data ? defaultWeatherModel(data) : { mode: "constant", boundary: { enabled: false } });
  const updateDraft = (nextSettings: RcWeatherSettings, nextModel: RcWeatherModel | undefined) => {
    setWeatherDraft({ baseRevision: revision, settings: nextSettings, model: nextModel }); setError("");
  };
  const editSettings = (patch: Partial<RcWeatherSettings>) => {
    const next = { ...settings, ...patch };
    if ("latitude" in patch || "longitude" in patch) delete next.nearbySite;
    updateDraft(next, model);
  };
  const editModel = (next: RcWeatherModel) => updateDraft(settings, next);
  const changeMode = (mode: RcWeatherModel["mode"]) => {
    const current = initialModel(), common = { mode, boundary: current.boundary ?? { enabled: false } } as RcWeatherModel;
    if (mode !== "constant") common.mixingHeight = current.mixingHeight ?? (data?.mixingHeightMode === "per_record" ? "file" : "seasonal_day_only");
    if (mode === "fixed_start") common.fixedStart = current.fixedStart ?? data?.first;
    if (mode === "supplied_sequence") common.suppliedSequenceStart = current.suppliedSequenceStart ?? data?.first;
    if (["uniform_bin", "weighted_bin", "stratified"].includes(mode)) common.sampling = current.sampling ?? {};
    if (mode === "constant") common.constant = current.constant ?? {};
    editModel(common);
  };
  const editSampling = (patch: Partial<NonNullable<RcWeatherModel["sampling"]>>) => editModel({ ...initialModel(), sampling: { ...initialModel().sampling, ...patch } });
  const editConstant = (patch: Partial<NonNullable<RcWeatherModel["constant"]>>) => editModel({ ...initialModel(), constant: { ...initialModel().constant, ...patch } });
  const editBoundary = (patch: Partial<NonNullable<RcWeatherModel["boundary"]>>) => editModel({ ...initialModel(), boundary: { enabled: true, ...initialModel().boundary, ...patch } });
  const save = async (confirm: boolean) => {
    if (!actions || !model || !valid || conflict) return;
    setBusy(true); setError("");
    try { await actions.saveSettings(revision, settings, model, confirm); setWeatherDraft(undefined); }
    catch (error) { setError(failureMessage(error)); }
    finally { setBusy(false); }
  };
  const field = (label: string, key: "latitude" | "longitude" | "year", min: number, max: number, readOnly = false) => <label>{label}
    <WorkbookInput className="posfield__input posmono" type="number" step={key === "year" ? 1 : "any"} min={min} max={max} readOnly={readOnly} disabled={disabled} aria-label={label} value={inputValue(settings[key])}
      onChange={event => editSettings({ [key]: numberValue(event.target.value) })} />
  </label>;
  const modelNumber = (label: string, value: number | undefined, change: (value: number | undefined) => void, unit?: string, min?: number, max?: number, step: string | number = "any") => <label>{label}{unit && <span className="mw-unit"> ({unit})</span>}
    <WorkbookInput className="posfield__input posmono" type="number" step={step} min={min} max={max} disabled={disabled} aria-label={label} value={inputValue(value)} onChange={event => change(numberValue(event.target.value))} />
  </label>;
  const chooseFile = (kind: "weather" | "configuration") => {
    importKind.current = kind;
    if (input.current) input.current.accept = kind === "weather" ? ".met,.MET,.txt,.inp,.dat" : ".inp,.txt,.dat";
    input.current?.click();
  };
  const fileBox = (kind: "weather" | "configuration") => {
    const file = kind === "weather" ? weather.weatherFile : weather.configurationFile;
    return <><div className="mw-file"><div className="mw-file-info"><span className="mw-small">{kind === "weather" ? "Imported weather data file" : "Imported generation settings file"}</span>
      <strong>{file?.filename ?? "No file selected"}</strong><span className="mw-small">{kind === "weather" ? ".met · .txt · .inp · .dat" : ".inp · .txt · .dat"}</span>
    </div><div className="mw-file-actions">{editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty} onClick={() => chooseFile(kind)}>{file ? <RCIcon.Refresh /> : <RCIcon.Plus />} {file ? "Replace file" : "Import file"}</button>}
      {file && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy || !actions} onClick={async () => {
        if (raw?.documentId === file.documentId) { setRaw(undefined); return; }
        setBusy(true); setError("");
        try { setRaw({ documentId: file.documentId, text: await actions!.readOriginal(file.documentId) }); } catch (error) { setError(failureMessage(error)); } finally { setBusy(false); }
      }}><RCIcon.Eye /> {raw?.documentId === file.documentId ? "Hide file" : "View file"}</button>}
    </div></div>{raw?.documentId === file?.documentId && <pre className="mw-raw" aria-label="Original weather input">{raw?.text}</pre>}</>;
  };
  const siteLink = <button type="button" className="posnav__btn posnav__btn--sm" disabled={!onReviewSite || busy} onClick={onReviewSite}>{editable ? "Edit site in Step 02" : "View site in Step 02"}</button>;
  const row = records?.records[selectedRecord], toward = row ? windToward(row, count) : undefined;
  const requestMatches = sameWeatherSite(request, siteSettings);
  const downloadRequest = () => {
    if (!request) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "openpra-weather-collection-request", version: 1, ...request }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "openpra-weather-collection-request.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const status = busy ? "Working…" : dirty ? "Unsaved changes" : undefined;
  const treatment = model ?? initialModel(), sampling = treatment.sampling ?? {}, constant = treatment.constant ?? {}, boundary = treatment.boundary ?? { enabled: false };
  const isConstant = treatment.mode === "constant";
  const binDefinitions = useMemo(() => weatherBinDefinitions(sampling), [sampling]);
  const cellGeometry = site?.geometry?.kind === "cells" ? site.geometry : undefined;
  const recoveryPercent = weatherRecoveryPercent(weather) ?? analysis.dataRecovery.combinedRecoveryPercent;
  const recoveryMet = recoveryPercent === undefined ? analysis.dataRecovery.meetsNinetyPercent : recoveryPercent >= 90;
  const sourceDescription = analysis.dataSource || weather.weatherFile?.filename || "";
  const periodDescription = analysis.periodSelection.periodDescription || config?.dateGroups.map(group => `${group.start} to ${group.end}`).join("; ") || "";
  const stabilityDescription = analysis.stabilityClassificationMethod.description || (config ? `${methods[config.stabilityMethod]} · ${weather.configurationFile?.filename ?? "generation settings"}` : "");
  const qualityIssues = weatherQualityIssues({ ...analysis, weatherInputs: weather, dataSource: sourceDescription,
    periodSelection: { ...analysis.periodSelection, periodDescription },
    dataRecovery: { ...analysis.dataRecovery, combinedRecoveryPercent: recoveryPercent, meetsNinetyPercent: recoveryMet },
    extractedParameters: data ? { windSpeedAndDirection10m: true, stabilityClassMeasurement: true, precipitation: true } : analysis.extractedParameters,
    stabilityClassificationMethod: { ...analysis.stabilityClassificationMethod, approach: config ? "RECOGNIZED_SOURCE" : analysis.stabilityClassificationMethod.approach, description: stabilityDescription },
    timeResolution: data ? `${data.intervalMinutes} min` : analysis.timeResolution,
  });
  const sourceFile = weather.configurationFile?.filename ?? "Manual entry";
  const dataFile = weather.weatherFile?.filename ?? "Weather data file";
  const settingsRows = [
    ...(config ? [{ label: "Data year", value: settings.year?.toString() ?? "Not supplied", source: sourceFile },
      { label: "Wind direction sectors", value: count?.toString() ?? "Not supplied", source: sourceFile },
      { label: "External dataset", value: config.dataset || "Not supplied", source: sourceFile },
      { label: "Requested period", value: config.dateGroups.map(group => `${group.start} to ${group.end}`).join("; "), source: sourceFile }] : []),
    ...(data || config ? [{ label: "Record interval", value: `${data?.intervalMinutes ?? config!.intervalMinutes} min`, source: config ? `${data ? `${dataFile}; ` : ""}${sourceFile}` : dataFile },
      { label: "UTC offset", value: `${data?.utcOffsetHours ?? config?.utcOffsetHours ?? 0} h`, source: config ? `${data ? `${dataFile}; ` : ""}${sourceFile}` : dataFile },
      { label: "Mixing height", value: data?.mixingHeightMode === "per_record" ? "Each weather record" : data?.mixingHeightMode === "seasonal" || config ? "Seasonal values" : "Not supplied", source: data?.mixingHeightMode === "per_record" ? dataFile : config ? sourceFile : dataFile }] : []),
  ];
  const periodApproach = analysis.periodSelection.approach === "MULTI_YEAR_EVALUATION" ? "Multi-year evaluation" : "Representative single year";
  const reviewTable = (name: string, items: { label: string; value: string }[]) => <table className="mw-review-table" aria-label={name}><tbody>{items.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.value || "Not recorded"}</td></tr>)}</tbody></table>;

  return <div className="poscard rc-weather-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Weather inputs" level={3} /></div>
    <section className="rc-meteorology" aria-label="Weather inputs">
      <div className="mw-source-choice" role="group" aria-label="Weather source">
        <button type="button" className="posnav__btn posnav__btn--sm" aria-pressed={source === "import"} onClick={() => setSource("import")}>Import weather file</button>
        <button type="button" className="posnav__btn posnav__btn--sm" aria-pressed={source === "collect"} onClick={() => setSource("collect")}>OpenRC collection request</button>
      </div>
      {source === "import" ? <>
        <div className="mw-tabs" role="tablist" aria-label="Meteorology" ref={tablist} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const current = tabs.findIndex(item => item.id === tab);
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          setTab(tabs[next].id); tablist.current?.querySelectorAll<HTMLButtonElement>("button")[next].focus();
        }}>
          {tabs.map(item => <button type="button" key={item.id} id={`${id}-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`${id}-panel`} tabIndex={tab === item.id ? 0 : -1} onClick={() => { setTab(item.id); setRaw(undefined); }}>
            {item.label}{item.id === "records" && data && <span className="mw-count"> {data.recordCount}</span>}{item.id === "trials" && trialSet && <span className="mw-count"> {trialSet.trialCount}</span>}
          </button>)}
        </div>
        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
          {tab === "records" && <>{fileBox("weather")}{!data ? <p className="mw-empty">No weather records.</p> : <>
            <div className="mw-section-title"><h3>Imported records</h3></div>
            <div className="mw-meta"><span>{data.intervalMinutes}-minute averages</span><span>{recordRange(data)}</span>{data.gaps > 0 && <span>{data.gaps} gaps · {data.missingPeriods} missing periods</span>}</div>
            {loadingRecords && <p role="status" className="mw-note">Loading records…</p>}
            {loadError && <p className="mw-error" role="alert">{loadError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
            {records && <><table className="mw-records-table" aria-label="Weather records"><thead><tr><th>Day / period</th><th>Wind (m/s)</th><th>Wind toward (°)</th><th>Stability</th></tr></thead><tbody>
              {records.records.map((record, index) => <tr key={`${record.day}-${record.period}`} data-selected={index === selectedRecord}><td><button type="button" className="posnav__btn posnav__btn--sm posnav__btn--ghost" aria-label={`Inspect weather record ${recordOffset + index + 1}`} aria-pressed={index === selectedRecord} onClick={() => setSelectedRecord(index)}>{record.day} / {record.period}</button></td><td>{show(record.windSpeedMetresPerSecond)}</td><td>{show(windToward(record, count))}</td><td>{record.stabilityClass}</td></tr>)}
            </tbody></table><div className="mw-pagination"><span>{recordOffset + 1} to {Math.min(recordOffset + 6, data.recordCount)} of {data.recordCount} records</span><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!recordOffset} onClick={() => setRecordPage(recordPage - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={recordOffset + 6 >= data.recordCount} onClick={() => setRecordPage(recordPage + 1)}>Next</button></div></div></>}
            {row && <div className="mw-detail"><strong>Record {recordOffset + selectedRecord + 1} · day {row.day}, period {row.period}</strong><dl>
              <div><dt>Original wind sector</dt><dd>{row.windSector} of {count ?? "—"}</dd></div><div><dt>Wind comes from</dt><dd>{show(toward === undefined ? undefined : (toward + 180) % 360)}°</dd></div>
              <div><dt>Rain</dt><dd>{row.rainMillimetresPerHour === null ? "Trace" : `${show(row.rainMillimetresPerHour)} mm/h`}</dd></div><div><dt>Mixing height</dt><dd>{row.mixingHeightMetres === undefined ? "Seasonal" : `${show(row.mixingHeightMetres)} m`}</dd></div>
            </dl><details><summary>Original record</summary><pre>{row.original}</pre></details></div>}
          </>}</>}

          {tab === "dataset" && <>{fileBox("configuration")}<div className="mw-section-title"><h3>{config ? "Extracted settings" : "Weather source"}</h3></div>
            {!config && <div className="mw-fields">{field("Latitude (°)", "latitude", -90, 90)}{field("Longitude (°)", "longitude", -180, 180)}{field("Data year", "year", 1000, 9999)}
              <label>Wind direction sectors{data?.windSectors !== undefined || config ? <WorkbookInput className="posfield__input posmono" aria-label="Wind direction sectors" readOnly value={count ?? ""} /> :
                <select className="posfield__select" aria-label="Wind direction sectors" disabled={disabled} value={settings.windSectors ?? ""} onChange={event => editSettings({ windSectors: event.target.value ? Number(event.target.value) as RcWindSectors : undefined })}><option value="">Choose sectors</option>{[16, 32, 48, 64].map(value => <option key={value} value={value}>{value}</option>)}</select>}
              </label></div>}
            {settingsRows.length > 0 && <table className="mw-source-table" aria-label="Extracted weather settings"><thead><tr><th>Parameter</th><th>Value</th><th>Source</th></tr></thead><tbody>{settingsRows.map(item => <tr key={item.label}><td>{item.label}</td><td>{item.value}</td><td>{item.source}</td></tr>)}</tbody></table>}
            <div className="mw-location-check"><div className="mw-section-title"><h3>Location comparison</h3>{siteLink}</div>
              {config ? <table className="mw-location-table" aria-label="Weather and release locations"><thead><tr><th>Location</th><th>Coordinates or distance</th><th>Source</th></tr></thead><tbody><tr><td>Weather station</td><td>{show(settings.latitude)}°, {show(settings.longitude)}°</td><td>{sourceFile}</td></tr><tr><td>Release site</td><td>{show(siteSettings.latitude)}°, {show(siteSettings.longitude)}°</td><td>Step 02</td></tr><tr><td>Separation</td><td>{distance === undefined ? "—" : `${show(distance)} km`}</td><td>Calculated</td></tr></tbody></table>
                : <dl className="mw-readonly"><div><dt>Release site</dt><dd>{show(siteSettings.latitude)}°, {show(siteSettings.longitude)}°</dd></div><div><dt>Separation</dt><dd>{distance === undefined ? "—" : `${show(distance)} km`}</dd></div></dl>}
              {distance !== undefined && distance > .05 && <label className="mw-check-label"><WorkbookInput type="checkbox" disabled={disabled} checked={sameWeatherSite(settings.nearbySite, siteSettings)} onChange={event => editSettings({ nearbySite: event.target.checked ? { latitude: siteSettings.latitude!, longitude: siteSettings.longitude! } : undefined })} /><span>Use this weather source for the Step 02 site</span></label>}
            </div>
          </>}

          {tab === "quality" && <>
            <div className="mw-section-title"><h3>Source and period</h3>{editable && onEditBasis && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onEditBasis}><RCIcon.Settings /> Edit</button>}</div>
            {reviewTable("Source and period", [{ label: "Data source", value: sourceDescription }, { label: "Spatial representativeness", value: analysis.spatialRepresentativenessJustification }, { label: "Period-selection approach", value: periodApproach }, { label: "Period-selection basis", value: periodDescription }])}
            <div className="mw-section-title"><h3>Measurements</h3></div>
            {reviewTable("Measurements", [{ label: "Wind", value: isConstant ? `${show(constant.windSpeedMetresPerSecond)} m/s` : data || analysis.extractedParameters.windSpeedAndDirection10m ? "Supplied" : "Not confirmed" }, { label: "Stability", value: isConstant ? constant.stabilityClass ?? "Not supplied" : data || analysis.extractedParameters.stabilityClassMeasurement ? "Supplied" : "Not confirmed" }, { label: "Precipitation", value: isConstant ? `${show(constant.rainMillimetresPerHour)} mm/h` : data || analysis.extractedParameters.precipitation ? "Supplied" : "Not confirmed" }, { label: "Mixing height", value: isConstant ? `${show(constant.mixingHeightMetres)} m` : data?.mixingHeightMode === "per_record" ? "Each weather record" : data?.mixingHeightMode === "seasonal" || config ? "Seasonal values" : "Not supplied" }])}
            <div className="mw-section-title"><h3>Quality controls</h3>{editable && onEditQuality && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onEditQuality}><RCIcon.Settings /> Edit</button>}</div>
            {reviewTable("Quality controls", [...(isConstant ? [] : [{ label: "Instrumentation program", value: analysis.instrumentationQuality?.calibratedProgram ? "Calibrated and maintained" : "Not confirmed" }, { label: "Instrumentation basis", value: analysis.instrumentationQuality?.description ?? "" }]), { label: "Accuracy review", value: analysis.accuracyReview.performed ? "Performed" : "Not performed" }, { label: "Accuracy findings", value: analysis.accuracyReview.findings ?? "" }, ...(isConstant ? [] : [{ label: "Stability method", value: analysis.stabilityClassificationMethod.approach === "RECOGNIZED_SOURCE" ? "Recognized source" : "Simplified" }, { label: "Stability-method basis", value: stabilityDescription }]), { label: "Temporal treatment", value: analysis.temporalChangesAccommodation ?? "" }, { label: "Parameter uncertainty", value: analysis.parameterUncertaintyCharacterization ?? "" }])}
            <details className="mw-checks"><summary>{qualityIssues.length ? `${qualityIssues.length} quality ${qualityIssues.length === 1 ? "item" : "items"} to complete` : "Quality basis complete"}</summary>{qualityIssues.length > 0 && <ul>{qualityIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>}</details>
          </>}

          {tab === "treatment" && <><div className="mw-section-title"><h3>Trial selection</h3></div>
            <div className="mw-fields mw-treatment-head"><label>Weather treatment<select className="posfield__select" aria-label="Weather treatment" disabled={disabled} value={treatment.mode} onChange={event => changeMode(event.target.value as RcWeatherModel["mode"])}>
              {Object.entries(weatherTreatmentNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>{treatment.mode !== "constant" && <label>Mixing-height treatment<select className="posfield__select" aria-label="Mixing-height treatment" disabled={disabled} value={treatment.mixingHeight ?? ""} onChange={event => editModel({ ...treatment, mixingHeight: event.target.value as NonNullable<RcWeatherModel["mixingHeight"]> })}>
              <option value="">Choose treatment</option><option value="file">Value in each weather record</option><option value="seasonal_day_only">Seasonal daytime value</option><option value="seasonal_day_night">Seasonal day and night values</option>
            </select></label>}</div>
            {treatment.mode === "fixed_start" && <div className="mw-fields">{modelNumber("Starting day", treatment.fixedStart?.day, value => editModel({ ...treatment, fixedStart: { ...treatment.fixedStart, day: value } }), undefined, 1, 365, 1)}{modelNumber("Starting period", treatment.fixedStart?.period, value => editModel({ ...treatment, fixedStart: { ...treatment.fixedStart, period: value } }), undefined, 1, 96, 1)}</div>}
            {treatment.mode === "supplied_sequence" && <div className="mw-fields">{modelNumber("Sequence starting day", treatment.suppliedSequenceStart?.day, value => editModel({ ...treatment, suppliedSequenceStart: { ...treatment.suppliedSequenceStart, day: value } }), undefined, 1, 365, 1)}{modelNumber("Sequence starting period", treatment.suppliedSequenceStart?.period, value => editModel({ ...treatment, suppliedSequenceStart: { ...treatment.suppliedSequenceStart, period: value } }), undefined, 1, 96, 1)}</div>}
            {treatment.mode === "stratified" && <div className="mw-fields">{modelNumber("Samples per day", sampling.samplesPerDay, value => editSampling({ samplesPerDay: value }), undefined, 1, 96, 1)}{modelNumber("Random seed", sampling.randomSeed, value => editSampling({ randomSeed: value }), undefined, 0, 255, 1)}</div>}
            {["uniform_bin", "weighted_bin"].includes(treatment.mode) && <>
              <div className="mw-fields mw-sampling-fields">{treatment.mode === "uniform_bin" && modelNumber("Samples per bin", sampling.samplesPerBin, value => editSampling({ samplesPerBin: value }), undefined, 1, 35040, 1)}{modelNumber("Random seed", sampling.randomSeed, value => editSampling({ randomSeed: value }), undefined, 0, 255, 1)}
                <label>Rain-rate breakpoints <span className="mw-unit">(mm/h)</span><WorkbookInput className="posfield__input posmono" aria-label="Rain-rate breakpoints" disabled={disabled} value={(sampling.rainRateBreakpointsMmPerHour ?? []).join(", ")} onChange={event => editSampling({ rainRateBreakpointsMmPerHour: numberList(event.target.value) })} /></label>
                <label>Rain-distance endpoints <span className="mw-unit">(km)</span><WorkbookInput className="posfield__input posmono" aria-label="Rain-distance endpoints" disabled={disabled} value={(sampling.rainDistanceEndpointsKm ?? []).join(", ")} onChange={event => editSampling({ rainDistanceEndpointsKm: numberList(event.target.value) })} /></label>
              </div>
              {treatment.mode === "weighted_bin" && <div className="mw-bin-editor"><table aria-label="Samples by weather bin"><thead><tr><th>Bin</th><th>Definition</th><th>Samples</th></tr></thead><tbody>{binDefinitions.map(definition => <tr key={definition.id}><td>{definition.id}</td><td>{definition.label}</td><td><WorkbookInput className="posfield__input posmono" type="number" min={0} max={35040} step={1} disabled={disabled} aria-label={`Samples for ${definition.id}`} value={inputValue(sampling.binSamples?.[definition.id])} onChange={event => {
                const next = { ...sampling.binSamples }, value = numberValue(event.target.value); if (value === undefined) delete next[definition.id]; else next[definition.id] = value; editSampling({ binSamples: next });
              }} /></td></tr>)}</tbody></table></div>}
            </>}
            {treatment.mode === "constant" && <div className="mw-fields mw-constant-fields">{modelNumber("Wind speed", constant.windSpeedMetresPerSecond, value => editConstant({ windSpeedMetresPerSecond: value }), "m/s", .5, 30)}
              <label>Wind direction<select className="posfield__select" aria-label="Wind direction" disabled={disabled} value={constant.windDirection ?? ""} onChange={event => editConstant({ windDirection: event.target.value ? event.target.value as "uniform" | "fixed" : undefined })}><option value="">Choose treatment</option><option value="uniform">Uniform across sectors</option><option value="fixed">Fixed direction</option></select></label>
              {constant.windDirection === "fixed" && modelNumber("Wind toward", constant.windTowardDegrees, value => editConstant({ windTowardDegrees: value }), "°", 0, 360)}
              <label>Stability class<select className="posfield__select" aria-label="Stability class" disabled={disabled} value={constant.stabilityClass ?? ""} onChange={event => editConstant({ stabilityClass: event.target.value ? event.target.value as typeof stabilityClasses[number] : undefined })}><option value="">Choose class</option>{stabilityClasses.map(value => <option key={value}>{value}</option>)}</select></label>
              {modelNumber("Rain rate", constant.rainMillimetresPerHour, value => editConstant({ rainMillimetresPerHour: value }), "mm/h", 0, 99)}{modelNumber("Mixing height", constant.mixingHeightMetres, value => editConstant({ mixingHeightMetres: value }), "m", 100, 10000)}
            </div>}
            <div className="mw-section-title"><h3>Outer-grid weather</h3><label className="mw-switch"><WorkbookInput type="checkbox" checked={boundary.enabled} disabled={disabled} onChange={event => editModel({ ...treatment, boundary: event.target.checked ? { enabled: true } : { enabled: false } })} /><span>Use boundary conditions</span></label></div>
            {boundary.enabled && <div className="mw-fields mw-boundary-fields"><label>First outer-grid band<select className="posfield__select" aria-label="First outer-grid band" disabled={disabled} value={boundary.startBand ?? ""} onChange={event => editBoundary({ startBand: numberValue(event.target.value) })}><option value="">Choose band</option>{cellGeometry?.radiiKm.map((radius, index) => <option value={index + 1} key={radius}>Band {index + 1} · {radius} km</option>)}</select></label>
              {modelNumber("Boundary wind speed", boundary.windSpeedMetresPerSecond, value => editBoundary({ windSpeedMetresPerSecond: value }), "m/s", .5, 30)}
              <label>Boundary stability<select className="posfield__select" aria-label="Boundary stability" disabled={disabled} value={boundary.stabilityClass ?? ""} onChange={event => editBoundary({ stabilityClass: event.target.value ? event.target.value as typeof stabilityClasses[number] : undefined })}><option value="">Choose class</option>{stabilityClasses.map(value => <option key={value}>{value}</option>)}</select></label>
              {modelNumber("Boundary rain rate", boundary.rainMillimetresPerHour, value => editBoundary({ rainMillimetresPerHour: value }), "mm/h", 0, 99)}{modelNumber("Boundary mixing height", boundary.mixingHeightMetres, value => editBoundary({ mixingHeightMetres: value }), "m", 100, 10000)}
            </div>}
          </>}

          {tab === "trials" && <>{!trialSet || dirty ? <p className="mw-empty">Save the weather treatment to generate trials.</p> : <>
            <div className="mw-stat-grid"><div><span>Treatment</span><strong>{weatherTreatmentNames[trialSet.mode]}</strong></div><div><span>Trials</span><strong>{trialSet.trialCount}</strong></div><div><span>Probability total</span><strong>{show(trialSet.probabilityTotal)}</strong></div><div><span>Active groups</span><strong>{trialSet.bins.length}</strong></div></div>
            {trialSet.boundary && <div className="mw-detail"><strong>Outer-grid weather from band {trialSet.boundary.startBand}</strong><dl><div><dt>Wind</dt><dd>{show(trialSet.boundary.windSpeedMetresPerSecond)} m/s</dd></div><div><dt>Stability</dt><dd>{trialSet.boundary.stabilityClass}</dd></div><div><dt>Rain</dt><dd>{show(trialSet.boundary.rainMillimetresPerHour)} mm/h</dd></div><div><dt>Mixing height</dt><dd>{show(trialSet.boundary.mixingHeightMetres)} m</dd></div></dl></div>}
            <div className="mw-section-title"><h3>Weather trials</h3></div>{loadingTrials && <p role="status" className="mw-note">Loading trials…</p>}{loadError && <p className="mw-error" role="alert">{loadError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
            {trials && <><table className="mw-trials-table" aria-label="Generated weather trials"><thead><tr><th>Trial</th><th>Start</th><th>Group</th><th>Probability</th><th>Wind</th><th>Stability</th></tr></thead><tbody>{trials.trials.map(trial => <tr key={trial.id}><td>{trial.id}</td><td>{trial.source === "constant" ? "Constant" : `Day ${trial.day}, period ${trial.period}`}</td><td>{trial.selectionGroup}</td><td>{trial.probability.toExponential(4)}</td><td>{show(trial.windSpeedMetresPerSecond)} m/s · {show(trial.windTowardDegrees)}°</td><td>{trial.stabilityClass}</td></tr>)}</tbody></table>
              <div className="mw-pagination"><span>{trialOffset + 1} to {Math.min(trialOffset + 6, trialSet.trialCount)} of {trialSet.trialCount} trials</span><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!trialOffset} onClick={() => setTrialPage(trialPage - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={trialOffset + 6 >= trialSet.trialCount} onClick={() => setTrialPage(trialPage + 1)}>Next</button></div></div></>}
            <div className="mw-trial-summary"><div><h3>Selection groups</h3><div className="mw-summary-scroll"><table aria-label="Weather trial selection groups"><thead><tr><th>Group</th><th>Records</th><th>Selected</th><th>Probability</th></tr></thead><tbody>{trialSet.bins.map(bin => <tr key={bin.id}><td>{bin.id} · {bin.label}</td><td>{bin.population}</td><td>{bin.selected}</td><td>{show(bin.probability)}</td></tr>)}</tbody></table></div></div>
              <div><h3>Wind rose</h3><div className="mw-wind-rose">{trialSet.windRose.map(sector => <div key={sector.sector}><span>S{String(sector.sector).padStart(2, "0")} · {show(sector.towardDegrees)}°</span><i><b style={{ width: `${sector.probability * 100}%` }} /></i><strong>{(sector.probability * 100).toFixed(2)}%</strong></div>)}</div></div></div>
          </>}</>}
        </div>
        {!!issues.length && <details className="mw-checks"><summary>{issues.length} {issues.length === 1 ? "item" : "items"} to complete</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      </> : <div role="region" aria-label="Collection settings"><div className="mw-section-title"><h3>Collection location</h3>{siteLink}</div>
        <dl className="mw-readonly"><div><dt>Latitude</dt><dd>{show(siteSettings.latitude)}°</dd></div><div><dt>Longitude</dt><dd>{show(siteSettings.longitude)}°</dd></div></dl>
        <div className="mw-section-title"><h3>Dates to collect</h3></div><div className="mw-fields">{(["start", "end"] as const).map(key => <label key={key}>Collection {key}<WorkbookInput className="posfield__input posmono" type="date" aria-label={`Collection ${key}`} disabled={disabled} value={dates[key]} onChange={event => setWeatherDates({ ...dates, [key]: event.target.value })} /></label>)}</div>
        {request && !datesDraft && <div className="mw-detail"><strong>Saved collection request</strong><dl><div><dt>Site</dt><dd>{request.latitude}°, {request.longitude}°</dd></div><div><dt>Period</dt><dd>{request.start} to {request.end}</dd></div></dl>{requestMatches && <button type="button" className="posnav__btn posnav__btn--sm" onClick={downloadRequest}>Download request</button>}</div>}
      </div>}
      {error && <p className="mw-error" role="alert">{error}</p>}{conflict && <p className="mw-error" role="alert">Weather inputs changed. Discard these edits to use the latest values.</p>}
      <footer className="mw-footer">{status && <span className="mw-status" role="status">{status}</span>}<div className="mw-file-actions">
        {editable && source === "import" && <>{dirty && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => { setWeatherDraft(undefined); setError(""); }}>Discard edits</button>}
          {dirty || !trialSet ? <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || conflict || !valid} onClick={() => void save(false)}>Save and generate trials</button>
            : <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || reviewed || issues.length > 0} onClick={() => void save(true)}>{reviewed ? "Confirmed" : "Confirm weather trials"}</button>}
        </>}
        {editable && source === "collect" && <>{datesDraft && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => setWeatherDates(undefined)}>Discard dates</button>}<button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || dirty || !RcWeatherDatesSchema.safeParse(dates).success || siteSettings.latitude === undefined || siteSettings.longitude === undefined || !datesDraft && requestMatches} onClick={async () => {
          if (!actions) return; setBusy(true); setError(""); try { await actions.prepareCollection(saved?.revision ?? 0, site?.revision ?? 0, dates); setWeatherDates(undefined); } catch (error) { setError(failureMessage(error)); } finally { setBusy(false); }
        }}>Save collection request</button></>}
      </div></footer>
      <WorkbookInput ref={input} type="file" hidden accept=".met,.MET,.txt,.inp" aria-label="Import weather input file" disabled={disabled || dirty} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file || !actions) return; setBusy(true); setError("");
        try { await actions.importFile(importKind.current, revision, file); setRaw(undefined); } catch (error) { setError(failureMessage(error)); } finally { setBusy(false); }
      }} />
    </section>
  </div>;
}
