import { useEffect, useId, useRef, useState, type JSX } from "react";
import type { RcDecayDetail, RcLinkedDeposition, RcTransportFile, RcTransportSettings } from "interfaces-mef-types/rc/transport";
import { RcTransportSettingsSchema } from "interfaces-mef-types/zod/rc/transport";
import { decayCoverage, depositionMatchesSource, effectiveTransportSettings } from "interfaces-shared-types/rc-workbooks/transport";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcTransport.css";

type Tab = "deposition" | "dispersion" | "decay";
const publishedExamples = {
  dispersion: { documentId: "rc-published-dispersion", sha256: "33918d9c3eb6429bc233392147cecff6c9e0e409e22294e2b3bfff1a25c3fca3", filename: "MACCS2-DOE-published-dispersion.inp", label: "DOE MACCS2 guidance · p. 7-4", source: "https://www.energy.gov/sites/default/files/2018/07/f54/Final_MACCS2_Guidance_Report_June_1_2004_508C.pdf#page=101" },
  decay: { documentId: "rc-published-decay", sha256: "2e7c2a33de25ece5117a9ac6a1b620093096917e7ff89c95f94277181b39a671", filename: "NNDC-ENSDF-2023-04-03-mass-137.txt", label: "NNDC ENSDF · mass 137 · April 2023", source: "https://www.nndc.bnl.gov/ensdfarchivals/" },
} as const;
const scientific = (n: number) => n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3);
const show = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "—" : scientific(n) ? n.toExponential() : String(Number(n.toPrecision(7)));
const inputValue = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "" : scientific(n) ? n.toExponential() : n;
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Could not update transport inputs";
const basisLabel = (basis: string) => basis === "noble_gas" ? "Noble gas · zero deposition" : basis === "openrc_default" ? "OpenRC documented default" : "Analyst value";
export function RcTransportPanel(): JSX.Element {
  const { rc, editable, transport: actions, transportDrafts, setTransportDraft, rebaseTransportDrafts } = useRcWorkbook();
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs, inputs = rc.atmosphericTransportAndDispersion.transportInputs;
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.releaseCategory ?? "");
  const category = categories.find(c => c.releaseCategory === selectedCategory) ?? categories[0], categoryId = category?.releaseCategory ?? "", source = category?.sourceTerm;
  const saved = inputs?.categories.find(c => c.categoryId === categoryId), draft = editable ? transportDrafts[categoryId] : undefined;
  const settings = draft?.settings ?? effectiveTransportSettings(source?.values, saved?.settings), revision = draft?.baseRevision ?? inputs?.revision ?? 0;
  const dirty = Boolean(draft), conflict = dirty && (revision !== (inputs?.revision ?? 0) || draft!.sourceRevision !== source?.revision);
  const [tab, setTab] = useState<Tab>("deposition"), [groupId, setGroupId] = useState(2), [binPage, setBinPage] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [linked, setLinked] = useState<RcLinkedDeposition>(), [sourceLoading, setSourceLoading] = useState(false), [sourceError, setSourceError] = useState("");
  const [raw, setRaw] = useState<{ documentId: string; text: string }>(), [parentKey, setParentKey] = useState(""), [levelPage, setLevelPage] = useState(0);
  const [detail, setDetail] = useState<RcDecayDetail>(), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState(""), [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null), importKind = useRef<Tab>("deposition"), tabs = useRef<HTMLDivElement>(null), id = useId();
  const disabled = !editable || !actions || busy;
  const group = settings.groupVelocities.find(g => g.groupId === groupId) ?? settings.groupVelocities.find(g => g.name === "Cs") ?? settings.groupVelocities[0];
  const custom = saved?.deposition;
  const mismatch = Boolean(custom && source && !depositionMatchesSource(custom.data, source.values));
  const deposition = custom ? mismatch ? undefined : custom.data : linked?.data;
  const depositionFile = custom?.file ?? linked?.file, groupData = deposition?.groups.find(g => g.id === group?.groupId);
  const offset = Math.min(binPage, Math.max(0, Math.ceil((deposition?.velocities.length ?? 0) / 5) - 1)) * 5;
  const parents = inputs?.decayFiles.flatMap(f => f.parents.map(p => ({ file: f.file, parent: p, key: `${f.file.documentId}:${p.index}` }))) ?? [];
  const selectedParent = parents.find(p => p.key === parentKey) ?? parents[0], coverage = decayCoverage(inputs, source?.values);
  const validSettings = !mismatch && RcTransportSettingsSchema.safeParse(settings).success;
  const savedForSource = Boolean(source && saved?.savedForSourceRevision === source.revision && !dirty);
  useEffect(() => { setBinPage(0); setRaw(undefined); setError(""); }, [categoryId, custom?.file.documentId, source?.revision]);
  useEffect(() => {
    let cancelled = false; setLinked(undefined); setSourceError("");
    if (!source || !actions || custom) { setSourceLoading(false); return; }
    setSourceLoading(true);
    void actions.readSource(categoryId).then(result => {
      if (cancelled) return;
      if (result.sourceRevision !== source.revision) setSourceError("The source changed. Reload the workbook to inspect its latest file."); else setLinked(result);
    }).catch(e => { if (!cancelled) setSourceError(errorMessage(e)); }).finally(() => { if (!cancelled) setSourceLoading(false); });
    return () => { cancelled = true; };
  }, [source?.revision, categoryId, custom?.file.documentId, actions, retry]);
  useEffect(() => {
    let cancelled = false; setDetail(undefined); setDetailError("");
    if (!selectedParent || !actions || tab !== "decay") { setDetailLoading(false); return; }
    setDetailLoading(true);
    void actions.readDecay(selectedParent.file.documentId, selectedParent.parent.index, levelPage * 6).then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setDetailError(errorMessage(e)); }).finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedParent?.key, levelPage, actions, retry, tab]);
  const edit = (patch: Partial<RcTransportSettings>) => {
    setTransportDraft(categoryId, { baseRevision: revision, sourceRevision: draft?.sourceRevision ?? source?.revision ?? 0, settings: { ...settings, ...patch } }); setError("");
  };
  const work = async (action: () => Promise<unknown>) => { setBusy(true); setError(""); try { await action(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  const view = (file: RcTransportFile) => <button type="button" className="posnav__btn posnav__btn--sm" disabled={!actions || busy} onClick={() => {
    if (raw?.documentId === file.documentId) setRaw(undefined);
    else void work(async () => setRaw({ documentId: file.documentId, text: await actions!.readOriginal(file.documentId) }));
  }}><RCIcon.Eye /> {raw?.documentId === file.documentId ? "Hide file" : "View file"}</button>;
  const unlink = (kind: "decay" | "deposition", documentId?: string) => { if (!actions) return; void work(async () => { await actions.unlink(revision, kind, documentId, categoryId); setRaw(undefined); setParentKey(""); setLevelPage(0); }); };
  const importFiles = async (kind: Tab, files: File[]) => {
    if (!actions) throw new Error("Transport file imports are unavailable");
    const baseRevision = kind === "deposition" ? revision : inputs?.revision ?? 0;
    const next = await actions.importFiles(kind, baseRevision, files,
      kind === "deposition" ? categoryId : undefined, kind === "deposition" ? source?.revision : undefined);
    if (kind !== "deposition") rebaseTransportDrafts(baseRevision, next.revision);
    return next;
  };
  const loadExample = (kind: "dispersion" | "decay") => {
    if (!actions) return;
    const example = publishedExamples[kind];
    void work(async () => {
      const response = await fetch(`/api/example-documents/rc/${example.documentId}`);
      if (!response.ok) throw new Error("Could not load the published example file. Try again.");
      const file = new File([await response.blob()], example.filename, { type: "text/plain" });
      const next = await importFiles(kind, [file]);
      setRaw(undefined); setLevelPage(0); setParentKey("");
      if (kind === "decay") {
        const loaded = next.decayFiles.find(f => f.file.sha256 === example.sha256);
        const parent = loaded?.parents.find(p => p.nuclide === "Cs-137" && Number(p.energy) === 0);
        if (loaded && parent) setParentKey(`${loaded.file.documentId}:${parent.index}`);
      }
    });
  };
  const fileBox = (kind: Tab) => {
    const files = inputs?.decayFiles ?? [], file = kind === "deposition" ? depositionFile : kind === "dispersion" ? inputs?.dispersionReference?.file : files.length === 1 ? files[0].file : undefined;
    const example = kind === "deposition" ? undefined : publishedExamples[kind], empty = kind === "decay" ? files.length === 0 : !file;
    const labels = { deposition: "Deposition file", dispersion: "Dispersion file", decay: "Radioactive decay file" };
    const extensions = { deposition: ".inp · .txt", dispersion: ".inp · .txt", decay: ".ensdf · .txt · .dat" };
    return <><div className="at-file"><div className="at-file-info"><span className="at-small">{labels[kind]}</span><strong>{kind === "decay" && files.length > 1 ? `${files.length} files` : file?.filename ?? (kind === "deposition" && sourceLoading ? "Reading Step 01 file…" : "No file selected")}</strong><span className="at-small">{extensions[kind]}</span></div>
      <div className="at-file-actions">{editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || kind === "deposition" && (dirty || !source)} onClick={() => { importKind.current = kind; input.current?.click(); }}>{kind === "decay" || !file ? <RCIcon.Plus /> : <RCIcon.Refresh />} {kind === "decay" ? "Add files" : file ? "Replace file" : "Import file"}</button>}
        {editable && empty && kind !== "deposition" && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Load published ${kind} example`} disabled={disabled} onClick={() => loadExample(kind)}><RCIcon.Sparkle /> Load example</button>}
        {file && view(file)}{kind === "decay" && file && editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty} onClick={() => unlink("decay", file.documentId)}>Remove</button>}
      </div></div>{file && raw?.documentId === file.documentId && <pre className="at-raw" aria-label="Original transport input">{raw.text}</pre>}</>;
  };
  return <div className="poscard rc-transport-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="OpenRC transport inputs" level={3} /></div>
    <section className="rc-transport" aria-label="OpenRC transport inputs">
      <label className="at-category">Release category<select className="posfield__select" aria-label="Transport release category" disabled={!categories.length || dirty || busy} value={categoryId} onChange={e => setSelectedCategory(e.target.value)}>{!categories.length && <option value="">No release category yet</option>}{categories.map(c => <option key={c.releaseCategory} value={c.releaseCategory}>{c.releaseCategory}{c.sourceTermDefinitionRef ? ` · ${c.sourceTermDefinitionRef}` : ""}</option>)}</select></label>
      <div className="at-tabs" role="tablist" aria-label="Transport inputs" ref={tabs} onKeyDown={e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault();
        const all: Tab[] = ["deposition", "dispersion", "decay"], index = e.key === "Home" ? 0 : e.key === "End" ? 2 : (all.indexOf(tab) + (e.key === "ArrowRight" ? 1 : 2)) % 3;
        setTab(all[index]); setRaw(undefined); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[index].focus();
      }}>{(["deposition", "dispersion", "decay"] as const).map(t => <button key={t} type="button" id={`${id}-${t}`} role="tab" aria-selected={tab === t} aria-controls={`${id}-panel`} tabIndex={tab === t ? 0 : -1} onClick={() => { setTab(t); setRaw(undefined); }}>{t === "deposition" ? "Deposition" : t === "dispersion" ? "Dispersion" : "Radioactive decay"}</button>)}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {tab === "deposition" ? <>{fileBox("deposition")}{custom && editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty} onClick={() => unlink("deposition")}>Use Step 01 file</button>}
          {sourceError && <p className="at-error" role="alert">{sourceError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
          {mismatch && <p className="at-error" role="alert">The replacement file’s groups differ from the current Step 01 source. Replace it or use the Step 01 file.</p>}
          {!source ? <p className="at-empty">No Step 01 source inventory.</p> : <><h3>OpenRC group deposition</h3>
            <div className="at-fields"><label>Chemical group<select className="posfield__select" aria-label="Chemical group" value={group?.groupId ?? ""} onChange={e => { setGroupId(Number(e.target.value)); setBinPage(0); }}>{settings.groupVelocities.map(g => <option key={g.groupId} value={g.groupId}>{g.name}{g.basis === "noble_gas" ? " · noble gases" : ""}</option>)}</select></label>
              <label>Group deposition velocity (m/s)<WorkbookInput className="posfield__input posmono" key={`${categoryId}:${group?.groupId}`} type="number" min={0} max={10} step="any" aria-label="Group deposition velocity (m/s)" disabled={disabled} readOnly={group?.basis === "noble_gas"} value={inputValue(group?.velocity)} onChange={e => edit({ groupVelocities: settings.groupVelocities.map(g => g.groupId === group?.groupId ? { ...g, velocity: e.target.value === "" ? NaN : Number(e.target.value), basis: "analyst" } : g) })} /></label>
            </div>
            {deposition && groupData ? <><div className="at-section-title"><h3>Imported particle-size data · {group?.name}</h3><span className="at-small">{deposition.velocities.length} bins · dry deposition {groupData.dry === undefined ? "not specified" : groupData.dry ? "on" : "off"}</span></div>
              <table className="at-bin-table" aria-label="Particle-size data"><thead><tr><th>Size bin</th><th>Bin velocity (m/s)</th><th>Group fraction (0–1)</th></tr></thead><tbody>{deposition.velocities.slice(offset, offset + 5).map((v, i) => <tr key={offset + i}><td>{offset + i + 1}</td><td>{show(v)}</td><td>{show(groupData.fractions[offset + i])}</td></tr>)}</tbody></table>
              <div className="at-pagination"><span>{offset + 1} to {Math.min(offset + 5, deposition.velocities.length)} of {deposition.velocities.length} bins</span><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!offset} onClick={() => setBinPage(binPage - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={offset + 5 >= deposition.velocities.length} onClick={() => setBinPage(binPage + 1)}>Next</button></div></div>
              <details><summary>Imported deposition flags</summary><p className="at-note">Wet: {groupData.wet === undefined ? "not specified" : groupData.wet ? "on" : "off"} · Dry: {groupData.dry === undefined ? "not specified" : groupData.dry ? "on" : "off"}</p></details>
            </> : !sourceLoading && <p className="at-note">{linked?.issue ?? "No particle-size data."}</p>}
            <details><summary>All {settings.groupVelocities.length} OpenRC group velocities</summary><table aria-label="Group deposition velocities"><thead><tr><th>Chemical group</th><th>Velocity (m/s)</th><th>Basis</th></tr></thead><tbody>{settings.groupVelocities.map(g => <tr key={g.groupId}><td>{g.name}</td><td>{show(g.velocity)}</td><td>{basisLabel(g.basis)}</td></tr>)}</tbody></table></details>
          </>}</> : tab === "dispersion" ? <><h3>OpenRC model</h3><dl className="at-readonly"><div><dt>Transport model</dt><dd>Steady-state Gaussian plume</dd></div><div><dt>Plume spread</dt><dd>Pasquill–Gifford</dd></div></dl>
          <div className="at-reference">{fileBox("dispersion")}{inputs?.dispersionReference ? <>
            <div className="at-section-title"><h3>Imported power-law coefficients</h3></div><table className="at-coefficients" aria-label="Dispersion reference coefficients"><thead><tr><th>Stability</th><th>σ<sub>y</sub> (a)</th><th>σ<sub>y</sub> (b)</th><th>σ<sub>z</sub> (a)</th><th>σ<sub>z</sub> (b)</th></tr></thead><tbody>{[..."ABCDEF"].map((s, i) => <tr key={s}><td>{s}</td>{(["sigmaYA", "sigmaYB", "sigmaZA", "sigmaZB"] as const).map(k => <td key={k}>{show(inputs.dispersionReference!.data[k][i])}</td>)}</tr>)}</tbody></table>
            <dl className="at-readonly"><div><dt>Imported sideways scale</dt><dd>{show(inputs.dispersionReference.data.sidewaysScale)}</dd></div><div><dt>Imported vertical scale</dt><dd>{show(inputs.dispersionReference.data.verticalScale)}</dd></div></dl>
          </> : <p className="at-empty">No dispersion file.</p>}</div>
        </> : <><label className="at-decay-treatment">Radioactive decay treatment<select className="posfield__select" aria-label="Radioactive decay treatment" disabled={disabled || !source} value={settings.decayMode} onChange={e => edit({ decayMode: e.target.value as "parent" | "ingrowth" })}><option value="parent">Parent decay during transport</option><option value="ingrowth">Decay and daughter ingrowth</option></select></label>
          <div className="at-decay-file">{fileBox("decay")}</div>
          {(inputs?.decayFiles.length ?? 0) > 1 && <><ul className="at-library-list">{inputs!.decayFiles.map(f => <li key={f.file.documentId}><span>{f.file.filename}</span><div>{view(f.file)}{editable && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove ${f.file.filename}`} disabled={disabled || dirty} onClick={() => unlink("decay", f.file.documentId)}>Remove</button>}</div></li>)}</ul>{raw && inputs!.decayFiles.some(f => f.file.documentId === raw.documentId) && <pre className="at-raw" aria-label="Original transport input">{raw.text}</pre>}</>}
          <div className="at-coverage"><strong>{coverage.found.length} of {coverage.total} source isotopes have a parent half-life record</strong>{!!coverage.missing.length && <details><summary>{coverage.missing.length} source isotopes to supply</summary><p className="at-nuclides">{coverage.missing.join(", ")}</p></details>}</div>
          {!source && <p className="at-note">No Step 01 inventory.</p>}
          {!!parents.length && <label className="at-parent-record">Parent record<select className="posfield__select" aria-label="Parent record" value={selectedParent?.key ?? ""} onChange={e => { setParentKey(e.target.value); setLevelPage(0); }}>{parents.map(p => <option key={p.key} value={p.key}>{p.parent.nuclide} · {p.parent.halfLife} · {p.parent.energy} keV · {p.file.filename}</option>)}</select></label>}
          {detailLoading && <p className="at-note" role="status">Loading decay records…</p>}{detailError && <p className="at-error" role="alert">{detailError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
          {detail && <><div className="at-section-title"><h3>{detail.parent.nuclide} to {detail.parent.daughter}</h3><span className="at-small">Half-life: {detail.parent.halfLife}</span></div>
            <table aria-label="Daughter levels"><thead><tr><th>Daughter level (keV)</th><th>Half-life in file</th><th>Beta feeding (file)</th></tr></thead><tbody>{detail.levels.map((l, i) => <tr key={i}><td>{l.energy}{l.metastable ? " · metastable" : ""}</td><td>{l.halfLife || "Not supplied"}</td><td>{l.betaFeeding || "—"}</td></tr>)}</tbody></table>
            {detail.parent.levelCount > 6 && <div className="at-pagination"><span>{detail.offset + 1} to {Math.min(detail.offset + 6, detail.parent.levelCount)} of {detail.parent.levelCount} levels</span><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!levelPage} onClick={() => setLevelPage(levelPage - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={(levelPage + 1) * 6 >= detail.parent.levelCount} onClick={() => setLevelPage(levelPage + 1)}>Next</button></div></div>}
            <details><summary>Original parent record and normalization</summary><pre>{[detail.original, ...detail.normalization].join("\n")}</pre></details>
          </>}{!parents.length && <p className="at-empty">No parent or daughter records.</p>}
        </>}
      </div>
      {error && <p className="at-error" role="alert">{error}</p>}{conflict && <p className="at-error" role="alert">Transport inputs or the source changed. Discard these edits to review the latest values.</p>}
      <footer className="at-footer">{(busy || dirty) && <span className="at-status" role="status">{busy ? "Working…" : "Unsaved changes"}</span>}
        {editable && <div className="at-file-actions">{dirty && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => { setTransportDraft(categoryId, undefined); setError(""); }}>Discard edits</button>}<button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || !source || !validSettings || conflict || savedForSource} onClick={() => {
          if (!actions || !source) return; void work(async () => { await actions.saveSettings(revision, categoryId, source.revision, settings); setTransportDraft(categoryId, undefined); });
        }}>Save transport inputs</button></div>}
      </footer>
      <WorkbookInput type="file" ref={input} hidden multiple={tab === "decay"} accept=".inp,.txt,.ensdf,.dat" aria-label="Import transport input files" disabled={disabled || tab === "deposition" && dirty} onChange={async e => {
        const files = Array.from(e.target.files ?? []); e.target.value = ""; if (!files.length || !actions) return;
        const kind = importKind.current;
        await work(async () => { await importFiles(kind, files); setRaw(undefined); setParentKey(""); setLevelPage(0); setBinPage(0); });
      }} />
    </section>
  </div>;
}
