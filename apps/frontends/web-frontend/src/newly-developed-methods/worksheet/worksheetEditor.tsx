import { JSX, useState, useLayoutEffect, useRef } from "react";
import {
  type WorksheetModel,
  type WorksheetMode,
  type FmeaRow,
  type HazopRow,
  type FmeaSeverity,
  type HazopGuideword,
  FMEA_SEVERITIES,
  HAZOP_GUIDEWORDS,
} from "./worksheetTypes";
import "./css/worksheet.css";

interface Column {
  key: string;
  label: string;
  width: string;
  kind?: "sev" | "guide" | "ie";
}

const FMEA_COLS: Column[] = [
  { key: "component", label: "Component", width: "16%" },
  { key: "mode", label: "Failure mode", width: "13%" },
  { key: "cause", label: "Cause", width: "14%" },
  { key: "local", label: "Local effect", width: "12%" },
  { key: "effect", label: "End effect (initiator)", width: "13%" },
  { key: "detect", label: "Detection", width: "10%" },
  { key: "safeguard", label: "Safeguard", width: "11%" },
  { key: "sev", label: "Sev", width: "5%", kind: "sev" },
  { key: "ie", label: "IE", width: "7%", kind: "ie" },
];

const HAZOP_COLS: Column[] = [
  { key: "node", label: "Node", width: "14%" },
  { key: "param", label: "Parameter", width: "11%" },
  { key: "guide", label: "Guideword", width: "12%", kind: "guide" },
  { key: "dev", label: "Deviation", width: "15%" },
  { key: "cause", label: "Cause", width: "16%" },
  { key: "cons", label: "Consequence (initiator)", width: "16%" },
  { key: "safeguard", label: "Safeguard", width: "16%" },
  { key: "ie", label: "IE", width: "7%", kind: "ie" },
];

function sevClass(s: string): string {
  return s === "HIGH" ? "iee-tag--hi" : s === "MED" ? "iee-tag--med" : "iee-tag--lo";
}

function emptyFmeaRow(): FmeaRow {
  return { component: "", mode: "", cause: "", local: "", effect: "", detect: "", safeguard: "", sev: "MED", ie: "" };
}
function emptyHazopRow(): HazopRow {
  return { node: "", param: "", guide: "NO", dev: "", cause: "", cons: "", safeguard: "", ie: "" };
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

export function WorksheetEditor({ model, mode }: { model: WorksheetModel; mode: WorksheetMode }): JSX.Element {
  const [fmea, setFmea] = useState<FmeaRow[]>(() => model.fmea.map((r) => ({ ...r })));
  const [hazop, setHazop] = useState<HazopRow[]>(() => model.hazop.map((r) => ({ ...r })));

  const cols = mode === "fmea" ? FMEA_COLS : HAZOP_COLS;
  const rows: Array<Record<string, string>> = mode === "fmea" ? (fmea as unknown as Array<Record<string, string>>) : (hazop as unknown as Array<Record<string, string>>);

  function patchCell(idx: number, key: string, val: string): void {
    if (mode === "fmea") setFmea((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
    else setHazop((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  }
  function addRow(): void {
    if (mode === "fmea") setFmea((rs) => [...rs, emptyFmeaRow()]);
    else setHazop((rs) => [...rs, emptyHazopRow()]);
  }
  function delRow(idx: number): void {
    if (mode === "fmea") setFmea((rs) => rs.filter((_, i) => i !== idx));
    else setHazop((rs) => rs.filter((_, i) => i !== idx));
  }

  return (
    <div className="iee">
      <div className="iee__result">
        <span className="iee__spacer" />
        <button type="button" className="iee__btn iee__btn--primary" onClick={addRow}>+ Add row</button>
      </div>

      <div className="iee__gridwrap">
        <table className="iee-grid">
          <thead>
            <tr>
              <th className="iee-grid__rownum">#</th>
              {cols.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
              <th className="iee-grid__delcol" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="iee-grid__rownum">{idx + 1}</td>
                {cols.map((c) => (
                  <td key={c.key}>
                    {c.kind === "sev" ? (
                      <select className={`iee-sel ${sevClass(row.sev)}`} value={row.sev} onChange={(e) => patchCell(idx, "sev", e.target.value as FmeaSeverity)}>
                        {FMEA_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : c.kind === "guide" ? (
                      <select className="iee-sel" value={row.guide} onChange={(e) => patchCell(idx, "guide", e.target.value as HazopGuideword)}>
                        {HAZOP_GUIDEWORDS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    ) : (
                      <AutoCell
                        value={row[c.key] ?? ""}
                        mono={c.kind === "ie"}
                        placeholder={c.kind === "ie" ? "IE-…" : ""}
                        onChange={(v) => patchCell(idx, c.key, v)}
                      />
                    )}
                  </td>
                ))}
                <td className="iee-grid__delcol">
                  <button type="button" className="iee-grid__del" onClick={() => delRow(idx)} aria-label="Delete row">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="iee__footbar">
        <span className="iee__note">
          {mode === "fmea"
            ? "Every component is swept to subsystem or train level (IE-A9, IE-A15). End effects that challenge a safety function become initiating events."
            : "Each node × parameter × guideword deviation is examined. Consequences that challenge a safety function become initiating events."}
        </span>
      </div>
    </div>
  );
}
