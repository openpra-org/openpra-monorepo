import type { JSX } from "react";
import type { RcReceptorGeometry, RcSiteSettings } from "interfaces-mef-types/rc/site-receptors";
import { cellDoseDistance } from "interfaces-shared-types/rc-workbooks/site-receptors";

const display = (n: number) => n !== 0 && (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-3) ? n.toExponential() : Number(n.toFixed(4)).toString();
const point = (r: number, a: number) => `${180 + r * Math.sin(a * Math.PI / 180)} ${180 - r * Math.cos(a * Math.PI / 180)}`;
function wedge(inner: number, outer: number, start: number, end: number) {
  const mid = (start + end) / 2;
  return `M ${point(outer, start)} A ${outer} ${outer} 0 0 1 ${point(outer, mid)} A ${outer} ${outer} 0 0 1 ${point(outer, end)}` +
    (inner ? ` L ${point(inner, end)} A ${inner} ${inner} 0 0 0 ${point(inner, mid)} A ${inner} ${inner} 0 0 0 ${point(inner, start)}` : " L 180 180") + " Z";
}
export function RcReceptorCellGrid({ geometry: g, settings, band, sector, onSelect }: {
  geometry: Extract<RcReceptorGeometry, { kind: "cells" }>; settings: RcSiteSettings;
  band: number; sector: number; onSelect: (band: number, sector: number) => void;
}): JSX.Element {
  const n = g.radiiKm.length, step = 360 / g.sectors, center = sector * step, outer = g.radiiKm[band], inner = band ? g.radiiKm[band - 1] : 0;
  const start = (center - step / 2 + 360) % 360, end = (center + step / 2) % 360, distance = cellDoseDistance(g, settings, band);
  const population = g.populationByCell?.[sector * n + band];
  const select = (b: number, s: number) => onSelect(Math.min(n - 1, Math.max(0, b)), (s + g.sectors) % g.sectors);
  return <div className="sr-cell-grid">
    <div className="sr-grid-figure">
      <svg className="sr-polar-grid" viewBox="0 0 360 360" role="img" tabIndex={0}
        aria-label="Receptor cell grid. Arrow keys select a band or sector."
        onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault(); select(band + (e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0), sector + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0));
        }}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect(), x = (e.clientX - rect.left) * 360 / rect.width - 180, y = (e.clientY - rect.top) * 360 / rect.height - 180;
          const radius = Math.hypot(x, y); if (radius > 154 || radius < 3) return;
          const bearing = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
          select(Math.floor(radius / 154 * n), Math.floor((bearing + step / 2) / step) % g.sectors);
        }}>
        <title>Receptor cell grid</title>
        <path className="sr-cell-related" d={wedge(154 * band / n, 154 * (band + 1) / n, 0, 360)} />
        <path className="sr-cell-related" d={wedge(0, 154, center - step / 2, center + step / 2)} />
        <g className="sr-grid-lines">
          {g.radiiKm.map((_, i) => <circle key={i} cx="180" cy="180" r={154 * (i + 1) / n} />)}
          {Array.from({ length: g.sectors }, (_, s) => <path key={s} d={`M 180 180 L ${point(154, s * step - step / 2)}`} />)}
        </g>
        <path className="sr-cell-selected" d={wedge(154 * band / n, 154 * (band + 1) / n, center - step / 2, center + step / 2)} />
        <circle className="sr-grid-source" cx="180" cy="180" r="3" />
        {[["N", 180, 14], ["E", 349, 184], ["S", 180, 356], ["W", 11, 184]].map(([text, x, y]) => <text key={text} className="sr-grid-compass" textAnchor="middle" x={x} y={y}>{text}</text>)}
      </svg>
    </div>
    <div className="sr-cell-inspector"><div className="sr-cell-pickers">
      <label>Band<select className="posfield__select" aria-label="Inspect band" value={band} onChange={e => select(Number(e.target.value), sector)}>{g.radiiKm.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
      <label>Sector<select className="posfield__select" aria-label="Inspect sector" value={sector} onChange={e => select(band, Number(e.target.value))}>{Array.from({ length: g.sectors }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
    </div><div className="sr-cell-detail" aria-live="polite"><strong>Cell S{String(sector + 1).padStart(2, "0")}R{String(band + 1).padStart(2, "0")}</strong>
      <dl><div><dt>Distance from release</dt><dd>{display(inner)} to {display(outer)} km</dd></div>
        <div><dt>Sector boundaries</dt><dd>{display(start)}° to {display(end)}°{start > end ? " (across north)" : ""}</dd></div>
        <div><dt>Center bearing</dt><dd>{display(center)}° clockwise from north</dd></div>
        <div><dt>Dose point distance</dt><dd>{distance === undefined ? "Choose an evaluation position" : `${display(distance)} m`}</dd></div>
        {population !== undefined && <div><dt>Population in cell</dt><dd>{population.toLocaleString()}</dd></div>}
      </dl></div>
    </div>
  </div>;
}
