import { JSX, useState, useLayoutEffect, useRef } from "react";
import { type CatalogueModel, type CatalogueEntry } from "./genericCatalogueTypes";
import "./css/genericCatalogue.css";

function AutoCell({ value, placeholder, onChange }: { value: string; placeholder?: string; onChange: (v: string) => void }): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const grow = (): void => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    grow();
    const frame = requestAnimationFrame(grow);
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) grow();
    });
    const cell = el.parentElement;
    let lastWidth = cell !== null ? cell.clientWidth : 0;
    const observer = new ResizeObserver(() => {
      if (cell !== null && cell.clientWidth !== lastWidth) {
        lastWidth = cell.clientWidth;
        grow();
      }
    });
    if (cell !== null) observer.observe(cell);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="iee-cell"
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function GenericCatalogueEditor({ model }: { model: CatalogueModel }): JSX.Element {
  const [entries, setEntries] = useState<CatalogueEntry[]>(() => model.entries.map((e) => ({ ...e })));

  function patch(idx: number, p: Partial<CatalogueEntry>): void {
    setEntries((es) => es.map((e, i) => (i === idx ? { ...e, ...p } : e)));
  }
  function addEntry(): void {
    setEntries((es) => [...es, { gid: `GI-${String(es.length + 1).padStart(2, "0")}`, name: "", src: "NUREG/CR-5750", applic: true, maps: "", rationale: "" }]);
  }
  function delEntry(idx: number): void {
    setEntries((es) => es.filter((_, i) => i !== idx));
  }
  function toggleApplic(idx: number, current: boolean): void {
    patch(idx, { applic: !current, maps: current ? "—" : "" });
  }

  return (
    <div className="iee">
      <div className="iee__result">
        <span className="iee__spacer" />
        <button type="button" className="iee__btn iee__btn--primary" onClick={addEntry}>+ Add entry</button>
      </div>

      <div className="iee__gridwrap">
        <table className="iee-grid">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th style={{ width: "26%" }}>Generic initiator</th>
              <th style={{ width: "15%" }}>Catalogue source</th>
              <th style={{ width: 96, textAlign: "center" }}>Applicable</th>
              <th style={{ width: "10%" }}>Maps to</th>
              <th style={{ width: "28%" }}>Rationale</th>
              <th className="iee-grid__delcol" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className={e.applic ? "" : "is-na"}>
                <td><input className="iee-cell iee-cell--mono" value={e.gid} onChange={(ev) => patch(i, { gid: ev.target.value })} /></td>
                <td><AutoCell value={e.name} onChange={(v) => patch(i, { name: v })} /></td>
                <td><AutoCell value={e.src} onChange={(v) => patch(i, { src: v })} /></td>
                <td className="cat__applic-cell">
                  <button type="button" className={`cat__toggle ${e.applic ? "is-yes" : "is-na"}`} onClick={() => toggleApplic(i, e.applic)}>
                    {e.applic ? "✓ Yes" : "✕ N/A"}
                  </button>
                </td>
                <td><input className="iee-cell iee-cell--mono" value={e.maps} placeholder="IE-…" onChange={(ev) => patch(i, { maps: ev.target.value })} /></td>
                <td><AutoCell value={e.rationale} onChange={(v) => patch(i, { rationale: v })} /></td>
                <td className="iee-grid__delcol">
                  <button type="button" className="iee-grid__del" onClick={() => delEntry(i)} aria-label="Delete entry">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="iee__footbar">
        <span className="iee__note">Generic catalogue provides a completeness seed (IE-A2). Each entry is screened for HTGR applicability; applicable entries map onto the IE-A5 spectrum.</span>
      </div>
    </div>
  );
}
