import { JSX, useState, useLayoutEffect, useRef } from "react";
import { type PhaModel, type PhaReconItem } from "./phaTypes";
import "./css/processHazardAnalysis.css";

const COLS: Array<{ key: keyof PhaReconItem; label: string; width: string; mono?: boolean }> = [
  { key: "topic", label: "Hazard topic", width: "20%" },
  { key: "fmea", label: "FMEA coverage", width: "24%" },
  { key: "hazop", label: "HAZOP coverage", width: "24%" },
  { key: "resolution", label: "Reconciliation / gap closure", width: "24%" },
  { key: "ie", label: "→ IE", width: "8%", mono: true },
];

function emptyItem(): PhaReconItem {
  return { topic: "", fmea: "", hazop: "", resolution: "", ie: "" };
}

function AutoCell({ value, mono, placeholder, onChange }: { value: string; mono?: boolean; placeholder?: string; onChange: (v: string) => void }): JSX.Element {
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
      className={`iee-cell${mono === true ? " iee-cell--mono" : ""}`}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function PhaEditor({ model }: { model: PhaModel }): JSX.Element {
  const [items, setItems] = useState<PhaReconItem[]>(() => model.items.map((r) => ({ ...r })));

  function patchCell(idx: number, key: keyof PhaReconItem, val: string): void {
    setItems((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  }

  return (
    <div className="iee">
      <div className="iee__result">
        <span className="iee__spacer" />
        <button type="button" className="iee__btn iee__btn--primary" onClick={() => setItems((rs) => [...rs, emptyItem()])}>+ Add item</button>
      </div>

      <div className="iee__body">
        <div className="iee__gridwrap">
          <table className="iee-grid">
            <thead>
              <tr>
                <th className="iee-grid__rownum">#</th>
                {COLS.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
                <th className="iee-grid__delcol" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx}>
                  <td className="iee-grid__rownum">{idx + 1}</td>
                  {COLS.map((c) => (
                    <td key={c.key}>
                      <AutoCell
                        value={row[c.key]}
                        mono={c.mono}
                        placeholder={c.mono === true ? "IE-…" : ""}
                        onChange={(v) => patchCell(idx, c.key, v)}
                      />
                    </td>
                  ))}
                  <td className="iee-grid__delcol">
                    <button type="button" className="iee-grid__del" onClick={() => setItems((rs) => rs.filter((_, i) => i !== idx))} aria-label="Delete item">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="iee__footbar">
        <span className="iee__note">Process hazard analysis frames and reconciles the FMEA and HAZOP sweeps (IE-A1). Each topic is checked for consistent coverage across both, and gaps are closed before the initiators are accepted.</span>
      </div>
    </div>
  );
}
