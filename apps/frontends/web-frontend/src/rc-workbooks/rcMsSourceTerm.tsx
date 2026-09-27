import { useId, useState, type JSX } from "react";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcMsBoundingMember, rcMsInventoryIds, rcMsSourceTermFor, rcSourceTermFromMs } from "interfaces-shared-types/rc-workbooks/ms-source-term";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RcSourceTermEditor } from "./rcSourceTerm";
import { RCIcon } from "./rcIcons";
import type { RcDrawerContext } from "./rcScreens";
import "./css/rcSourceTerm.css";

const categoryNumber = (id: string) => {
  const value = id.startsWith("RC-") ? Number(id.slice(3)) : 0;
  return Number.isInteger(value) && value > 0 ? value : 0;
};

function RcMsImport({ category }: { category: ReleaseCategoryInputs }): JSX.Element | null {
  const { rc, editable, mutateRc, links, sourceTerms, sourceTermDrafts } = useRcWorkbook();
  const msId = rc.linkedWorkbooks?.MS, ms = msId ? links.ms : undefined;
  const [choice, setChoice] = useState<{ categoryId: string; sourceTermId: string; inventoryIds: string[] }>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sourceId = useId();
  if (!ms || !msId) return null;
  const current = choice?.categoryId === category.releaseCategory ? choice : {
    categoryId: category.releaseCategory,
    sourceTermId: category.sourceTerm?.msSource?.sourceTermId ?? rcMsSourceTermFor(ms, category.releaseCategory)?.uuid ?? "",
    inventoryIds: category.sourceTerm?.msSource?.inventoryIds ?? rcMsInventoryIds(ms, category.releaseCategory),
  };
  const definition = ms.sourceTermDefinitions.find((entry) => entry.uuid === current.sourceTermId);
  const conversion = definition ? rcSourceTermFromMs(definition, ms.sourceInventories.filter((inventory) => current.inventoryIds.includes(inventory.uuid))) : undefined;
  const pending = Boolean(sourceTermDrafts[category.releaseCategory]);
  const importSource = async () => {
    if (!conversion?.values || !sourceTerms) return;
    const bounding = rcMsBoundingMember(ms, category.releaseCategory);
    mutateRc((draft) => ({ ...draft, releaseCategoryToConsequence: { ...draft.releaseCategoryToConsequence,
      releaseCategoryInputs: draft.releaseCategoryToConsequence.releaseCategoryInputs.map((entry) => entry.releaseCategory !== category.releaseCategory ? entry : {
        ...entry, sourceTermDefinitionRef: current.sourceTermId, ...(entry.boundingMember?.sequenceId.trim() || !bounding ? {} : { boundingMember: bounding }),
      }),
    } }));
    setBusy(true); setError("");
    try { await sourceTerms.saveValues(category.releaseCategory, category.sourceTerm?.revision ?? 0, conversion.values, { workbookId: msId, sourceTermId: current.sourceTermId, inventoryIds: current.inventoryIds }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not import the MS source term"); }
    finally { setBusy(false); }
  };
  return <section className="rc-ms-import" aria-label="Import from the linked MS workbook">
    <div className="rc-ms-import__fields">
      <div className="posfield">
        <label className="posfield__label" htmlFor={sourceId}>MS source term</label>
        <select id={sourceId} className="posfield__select" value={current.sourceTermId} disabled={!editable || busy} onChange={(event) => setChoice({ ...current, sourceTermId: event.target.value })}>
          {!ms.sourceTermDefinitions.length && <option value="">No source terms in the MS workbook</option>}
          {ms.sourceTermDefinitions.map((entry) => <option key={entry.uuid} value={entry.uuid}>{entry.uuid} · {entry.releaseCategoryReference}</option>)}
        </select>
      </div>
      <fieldset className="rc-ms-import__inventories" disabled={!editable || busy}>
        <legend className="posfield__label">Inventories</legend>
        {ms.sourceInventories.map((inventory) => <label key={inventory.uuid}>
          <input type="checkbox" checked={current.inventoryIds.includes(inventory.uuid)} onChange={(event) => setChoice({ ...current,
            inventoryIds: event.target.checked ? ms.sourceInventories.map((entry) => entry.uuid).filter((id) => id === inventory.uuid || current.inventoryIds.includes(id)) : current.inventoryIds.filter((id) => id !== inventory.uuid) })} />
          {inventory.uuid} · {inventory.name}
        </label>)}
      </fieldset>
    </div>
    {!!conversion?.issues.length && <ul className="st-errors" role="status">{conversion.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    {error && <p className="st-errors" role="alert">{error}</p>}
    {editable && sourceTerms && <div className="st-file-actions">
      <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!conversion?.values || busy || pending} onClick={() => { void importSource(); }}>{busy ? "Importing…" : "Import from MS"}</button>
      {pending && <span className="st-caption">Save or discard the source edits first.</span>}
    </div>}
  </section>;
}

/** Rendered exclusively inside Interfaces → Mechanistic Source Term. */
export function RcMsSourceTerm({ openDrawer }: { openDrawer: (context: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const [selected, setSelected] = useState(categories[0]?.releaseCategory ?? "");
  const category = categories.find((c) => c.releaseCategory === selected) ?? categories[0];
  const selectId = useId();
  const addCategory = () => {
    const releaseCategory = `RC-${Math.max(0, ...categories.map((c) => categoryNumber(c.releaseCategory))) + 1}`;
    mutateRc((draft) => ({ ...draft, releaseCategoryToConsequence: { ...draft.releaseCategoryToConsequence,
      releaseCategoryInputs: [...draft.releaseCategoryToConsequence.releaseCategoryInputs, {
        releaseCategory, releaseCharacteristics: { importantRadionuclides: [], radionuclideGroupFractions: [], releasePhaseTimings: [] },
      }],
    } }));
    setSelected(releaseCategory);
  };
  return <section className="rc-ms-source" aria-label="Mechanistic source term inputs">
    <div className="rc-source__category">
      <div className="posfield">
        <label className="posfield__label" htmlFor={selectId}>Release category</label>
        <select id={selectId} className="posfield__select" value={category?.releaseCategory ?? ""} disabled={!categories.length} onChange={(e) => setSelected(e.target.value)}>
          {!categories.length && <option value="">No release category yet</option>}
          {categories.map((c) => <option key={c.releaseCategory} value={c.releaseCategory}>{c.releaseCategory}{c.sourceTermDefinitionRef ? ` · ${c.sourceTermDefinitionRef}` : ""}</option>)}
        </select>
      </div>
      <div className="rc-source__actions">
        {category && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "category", id: category.releaseCategory })}><RCIcon.Settings /> Category details</button>}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCategory}><RCIcon.Plus /> Add category</button>}
      </div>
    </div>
    {category && <RcMsImport key={category.releaseCategory} category={category} />}
    {category ? <RcSourceTermEditor key={`${category.releaseCategory}:${editable}`} category={category} inline />
      : <p className="posmuted">No release categories.</p>}
  </section>;
}
