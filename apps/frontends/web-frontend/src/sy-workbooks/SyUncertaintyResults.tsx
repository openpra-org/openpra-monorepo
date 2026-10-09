import { useMemo, useState, type JSX } from "react";
import type { FaultTreeAnalysisResult, FaultTreeUncertaintyResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { UncertaintySamplingMethod } from "interfaces-shared-types/newly-developed-methods/shared";
import { ResultCsvButton } from "../newly-developed-methods/shared/resultPresentation";

interface UncertaintyResultEntry { modelId: string; label: string; distributionCount: number; result: FaultTreeAnalysisResult }

interface DecadeRange { low: number; high: number }

interface Marker { value: number; label: string }

type ChartView = "DISTRIBUTION" | "CUMULATIVE";

const SAMPLING_LABELS: Record<UncertaintySamplingMethod, string> = {
  MONTE_CARLO: "Monte Carlo",
  LATIN_HYPERCUBE: "Latin hypercube",
};

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
  return value !== undefined && Number.isFinite(value) ? value.toExponential(3).toUpperCase() : "—";
}

function quantileAt(uncertainty: FaultTreeUncertaintyResult, level: number): number | undefined {
  return uncertainty.quantiles.find((quantile) => Math.abs(quantile.probability - level) < 1e-9)?.value;
}

function decadeRange(values: readonly number[]): DecadeRange | undefined {
  const positive = values.filter((value) => value > 0 && Number.isFinite(value));
  if (positive.length === 0) return undefined;
  const low = Math.floor(Math.log10(Math.min(...positive)));
  const high = Math.ceil(Math.log10(Math.max(...positive)));
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

function DistributionChart({ uncertainty, point, view }: { uncertainty: FaultTreeUncertaintyResult; point: number; view: ChartView }): JSX.Element {
  const markers = useMemo<Marker[]>(() => [
    { value: quantileAt(uncertainty, 0.05), label: "5th" },
    { value: quantileAt(uncertainty, 0.5), label: "median" },
    { value: uncertainty.mean, label: "mean" },
    { value: quantileAt(uncertainty, 0.95), label: "95th" },
  ].flatMap((marker) => (marker.value !== undefined && marker.value > 0 ? [{ value: marker.value, label: marker.label }] : []))
    .sort((left, right) => left.value - right.value), [uncertainty]);
  const range = useMemo(() => decadeRange([...uncertainty.samples, point, ...markers.map((marker) => marker.value)]), [uncertainty.samples, point, markers]);
  const sorted = useMemo(() => [...uncertainty.samples].sort((left, right) => left - right), [uncertainty.samples]);
  const zeros = sorted.filter((sample) => !(sample > 0)).length;
  if (range === undefined) return <p className="syunc-result__note" role="status">Every sample is 0, so there is no spread to draw.</p>;
  const x = scale(range);
  const rows = labelRows(markers, x);
  const counts = view === "DISTRIBUTION" ? histogram(sorted, range) : [];
  const largest = Math.max(1, ...counts);
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
      <svg className="syunc-result__chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${label}, marked at the 5th percentile, median, mean, 95th percentile and point estimate`}>
        <line className="syunc-result__axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />
        {decadeTicks(range).map((decade) => (
          <text key={decade} className="syunc-result__tick" x={x(10 ** decade)} y={BASE + 16} textAnchor="middle">{`1E${decade}`}</text>
        ))}
        {counts.map((count, index) => (count === 0 ? null : (
          <rect key={index} className="syunc-result__bar" x={LEFT + index * binWidth + 1} y={BASE - (count / largest) * height} width={Math.max(1, binWidth - 2)} height={(count / largest) * height} />
        )))}
        {curve !== "" && <polyline className="syunc-result__curve" points={curve} />}
        {markers.map((marker, index) => (
          <g key={marker.label}>
            <line className="syunc-result__marker" x1={x(marker.value)} y1={TOP + 8 + (rows[index] ?? 0) * 12} x2={x(marker.value)} y2={BASE} />
            <text className="syunc-result__marker-label" x={x(marker.value)} y={TOP + 4 + (rows[index] ?? 0) * 12} textAnchor="middle">{marker.label}</text>
          </g>
        ))}
        {point > 0 && <>
          <line className="syunc-result__point" x1={x(point)} y1={PLOT_TOP - 4} x2={x(point)} y2={BASE} />
          <text className="syunc-result__point-label" x={x(point) + 4} y={PLOT_TOP + 6}>point</text>
        </>}
      </svg>
      {zeros > 0 && <p className="syunc-result__note">{`${zeros.toLocaleString()} sample${zeros === 1 ? " is" : "s are"} exactly 0 and not drawn on the log scale.`}</p>}
    </>
  );
}

function ResultCard({ entry }: { entry: UncertaintyResultEntry }): JSX.Element | null {
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
  return (
    <article id={`syunc-result-${entry.modelId}`} className="syunc-result" aria-label={`Uncertainty result for ${label}`}>
      <div className="syunc-result__head">
        <strong>{label}</strong>
        <span>{`${distributionCount} uncertain input${distributionCount === 1 ? "" : "s"}`}</span>
      </div>
      <div className="syunc-result__views" role="group" aria-label="Chart view">
        <button type="button" className="posnav__btn posnav__btn--sm" aria-pressed={view === "DISTRIBUTION"} onClick={() => setView("DISTRIBUTION")}>Distribution</button>
        <button type="button" className="posnav__btn posnav__btn--sm" aria-pressed={view === "CUMULATIVE"} onClick={() => setView("CUMULATIVE")}>Cumulative</button>
      </div>
      <DistributionChart uncertainty={uncertainty} point={result.topEventProbability} view={view} />
      <table className="syunc-result__values" aria-label={`Summary values for ${label}`}>
        <thead><tr>{values.map(({ name }) => <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody><tr>{values.map(({ name, value }) => <td key={name}>{probability(value)}</td>)}</tr></tbody>
      </table>
      <div className="syunc-result__details">
        <span>{`${uncertainty.sampleCount.toLocaleString()} ${SAMPLING_LABELS[uncertainty.samplingMethod]} samples · seed ${uncertainty.seed} · standard deviation ${probability(uncertainty.standardDeviation)} · standard error of the mean ${probability(uncertainty.standardError)}`}</span>
        <ResultCsvButton filename={`${label} samples.csv`} records={() => [...uncertainty.samples].sort((left, right) => left - right).map((value, index) => ({ rank: index + 1, top_event_probability: value }))} />
      </div>
    </article>
  );
}

function BatchSummary({ entries }: { entries: readonly UncertaintyResultEntry[] }): JSX.Element {
  const rows = entries.flatMap((entry) => {
    const uncertainty = entry.result.uncertainty;
    return uncertainty === undefined ? [] : [{ entry, uncertainty, low: quantileAt(uncertainty, 0.05), high: quantileAt(uncertainty, 0.95) }];
  });
  const range = decadeRange(rows.flatMap(({ entry, uncertainty, low, high }) => [entry.result.topEventProbability, uncertainty.mean, low ?? 0, high ?? 0]));
  const share = (value: number | undefined): number | undefined => (range === undefined || value === undefined || !(value > 0)
    ? undefined
    : ((Math.log10(value) - range.low) / (range.high - range.low)) * 100);
  return (
    <section className="syunc-batch" aria-label="Batch summary">
      <div className="syunc-batch__head">
        <strong>Batch summary</strong>
        <span>{`${rows.length} fault tree${rows.length === 1 ? "" : "s"}`}</span>
      </div>
      <div className="syunc-batch__grid">
        <span className="syunc-batch__label">Fault tree</span>
        <span className="syunc-batch__label">Point</span>
        <span className="syunc-batch__label">Mean</span>
        <span className="syunc-batch__label">5th to 95th percentile</span>
        {rows.map(({ entry, uncertainty, low, high }) => {
          const from = share(low);
          const to = share(high);
          const mean = share(uncertainty.mean);
          const point = share(entry.result.topEventProbability);
          return (
            <div key={entry.modelId} className="syunc-batch__row">
              <button type="button" className="syunc-batch__name" title={entry.label} onClick={() => document.getElementById(`syunc-result-${entry.modelId}`)?.scrollIntoView({ block: "start" })}>{entry.label}</button>
              <span className="syunc-batch__value">{probability(entry.result.topEventProbability)}</span>
              <span className="syunc-batch__value">{probability(uncertainty.mean)}</span>
              <span className="syunc-batch__track" aria-label={`5th percentile ${probability(low)}, 95th percentile ${probability(high)}`}>
                {from !== undefined && to !== undefined && <span className="syunc-batch__interval" style={{ left: `${from}%`, width: `${Math.max(0.5, to - from)}%` }} />}
                {mean !== undefined && <span className="syunc-batch__mean" style={{ left: `${mean}%` }} />}
                {point !== undefined && <span className="syunc-batch__point" style={{ left: `${point}%` }} />}
              </span>
            </div>
          );
        })}
        {range !== undefined && <>
          <span /><span /><span />
          <span className="syunc-batch__scale"><span>{`1E${range.low}`}</span><span>{`1E${range.high}`}</span></span>
        </>}
      </div>
    </section>
  );
}

function SyUncertaintyResults({ entries, batch }: { entries: readonly UncertaintyResultEntry[]; batch: boolean }): JSX.Element {
  return (
    <section className="syunc-results" aria-label="Uncertainty results">
      <h3>{batch ? "Analysis results" : "Analysis result"}</h3>
      {batch && entries.length > 1 && <BatchSummary entries={entries} />}
      {entries.map((entry) => <ResultCard key={entry.result.runId} entry={entry} />)}
    </section>
  );
}

export { SyUncertaintyResults, type UncertaintyResultEntry };
