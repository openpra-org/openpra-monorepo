import { JSX, useState, useLayoutEffect, useRef } from "react";
import {
  type OeModel,
  type OeSourceView,
  type OePrecursorView,
  type OeApplic,
  type OeDisp,
  OE_DISPOSITIONS,
  dispClass,
} from "./operatingExperienceTypes";
import "./css/operatingExperience.css";

const APPLIC_OPTIONS: Array<{ value: OeApplic; label: string }> = [
  { value: "high", label: "High" },
  { value: "med", label: "Medium" },
  { value: "screen", label: "Screened" },
  { value: "open", label: "Open" },
];

function applicClass(a: OeApplic): string {
  if (a === "high") return "oe__select--high";
  if (a === "med") return "oe__select--med";
  if (a === "open") return "oe__select--open";
  return "oe__select--screen";
}

function AutoTextarea({ value, className, placeholder, onChange }: { value: string; className: string; placeholder?: string; onChange: (v: string) => void }): JSX.Element {
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
  return <textarea ref={ref} className={className} rows={1} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function emptySource(n: number): OeSourceView {
  return { id: `src-${n}`, name: "", type: "", period: "", events: 0, applic: "med", note: "" };
}
function emptyPrecursor(n: number): OePrecursorView {
  return { id: `pr-${n}`, event: "", sourceId: "", source: "", date: "", maps: "", disp: "OPEN" };
}

export function OperatingExperienceEditor({ model }: { model: OeModel }): JSX.Element {
  const [sources, setSources] = useState<OeSourceView[]>(() => model.sources.map((s) => ({ ...s })));
  const [precursors, setPrecursors] = useState<OePrecursorView[]>(() => model.precursors.map((p) => ({ ...p })));

  function patchSource(id: string, patch: Partial<OeSourceView>): void {
    setSources((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function patchPre(id: string, patch: Partial<OePrecursorView>): void {
    setPrecursors((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="iee">
      <div className="iee__body">
        <section className="oe__section">
          <div className="oe__section-head">
            <span className="oe__section-title">Experience sources</span>
            <button type="button" className="iee__btn iee__btn--primary" onClick={() => setSources((ss) => [...ss, emptySource(ss.length + 1)])}>+ Add source</button>
          </div>
          <div className="oe__cards">
            {sources.map((s) => (
              <div key={s.id} className="oe__card">
                <div className="oe__card-top">
                  <input className="oe__card-name-input" value={s.name} placeholder="Source name" onChange={(e) => patchSource(s.id, { name: e.target.value })} />
                  <button type="button" className="oe__card-del" onClick={() => setSources((ss) => ss.filter((x) => x.id !== s.id))} aria-label="Delete source">✕</button>
                </div>
                <div className="oe__card-grid">
                  <label className="oe__field">
                    <span className="oe__field-label">Type</span>
                    <input className="oe__input" value={s.type} onChange={(e) => patchSource(s.id, { type: e.target.value })} />
                  </label>
                  <label className="oe__field">
                    <span className="oe__field-label">Period</span>
                    <input className="oe__input" value={s.period} onChange={(e) => patchSource(s.id, { period: e.target.value })} />
                  </label>
                  <label className="oe__field">
                    <span className="oe__field-label">Events</span>
                    <input className="oe__input" type="number" min="0" value={s.events} onChange={(e) => patchSource(s.id, { events: Number(e.target.value) })} />
                  </label>
                  <label className="oe__field">
                    <span className="oe__field-label">Applicability</span>
                    <select className={`oe__select ${applicClass(s.applic)}`} value={s.applic} onChange={(e) => patchSource(s.id, { applic: e.target.value as OeApplic })}>
                      {APPLIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="oe__field">
                  <span className="oe__field-label">Note</span>
                  <AutoTextarea className="oe__note" value={s.note} onChange={(v) => patchSource(s.id, { note: v })} />
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="oe__section">
          <div className="oe__section-head">
            <span className="oe__section-title">Precursor events</span>
            <button type="button" className="iee__btn iee__btn--primary" onClick={() => setPrecursors((ps) => [...ps, emptyPrecursor(ps.length + 1)])}>+ Add precursor</button>
          </div>
          <table className="iee-grid">
            <thead>
              <tr>
                <th className="iee-grid__rownum">#</th>
                <th style={{ width: "36%" }}>Precursor event</th>
                <th style={{ width: "20%" }}>Source</th>
                <th style={{ width: "12%" }}>Date</th>
                <th style={{ width: "12%" }}>Maps to IE</th>
                <th style={{ width: "16%" }}>Disposition</th>
                <th className="iee-grid__delcol" />
              </tr>
            </thead>
            <tbody>
              {precursors.map((p, i) => (
                <tr key={p.id}>
                  <td className="iee-grid__rownum">{i + 1}</td>
                  <td><AutoTextarea className="iee-cell" value={p.event} onChange={(v) => patchPre(p.id, { event: v })} /></td>
                  <td><AutoTextarea className="iee-cell" value={p.source} onChange={(v) => patchPre(p.id, { source: v })} /></td>
                  <td><input className="iee-cell iee-cell--mono" value={p.date} onChange={(e) => patchPre(p.id, { date: e.target.value })} /></td>
                  <td><input className="iee-cell iee-cell--mono" value={p.maps} placeholder="IE-…" onChange={(e) => patchPre(p.id, { maps: e.target.value })} /></td>
                  <td>
                    <select className={`iee-sel ${dispClass(p.disp)}`} value={p.disp} onChange={(e) => patchPre(p.id, { disp: e.target.value as OeDisp })}>
                      {OE_DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="iee-grid__delcol">
                    <button type="button" className="iee-grid__del" onClick={() => setPrecursors((ps) => ps.filter((x) => x.id !== p.id))} aria-label="Delete precursor">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="iee__footbar">
        <span className="iee__note">Pre-operational: limited HTGR plant data, so analogous gas-cooled-reactor operating experience is reviewed for completeness (IE-A8, A11, A14).</span>
      </div>
    </div>
  );
}
