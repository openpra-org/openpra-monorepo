import { useMemo, useState, type JSX } from "react";
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

interface Marker { value: number; label: string }

type ChartView = "DISTRIBUTION" | "CUMULATIVE";

const SAMPLING_LABELS: Record<UncertaintySamplingMethod, string> = {
  MONTE_CARLO: "Monte Carlo",
  LATIN_HYPERCUBE: "Latin hypercube",
};

const CHART_VIEWS: readonly { view: ChartView; label: string }[] = [
  { view: "DISTRIBUTION", label: "Distribution" },
  { view: "CUMULATIVE", label: "Cumulative" },
];

const WIDTH = 640;
const HEIGHT = 190;
const LEFT = 36;
const RIGHT = 616;
const TOP = 14;
const BASE = 160;
const PLOT_TOP = TOP + 30;
const BIN_COUNT = 40;
const CURVE_POINTS = 240;
const LABEL_GAP = 46;

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

function scale(range: DecadeRange): (value: number) => number {
  return (value) => LEFT + ((Math.log10(value) - range.low) / (range.high - range.low)) * (RIGHT - LEFT);
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

function labelRows(markers: readonly Marker[], x: (value: number) => number): number[] {
  const rows: number[] = [];
  const lastInRow = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const marker of markers) {
    const position = x(marker.value);
    const row = position - (lastInRow[0] ?? Number.NEGATIVE_INFINITY) >= LABEL_GAP ? 0 : 1;
    lastInRow[row] = position;
    rows.push(row);
  }
  return rows;
}

function sampleNote(uncertainty: FaultTreeUncertaintyResult, view: ChartView): string | undefined {
  const stored = uncertainty.samples.length;
  if (stored === 0) return `This result holds no samples, so the chart shows the summary values without the ${view === "DISTRIBUTION" ? "distribution" : "cumulative curve"}.`;
  if (stored < uncertainty.sampleCount) return `The chart draws the ${stored.toLocaleString()} stored samples of ${uncertainty.sampleCount.toLocaleString()}.`;
  return undefined;
}

function DistributionChart({ uncertainty, point, view }: { uncertainty: FaultTreeUncertaintyResult; point: number; view: ChartView }): JSX.Element {
  const markers = useMemo<Marker[]>(() => [
    { value: quantileAt(uncertainty, 0.05), label: "5th" },
    { value: quantileAt(uncertainty, 0.5), label: "median" },
    { value: uncertainty.mean, label: "mean" },
    { value: quantileAt(uncertainty, 0.95), label: "95th" },
  ].flatMap((marker) => (marker.value !== undefined && marker.value > 0 ? [{ value: marker.value, label: marker.label }] : []))
    .sort((left, right) => left.value - right.value), [uncertainty]);
  const sorted = useMemo(() => [...uncertainty.samples].sort((left, right) => left - right), [uncertainty.samples]);
  const range = useMemo(() => decadeRange([...sorted, point, ...markers.map((marker) => marker.value)]), [sorted, point, markers]);
  const zeros = sorted.filter((sample) => !(sample > 0)).length;
  const note = sampleNote(uncertainty, view);
  if (range === undefined) {
    return <p className="ftunc-result__note" role="status">{sorted.length > 0 ? "Every sample is 0, so there is no spread to draw." : "This result holds no samples and no value above 0 to draw."}</p>;
  }
  const x = scale(range);
  const rows = labelRows(markers, x);
  const counts = view === "DISTRIBUTION" && sorted.length > 0 ? histogram(sorted, range) : [];
  const largest = largestCount(counts);
  const binWidth = (RIGHT - LEFT) / BIN_COUNT;
  const height = BASE - PLOT_TOP;
  const step = Math.max(1, Math.floor(sorted.length / CURVE_POINTS));
  const curve = view === "CUMULATIVE"
    ? sorted.flatMap((sample, index) => (sample > 0 && (index % step === 0 || index === sorted.length - 1)
      ? [`${x(sample).toFixed(1)},${(BASE - ((index + 1) / sorted.length) * height).toFixed(1)}`]
      : [])).join(" ")
    : "";
  const label = view === "DISTRIBUTION"
    ? "Distribution of the sampled top event probability on a log scale"
    : "Cumulative share of samples against the top event probability on a log scale";
  return (
    <>
      <svg className="ftunc-result__chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${label}, marked at the 5th percentile, median, mean, 95th percentile and point estimate`}>
        <line className="ftunc-result__axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />
        {decadeTicks(range).map((decade) => (
          <text key={decade} className="ftunc-result__tick" x={x(10 ** decade)} y={BASE + 16} textAnchor="middle">{`1E${decade}`}</text>
        ))}
        {counts.map((count, index) => (count === 0 ? null : (
          <rect key={index} className="ftunc-result__bar" x={LEFT + index * binWidth + 1} y={BASE - (count / largest) * height} width={Math.max(1, binWidth - 2)} height={(count / largest) * height} />
        )))}
        {curve !== "" && <polyline className="ftunc-result__curve" points={curve} />}
        {markers.map((marker, index) => (
          <g key={marker.label}>
            <line className="ftunc-result__marker" x1={x(marker.value)} y1={TOP + 8 + (rows[index] ?? 0) * 12} x2={x(marker.value)} y2={BASE} />
            <text className="ftunc-result__marker-label" x={x(marker.value)} y={TOP + 4 + (rows[index] ?? 0) * 12} textAnchor="middle">{marker.label}</text>
          </g>
        ))}
        {point > 0 && <>
          <line className="ftunc-result__point" x1={x(point)} y1={PLOT_TOP - 4} x2={x(point)} y2={BASE} />
          <text className="ftunc-result__point-label" x={x(point) + 4} y={PLOT_TOP + 6}>point</text>
        </>}
      </svg>
      {note !== undefined && <p className="ftunc-result__note" role="status">{note}</p>}
      {zeros > 0 && <p className="ftunc-result__note">{`${zeros.toLocaleString()} sample${zeros === 1 ? " is" : "s are"} exactly 0 and not drawn on the log scale.`}</p>}
    </>
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
      <div className="ftunc-result__head">
        <strong>{label ?? "Uncertainty"}</strong>
        {distributionCount !== undefined && <span>{`${distributionCount} uncertain input${distributionCount === 1 ? "" : "s"}`}</span>}
      </div>
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
        <span>{`${uncertainty.sampleCount.toLocaleString()} ${SAMPLING_LABELS[uncertainty.samplingMethod]} samples · seed ${uncertainty.seed} · standard deviation ${probability(uncertainty.standardDeviation)} · standard error of the mean ${probability(uncertainty.standardError)}`}</span>
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
