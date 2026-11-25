import type { JSX } from "react";
import { DistributionType } from "interfaces-mef-types/core/events";
import type { RcCaseRecords } from "interfaces-mef-types/rc/case-records";
import type { RcConsequenceMetric } from "interfaces-mef-types/rc/metrics";
import { rcConsequenceMatchesFamily, rcLatestCategoryResult, rcResultNumber, type RcFamilyConsequence } from "interfaces-shared-types/rc-workbooks/family-consequences";
import { rcMetricUnit, rcOrdinal } from "interfaces-shared-types/rc-workbooks/metrics";
import { COUNT_VIEW, TEXT_VIEW, useWorkbookView } from "../workbooks/workbookViewMemory";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { RunPager } from "./rcConsequenceRuns";
import type { RcDrawerContext } from "./rcScreens";
import { RcProvenanceChip } from "./rcShared";
import { RISK_SIGNIFICANCE_LABELS } from "./rcViewData";
import { useRcWorkbook } from "./rcWorkbookContext";
import "./css/rcFamilyConsequences.css";

const PAGE = 10;
const NO_VALUE = "—";

interface FamilyRow {
  key: string;
  familyId: string;
  categoryId: string | undefined;
  entry: RcFamilyConsequence | undefined;
  typed: boolean;
}

interface MetricChoice {
  key: string;
  name: string;
  unit: string;
  metric: RcConsequenceMetric | undefined;
}

interface FamilyValues {
  mean: number | undefined;
  percentiles: Map<number, number>;
}

function typedValues(entry: RcFamilyConsequence, name: string): FamilyValues {
  const result = entry.consequenceResults.find((row) => row.metric === name);
  const distribution = result?.uncertaintyDistribution;
  const percentiles = new Map<number, number>();
  if (distribution !== undefined && distribution.type === DistributionType.LOGNORMAL) {
    percentiles.set(5, distribution.median / distribution.errorFactor);
    percentiles.set(50, distribution.median);
    percentiles.set(95, distribution.median * distribution.errorFactor);
  }
  return { mean: result?.meanValue, percentiles };
}

function categoryValues(records: RcCaseRecords | undefined, categoryId: string, metric: RcConsequenceMetric): FamilyValues {
  const result = rcLatestCategoryResult(records, categoryId, metric.id);
  const point = result?.calculation?.trialCount === 1;
  const percentiles = new Map<number, number>();
  for (const row of result?.statistics.percentiles ?? []) {
    if (!point || row.percentile === 50) percentiles.set(row.percentile, row.value);
  }
  return { mean: result?.statistics.mean, percentiles };
}

function numberText(value: number | undefined): string {
  return value === undefined ? NO_VALUE : rcResultNumber(value);
}

function RcFamilyConsequences({ openDrawer }: { openDrawer: (context: RcDrawerContext) => void }): JSX.Element {
  const { rc, links } = useRcWorkbook();
  const quantification = rc.consequenceQuantification;
  const [picked, setPicked] = useWorkbookView<string>("rc.step08.families.metric", "", TEXT_VIEW);
  const [offset, setOffset] = useWorkbookView<number>("rc.step08.families.offset", 0, COUNT_VIEW, false);

  const mapped = rc.releaseCategoryToConsequence.releaseCategoryInputs.flatMap((category) =>
    (category.eventSequenceFamilyReferences ?? []).map((reference): FamilyRow => {
      const entry = quantification.eventSequenceConsequences.find((candidate) => rcConsequenceMatchesFamily(candidate, reference));
      return {
        key: entry === undefined ? `${reference.workbookId}|${reference.entityId}` : (entry.uuid ?? entry.eventSequenceFamily),
        familyId: reference.entityId,
        categoryId: category.releaseCategory,
        entry,
        typed: entry !== undefined && entry.origin !== "CATEGORY_RESULT",
      };
    }),
  );
  const rows: FamilyRow[] = [
    ...mapped,
    ...quantification.eventSequenceConsequences
      .filter((entry) => !mapped.some((row) => row.entry === entry))
      .map((entry): FamilyRow => ({ key: entry.uuid ?? entry.eventSequenceFamily, familyId: entry.eventSequenceFamily, categoryId: undefined, entry, typed: entry.origin !== "CATEGORY_RESULT" })),
  ];

  const choices = (rc.scope.metrics ?? []).map((metric): MetricChoice => ({ key: `scope:${metric.id}`, name: metric.name.trim() || metric.id, unit: rcMetricUnit(metric), metric }));
  for (const row of rows) {
    if (!row.typed || row.entry === undefined) continue;
    for (const result of row.entry.consequenceResults) {
      if (choices.some((candidate) => candidate.name === result.metric)) continue;
      choices.push({ key: `typed:${result.metric}`, name: result.metric, unit: result.unit ?? "", metric: undefined });
    }
  }
  const choice = choices.find((candidate) => candidate.key === picked) ?? choices.at(0);

  const shown = rows.map((row) => {
    const none: FamilyValues = { mean: undefined, percentiles: new Map<number, number>() };
    if (choice === undefined) return { row, values: none };
    if (row.typed && row.entry !== undefined) return { row, values: typedValues(row.entry, choice.name) };
    if (row.categoryId === undefined || choice.metric === undefined) return { row, values: none };
    return { row, values: categoryValues(quantification.caseRecords, row.categoryId, choice.metric) };
  });
  const asked = new Set<number>(choice?.metric?.statistics.percentiles ?? []);
  for (const entry of shown) {
    for (const percentile of entry.values.percentiles.keys()) asked.add(percentile);
  }
  const percentiles = [...asked].sort((a, b) => a - b);
  const start = Math.min(offset, Math.max(0, Math.floor((rows.length - 1) / PAGE) * PAGE));

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading title="Event sequence consequences" level={3} />
        <RcProvenanceChip>RCQ-A3</RcProvenanceChip>
      </div>
      <section className="rc-quantification rc-family-consequences" aria-label="Event sequence consequences">
        {choice !== undefined && (
          <label className="q-category">
            Consequence metric
            <select
              className="posfield__select"
              aria-label="Family consequence metric"
              value={choice.key}
              onChange={(event) => {
                setPicked(event.target.value);
              }}
            >
              {choices.map((candidate) => (
                <option key={candidate.key} value={candidate.key}>
                  {candidate.unit === "" ? candidate.name : `${candidate.name} (${candidate.unit})`}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="q-table-wrap">
          <table className="rc-family-consequences__table" aria-label="Event sequence consequences">
            <thead>
              <tr>
                <th scope="col">Family</th>
                <th scope="col">Release category</th>
                {choice !== undefined && <th scope="col">Mean</th>}
                {percentiles.map((percentile) => (
                  <th scope="col" key={percentile}>{`${rcOrdinal(percentile)} percentile`}</th>
                ))}
                <th scope="col">Risk significance</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(start, start + PAGE).map(({ row, values }) => {
                const name = links.es?.eventSequenceFamilies.find((family) => family.uuid === row.familyId)?.name.trim() ?? "";
                const significance = row.entry?.riskSignificance;
                return (
                  <tr key={row.key}>
                    <td>
                      <button
                        type="button"
                        className="rc-family-consequences__family"
                        onClick={() => {
                          openDrawer({ kind: "family", id: row.key });
                        }}
                      >
                        {row.familyId}
                      </button>
                      {name !== "" && <small>{name}</small>}
                      {row.typed && <small>Hand-typed values</small>}
                    </td>
                    <td>{row.categoryId ?? "None"}</td>
                    {choice !== undefined && <td>{numberText(values.mean)}</td>}
                    {percentiles.map((percentile) => (
                      <td key={percentile}>{numberText(values.percentiles.get(percentile))}</td>
                    ))}
                    <td>{significance === undefined ? "Not assessed" : (RISK_SIGNIFICANCE_LABELS[significance] ?? significance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <RunPager label="Event sequence consequences" noun="Families" total={rows.length} offset={start} size={PAGE} onChange={setOffset} />
      </section>
    </div>
  );
}

export { RcFamilyConsequences };
