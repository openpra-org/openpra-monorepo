import { useEffect, useRef, useState, type JSX } from "react";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import { RcSourceTermReview } from "./rcSourceTermReview";

const message = (error: unknown) => error instanceof Error ? error.message : "Could not save source data";

export function RcSourceTermImport({ category, onImported, disabled = false, compact = false }: { category: ReleaseCategoryInputs; onImported?: () => void; disabled?: boolean; compact?: boolean }): JSX.Element | null {
  const { editable, sourceTerms } = useRcWorkbook();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  if (!editable || !sourceTerms) return null;
  return <div>
    <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
      {category.sourceTerm?.originalFile ? <RCIcon.Refresh /> : <RCIcon.Plus />} {busy ? "Importing…" : compact ? category.sourceTerm?.originalFile ? "Replace file" : "Import file" : "Import source-term file"}
    </button>
      <WorkbookInput ref={input} type="file" hidden accept=".inp,.txt,.dat,text/plain" disabled={busy || disabled}
        aria-label="Import source-term file" onChange={async (event) => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (!file) return;
          setBusy(true); setError("");
          try { await sourceTerms.importFile(category.releaseCategory, category.sourceTerm?.revision ?? 0, file); onImported?.(); }
          catch (failure) { setError(message(failure)); }
          finally { setBusy(false); }
        }} />
    {error && <p className="pws-status pws-status--error" role="alert">{error}</p>}
  </div>;
}

/** Shared source fields; the MS interface opts into the inline layout. */
export function RcSourceTermEditor({ category, inline = false }: { category: ReleaseCategoryInputs; inline?: boolean }): JSX.Element {
  const { editable, sourceTerms, sourceTermDrafts, setSourceTermDraft } = useRcWorkbook();
  const source = category.sourceTerm;
  const draft = Object.prototype.hasOwnProperty.call(sourceTermDrafts, category.releaseCategory) ? sourceTermDrafts[category.releaseCategory] : undefined;
  const [values, setValues] = useState<RcSourceTermValues>(() => draft?.values ?? source?.values ?? { groups: [], inventory: [], releases: [] });
  const [baseRevision, setBaseRevision] = useState(draft?.baseRevision ?? source?.revision ?? 0);
  const [active, setActive] = useState(Boolean(source || draft));
  const [inventoryPage, setInventoryPage] = useState(0);
  const [part, setPart] = useState("inventory");
  const [segment, setSegment] = useState(0);
  const [dirty, setDirty] = useState(Boolean(draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previousDraft = useRef(draft);
  useEffect(() => {
    if (draft === previousDraft.current) return;
    previousDraft.current = draft;
    // The MS panel and category drawer can both display this category.
    if (draft) {
      setValues(draft.values); setBaseRevision(draft.baseRevision); setDirty(true); setActive(true);
    } else if (dirty) {
      setValues(source?.values ?? { groups: [], inventory: [], releases: [] });
      setBaseRevision(source?.revision ?? 0); setDirty(false); setError("");
    }
  }, [draft, source, dirty]);
  useEffect(() => {
    if (!dirty && source) {
      setValues(source.values); setBaseRevision(source.revision); setActive(true);
    }
  }, [source, dirty]);
  const dis = !editable || !sourceTerms || busy;
  const edit = (next: RcSourceTermValues) => {
    setValues(next); setDirty(true); setError("");
    setSourceTermDraft(category.releaseCategory, { baseRevision, values: next });
  };
  const pageCount = Math.max(1, Math.ceil(values.inventory.length / 10));
  const pageIndex = Math.min(inventoryPage, pageCount - 1);
  const number = (value: string): number => value.trim() === "" ? Number.NaN : Number(value);
  const shown = (value: number | undefined): number | string => {
    if (value === undefined || Number.isNaN(value)) return "";
    return value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < 1e-3) ? value.toExponential() : value;
  };
  const release = values.releases[segment];
  const missing = values.releases.reduce((sum, r) => sum + [r.startSeconds, r.durationSeconds, r.heightMetres].filter((v) => v === undefined).length, 0);
  const addGroup = () => edit({ ...values,
    groups: [...values.groups, { id: Math.max(0, ...values.groups.map((g) => g.id)) + 1, name: "" }],
    releases: values.releases.map((r) => ({ ...r, fractions: [...r.fractions, 0] })),
  });
  const save = async () => {
    const parsed = RcSourceTermValuesSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")); return; }
    if (!sourceTerms) return;
    setBusy(true); setError("");
    try {
      const result = await sourceTerms.saveValues(category.releaseCategory, baseRevision, parsed.data);
      setValues(result.sourceTerm!.values); setBaseRevision(result.sourceTerm!.revision); setDirty(false);
      setSourceTermDraft(category.releaseCategory, undefined);
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };
  if (inline) return <RcSourceTermReview category={category} values={values} active={active} disabled={dis} dirty={dirty}
    error={source && source.revision !== baseRevision && dirty ? "Source data changed. Discard these edits to load the latest values." : error}
    canSave={!dis && dirty && (source?.revision ?? 0) === baseRevision}
    importControl={<RcSourceTermImport category={category} disabled={dirty || busy} compact />}
    edit={edit} onEnter={() => setActive(true)} onSave={() => { void save(); }} onError={setError}
    onDiscard={() => { setValues(source?.values ?? { groups: [], inventory: [], releases: [] }); setBaseRevision(source?.revision ?? 0); setDirty(false); setError(""); setSourceTermDraft(category.releaseCategory, undefined); }} />;
  return <div className="posfield rc-source-editor">
    <div className="posfield__label">Source data</div>
    {!active ? <>
      <p className="posmuted">No source data.</p>
      <RcSourceTermImport category={category} />
      {editable && sourceTerms && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setActive(true)}>Enter source data</button>}
    </> : <>
      {source?.originalFile && <button type="button" className="posnav__btn posnav__btn--sm rc-source-editor__file-button" disabled={!sourceTerms}
        onClick={() => { void sourceTerms?.downloadOriginal(source.originalFile!.documentId).catch((failure) => setError(message(failure))); }}>
        <RCIcon.Download /> Original: {source.originalFile.filename}
      </button>}
      <label className="posfield__label" htmlFor="rc-source-part">Input table</label>
      <select id="rc-source-part" className="posfield__select" value={part} onChange={(e) => setPart(e.target.value)}>
        <option value="inventory">Inventory (Bq)</option><option value="segments">Release segments (s, m)</option><option value="fractions">Release fractions by group</option>
      </select>
      {part === "inventory" && <>
        {!values.groups.length && editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={dis} onClick={() => { addGroup(); setPart("fractions"); }}>Add chemical group</button>}
        <div style={{ overflowX: "auto" }}><table className="postable" style={{ minWidth: 560 }}>
          <thead><tr><th>Nuclide</th><th>Activity (Bq)</th><th>Group</th>{editable && <th />}</tr></thead>
          <tbody>{values.inventory.slice(pageIndex * 10, (pageIndex + 1) * 10).map((n, offset) => {
            const i = pageIndex * 10 + offset;
            return <tr key={i}>
            <td><WorkbookInput aria-label={`Nuclide ${i + 1}`} className="posfield__input posmono" value={n.name} disabled={dis}
              onChange={(e) => edit({ ...values, inventory: values.inventory.map((row, j) => i === j ? { ...row, name: e.target.value } : row) })} /></td>
            <td><WorkbookInput aria-label={`Activity ${n.name || i + 1} (Bq)`} className="posfield__input posmono" type="number" step="any" min="0" value={shown(n.activityBq)} disabled={dis}
              onChange={(e) => edit({ ...values, inventory: values.inventory.map((row, j) => i === j ? { ...row, activityBq: number(e.target.value) } : row) })} /></td>
            <td><select aria-label={`Group for ${n.name || i + 1}`} className="posfield__select" value={n.group} disabled={dis}
              onChange={(e) => edit({ ...values, inventory: values.inventory.map((row, j) => i === j ? { ...row, group: Number(e.target.value) } : row) })}>
              {values.groups.map((g) => <option key={g.id} value={g.id}>{g.id}: {g.name}</option>)}
            </select></td>
            {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" disabled={dis} aria-label={`Remove nuclide ${i + 1}`} onClick={() => edit({ ...values, inventory: values.inventory.filter((_, j) => i !== j) })}>Remove</button></td>}
          </tr>; })}</tbody>
        </table></div>
        {pageCount > 1 && <div className="rc-source-editor__pagination">
          <span>{pageIndex * 10 + 1}–{Math.min((pageIndex + 1) * 10, values.inventory.length)} of {values.inventory.length}</span>
          <div className="rc-source-editor__actions">
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={pageIndex === 0} onClick={() => setInventoryPage(pageIndex - 1)}>Previous nuclides</button>
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={pageIndex === pageCount - 1} onClick={() => setInventoryPage(pageIndex + 1)}>Next nuclides</button>
          </div>
        </div>}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={dis || !values.groups.length} onClick={() => { edit({ ...values, inventory: [...values.inventory, { name: "", activityBq: Number.NaN, group: values.groups[0].id }] }); setInventoryPage(Math.floor(values.inventory.length / 10)); }}><RCIcon.Plus /> Add nuclide</button>}
      </>}
      {part === "segments" && <>
        <div style={{ overflowX: "auto" }}><table className="postable" style={{ minWidth: 600 }}>
          <thead><tr><th>Segment</th><th>Start (s)</th><th>Duration (s)</th><th>Height (m)</th>{editable && <th />}</tr></thead>
          <tbody>{values.releases.map((r, i) => <tr key={r.id}>
            <td>{r.id}</td>
            {(["startSeconds", "durationSeconds", "heightMetres"] as const).map((key, k) => <td key={key}>
              <WorkbookInput aria-label={`${["Start", "Duration", "Height"][k]} for segment ${r.id}`} className="posfield__input posmono" type="number" step="any" min="0" value={shown(r[key])} disabled={dis}
                onChange={(e) => edit({ ...values, releases: values.releases.map((row, j) => i === j ? { ...row, [key]: e.target.value === "" ? undefined : Number(e.target.value) } : row) })} />
            </td>)}
            {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" disabled={dis} aria-label={`Remove segment ${r.id}`} onClick={() => { edit({ ...values, releases: values.releases.filter((_, j) => i !== j) }); setSegment(0); }}>Remove</button></td>}
          </tr>)}</tbody>
        </table></div>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={dis} onClick={() => edit({ ...values, releases: [...values.releases, { id: Math.max(0, ...values.releases.map((r) => r.id)) + 1, fractions: values.groups.map(() => 0) }] })}><RCIcon.Plus /> Add segment</button>}
      </>}
      {part === "fractions" && <>
        <label className="posfield__label" htmlFor="rc-source-segment">Release segment</label>
        <select id="rc-source-segment" className="posfield__select" value={segment} disabled={!values.releases.length} onChange={(e) => setSegment(Number(e.target.value))}>
          {!values.releases.length && <option value={0}>Add a release segment first</option>}
          {values.releases.map((r, i) => <option key={r.id} value={i}>Segment {r.id}</option>)}
        </select>
        <div style={{ overflowX: "auto" }}><table className="postable" style={{ minWidth: 600 }}>
          <thead><tr><th>Group</th><th>Name</th><th>Fraction (0–1)</th><th>Total</th>{editable && <th />}</tr></thead>
          <tbody>{values.groups.map((g, i) => <tr key={g.id}>
            <td>{g.id}</td>
            <td><WorkbookInput aria-label={`Name of group ${g.id}`} className="posfield__input" value={g.name} disabled={dis}
              onChange={(e) => edit({ ...values, groups: values.groups.map((row, j) => i === j ? { ...row, name: e.target.value } : row) })} /></td>
            <td><WorkbookInput aria-label={`Fraction for ${g.name || g.id} in segment ${release?.id ?? "none"}`} className="posfield__input posmono" type="number" step="any" min="0" max="1" value={shown(release?.fractions[i])} disabled={dis || !release}
              onChange={(e) => edit({ ...values, releases: values.releases.map((row, j) => j === segment ? { ...row, fractions: row.fractions.map((v, k) => k === i ? number(e.target.value) : v) } : row) })} /></td>
            <td className="posmono">{values.releases.reduce((sum, r) => sum + (r.fractions[i] ?? 0), 0).toPrecision(5)}</td>
            {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" disabled={dis || values.inventory.some((n) => n.group === g.id)} aria-label={`Remove group ${g.id}`}
              onClick={() => edit({ ...values, groups: values.groups.filter((_, j) => i !== j), releases: values.releases.map((r) => ({ ...r, fractions: r.fractions.filter((_, j) => i !== j) })) })}>Remove</button></td>}
          </tr>)}</tbody>
        </table></div>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={dis} onClick={addGroup}><RCIcon.Plus /> Add group</button>}
      </>}
      {missing > 0 && <p className="posmuted" role="status">{missing} missing segment values. Enter them under Release segments.</p>}
      {dirty && <p className="posmuted" role="status">Unsaved source data — save to commit these edits.</p>}
      {source && source.revision !== baseRevision && dirty && <p className="pws-status pws-status--error" role="alert">Source data changed. Discard these edits to load the latest values.</p>}
      {error && <p className="pws-status pws-status--error" role="alert">{error}</p>}
      {editable && <div className="rc-source-editor__actions rc-source-editor__footer">
        <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={dis || !dirty || (source?.revision ?? 0) !== baseRevision} onClick={() => { void save(); }}>{busy ? "Saving…" : "Save source data"}</button>
        <button type="button" className="posnav__btn posnav__btn--sm" disabled={dis || !dirty} onClick={() => { setValues(source?.values ?? { groups: [], inventory: [], releases: [] }); setBaseRevision(source?.revision ?? 0); setDirty(false); setError(""); setSourceTermDraft(category.releaseCategory, undefined); }}>Discard edits</button>
      </div>}
    </>}
  </div>;
}
