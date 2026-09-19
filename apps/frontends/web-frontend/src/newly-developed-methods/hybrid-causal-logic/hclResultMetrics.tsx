import type { JSX } from "react";
import type { HclUncertaintySummary } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";

function resultBarWidth(value: number): string {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return `${String(percent > 0 ? Math.max(0.75, percent) : 0)}%`;
}

export function formatScientific(value: number): string {
  const [coefficient, exponent = "0"] = value.toExponential(2).split("e");
  const numericExponent = Number(exponent);
  const sign = numericExponent >= 0 ? "+" : "-";
  return `${coefficient}E${sign}${String(Math.abs(numericExponent)).padStart(2, "0")}`;
}

export function formatPercentage(value: number): string {
  const percent = value * 100;
  if (percent === 0 || Math.abs(percent) >= 0.01) return `${percent.toFixed(2)}%`;
  return `${formatScientific(percent)}%`;
}

export function HclResultMetric({
  label,
  value,
  ratio,
  detail,
  exactValue,
}: {
  label: string;
  value: string;
  ratio?: number;
  detail?: string;
  exactValue?: number;
}): JSX.Element {
  return (
    <div className="bneditor__posterior-state hcleditor__result-metric">
      <span>{label}</span>
      <output title={exactValue === undefined ? undefined : String(exactValue)}>{value}</output>
      {ratio !== undefined && (
        <i aria-hidden="true">
          <b style={{ width: resultBarWidth(ratio) }} />
        </i>
      )}
      {detail !== undefined && <small title={detail}>{detail}</small>}
    </div>
  );
}

export function HclUncertaintyResults({
  summary,
  annual = false,
  label = "Uncertainty",
  inline = false,
}: {
  summary: HclUncertaintySummary | undefined;
  annual?: boolean;
  label?: string;
  inline?: boolean;
}): JSX.Element | null {
  if (summary === undefined) return <p>{label}: No uncertainty result</p>;
  const unit = annual ? "/yr" : "";
  const metrics = [
    { label: "Mean", raw: summary.mean, value: `${formatScientific(summary.mean)}${unit}` },
    { label: "5th percentile", raw: summary.percentile05, value: `${formatScientific(summary.percentile05)}${unit}` },
    { label: "Median", raw: summary.median, value: `${formatScientific(summary.median)}${unit}` },
    { label: "95th percentile", raw: summary.percentile95, value: `${formatScientific(summary.percentile95)}${unit}` },
    {
      label: "Standard deviation",
      raw: summary.standardDeviation,
      value: `${formatScientific(summary.standardDeviation)}${unit}`,
    },
  ];
  metrics.push(
    { label: "Minimum", raw: summary.minimum, value: `${formatScientific(summary.minimum)}${unit}` },
    { label: "Maximum", raw: summary.maximum, value: `${formatScientific(summary.maximum)}${unit}` },
  );
  const accessibleLabel = label === "Uncertainty" ? "Uncertainty results" : `${label} uncertainty results`;
  return (
    <section
      className={`hcleditor__uncertainty-result${inline ? " hcleditor__uncertainty-result--inline" : ""}`}
      aria-label={accessibleLabel}
    >
      <div className="hcleditor__uncertainty-result-head">
        <strong>{label}</strong>
        <span>
          {String(summary.sampleCount)} PRAXIS samples · seed {String(summary.seed)}
        </span>
      </div>
      <dl className="hcleditor__uncertainty-metrics">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="hcleditor__uncertainty-metric"
          >
            <dt>{metric.label}</dt>
            <dd title={`${String(metric.raw)}${unit}`}>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
