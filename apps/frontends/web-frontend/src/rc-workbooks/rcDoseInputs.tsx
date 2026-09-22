import { useEffect, useId, useRef, useState, type JSX } from "react";
import type { RcDoseFile, RcDoseFilePage, RcDosePathway, RcDoseRecord, RcDoseSettings } from "interfaces-mef-types/rc/dose-inputs";
import type { RcResponseCalculationResult } from "interfaces-mef-types/rc/early-response-calculation";
import { RcDoseSettingsSchema } from "interfaces-mef-types/zod/rc/dose-inputs";
import { doseCoverage, dosePathwayNames, dosePathways, inhalationRecordLabel } from "interfaces-shared-types/rc-workbooks/dose-inputs";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcDoseInputs.css";
type Tab = "exposure" | "coefficients" | "response";
type Kind = "exposure" | RcDosePathway;
const message = (e: unknown) => e instanceof Error ? e.message : "Could not update dose inputs";
const scientific = (n: number) => n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3);
const show = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "Not supplied" : scientific(n) ? n.toExponential() : String(Number(n.toPrecision(7)));
const inputValue = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? "" : scientific(n) ? n.toExponential() : n;
const words = (value: string | undefined) => value ? value.toLowerCase().replace(/_/g, " ") : "Not recorded";
const title = (value: string) => words(value).replace(/\b\w/g, letter => letter.toUpperCase());
interface RcDosePanelProps {
  onAddPathway?: () => void;
  canAddPathway?: boolean;
  onEditPathway?: (index: number) => void;
  onEditTreatment?: () => void;
}
export function RcDosePanel({ onAddPathway, canAddPathway = false, onEditPathway, onEditTreatment }: RcDosePanelProps): JSX.Element {
  const { rc, editable, doseInputs: actions, earlyResponse, doseDrafts, setDoseDraft } = useRcWorkbook();
  const dose = rc.dosimetry, inputs = dose.doseInputs, categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const responseModel = rc.protectiveActionParameters.earlyResponseModel, site = rc.protectiveActionParameters.siteAndReceptors;
  const [categoryId, setCategoryId] = useState(categories[0]?.releaseCategory ?? "");
  const category = categories.find(c => c.releaseCategory === categoryId) ?? categories[0], categoryKey = category?.releaseCategory ?? "", source = category?.sourceTerm;
  const saved = inputs?.categories.find(c => c.categoryId === categoryKey), draft = editable ? doseDrafts[categoryKey] : undefined;
  const settings = draft?.settings ?? saved?.settings, revision = draft?.baseRevision ?? inputs?.revision ?? 0, duration = settings?.integrationSeconds;
  const dirty = Boolean(draft), conflict = dirty && (revision !== (inputs?.revision ?? 0) || draft!.sourceRevision !== source?.revision);
  const reviewed = Boolean(source && saved?.savedForSourceRevision === source.revision && !dirty);
  const [tab, setTab] = useState<Tab>("exposure"), [nuclide, setNuclide] = useState("Cs-137"), [recordIndex, setRecordIndex] = useState<number>();
  const [activity, setActivity] = useState("002"), [blockIndex, setBlockIndex] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [rawFile, setRawFile] = useState<RcDoseFile>(), [rawOffset, setRawOffset] = useState(0), [raw, setRaw] = useState<RcDoseFilePage>(), [rawLoading, setRawLoading] = useState(false), [rawError, setRawError] = useState("");
  const [records, setRecords] = useState<Partial<Record<RcDosePathway, RcDoseRecord[]>>>({}), [recordLoading, setRecordLoading] = useState(false), [recordError, setRecordError] = useState(""), [retry, setRetry] = useState(0);
  const [responseFile, setResponseFile] = useState(""), [responseResult, setResponseResult] = useState<RcResponseCalculationResult>(), [responseError, setResponseError] = useState("");
  const input = useRef<HTMLInputElement>(null), responseInput = useRef<HTMLInputElement>(null), importKind = useRef<Kind>("exposure"), tabs = useRef<HTMLDivElement>(null), id = useId();
  const names = source?.values.inventory.map(n => n.name) ?? [], selectedNuclide = names.includes(nuclide) ? nuclide : names[0];
  const inhalation = records.inhalation ?? [], selectedRecord = inhalation.find(r => r.index === recordIndex) ?? inhalation.find(r => r.inhalation?.ageDays === 7300 && r.inhalation.absorption === "F" && r.inhalation.let === "L") ?? inhalation[0];
  const fileKey = inputs?.libraries.map(l => `${l.kind}:${l.file.documentId}`).join("|") ?? "";
  const reference = saved?.exposure?.data.blocks[blockIndex] ?? saved?.exposure?.data.blocks[0];
  const disabled = !editable || !actions || busy;
  useEffect(() => { setRawFile(undefined); setBlockIndex(0); setError(""); setRecordIndex(undefined); }, [categoryKey, source?.revision]);
  useEffect(() => { setResponseFile(""); setResponseResult(undefined); setResponseError(""); }, [categoryKey, rc.protectiveActionParameters.earlyResponseModel?.revision, rc.protectiveActionParameters.siteAndReceptors?.revision, saved?.settings?.integrationSeconds]);
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
  const editDuration = (value: string) => { setDoseDraft(categoryKey, { baseRevision: revision, sourceRevision: draft?.sourceRevision ?? source?.revision ?? 0, settings: { integrationSeconds: value === "" ? NaN : Number(value), basis: "analyst" } }); setError(""); };
  const work = async (fn: () => Promise<unknown>) => { setBusy(true); setError(""); try { await fn(); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  const viewButton = (file: RcDoseFile) => <button type="button" className="posnav__btn posnav__btn--sm" disabled={!actions} onClick={() => { setRawFile(rawFile?.documentId === file.documentId ? undefined : file); setRawOffset(0); }}><RCIcon.Eye /> {rawFile?.documentId === file.documentId ? "Hide file" : "View file"}</button>;
  const uploadButton = (kind: Kind, exists: boolean) => editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || dirty || kind === "exposure" && !source} aria-label={`${exists ? "Replace" : "Import"} ${kind} file`} onClick={() => { importKind.current = kind; input.current?.click(); }}>{exists ? <RCIcon.Refresh /> : <RCIcon.Plus />} {exists ? "Replace file" : "Import file"}</button>;
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
  const calculateResponse = async (file: File) => {
    setResponseError(""); setResponseResult(undefined);
    if (!earlyResponse || !saved?.settings || !responseModel || !site) { setResponseError("Save the Step 02 response and site, then the Step 05 integration time."); return; }
    try {
      setBusy(true);
      const result = await earlyResponse.calculate(categoryKey, file);
      setResponseFile(file.name); setResponseResult(result);
    } catch (e) { setResponseError(message(e)); } finally { setBusy(false); }
  };
  return <div className="poscard rc-dose-input-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Dosimetry inputs" level={3} /></div>
    <section className="rc-dose" aria-label="Dosimetry inputs">
      <label className="ds-category">Release category<select className="posfield__select" aria-label="Dose release category" disabled={busy || dirty || !categories.length} value={categoryKey} onChange={e => setCategoryId(e.target.value)}>{!categories.length && <option value="">No release category yet</option>}{categories.map(c => <option key={c.releaseCategory} value={c.releaseCategory}>{c.releaseCategory}{c.sourceTermDefinitionRef ? ` · ${c.sourceTermDefinitionRef}` : ""}</option>)}</select></label>
      <div className="ds-tabs" role="tablist" aria-label="Dose inputs" ref={tabs} onKeyDown={e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault();
        const order: Tab[] = ["exposure", "coefficients", "response"], index = order.indexOf(tab);
        const next = e.key === "Home" ? order[0] : e.key === "End" ? order[2] : order[(index + (e.key === "ArrowRight" ? 1 : 2)) % order.length];
        setTab(next); setRawFile(undefined); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[order.indexOf(next)]?.focus();
      }}>{(["exposure", "coefficients", "response"] as const).map(t => <button key={t} type="button" id={`${id}-${t}`} role="tab" aria-selected={tab === t} aria-controls={`${id}-panel`} tabIndex={tab === t ? 0 : -1} onClick={() => { setTab(t); setRawFile(undefined); }}>{t === "exposure" ? "Exposure model" : t === "coefficients" ? "Dose coefficients" : "Protective response"}</button>)}</div>
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
          <div className="ds-section-title"><h3>Exposure period</h3></div><div className="ds-file"><div className="ds-file-info"><span className="ds-small">Exposure settings file</span><strong>{saved?.exposure?.file.filename ?? "No file selected"}</strong><span className="ds-small">.inp · .txt</span></div><div className="ds-file-actions">{uploadButton("exposure", Boolean(saved?.exposure))}{saved?.exposure && viewButton(saved.exposure.file)}</div></div>{fileView()}
          <div className="ds-fields ds-duration-fields"><label>Integration time (s)<WorkbookInput className="posfield__input posmono" key={categoryKey} aria-label="Integration time (s)" type="number" min={0} max={1e12} step="any" value={inputValue(duration)} disabled={disabled || !source} onChange={e => editDuration(e.target.value)} /></label></div>
          {settings && <div className="ds-value-basis"><span>Basis</span><strong>{settings.basis === "imported" ? "Imported file" : "Analyst value"}</strong></div>}
          {!source && <p className="ds-note">No Step 01 source inventory.</p>}
          {reference && <><div className="ds-section-title"><h3>Imported activity factors</h3></div><div className="ds-fields">{saved!.exposure!.data.blocks.length > 1 && <label className="ds-exposure-block">Exposure block<select className="posfield__select" aria-label="Exposure block" value={blockIndex} onChange={e => setBlockIndex(Number(e.target.value))}>{saved!.exposure!.data.blocks.map((b, i) => <option key={b.index} value={i}>Block {i + 1}</option>)}</select></label>}
            <label className="ds-activity-record">Activity record<select className="posfield__select" aria-label="MACCS activity record" value={activity} onChange={e => setActivity(e.target.value)}><option value="001">001 · Evacuation</option><option value="002">002 · Normal activity</option><option value="003">003 · Sheltering</option></select></label></div>
            {reviewTable("Imported activity factors", ([['BRRATE', 'Breathing rate', ' m³/s'], ['CSFACT', 'Cloudshine multiplier', ''], ['GSHFAC', 'Groundshine multiplier', ''], ['PROTIN', 'Inhalation multiplier', '']] as const).map(([key, label, unit]) => ({ label, value: `${show(reference.records[`SE${key}${activity}`])}${reference.records[`SE${key}${activity}`] !== undefined ? unit : ""}` })))}
          </>}
        </> : tab === "coefficients" ? <><div className="ds-section-title"><h3>Coefficient libraries</h3></div><ul className="ds-library">{dosePathways.map(kind => { const library = inputs?.libraries.find(l => l.kind === kind), coverage = doseCoverage(inputs, source?.values, kind), extensions = kind === "inhalation" ? ".hdb · .txt" : ".ext · .txt"; return <li key={kind}><div className="ds-file-info"><strong>{dosePathwayNames[kind]}</strong><span className="ds-small">{library?.file.filename ?? "No file selected"}</span><span className="ds-small">{extensions}</span>{library && <span className="ds-small">{coverage.found.length} of {coverage.total} inventory isotopes · {library.recordCount} records</span>}</div><div className="ds-file-actions">{uploadButton(kind, Boolean(library))}{library && viewButton(library.file)}</div></li>; })}</ul>{fileView()}
          {!names.length ? <p className="ds-empty">No Step 01 source inventory.</p> : <><div className="ds-section-title"><h3>Inspect coefficients by radionuclide</h3></div><div className="ds-fields"><label>Step 01 radionuclide<select className="posfield__select" aria-label="Step 01 radionuclide" value={selectedNuclide} onChange={e => { setNuclide(e.target.value); setRecordIndex(undefined); }}>{names.map(n => <option key={n}>{n}</option>)}</select></label>{inhalation.length > 1 ? <label>Inhalation record<select className="posfield__select" aria-label="Inhalation record" value={selectedRecord?.index ?? ""} onChange={e => setRecordIndex(Number(e.target.value))}>{inhalation.map(r => <option key={r.index} value={r.index}>{inhalationRecordLabel(r)}</option>)}</select></label> : <div className="ds-duration-equivalent">{selectedRecord ? inhalationRecordLabel(selectedRecord) : recordLoading ? "Loading records…" : "No inhalation record in this file"}</div>}</div>
            {recordError && <p className="ds-error" role="alert">{recordError} <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
            <table className="ds-coef-table" aria-label="Dose coefficients"><thead><tr><th>Pathway / file field</th><th>Coefficient</th><th>Units</th></tr></thead><tbody>{dosePathways.map(kind => <tr key={kind}><td>{dosePathwayNames[kind]}<small>{kind === "inhalation" ? <><i>e</i><sub>50</sub></> : <>H<sub>E</sub></>} in file</small></td><td>{recordLoading ? "Loading…" : (kind === "inhalation" ? selectedRecord : records[kind]?.[0])?.value ?? "Not supplied"}</td><td>{kind === "inhalation" ? "Sv/Bq" : kind === "cloudshine" ? "Sv·m³/(Bq·s)" : "Sv·m²/(Bq·s)"}</td></tr>)}</tbody></table>
            {selectedRecord?.inhalation && <details><summary>Inhalation record details</summary><dl className="ds-readonly"><div><dt>Age at intake</dt><dd>{selectedRecord.inhalation.ageDays} days</dd></div><div><dt>AMAD · particle size</dt><dd>{selectedRecord.inhalation.amadMicrometres} µm</dd></div><div><dt>Absorption into blood</dt><dd>{({ F: "F · fast", M: "M · moderate", S: "S · slow", G: "G · gas", V: "V · vapor" } as Record<string, string>)[selectedRecord.inhalation.absorption]}</dd></div><div><dt>Radiation component records</dt><dd>{selectedRecord.inhalation.components === 2 ? selectedRecord.inhalation.highLet ? "L + H · low and high LET" : "L present · H companion not supplied" : selectedRecord.inhalation.let === "L" ? "L · low LET" : "H · high LET"}</dd></div><div><dt>f1 · gastrointestinal uptake fraction</dt><dd>{selectedRecord.inhalation.f1}</dd></div></dl>
              <pre>{[selectedRecord.raw, selectedRecord.inhalation.highLet?.raw].filter(Boolean).join("\n")}</pre>
            </details>}
            <details><summary>Check coefficient coverage against Step 01</summary><table aria-label="Coefficient coverage"><thead><tr><th>Pathway</th><th>Names found</th><th>Names without records</th></tr></thead><tbody>{dosePathways.map(kind => { const c = doseCoverage(inputs, source?.values, kind); return <tr key={kind}><td>{dosePathwayNames[kind]}</td><td>{c.found.length} / {c.total}</td><td>{c.missing.join(", ") || "None"}</td></tr>; })}</tbody></table></details>
          </>}
        </> : <><div className="ds-file"><div className="ds-file-info"><span className="ds-small">Unprotected dose-rate file</span><strong>{responseFile || "No file selected"}</strong><span className="ds-small">.json</span></div><div className="ds-file-actions"><button type="button" className="posnav__btn posnav__btn--sm" disabled={busy || !responseModel || !site || !saved?.settings} onClick={() => responseInput.current?.click()}>
            {responseFile ? <RCIcon.Refresh /> : <RCIcon.Plus />} {responseFile ? "Replace file" : "Choose file"}</button><input ref={responseInput} type="file" accept=".json" hidden disabled={busy || !responseModel || !site || !saved?.settings} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void calculateResponse(file); }} /></div></div>
          <div className="ds-section-title"><h3>Calculation inputs</h3></div>{reviewTable("Protective response inputs", [
            { label: "Step 02 response model", value: responseModel ? `Revision ${responseModel.revision} · ${responseModel.cohorts.length} cohorts` : "Not saved" },
            { label: "Step 02 site grid", value: site?.geometry?.kind === "cells" ? `${site.geometry.radiiKm.length} bands · ${site.geometry.sectors} sectors` : "Radial grid needed" },
            { label: "Step 05 integration time", value: saved?.settings ? `${show(saved.settings.integrationSeconds)} s` : "Not saved" },
          ])}
          {responseError && <p className="ds-error" role="alert">{responseError}</p>}
          {responseResult && <>{responseResult.issues.length ? <p className="ds-error" role="alert">{responseResult.issues.join(" ")}</p> : <div className="ds-response-table-wrap"><table aria-label="Calculated response dose"><thead><tr><th>Cohort</th><th>Population</th><th>Weight</th><th>Shelter (s)</th><th>Evacuate (s)</th><th>Relocate (s)</th><th>Cloud (Sv)</th><th>Inhale (Sv)</th><th>Ground (Sv)</th><th>Skin (Sv)</th><th>{responseResult.targetOrgan} total (Sv/person)</th></tr></thead><tbody>{responseResult.cohorts.map(row => <tr key={row.cohortId}><td>{row.cohortName}</td><td>{show(row.population ?? undefined)}</td><td>{responseModel?.population.weighting === "SUMPOP" ? "—" : show(row.resultWeightFraction ?? undefined)}</td><td>{show(row.shelterStartsSeconds ?? undefined)}</td><td>{show(row.evacuationStartsSeconds ?? undefined)}</td><td>{show(row.relocationSeconds ?? undefined)}</td><td>{show(row.doseSv?.cloudshine)}</td><td>{show(row.doseSv?.inhalation)}</td><td>{show(row.doseSv?.groundshine)}</td><td>{show(row.doseSv?.skin)}</td><td>{show(row.doseSv?.total)}</td></tr>)}</tbody></table></div>}</>}
        </>}
      </div>
      {error && <p className="ds-error" role="alert">{error}</p>}{conflict && <p className="ds-error" role="alert">Dose inputs or the source changed. Discard these edits to review the latest values.</p>}
      <footer className="ds-footer">{(busy || dirty) && <span className="ds-status" role="status">{busy ? "Working…" : "Unsaved changes"}</span>}{editable && <div className="ds-file-actions">{dirty && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => { setDoseDraft(categoryKey, undefined); setError(""); }}>Discard edits</button>}<button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={disabled || !source || !RcDoseSettingsSchema.safeParse(settings).success || conflict || reviewed} onClick={() => { if (!actions || !source || !settings) return; void work(async () => { await actions.saveSettings(revision, categoryKey, source.revision, settings); setDoseDraft(categoryKey, undefined); }); }}>Save dose inputs</button></div>}</footer>
      <WorkbookInput ref={input} type="file" hidden accept=".inp,.txt,.hdb,.ext" aria-label="Import dose input file" disabled={disabled || dirty} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file || !actions) return; const kind = importKind.current; await work(async () => { await actions.importFile(kind, revision, file, kind === "exposure" ? categoryKey : undefined, kind === "exposure" ? source?.revision : undefined); setRawFile(undefined); setBlockIndex(0); }); }} />
    </section>
  </div>;
}
