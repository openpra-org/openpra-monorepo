import { type JSX, useMemo } from "react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcLatestCategoryResult, rcResultNumber } from "interfaces-shared-types/rc-workbooks/family-consequences";
import { TechnicalElementHandoff, handoffName, joinedOrNone, recordLabel, type HandoffSectionView } from "../workbooks/workbookHandoff";
import { useRcWorkbook } from "./rcWorkbookContext";

const LEVEL_TEXT: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  ADDRESSED: "Addressed",
  DEFERRED: "Deferred",
  COMPLETED: "Completed",
};

const EVALUATION_TEXT: Record<string, string> = {
  QUALITATIVE: "Qualitative",
  QUANTITATIVE: "Quantitative",
  INDIVIDUAL: "individual",
  COMBINATION: "in combination",
};

function levelText(level: string | undefined): string {
  return level === undefined ? "None" : LEVEL_TEXT[level] ?? level;
}

function rcHandoffSections(rc: RadiologicalConsequenceAnalysis, familyName: ReadonlyMap<string, string>): HandoffSectionView[] {
  const family = (id: string): string => recordLabel(id, familyName.get(id));
  const q = rc.consequenceQuantification;
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const metrics = rc.scope.metrics ?? [];
  const feedback = rc.riskIntegrationFeedback;
  return [
    {
      key: "consequences",
      columns: [{ label: "Metric" }, { label: "Release category" }, { label: "Families" }, { label: "Mean", numeric: true }, { label: "Unit" }],
      rows: [
        ...metrics.flatMap((metric) => categories.map((category) => {
          const result = rcLatestCategoryResult(q.caseRecords, category.releaseCategory, metric.id);
          const mean = result?.statistics.mean;
          return {
            id: `${metric.id}-${category.releaseCategory}`,
            cells: [
              handoffName(metric.id, metric.name.trim()),
              category.releaseCategory,
              joinedOrNone((category.eventSequenceFamilyReferences ?? []).map((reference) => family(reference.entityId))),
              mean === undefined ? "None" : rcResultNumber(mean),
              result?.unit ?? "",
            ],
          };
        })),
        ...q.eventSequenceConsequences.filter((entry) => entry.origin !== "CATEGORY_RESULT").flatMap((entry) => entry.consequenceResults.map((result, index) => ({
          id: `family-${entry.uuid ?? entry.eventSequenceFamily}-${String(index)}`,
          cells: [result.metric, entry.releaseCategoryReference === undefined ? "None" : recordLabel(entry.releaseCategoryReference), family(entry.eventSequenceFamily), rcResultNumber(result.meanValue), result.unit ?? ""],
        }))),
      ],
    },
    {
      key: "uncertainty",
      columns: [{ label: "Sub-element" }, { label: "Source" }, { label: "Effect on metrics" }, { label: "Evaluation" }],
      rows: q.modelUncertaintyAssessments.map((entry, index) => ({
        id: `mu-${String(index)}`,
        cells: [entry.sourceSubElement, entry.uncertaintySource, entry.effectOnMetrics, `${EVALUATION_TEXT[entry.evaluationType] ?? entry.evaluationType}, ${EVALUATION_TEXT[entry.evaluationScope] ?? entry.evaluationScope}`],
      })),
    },
    {
      key: "responses",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "RI level" }, { label: "Detail" }],
      rows: feedback === undefined ? [] : [
        ...(feedback.metricFeedback ?? []).map((row, index) => ({ id: `metric-${String(index)}`, cells: ["Measure", row.metric, levelText(row.riskSignificance), joinedOrNone(row.recommendations ?? [])] })),
        ...(feedback.releaseCategoryFeedback ?? []).map((row, index) => ({ id: `category-${String(index)}`, cells: ["Release category", recordLabel(row.releaseCategoryReference), levelText(row.riskSignificance), row.status === undefined ? "None" : STATUS_TEXT[row.status] ?? row.status] })),
        ...(feedback.response === undefined ? [] : [{ id: "response", cells: ["Response", STATUS_TEXT[feedback.response.status] ?? feedback.response.status, "", feedback.response.description] }]),
      ],
    },
  ];
}

function RcHandoffScreen(): JSX.Element {
  const { rc, links } = useRcWorkbook();
  const familyName = useMemo(() => new Map((links.es?.eventSequenceFamilies ?? []).map((entry) => [entry.uuid, entry.name])), [links.es]);
  const sections = useMemo(() => rcHandoffSections(rc, familyName), [rc, familyName]);
  return <TechnicalElementHandoff element="RC" sections={sections} />;
}

export { RcHandoffScreen };
