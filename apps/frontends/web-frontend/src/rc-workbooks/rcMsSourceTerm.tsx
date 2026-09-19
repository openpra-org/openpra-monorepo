import { useId, useState, type JSX } from "react";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RcSourceTermEditor } from "./rcSourceTerm";
import { RCIcon } from "./rcIcons";
import type { RcDrawerContext } from "./rcScreens";
import "./css/rcSourceTerm.css";

/** Rendered exclusively inside Interfaces → Mechanistic Source Term. */
export function RcMsSourceTerm({ openDrawer }: { openDrawer: (context: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const [selected, setSelected] = useState(categories[0]?.releaseCategory ?? "");
  const category = categories.find((c) => c.releaseCategory === selected) ?? categories[0];
  const selectId = useId();
  const addCategory = () => {
    const next = categories.reduce((max, c) => Math.max(max, Number(c.releaseCategory.match(/^RC-(\d+)$/)?.[1] ?? 0)), 0) + 1;
    const releaseCategory = `RC-${next}`;
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
    {category ? <RcSourceTermEditor key={`${category.releaseCategory}:${editable}`} category={category} inline />
      : <p className="posmuted">Add a release category, then import its source-term file or enter the data.</p>}
  </section>;
}
