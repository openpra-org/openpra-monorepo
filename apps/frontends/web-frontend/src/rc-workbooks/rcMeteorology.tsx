import { useEffect, useId, useRef, useState, type JSX } from "react";
import type { RcWeatherInputs, RcWeatherPage, RcWeatherSettings, RcWindSectors } from "interfaces-mef-types/rc/weather";
import { RcWeatherDatesSchema, RcWeatherSettingsSchema } from "interfaces-mef-types/zod/rc/weather";
import { sameWeatherSite, weatherIsReviewed, weatherIssues, weatherSectorCount, weatherSourceDistance, windToward } from "interfaces-shared-types/rc-workbooks/weather";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcMeteorology.css";

const scientific = (n: number) => n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3);
const show = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "—" : scientific(n) ? n.toExponential() : Number(n.toFixed(5)).toString();
const inputValue = (n: number | undefined) => n === undefined ? "" : scientific(n) ? n.toExponential() : n;
const recordRange = (data: NonNullable<RcWeatherInputs["data"]>) => {
  if (data.first.day === data.last.day) return `Day ${data.first.day}, period ${data.first.period} to ${data.last.period}`;
  if (data.first.period === data.last.period) return `Day ${data.first.day} to ${data.last.day}, period ${data.first.period}`;
  return `Day ${data.first.day}, period ${data.first.period} to day ${data.last.day}, period ${data.last.period}`;
};
const message = (e: unknown) => e instanceof Error ? e.message : "Could not update weather inputs";
const methods = { TEMPERATURE_GRADIENT: "Temperature gradient", TURNER: "Turner’s method", SRDT: "Solar radiation + temperature gradient" };
export function RcMeteorologyPanel({ onReviewSite }: { onReviewSite?: () => void }): JSX.Element {
  const { rc, editable, weather: actions, weatherDraft, setWeatherDraft, weatherDates, setWeatherDates } = useRcWorkbook();
  const savedWeather = rc.meteorologicalData.weatherInputs, draft = editable ? weatherDraft : undefined;
  const settings = draft?.settings ?? savedWeather?.settings ?? {}, revision = draft?.baseRevision ?? savedWeather?.revision ?? 0;
  const weather: RcWeatherInputs = { ...savedWeather, revision, settings };
  const data = weather.data, config = weather.configuration, site = rc.protectiveActionParameters.siteAndReceptors;
  const siteSettings = site?.settings ?? {}, count = weatherSectorCount(weather), distance = weatherSourceDistance(weather, siteSettings);
  const issues = weatherIssues(weather, siteSettings), dirty = Boolean(draft), reviewed = !dirty && weatherIsReviewed(weather, siteSettings);
  const conflict = dirty && revision !== (savedWeather?.revision ?? 0), valid = RcWeatherSettingsSchema.safeParse(settings).success;
  const [source, setSource] = useState<"import" | "collect">("import"), [tab, setTab] = useState<"records" | "settings">("records");
  const [page, setPage] = useState(0), [selected, setSelected] = useState(0), [records, setRecords] = useState<RcWeatherPage>();
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [loadError, setLoadError] = useState(""), [retry, setRetry] = useState(0);
  const [raw, setRaw] = useState<{ documentId: string; text: string }>();
  const input = useRef<HTMLInputElement>(null), kind = useRef<"weather" | "configuration">("weather"), tabs = useRef<HTMLDivElement>(null), id = useId();
  const disabled = !editable || !actions || busy, request = weather.collectionRequest;
  const datesDraft = editable ? weatherDates : undefined;
  const dates = datesDraft ?? (request ? { start: request.start, end: request.end } : { start: "", end: "" });
  const currentPage = Math.min(page, Math.max(0, Math.ceil((data?.recordCount ?? 0) / 6) - 1)), offset = currentPage * 6;
  useEffect(() => { setPage(0); setSelected(0); setRaw(undefined); }, [weather.weatherFile?.documentId]);
  useEffect(() => {
    let cancelled = false;
    setRecords(undefined); setLoadError("");
    if (!savedWeather?.weatherFile || !actions) { setLoading(false); return; }
    setLoading(true);
    void actions.readRecords(offset).then(result => {
      if (cancelled) return;
      if (result.revision !== savedWeather.revision) { setLoadError("Weather inputs changed. Reload the workbook to review the latest records."); return; }
      setRecords(result); setSelected(0);
    }).catch(e => { if (!cancelled) setLoadError(message(e)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [actions, savedWeather?.weatherFile?.documentId, savedWeather?.revision, offset, retry]);
  const edit = (patch: Partial<RcWeatherSettings>) => {
    const next = { ...settings, ...patch };
    if ("latitude" in patch || "longitude" in patch) delete next.nearbySite;
    setWeatherDraft({ baseRevision: revision, settings: next }); setError("");
  };
  const field = (label: string, key: "latitude" | "longitude" | "year", min: number, max: number, readOnly = false) => <label>{label}
    <WorkbookInput className="posfield__input posmono" type="number" step={key === "year" ? 1 : "any"} min={min} max={max} readOnly={readOnly} disabled={disabled} aria-label={label} value={inputValue(settings[key])}
      onChange={e => edit({ [key]: e.target.value === "" ? undefined : Number(e.target.value) })} />
  </label>;
  const save = async (confirm: boolean) => {
    if (!actions || !valid || conflict) return; setBusy(true); setError("");
    try { await actions.saveSettings(revision, settings, confirm); setWeatherDraft(undefined); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const fileBox = (fileKind: "weather" | "configuration") => {
    const file = fileKind === "weather" ? weather.weatherFile : weather.configurationFile;
    return <><div className="mw-file"><div className="mw-file-info"><span className="mw-small">{fileKind === "weather" ? "Weather data file" : "Generation settings file · optional"}</span>
      <strong>{file?.filename ?? "No file selected"}</strong><span className="mw-small">{fileKind === "weather" ? ".met · .txt" : ".inp · .txt"}</span>
    </div><div className="mw-file-actions">{editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty} onClick={() => { kind.current = fileKind; input.current?.click(); }}>{file ? <RCIcon.Refresh /> : <RCIcon.Plus />} {file ? "Replace file" : "Import file"}</button>}
      {file && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy || !actions} onClick={async () => {
        if (raw?.documentId === file.documentId) { setRaw(undefined); return; }
        setBusy(true); setError(""); try { setRaw({ documentId: file.documentId, text: await actions!.readOriginal(file.documentId) }); } catch (e) { setError(message(e)); } finally { setBusy(false); }
      }}><RCIcon.Eye /> {raw?.documentId === file.documentId ? "Hide file" : "View file"}</button>}
    </div></div>{raw?.documentId === file?.documentId && raw && <pre className="mw-raw" aria-label="Original weather input">{raw.text}</pre>}</>;
  };
  const siteLink = <button type="button" className="posnav__btn posnav__btn--sm" disabled={!onReviewSite || busy} onClick={onReviewSite}>{editable ? "Edit site in Step 02" : "View site in Step 02"}</button>;
  const row = records?.records[selected], toward = row ? windToward(row, count) : undefined;
  const requestMatches = sameWeatherSite(request, siteSettings);
  const downloadRequest = () => {
    if (!request) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "openpra-weather-collection-request", version: 1, ...request }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "openpra-weather-collection-request.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const status = busy ? "Working…" : source === "collect" ? datesDraft ? "Unsaved dates" : undefined : dirty ? "Unsaved changes" : !data ? "No weather data" : undefined;
  return <div className="poscard rc-weather-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Weather inputs" level={3} /></div>
    <section className="rc-meteorology" aria-label="Weather inputs">
      <div className="mw-source-choice" role="group" aria-label="Weather source">
        <button type="button" className="posnav__btn posnav__btn--sm" aria-pressed={source === "import"} onClick={() => setSource("import")}>Import weather file</button>
        <button type="button" className="posnav__btn posnav__btn--sm" aria-pressed={source === "collect"} onClick={() => setSource("collect")}>OpenRC collection request</button>
      </div>
      {source === "import" ? <>
        <div className="mw-tabs" role="tablist" aria-label="Meteorology review" ref={tabs} onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault(); const next = e.key === "Home" ? "records" : e.key === "End" ? "settings" : tab === "records" ? "settings" : "records";
          setTab(next); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[next === "records" ? 0 : 1].focus();
        }}>
          {(["records", "settings"] as const).map(t => <button type="button" key={t} id={`${id}-${t}`} role="tab" aria-selected={tab === t} aria-controls={`${id}-panel`} tabIndex={tab === t ? 0 : -1} onClick={() => { setTab(t); setRaw(undefined); }}>
            {t === "records" ? "Weather records" : "Source & settings"}{t === "records" && data && <span className="mw-count"> {data.recordCount}</span>}
          </button>)}
        </div>
        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
          {tab === "records" ? <>{fileBox("weather")}{!data ? <p className="mw-empty">No weather records.</p> : <>
            <div className="mw-section-title"><h3>Weather records</h3></div>
            <div className="mw-meta"><span>{data.intervalMinutes}-minute averages</span>{!!data.gaps && <span>{data.gaps} gaps · {data.missingPeriods} missing periods within this sequence</span>}</div>
            {loading && <p role="status" className="mw-note">Loading records…</p>}
            {loadError && <p className="mw-error" role="alert">{loadError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
            {records && <><table className="mw-records-table" aria-label="Weather records"><thead><tr><th>Day / period</th><th>Wind (m/s)</th><th>Wind travel direction (°)</th><th>Stability class</th></tr></thead><tbody>
              {records.records.map((r, i) => <tr key={`${r.day}-${r.period}`} data-selected={i === selected}><td><button type="button" className="posnav__btn posnav__btn--sm posnav__btn--ghost" aria-label={`Inspect weather record ${offset + i + 1}`} aria-pressed={i === selected} onClick={() => setSelected(i)}>{r.day} / {r.period}</button></td><td>{show(r.windSpeedMetresPerSecond)}</td><td>{show(windToward(r, count))}</td><td>{r.stabilityClass}</td></tr>)}
            </tbody></table><div className="mw-pagination"><span>{offset + 1} to {Math.min(offset + 6, data.recordCount)} of {data.recordCount} records</span><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={offset + 6 >= data.recordCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div></>}
            {row && <div className="mw-detail"><strong>Record {offset + selected + 1} · day {row.day}, period {row.period}</strong><dl>
              <div><dt>Original wind sector</dt><dd>{row.windSector} of {count ?? "—"}</dd></div><div><dt>Wind comes from</dt><dd>{show(toward === undefined ? undefined : (toward + 180) % 360)}°</dd></div>
              <div><dt>Rain (mm/h)</dt><dd>{row.rainMillimetresPerHour === null ? "Trace (file code −1)" : show(row.rainMillimetresPerHour)}</dd></div><div><dt>Mixing height above ground (m)</dt><dd>{row.mixingHeightMetres === undefined ? data.mixingHeightMode === "seasonal" ? "Seasonal values below" : "Not supplied" : show(row.mixingHeightMetres)}</dd></div>
            </dl><details><summary>Original record and units</summary><pre>{row.original}</pre></details></div>}
            {data.seasonalHeightsMetres && <details><summary>Seasonal mixing heights</summary><table aria-label="Seasonal mixing heights"><thead><tr><th>Season</th><th>Morning (m)</th><th>Afternoon (m)</th></tr></thead><tbody>{["Winter", "Spring", "Summer", "Autumn"].map((s, i) => <tr key={s}><td>{s}</td><td>{show(data.seasonalHeightsMetres![i])}</td><td>{show(data.seasonalHeightsMetres![i + 4])}</td></tr>)}</tbody></table></details>}
          </>}</> : <>{fileBox("configuration")}<h3>Imported weather location</h3>
            <div className="mw-fields">{field("Weather latitude (°)", "latitude", -90, 90)}{field("Weather longitude (°)", "longitude", -180, 180)}</div>
            <div className="mw-fields mw-encoding-fields">{field("Imported data year", "year", 1000, 9999, Boolean(config))}
              <label>Wind direction sectors{data?.windSectors !== undefined || config ? <WorkbookInput className="posfield__input posmono" aria-label="Wind direction sectors" readOnly value={`${count} sectors · ${show(360 / count!)}° each`} /> :
                <select className="posfield__select" aria-label="Wind direction sectors" disabled={disabled} value={settings.windSectors ?? ""} onChange={e => edit({ windSectors: e.target.value ? Number(e.target.value) as RcWindSectors : undefined })}><option value="">Match the weather file</option>{[16, 32, 48, 64].map(n => <option key={n} value={n}>{n} sectors · {show(360 / n)}° each</option>)}</select>}
              </label></div>
            <div className="mw-coverage"><span className="mw-small">Records in this file</span><strong>{data ? `${data.recordCount} records · ${recordRange(data)}` : "No weather data"}</strong></div>
            <dl className="mw-readonly"><div><dt>Record interval</dt><dd>{data ? `${data.intervalMinutes} minutes` : "No weather data"}</dd></div><div><dt>MACCS file-to-local time offset</dt><dd>{!data ? "No weather data" : data.utcOffsetHours === undefined ? "Local time (no /UTCTIM)" : `${data.utcOffsetHours} h (/UTCTIM)`}</dd></div></dl>
            {config && <details><summary>File history</summary><dl className="mw-readonly"><div><dt>Dataset</dt><dd>{config.dataset || "Not supplied"}</dd></div><div><dt>Stability method</dt><dd>{methods[config.stabilityMethod]}</dd></div></dl>{config.dateGroups.map((g, i) => <dl className="mw-readonly" key={i}><div><dt>Originally requested start</dt><dd>{g.start}</dd></div><div><dt>Originally requested end</dt><dd>{g.end}</dd></div></dl>)}</details>}
            <div className="mw-location-check"><div className="mw-section-title"><h3>Match to Step 02</h3>{siteLink}</div><dl className="mw-readonly"><div><dt>Release location</dt><dd>{show(siteSettings.latitude)}°, {show(siteSettings.longitude)}°</dd></div><div><dt>Weather location distance</dt><dd>{distance === undefined ? "Enter coordinates" : `${scientific(distance) ? distance.toExponential() : distance.toFixed(2)} km`}</dd></div></dl>
              {distance !== undefined && distance > .05 && <label className="mw-check-label"><WorkbookInput type="checkbox" disabled={disabled} checked={sameWeatherSite(settings.nearbySite, siteSettings)} onChange={e => edit({ nearbySite: e.target.checked ? { latitude: siteSettings.latitude!, longitude: siteSettings.longitude! } : undefined })} /><span>Use this nearby weather source for the site</span></label>}
            </div>
          </>}
        </div>
        {(data || dirty) && !!issues.length && <details className="mw-checks"><summary>{issues.length} {issues.length === 1 ? "item" : "items"} to review</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      </> : <div role="region" aria-label="Collection settings"><div className="mw-section-title"><h3>Collection location</h3>{siteLink}</div>
        <dl className="mw-readonly"><div><dt>Latitude</dt><dd>{show(siteSettings.latitude)}°</dd></div><div><dt>Longitude</dt><dd>{show(siteSettings.longitude)}°</dd></div></dl>
        <div className="mw-section-title"><h3>Dates to collect</h3></div><div className="mw-fields">{(["start", "end"] as const).map(key => <label key={key}>Collection {key}<WorkbookInput className="posfield__input posmono" type="date" aria-label={`Collection ${key}`} disabled={disabled} value={dates[key]} onChange={e => setWeatherDates({ ...dates, [key]: e.target.value })} /></label>)}</div>
        {dirty && <p className="mw-note">Save or discard weather settings before saving a collection request.</p>}
        {request && !datesDraft && <div className="mw-detail"><strong>Saved collection request</strong><dl><div><dt>Site</dt><dd>{request.latitude}°, {request.longitude}°</dd></div><div><dt>Period</dt><dd>{request.start} to {request.end}</dd></div></dl>
          {requestMatches ? <button type="button" className="posnav__btn posnav__btn--sm" onClick={downloadRequest}>Download request</button> : <p className="mw-note">Step 02 changed. Save a new request for the current site.</p>}
        </div>}
      </div>}
      {error && <p className="mw-error" role="alert">{error}</p>}{conflict && <p className="mw-error" role="alert">Weather inputs changed. Discard these edits to use the latest values.</p>}
      <footer className="mw-footer">{status && <span className="mw-status" role="status">{status}</span>}
        <div className="mw-file-actions">{editable && source === "import" && <>{dirty && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => { setWeatherDraft(undefined); setError(""); }}>Discard edits</button>}
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || conflict || dirty && !valid || !dirty && (reviewed || !data || tab === "settings" && !!issues.length)} onClick={() => { if (dirty) void save(false); else if (issues.length) setTab("settings"); else void save(true); }}>{dirty ? "Save weather settings" : reviewed ? "Confirmed" : issues.length && tab === "records" ? "Review settings" : "Confirm weather records"}</button>
        </>}{editable && source === "collect" && <>{datesDraft && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => setWeatherDates(undefined)}>Discard dates</button>}<button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || dirty || !RcWeatherDatesSchema.safeParse(dates).success || siteSettings.latitude === undefined || siteSettings.longitude === undefined || !datesDraft && requestMatches} onClick={async () => {
          if (!actions) return; setBusy(true); setError(""); try { await actions.prepareCollection(savedWeather?.revision ?? 0, site?.revision ?? 0, dates); setWeatherDates(undefined); } catch (e) { setError(message(e)); } finally { setBusy(false); }
        }}>Save collection request</button></>}
        </div>
      </footer>
      <WorkbookInput ref={input} type="file" hidden accept=".met,.MET,.txt,.inp" aria-label="Import weather input file" disabled={disabled || dirty} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file || !actions) return; setBusy(true); setError("");
        try { await actions.importFile(kind.current, revision, file); setRaw(undefined); } catch (e) { setError(message(e)); } finally { setBusy(false); }
      }} />
    </section>
  </div>;
}
