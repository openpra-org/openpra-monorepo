import { useEffect, useId, useRef, useState, type JSX } from "react";
import type { RcSiteSettings } from "interfaces-mef-types/rc/site-receptors";
import { RcSiteSettingsSchema } from "interfaces-mef-types/zod/rc/site-receptors";
import { cellDoseDistance, coordinateReference, receptorCount, siteReceptorIssues } from "interfaces-shared-types/rc-workbooks/site-receptors";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import { RcReceptorCellGrid } from "./rcReceptorCellGrid";
import "./css/rcSiteReceptors.css";

const scientific = (n: number) => n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3);
const show = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "—" : scientific(n) ? n.toExponential() : Number(n.toFixed(4)).toString();
const inputValue = (n: number | undefined) => n === undefined ? "" : scientific(n) ? n.toExponential() : n;
const failureMessage = (e: unknown) => e instanceof Error ? e.message : "Could not save site inputs";
type Tab = "location" | "receptors";
export function RcSiteReceptorsPanel({ initialTab = "receptors" }: { initialTab?: "location" | "receptors" }): JSX.Element {
  const { rc, editable, siteReceptors: actions, siteReceptorDraft, setSiteReceptorDraft } = useRcWorkbook();
  const draft = editable ? siteReceptorDraft : undefined;
  const site = rc.protectiveActionParameters.siteAndReceptors;
  const settings = draft?.settings ?? site?.settings ?? {};
  const baseRevision = draft?.baseRevision ?? site?.revision ?? 0;
  const geometry = site?.geometry, count = receptorCount(geometry), dirty = Boolean(draft);
  const [tab, setTab] = useState<Tab>(initialTab), [page, setPage] = useState(0), [band, setBand] = useState(0), [sector, setSector] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const [raw, setRaw] = useState<{ documentId: string; text: string }>();
  const input = useRef<HTMLInputElement>(null), importKind = useRef<"location" | "geometry">("geometry");
  const tablist = useRef<HTMLDivElement>(null), id = useId();
  const disabled = !editable || !actions || busy;
  const issues = siteReceptorIssues(settings, geometry);
  const settingsValid = RcSiteSettingsSchema.safeParse(settings).success;
  const conflict = dirty && baseRevision !== (site?.revision ?? 0);
  const currentBand = geometry?.kind === "cells" ? Math.min(band, geometry.radiiKm.length - 1) : 0;
  const currentSector = geometry?.kind === "cells" ? Math.min(sector, geometry.sectors - 1) : 0;
  const totalRows = geometry?.kind === "cells" ? geometry.radiiKm.length : geometry?.points.length ?? 0;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(totalRows / 6) - 1)), offset = currentPage * 6;
  useEffect(() => { setPage(0); setBand(0); setSector(0); setRaw(undefined); }, [site?.geometryFile?.documentId]);
  const edit = (patch: Partial<RcSiteSettings>) => { setSiteReceptorDraft({ baseRevision, settings: { ...settings, ...patch } }); setError(""); setSaved(false); };
  const field = (label: string, key: Exclude<keyof RcSiteSettings, "cellPoint">, min?: number, max?: number) => <label>{label}
    <WorkbookInput className="posfield__input posmono" type="number" step="any" aria-label={label} min={min} max={max} disabled={disabled} value={inputValue(settings[key])}
      onChange={e => edit({ [key]: e.target.value === "" ? undefined : Number(e.target.value) })} />
  </label>;
  const save = async () => {
    if (!actions || !settingsValid || conflict) return;
    setBusy(true); setError("");
    try { await actions.saveSettings(baseRevision, settings); setSiteReceptorDraft(undefined); setSaved(true); }
    catch (error) { setError(failureMessage(error)); }
    finally { setBusy(false); }
  };
  const fileBox = (kind: "location" | "geometry") => {
    const file = kind === "location" ? site?.locationFile : site?.geometryFile;
    return <><div className="sr-file"><div className="sr-file-info"><span className="sr-small">{kind === "location" ? "Site coordinate file" : "Site / receptor file"}</span>
      <strong>{file?.filename ?? "No file selected"}</strong><span className="sr-small">.inp · .txt · .rec · .rou</span>
    </div><div className="sr-file-actions">{editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty} title={dirty ? "Save or discard edits before importing" : undefined} onClick={() => { importKind.current = kind; input.current?.click(); }}>{file ? <RCIcon.Refresh /> : <RCIcon.Plus />} {file ? "Replace file" : "Import file"}</button>}
      {file && <button type="button" className="posnav__btn posnav__btn--sm" disabled={!actions || busy} onClick={async () => {
        if (raw?.documentId === file.documentId) { setRaw(undefined); return; }
        setBusy(true); setError("");
        try { setRaw({ documentId: file.documentId, text: await actions!.readOriginal(file.documentId) }); } catch (e) { setError(failureMessage(e)); } finally { setBusy(false); }
      }}><RCIcon.Eye /> {raw?.documentId === file.documentId ? "Hide file" : "View file"}</button>}
    </div></div>{raw && raw.documentId === file?.documentId && <div className="sr-raw"><span className="sr-small">Original file · supplied values preserved</span><pre aria-label="Original site input">{raw.text}</pre></div>}</>;
  };
  const height = () => geometry && (geometry.kind === "cells" || geometry.points.some(p => p.heightMetres === undefined))
    ? <div>{field("Receptor height above ground (m)", "receptorHeightMetres", 0)}</div>
    : <p className="sr-note">Receptor heights imported from the file.</p>;
  const status = busy ? "Saving…" : dirty ? "Unsaved changes" : saved ? "Site inputs saved." : !site ? "Import site data to begin" : issues.length ? undefined : "Site and receptors ready";
  return <div className="poscard rc-site-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Site and receptors" level={3} /></div>
    <section className="rc-site-receptors" aria-label="Site and receptors">
      <div className="sr-tabs" role="tablist" aria-label="Site input review" ref={tablist} onKeyDown={e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault(); const next = e.key === "Home" ? "location" : e.key === "End" ? "receptors" : tab === "location" ? "receptors" : "location";
        setTab(next); tablist.current?.querySelectorAll<HTMLButtonElement>("button")[next === "location" ? 0 : 1].focus();
      }}>
        {(["location", "receptors"] as const).map(t => <button key={t} type="button" id={`${id}-${t}`} role="tab" aria-controls={`${id}-panel`} aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => { setTab(t); setRaw(undefined); }}>
          {t === "location" ? "Site location" : "Receptors"}{t === "receptors" && !!count && <span className="sr-count"> {count} {geometry?.kind === "cells" ? "cells" : "points"}</span>}
        </button>)}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {tab === "location" ? <>{fileBox("location")}<h3>Release location</h3>
          <div className="sr-fields">{field("Latitude (°)", "latitude", -90, 90)}{field("Longitude (°)", "longitude", -180, 180)}</div>
          {geometry && geometry.kind !== "cells" && <>
            <div className="sr-section-title"><h3>Release point in the receptor coordinate system</h3>{geometry.kind === "grid" && editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled} onClick={() => edit({ releaseX: geometry.originX, releaseY: geometry.originY })}>Use grid origin</button>}</div>
            <p className="sr-small">{coordinateReference(geometry.anchor)}</p><div className="sr-fields">{field("Release X (m)", "releaseX")}{field("Release Y (m)", "releaseY")}</div>
            <p className="sr-note">These coordinates identify the release point; the file’s anchor identifies the coordinate reference.</p>
          </>}
          <div className="sr-section-title sr-section-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setTab("receptors")}>Review receptors</button></div>
        </> : <>{fileBox("geometry")}{!geometry ? <p className="sr-empty">Import a site grid or receptor file to review its geometry.</p> : <>
          <div className="sr-section-title"><h3>{geometry.kind === "cells" ? "Area grid" : geometry.kind === "grid" ? "Point grid" : "Individual points"}</h3>
            {geometry.kind !== "cells" && <span className="sr-small">{geometry.kind === "grid" ? `${geometry.radiiMetres.length} radii × ${geometry.bearingsDegrees.length} directions = ${count} points` : `${count} imported receptors`}</span>}
          </div>
          {geometry.kind === "cells" ? <>
            <RcReceptorCellGrid geometry={geometry} settings={settings} band={currentBand} sector={currentSector} onSelect={(b, s) => { setBand(b); setSector(s); setPage(Math.floor(b / 6)); }} />
            <div className="sr-settings"><label>Dose-evaluation point in each cell<select className="posfield__select" aria-label="Dose-evaluation point in each cell" disabled={disabled} value={settings.cellPoint ?? ""} onChange={e => edit({ cellPoint: e.target.value ? e.target.value as "mid" | "outer" : undefined })}>
              <option value="">Choose a position</option><option value="mid">Mid-radius, sector center</option><option value="outer">Outer edge, sector center</option>
            </select></label>{height()}</div>
            <div className="sr-section-title"><h3>Distance bands</h3></div>
            <table className="sr-bands" aria-label="Distance bands"><thead><tr><th>Band</th><th>Inner (km)</th><th>Outer (km)</th><th>Dose point (m)</th></tr></thead>
              <tbody>{geometry.radiiKm.slice(offset, offset + 6).map((outer, j) => <tr key={offset + j}><td>{offset + j + 1}</td><td>{show(offset + j ? geometry.radiiKm[offset + j - 1] : 0)}</td><td>{show(outer)}</td><td>{show(cellDoseDistance(geometry, settings, offset + j))}</td></tr>)}</tbody></table>
          </> : <>
            <div className="sr-meta">{geometry.kind === "grid" ? `Origin X/Y: ${show(geometry.originX)}, ${show(geometry.originY)} m · first bearing ${show(geometry.bearingsDegrees[0])}° from grid north` : coordinateReference(geometry.anchor)}</div>
            <div className="sr-single-height">{height()}</div>
            <table className="sr-points" aria-label="Receptor points"><thead><tr><th>Point</th><th>{geometry.kind === "grid" ? "Radius (m)" : "X (m)"}</th><th>{geometry.kind === "grid" ? "Bearing (°)" : "Y (m)"}</th><th>Height (m)</th></tr></thead>
              <tbody>{geometry.points.slice(offset, offset + 6).map(p => <tr key={p.id}><td>{p.id}</td><td>{show(geometry.kind === "grid" ? p.radiusMetres : p.x)}</td><td>{show(geometry.kind === "grid" ? p.bearingDegrees : p.y)}</td><td>{show(p.heightMetres ?? settings.receptorHeightMetres)}</td></tr>)}</tbody></table>
          </>}
          <div className="sr-pagination"><span>{offset + 1}–{Math.min(offset + 6, totalRows)} of {totalRows} {geometry.kind === "cells" ? "bands" : "points"}</span><div>
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={offset + 6 >= totalRows} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div></div>
          {geometry.kind !== "cells" && <>
            <details><summary>Coordinate reference</summary><p className="sr-note">{coordinateReference(geometry.anchor)}</p><p className="sr-note">Local anchor: {show(geometry.anchor.localX)}, {show(geometry.anchor.localY)} m → UTM: {show(geometry.anchor.utmEasting)}, {show(geometry.anchor.utmNorthing)} m</p></details>
            {geometry.points.some(p => p.elevationMetres !== undefined || p.hillHeightMetres !== undefined) && <details><summary>Imported terrain data</summary><p className="sr-note">Ground elevation and hill-height scale are separate from receptor height above ground.</p>
              <table aria-label="Imported terrain data"><thead><tr><th>Point</th><th>Ground elevation (m)</th><th>Hill-height scale (m)</th></tr></thead><tbody>{geometry.points.slice(offset, offset + 6).map(p => <tr key={p.id}><td>{p.id}</td><td>{show(p.elevationMetres)}</td><td>{show(p.hillHeightMetres)}</td></tr>)}</tbody></table>
            </details>}
          </>}
        </>}</>}
      </div>
      {!!error && <p className="sr-errors" role="alert">{error}</p>}
      {conflict && <p className="sr-errors" role="alert">Site inputs changed. Discard these edits to load the latest values.</p>}
      {!!issues.length && (geometry || dirty) && <details className="sr-checks"><summary>{issues.length} items to complete</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      <footer className="sr-footer">{status && <span className="sr-status" role="status">{status}</span>}
        {editable && <div className="sr-file-actions">{dirty && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => { setSiteReceptorDraft(undefined); setError(""); }}>Discard edits</button>}<button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || !dirty || !settingsValid || conflict} onClick={() => { void save(); }}>Save site inputs</button></div>}
      </footer>
      <WorkbookInput ref={input} type="file" hidden accept=".inp,.txt,.rec,.rou" aria-label="Import site input file" disabled={disabled || dirty} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file || !actions) return;
        setBusy(true); setError(""); setSaved(false);
        try { await actions.importFile(importKind.current, baseRevision, file); setRaw(undefined); } catch (e) { setError(failureMessage(e)); } finally { setBusy(false); }
      }} />
    </section>
  </div>;
}
