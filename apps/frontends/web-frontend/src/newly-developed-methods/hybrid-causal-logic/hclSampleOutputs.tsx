import { useState, type JSX } from "react";
import type { BaseLaw, MixtureLaw } from "interfaces-mef-types/core/uncertainty";
import type {
  HclDistributionFit,
  HclExceedancePoint,
  HclFitFamily,
  HclHazardExceedancePoint,
  HclHistogram,
  HclSampleVector,
  HclUncertaintyAdjustments,
  HclUncertaintySummary,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { getAnalysisRunSamples, type AnalysisHost } from "../shared/analysisRunWait";
import { downloadResultCsv, type ResultCsvRecord } from "../shared/resultCsv";
import { ResultCsvButton } from "../shared/resultPresentation";
import { lawText, numberText } from "../shared/uncertainText";
import "./css/hclSampleOutputs.css";

type ChartView = "DISTRIBUTION" | "EXCEEDANCE";

interface DecadeRange {
  low: number;
  high: number;
}

const FIT_FAMILY_TEXT: Record<HclFitFamily, string> = {
  BETA: "Beta",
  LOGIT_NORMAL: "Logit-normal",
  ZERO_ONE_INFLATED_BETA: "Zero and one inflated beta",
  ZERO_ONE_INFLATED_LOGIT_NORMAL: "Zero and one inflated logit-normal",
  LOGNORMAL: "Lognormal",
  GAMMA: "Gamma",
  ZERO_INFLATED_LOGNORMAL: "Zero inflated lognormal",
  ZERO_INFLATED_GAMMA: "Zero inflated gamma",
};

const CHART_WIDTH = 560;
const CHART_HEIGHT = 196;
const PLOT_LEFT = 48;
const PLOT_RIGHT = 548;
const PLOT_TOP = 12;
const PLOT_BASE = 168;
const TICKS = 4;

function counted(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

function axisText(value: number): string {
  return value === 0 ? "0" : value.toExponential(1).toUpperCase();
}

function criterionText(value: number): string {
  return String(Number(value.toPrecision(6)));
}

function fitLawText(law: BaseLaw | MixtureLaw): string {
  if (law.family !== "MIXTURE") return lawText(law);
  return law.components
    .map((component) => (component.law.family === "POINT"
      ? `${numberText(component.weight)} at ${numberText(component.law.value)}`
      : `${numberText(component.weight)} × ${lawText(component.law)}`))
    .join(" + ");
}

function decadeRange(values: readonly number[]): DecadeRange | undefined {
  const positive = values.filter((value) => value > 0 && Number.isFinite(value));
  if (positive.length === 0) return undefined;
  const low = Math.floor(Math.log10(Math.min(...positive)));
  const high = Math.ceil(Math.log10(Math.max(...positive)));
  return high > low ? { low, high } : { low: low - 1, high: low + 1 };
}

function decades(range: DecadeRange): number[] {
  const span = range.high - range.low;
  const step = span > 8 ? 2 : 1;
  return Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => range.low + index * step);
}

function sampleRecords(vectors: readonly HclSampleVector[], columnName: (vector: HclSampleVector) => string): ResultCsvRecord[] {
  const used = new Set<string>();
  const columns = vectors.map((vector) => {
    const name = columnName(vector);
    const unique = used.has(name) ? `${name} (${vector.id})` : name;
    used.add(unique);
    return { name: unique, values: vector.values };
  });
  const length = Math.max(0, ...vectors.map((vector) => vector.values.length));
  const records: ResultCsvRecord[] = [];
  for (let index = 0; index < length; index += 1) {
    const record: ResultCsvRecord = { sample: index + 1 };
    for (const column of columns) record[column.name] = column.values[index];
    records.push(record);
  }
  return records;
}

function HclAdjustments({ adjustments }: { adjustments: HclUncertaintyAdjustments | undefined }): JSX.Element | null {
  if (adjustments === undefined) return null;
  const parts = [
    adjustments.clippedProbabilities > 0 ? `${counted(adjustments.clippedProbabilities, "sampled probability", "sampled probabilities")} clipped to 0 or 1` : "",
    adjustments.epsilonAdjustedCptValues > 0 ? `${counted(adjustments.epsilonAdjustedCptValues, "CPT value", "CPT values")} raised to the CPT floor` : "",
    adjustments.zeroProbabilityContexts > 0 ? `${counted(adjustments.zeroProbabilityContexts, "zero-probability context", "zero-probability contexts")} counted as 0` : "",
  ].filter((part) => part !== "");
  if (parts.length === 0) return null;
  return <p className="hclsamples__adjustments">{parts.join(" · ")}</p>;
}

function HclSampleChart({ summary, histogram, exceedance, unit }: {
  summary: HclUncertaintySummary;
  histogram: HclHistogram;
  exceedance: readonly HclExceedancePoint[];
  unit: string;
}): JSX.Element {
  const [view, setView] = useState<ChartView>("DISTRIBUTION");
  const low = histogram.edges[0] ?? 0;
  const high = histogram.edges[histogram.edges.length - 1] ?? low;
  const span = high > low ? high - low : 1;
  const x = (value: number): number => PLOT_LEFT + ((value - low) / span) * (PLOT_RIGHT - PLOT_LEFT);
  const y = (share: number): number => PLOT_BASE - share * (PLOT_BASE - PLOT_TOP);
  const largest = Math.max(0, ...histogram.densities);
  const ticks = Array.from({ length: TICKS + 1 }, (_, index) => low + (index / TICKS) * (high - low));
  const curve = exceedance.map((point) => `${x(point.value).toFixed(1)},${y(point.probability).toFixed(1)}`).join(" ");
  const marker = (value: number, className: string): JSX.Element | null => (value < low || value > high
    ? null
    : <line className={className} x1={x(value)} y1={PLOT_TOP} x2={x(value)} y2={PLOT_BASE} />);
  const label = view === "DISTRIBUTION"
    ? `Histogram of the ${counted(summary.sampleCount, "PRAXIS sample", "PRAXIS samples")}`
    : `Share of the ${counted(summary.sampleCount, "PRAXIS sample", "PRAXIS samples")} at or above each value`;
  return (
    <div className="hclsamples__chart">
      <div className="hclsamples__views" role="group" aria-label="Chart view">
        <button type="button" className="hclsamples__view" aria-pressed={view === "DISTRIBUTION"} onClick={() => setView("DISTRIBUTION")}>Distribution</button>
        <button type="button" className="hclsamples__view" aria-pressed={view === "EXCEEDANCE"} disabled={exceedance.length === 0} onClick={() => setView("EXCEEDANCE")}>Exceedance</button>
      </div>
      <svg className="hclsamples__svg" viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`} role="img" aria-label={`${label}, marked at the 5th percentile, median, mean and 95th percentile`}>
        {view === "EXCEEDANCE" && [0, 0.5, 1].map((share) => (
          <g key={share}>
            <line className="hclsamples__grid" x1={PLOT_LEFT} y1={y(share)} x2={PLOT_RIGHT} y2={y(share)} />
            <text className="hclsamples__number" x={PLOT_LEFT - 6} y={y(share) + 3} textAnchor="end">{String(share)}</text>
          </g>
        ))}
        {view === "DISTRIBUTION" && histogram.densities.map((density, index) => {
          if (!(density > 0) || largest === 0) return null;
          const left = x(histogram.edges[index] ?? low);
          const right = x(histogram.edges[index + 1] ?? high);
          const top = y(density / largest);
          return <rect key={index} className="hclsamples__bar" x={left + 0.5} y={top} width={Math.max(1, right - left - 1)} height={PLOT_BASE - top} />;
        })}
        {view === "EXCEEDANCE" && curve !== "" && <polyline className="hclsamples__curve" points={curve} />}
        {marker(summary.percentile05, "hclsamples__percentile")}
        {marker(summary.percentile95, "hclsamples__percentile")}
        {marker(summary.median, "hclsamples__median")}
        {marker(summary.mean, "hclsamples__mean")}
        <line className="hclsamples__axis" x1={PLOT_LEFT} y1={PLOT_BASE} x2={PLOT_RIGHT} y2={PLOT_BASE} />
        {ticks.map((value, index) => (
          <g key={index}>
            <line className="hclsamples__axis" x1={x(value)} y1={PLOT_BASE} x2={x(value)} y2={PLOT_BASE + 4} />
            <text className="hclsamples__number" x={x(value)} y={PLOT_BASE + 16} textAnchor={index === 0 ? "start" : index === TICKS ? "end" : "middle"}>
              {`${axisText(value)}${index === TICKS ? unit : ""}`}
            </text>
          </g>
        ))}
      </svg>
      <ul className="hclsamples__legend" aria-label="Chart legend">
        <li><span className="hclsamples__key hclsamples__key--percentile" aria-hidden="true" />5th and 95th percentiles</li>
        <li><span className="hclsamples__key hclsamples__key--median" aria-hidden="true" />Median</li>
        <li><span className="hclsamples__key hclsamples__key--mean" aria-hidden="true" />Mean</li>
      </ul>
    </div>
  );
}

function HclFitTable({ fit }: { fit: HclDistributionFit }): JSX.Element {
  const rejected = fit.rejected ?? [];
  const counts = [
    `Fitted to ${counted(fit.samples, "sample", "samples")}`,
    fit.zeroSamples > 0 ? `${fit.zeroSamples.toLocaleString()} at 0` : "",
    fit.oneSamples > 0 ? `${fit.oneSamples.toLocaleString()} at 1` : "",
  ].filter((part) => part !== "");
  return (
    <section className="hclsamples__fit" aria-label="Distribution fit">
      <p className="hclsamples__fit-head">{counts.join(" · ")}</p>
      {fit.candidates.length > 0 && (
        <div className="hclsamples__table">
          <table>
            <thead>
              <tr>
                <th scope="col">Family</th>
                <th scope="col">AIC</th>
                <th scope="col">BIC</th>
                <th scope="col">KS</th>
                <th scope="col">CDF RMSE</th>
                <th scope="col">PDF RMSE</th>
              </tr>
            </thead>
            <tbody>
              {fit.candidates.map((candidate, index) => (
                <tr key={candidate.family}>
                  <th scope="row">
                    <span className="hclsamples__family">
                      {FIT_FAMILY_TEXT[candidate.family]}
                      {index === 0 && <small>Best fit</small>}
                    </span>
                    <span className="hclsamples__law">{fitLawText(candidate.law)}</span>
                  </th>
                  <td>{criterionText(candidate.aic)}</td>
                  <td>{criterionText(candidate.bic)}</td>
                  <td>{numberText(candidate.ksStatistic)}</td>
                  <td>{numberText(candidate.cdfRmse)}</td>
                  <td>{numberText(candidate.pdfRmse)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rejected.length > 0 && (
        <ul className="hclsamples__rejected" aria-label="Families not fitted">
          {rejected.map((entry) => (
            <li key={entry.family}>
              <strong>{FIT_FAMILY_TEXT[entry.family]}</strong>
              <span>{entry.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HclDistributionDetails({ summary, annual }: { summary: HclUncertaintySummary; annual: boolean }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (summary.histogram === undefined && summary.fit === undefined) return null;
  return (
    <details className="hclsamples" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Distribution and fit</summary>
      {open && (
        <div className="hclsamples__body">
          {summary.histogram !== undefined && (
            <HclSampleChart summary={summary} histogram={summary.histogram} exceedance={summary.exceedance ?? []} unit={annual ? "/yr" : ""} />
          )}
          {summary.fit !== undefined && <HclFitTable fit={summary.fit} />}
        </div>
      )}
    </details>
  );
}

function HclSampleCsvButton({ host, workbookId, runId, filename, columnName }: {
  host: AnalysisHost;
  workbookId: string;
  runId: string;
  filename: string;
  columnName: (vector: HclSampleVector) => string;
}): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      downloadResultCsv(filename, sampleRecords(await getAnalysisRunSamples(host, workbookId, runId), columnName));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the samples.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="hclsamples__export">
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={loading} onClick={() => { void download(); }}>
        {loading ? "Loading samples…" : "Export samples CSV"}
      </button>
      {error !== null && <span className="bneditor__error" role="alert">{error}</span>}
    </span>
  );
}

function HclHazardExceedance({ points, label }: { points: readonly HclHazardExceedancePoint[]; label: string }): JSX.Element | null {
  const drawn = points.filter((point) => point.threshold > 0 && point.exceedanceFrequency > 0);
  const across = decadeRange(drawn.map((point) => point.threshold));
  const up = decadeRange(drawn.map((point) => point.exceedanceFrequency));
  if (across === undefined || up === undefined) return null;
  const x = (value: number): number => PLOT_LEFT + ((Math.log10(value) - across.low) / (across.high - across.low)) * (PLOT_RIGHT - PLOT_LEFT);
  const y = (value: number): number => PLOT_BASE - ((Math.log10(value) - up.low) / (up.high - up.low)) * (PLOT_BASE - PLOT_TOP);
  const path = drawn
    .map((point, index) => {
      const previous = drawn[index - 1];
      const at = `${x(point.threshold).toFixed(1)},${y(point.exceedanceFrequency).toFixed(1)}`;
      return previous === undefined ? `M${at}` : `L${x(previous.threshold).toFixed(1)},${y(point.exceedanceFrequency).toFixed(1)} L${at}`;
    })
    .join(" ");
  return (
    <section className="hclsamples__hazard" aria-label={`${label} hazard exceedance`}>
      <div className="hclsamples__hazard-head">
        <strong>{label} exceedance</strong>
        <ResultCsvButton
          filename={`${label} hazard exceedance.csv`}
          records={() => points.map((point) => ({
            threshold: point.threshold,
            bin_weight: point.weight,
            exceedance_weight: point.exceedanceWeight,
            exceedance_frequency_per_year: point.exceedanceFrequency,
          }))}
        />
      </div>
      <svg className="hclsamples__svg" viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`} role="img" aria-label={`Annual frequency of the hazard bins whose ${label} probability is at or above each threshold, on log scales`}>
        {decades(up).map((decade) => (
          <g key={decade}>
            <line className="hclsamples__grid" x1={PLOT_LEFT} y1={y(10 ** decade)} x2={PLOT_RIGHT} y2={y(10 ** decade)} />
            <text className="hclsamples__number" x={PLOT_LEFT - 6} y={y(10 ** decade) + 3} textAnchor="end">{`1E${String(decade)}`}</text>
          </g>
        ))}
        <path className="hclsamples__curve" d={path} />
        <line className="hclsamples__axis" x1={PLOT_LEFT} y1={PLOT_BASE} x2={PLOT_RIGHT} y2={PLOT_BASE} />
        {decades(across).map((decade) => (
          <g key={decade}>
            <line className="hclsamples__axis" x1={x(10 ** decade)} y1={PLOT_BASE} x2={x(10 ** decade)} y2={PLOT_BASE + 4} />
            <text className="hclsamples__number" x={x(10 ** decade)} y={PLOT_BASE + 16} textAnchor="middle">{`1E${String(decade)}`}</text>
          </g>
        ))}
      </svg>
      <p className="hclsamples__axes">
        <span>Across: conditional probability threshold</span>
        <span>Up: annual frequency at or above it /yr</span>
      </p>
    </section>
  );
}

export { HclAdjustments, HclDistributionDetails, HclHazardExceedance, HclSampleCsvButton };
