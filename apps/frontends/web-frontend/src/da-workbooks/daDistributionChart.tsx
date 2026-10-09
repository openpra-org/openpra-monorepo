import { JSX, KeyboardEvent, PointerEvent, type RefObject, useLayoutEffect, useRef, useState } from "react";
import type { UncertaintyCurvePoint, UncertaintyLawSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import type { ParameterDistribution } from "interfaces-mef-types/core/events";
import { distributionCdf, distributionDensity, distributionMean, distributionQuantile, shapePoint } from "./daDistributions";
import { sciText } from "./daShared";

interface ShapeSeries {
  key: string;
  label: string;
  detail: string;
  distribution: ParameterDistribution;
}

interface SummarySeries {
  key: string;
  label: string;
  detail: string;
  summary: UncertaintyLawSummary;
}

type DistributionSeries = ShapeSeries | SummarySeries;

interface Domain {
  log: boolean;
  from: number;
  to: number;
}

interface Tick {
  at: number;
  label: string;
}

interface Point {
  x: number;
  y: number;
}

interface Height {
  at: number;
  y: number;
}

const TOP = 18;
const PLOT_HEIGHT = 150;
const AXIS_BAND = 30;
const SIDE = 16;
const LN10 = Math.log(10);

function valueText(value: number): string {
  const size = Math.abs(value);
  return size >= 0.01 && size < 1e5 ? String(Number(value.toPrecision(3))) : sciText(value);
}

function curvePoints(summary: UncertaintyLawSummary): UncertaintyCurvePoint[] {
  return summary.curve.filter((point) => Number.isFinite(point.x)).sort((left, right) => left.x - right.x);
}

function summaryPoint(summary: UncertaintyLawSummary): number | undefined {
  const atom = summary.atoms[0];
  if (summary.atoms.length === 1 && atom !== undefined && atom.probability >= 1 - 1e-9) return atom.value;
  const { lower, upper } = summary.support;
  return lower !== null && lower === upper ? lower : undefined;
}

function pointOf(item: DistributionSeries): number | undefined {
  return "summary" in item ? summaryPoint(item.summary) : shapePoint(item.distribution);
}

function meanOf(item: DistributionSeries): number | undefined {
  return "summary" in item ? item.summary.mean : distributionMean(item.distribution);
}

function quantileOf(item: DistributionSeries, probability: number): number | undefined {
  if (!("summary" in item)) return distributionQuantile(item.distribution, probability);
  return item.summary.quantiles.find((entry) => entry.probability === probability)?.value;
}

function bounds(item: DistributionSeries): [number, number] | undefined {
  const point = pointOf(item);
  if (point !== undefined) return [point, point];
  if ("summary" in item) {
    const xs = [...curvePoints(item.summary).map((entry) => entry.x), ...item.summary.atoms.map((atom) => atom.value)].filter((x) => Number.isFinite(x));
    return xs.length === 0 ? undefined : [Math.min(...xs), Math.max(...xs)];
  }
  const low = distributionQuantile(item.distribution, 0.001);
  const high = distributionQuantile(item.distribution, 0.999);
  if (low === undefined || high === undefined || !Number.isFinite(low) || !Number.isFinite(high)) return undefined;
  return [low, high];
}

function chartDomain(series: readonly DistributionSeries[]): Domain | undefined {
  const all = series.flatMap((item) => {
    const range = bounds(item);
    return range === undefined ? [] : [range];
  });
  if (all.length === 0) return undefined;
  const low = Math.min(...all.map((range) => range[0]));
  const high = Math.max(...all.map((range) => range[1]));
  if (low > 0 && high / low >= 30) return { log: true, from: Math.log10(low) - 0.15, to: Math.log10(high) + 0.15 };
  const span = high - low;
  const pad = span > 0 ? span * 0.06 : Math.abs(high) > 0 ? Math.abs(high) * 0.1 : 1;
  return { log: false, from: low >= 0 ? Math.max(0, low - pad) : low - pad, to: high + pad };
}

function valueAt(domain: Domain, at: number): number {
  return domain.log ? 10 ** at : at;
}

function axisAt(domain: Domain, value: number): number {
  return domain.log ? Math.log10(value) : value;
}

function heightAt(domain: Domain, distribution: ParameterDistribution, value: number): number | undefined {
  const density = distributionDensity(distribution, value);
  if (density === undefined || !Number.isFinite(density)) return undefined;
  return domain.log ? density * value * LN10 : density;
}

function curveHeights(domain: Domain, summary: UncertaintyLawSummary): Height[] {
  return curvePoints(summary).flatMap((point) => {
    const density = point.density;
    if (density === null || !Number.isFinite(density) || (domain.log && !(point.x > 0))) return [];
    return [{ at: axisAt(domain, point.x), y: domain.log ? density * point.x * LN10 : density }];
  });
}

function heightBetween(heights: readonly Height[], at: number): number | undefined {
  const index = heights.findIndex((height) => height.at >= at);
  const right = heights[index];
  if (index === -1 || right === undefined) return undefined;
  if (right.at === at) return right.y;
  const left = heights[index - 1];
  if (left === undefined) return undefined;
  return left.y + ((right.y - left.y) * (at - left.at)) / (right.at - left.at);
}

function seriesHeights(domain: Domain, grid: readonly number[], item: DistributionSeries): Height[] {
  if (pointOf(item) !== undefined) return [];
  if ("summary" in item) return curveHeights(domain, item.summary);
  const distribution = item.distribution;
  return grid.flatMap((at) => {
    const y = heightAt(domain, distribution, valueAt(domain, at));
    return y === undefined ? [] : [{ at, y }];
  });
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function summaryShareBelow(summary: UncertaintyLawSummary, value: number): string {
  const point = summaryPoint(summary);
  if (point !== undefined) return percent(value >= point ? 1 : 0);
  const points = curvePoints(summary);
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return "—";
  const { lower, upper } = summary.support;
  if (value < first.x) return lower !== null && value <= lower ? percent(0) : `under ${percent(first.cumulative)}`;
  if (value > last.x) return upper !== null && value >= upper ? percent(1) : `over ${percent(last.cumulative)}`;
  const index = points.findIndex((entry) => entry.x >= value);
  const right = points[index];
  const left = points[index - 1];
  if (right === undefined) return "—";
  if (left === undefined || right.x === left.x) return percent(right.cumulative);
  return percent(left.cumulative + ((right.cumulative - left.cumulative) * (value - left.x)) / (right.x - left.x));
}

function shareBelow(item: DistributionSeries, value: number): string {
  if ("summary" in item) return summaryShareBelow(item.summary, value);
  const below = distributionCdf(item.distribution, value);
  return below === undefined ? "—" : percent(below);
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / power;
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
}

function chartTicks(domain: Domain, plotWidth: number): Tick[] {
  const room = Math.max(2, Math.floor(plotWidth / 64));
  let ticks: Tick[] = [];
  if (domain.log) {
    for (let power = Math.ceil(domain.from); power <= Math.floor(domain.to); power += 1) ticks.push({ at: power, label: sciText(10 ** power) });
    if (ticks.length < 3) {
      ticks = [];
      for (let power = Math.floor(domain.from); power <= Math.ceil(domain.to); power += 1) {
        for (const step of [1, 2, 5]) {
          const at = power + Math.log10(step);
          if (at >= domain.from && at <= domain.to) ticks.push({ at, label: sciText(step * 10 ** power) });
        }
      }
    }
  } else {
    const step = niceStep((domain.to - domain.from) / room);
    const values: number[] = [];
    for (let value = Math.ceil(domain.from / step) * step; value <= domain.to + step * 1e-9; value += step) values.push(Math.abs(value) < step * 1e-9 ? 0 : Number(value.toPrecision(12)));
    const largest = Math.max(...values.map((value) => Math.abs(value)));
    const plain = largest >= 0.01 && largest < 1e5;
    ticks = values.map((value) => ({ at: value, label: plain ? String(Number(value.toPrecision(6))) : sciText(value) }));
  }
  const every = Math.max(1, Math.ceil(ticks.length / room));
  return ticks.filter((_, index) => index % every === 0);
}

function linePath(points: readonly Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function summaryText(item: DistributionSeries): string {
  const point = pointOf(item);
  if (point !== undefined) return `Point value ${valueText(point)}`;
  const mean = meanOf(item);
  const p05 = quantileOf(item, 0.05);
  const median = quantileOf(item, 0.5);
  const p95 = quantileOf(item, 0.95);
  return [mean === undefined ? "" : `Mean ${valueText(mean)}`, p05 === undefined ? "" : `5th ${valueText(p05)}`, median === undefined ? "" : `median ${valueText(median)}`, p95 === undefined ? "" : `95th ${valueText(p95)}`].filter((part) => part.length > 0).join(" · ");
}

function useElementWidth(fallback: number): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const start = Math.round(node.getBoundingClientRect().width);
    if (start > 0) setWidth(start);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next !== undefined && next > 0) setWidth(Math.round(next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function DistributionChart({ series, focusKey, unit, onFocus }: { series: readonly DistributionSeries[]; focusKey?: string; unit: string; onFocus?: (key: string) => void }): JSX.Element {
  const [ref, measured] = useElementWidth(560);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const domain = chartDomain(series);
  if (domain === undefined || series.length === 0) return <p className="posmuted">No distribution to show.</p>;
  const width = Math.max(280, measured);
  const plotWidth = width - SIDE * 2;
  const height = TOP + PLOT_HEIGHT + AXIS_BAND;
  const baseline = TOP + PLOT_HEIGHT;
  const scaleX = (at: number): number => SIDE + ((at - domain.from) / (domain.to - domain.from)) * plotWidth;
  const samples = Math.max(60, Math.min(240, Math.round(plotWidth / 3)));
  const grid = Array.from({ length: samples + 1 }, (_, index) => domain.from + ((domain.to - domain.from) * index) / samples);
  const focused = series.find((item) => item.key === focusKey) ?? series[0];
  const curves = series.map((item) => ({ item, values: seriesHeights(domain, grid, item) }));
  const peak = Math.max(...curves.flatMap((curve) => curve.values.map((value) => value.y)).filter((value) => Number.isFinite(value)), 0);
  const scaleY = (y: number): number => baseline - (peak > 0 ? (y / peak) * PLOT_HEIGHT * 0.94 : 0);
  const ticks = chartTicks(domain, plotWidth);
  const ordered = [...curves.filter((curve) => curve.item.key !== focused?.key), ...curves.filter((curve) => curve.item.key === focused?.key)];
  const focusHeights = curves.find((curve) => curve.item.key === focused?.key)?.values ?? [];
  const focusHeight = (at: number): number | undefined => {
    if (focused === undefined) return undefined;
    return "summary" in focused ? heightBetween(focusHeights, at) : heightAt(domain, focused.distribution, valueAt(domain, at));
  };
  const bandLow = focused === undefined ? undefined : quantileOf(focused, 0.05);
  const bandHigh = focused === undefined ? undefined : quantileOf(focused, 0.95);
  const focusPoint = focused === undefined ? undefined : pointOf(focused);
  let band = "";
  if (focused !== undefined && focusPoint === undefined && bandLow !== undefined && bandHigh !== undefined && (!domain.log || bandLow > 0)) {
    const from = axisAt(domain, bandLow);
    const to = axisAt(domain, bandHigh);
    const steps = "summary" in focused ? focusHeights.map((value) => value.at) : grid;
    const inside = [from, ...steps.filter((at) => at > from && at < to), to].flatMap((at) => {
      const y = focusHeight(at);
      return y === undefined ? [] : [{ x: scaleX(at), y: scaleY(y) }];
    });
    const first = inside[0];
    const last = inside[inside.length - 1];
    if (first !== undefined && last !== undefined) band = `${linePath(inside)} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`;
  }
  const meanValue = focused === undefined || focusPoint !== undefined ? undefined : meanOf(focused);
  const meanHeight = meanValue === undefined || (domain.log && meanValue <= 0) ? undefined : focusHeight(axisAt(domain, meanValue));
  const cursorX = cursor === undefined ? undefined : scaleX(cursor);
  const cursorValue = cursor === undefined ? undefined : valueAt(domain, cursor);

  function moveTo(clientX: number, element: SVGSVGElement): void {
    const left = element.getBoundingClientRect().left;
    const at = domain === undefined ? undefined : domain.from + ((clientX - left - SIDE) / plotWidth) * (domain.to - domain.from);
    if (at !== undefined && domain !== undefined) setCursor(Math.min(domain.to, Math.max(domain.from, at)));
  }
  function onPointer(event: PointerEvent<SVGSVGElement>): void {
    moveTo(event.clientX, event.currentTarget);
  }
  function onKey(event: KeyboardEvent<SVGSVGElement>): void {
    if (domain === undefined) return;
    const step = (domain.to - domain.from) / 50;
    const start = cursor ?? (domain.from + domain.to) / 2;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setCursor(Math.min(domain.to, start + step));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setCursor(Math.max(domain.from, start - step));
    } else if (event.key === "Escape") setCursor(undefined);
  }

  return (
    <div className="da-dist" ref={ref}>
      <svg
        className="da-dist__svg"
        width={width}
        height={height}
        style={{ width: "100%", height: "auto" }}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Probability density of ${series.map((item) => item.label).join(", ")}, ${unit}, on a ${domain.log ? "logarithmic" : "linear"} axis`}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setCursor(undefined)}
        onKeyDown={onKey}
        onBlur={() => setCursor(undefined)}
      >
        <text className="da-dist__caption" x={SIDE} y={11}>{domain.log ? "Density per decade" : "Density"}</text>
        {band.length > 0 && <path className="da-dist__band" d={band} />}
        {ordered.map(({ item, values }) => {
          const isFocus = item.key === focused?.key;
          const point = pointOf(item);
          if (point !== undefined) {
            const x = scaleX(axisAt(domain, point));
            return (
              <g key={item.key}>
                <line className={`da-dist__line${isFocus ? " da-dist__line--focus" : ""}`} x1={x} x2={x} y1={baseline} y2={TOP + 6} />
                <circle className={`da-dist__dot${isFocus ? "" : " da-dist__dot--muted"}`} cx={x} cy={TOP + 6} r={4} />
              </g>
            );
          }
          return <path key={item.key} className={`da-dist__line${isFocus ? " da-dist__line--focus" : ""}`} d={linePath(values.map((value) => ({ x: scaleX(value.at), y: scaleY(value.y) })))} />;
        })}
        {meanValue !== undefined && meanHeight !== undefined && <circle className="da-dist__dot" cx={scaleX(axisAt(domain, meanValue))} cy={scaleY(meanHeight)} r={4} />}
        <line className="da-dist__axis" x1={SIDE} x2={width - SIDE} y1={baseline} y2={baseline} />
        {ticks.map((tick) => (
          <g key={tick.at}>
            <line className="da-dist__tick" x1={scaleX(tick.at)} x2={scaleX(tick.at)} y1={baseline} y2={baseline + 4} />
            <text className="da-dist__ticklabel" x={scaleX(tick.at)} y={baseline + 17} textAnchor="middle">{tick.label}</text>
          </g>
        ))}
        {cursorX !== undefined && <line className="da-dist__cross" x1={cursorX} x2={cursorX} y1={TOP} y2={baseline} />}
      </svg>
      {cursorX !== undefined && cursorValue !== undefined && (
        <div className="da-dist__tip" style={{ left: `${Math.min(Math.max(cursorX + 12, 0), Math.max(0, width - 230))}px` }}>
          <div className="da-dist__tip-value">{valueText(cursorValue)} {unit}</div>
          {series.map((item) => (
            <div key={item.key} className="da-dist__tip-row">
              <span className={`da-dist__key${item.key === focused?.key ? " da-dist__key--focus" : ""}`} />
              <span className="da-dist__tip-share">{shareBelow(item, cursorValue)}</span>
              <span>{series.length > 1 ? `below, ${item.label}` : "of the distribution lies below"}</span>
            </div>
          ))}
        </div>
      )}
      {series.length > 1 ? (
        <ul className="da-dist__legend">
          {series.map((item) => (
            <li key={item.key}>
              <button type="button" className="da-dist__item" aria-pressed={item.key === focused?.key} onClick={() => onFocus?.(item.key)}>
                <span className={`da-dist__key${item.key === focused?.key ? " da-dist__key--focus" : ""}`} />
                <span className="da-dist__item-label">{item.label}</span>
                <span className="da-dist__item-detail">{item.detail.length > 0 ? `${item.detail} · ` : ""}{summaryText(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        focused !== undefined && <p className="da-dist__summary">{summaryText(focused)} · {unit}</p>
      )}
    </div>
  );
}

export { DistributionChart, useElementWidth, type DistributionSeries };
