import { useId, useState, type JSX } from "react";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcMsInventoryIds } from "interfaces-shared-types/rc-workbooks/ms-source-term";
import { rcSourceIsLinked, rcSourceLink, rcSourceStandsIn, rcWithSourceChoice, rcWithSourceLinked, rcWithSourceReason, type RcSourceChoice } from "interfaces-shared-types/rc-workbooks/linked-data";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RcSourceTermEditor } from "./rcSourceTerm";
import { RCIcon } from "./rcIcons";
import type { RcDrawerContext } from "./rcScreens";
import "./css/rcSourceTerm.css";

const categoryNumber = (id: string) => {
  const value = id.startsWith("RC-") ? Number(id.slice(3)) : 0;
  return Number.isInteger(value) && value > 0 ? value : 0;
};

function RcMsSourceChoice({ category }: { category: ReleaseCategoryInputs }): JSX.Element | null {
  const { editable, mutateRc, linked, sourceTerms, setSourceTermDraft } = useRcWorkbook();
  const ms = linked.ms;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const fromId = useId(), sourceId = useId(), reasonId = useId();
  if (ms === undefined) return null;
  const categoryId = category.releaseCategory;
  const typed = rcSourceStandsIn(category, linked);
  const read = rcSourceIsLinked(category);
  const link = typed ? undefined : rcSourceLink(category, ms.analysis);
  const current: RcSourceChoice = link?.choice ?? { sourceTermId: "", inventoryIds: rcMsInventoryIds(ms.analysis, categoryId) };
  const choose = (next: RcSourceChoice): void => mutateRc((draft) => rcWithSourceChoice(draft, categoryId, next));
  const typeOver = async (): Promise<void> => {
    const values = category.sourceTerm?.values;
    if (values === undefined || !sourceTerms) return;
    setBusy(true); setError("");
    try { await sourceTerms.typeOver(categoryId, values); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not switch to a typed source term"); }
    finally { setBusy(false); }
  };
  const readFromMs = (): void => {
    setSourceTermDraft(categoryId, undefined);
    mutateRc((draft) => rcWithSourceLinked(draft, categoryId));
  };
  return <section className="rc-ms-import" aria-label="Source term from the linked MS workbook">
    <div className="rc-ms-import__fields">
      {(read || typed) && <div className="posfield">
        <label className="posfield__label" htmlFor={fromId}>Source term from</label>
        <select id={fromId} className="posfield__select" value={typed ? "typed" : "ms"} disabled={!editable || busy || !sourceTerms} onChange={(event) => { if (event.target.value === "typed") void typeOver(); else readFromMs(); }}>
          <option value="ms">MS</option>
          <option value="typed">Typed in RC</option>
        </select>
      </div>}
      {typed ? <div className="posfield">
        <label className="posfield__label" htmlFor={reasonId}>Reason</label>
        <WorkbookInput id={reasonId} className="posfield__input" value={category.sourceTermOverrideReason ?? ""} disabled={!editable} onChange={(event) => mutateRc((draft) => rcWithSourceReason(draft, categoryId, event.target.value))} />
      </div> : <>
        <div className="posfield">
          <label className="posfield__label" htmlFor={sourceId}>MS source term</label>
          <select id={sourceId} className="posfield__select" value={current.sourceTermId} disabled={!editable || busy} onChange={(event) => choose({ ...current, sourceTermId: event.target.value })}>
            {!ms.analysis.sourceTermDefinitions.some((entry) => entry.uuid === current.sourceTermId) && <option value={current.sourceTermId}>{ms.analysis.sourceTermDefinitions.length ? "No MS source term" : "No source terms in the MS workbook"}</option>}
            {ms.analysis.sourceTermDefinitions.map((entry) => <option key={entry.uuid} value={entry.uuid}>{entry.uuid} · {entry.releaseCategoryReference}</option>)}
          </select>
        </div>
        <fieldset className="rc-ms-import__inventories" disabled={!editable || busy || current.sourceTermId.length === 0}>
          <legend className="posfield__label">Inventories</legend>
          {ms.analysis.sourceInventories.map((inventory) => <label key={inventory.uuid}>
            <input type="checkbox" checked={current.inventoryIds.includes(inventory.uuid)} onChange={(event) => choose({ ...current,
              inventoryIds: event.target.checked ? ms.analysis.sourceInventories.map((entry) => entry.uuid).filter((id) => id === inventory.uuid || current.inventoryIds.includes(id)) : current.inventoryIds.filter((id) => id !== inventory.uuid) })} />
            {inventory.uuid} · {inventory.name}
          </label>)}
        </fieldset>
      </>}
    </div>
    {!!link?.issues.length && <ul className="st-errors" role="status">{link.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    {error && <p className="st-errors" role="alert">{error}</p>}
  </section>;
}

/** Rendered exclusively inside Interfaces → Mechanistic Source Term. */
export function RcMsSourceTerm({ openDrawer }: { openDrawer: (context: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const [selected, setSelected] = useState(categories[0]?.releaseCategory ?? "");
  const category = categories.find((c) => c.releaseCategory === selected) ?? categories[0];
  const selectId = useId();
  const listedByEs = (rc.linkedWorkbooks?.ES ?? "").length > 0;
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
        {editable && !listedByEs && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCategory}><RCIcon.Plus /> Add category</button>}
      </div>
    </div>
    {category && <RcMsSourceChoice key={category.releaseCategory} category={category} />}
    {category ? <RcSourceTermEditor key={`${category.releaseCategory}:${editable}:${rcSourceIsLinked(category) ? "ms" : "own"}`} category={category} inline />
      : <p className="posmuted">No release categories.</p>}
  </section>;
}
