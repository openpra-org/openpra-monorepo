import { type JSX } from "react";
import { z } from "zod";
import type { EsqUncertaintyHistogram } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { ResultCsvButton } from "../newly-developed-methods/shared/resultPresentation";
import { jsonView, useWorkbookView } from "../workbooks/workbookViewMemory";
import { sciText, useElementWidth } from "./esqShared";
import "./css/esqUncertaintyResult.css";

interface EsqUncertaintyDistribution {
  label: string;
  point: number;
  mean: number;
  p05: number;
  p50: number;
  p95: number;
  histogram: EsqUncertaintyHistogram | null;
  quantiles: readonly number[];
  trials: number;
  values?: readonly number[];
}

interface DecadeRange {
  low: number;
  high: number;
}

type ChartView = "DISTRIBUTION" | "CUMULATIVE";

const CHART_VIEWS: readonly (readonly [ChartView, string])[] = [["DISTRIBUTION", "Distribution"], ["CUMULATIVE", "Cumulative"]];

const CHART_VIEW = jsonView<ChartView>(z.enum(["DISTRIBUTION", "CUMULATIVE"]));

const DEFAULT_WIDTH = 640;
const CHART_HEIGHT = 220;
const PLOT_LEFT = 34;
const PLOT_RIGHT_GAP = 24;
const PLOT_TOP = 10;
const PLOT_BASE = 196;

function decadeRange(values: readonly number[], histogram: EsqUncertaintyHistogram | null): DecadeRange | undefined {
  let low = histogram?.low ?? Number.POSITIVE_INFINITY;
  let high = histogram?.high ?? Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!(value > 0) || !Number.isFinite(value)) continue;
    low = Math.min(low, Math.floor(Math.log10(value)));
    high = Math.max(high, Math.ceil(Math.log10(value)));
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return undefined;
  return high > low ? { low, high } : { low: low - 1, high: low + 1 };
}

function decadeTicks(range: DecadeRange): number[] {
  const span = range.high - range.low;
  const step = span > 8 ? 2 : 1;
  return Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => range.low + index * step);
}

function tallest(counts: readonly number[]): number {
  let largest = 1;
  for (const count of counts) if (count > largest) largest = count;
  return largest;
}

function DistributionChart({ distribution, view, width }: { distribution: EsqUncertaintyDistribution; view: ChartView; width: number }): JSX.Element {
  const histogram = distribution.histogram;
  const quantiles = distribution.quantiles;
  const range = decadeRange([distribution.point, distribution.mean, distribution.p05, distribution.p50, distribution.p95, ...quantiles], histogram);
  if (range === undefined) return <p className="esq-unc-result__note" role="status">Every value is 0, so there is no spread to draw.</p>;
  const right = Math.max(PLOT_LEFT + 80, width - PLOT_RIGHT_GAP);
  const at = (decades: number): number => PLOT_LEFT + ((decades - range.low) / (range.high - range.low)) * (right - PLOT_LEFT);
  const x = (value: number): number => at(Math.log10(value));
  const y = (share: number): number => PLOT_BASE - share * (PLOT_BASE - PLOT_TOP);
  const counts = view === "DISTRIBUTION" && histogram !== null ? histogram.counts : [];
  const largest = tallest(counts);
  const step = histogram === null || counts.length === 0 ? 0 : (histogram.high - histogram.low) / counts.length;
  const last = quantiles.length - 1;
  const curve = view === "CUMULATIVE" && last > 0
    ? quantiles.flatMap((value, index) => (value > 0 ? [`${x(value).toFixed(1)},${y(index / last).toFixed(1)}`] : [])).join(" ")
    : "";
  const marker = (value: number, className: string): JSX.Element | null => (value > 0 ? <line className={className} x1={x(value)} y1={PLOT_TOP} x2={x(value)} y2={PLOT_BASE} /> : null);
  const label = view === "DISTRIBUTION"
    ? `Distribution of the sampled frequency of ${distribution.label} on a log scale`
    : `Cumulative share of trials against the frequency of ${distribution.label} on a log scale`;
  return (
    <svg className="esq-unc-chart__svg" width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`} role="img" aria-label={`${label}, marked at the 5th percentile, median, mean, 95th percentile and point estimate`}>
      {view === "CUMULATIVE" && [0, 0.5, 1].map((share) => (
        <g key={share}>
          <line className="esq-unc-chart__grid" x1={PLOT_LEFT} y1={y(share)} x2={right} y2={y(share)} />
          <text className="esq-unc-chart__number" x={PLOT_LEFT - 6} y={y(share) + 4} textAnchor="end">{String(share)}</text>
        </g>
      ))}
      {histogram !== null && counts.map((count, index) => {
        if (count === 0) return null;
        const start = at(histogram.low + index * step);
        const end = at(histogram.low + (index + 1) * step);
        return <rect key={index} className="esq-unc-chart__bar" x={start + 0.5} y={y(count / largest)} width={Math.max(1, end - start - 1)} height={PLOT_BASE - y(count / largest)} />;
      })}
      {curve !== "" && <polyline className="esq-unc-chart__curve" points={curve} />}
      {marker(distribution.p05, "esq-unc-chart__percentile")}
      {marker(distribution.p95, "esq-unc-chart__percentile")}
      {marker(distribution.p50, "esq-unc-chart__median")}
      {marker(distribution.mean, "esq-unc-chart__mean")}
      {marker(distribution.point, "esq-unc-chart__point")}
      <line className="esq-unc-chart__axis" x1={PLOT_LEFT} y1={PLOT_BASE} x2={right} y2={PLOT_BASE} />
      {decadeTicks(range).map((decade) => (
        <g key={decade}>
          <line className="esq-unc-chart__axis" x1={at(decade)} y1={PLOT_BASE} x2={at(decade)} y2={PLOT_BASE + 4} />
          <text className="esq-unc-chart__number" x={at(decade)} y={PLOT_BASE + 17} textAnchor="middle">{`1E${decade}`}</text>
        </g>
      ))}
    </svg>
  );
}

function EsqUncertaintyCard({ distribution, details }: { distribution: EsqUncertaintyDistribution; details: string }): JSX.Element {
  const [view, setView] = useWorkbookView<ChartView>("uncertainty.chart", "DISTRIBUTION", CHART_VIEW);
  const [frameRef, width] = useElementWidth(DEFAULT_WIDTH);
  const zeros = distribution.histogram?.zeros ?? 0;
  const values = distribution.values ?? [];
  const summary = [
    { name: "Point estimate", value: distribution.point },
    { name: "5th percentile", value: distribution.p05 },
    { name: "Median", value: distribution.p50 },
    { name: "Mean", value: distribution.mean },
    { name: "95th percentile", value: distribution.p95 },
  ];
  return (
    <article className="esq-unc-result" aria-label={`Uncertainty result for ${distribution.label}`}>
      <div className="esq-unc-result__views" role="group" aria-label="Chart view">
        {CHART_VIEWS.map(([option, text]) => (
          <button key={option} type="button" className="esq-unc-result__view" aria-pressed={view === option} onClick={() => setView(option)}>{text}</button>
        ))}
      </div>
      <div className="esq-unc-chart">
        <div ref={frameRef} className="esq-unc-chart__frame">
          <DistributionChart distribution={distribution} view={view} width={width} />
        </div>
        <ul className="esq-unc-chart__legend" aria-label="Chart legend">
          <li><span className="esq-unc-chart__key esq-unc-chart__key--percentile" aria-hidden="true" />5th and 95th percentiles</li>
          <li><span className="esq-unc-chart__key esq-unc-chart__key--median" aria-hidden="true" />Median</li>
          <li><span className="esq-unc-chart__key esq-unc-chart__key--mean" aria-hidden="true" />Mean</li>
          <li><span className="esq-unc-chart__key esq-unc-chart__key--point" aria-hidden="true" />Point estimate</li>
        </ul>
        {zeros > 0 && <p className="esq-unc-result__note">{`${zeros.toLocaleString()} trial${zeros === 1 ? " is" : "s are"} exactly 0 and not drawn on the log scale.`}</p>}
      </div>
      <table className="esq-unc-result__values" aria-label={`Summary values for ${distribution.label}`}>
        <thead><tr>{summary.map(({ name }) => <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody><tr>{summary.map(({ name, value }) => <td key={name}>{sciText(value)}</td>)}</tr></tbody>
      </table>
      <p className="esq-unc-result__note">{`The point estimate uses every input at its point value, the mean averages all ${distribution.trials.toLocaleString()} trials, and nine in ten trials fall between the 5th and 95th percentiles.`}</p>
      <div className="esq-unc-result__details">
        <span>{details}</span>
        {values.length > 0 && <ResultCsvButton filename={`${distribution.label} trials.csv`} records={() => values.map((value, index) => ({ trial: index + 1, frequency_per_year: value }))} />}
      </div>
    </article>
  );
}

export { EsqUncertaintyCard, type EsqUncertaintyDistribution };
