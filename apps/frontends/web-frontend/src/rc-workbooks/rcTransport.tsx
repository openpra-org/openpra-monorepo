import { useEffect, useId, useRef, useState, type JSX } from "react";
import type { RcDecayDetail, RcLinkedDeposition, RcTransportFile, RcTransportSettings } from "interfaces-mef-types/rc/transport";
import { RcTransportSettingsSchema } from "interfaces-mef-types/zod/rc/transport";
import { decayCoverage, depositionMatchesSource, effectiveTransportSettings } from "interfaces-shared-types/rc-workbooks/transport";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcTransport.css";

type FileTab = "dispersion" | "deposition" | "decay";
const scientific = (n: number) => n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3);
const show = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "—" : scientific(n) ? n.toExponential() : String(Number(n.toPrecision(7)));
const inputValue = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "" : scientific(n) ? n.toExponential() : n;
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Could not update transport inputs";
const basisLabel = (basis: string) => basis === "noble_gas" ? "Noble gas" : basis === "source_file" ? "Calculated from file" : basis === "openrc_default" ? "Review required" : "Analyst value";
const words = (value: string | undefined) => value ? value.toLowerCase().replace(/_/g, " ") : "Not specified";
export function RcTransportPanel({ openEditor }: { openEditor?: (kind: "dispersion" | "deposition") => void }): JSX.Element {
  const { rc, editable, transport: actions, transportDrafts, setTransportDraft, rebaseTransportDrafts } = useRcWorkbook();
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs, inputs = rc.atmosphericTransportAndDispersion.transportInputs;
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.releaseCategory ?? "");
  const category = categories.find(c => c.releaseCategory === selectedCategory) ?? categories[0], categoryId = category?.releaseCategory ?? "", source = category?.sourceTerm;
  const saved = inputs?.categories.find(c => c.categoryId === categoryId), draft = editable ? transportDrafts[categoryId] : undefined;
  const revision = draft?.baseRevision ?? inputs?.revision ?? 0;
  const dirty = Boolean(draft), conflict = dirty && (revision !== (inputs?.revision ?? 0) || draft!.sourceRevision !== source?.revision);
  const [tab, setTab] = useState<FileTab>("dispersion"), [groupId, setGroupId] = useState(2), [binPage, setBinPage] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [linked, setLinked] = useState<RcLinkedDeposition>(), [sourceLoading, setSourceLoading] = useState(false), [sourceError, setSourceError] = useState("");
  const [raw, setRaw] = useState<{ documentId: string; text: string }>(), [parentKey, setParentKey] = useState(""), [levelPage, setLevelPage] = useState(0);
  const [detail, setDetail] = useState<RcDecayDetail>(), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState(""), [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null), importKind = useRef<FileTab>("deposition"), tabs = useRef<HTMLDivElement>(null), id = useId();
  const disabled = !editable || !actions || busy;
  const custom = saved?.deposition;
  const mismatch = Boolean(custom && source && !depositionMatchesSource(custom.data, source.values));
  const deposition = custom ? mismatch ? undefined : custom.data : linked?.data;
  const settings = draft?.settings ?? effectiveTransportSettings(source?.values, saved?.settings, deposition);
  const group = settings.groupVelocities.find(g => g.groupId === groupId) ?? settings.groupVelocities.find(g => g.name === "Cs") ?? settings.groupVelocities[0];
  const depositionFile = custom?.file ?? linked?.file, groupData = deposition?.groups.find(g => g.id === group?.groupId);
  const offset = Math.min(binPage, Math.max(0, Math.ceil((deposition?.velocities.length ?? 0) / 5) - 1)) * 5;
  const parents = inputs?.decayFiles.flatMap(f => f.parents.map(p => ({ file: f.file, parent: p, key: `${f.file.documentId}:${p.index}` }))) ?? [];
  const selectedParent = parents.find(p => p.key === parentKey) ?? parents[0], coverage = decayCoverage(inputs, source?.values);
  const validSettings = !mismatch && RcTransportSettingsSchema.safeParse(settings).success;
  const sameAsSaved = Boolean(saved?.settings && saved.settings.decayMode === settings.decayMode && saved.settings.groupVelocities.length === settings.groupVelocities.length
    && settings.groupVelocities.every(value => { const stored = saved.settings!.groupVelocities.find(item => item.groupId === value.groupId); return stored?.name === value.name && stored.velocity === value.velocity && stored.basis === value.basis; }));
  const savedForSource = Boolean(source && saved?.savedForSourceRevision === source.revision && sameAsSaved && !dirty);
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
  const importFiles = async (kind: FileTab, files: File[]) => {
    if (!actions) throw new Error("Transport file imports are unavailable");
    const baseRevision = kind === "deposition" ? revision : inputs?.revision ?? 0;
    const next = await actions.importFiles(kind, baseRevision, files,
      kind === "deposition" ? categoryId : undefined, kind === "deposition" ? source?.revision : undefined);
    if (kind !== "deposition") rebaseTransportDrafts(baseRevision, next.revision);
    return next;
  };
  const fileBox = (kind: FileTab) => {
    const files = inputs?.decayFiles ?? [], file = kind === "deposition" ? depositionFile : kind === "dispersion" ? inputs?.dispersionReference?.file : files.length === 1 ? files[0].file : undefined;
    const labels = { deposition: "Deposition file", dispersion: "Dispersion file", decay: "Radioactive decay file" };
    const extensions = { deposition: ".inp · .txt", dispersion: ".inp · .txt", decay: ".ensdf · .txt · .dat" };
    return <><div className="at-file"><div className="at-file-info"><span className="at-small">{labels[kind]}</span><strong>{kind === "decay" && files.length > 1 ? `${files.length} files` : file?.filename ?? (kind === "deposition" && sourceLoading ? "Reading Step 01 file…" : "No file selected")}</strong><span className="at-small">{extensions[kind]}</span></div>
      <div className="at-file-actions">{editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || kind === "deposition" && (dirty || !source)} onClick={() => { importKind.current = kind; input.current?.click(); }}>{kind === "decay" || !file ? <RCIcon.Plus /> : <RCIcon.Refresh />} {kind === "decay" ? "Add files" : file ? "Replace file" : "Import file"}</button>}
        {file && view(file)}{kind === "decay" && file && editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty} onClick={() => unlink("decay", file.documentId)}>Remove</button>}
      </div></div>{file && raw?.documentId === file.documentId && <pre className="at-raw" aria-label="Original transport input">{raw.text}</pre>}</>;
  };
  const ad = rc.atmosphericTransportAndDispersion;
  const treatment = (included: boolean, detail?: string) => included ? detail?.trim() ? `Included · ${detail}` : "Included" : "Excluded";
  const reviewTable = (name: string, items: readonly { label: string; value: string }[]) => <table className="at-review-table" aria-label={name}><tbody>{items.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.value || "Not recorded"}</td></tr>)}</tbody></table>;
  return <div className="poscard rc-transport-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Atmospheric transport" level={3} /></div>
    <section className="rc-transport" aria-label="Atmospheric transport inputs">
      <label className="at-category">Release category<select className="posfield__select" aria-label="Transport release category" disabled={!categories.length || dirty || busy} value={categoryId} onChange={e => setSelectedCategory(e.target.value)}>{!categories.length && <option value="">No release category yet</option>}{categories.map(c => <option key={c.releaseCategory} value={c.releaseCategory}>{c.releaseCategory}{c.sourceTermDefinitionRef ? ` · ${c.sourceTermDefinitionRef}` : ""}</option>)}</select></label>
      <div className="at-tabs" role="tablist" aria-label="Transport inputs" ref={tabs} onKeyDown={e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault();
        const all: FileTab[] = ["dispersion", "deposition", "decay"], index = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (all.indexOf(tab) + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length;
        setTab(all[index]); setRaw(undefined); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[index].focus();
      }}>{(["dispersion", "deposition", "decay"] as const).map(t => <button key={t} type="button" id={`${id}-${t}`} role="tab" aria-selected={tab === t} aria-controls={`${id}-panel`} tabIndex={tab === t ? 0 : -1} onClick={() => { setTab(t); setRaw(undefined); }}>{t === "dispersion" ? "Dispersion model" : t === "deposition" ? "Deposition" : "Radioactive decay"}</button>)}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {tab === "dispersion" ? <>
          <div className="at-section-title"><h3>Calculation model</h3>{editable && openEditor && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openEditor("dispersion")}><RCIcon.Settings /> Edit model</button>}</div>
          {reviewTable("Calculation model", [
            { label: "Model", value: ad.dispersionModel.name?.trim() || words(ad.dispersionModel.modelClass) },
            { label: "Model basis", value: ad.dispersionModel.justification },
            { label: "Time treatment", value: words(ad.temporalResolution.approach) },
            { label: "Space treatment", value: words(ad.spatialTreatment.approach) },
            { label: "Weather sampling", value: words(ad.meteorologicalSampling.approach) },
            { label: "Plume segmentation", value: words(ad.plumeSegmentation.approach) },
            { label: "Step 03 weather", value: ad.meteorologicalDataPerRcme ? "Used" : "Not used" },
            { label: "Plume rise", value: treatment(ad.plumeRise.credited, ad.plumeRise.algorithmsDescription) },
            { label: "Elevated release", value: ad.elevatedReleaseAlgorithms || "Not defined" },
            { label: "Building wake", value: ad.buildingWakeEffects || "Not defined" },
            { label: "Terrain", value: ad.terrainEffectsConsideration || "Not defined" },
          ])}
          <div className="at-section-title"><h3>Power-law dispersion coefficients</h3></div>{fileBox("dispersion")}{inputs?.dispersionReference ? <>
            <table className="at-coefficients" aria-label="Dispersion reference coefficients"><thead><tr><th>Stability</th><th>σ<sub>y</sub> (a)</th><th>σ<sub>y</sub> (b)</th><th>σ<sub>z</sub> (a)</th><th>σ<sub>z</sub> (b)</th></tr></thead><tbody>{[..."ABCDEF"].map((s, i) => <tr key={s}><td>{s}</td>{(["sigmaYA", "sigmaYB", "sigmaZA", "sigmaZB"] as const).map(k => <td key={k}>{show(inputs.dispersionReference!.data[k][i])}</td>)}</tr>)}</tbody></table>
            <dl className="at-readonly"><div><dt>Sideways scale</dt><dd>{show(inputs.dispersionReference.data.sidewaysScale)}</dd></div><div><dt>Vertical scale</dt><dd>{show(inputs.dispersionReference.data.verticalScale)}</dd></div></dl>
          </> : <p className="at-empty">No dispersion coefficient file.</p>}
        </> : tab === "deposition" ? <>
          <div className="at-section-title"><h3>Removal treatments</h3>{editable && openEditor && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openEditor("deposition")}><RCIcon.Settings /> Edit treatments</button>}</div>
          {reviewTable("Removal treatments", [
            { label: "Dry deposition", value: treatment(ad.deposition.dryDeposition.included, words(ad.deposition.dryDeposition.approach)) },
            { label: "Wet deposition", value: treatment(ad.deposition.wetDeposition.included, ad.deposition.wetDeposition.precipitationIntensityDependent ? "Rain-intensity dependent" : "Fixed coefficients") },
            { label: "Source depletion", value: treatment(ad.deposition.sourceDepletion.included, words(ad.deposition.sourceDepletion.scope)) },
            { label: "Resuspension", value: treatment(ad.deposition.resuspension.included, ad.deposition.resuspension.description) },
          ])}
          <div className="at-section-title"><h3>Chemical-group deposition</h3></div>{fileBox("deposition")}{custom && editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty} onClick={() => unlink("deposition")}>Use Step 01 file</button>}
          {sourceError && <p className="at-error" role="alert">{sourceError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
          {mismatch && <p className="at-error" role="alert">The replacement file’s groups differ from the current Step 01 source. Replace it or use the Step 01 file.</p>}
          {!source ? <p className="at-empty">No Step 01 source inventory.</p> : <>
            <div className="at-fields"><label>Chemical group<select className="posfield__select" aria-label="Chemical group" value={group?.groupId ?? ""} onChange={e => { setGroupId(Number(e.target.value)); setBinPage(0); }}>{settings.groupVelocities.map(g => <option key={g.groupId} value={g.groupId}>{g.name}{g.basis === "noble_gas" ? " · noble gases" : ""}</option>)}</select></label>
              <label>Effective velocity (m/s)<WorkbookInput className="posfield__input posmono" key={`${categoryId}:${group?.groupId}:${group?.basis}`} type="number" min={0} max={10} step="any" aria-label="Group deposition velocity (m/s)" disabled={disabled} readOnly={group?.basis === "noble_gas"} value={inputValue(group?.velocity)} onChange={e => edit({ groupVelocities: settings.groupVelocities.map(g => g.groupId === group?.groupId ? { ...g, velocity: e.target.value === "" ? NaN : Number(e.target.value), basis: "analyst" } : g) })} /></label>
            </div>
            {group && <div className="at-value-basis"><span>Basis</span><strong>{basisLabel(group.basis)}</strong>{group.basis === "source_file" && editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => edit({ groupVelocities: settings.groupVelocities.map(g => g.groupId === group.groupId ? { ...g, basis: "analyst" } : g) })}>Override</button>}</div>}
            {deposition && groupData ? <><div className="at-section-title"><h3>Imported particle-size data · {group?.name}</h3><span className="at-small">{deposition.velocities.length} bins · dry deposition {groupData.dry === undefined ? "not specified" : groupData.dry ? "on" : "off"}</span></div>
              <table className="at-bin-table" aria-label="Particle-size data"><thead><tr><th>Size bin</th><th>Bin velocity (m/s)</th><th>Group fraction (0–1)</th></tr></thead><tbody>{deposition.velocities.slice(offset, offset + 5).map((v, i) => <tr key={offset + i}><td>{offset + i + 1}</td><td>{show(v)}</td><td>{show(groupData.fractions[offset + i])}</td></tr>)}</tbody></table>
              <div className="at-pagination"><span>{offset + 1} to {Math.min(offset + 5, deposition.velocities.length)} of {deposition.velocities.length} bins</span><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!offset} onClick={() => setBinPage(binPage - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={offset + 5 >= deposition.velocities.length} onClick={() => setBinPage(binPage + 1)}>Next</button></div></div>
              <details><summary>Imported deposition flags</summary><p className="at-note">Wet: {groupData.wet === undefined ? "not specified" : groupData.wet ? "on" : "off"} · Dry: {groupData.dry === undefined ? "not specified" : groupData.dry ? "on" : "off"}</p></details>
            </> : !sourceLoading && <p className="at-note">{linked?.issue ?? "No particle-size data."}</p>}
            <details><summary>All {settings.groupVelocities.length} group velocities</summary><table aria-label="Group deposition velocities"><thead><tr><th>Chemical group</th><th>Velocity (m/s)</th><th>Basis</th></tr></thead><tbody>{settings.groupVelocities.map(g => <tr key={g.groupId}><td>{g.name}</td><td>{show(g.velocity)}</td><td>{basisLabel(g.basis)}</td></tr>)}</tbody></table></details>
          </>}</> : <><label className="at-decay-treatment">Radioactive decay treatment<select className="posfield__select" aria-label="Radioactive decay treatment" disabled={disabled || !source} value={settings.decayMode} onChange={e => edit({ decayMode: e.target.value as "parent" | "ingrowth" })}><option value="parent">Parent decay during transport</option><option value="ingrowth">Decay and daughter ingrowth</option></select></label>
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
