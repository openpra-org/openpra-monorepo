import { type JSX, type ReactNode, useEffect, useRef } from "react";
import type { MechanisticSourceTermAnalysis, SourceTermDefinition } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { TechnicalElementHandoff, handoffName, joinedOrNone, recordLabel, type HandoffSectionView } from "../workbooks/workbookHandoff";
import { useMsWorkbook } from "./msWorkbookContext";
import { type MsLinkedWorkbookData } from "./msLinks";
import { fracText } from "./msShared";
import { ST_BASIS_LABELS } from "./msViewData";
import { speciesTotals } from "./msSelectors";

const SOURCE_BLOCK_TEXT: Record<string, string> = {
  BARRIER_TRANSPORT_ASSESSMENT: "Barrier transport",
  SOURCE_TERM_CALCULATION: "Source-term calculation",
};

type MsRiFeedback = NonNullable<MechanisticSourceTermAnalysis["riskIntegrationFeedback"]>;
type MsItemStatus = "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
type MsResponse = NonNullable<MsRiFeedback["response"]>;
type MsFeedbackKind = "category" | "sourceTerm";

const ITEM_STATUSES: { id: MsItemStatus; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "ADDRESSED", label: "Addressed" },
  { id: "DEFERRED", label: "Deferred" },
];

const RESPONSE_STATUSES: { id: MsResponse["status"]; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "COMPLETED", label: "Completed" },
];

const LEVEL_TEXT: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

function levelText(level: string | undefined): string {
  return level === undefined ? "None" : LEVEL_TEXT[level] ?? level;
}

function lines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

function sentFeedback(ri: RiskIntegration | undefined): NonNullable<NonNullable<RiskIntegration["riskIntegrationFeedbackDispatch"]>["mechanisticSourceTermFeedback"]> | undefined {
  return ri?.riskIntegrationFeedbackDispatch?.mechanisticSourceTermFeedback;
}

function sentCount(ri: RiskIntegration | undefined): number {
  const sent = sentFeedback(ri);
  return (sent?.releaseCategoryFeedback ?? []).length + (sent?.sourceTermFeedback ?? []).length;
}

function recordedFromRi(current: MsRiFeedback | undefined, ri: RiskIntegration): MsRiFeedback {
  const dispatch = ri.riskIntegrationFeedbackDispatch;
  const sent = dispatch?.mechanisticSourceTermFeedback;
  const record: MsRiFeedback = {
    analysisRef: ri.uuid,
    releaseCategoryFeedback: (sent?.releaseCategoryFeedback ?? []).map((row) => ({
      releaseCategoryReference: row.releaseCategoryRef,
      ...(row.riskSignificance === undefined ? {} : { riskSignificance: row.riskSignificance }),
      ...(row.insights === undefined ? {} : { insights: row.insights }),
      ...(row.recommendations === undefined ? {} : { recommendations: row.recommendations }),
      status: current?.releaseCategoryFeedback?.find((entry) => entry.releaseCategoryReference === row.releaseCategoryRef)?.status ?? "PENDING",
    })),
    sourceTermFeedback: (sent?.sourceTermFeedback ?? []).map((row) => ({
      sourceTermDefinitionRef: row.sourceTermDefinitionRef,
      ...(row.riskSignificance === undefined ? {} : { riskSignificance: row.riskSignificance }),
      ...(row.insights === undefined ? {} : { insights: row.insights }),
      ...(row.keyUncertainties === undefined ? {} : { keyUncertainties: row.keyUncertainties }),
      status: current?.sourceTermFeedback?.find((entry) => entry.sourceTermDefinitionRef === row.sourceTermDefinitionRef)?.status ?? "PENDING",
    })),
  };
  if (dispatch?.dispatchDate !== undefined && dispatch.dispatchDate.length > 0) record.feedbackDate = dispatch.dispatchDate;
  if (sent?.generalFeedback !== undefined && sent.generalFeedback.length > 0) record.generalFeedback = sent.generalFeedback;
  if (current?.response !== undefined) record.response = current.response;
  return record;
}

function feedbackKey(record: MsRiFeedback | undefined): string {
  return JSON.stringify([
    record?.analysisRef ?? null,
    (record?.releaseCategoryFeedback ?? []).map((row) => [row.releaseCategoryReference, row.riskSignificance ?? null, row.insights ?? [], row.recommendations ?? [], row.status ?? null]),
    (record?.sourceTermFeedback ?? []).map((row) => [row.sourceTermDefinitionRef, row.riskSignificance ?? null, row.insights ?? [], row.keyUncertainties ?? [], row.status ?? null]),
    record?.feedbackDate ?? null,
    record?.generalFeedback ?? null,
  ]);
}

function withItemStatus(ms: MechanisticSourceTermAnalysis, kind: MsFeedbackKind, key: string, status: MsItemStatus): MechanisticSourceTermAnalysis {
  const record = ms.riskIntegrationFeedback;
  if (record === undefined) return ms;
  if (kind === "category") {
    return { ...ms, riskIntegrationFeedback: { ...record, releaseCategoryFeedback: (record.releaseCategoryFeedback ?? []).map((row) => (row.releaseCategoryReference === key ? { ...row, status } : row)) } };
  }
  return { ...ms, riskIntegrationFeedback: { ...record, sourceTermFeedback: (record.sourceTermFeedback ?? []).map((row) => (row.sourceTermDefinitionRef === key ? { ...row, status } : row)) } };
}

function withResponse(ms: MechanisticSourceTermAnalysis, analysisRef: string, next: Partial<MsResponse>): MechanisticSourceTermAnalysis {
  const record = ms.riskIntegrationFeedback ?? { analysisRef };
  const response: MsResponse = { description: record.response?.description ?? "", changes: record.response?.changes ?? [], status: record.response?.status ?? "IN_PROGRESS", ...next };
  return { ...ms, riskIntegrationFeedback: { ...record, response } };
}

function StatusCell({ kind, itemKey, status }: { kind: MsFeedbackKind; itemKey: string; status: MsItemStatus | undefined }): JSX.Element {
  const { editable, mutateMs } = useMsWorkbook();
  return (
    <select
      className="posfield__select"
      aria-label={`Status of ${itemKey}`}
      value={status ?? "PENDING"}
      disabled={!editable}
      onChange={(event) => {
        const next = ITEM_STATUSES.find((entry) => entry.id === event.target.value);
        if (editable && next !== undefined) mutateMs((draft) => withItemStatus(draft, kind, itemKey, next.id));
      }}
    >
      {ITEM_STATUSES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
  );
}

function useResponsePatch(): { response: MsResponse | undefined; editable: boolean; patch: (next: Partial<MsResponse>) => void } {
  const { ms, editable, mutateMs, upstream } = useMsWorkbook();
  const record = ms.riskIntegrationFeedback;
  const analysisRef = upstream.ri?.uuid ?? record?.analysisRef ?? "";
  return {
    response: record?.response,
    editable,
    patch: (next) => {
      if (editable) mutateMs((draft) => withResponse(draft, analysisRef, next));
    },
  };
}

function ResponseTextCell({ field }: { field: "description" | "changes" }): JSX.Element {
  const { response, editable, patch } = useResponsePatch();
  const value = field === "description" ? response?.description ?? "" : (response?.changes ?? []).join("\n");
  return (
    <WorkbookTextarea
      className="posfield__textarea"
      aria-label={field === "description" ? "MS response" : "Changes made"}
      rows={1}
      fitContent
      value={value}
      disabled={!editable}
      onChange={(event) => patch(field === "description" ? { description: event.target.value } : { changes: lines(event.target.value) })}
    />
  );
}

function ResponseStatusCell(): JSX.Element {
  const { response, editable, patch } = useResponsePatch();
  return (
    <select
      className="posfield__select"
      aria-label="Response status"
      value={response?.status ?? "IN_PROGRESS"}
      disabled={!editable}
      onChange={(event) => {
        const next = RESPONSE_STATUSES.find((entry) => entry.id === event.target.value);
        if (next !== undefined) patch({ status: next.id });
      }}
    >
      {RESPONSE_STATUSES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
  );
}

function phasesText(st: SourceTermDefinition): string {
  return joinedOrNone(st.releasePhases.map((phase) => `${phase.name} ${String(phase.startTime)} to ${String(phase.endTime)}${phase.timeUnit === undefined ? "" : ` ${phase.timeUnit}`}`));
}

function releasesText(st: SourceTermDefinition): string {
  const ranked = [...speciesTotals(st).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return joinedOrNone(ranked.map(([species, value]) => `${species} ${fracText(value)}`));
}

function sourceTermDetail(st: SourceTermDefinition): string {
  const elevation = st.releaseElevation === undefined ? [] : [`Elevation ${String(st.releaseElevation.quantity)} ${st.releaseElevation.unit}`];
  return [`Phases ${phasesText(st)}`, `Releases ${releasesText(st)}`, ...elevation].join(" · ");
}

function msHandoffSections(ms: MechanisticSourceTermAnalysis, upstream: MsLinkedWorkbookData): HandoffSectionView[] {
  const categoryName = new Map(ms.releaseCategories.map((category) => [category.uuid, category.name]));
  const category = (id: string): ReactNode => (id.length === 0 ? "None" : handoffName(id, categoryName.get(id) ?? ""));
  const sequenceName = new Map((upstream.es?.eventSequences ?? []).map((sequence) => [sequence.uuid, sequence.name]));
  const sourceName = new Map((upstream.pos?.plantOperatingStates ?? []).flatMap((state) => state.radioactiveMaterialSources.map((source) => [source.uuid, source.name] as const)));
  const sourceTermName = new Map(ms.sourceTermDefinitions.map((st) => [st.uuid, ST_BASIS_LABELS[st.sourceTermBasis]?.label ?? st.sourceTermBasis]));
  const record = ms.riskIntegrationFeedback;
  const general = record?.generalFeedback?.trim() ?? "";
  return [
    {
      key: "source-terms",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "Release category" }, { label: "Detail" }],
      rows: [
        ...ms.sourceTermDefinitions.map((st) => ({ id: `st-${st.uuid}`, cells: ["Source term", handoffName(st.uuid, ST_BASIS_LABELS[st.sourceTermBasis]?.label ?? st.sourceTermBasis), category(st.releaseCategoryReference), sourceTermDetail(st)] })),
        ...ms.releaseCategories.map((rc) => ({ id: `bound-${rc.uuid}`, cells: ["Bounding sequence", rc.boundingSequenceReference.length === 0 ? "None" : recordLabel(rc.boundingSequenceReference, sequenceName.get(rc.boundingSequenceReference)), category(rc.uuid), rc.boundingSequenceJustification ?? ""] })),
        ...ms.sourceInventories.map((inventory) => ({
          id: `inv-${inventory.uuid}`,
          cells: [
            "Source inventory",
            handoffName(inventory.uuid, inventory.name),
            joinedOrNone([...new Set(ms.transportBarrierAssessments.filter((barrier) => barrier.sourceInventoryRefs.includes(inventory.uuid)).map((barrier) => barrier.releaseCategoryReference))].map((id) => recordLabel(id, categoryName.get(id)))),
            `Source ${inventory.radioactiveSourceRef === undefined || inventory.radioactiveSourceRef.length === 0 ? "None" : recordLabel(inventory.radioactiveSourceRef, sourceName.get(inventory.radioactiveSourceRef))} · ${String(inventory.inventory.length)} species`,
          ],
        })),
        ...ms.transportBarrierAssessments.map((barrier) => ({ id: `bar-${barrier.uuid}`, cells: ["Transport barrier", handoffName(barrier.uuid, barrier.name), category(barrier.releaseCategoryReference), `${barrier.barrierType} · DF ${String(barrier.decontaminationFactor ?? 1)}`] })),
        ...ms.transportPhenomenaAssessments.map((assessment) => ({
          id: `tpa-${assessment.uuid}`,
          cells: ["Transport phenomena", recordLabel(assessment.uuid, "Phenomena checklist"), category(assessment.releaseCategoryReference), `${String(assessment.phenomenaChecklist.filter((item) => item.included).length)} of ${String(assessment.phenomenaChecklist.length)} phenomena included`],
        })),
      ],
    },
    {
      key: "uncertainty",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "Detail" }],
      rows: [
        ...(ms.modelUncertaintyAssessments ?? []).map((entry) => ({ id: `mu-${entry.uuid}`, cells: ["Model uncertainty", handoffName(entry.uncertaintySource, SOURCE_BLOCK_TEXT[entry.sourceBlock] ?? entry.sourceBlock), entry.consequenceEffect] })),
        ...(ms.sensitivityStudies ?? []).map((study) => ({ id: `ss-${study.uuid}`, cells: ["Sensitivity study", study.name ?? study.description, study.results ?? joinedOrNone(study.variedParameters)] })),
      ],
    },
    {
      key: "responses",
      subsections: [
        {
          key: "ri-feedback",
          name: "RI feedback",
          columns: [{ label: "Item" }, { label: "Kind" }, { label: "RI level" }, { label: "Detail" }, { label: "Status" }],
          rows: [
            ...(record?.releaseCategoryFeedback ?? []).map((row) => ({
              id: `rc-${row.releaseCategoryReference}`,
              cells: [category(row.releaseCategoryReference), "Release category", levelText(row.riskSignificance), joinedOrNone(row.recommendations ?? []), <StatusCell key="status" kind="category" itemKey={row.releaseCategoryReference} status={row.status} />],
            })),
            ...(record?.sourceTermFeedback ?? []).map((row) => ({
              id: `st-${row.sourceTermDefinitionRef}`,
              cells: [recordLabel(row.sourceTermDefinitionRef, sourceTermName.get(row.sourceTermDefinitionRef)), "Source term", levelText(row.riskSignificance), joinedOrNone(row.keyUncertainties ?? []), <StatusCell key="status" kind="sourceTerm" itemKey={row.sourceTermDefinitionRef} status={row.status} />],
            })),
            ...(general.length === 0 ? [] : [{ id: "general", cells: ["General", "Message", "None", general, "None"] }]),
          ],
        },
        {
          key: "response",
          name: "Response",
          columns: [{ label: "Response" }, { label: "Changes made" }, { label: "Status" }],
          rows: [{ id: "response", cells: [<ResponseTextCell key="description" field="description" />, <ResponseTextCell key="changes" field="changes" />, <ResponseStatusCell key="status" />] }],
        },
      ],
    },
  ];
}

function MsHandoffScreen(): JSX.Element {
  const { ms, editable, mutateMs, upstream } = useMsWorkbook();
  const ri = upstream.ri;
  const recording = useRef(false);
  const due = editable && ri !== undefined && sentCount(ri) > 0 && feedbackKey(recordedFromRi(ms.riskIntegrationFeedback, ri)) !== feedbackKey(ms.riskIntegrationFeedback);

  useEffect(() => {
    if (!due || ri === undefined) {
      recording.current = false;
      return;
    }
    if (recording.current) return;
    recording.current = true;
    mutateMs((draft) => ({ ...draft, riskIntegrationFeedback: recordedFromRi(draft.riskIntegrationFeedback, ri) }));
  }, [due, ri, mutateMs]);

  return <TechnicalElementHandoff element="MS" sections={msHandoffSections(ms, upstream)} />;
}

export { MsHandoffScreen };
