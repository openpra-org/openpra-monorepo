import { useEffect, useId, useRef, useState, type JSX } from "react";
import type { RcDoseFile, RcDoseFilePage, RcDosePathway, RcDoseRecord } from "interfaces-mef-types/rc/dose-inputs";
import { doseCoverage, dosePathwayNames, dosePathways, inhalationRecordLabel } from "interfaces-shared-types/rc-workbooks/dose-inputs";
import { rcMetricDurationText, rcMetricWindowStartLabels } from "interfaces-shared-types/rc-workbooks/metrics";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcDoseInputs.css";
type Tab = "exposure" | "coefficients";
type Kind = "exposure" | RcDosePathway;
const message = (e: unknown) => e instanceof Error ? e.message : "Could not update dose inputs";
const scientific = (n: number) => n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3);
const show = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "Not supplied" : scientific(n) ? n.toExponential() : String(Number(n.toPrecision(7)));
const words = (value: string | undefined) => value ? value.toLowerCase().replace(/_/g, " ") : "Not recorded";
const title = (value: string) => words(value).replace(/\b\w/g, letter => letter.toUpperCase());
interface RcDosePanelProps {
  onAddPathway?: () => void;
  canAddPathway?: boolean;
  onEditPathway?: (index: number) => void;
  onEditTreatment?: () => void;
  onEditMetric?: (id: string) => void;
}
export function RcDosePanel({ onAddPathway, canAddPathway = false, onEditPathway, onEditTreatment, onEditMetric }: RcDosePanelProps): JSX.Element {
  const { rc, editable, doseInputs: actions } = useRcWorkbook();
  const dose = rc.dosimetry, inputs = dose.doseInputs, categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const [categoryId, setCategoryId] = useState(categories[0]?.releaseCategory ?? "");
  const category = categories.find(c => c.releaseCategory === categoryId) ?? categories[0], categoryKey = category?.releaseCategory ?? "", source = category?.sourceTerm;
  const saved = inputs?.categories.find(c => c.categoryId === categoryKey), revision = inputs?.revision ?? 0;
  const reviewed = Boolean(source && saved?.savedForSourceRevision === source.revision);
  const metrics = rc.scope.metrics ?? [], windowed = metrics.filter(metric => metric.window);
  const exposureSeconds = saved?.exposure?.data.integrationSeconds, exposureMatches = exposureSeconds !== undefined && windowed.some(metric => metric.window?.seconds === exposureSeconds);
  const [tab, setTab] = useState<Tab>("exposure"), [nuclide, setNuclide] = useState("Cs-137"), [recordIndex, setRecordIndex] = useState<number>();
  const [activity, setActivity] = useState("002"), [blockIndex, setBlockIndex] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [rawFile, setRawFile] = useState<RcDoseFile>(), [rawOffset, setRawOffset] = useState(0), [raw, setRaw] = useState<RcDoseFilePage>(), [rawLoading, setRawLoading] = useState(false), [rawError, setRawError] = useState("");
  const [records, setRecords] = useState<Partial<Record<RcDosePathway, RcDoseRecord[]>>>({}), [recordLoading, setRecordLoading] = useState(false), [recordError, setRecordError] = useState(""), [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null), importKind = useRef<Kind>("exposure"), tabs = useRef<HTMLDivElement>(null), id = useId();
  const names = source?.values.inventory.map(n => n.name) ?? [], selectedNuclide = names.includes(nuclide) ? nuclide : names[0];
  const inhalation = records.inhalation ?? [], selectedRecord = inhalation.find(r => r.index === recordIndex) ?? inhalation.find(r => r.inhalation?.ageDays === 7300 && r.inhalation.absorption === "F" && r.inhalation.let === "L") ?? inhalation[0];
  const fileKey = inputs?.libraries.map(l => `${l.kind}:${l.file.documentId}`).join("|") ?? "";
  const reference = saved?.exposure?.data.blocks[blockIndex] ?? saved?.exposure?.data.blocks[0];
  const disabled = !editable || !actions || busy;
  useEffect(() => { setRawFile(undefined); setBlockIndex(0); setError(""); setRecordIndex(undefined); }, [categoryKey, source?.revision]);
  useEffect(() => {
    let cancelled = false; setRaw(undefined); setRawError("");
    if (!rawFile || !actions) { setRawLoading(false); return; }
    setRawLoading(true);
    void actions.readOriginal(rawFile.documentId, rawOffset).then(result => { if (!cancelled) setRaw(result); }).catch(e => { if (!cancelled) setRawError(message(e)); }).finally(() => { if (!cancelled) setRawLoading(false); });
    return () => { cancelled = true; };
  }, [rawFile?.documentId, rawOffset, actions, retry]);
  useEffect(() => {
    let cancelled = false; setRecords({}); setRecordError(""); setRecordIndex(undefined);
    if (!actions || !selectedNuclide || tab !== "coefficients" || !inputs?.libraries.length) { setRecordLoading(false); return; }
    setRecordLoading(true);
    void Promise.all(inputs.libraries.map(async l => [l.kind, await actions.readRecords(l.file.documentId, selectedNuclide)] as const))
      .then(result => { if (!cancelled) setRecords(Object.fromEntries(result)); }).catch(e => { if (!cancelled) setRecordError(message(e)); }).finally(() => { if (!cancelled) setRecordLoading(false); });
    return () => { cancelled = true; };
  }, [fileKey, selectedNuclide, actions, retry, tab]);
  const work = async (fn: () => Promise<unknown>) => { setBusy(true); setError(""); try { await fn(); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  const viewButton = (file: RcDoseFile) => <button type="button" className="posnav__btn posnav__btn--sm" disabled={!actions} onClick={() => { setRawFile(rawFile?.documentId === file.documentId ? undefined : file); setRawOffset(0); }}><RCIcon.Eye /> {rawFile?.documentId === file.documentId ? "Hide file" : "View file"}</button>;
  const uploadButton = (kind: Kind, exists: boolean) => editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || kind === "exposure" && !source} aria-label={`${exists ? "Replace" : "Import"} ${kind} file`} onClick={() => { importKind.current = kind; input.current?.click(); }}>{exists ? <RCIcon.Refresh /> : <RCIcon.Plus />} {exists ? "Replace file" : "Import file"}</button>;
  const fileView = () => rawFile && <div className="ds-file-view"><strong>{rawFile.filename}</strong>{rawLoading && <p className="ds-note" role="status">Loading original file…</p>}{rawError && <p className="ds-error" role="alert">{rawError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}{raw && <><pre aria-label="Original dose input">{raw.text}</pre><div className="ds-pagination"><span>Lines {raw.offset + 1} to {Math.min(raw.offset + 6, raw.total)} of {raw.total}</span><div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!raw.offset || rawLoading} onClick={() => setRawOffset(Math.max(0, rawOffset - 6))}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={raw.offset + 6 >= raw.total || rawLoading} onClick={() => setRawOffset(rawOffset + 6)}>Next</button></div></div></>}</div>;
  const included = (value: boolean, detail?: string) => value ? detail?.trim() ? `Included · ${detail}` : "Included" : detail?.trim() ? `Excluded · ${detail}` : "Excluded";
  const pathwayTreatment = (pathway: typeof dose.exposurePathways[number]) => {
    if (!pathway.included) return included(false, pathway.exclusionJustification);
    if (pathway.pathway === "CLOUDSHINE") return included(true, [words(dose.cloudImmersionModel.approach), dose.cloudImmersionModel.description].filter(Boolean).join(" · "));
    if (pathway.pathway === "GROUNDSHINE") return included(true, dose.groundshineIntegration);
    if (pathway.pathway === "SKIN_DEPOSITION") return included(true, dose.skinBetaTreatment);
    if (pathway.pathway === "INHALATION") return included(true, [words(dose.breathingRates.approach), dose.breathingRates.description].filter(Boolean).join(" · "));
    return included(true, [words(dose.ingestionTreatment.approach), dose.ingestionTreatment.description].filter(Boolean).join(" · "));
  };
  const reviewTable = (name: string, items: readonly { label: string; value: string }[]) => <table className="ds-review-table" aria-label={name}><tbody>{items.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.value || "Not recorded"}</td></tr>)}</tbody></table>;
  return <div className="poscard rc-dose-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Dosimetry inputs" level={3} /></div>
    <section className="rc-dose" aria-label="Dosimetry inputs">
      <label className="ds-category">Release category<select className="posfield__select" aria-label="Dose release category" disabled={busy || !categories.length} value={categoryKey} onChange={e => setCategoryId(e.target.value)}>{!categories.length && <option value="">No release category yet</option>}{categories.map(c => <option key={c.releaseCategory} value={c.releaseCategory}>{c.releaseCategory}{c.sourceTermDefinitionRef ? ` · ${c.sourceTermDefinitionRef}` : ""}</option>)}</select></label>
      <div className="ds-tabs" role="tablist" aria-label="Dose inputs" ref={tabs} onKeyDown={e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault();
        const order: Tab[] = ["exposure", "coefficients"], index = order.indexOf(tab);
        const next = e.key === "Home" ? order[0] : e.key === "End" ? order[1] : order[(index + 1) % order.length];
        setTab(next); setRawFile(undefined); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[order.indexOf(next)]?.focus();
      }}>{(["exposure", "coefficients"] as const).map(t => <button key={t} type="button" id={`${id}-${t}`} role="tab" aria-selected={tab === t} aria-controls={`${id}-panel`} tabIndex={tab === t ? 0 : -1} onClick={() => { setTab(t); setRawFile(undefined); }}>{t === "exposure" ? "Exposure model" : "Dose coefficients"}</button>)}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {tab === "exposure" ? <>
          <div className="ds-section-title"><h3>Exposure pathways</h3>{editable && onAddPathway && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!canAddPathway} onClick={onAddPathway}><RCIcon.Plus /> Add pathway</button>}</div>
          <table className="ds-review-table ds-pathway-table" aria-label="Exposure pathways"><tbody>{dose.exposurePathways.map((pathway, index) => <tr key={`${pathway.pathway}:${index}`}><th scope="row">{title(pathway.pathway)}</th><td>{pathwayTreatment(pathway)}</td>{editable && onEditPathway && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onEditPathway(index)}>Edit</button></td>}</tr>)}</tbody></table>
          <div className="ds-section-title"><h3>Dose treatment</h3>{editable && onEditTreatment && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onEditTreatment}><RCIcon.Settings /> Edit treatment</button>}</div>
          {reviewTable("Dose treatment", [
            { label: "Dispersion results", value: dose.dispersionResultsUsed ? "Used" : "Not used" },
            { label: "Exposure-period basis", value: dose.exposurePeriods.map(period => [period.period, period.justification].filter(Boolean).join(" · ")).join("; ") },
            { label: "Cloud immersion", value: [words(dose.cloudImmersionModel.approach), dose.cloudImmersionModel.description].filter(Boolean).join(" · ") },
            { label: "Groundshine integration", value: dose.groundshineIntegration ?? "" },
            { label: "Skin beta", value: dose.skinBetaTreatment ?? "" },
            { label: "Breathing rates", value: [words(dose.breathingRates.approach), dose.breathingRates.description].filter(Boolean).join(" · ") },
            { label: "Ingestion", value: [words(dose.ingestionTreatment.approach), dose.ingestionTreatment.description].filter(Boolean).join(" · ") },
            { label: "Dose coefficients", value: [words(dose.dcf.type), dose.dcf.source].filter(Boolean).join(" · ") },
            { label: "Shielding", value: dose.shieldingConsiderations ?? "" },
            { label: "Occupancy", value: dose.occupancyConsiderations ?? "" },
            { label: "Receptors", value: dose.receptorTypes?.join(", ") ?? "" },
            { label: "Dosimetry models", value: dose.dosimetryModelsUsed ?? "" },
            { label: "Radioactive decay", value: dose.radionuclideDecayConsideration ?? "" },
            { label: "Dose aggregation", value: dose.doseAggregationMethod ?? "" },
            { label: "Parameter uncertainty", value: dose.parameterUncertaintyCharacterization ?? "" },
          ])}
          <div className="ds-section-title"><h3>Exposure windows</h3></div>
          {windowed.length ? <table className="ds-review-table ds-window-table" aria-label="Metric exposure windows"><thead><tr><th scope="col">Metric</th><th scope="col">Window</th><th scope="col">Starts at</th></tr></thead><tbody>{windowed.map(metric => <tr key={metric.id}>
            <th scope="row">{onEditMetric ? <button type="button" className="ds-metric-link" onClick={() => onEditMetric(metric.id)}>{metric.name.trim() || metric.id}</button> : metric.name.trim() || metric.id}</th>
            <td>{metric.window ? rcMetricDurationText(metric.window.seconds) : ""}</td><td>{metric.window ? rcMetricWindowStartLabels[metric.window.start] : ""}</td></tr>)}</tbody></table>
            : <p className="ds-note">No metric has an exposure window yet. Add metrics in Step 01.</p>}
          <div className="ds-file"><div className="ds-file-info"><span className="ds-small">Exposure settings file</span><strong>{saved?.exposure?.file.filename ?? "No file selected"}</strong><span className="ds-small">.inp · .txt</span>{exposureSeconds !== undefined && <span className="ds-small">Covers {rcMetricDurationText(exposureSeconds)}</span>}</div><div className="ds-file-actions">{uploadButton("exposure", Boolean(saved?.exposure))}{saved?.exposure && viewButton(saved.exposure.file)}</div></div>{fileView()}
          {exposureSeconds !== undefined && !exposureMatches && <p className="ds-note">The exposure file covers {rcMetricDurationText(exposureSeconds)}, but no metric uses that window.</p>}
          {!source && <p className="ds-note">No Step 01 source inventory.</p>}
          {reference && <><div className="ds-section-title"><h3>Imported activity factors</h3></div><div className="ds-fields">{saved!.exposure!.data.blocks.length > 1 && <label className="ds-exposure-block">Exposure block<select className="posfield__select" aria-label="Exposure block" value={blockIndex} onChange={e => setBlockIndex(Number(e.target.value))}>{saved!.exposure!.data.blocks.map((b, i) => <option key={b.index} value={i}>Block {i + 1}</option>)}</select></label>}
            <label className="ds-activity-record">Activity record<select className="posfield__select" aria-label="MACCS activity record" value={activity} onChange={e => setActivity(e.target.value)}><option value="001">001 · Evacuation</option><option value="002">002 · Normal activity</option><option value="003">003 · Sheltering</option></select></label></div>
            {reviewTable("Imported activity factors", ([['BRRATE', 'Breathing rate', ' m³/s'], ['CSFACT', 'Cloudshine multiplier', ''], ['GSHFAC', 'Groundshine multiplier', ''], ['PROTIN', 'Inhalation multiplier', '']] as const).map(([key, label, unit]) => ({ label, value: `${show(reference.records[`SE${key}${activity}`])}${reference.records[`SE${key}${activity}`] !== undefined ? unit : ""}` })))}
          </>}
        </> : <><div className="ds-section-title"><h3>Coefficient libraries</h3></div><ul className="ds-library">{dosePathways.map(kind => { const library = inputs?.libraries.find(l => l.kind === kind), coverage = doseCoverage(inputs, source?.values, kind), extensions = kind === "inhalation" ? ".hdb · .txt" : ".ext · .txt"; return <li key={kind}><div className="ds-file-info"><strong>{dosePathwayNames[kind]}</strong><span className="ds-small">{library?.file.filename ?? "No file selected"}</span><span className="ds-small">{extensions}</span>{library && <span className="ds-small">{coverage.found.length} of {coverage.total} inventory isotopes · {library.recordCount} records</span>}</div><div className="ds-file-actions">{uploadButton(kind, Boolean(library))}{library && viewButton(library.file)}</div></li>; })}</ul>{fileView()}
          {!names.length ? <p className="ds-empty">No Step 01 source inventory.</p> : <><div className="ds-section-title"><h3>Inspect coefficients by radionuclide</h3></div><div className="ds-fields"><label>Step 01 radionuclide<select className="posfield__select" aria-label="Step 01 radionuclide" value={selectedNuclide} onChange={e => { setNuclide(e.target.value); setRecordIndex(undefined); }}>{names.map(n => <option key={n}>{n}</option>)}</select></label>{inhalation.length > 1 ? <label>Inhalation record<select className="posfield__select" aria-label="Inhalation record" value={selectedRecord?.index ?? ""} onChange={e => setRecordIndex(Number(e.target.value))}>{inhalation.map(r => <option key={r.index} value={r.index}>{inhalationRecordLabel(r)}</option>)}</select></label> : <div className="ds-duration-equivalent">{selectedRecord ? inhalationRecordLabel(selectedRecord) : recordLoading ? "Loading records…" : "No inhalation record in this file"}</div>}</div>
            {recordError && <p className="ds-error" role="alert">{recordError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
            <table className="ds-coef-table" aria-label="Dose coefficients"><thead><tr><th>Pathway / file field</th><th>Coefficient</th><th>Units</th></tr></thead><tbody>{dosePathways.map(kind => <tr key={kind}><td>{dosePathwayNames[kind]}<small>{kind === "inhalation" ? <><i>e</i><sub>50</sub></> : <>H<sub>E</sub></>} in file</small></td><td>{recordLoading ? "Loading…" : (kind === "inhalation" ? selectedRecord : records[kind]?.[0])?.value ?? "Not supplied"}</td><td>{kind === "inhalation" ? "Sv/Bq" : kind === "cloudshine" ? "Sv·m³/(Bq·s)" : "Sv·m²/(Bq·s)"}</td></tr>)}</tbody></table>
            {selectedRecord?.inhalation && <details><summary>Inhalation record details</summary><dl className="ds-readonly"><div><dt>Age at intake</dt><dd>{selectedRecord.inhalation.ageDays} days</dd></div><div><dt>AMAD · particle size</dt><dd>{selectedRecord.inhalation.amadMicrometres} µm</dd></div><div><dt>Absorption into blood</dt><dd>{({ F: "F · fast", M: "M · moderate", S: "S · slow", G: "G · gas", V: "V · vapor" } as Record<string, string>)[selectedRecord.inhalation.absorption]}</dd></div><div><dt>Radiation component records</dt><dd>{selectedRecord.inhalation.components === 2 ? selectedRecord.inhalation.highLet ? "L + H · low and high LET" : "L present · H companion not supplied" : selectedRecord.inhalation.let === "L" ? "L · low LET" : "H · high LET"}</dd></div><div><dt>f1 · gastrointestinal uptake fraction</dt><dd>{selectedRecord.inhalation.f1}</dd></div></dl>
              <pre>{[selectedRecord.raw, selectedRecord.inhalation.highLet?.raw].filter(Boolean).join("\n")}</pre>
            </details>}
            <details><summary>Check coefficient coverage against Step 01</summary><table aria-label="Coefficient coverage"><thead><tr><th>Pathway</th><th>Names found</th><th>Names without records</th></tr></thead><tbody>{dosePathways.map(kind => { const c = doseCoverage(inputs, source?.values, kind); return <tr key={kind}><td>{dosePathwayNames[kind]}</td><td>{c.found.length} / {c.total}</td><td>{c.missing.join(", ") || "None"}</td></tr>; })}</tbody></table></details>
          </>}
        </>}
      </div>
      {error && <p className="ds-error" role="alert">{error}</p>}
      <footer className="ds-footer">{busy && <span className="ds-status" role="status">Working…</span>}{editable && <div className="ds-file-actions"><button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || !source || reviewed} onClick={() => { if (!actions || !source) return; void work(async () => { await actions.confirm(revision, categoryKey, source.revision); }); }}>{reviewed ? "Dose inputs confirmed" : "Confirm dose inputs"}</button></div>}</footer>
      <WorkbookInput ref={input} type="file" hidden accept=".inp,.txt,.hdb,.ext" aria-label="Import dose input file" disabled={disabled} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file || !actions) return; const kind = importKind.current; await work(async () => { await actions.importFile(kind, revision, file, kind === "exposure" ? categoryKey : undefined, kind === "exposure" ? source?.revision : undefined); setRawFile(undefined); setBlockIndex(0); }); }} />
    </section>
  </div>;
}
