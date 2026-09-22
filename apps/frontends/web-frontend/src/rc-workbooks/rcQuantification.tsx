import { useEffect, useId, useMemo, useRef, useState, type JSX } from "react";
import type { RcCaseDataset, RcCaseSelection, RcCaseTextPage, RcLinkedResultValues } from "interfaces-mef-types/rc/case-records";
import { RcLinkedResultValuesSchema } from "interfaces-mef-types/zod/rc/case-records";
import { caseChecks, caseDatasets, caseDuration, caseEmbeddedFiles, caseFiles, caseStepNames, caseSteps, caseSummaryRows, caseVersions, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook, type RcResultDraft } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcQuantification.css";

const steps = { source: "handoff", site: "protective", weather: "weather", transport: "dispersion", dose: "dose", health: "health", economy: "economics" };
const tabs = ["checks", "prepared", "results"] as const;
const tabNames = { checks: "Case & checks", prepared: "Prepared inputs", results: "Results" };
const message = (e: unknown) => e instanceof Error ? e.message : "Could not load the case record";
const show = (v: number | string | null, rounded = false) => {
  if (v === null) return "Not supplied";
  if (typeof v !== "number") return v;
  const value = rounded ? Number(v.toPrecision(8)) : v;
  return value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < .001) ? value.toExponential() : String(value);
};
const emptyDraft = (snapshotId: string): RcResultDraft => ({ snapshotId, receptorId: "", trialId: "", doseText: "", unit: "Sv", version: "", reference: "", confirmed: false });

function useRemote<T>(key: string, load: () => Promise<T>) {
  const fn = useRef(load); fn.current = load;
  const [retry, setRetry] = useState(0), [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  useEffect(() => {
    let cancelled = false;
    setState({ key });
    if (key) void fn.current().then(data => { if (!cancelled) setState({ key, data }); }).catch(e => { if (!cancelled) setState({ key, error: message(e) }); });
    return () => { cancelled = true; };
  }, [key, retry]);
  const current = state.key === key ? state : undefined;
  return { data: current?.data, error: current?.error, loading: Boolean(key && !current?.data && !current?.error), retry: () => setRetry(n => n + 1) };
}
function Pager({ total, offset, size, onChange, label = "Records" }: { total: number; offset: number; size: number; onChange: (value: number) => void; label?: string }): JSX.Element {
  return <div className="q-pagination"><span>{label} {total ? `${Math.min(offset + 1, total)} to ${Math.min(offset + size, total)} of ${total}` : "0"}</span><button className="posnav__btn posnav__btn--sm" type="button" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - size))}>Previous</button><button className="posnav__btn posnav__btn--sm" type="button" disabled={offset + size >= total} onClick={() => onChange(offset + size)}>Next</button></div>;
}
function TextPage({ page, onChange, label }: { page: RcCaseTextPage; onChange: (offset: number) => void; label: string }): JSX.Element {
  return <><pre className="q-file-content" aria-label={label}>{page.text}</pre><Pager total={page.total} offset={page.offset} size={8} onChange={onChange} label="Lines" /></>;
}
function RemoteStatus({ remote }: { remote: { loading: boolean; error?: string; retry: () => void } }): JSX.Element {
  return <>{remote.loading && <p className="q-note" role="status">Loading…</p>}{remote.error && <p className="q-error" role="alert">{remote.error} <button className="posnav__btn posnav__btn--sm" type="button" onClick={remote.retry}>Retry</button></p>}</>;
}
function SnapshotChoice({ label, value, disabled, onChange, includeCurrent = false }: { label: string; value: string; disabled?: boolean; onChange: (id: string) => void; includeCurrent?: boolean }): JSX.Element {
  const { rc } = useRcWorkbook();
  return <label className="q-snapshot-choice">{label}<select className="posfield__select" aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{includeCurrent && <option value="">Current saved inputs</option>}{rc.consequenceQuantification.caseRecords?.snapshots.map(s => <option key={s.id} value={s.id}>{s.label} · {s.categoryId} · {s.integrationSeconds === undefined ? "Time not saved" : `${show(s.integrationSeconds)} s`} · {s.reviewItems} review items</option>)}</select></label>;
}
function IdChoice({ kind, value, snapshotId, disabled, onChange }: { kind: "receptors" | "weather"; value: string; snapshotId: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const { caseRecords: actions } = useRcWorkbook(), id = useId();
  const [search, setSearch] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(value), 150); return () => window.clearTimeout(timer); }, [value]);
  const choices = useRemote(actions && snapshotId ? `${snapshotId}/${kind}/${search}` : "", () => actions!.readChoices(snapshotId, kind, search));
  return <label>{kind === "receptors" ? "Receptor ID" : "Weather trial ID"}<input className="posfield__input posmono" aria-label={kind === "receptors" ? "Receptor ID" : "Weather trial ID"} list={id} autoComplete="off" required maxLength={255} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} /><datalist id={id}>{choices.data?.ids.map(v => <option key={v} value={v} />)}</datalist><RemoteStatus remote={choices} /></label>;
}

export function RcQuantificationPanel({ onOpenStep }: { onOpenStep?: (id: string) => void }): JSX.Element {
  const { rc, editable, caseRecords: actions, sourceTermDrafts, siteReceptorDraft, weatherDraft, weatherDates, transportDrafts, doseDrafts, resultDraft, setResultDraft } = useRcWorkbook();
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs, records = rc.consequenceQuantification.caseRecords;
  const snapshotCount = records?.snapshots.length ?? 0, resultCount = records?.results.length ?? 0;
  const [categoryId, setCategoryId] = useState(categories[0]?.releaseCategory ?? ""), [tab, setTab] = useState<typeof tabs[number]>("checks"), [checked, setChecked] = useState(false);
  const categoryKey = categories.find(c => c.releaseCategory === categoryId)?.releaseCategory ?? categories[0]?.releaseCategory ?? "";
  const current = useMemo(() => currentRcCase(rc, categoryKey), [rc, categoryKey]), versions = caseVersions(current);
  const checks = useMemo(() => caseChecks(current), [current]), summaries = useMemo(() => caseSummaryRows(current), [current]);
  const includedSteps = caseSteps.filter(key => !current.excludedSteps?.includes(key));
  const dirty = Boolean(sourceTermDrafts[categoryKey] || siteReceptorDraft || weatherDraft || weatherDates || transportDrafts[categoryKey] || doseDrafts[categoryKey]);
  const [dataset, setDataset] = useState<RcCaseDataset>("inventory"), [offset, setOffset] = useState(0), [inspectId, setInspectId] = useState("");
  const inspected = records?.snapshots.find(s => s.id === inspectId);
  const selection: RcCaseSelection = { categoryId: inspected?.categoryId ?? categoryKey, versions, ...(inspected ? { snapshotId: inspected.id } : {}) };
  const selectionKey = `${categoryKey}/${versions}/${inspected?.id ?? ""}`;
  const [fileId, setFileId] = useState(""), [textOffset, setTextOffset] = useState(0), [outputId, setOutputId] = useState(""), [outputOffset, setOutputOffset] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [selectedSnapshot, setSelectedSnapshot] = useState("");
  const id = useId(), tablist = useRef<HTMLDivElement>(null), upload = useRef<HTMLInputElement>(null);
  const enabled = Boolean(actions && (categoryKey || inspected));
  const review = useRemote(enabled && inspected && tab === "prepared" ? selectionKey : "", () => actions!.readReview(selection));
  const files = inspected ? review.data?.files ?? [] : caseFiles(current), embedded = inspected ? review.data?.embedded ?? [] : caseEmbeddedFiles(current), preparedChecks = inspected ? review.data?.checks ?? [] : checks;
  const excludedDatasets = useMemo(() => inspected ? review.data?.excludedSteps ?? current.excludedSteps ?? [] : current.excludedSteps ?? [], [inspected, review.data?.excludedSteps, current.excludedSteps]);
  const availableDatasets = useMemo(() => Object.entries(caseDatasets).filter(([, value]) => !excludedDatasets.includes(value.step)
    && !(inspected && review.data?.schemaVersion === 1 && (value.step === "health" || value.step === "economy"))), [excludedDatasets, inspected, review.data?.schemaVersion]);
  const reviewCount = inspected?.reviewItems ?? preparedChecks.reduce((n, c) => n + c.items.length, 0);
  const table = useRemote(enabled && tab === "prepared" ? `${selectionKey}/${dataset}/${offset}` : "", () => actions!.readTable(selection, dataset, offset));
  const text = useRemote(enabled && fileId && tab === "prepared" ? `${selectionKey}/${fileId}/${textOffset}` : "", () => actions!.readText(selection, fileId, textOffset));
  const output = useRemote(actions && outputId && tab === "results" ? `${outputId}/${outputOffset}` : "", () => actions!.readOutput(outputId, outputOffset));
  const snapshotId = resultDraft?.snapshotId ?? (records?.snapshots.some(s => s.id === selectedSnapshot) ? selectedSnapshot : records?.snapshots.at(-1)?.id ?? "");
  const snapshot = records?.snapshots.find(s => s.id === snapshotId), draft = resultDraft ?? emptyDraft(snapshotId);
  const [preview, setPreview] = useState<{ file: File; text: string }>(), [previewOffset, setPreviewOffset] = useState(0), [previewError, setPreviewError] = useState("");
  useEffect(() => {
    let cancelled = false; setPreview(undefined); setPreviewError(""); setPreviewOffset(0);
    const file = draft.file;
    if (file) void file.arrayBuffer().then(buffer => { const text = decodeRcText(new Uint8Array(buffer)); if (!text.trim()) throw new Error("The output is empty"); if (!cancelled) setPreview({ file, text }); }).catch(e => { if (!cancelled) setPreviewError(message(e)); });
    return () => { cancelled = true; };
  }, [draft.file]);
  useEffect(() => { setOffset(0); setFileId(""); setTextOffset(0); setError(""); }, [categoryKey, versions, inspectId]);
  useEffect(() => { if (!availableDatasets.some(([kind]) => kind === dataset)) setDataset("inventory"); }, [dataset, availableDatasets]);
  const updateDraft = (patch: Partial<RcResultDraft>) => { setResultDraft({ ...draft, ...patch }); setError(""); setNotice(""); };
  const work = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); setError(""); setNotice(""); try { await fn(); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  const openStep = (key: typeof caseSteps[number]) => onOpenStep?.(steps[key]);
  const showFile = (next: string) => { setFileId(fileId === next ? "" : next); setTextOffset(0); };
  const inspect = (next: string) => { setInspectId(next); setFileId(""); setOffset(0); setTab("prepared"); };
  const resultValues = { snapshotId, receptorId: draft.receptorId, trialId: draft.trialId, dose: draft.doseText.trim() === "" ? NaN : Number(draft.doseText), unit: draft.unit, version: draft.version, reference: draft.reference, confirmed: draft.confirmed };
  const resultValid = RcLinkedResultValuesSchema.safeParse(resultValues);
  const canSaveResult = Boolean(snapshot && snapshot.integrationSeconds && resultValid.success && preview?.file === draft.file && !previewError);
  const previewLines = preview?.text.split(/\r\n|\n|\r/);
  return <div className="poscard rc-case-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Case inputs and results" level={3} /></div>
    <section className="rc-quantification" aria-label="Case inputs and results">
      <label className="q-category">Release category<select className="posfield__select" aria-label="Case release category" value={categoryKey} disabled={busy || !categories.length} onChange={e => { setCategoryId(e.target.value); setInspectId(""); setChecked(false); }}>{!categories.length && <option value="">No release category yet</option>}{categories.map(c => <option key={c.releaseCategory}>{c.releaseCategory}</option>)}</select></label>
      <div className="q-tabs" role="tablist" aria-label="Case records" ref={tablist} onKeyDown={e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault();
        const index = e.key === "Home" ? 0 : e.key === "End" ? 2 : (tabs.indexOf(tab) + (e.key === "ArrowRight" ? 1 : 2)) % 3;
        setTab(tabs[index]); tablist.current?.querySelectorAll<HTMLButtonElement>("button")[index].focus();
      }}>{tabs.map(t => <button key={t} type="button" role="tab" id={`${id}-${t}`} aria-selected={tab === t} aria-controls={`${id}-panel`} tabIndex={t === tab ? 0 : -1} onClick={() => setTab(t)}>{tabNames[t]}</button>)}</div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {tab === "checks" && <><ol className="q-input-list">{includedSteps.map(key => { const index = caseSteps.indexOf(key), summary = summaries[index], check = checks.find(item => item.key === key); return <li key={key}><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!onOpenStep} onClick={() => openStep(key)}>{String(index + 1).padStart(2, "0")}. {caseStepNames[key]}</button></div><div><strong>{key === "dose" && caseDuration(current) !== undefined ? `${show(caseDuration(current)!)} s integration time` : summary[0]}</strong><small>{summary[1]}</small></div><span className="q-status">{check?.items.length ? "To review" : "Checked"}</span></li>; })}</ol>
          <div className="q-footer"><span className="q-note">{checks.filter(c => c.key !== "links" && !c.items.length).length} of {includedSteps.length} input sections checked</span><button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setChecked(true)}>Check case</button></div>
          {checked && <div aria-label="Case checks"><h3>Items to review</h3>{checks.map(c => <details className="q-check" key={c.key} open={c.items.length > 0}><summary><span>{c.title}</span><span>{c.items.length ? `${c.items.length} to review` : "Checks passed"}</span></summary>{c.items.length ? <ul>{c.items.map(item => <li key={item}>{item}</li>)}</ul> : <p className="q-note">No items to review.</p>}{c.key !== "links" && <button className="posnav__btn posnav__btn--sm" type="button" disabled={!onOpenStep} onClick={() => openStep(c.key as typeof caseSteps[number])}>Open Step {String(caseSteps.indexOf(c.key) + 1).padStart(2, "0")}</button>}</details>)}</div>}
          <div className="q-footer"><span className="q-note">{snapshotCount} saved input {snapshotCount === 1 ? "snapshot" : "snapshots"} · {resultCount} result {resultCount === 1 ? "record" : "records"}</span><button className="posnav__btn posnav__btn--sm" type="button" onClick={() => inspect("")}>Review prepared inputs</button></div>
        </>}
        {tab === "prepared" && <>
          <div className="q-topline"><h3>{inspected ? `${inspected.label} · Saved input snapshot` : "Saved workbook values"}</h3><button className="posnav__btn posnav__btn--sm" type="button" disabled={!onOpenStep} onClick={() => openStep(caseDatasets[dataset].step)}>{editable ? "Edit" : "View"} Step {caseDatasets[dataset].label.slice(0, 2)}</button></div>
          {!!records?.snapshots.length && <div className="q-inspect"><SnapshotChoice label="Inputs to inspect" value={inspected?.id ?? ""} onChange={inspect} includeCurrent /></div>}
          <label className="q-input-group">Input group<select className="posfield__select" aria-label="Input group" value={dataset} onChange={e => { setDataset(e.target.value as RcCaseDataset); setOffset(0); }}>{availableDatasets.map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <RemoteStatus remote={table} />{table.data && <>{table.data.total ? <><div className="q-table-wrap"><table aria-label="Prepared input records"><thead><tr>{table.data.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{table.data.rows.map((r, i) => <tr key={offset + i}>{r.map((v, j) => <td key={j}>{show(v, dataset === "receptors")}</td>)}</tr>)}</tbody></table></div><Pager offset={table.data.offset} size={5} total={table.data.total} onChange={setOffset} /></> : <p className="q-empty">No records.</p>}</>}
          <RemoteStatus remote={review} />
          <div className="q-original-files"><button className="posnav__btn posnav__btn--sm" type="button" onClick={() => showFile("structured")}>{fileId === "structured" ? "Hide complete case data" : "View complete case data"}</button>
            <details className="q-check"><summary>Original files · {files.length + embedded.length}</summary><ul className="q-file-list">{files.map(f => <li key={f.file.documentId}><span>{f.file.filename}<small>{f.purpose}</small></span><button className="posnav__btn posnav__btn--sm" type="button" aria-label={`View ${f.file.filename}`} aria-expanded={fileId === f.file.documentId} disabled={!actions} onClick={() => showFile(f.file.documentId)}>{fileId === f.file.documentId ? "Hide" : "View"}</button></li>)}{embedded.map(f => <li key={f.id}><span>{f.filename}<small>{f.purpose}</small></span><button className="posnav__btn posnav__btn--sm" type="button" aria-label={`View ${f.filename}`} aria-expanded={fileId === f.id} disabled={!actions} onClick={() => showFile(f.id)}>{fileId === f.id ? "Hide" : "View"}</button></li>)}</ul>{!files.length && !embedded.length && <p className="q-note">No original files saved for this case.</p>}</details></div>
          {fileId && <div className="q-file-view"><h3>{fileId === "structured" ? "Workbook case data" : files.find(f => f.file.documentId === fileId)?.file.filename ?? embedded.find(f => f.id === fileId)?.filename}</h3><RemoteStatus remote={text} />{text.data && <TextPage page={text.data} onChange={setTextOffset} label="Case file content" />}</div>}
          <div className="q-snapshot"><strong>{reviewCount} {reviewCount === 1 ? "item" : "items"} to review</strong>{inspected && `Saved by ${inspected.createdBy} · ${new Date(inspected.file.uploadedAt).toLocaleString()}`}</div>
          <div className="q-footer"><button className="posnav__btn posnav__btn--sm" type="button" onClick={() => { setTab("checks"); setChecked(true); }}>Review current checks</button>{inspected ? <button className="posnav__btn posnav__btn--sm" type="button" onClick={() => inspect("")}>Review current inputs</button> : editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={busy || !enabled || dirty} onClick={() => void work(async () => { const saved = await actions!.saveSnapshot(records?.revision ?? 0, selection); setSelectedSnapshot(saved.snapshotId); setTab("results"); setNotice("Input snapshot saved."); })}>{busy ? "Saving…" : "Save input snapshot"}</button>}</div>
        </>}
        {tab === "results" && <><div className="q-topline"><h3>Returned outputs</h3><span className="q-note">{resultCount} result {resultCount === 1 ? "record" : "records"}</span></div>
          {records?.results.length ? records.results.map(r => { const s = records.snapshots.find(v => v.id === r.snapshotId)!; return <article className="q-record" key={r.id}><strong>{s.label} · {r.reference}</strong><p>{r.receptorId} · {r.trialId} · TEDE {show(r.dose)} {r.unit} · {show(r.integrationSeconds)} s</p><small>Value transcribed from the output file</small><details><summary>Output and linked inputs</summary><p className="q-note">{r.file.filename} · OpenRC {r.version}</p><p className="q-note">{s.categoryId}: {s.inventoryCount} nuclides · {s.receptorCount} receptors · {s.trialCount} weather records · {s.reviewItems} review items retained</p><div className="q-actions"><button className="posnav__btn posnav__btn--sm" type="button" disabled={!actions} onClick={() => { setOutputId(outputId === r.id ? "" : r.id); setOutputOffset(0); }}>View original output</button><button className="posnav__btn posnav__btn--sm" type="button" onClick={() => inspect(s.id)}>View linked inputs</button></div></details>{outputId === r.id && <><RemoteStatus remote={output} />{output.data && <TextPage page={output.data} onChange={setOutputOffset} label="Original returned output" />}</>}</article>; }) : <p className="q-empty">No returned results imported.</p>}
          {!snapshotCount ? <button className="posnav__btn posnav__btn--sm" type="button" onClick={() => inspect("")}>Review prepared inputs</button> : editable ? <form className="q-result-form" onSubmit={e => { e.preventDefault(); if (!canSaveResult || !resultValid.success) return; void work(async () => { await actions!.saveResult(records!.revision, resultValid.data, draft.file!); setResultDraft(undefined); if (upload.current) upload.current.value = ""; setNotice("Linked result saved."); }); }}>
            <h3>Import an output</h3><SnapshotChoice label="Calculation input snapshot" value={snapshotId} disabled={busy} onChange={next => { setSelectedSnapshot(next); updateDraft({ snapshotId: next, receptorId: "", trialId: "", confirmed: false }); }} />
            <div className="q-file-picker"><div><strong>OpenRC output file</strong><span className="q-note">{draft.file?.name ?? "No file selected"}</span><span className="q-note">.txt · .out · .log · .csv · .dat</span></div><button type="button" className="posnav__btn posnav__btn--sm" disabled={busy || !actions} onClick={() => upload.current?.click()}>{draft.file ? <RCIcon.Refresh /> : <RCIcon.Plus />}{draft.file ? "Replace file" : "Upload file"}</button><input ref={upload} type="file" hidden aria-label="OpenRC output file" accept=".txt,.out,.log,.csv,.dat" disabled={busy || !actions} onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!file.size || file.size > 15 * 1024 * 1024 || !/\.(txt|out|log|csv|dat)$/i.test(file.name)) { setError("Choose a nonempty .txt, .out, .log, .csv or .dat output up to 15 MB."); e.target.value = ""; return; } updateDraft({ file, confirmed: false }); }} /></div>
            {draft.file && <div className="q-file-view"><strong>{draft.file.name}</strong>{previewError ? <p className="q-error" role="alert">{previewError}</p> : previewLines ? <TextPage page={{ text: previewLines.slice(previewOffset, previewOffset + 8).join("\n"), offset: previewOffset, total: previewLines.length }} onChange={setPreviewOffset} label="Selected output preview" /> : <p className="q-note" role="status">Reading output…</p>}</div>}
            <p className="q-note">Enter the TEDE value from the selected output file. The workbook stores the file and transcription together.</p>
            <div className="q-fields"><IdChoice kind="receptors" snapshotId={snapshotId} value={draft.receptorId} disabled={busy || !actions} onChange={receptorId => updateDraft({ receptorId })} /><IdChoice kind="weather" snapshotId={snapshotId} value={draft.trialId} disabled={busy || !actions} onChange={trialId => updateDraft({ trialId })} />
              <label className="q-dose-field">Total effective dose equivalent (TEDE)<input className="posfield__input posmono" type="number" required min={0} step="any" value={draft.doseText} disabled={busy || !actions} onChange={e => updateDraft({ doseText: e.target.value })} onBlur={() => { if (draft.doseText.trim() && Number.isFinite(Number(draft.doseText))) updateDraft({ doseText: show(Number(draft.doseText)) }); }} /></label>
              <label className="q-unit-field">Dose unit<select className="posfield__select" aria-label="Dose unit" value={draft.unit} disabled={busy || !actions} onChange={e => updateDraft({ unit: e.target.value as RcLinkedResultValues["unit"] })}>{["Sv", "mSv", "µSv"].map(v => <option key={v}>{v}</option>)}</select></label>
              <label>OpenRC version / build reference<input className="posfield__input posmono" required maxLength={255} value={draft.version} disabled={busy || !actions} onChange={e => updateDraft({ version: e.target.value })} /></label>
              <label>Calculation reference<input className="posfield__input posmono" required maxLength={255} value={draft.reference} disabled={busy || !actions} onChange={e => updateDraft({ reference: e.target.value })} /></label></div>
            <label className="q-check-label"><input type="checkbox" checked={draft.confirmed} disabled={busy || !actions} onChange={e => updateDraft({ confirmed: e.target.checked })} /><span>This output was calculated using the selected input snapshot.</span></label>
            <div className="q-footer"><div className="q-actions">{resultDraft && <button className="posnav__btn posnav__btn--sm" type="button" disabled={busy} onClick={() => { setResultDraft(undefined); if (upload.current) upload.current.value = ""; setError(""); }}>Discard result draft</button>}</div><button type="submit" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={busy || !actions || !canSaveResult}>{busy ? "Saving…" : "Save linked result"}</button></div>
          </form> : <div className="q-footer"><button className="posnav__btn posnav__btn--sm" type="button" onClick={() => inspect(records!.snapshots[0].id)}>Inspect saved inputs</button></div>}
        </>}
      </div>
      {dirty && tab !== "results" && <p className="q-note" role="status">Steps 01 to 05 contain unsaved edits. Save or discard them in their sections before saving a snapshot.</p>}
      {error && <p className="q-error" role="alert">{error}</p>}{notice && <p className="q-note" role="status">{notice}</p>}
    </section>
  </div>;
}
