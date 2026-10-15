import { useState, type JSX, type KeyboardEvent, type PointerEvent } from "react";
import type { UncertaintyLawSummary, UncertaintyQuantile, UncertaintySampledSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { sciText, useElementWidth } from "./esqShared";
import "./css/esqInputPlot.css";

interface EsqInputHeight {
  at: number;
  y: number;
}

interface EsqInputShare {
  x: number;
  share: number;
}

interface EsqInputCurve {
  log: boolean;
  from: number;
  to: number;
  heights: EsqInputHeight[];
  cumulative: EsqInputShare[];
  mean?: number;
  p05?: number;
  p50?: number;
  p95?: number;
  atom?: number;
}

interface Tick {
  at: number;
  label: string;
}

const LN10 = Math.log(10);
const SAMPLE_BINS = 40;
const SHARE_POINTS = 240;
const TOP = 20;
const PLOT_HEIGHT = 150;
const AXIS_BAND = 30;
const SIDE = 16;

function domainOf(low: number, high: number): { log: boolean; from: number; to: number } {
  if (low > 0 && high / low >= 30) return { log: true, from: Math.log10(low) - 0.15, to: Math.log10(high) + 0.15 };
  const span = high - low;
  const pad = span > 0 ? span * 0.06 : Math.abs(high) > 0 ? Math.abs(high) * 0.1 : 1;
  return { log: false, from: low >= 0 ? Math.max(0, low - pad) : low - pad, to: high + pad };
}

function quantileIn(quantiles: readonly UncertaintyQuantile[], probability: number): number | undefined {
  return quantiles.find((entry) => Math.abs(entry.probability - probability) < 1e-9)?.value;
}

function atomCurve(value: number): EsqInputCurve {
  return { ...domainOf(value, value), heights: [], cumulative: [], atom: value };
}

function lawCurve(summary: UncertaintyLawSummary): EsqInputCurve | undefined {
  const atom = summary.atoms[0];
  if (summary.atoms.length === 1 && atom !== undefined && atom.probability >= 1 - 1e-9) return atomCurve(atom.value);
  const points = summary.curve.filter((point) => Number.isFinite(point.x)).sort((left, right) => left.x - right.x);
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return undefined;
  if (first.x === last.x) return atomCurve(first.x);
  const domain = domainOf(first.x, last.x);
  const heights = points.flatMap((point) => {
    const density = point.density;
    if (density === null || !Number.isFinite(density) || (domain.log && !(point.x > 0))) return [];
    return [{ at: domain.log ? Math.log10(point.x) : point.x, y: domain.log ? density * point.x * LN10 : density }];
  });
  const curve: EsqInputCurve = { ...domain, heights, cumulative: points.map((point) => ({ x: point.x, share: point.cumulative })), mean: summary.mean };
  const p05 = quantileIn(summary.quantiles, 0.05);
  const p50 = quantileIn(summary.quantiles, 0.5);
  const p95 = quantileIn(summary.quantiles, 0.95);
  if (p05 !== undefined) curve.p05 = p05;
  if (p50 !== undefined) curve.p50 = p50;
  if (p95 !== undefined) curve.p95 = p95;
  return curve;
}

function sampleCurve(summary: UncertaintySampledSummary): EsqInputCurve | undefined {
  const sorted = summary.samples.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return undefined;
  if (first === last) return atomCurve(first);
  const domain = domainOf(first, last);
  const width = (domain.to - domain.from) / SAMPLE_BINS;
  const counts = new Array<number>(SAMPLE_BINS).fill(0);
  for (const value of sorted) {
    if (domain.log && !(value > 0)) continue;
    const at = domain.log ? Math.log10(value) : value;
    const index = Math.min(SAMPLE_BINS - 1, Math.max(0, Math.floor((at - domain.from) / width)));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  const step = Math.max(1, Math.floor(sorted.length / SHARE_POINTS));
  const curve: EsqInputCurve = {
    ...domain,
    heights: counts.map((count, index) => ({ at: domain.from + (index + 0.5) * width, y: count / (sorted.length * width) })),
    cumulative: sorted.flatMap((value, index) => (index % step === 0 || index === sorted.length - 1 ? [{ x: value, share: (index + 1) / sorted.length }] : [])),
    mean: summary.mean,
  };
  const p05 = quantileIn(summary.quantiles, 0.05);
  const p50 = quantileIn(summary.quantiles, 0.5);
  const p95 = quantileIn(summary.quantiles, 0.95);
  if (p05 !== undefined) curve.p05 = p05;
  if (p50 !== undefined) curve.p50 = p50;
  if (p95 !== undefined) curve.p95 = p95;
  return curve;
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function axisAt(curve: EsqInputCurve, value: number): number {
  return curve.log ? Math.log10(value) : value;
}

function valueAt(curve: EsqInputCurve, at: number): number {
  return curve.log ? 10 ** at : at;
}

function heightAt(heights: readonly EsqInputHeight[], at: number): number | undefined {
  const index = heights.findIndex((height) => height.at >= at);
  const right = heights[index];
  if (index === -1 || right === undefined) return undefined;
  if (right.at === at) return right.y;
  const left = heights[index - 1];
  if (left === undefined) return undefined;
  return left.y + ((right.y - left.y) * (at - left.at)) / (right.at - left.at);
}

function shareText(curve: EsqInputCurve, value: number): string {
  if (curve.atom !== undefined) return percent(value >= curve.atom ? 1 : 0);
  const points = curve.cumulative;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return "Not known";
  if (value < first.x) return `under ${percent(first.share)}`;
  if (value > last.x) return `over ${percent(last.share)}`;
  const index = points.findIndex((entry) => entry.x >= value);
  const right = points[index];
  const left = points[index - 1];
  if (right === undefined) return "Not known";
  if (left === undefined || right.x === left.x) return percent(right.share);
  return percent(left.share + ((right.share - left.share) * (value - left.x)) / (right.x - left.x));
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / power;
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
}

function ticksOf(curve: EsqInputCurve, plotWidth: number): Tick[] {
  const room = Math.max(2, Math.floor(plotWidth / 64));
  let ticks: Tick[] = [];
  if (curve.log) {
    for (let power = Math.ceil(curve.from); power <= Math.floor(curve.to); power += 1) ticks.push({ at: power, label: sciText(10 ** power) });
    if (ticks.length < 3) {
      ticks = [];
      for (let power = Math.floor(curve.from); power <= Math.ceil(curve.to); power += 1) {
        for (const step of [1, 2, 5]) {
          const at = power + Math.log10(step);
          if (at >= curve.from && at <= curve.to) ticks.push({ at, label: sciText(step * 10 ** power) });
        }
      }
    }
  } else {
    const step = niceStep((curve.to - curve.from) / room);
    const values: number[] = [];
    for (let value = Math.ceil(curve.from / step) * step; value <= curve.to + step * 1e-9; value += step) values.push(Math.abs(value) < step * 1e-9 ? 0 : Number(value.toPrecision(12)));
    const largest = Math.max(...values.map((value) => Math.abs(value)));
    const plain = largest >= 0.01 && largest < 1e5;
    ticks = values.map((value) => ({ at: value, label: plain ? String(Number(value.toPrecision(6))) : sciText(value) }));
  }
  const every = Math.max(1, Math.ceil(ticks.length / room));
  return ticks.filter((_, index) => index % every === 0);
}

function pathOf(points: readonly { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function peakOf(heights: readonly EsqInputHeight[]): number {
  let peak = 0;
  for (const height of heights) if (Number.isFinite(height.y) && height.y > peak) peak = height.y;
  return peak;
}

function SummaryValues({ curve, label }: { curve: EsqInputCurve; label: string }): JSX.Element {
  const values = curve.atom !== undefined
    ? [{ name: "Point value", value: curve.atom }]
    : [
      { name: "5th percentile", value: curve.p05 },
      { name: "Median", value: curve.p50 },
      { name: "Mean", value: curve.mean },
      { name: "95th percentile", value: curve.p95 },
    ];
  return (
    <dl className="esq-input-plot__values" aria-label={`Summary values for ${label}`}>
      {values.map(({ name, value }) => (
        <div key={name} className="esq-input-plot__value">
          <dt>{name}</dt>
          <dd>{value === undefined ? "Not given" : sciText(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function EsqInputPlot({ curve, label, unit }: { curve: EsqInputCurve; label: string; unit: string }): JSX.Element {
  const [ref, measured] = useElementWidth(560);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const width = Math.max(280, measured);
  const plotWidth = width - SIDE * 2;
  const height = TOP + PLOT_HEIGHT + AXIS_BAND;
  const baseline = TOP + PLOT_HEIGHT;
  const scaleX = (at: number): number => SIDE + ((at - curve.from) / (curve.to - curve.from)) * plotWidth;
  const peak = peakOf(curve.heights);
  const scaleY = (y: number): number => baseline - (peak > 0 ? (y / peak) * PLOT_HEIGHT * 0.94 : 0);
  const ticks = ticksOf(curve, plotWidth);
  const atom = curve.atom;
  const usable = (value: number | undefined): value is number => value !== undefined && (!curve.log || value > 0);
  let band = "";
  if (atom === undefined && usable(curve.p05) && usable(curve.p95)) {
    const from = axisAt(curve, curve.p05);
    const to = axisAt(curve, curve.p95);
    const inside = [from, ...curve.heights.map((entry) => entry.at).filter((at) => at > from && at < to), to].flatMap((at) => {
      const y = heightAt(curve.heights, at);
      return y === undefined ? [] : [{ x: scaleX(at), y: scaleY(y) }];
    });
    const first = inside[0];
    const last = inside[inside.length - 1];
    if (first !== undefined && last !== undefined) band = `${pathOf(inside)} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`;
  }
  const mean = atom === undefined && usable(curve.mean) ? curve.mean : undefined;
  const meanHeight = mean === undefined ? undefined : heightAt(curve.heights, axisAt(curve, mean));
  const cursorX = cursor === undefined ? undefined : scaleX(cursor);
  const cursorValue = cursor === undefined ? undefined : valueAt(curve, cursor);

  function moveTo(clientX: number, element: SVGSVGElement): void {
    const left = element.getBoundingClientRect().left;
    const at = curve.from + ((clientX - left - SIDE) / plotWidth) * (curve.to - curve.from);
    setCursor(Math.min(curve.to, Math.max(curve.from, at)));
  }

  function onPointer(event: PointerEvent<SVGSVGElement>): void {
    moveTo(event.clientX, event.currentTarget);
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>): void {
    const step = (curve.to - curve.from) / 50;
    const start = cursor ?? (curve.from + curve.to) / 2;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setCursor(Math.min(curve.to, start + step));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setCursor(Math.max(curve.from, start - step));
    } else if (event.key === "Escape") setCursor(undefined);
  }

  return (
    <div className="esq-input-plot" ref={ref}>
      <svg
        className="esq-input-plot__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Probability density of ${label}, ${unit}, on a ${curve.log ? "logarithmic" : "linear"} axis`}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setCursor(undefined)}
        onKeyDown={onKey}
        onBlur={() => setCursor(undefined)}
      >
        <text className="esq-input-plot__caption" x={SIDE} y={12}>{curve.log ? "Density per decade" : "Density"}</text>
        {band.length > 0 && <path className="esq-input-plot__band" d={band} />}
        {atom !== undefined ? (
          <g>
            <line className="esq-input-plot__line" x1={scaleX(axisAt(curve, atom))} x2={scaleX(axisAt(curve, atom))} y1={baseline} y2={TOP + 6} />
            <circle className="esq-input-plot__dot" cx={scaleX(axisAt(curve, atom))} cy={TOP + 6} r={4} />
          </g>
        ) : (
          <path className="esq-input-plot__line" d={pathOf(curve.heights.map((entry) => ({ x: scaleX(entry.at), y: scaleY(entry.y) })))} />
        )}
        {mean !== undefined && meanHeight !== undefined && <circle className="esq-input-plot__dot" cx={scaleX(axisAt(curve, mean))} cy={scaleY(meanHeight)} r={4} />}
        <line className="esq-input-plot__axis" x1={SIDE} x2={width - SIDE} y1={baseline} y2={baseline} />
        {ticks.map((tick) => (
          <g key={tick.at}>
            <line className="esq-input-plot__axis" x1={scaleX(tick.at)} x2={scaleX(tick.at)} y1={baseline} y2={baseline + 4} />
            <text className="esq-input-plot__tick" x={scaleX(tick.at)} y={baseline + 18} textAnchor="middle">{tick.label}</text>
          </g>
        ))}
        {cursorX !== undefined && <line className="esq-input-plot__cross" x1={cursorX} x2={cursorX} y1={TOP} y2={baseline} />}
      </svg>
      {cursorX !== undefined && cursorValue !== undefined && (
        <div className="esq-input-plot__tip" style={{ left: `${Math.min(Math.max(cursorX + 12, 0), Math.max(0, width - 250))}px` }}>
          <div className="esq-input-plot__tip-value">{`${sciText(cursorValue)} ${unit}`}</div>
          <div className="esq-input-plot__tip-row">
            <span className="esq-input-plot__tip-share">{shareText(curve, cursorValue)}</span>
            <span>of the distribution lies below</span>
          </div>
        </div>
      )}
      <SummaryValues curve={curve} label={label} />
    </div>
  );
}

export { EsqInputPlot, lawCurve, sampleCurve, atomCurve, type EsqInputCurve };
