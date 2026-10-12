import { JSX, useEffect, useId, useMemo, useRef } from "react";
import type {
  EsqHandoffResponse,
  EsqResponseStatus,
  EventSequenceFamilyQuantification,
  EventSequenceQuantification,
  ImportanceAnalysisRecord,
  ImportanceMeasureEntry,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { TechnicalElementHandoff, handoffName, joinedOrNone, recordLabel, type HandoffSectionView } from "../workbooks/workbookHandoff";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { FormFoot, FormRow, ModalHead, sciText, useRunner } from "./esqShared";
import type { EsqWindowContext } from "./esqModelScreen";
import { caseOptions } from "./esqDaLinks";
import { fourDigits } from "./esqResults";
import { CONTRIBUTOR_TYPE_LABELS } from "./esqViewData";
import {
  OWNER_ELEMENTS,
  RESPONSE_LABELS,
  handoffViewOf,
  handoffWorkOf,
  publishEsq,
  withResponse,
  type EsqHandoffView,
  type EsqHandoffWindowKind,
} from "./esqHandoff";
import { getEsqImportanceResult, getEsqModelRunResult } from "./esqWorkbookApi";

const HANDOFF_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqHandoffWindowKind>(["esqHandoffResponse"]);

const HANDOFF_WINDOW_LABELS: Record<EsqHandoffWindowKind, string> = { esqHandoffResponse: "Response to RI" };

const STATUSES: readonly EsqResponseStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];

const BASIS_LABELS: Record<EventSequenceFamilyQuantification["quantificationBasis"], string> = {
  POINT_ESTIMATE: "Point estimate",
  MEAN_PROPAGATED_SOKC: "Mean with shared draws",
  MEAN_RISK_SIGNIFICANT_PARAMETERS: "Mean of significant parameters",
};

const ENTITY_LABELS: Record<ImportanceMeasureEntry["entityType"], string> = {
  BASIC_EVENT: "Basic event",
  INITIATING_EVENT: "Initiating event",
  HUMAN_FAILURE_EVENT: "Human failure event",
  CCF_GROUP: "Common cause group",
  SYSTEM: "System",
  COMPONENT: "Component",
};

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function shareText(fraction: number): string {
  return `${String(Number((100 * fraction).toPrecision(3)))}%`;
}

function levelText(level: ImportanceLevel | undefined): string {
  return level === undefined ? "—" : level.charAt(0) + level.slice(1).toLowerCase();
}

function noneText(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "None" : text.trim();
}

function noneMeasure(value: number | undefined): string {
  return value === undefined ? "None" : fourDigits(value);
}

function rangeText(low: number | undefined, high: number | undefined): string {
  return low === undefined || high === undefined ? "None" : `${sciText(low)} to ${sciText(high)}`;
}

function frequencyValue(value: EventSequenceFamilyQuantification["meanFrequency"]): number {
  return typeof value === "number" ? value : value.value;
}

function scopeText(record: ImportanceAnalysisRecord, family: (id: string) => string, sequence: (id: string) => string): string {
  if (record.scope === "OVERALL") return "Overall";
  if (record.scope === "PER_FAMILY") return record.familyRef === undefined ? "Family" : family(record.familyRef);
  return record.sequenceRef === undefined ? "Sequence" : sequence(record.sequenceRef);
}

function feedbackText(level: ImportanceLevel | undefined, insights: readonly string[] | undefined, recommendations: readonly string[] | undefined): string {
  const parts = [level === undefined ? "" : `${levelText(level)} significance.`, ...(insights ?? []), ...(recommendations ?? [])].filter((part) => part.trim().length > 0);
  return parts.length === 0 ? "None" : parts.join(" ");
}

function esqHandoffSections(esq: EventSequenceQuantification, view: EsqHandoffView | undefined): HandoffSectionView[] {
  const familyName = new Map((esq.model?.families ?? []).map((entry) => [entry.id, entry.name]));
  const sequenceCode = new Map((esq.model?.sequences ?? []).map((entry) => [entry.id, entry.code]));
  const family = (id: string): string => recordLabel(id, familyName.get(id));
  const sequence = (id: string): string => sequenceCode.get(id) ?? recordLabel(id);
  const labels = (ids: readonly string[]): string => joinedOrNone(ids.map((id) => recordLabel(id)));
  const coverage = esq.modelIntegration.scopeCoverage;
  const coverageGroups: [string, string[]][] = [
    ["Hazard group", coverage.hazardGroups],
    ["Operating state", coverage.plantOperatingStates],
    ["Source", coverage.radionuclideSources],
    ["Initiator group", coverage.initiatingEventGroups],
    ["Plant evolution", coverage.plantEvolutions],
  ];
  const multiBasis = esq.modelIntegration.multiReactorInclusionBasis?.trim() ?? "";
  const screened = esq.screenedEventCumulativeAssessment;
  const feedback = esq.riskIntegrationFeedback;
  const response = feedback?.response;
  const overall = (esq.importanceAnalyses ?? []).find((record) => record.scope === "OVERALL");
  const daMeasures = (overall?.measures ?? []).filter((measure) => measure.dataAnalysisParameterRef !== undefined);
  const valued = (view?.families ?? []).filter((row) => row.value !== undefined);
  return [
    {
      key: "frequencies",
      subsections: [
        {
          key: "families",
          name: "Families",
          columns: [{ label: "Family" }, { label: "Basis" }, { label: "Mean (/yr)", numeric: true }, { label: "5th to 95th (/yr)", numeric: true }, { label: "Contributors", numeric: true }],
          rows: esq.familyQuantifications.map((record) => ({
            id: record.uuid,
            cells: [
              handoffName(record.eventSequenceFamilyRef, record.name),
              BASIS_LABELS[record.quantificationBasis],
              sciText(frequencyValue(record.meanFrequency)),
              rangeText(record.percentile05, record.percentile95),
              record.contributionBreakdown?.length ?? 0,
            ],
          })),
        },
        {
          key: "sequences",
          name: "Sequences",
          columns: [{ label: "Sequence" }, { label: "Mean (/yr)", numeric: true }, { label: "5th to 95th (/yr)", numeric: true }],
          rows: (esq.sequenceFrequencyEstimates ?? []).map((estimate) => ({
            id: estimate.uuid,
            cells: [sequence(estimate.eventSequenceRef), sciText(frequencyValue(estimate.meanFrequency)), rangeText(estimate.percentile05, estimate.percentile95)],
          })),
        },
        {
          key: "family-scope",
          name: "Family scope",
          columns: [{ label: "Family" }, { label: "Release category" }, { label: "Operating states" }, { label: "Initiators" }, { label: "Sources" }],
          rows: valued.map((row) => ({
            id: row.family.id,
            cells: [
              handoffName(row.family.id, row.family.name),
              row.family.releaseCategoryId === undefined ? "None" : recordLabel(row.family.releaseCategoryId),
              labels(row.family.stateIds),
              labels(row.family.initiatorIds),
              labels(row.family.sourceIds),
            ],
          })),
        },
        {
          key: "contributors",
          name: "Contributors",
          columns: [{ label: "Family" }, { label: "Contributor" }, { label: "Type" }, { label: "Share", numeric: true }],
          rows: esq.familyQuantifications.flatMap((record) => [...(record.contributionBreakdown ?? [])]
            .sort((left, right) => right.fractionalContribution - left.fractionalContribution)
            .map((part, index) => ({
              id: `${record.uuid}-${String(index)}`,
              cells: [family(record.eventSequenceFamilyRef), recordLabel(part.contributorRef), CONTRIBUTOR_TYPE_LABELS[part.contributorType] ?? part.contributorType, shareText(part.fractionalContribution)],
            }))),
        },
      ],
    },
    {
      key: "importance",
      subsections: [
        {
          key: "measures",
          name: "Measures",
          columns: [{ label: "Scope" }, { label: "Item" }, { label: "Type" }, { label: "FV", numeric: true }, { label: "RAW", numeric: true }],
          rows: (esq.importanceAnalyses ?? []).flatMap((record) => record.measures.map((measure, index) => ({
            id: `${record.uuid}-${String(index)}`,
            cells: [scopeText(record, family, sequence), recordLabel(measure.entityRef), ENTITY_LABELS[measure.entityType], noneMeasure(measure.fussellVesely), noneMeasure(measure.riskAchievementWorth)],
          }))),
        },
        {
          key: "by-da-item",
          name: "By DA item",
          columns: [{ label: "DA item" }, { label: "FV", numeric: true }, { label: "RAW", numeric: true }],
          rows: daMeasures.map((measure) => ({
            id: `${measure.dataAnalysisParameterRef ?? ""}:${measure.entityRef}`,
            cells: [recordLabel(measure.entityRef), noneMeasure(measure.fussellVesely), noneMeasure(measure.riskAchievementWorth)],
          })),
        },
      ],
    },
    {
      key: "coverage",
      columns: [{ label: "Kind" }, { label: "Item" }],
      rows: [
        ...coverageGroups.flatMap(([kind, items]) => items.map((item, index) => ({ id: `${kind}-${String(index)}-${item}`, cells: [kind, recordLabel(item)] }))),
        {
          id: "multi-reactor",
          cells: ["Sequences with several reactors", `${esq.modelIntegration.multiReactorSequencesIncluded ? "Included" : "Not in scope"}${multiBasis.length === 0 ? "" : ` · ${multiBasis}`}`],
        },
      ],
    },
    {
      key: "uncertainty",
      subsections: [
        {
          key: "sources-and-studies",
          name: "Sources and studies",
          columns: [{ label: "Kind" }, { label: "Item" }, { label: "From" }, { label: "Effect or result" }],
          rows: [
            ...(esq.modelUncertaintySourceAssessments ?? []).map((assessment) => ({
              id: `source-${assessment.uuid}`,
              cells: ["Uncertainty source", assessment.uncertaintySource, assessment.sourceElementCode, noneText(assessment.effectOnFamilyFrequencies)],
            })),
            ...(esq.sensitivityStudies ?? []).map((study) => ({
              id: `study-${study.uuid}`,
              cells: ["Sensitivity study", study.name ?? study.description, study.dataAnalysisCaseRef === undefined ? "ESQ" : "DA", study.results ?? "Not run"],
            })),
            ...(screened === undefined ? [] : [{
              id: "screened",
              cells: ["Screened initiators", labels(screened.screenedInitiatingEventRefs), "ESQ", screened.cumulativeImpactAssessment],
            }]),
          ],
        },
        {
          key: "da-references",
          name: "References to DA",
          columns: [{ label: "Kind" }, { label: "DA item" }, { label: "In ESQ" }],
          rows: [
            ...(esq.modelUncertaintySourceAssessments ?? []).flatMap((assessment) => (assessment.dataAnalysisSourceRef === undefined ? [] : [{
              id: `source-${assessment.uuid}`,
              cells: ["Register entry", recordLabel(assessment.dataAnalysisSourceRef.sourceId), assessment.uncertaintySource],
            }])),
            ...(esq.sensitivityStudies ?? []).flatMap((study) => (study.dataAnalysisCaseRef === undefined ? [] : [{
              id: `case-${study.uuid}`,
              cells: ["Sensitivity case", recordLabel(study.dataAnalysisCaseRef.caseId), study.name ?? study.description],
            }])),
          ],
        },
      ],
    },
    {
      key: "responses",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "Detail" }],
      rows: feedback === undefined ? [] : [
        ...(feedback.sequenceFeedback ?? []).map((entry, index) => ({
          id: `feedback-${entry.sequenceRef}-${String(index)}`,
          cells: ["RI feedback", handoffName(entry.sequenceRef, familyName.get(entry.sequenceRef)), feedbackText(entry.riskSignificance, entry.insights, entry.recommendations)],
        })),
        ...(blank(feedback.generalFeedback) ? [] : [{ id: "general", cells: ["RI feedback", "General", noneText(feedback.generalFeedback)] }]),
        ...(response === undefined ? [] : [{ id: "response", cells: ["Response", RESPONSE_LABELS[response.status], noneText(response.description)] }]),
        ...(response?.changes ?? []).map((change, index) => ({ id: `change-${String(index)}`, cells: ["Routed", change, "None"] })),
      ],
    },
  ];
}

function HandoffScreen(): JSX.Element {
  const { esq, editable, runtime, mutateEsq, upstream, daLinks } = useEsqWorkbook();
  const view = useMemo(() => handoffViewOf(esq, upstream), [esq, upstream]);
  const sections = useMemo(() => esqHandoffSections(esq, view), [esq, view]);
  const runner = useRunner();
  const publishing = useRef(false);
  const due = editable && analysisSaveBlock(runtime) === null && view?.run !== undefined && (view.work.published === undefined || view.publishedStale);

  useEffect(() => {
    if (!due) {
      publishing.current = false;
      return;
    }
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (publishing.current || runner.running || runner.error !== null || workbookId === null || revision === null) return;
    publishing.current = true;
    const record = esq.review?.importance;
    const runId = view?.run?.runId;
    runner.start(async () => {
      const importance = record === undefined ? undefined : await getEsqImportanceResult(workbookId, record.runId);
      const summary = runId === undefined ? undefined : await getEsqModelRunResult(workbookId, runId);
      const daCases = caseOptions(daLinks ?? []);
      const at = new Date().toISOString();
      mutateEsq((draft) => publishEsq(draft, {
        upstream,
        daCases,
        at,
        revision,
        ...(importance === undefined ? {} : { importance }),
        ...(summary === undefined ? {} : { summary }),
      }));
    });
  }, [due, runner, runtime.workbookId, runtime.revision, esq.review, view, daLinks, mutateEsq, upstream]);

  return (
    <div className="esq-step">
      <TechnicalElementHandoff element="ESQ" sections={sections} />
    </div>
  );
}

function ResponseWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const view = handoffViewOf(esq, upstream);
  const item = view?.feedback.find((candidate) => candidate.id === id);
  if (item === undefined) return null;
  const response: EsqHandoffResponse = handoffWorkOf(esq).responses?.find((entry) => entry.id === id) ?? { id, kind: item.kind, ref: item.ref, response: "", status: "PENDING", ...(item.owner === undefined ? {} : { sentTo: item.owner }) };
  const dis = !editable;

  function save(next: EsqHandoffResponse): void {
    if (!editable) return;
    mutateEsq((draft) => withResponse(draft, next, id));
  }

  return (
    <>
      <ModalHead cap={`RI feedback · ${item.kind === "FAMILY" ? "family" : item.kind === "CONTRIBUTOR" ? "contributor" : "general"} · RI-B3`} title={item.label} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="RI significance"><span className="esq-form__unit">{item.significance === undefined ? "Not rated" : item.significance.toLowerCase()}</span></FormRow>
        <FormRow label="RI's reason"><span className="esq-form__unit">{textValue(item.reason)}</span></FormRow>
        {item.insights.length > 0 && <FormRow label="Insights"><span className="esq-form__unit">{item.insights.join(" ")}</span></FormRow>}
        {item.recommendations.length > 0 && <FormRow label="Recommendations"><span className="esq-form__unit">{item.recommendations.join(" ")}</span></FormRow>}
        <FormRow label="Response" htmlFor={`${fieldId}-response`} top>
          <WorkbookTextarea id={`${fieldId}-response`} className="posfield__textarea" rows={3} fitContent value={response.response} disabled={dis} onChange={(event) => save({ ...response, response: event.target.value })} />
        </FormRow>
        <FormRow label="Status" htmlFor={`${fieldId}-status`}>
          <select id={`${fieldId}-status`} className="posfield__select" value={response.status} disabled={dis} onChange={(event) => {
            const status = STATUSES.find((candidate) => candidate === event.target.value);
            if (status !== undefined) save({ ...response, status });
          }}>
            {STATUSES.map((status) => <option key={status} value={status}>{RESPONSE_LABELS[status]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Sent to" htmlFor={`${fieldId}-owner`}>
          <select id={`${fieldId}-owner`} className="posfield__select" value={response.sentTo ?? ""} disabled={dis} onChange={(event) => {
            const { sentTo: _old, ...rest } = response;
            save(event.target.value.length === 0 ? rest : { ...rest, sentTo: event.target.value });
          }}>
            <option value="">Kept in ESQ</option>
            {OWNER_ELEMENTS.map((element) => <option key={element} value={element}>{element}</option>)}
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function HandoffWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqHandoffResponse": return <ResponseWindow key={context.id} id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { HandoffScreen, HandoffWindows, HANDOFF_WINDOW_KINDS, HANDOFF_WINDOW_LABELS };
