import { useCallback, useMemo, useRef, useState, type JSX } from "react";
import type { FaultTreeAnalysisResult, FaultTreeUncertaintyResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { UncertaintySamplingMethod } from "interfaces-shared-types/newly-developed-methods/shared";
import { ResultCsvButton } from "../shared/resultPresentation";
import "./css/faultTreeUncertaintyResult.css";

interface FaultTreeUncertaintyEntry {
  result: FaultTreeAnalysisResult;
  label?: string;
  distributionCount?: number;
}

interface DecadeRange { low: number; high: number }

type ChartView = "DISTRIBUTION" | "CUMULATIVE";

const SAMPLING_LABELS: Record<UncertaintySamplingMethod, string> = {
  MONTE_CARLO: "Monte Carlo",
  LATIN_HYPERCUBE: "Latin hypercube",
};

const CHART_VIEWS: readonly { view: ChartView; label: string }[] = [
  { view: "DISTRIBUTION", label: "Distribution" },
  { view: "CUMULATIVE", label: "Cumulative" },
];

const DEFAULT_WIDTH = 640;
const CHART_HEIGHT = 220;
const PLOT_LEFT = 34;
const PLOT_RIGHT_GAP = 24;
const PLOT_TOP = 10;
const PLOT_BASE = 196;
const BIN_COUNT = 40;
const CURVE_POINTS = 240;

function probability(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? value.toExponential(3).toUpperCase() : "Not given";
}

function quantileAt(uncertainty: FaultTreeUncertaintyResult, level: number): number | undefined {
  return uncertainty.quantiles.find((quantile) => Math.abs(quantile.probability - level) < 1e-9)?.value;
}

function decadeRange(values: readonly number[]): DecadeRange | undefined {
  let smallest = Number.POSITIVE_INFINITY;
  let largest = 0;
  for (const value of values) {
    if (!(value > 0) || !Number.isFinite(value)) continue;
    if (value < smallest) smallest = value;
    if (value > largest) largest = value;
  }
  if (largest === 0) return undefined;
  const low = Math.floor(Math.log10(smallest));
  const high = Math.ceil(Math.log10(largest));
  return high > low ? { low, high } : { low: low - 1, high: low + 1 };
}

function decadeTicks(range: DecadeRange): number[] {
  const span = range.high - range.low;
  const step = span > 8 ? 2 : 1;
  return Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => range.low + index * step);
}

function histogram(samples: readonly number[], range: DecadeRange): number[] {
  const counts = new Array<number>(BIN_COUNT).fill(0);
  const width = (range.high - range.low) / BIN_COUNT;
  for (const sample of samples) {
    if (!(sample > 0)) continue;
    const index = Math.min(BIN_COUNT - 1, Math.floor((Math.log10(sample) - range.low) / width));
    if (index >= 0) counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

function largestCount(counts: readonly number[]): number {
  let largest = 1;
  for (const count of counts) if (count > largest) largest = count;
  return largest;
}

function sampleNote(uncertainty: FaultTreeUncertaintyResult, view: ChartView): string | undefined {
  const stored = uncertainty.samples.length;
  if (stored === 0) return `This result holds no samples, so the chart shows the summary values without the ${view === "DISTRIBUTION" ? "distribution" : "cumulative curve"}.`;
  if (stored < uncertainty.sampleCount) return `The chart draws the ${stored.toLocaleString()} stored samples of ${uncertainty.sampleCount.toLocaleString()}.`;
  return undefined;
}

function useChartWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const observer = useRef<ResizeObserver | null>(null);
  const attach = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (element === null) return;
    const measure = (): void => {
      const measured = Math.floor(element.getBoundingClientRect().width);
      if (measured > 0) setWidth(measured);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
  }, []);
  return [attach, width];
}

function DistributionChart({ uncertainty, point, view }: { uncertainty: FaultTreeUncertaintyResult; point: number; view: ChartView }): JSX.Element {
  const [attachFrame, width] = useChartWidth();
  const low = quantileAt(uncertainty, 0.05);
  const median = quantileAt(uncertainty, 0.5);
  const high = quantileAt(uncertainty, 0.95);
  const sorted = useMemo(() => [...uncertainty.samples].sort((left, right) => left - right), [uncertainty.samples]);
  const range = useMemo(() => decadeRange([...sorted, point, uncertainty.mean, low ?? 0, median ?? 0, high ?? 0]), [sorted, point, uncertainty.mean, low, median, high]);
  const zeros = sorted.filter((sample) => !(sample > 0)).length;
  const note = sampleNote(uncertainty, view);
  if (range === undefined) {
    return <p className="ftunc-result__note" role="status">{sorted.length > 0 ? "Every sample is 0, so there is no spread to draw." : "This result holds no samples and no value above 0 to draw."}</p>;
  }
  const right = Math.max(PLOT_LEFT + 80, width - PLOT_RIGHT_GAP);
  const x = (value: number): number => PLOT_LEFT + ((Math.log10(value) - range.low) / (range.high - range.low)) * (right - PLOT_LEFT);
  const y = (share: number): number => PLOT_BASE - share * (PLOT_BASE - PLOT_TOP);
  const counts = view === "DISTRIBUTION" && sorted.length > 0 ? histogram(sorted, range) : [];
  const largest = largestCount(counts);
  const binWidth = (right - PLOT_LEFT) / BIN_COUNT;
  const step = Math.max(1, Math.floor(sorted.length / CURVE_POINTS));
  const curve = view === "CUMULATIVE"
    ? sorted.flatMap((sample, index) => (sample > 0 && (index % step === 0 || index === sorted.length - 1)
      ? [`${x(sample).toFixed(1)},${y((index + 1) / sorted.length).toFixed(1)}`]
      : [])).join(" ")
    : "";
  const vertical = (value: number | undefined, className: string): JSX.Element | null => (value === undefined || !(value > 0)
    ? null
    : <line className={className} x1={x(value)} y1={PLOT_TOP} x2={x(value)} y2={PLOT_BASE} />);
  const label = view === "DISTRIBUTION"
    ? "Distribution of the sampled top event probability on a log scale"
    : "Cumulative share of samples against the top event probability on a log scale";
  return (
    <div className="ftunc-chart">
      <div ref={attachFrame} className="ftunc-chart__frame">
        <svg className="ftunc-chart__svg" width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`} role="img" aria-label={`${label}, marked at the 5th percentile, median, mean, 95th percentile and point estimate`}>
          {view === "CUMULATIVE" && [0, 0.5, 1].map((share) => (
            <g key={share}>
              <line className="ftunc-chart__grid" x1={PLOT_LEFT} y1={y(share)} x2={right} y2={y(share)} />
              <text className="ftunc-chart__number" x={PLOT_LEFT - 6} y={y(share) + 4} textAnchor="end">{share === 0.5 ? "0.5" : String(share)}</text>
            </g>
          ))}
          {counts.map((count, index) => (count === 0 ? null : (
            <rect key={index} className="ftunc-chart__bar" x={PLOT_LEFT + index * binWidth + 0.5} y={y(count / largest)} width={Math.max(1, binWidth - 1)} height={PLOT_BASE - y(count / largest)} />
          )))}
          {curve !== "" && <polyline className="ftunc-chart__curve" points={curve} />}
          {vertical(low, "ftunc-chart__percentile")}
          {vertical(high, "ftunc-chart__percentile")}
          {vertical(median, "ftunc-chart__median")}
          {vertical(uncertainty.mean, "ftunc-chart__mean")}
          {vertical(point, "ftunc-chart__point")}
          <line className="ftunc-chart__axis" x1={PLOT_LEFT} y1={PLOT_BASE} x2={right} y2={PLOT_BASE} />
          {decadeTicks(range).map((decade) => (
            <g key={decade}>
              <line className="ftunc-chart__axis" x1={x(10 ** decade)} y1={PLOT_BASE} x2={x(10 ** decade)} y2={PLOT_BASE + 4} />
              <text className="ftunc-chart__number" x={x(10 ** decade)} y={PLOT_BASE + 17} textAnchor="middle">{`1E${decade}`}</text>
            </g>
          ))}
        </svg>
      </div>
      <ul className="ftunc-chart__legend" aria-label="Chart legend">
        <li><span className="ftunc-chart__key ftunc-chart__key--percentile" aria-hidden="true" />5th and 95th percentiles</li>
        <li><span className="ftunc-chart__key ftunc-chart__key--median" aria-hidden="true" />Median</li>
        <li><span className="ftunc-chart__key ftunc-chart__key--mean" aria-hidden="true" />Mean</li>
        <li><span className="ftunc-chart__key ftunc-chart__key--point" aria-hidden="true" />Point estimate</li>
      </ul>
      {note !== undefined && <p className="ftunc-result__note" role="status">{note}</p>}
      {zeros > 0 && <p className="ftunc-result__note">{`${zeros.toLocaleString()} sample${zeros === 1 ? " is" : "s are"} exactly 0 and not drawn on the log scale.`}</p>}
    </div>
  );
}

function resultAnchor(result: FaultTreeAnalysisResult): string {
  return `ftunc-result-${result.runId}`;
}

function FaultTreeUncertaintyCard({ entry }: { entry: FaultTreeUncertaintyEntry }): JSX.Element | null {
  const [view, setView] = useState<ChartView>("DISTRIBUTION");
  const { label, distributionCount, result } = entry;
  const uncertainty = result.uncertainty;
  if (uncertainty === undefined) return null;
  const values = [
    { name: "Point estimate", value: result.topEventProbability },
    { name: "5th percentile", value: quantileAt(uncertainty, 0.05) },
    { name: "Median", value: quantileAt(uncertainty, 0.5) },
    { name: "Mean", value: uncertainty.mean },
    { name: "95th percentile", value: quantileAt(uncertainty, 0.95) },
  ];
  const samples = uncertainty.samples;
  return (
    <article id={resultAnchor(result)} className="ftunc-result" aria-label={label === undefined ? "Uncertainty result" : `Uncertainty result for ${label}`}>
      <div className="ftunc-result__views" role="group" aria-label="Chart view">
        {CHART_VIEWS.map((option) => (
          <button key={option.view} type="button" className="ftunc-result__view" aria-pressed={view === option.view} onClick={() => setView(option.view)}>{option.label}</button>
        ))}
      </div>
      <DistributionChart uncertainty={uncertainty} point={result.topEventProbability} view={view} />
      <table className="ftunc-result__values" aria-label={label === undefined ? "Summary values" : `Summary values for ${label}`}>
        <thead><tr>{values.map(({ name }) => <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody><tr>{values.map(({ name, value }) => <td key={name}>{probability(value)}</td>)}</tr></tbody>
      </table>
      <div className="ftunc-result__details">
        <span>{`${distributionCount === undefined ? "" : `${distributionCount} uncertain input${distributionCount === 1 ? "" : "s"} · `}${uncertainty.sampleCount.toLocaleString()} ${SAMPLING_LABELS[uncertainty.samplingMethod]} samples · seed ${uncertainty.seed} · standard deviation ${probability(uncertainty.standardDeviation)} · standard error of the mean ${probability(uncertainty.standardError)}`}</span>
        {samples.length > 0 && <ResultCsvButton filename={`${label ?? `ft-${result.runId}`} samples.csv`} records={() => [...samples].sort((left, right) => left - right).map((value, index) => ({ rank: index + 1, top_event_probability: value }))} />}
      </div>
    </article>
  );
}

function FaultTreeUncertaintyBatch({ entries }: { entries: readonly FaultTreeUncertaintyEntry[] }): JSX.Element {
  const rows = entries.flatMap((entry) => {
    const uncertainty = entry.result.uncertainty;
    return uncertainty === undefined ? [] : [{ entry, name: entry.label ?? entry.result.owner.modelId, uncertainty, low: quantileAt(uncertainty, 0.05), high: quantileAt(uncertainty, 0.95) }];
  });
  const range = decadeRange(rows.flatMap(({ entry, uncertainty, low, high }) => [entry.result.topEventProbability, uncertainty.mean, low ?? 0, high ?? 0]));
  const share = (value: number | undefined): number | undefined => (range === undefined || value === undefined || !(value > 0)
    ? undefined
    : ((Math.log10(value) - range.low) / (range.high - range.low)) * 100);
  return (
    <section className="ftunc-batch" aria-label="Batch summary">
      <div className="ftunc-batch__head">
        <strong>Batch summary</strong>
        <span>{`${rows.length} fault tree${rows.length === 1 ? "" : "s"}`}</span>
      </div>
      <div className="ftunc-batch__grid">
        <span className="ftunc-batch__label">Fault tree</span>
        <span className="ftunc-batch__label">Point</span>
        <span className="ftunc-batch__label">Mean</span>
        <span className="ftunc-batch__label">5th to 95th percentile</span>
        {rows.map(({ entry, name, uncertainty, low, high }) => {
          const from = share(low);
          const to = share(high);
          const mean = share(uncertainty.mean);
          const point = share(entry.result.topEventProbability);
          return (
            <div key={entry.result.runId} className="ftunc-batch__row">
              <button type="button" className="ftunc-batch__name" title={name} onClick={() => document.getElementById(resultAnchor(entry.result))?.scrollIntoView({ block: "start" })}>{name}</button>
              <span className="ftunc-batch__value">{probability(entry.result.topEventProbability)}</span>
              <span className="ftunc-batch__value">{probability(uncertainty.mean)}</span>
              <span className="ftunc-batch__track" aria-label={`5th percentile ${probability(low)}, 95th percentile ${probability(high)}`}>
                {from !== undefined && to !== undefined && <span className="ftunc-batch__interval" style={{ left: `${from}%`, width: `${Math.max(0.5, to - from)}%` }} />}
                {mean !== undefined && <span className="ftunc-batch__mean" style={{ left: `${mean}%` }} />}
                {point !== undefined && <span className="ftunc-batch__point" style={{ left: `${point}%` }} />}
              </span>
            </div>
          );
        })}
        {range !== undefined && <>
          <span /><span /><span />
          <span className="ftunc-batch__scale"><span>{`1E${range.low}`}</span><span>{`1E${range.high}`}</span></span>
        </>}
      </div>
    </section>
  );
}

function FaultTreeUncertaintyResults({ entries, batch }: { entries: readonly FaultTreeUncertaintyEntry[]; batch: boolean }): JSX.Element {
  return (
    <section className="ftunc-results" aria-label="Uncertainty results">
      <h3>{batch ? "Analysis results" : "Analysis result"}</h3>
      {batch && entries.length > 1 && <FaultTreeUncertaintyBatch entries={entries} />}
      {entries.map((entry) => <FaultTreeUncertaintyCard key={entry.result.runId} entry={entry} />)}
    </section>
  );
}

export { FaultTreeUncertaintyCard, FaultTreeUncertaintyResults, type FaultTreeUncertaintyEntry };
