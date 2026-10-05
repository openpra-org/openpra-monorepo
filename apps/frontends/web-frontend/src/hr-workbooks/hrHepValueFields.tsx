import { JSX } from "react";
import type { HepQuantification } from "interfaces-mef-types/hr/human-reliability-analysis";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { hepText } from "./hrShared";
import { useHrWorkbook } from "./hrWorkbookContext";
import { daHepKey, heldHep, hepDiffers, linkedDaHep, withImportedHep } from "./hrDaLinks";

function optionalNumber(text: string): number | undefined {
  const parsed = Number(text);
  return text.length === 0 || Number.isNaN(parsed) ? undefined : parsed;
}

function HrHepValueFields({ quantification }: { quantification: HepQuantification }): JSX.Element {
  const { editable, mutateHr, daHeps } = useHrWorkbook();
  const options = daHeps ?? [];
  const source = quantification.controlledDataSource;
  const sourceKey = source === undefined ? "" : daHepKey(source.workbookId, source.entityId);
  const linked = linkedDaHep(quantification, options);
  const held = heldHep(quantification);
  const changed = linked !== undefined && hepDiffers(quantification, linked.value);

  function patch(fields: Partial<HepQuantification>): void {
    if (!editable) return;
    mutateHr((draft) => ({ ...draft, hepQuantifications: draft.hepQuantifications.map((candidate) => (candidate.uuid === quantification.uuid ? { ...candidate, ...fields } : candidate)) }));
  }

  function choose(key: string): void {
    if (!editable) return;
    const option = options.find((candidate) => daHepKey(candidate.workbookId, candidate.parameterId) === key);
    mutateHr((draft) => withImportedHep(draft, quantification.uuid, option));
  }

  const linkedText = linked === undefined ? "Linked DA parameter unavailable" : `${linked.workbookName} · ${linked.parameterId} · ${hepText(linked.value)}`;
  return (
    <>
      <div className="posfield posfield-grid--span2"><label className="posfield__label">Value from</label>
        {options.length === 0 && source === undefined ? <div className="posmuted">Typed in HR. Add a DA workbook to the project to import a probability.</div>
          : editable ? (
            <select className="posfield__select" aria-label="Value from" value={sourceKey} onChange={(event) => choose(event.target.value)}>
              <option value="">Typed in HR</option>
              {source !== undefined && linked === undefined && <option value={sourceKey}>Linked DA parameter unavailable</option>}
              {options.map((option) => {
                const key = daHepKey(option.workbookId, option.parameterId);
                return <option key={key} value={key}>{option.workbookName} · {option.parameterId} · {hepText(option.value)}</option>;
              })}
            </select>
          ) : <div>{source === undefined ? "Typed in HR" : linkedText}</div>}
      </div>
      {changed && linked !== undefined && (
        <div className="posfield posfield-grid--span2">
          <p className="posmuted" role="status">DA now gives {hepText(linked.value)}. This HEP still holds {hepText(held)}.</p>
          {editable && <div><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => choose(sourceKey)}>Apply DA value</button></div>}
        </div>
      )}
      {source === undefined && (
        <>
          <div className="posfield"><label className="posfield__label">Point estimate HEP</label>
            {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" aria-label="Point estimate HEP" value={quantification.pointEstimateHep ?? ""} onChange={(event) => patch({ pointEstimateHep: optionalNumber(event.target.value) })} /> : <div className="posmono">{quantification.pointEstimateHep !== undefined ? hepText(quantification.pointEstimateHep) : "—"}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Mean HEP</label>
            {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" aria-label="Mean HEP" value={quantification.meanHep ?? ""} onChange={(event) => patch({ meanHep: optionalNumber(event.target.value) })} /> : <div className="posmono">{quantification.meanHep !== undefined ? hepText(quantification.meanHep) : "—"}</div>}
          </div>
        </>
      )}
    </>
  );
}

export { HrHepValueFields };
