import { useId, useRef, useState, type JSX, type ReactNode } from "react";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";

interface SourceReviewProps {
  category: ReleaseCategoryInputs;
  values: RcSourceTermValues;
  active: boolean;
  disabled: boolean;
  dirty: boolean;
  error: string;
  canSave: boolean;
  importControl: ReactNode;
  edit: (values: RcSourceTermValues) => void;
  onEnter: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onError: (message: string) => void;
}

const shown = (value: number | undefined): number | string =>
  value === undefined || !Number.isFinite(value) ? "" : value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < 1e-3) ? value.toExponential() : value;
const number = (value: string) => value.trim() === "" ? Number.NaN : Number(value);

/** The approved Step 01 review layout, rendered only inside the MS interface. */
export function RcSourceTermReview({ category, values, active, disabled, dirty, error, canSave, importControl, edit, onEnter, onSave, onDiscard, onError }: SourceReviewProps): JSX.Element {
  const { editable, sourceTerms } = useRcWorkbook();
  const [tab, setTab] = useState<"inventory" | "releases">("releases");
  const [segment, setSegment] = useState(0);
  const [page, setPage] = useState(0);
  const [manage, setManage] = useState(false);
  const id = useId(), tabs = useRef<HTMLDivElement>(null);
  const source = category.sourceTerm;
  const index = Math.min(segment, Math.max(0, values.releases.length - 1));
  const release = values.releases[index];
  const pageCount = Math.max(1, Math.ceil(values.inventory.length / 8));
  const pageIndex = Math.min(page, pageCount - 1), offset = pageIndex * 8;
  const validation = dirty ? RcSourceTermValuesSchema.safeParse(values) : undefined;
  const issues = validation && !validation.success ? validation.error.issues.map((issue) => {
    const [section, row, field] = issue.path;
    if (section === "inventory" && typeof row === "number") return `${values.inventory[row]?.name || `Nuclide ${row + 1}`}: ${field === "activityBq" ? "enter a nonnegative activity in Bq" : issue.message}.`;
    if (section === "releases" && typeof row === "number") return `Segment ${values.releases[row]?.id ?? row + 1}: ${field === "fractions" ? "fractions must be between 0 and 1" : issue.message}.`;
    return issue.message;
  }) : [];
  const missing = values.releases.reduce((sum, r) => sum + [r.startSeconds, r.durationSeconds, r.heightMetres].filter(v => v === undefined).length, 0);
  const addGroup = () => edit({ ...values, groups: [...values.groups, { id: Math.max(0, ...values.groups.map(g => g.id)) + 1, name: "" }], releases: values.releases.map(r => ({ ...r, fractions: [...r.fractions, 0] })) });
  const addSegment = () => {
    setSegment(values.releases.length);
    edit({ ...values, releases: [...values.releases, { id: Math.max(0, ...values.releases.map(r => r.id)) + 1, fractions: values.groups.map(() => 0) }] });
  };
  const fractionTable = (start: number, end: number) => <table className="st-fractions" aria-label={`Release fractions, groups ${start + 1} to ${end}`}>
    <thead><tr><th>Chemical group</th><th>Release fraction</th></tr></thead>
    <tbody>{values.groups.slice(start, end).map((g, row) => {
      const i = start + row, fraction = release?.fractions[i];
      const total = values.releases.reduce((sum, r) => sum + (r.fractions[i] ?? 0), 0);
      return <tr key={g.id}><td>{g.name || `Group ${g.id}`}</td><td><WorkbookInput className="posfield__input posmono" type="number" step="any" min="0" max="1"
        aria-label={`Fraction for ${g.name || g.id} in segment ${release?.id ?? "none"}`} value={shown(fraction)} disabled={disabled || !release}
        aria-invalid={release && (!Number.isFinite(fraction) || fraction! < 0 || fraction! > 1 || total > 1.0000001) || undefined}
        onChange={e => edit({ ...values, releases: values.releases.map((r, j) => j === index ? { ...r, fractions: r.fractions.map((f, k) => k === i ? number(e.target.value) : f) } : r) })} /></td></tr>;
    })}</tbody>
  </table>;
  const midpoint = Math.ceil(values.groups.length / 2);
  return <div className="st-review">
    <section className="st-source" aria-label="Source term file">
      <div className="st-source-info"><span className="st-label">Source term file</span>
        <strong>{source?.originalFile?.filename ?? (source ? "Manually entered source term" : "Import inventory and releases together")}</strong>
        <span className="st-caption">.inp · .txt · .dat</span>
      </div>
      <div className="st-file-actions">{importControl}
        {source?.originalFile && <button type="button" className="posnav__btn posnav__btn--sm" disabled={!sourceTerms} onClick={() => {
          void sourceTerms?.downloadOriginal(source.originalFile!.documentId).catch(failure => onError(failure instanceof Error ? failure.message : "Could not open the source file"));
        }}><RCIcon.Eye /> View file</button>}
      </div>
    </section>
    {!active ? <div className="st-empty"><div>Inventory → release segments → group release fractions</div><p>Imported together from one source-term file</p>
      {editable && sourceTerms && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setManage(true); onEnter(); }}>Enter source data</button>}
    </div> : <>
      <div className="st-tabs" role="tablist" aria-label="Source term inputs" ref={tabs} onKeyDown={e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const next = e.key === "Home" ? "inventory" : e.key === "End" ? "releases" : tab === "inventory" ? "releases" : "inventory";
        setTab(next); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[next === "inventory" ? 0 : 1].focus();
      }}>
        {(["inventory", "releases"] as const).map(part => <button key={part} type="button" id={`${id}-${part}`} role="tab" aria-selected={tab === part} aria-controls={`${id}-panel`} tabIndex={tab === part ? 0 : -1} onClick={() => setTab(part)}>
          {part === "inventory" ? "Inventory" : "Releases"} <span>{values[part].length}</span>
        </button>)}
      </div>
      <div className="st-panel" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {tab === "inventory" ? <>
          <div className="st-panel-heading"><h3>Initial inventory</h3></div>
          <table className="st-inventory" aria-label="Radionuclide inventory"><thead><tr><th>Nuclide</th><th>Chemical group</th><th>Activity (Bq)</th></tr></thead>
            <tbody>{values.inventory.slice(offset, offset + 8).map((n, i) => <tr key={offset + i}>
              <td>{n.name || "Unnamed"}</td><td>{values.groups.find(g => g.id === n.group)?.name || "Unassigned"}</td>
              <td><WorkbookInput className="posfield__input posmono" aria-label={`Activity ${n.name || offset + i + 1} (Bq)`} type="number" step="any" min="0" disabled={disabled} value={shown(n.activityBq)} aria-invalid={!Number.isFinite(n.activityBq) || n.activityBq < 0 || undefined}
                onChange={e => edit({ ...values, inventory: values.inventory.map((r, j) => j === offset + i ? { ...r, activityBq: number(e.target.value) } : r) })} /></td>
            </tr>)}</tbody></table>
          <div className="st-pagination"><span>{values.inventory.length ? offset + 1 : 0}–{Math.min(offset + 8, values.inventory.length)} of {values.inventory.length} nuclides</span>
            <div><button type="button" className="posnav__btn posnav__btn--sm" disabled={!pageIndex} aria-label="Previous nuclides" onClick={() => setPage(pageIndex - 1)}>Previous</button><button type="button" className="posnav__btn posnav__btn--sm" disabled={pageIndex + 1 >= pageCount} aria-label="Next nuclides" onClick={() => setPage(pageIndex + 1)}>Next</button></div>
          </div>
        </> : <>
          <div className="st-release-picker"><label>Release segment<select className="posfield__select" aria-label="Release segment" disabled={!values.releases.length} value={index} onChange={e => setSegment(Number(e.target.value))}>
            {!values.releases.length && <option value={0}>Add a release segment</option>}
            {values.releases.map((r, i) => <option key={r.id} value={i}>Segment {r.id} of {values.releases.length}</option>)}
          </select></label></div>
          {release && <div className="st-timing">
            {(["startSeconds", "durationSeconds", "heightMetres"] as const).map((key, i) => <label key={key}>{["Start time (s)", "Duration (s)", "Release height (m)"][i]}
              <WorkbookInput className="posfield__input posmono" aria-label={`${["Start", "Duration", "Height"][i]} for segment ${release.id}`} type="number" min="0" step="any" value={shown(release[key])} disabled={disabled}
                onChange={e => edit({ ...values, releases: values.releases.map((r, j) => j === index ? { ...r, [key]: e.target.value === "" ? undefined : Number(e.target.value) } : r) })} />
            </label>)}
          </div>}
          <div className="st-panel-heading"><h3>{release ? `Fractions released in segment ${release.id}` : "Release fractions"}</h3></div>
          {!!values.groups.length && <div className="st-fraction-layout">{fractionTable(0, midpoint)}{midpoint < values.groups.length && fractionTable(midpoint, values.groups.length)}</div>}
        </>}
        {editable && <details className="st-manage" open={manage} onToggle={e => setManage(e.currentTarget.open)}>
          <summary>Manage {tab === "inventory" ? "nuclides" : "segments and groups"}</summary>
          {tab === "inventory" ? <>
            <div className="st-structure-rows">{values.inventory.slice(offset, offset + 8).map((n, i) => <div className="st-structure-row" key={offset + i}>
              <WorkbookInput className="posfield__input posmono" aria-label={`Nuclide ${offset + i + 1}`} value={n.name} disabled={disabled} onChange={e => edit({ ...values, inventory: values.inventory.map((r, j) => j === offset + i ? { ...r, name: e.target.value } : r) })} />
              <select className="posfield__select" aria-label={`Group for ${n.name || offset + i + 1}`} disabled={disabled} value={n.group} onChange={e => edit({ ...values, inventory: values.inventory.map((r, j) => j === offset + i ? { ...r, group: Number(e.target.value) } : r) })}>{values.groups.map(g => <option key={g.id} value={g.id}>{g.name || `Group ${g.id}`}</option>)}</select>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled} aria-label={`Remove nuclide ${offset + i + 1}`} onClick={() => edit({ ...values, inventory: values.inventory.filter((_, j) => j !== offset + i) })}>Remove</button>
            </div>)}</div>
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || !values.groups.length} onClick={() => { edit({ ...values, inventory: [...values.inventory, { name: "", group: values.groups[0].id, activityBq: Number.NaN }] }); setPage(Math.floor(values.inventory.length / 8)); }}>Add nuclide</button>
            {!values.groups.length && <p className="st-caption">Add a chemical group under Releases first.</p>}
          </> : <>
            <div className="st-file-actions"><button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled} onClick={addSegment}>Add segment</button>
              {release && <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled} aria-label={`Remove segment ${release.id}`} onClick={() => { edit({ ...values, releases: values.releases.filter((_, i) => i !== index) }); setSegment(0); }}>Remove segment</button>}
            </div>
            <h3>Chemical groups</h3><div className="st-structure-rows">{values.groups.map((g, i) => <div className="st-structure-row st-structure-row--group" key={g.id}>
              <WorkbookInput className="posfield__input posmono" aria-label={`Name of group ${g.id}`} value={g.name} disabled={disabled} onChange={e => edit({ ...values, groups: values.groups.map((r, j) => j === i ? { ...r, name: e.target.value } : r) })} />
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || values.inventory.some(n => n.group === g.id)} title="Reassign its nuclides before removing a group" aria-label={`Remove group ${g.id}`} onClick={() => edit({ ...values, groups: values.groups.filter((_, j) => i !== j), releases: values.releases.map(r => ({ ...r, fractions: r.fractions.filter((_, j) => i !== j) })) })}>Remove</button>
            </div>)}</div><button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled} onClick={addGroup}>Add chemical group</button>
          </>}
        </details>}
      </div>
      {!!missing && <p className="st-caption" role="status">{missing} missing segment values. Blank means missing.</p>}
      {!!issues.length && <ul className="st-errors" role="alert">{[...new Set(issues)].slice(0, 4).map(issue => <li key={issue}>{issue}</li>)}</ul>}
      <footer className="st-footer">{dirty && <span className="st-caption" role="status">Unsaved changes</span>}
        {editable && <div className="st-file-actions">{dirty && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--ghost" disabled={disabled} onClick={onDiscard}>Discard edits</button>}
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!canSave || !!issues.length} onClick={onSave}>Save source data</button>
        </div>}
      </footer>
    </>}
    {error && <p className="st-errors" role="alert">{error}</p>}
  </div>;
}
