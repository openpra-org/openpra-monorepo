import { type ChangeEvent, type JSX, useEffect, useMemo, useRef, useState } from "react";
import type {
  HclBasicEventProbabilityDistribution,
  HclEvidenceScenario,
  HclUncertaintySettings,
  WorkbookHclConfiguration,
} from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  hclTargetKey,
  resolveHclBatchTargetRelevance,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type {
  HclCutSetAnalysis,
  HclImportanceAnalysis,
  HclUncertaintySummary,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { useEditorConfirmation } from "../shared";
import type {
  HclBindingEditorProps,
  HclEditorBatchRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
} from "./hclBindingTypes";
import { serializeHclCutSetsCsv, type HclCutSetExportRow } from "./hclCutSetExport";
import { serializeHclImportanceCsv, type HclImportanceExportRow } from "./hclImportanceExport";
import { HclEvidenceScenarioEditor } from "./hclEvidenceScenarioEditor";
import {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
} from "./hclEvidenceScenarioInterchange";
import "./css/hclBindingEditor.css";

const CUT_SETS_PER_PAGE = 10;
const IMPORTANCE_ROWS_PER_PAGE = 10;

function createBasicEventDistribution(
  family: HclBasicEventProbabilityDistribution["family"],
): HclBasicEventProbabilityDistribution {
  if (family === "BETA") return { family: "BETA", alpha: 2, beta: 18 };
  if (family === "LOGNORMAL") return { family: "LOGNORMAL", median: 0.01, errorFactor: 3 };
  return { family: "UNIFORM", lower: 0, upper: 0.1 };
}

function probabilityDistributionLabel(distribution: HclBasicEventProbabilityDistribution): string {
  if (distribution.family === "BETA") return "Beta";
  if (distribution.family === "LOGNORMAL") return "Lognormal";
  return "Uniform";
}

function uniqueCode(prefix: string, codes: readonly string[]): string {
  const normalized = new Set(codes.map((code) => code.trim().toUpperCase()));
  let suffix = normalized.size + 1;
  while (normalized.has(`${prefix}-${String(suffix)}`)) suffix += 1;
  return `${prefix}-${String(suffix)}`;
}

function createEvidenceBatchSamples(model: BayesianNetworkModel): HclEvidenceScenario[] {
  const sampleNodes = model.nodes.filter((node) => node.states.length > 0).slice(0, 3);
  if (sampleNodes.length === 0) return [];
  return [0, 1].map((scenarioIndex) => ({
    id: crypto.randomUUID(),
    code: `SAMPLE-${String(scenarioIndex + 1).padStart(2, "0")}`,
    name: `Sample evidence ${String(scenarioIndex + 1)}`,
    enabled: true,
    evidence: {
      observations: sampleNodes.map((node) => ({
        nodeId: node.id,
        stateId: node.states[scenarioIndex % node.states.length]!.id,
      })),
    },
  }));
}

function batchHasNoNumericVariation(batch: HclEditorBatchRunResult): boolean {
  const vectors = batch.scenarios.flatMap((scenario) => {
    if (scenario.status !== "SUCCEEDED" || scenario.result === null) return [];
    if (scenario.result.kind === "FAULT_TREE") {
      return [[scenario.result.result.probability]];
    }
    return [[...scenario.result.result.sequences]
      .sort((left, right) => left.sequenceId.localeCompare(right.sequenceId))
      .flatMap((sequence) => [sequence.conditionalProbability, sequence.annualFrequency])];
  });
  if (vectors.length < 2) return false;
  const first = vectors[0]!;
  return vectors.slice(1).every((vector) =>
    vector.length === first.length
    && vector.every((value, index) => {
      const baseline = first[index]!;
      return Math.abs(value - baseline)
        <= Math.max(1, Math.abs(baseline), Math.abs(value)) * 1e-12;
    }),
  );
}

function resultBarWidth(value: number): string {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return `${String(percent > 0 ? Math.max(0.75, percent) : 0)}%`;
}

function formatScientific(value: number): string {
  const [coefficient, exponent = "0"] = value.toExponential(2).split("e");
  const numericExponent = Number(exponent);
  const sign = numericExponent >= 0 ? "+" : "-";
  return `${coefficient}E${sign}${String(Math.abs(numericExponent)).padStart(2, "0")}`;
}

function formatPercentage(value: number): string {
  const percent = value * 100;
  if (percent === 0 || Math.abs(percent) >= 0.01) return `${percent.toFixed(2)}%`;
  return `${formatScientific(percent)}%`;
}

function HclResultMetric({
  label,
  value,
  ratio,
  detail,
}: {
  label: string;
  value: string;
  ratio?: number;
  detail?: string;
}): JSX.Element {
  return (
    <div className="bneditor__posterior-state hcleditor__result-metric">
      <span>{label}</span>
      <output>{value}</output>
      {ratio !== undefined && (
        <i aria-hidden="true">
          <b style={{ width: resultBarWidth(ratio) }} />
        </i>
      )}
      {detail !== undefined && <small title={detail}>{detail}</small>}
    </div>
  );
}

function HclUncertaintyResults({
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
  if (summary === undefined) return null;
  const unit = annual ? "/yr" : "";
  const metrics = [
    { label: "Mean", value: `${formatScientific(summary.mean)}${unit}` },
    { label: "5th percentile", value: `${formatScientific(summary.percentile05)}${unit}` },
    { label: "Median", value: `${formatScientific(summary.median)}${unit}` },
    { label: "95th percentile", value: `${formatScientific(summary.percentile95)}${unit}` },
    { label: "Standard deviation", value: `${formatScientific(summary.standardDeviation)}${unit}` },
  ];
  const accessibleLabel = label === "Uncertainty" ? "Uncertainty results" : `${label} uncertainty results`;
  return (
    <section className={`hcleditor__uncertainty-result${inline ? " hcleditor__uncertainty-result--inline" : ""}`} aria-label={accessibleLabel}>
      <div className="hcleditor__uncertainty-result-head">
        <strong>{label}</strong>
        <span>{String(summary.sampleCount)} PRAXIS samples · seed {String(summary.seed)}</span>
      </div>
      <dl className="hcleditor__uncertainty-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="hcleditor__uncertainty-metric">
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function cutSetExportFilename(label: string): string {
  const segment = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${segment.length === 0 ? "hcl-cut-sets" : segment}.csv`;
}

function importanceExportFilename(label: string): string {
  const segment = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${segment.length === 0 ? "hcl-importance" : segment}.csv`;
}

function formatWorth(value: number | null): string {
  if (value === null) return "—";
  if (value !== 0 && (Math.abs(value) >= 10_000 || Math.abs(value) < 0.01)) {
    return formatScientific(value);
  }
  return value.toFixed(2);
}

function HclCutSetResults({
  analysis,
  model,
  faultTreeOptions,
  label = "HCL-aware cut sets",
  embedded = false,
}: {
  analysis: HclCutSetAnalysis | undefined;
  model: BayesianNetworkModel;
  faultTreeOptions: HclFaultTreeOption[];
  label?: string;
  embedded?: boolean;
}): JSX.Element | null {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [analysis]);
  if (analysis === undefined) return null;
  const basicEvents = new Map(
    faultTreeOptions.flatMap((tree) => tree.basicEvents).map((event) => [event.id, event]),
  );
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const nodeCode = (nodeId: string): string => nodes.get(nodeId)?.code ?? nodeId;
  const stateCode = (nodeId: string, stateId: string): string =>
    nodes.get(nodeId)?.states.find((state) => state.id === stateId)?.code ?? stateId;
  const rows = analysis.cutSets.map((cutSet) => {
    const expression = cutSet.literals.length === 0
      ? "TRUE"
      : cutSet.literals.map((literal) => {
        const event = basicEvents.get(literal.basicEventId);
        return `${literal.complemented ? "¬" : ""}${event?.code ?? literal.basicEventId}`;
      }).join(" ∩ ");
    const conditions = cutSet.literals.flatMap((literal) => {
      if (literal.binding === null) return [];
      const event = basicEvents.get(literal.basicEventId);
      const node = nodes.get(literal.binding.bayesianNetworkNodeId);
      const states = literal.binding.stateIds.map((stateId) =>
        stateCode(literal.binding!.bayesianNetworkNodeId, stateId),
      );
      const parents = literal.binding.parentNodeIds.map(nodeCode);
      return [`${event?.code ?? literal.basicEventId} → ${node?.code ?? literal.binding.bayesianNetworkNodeId} = ${states.join(" or ")}${parents.length === 0 ? "" : ` (parents: ${parents.join(", ")})`}`];
    });
    return {
      cutSet,
      expression,
      conditions,
      rootCauses: cutSet.bnRootCauseNodeIds.map(nodeCode),
      ancestors: cutSet.bnAncestorNodeIds.map(nodeCode),
    };
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / CUT_SETS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const firstIndex = currentPage * CUT_SETS_PER_PAGE;
  const visibleRows = rows.slice(firstIndex, firstIndex + CUT_SETS_PER_PAGE);
  const exportRows: HclCutSetExportRow[] = rows.map(({ cutSet, expression, conditions, rootCauses, ancestors }) => ({
    rank: cutSet.rank,
    order: cutSet.order,
    probability: cutSet.probability,
    coverage: cutSet.coverage,
    expression,
    conditions,
    rootCauses,
    ancestors,
  }));
  const exportCsv = (): void => {
    downloadText(
      cutSetExportFilename(label),
      serializeHclCutSetsCsv(exportRows),
      "text/csv;charset=utf-8",
    );
  };

  const content = analysis.cutSets.length === 0 ? (
        <p>No structural minimal cut sets.</p>
      ) : (
        <>
          <div className="hcleditor__cut-set-toolbar">
            <span>Showing {String(firstIndex + 1)}–{String(firstIndex + visibleRows.length)} of {String(rows.length)}</span>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={exportCsv}>Export CSV</button>
          </div>
          <div className="hcleditor__cut-set-list">
            {visibleRows.map(({ cutSet, expression, conditions, rootCauses, ancestors }) => (
              <details key={`${String(cutSet.rank)}:${expression}`} className="hcleditor__cut-set">
                <summary className="bneditor__posterior-state hcleditor__cut-set-metric">
                  <span>Cut set {String(cutSet.rank)}</span>
                  <output>{formatScientific(cutSet.probability)}</output>
                  <strong title={expression}>{expression}</strong>
                  <small>{cutSet.coverage === null ? "Coverage unavailable" : `${formatPercentage(cutSet.coverage)} coverage`}</small>
                  <i aria-hidden="true">
                    <b style={{ width: resultBarWidth(cutSet.coverage ?? 0) }} />
                  </i>
                </summary>
                <div className="hcleditor__cut-set-trace">
                  {conditions.length > 0 && (
                    <div><span>BN conditions</span><p>{conditions.join(" · ")}</p></div>
                  )}
                  {rootCauses.length > 0 && (
                    <div><span>Root causes</span><p>{rootCauses.join(", ")}</p></div>
                  )}
                  {ancestors.length > 0 && (
                    <div><span>BN ancestors</span><p>{ancestors.join(", ")}</p></div>
                  )}
                </div>
              </details>
            ))}
          </div>
          {pageCount > 1 && (
            <nav className="hcleditor__cut-set-pagination" aria-label={`${label} pagination`}>
              <button
                type="button"
                className="posnav__btn posnav__btn--sm"
                disabled={currentPage === 0}
                onClick={() => setPage(Math.max(0, currentPage - 1))}
              >Previous</button>
              <output>Page {String(currentPage + 1)} of {String(pageCount)}</output>
              <button
                type="button"
                className="posnav__btn posnav__btn--sm"
                disabled={currentPage === pageCount - 1}
                onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
              >Next</button>
            </nav>
          )}
        </>
      );
  if (embedded) {
    return (
      <div className="hcleditor__cut-sets hcleditor__cut-sets--embedded" aria-label={`${label} results`}>
        <div className="hcleditor__embedded-result-head"><strong>{label}</strong><output>{String(analysis.totalCount)}</output></div>
        {content}
      </div>
    );
  }
  return (
    <details className="hcleditor__cut-sets">
      <summary>
        <span>{label}</span>
        <output>{String(analysis.totalCount)}</output>
      </summary>
      {content}
    </details>
  );
}

function HclImportanceResults({
  analysis,
  model,
  faultTreeOptions,
  label = "Importance measures",
  embedded = false,
}: {
  analysis: HclImportanceAnalysis | undefined;
  model: BayesianNetworkModel;
  faultTreeOptions: HclFaultTreeOption[];
  label?: string;
  embedded?: boolean;
}): JSX.Element | null {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [analysis]);
  if (analysis === undefined) return null;
  const basicEvents = new Map(
    faultTreeOptions.flatMap((tree) => tree.basicEvents).map((event) => [event.id, event]),
  );
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const rows = analysis.measures.map((measure) => {
    const event = basicEvents.get(measure.basicEventId);
    const node = measure.bayesianNetworkNodeId === null
      ? undefined
      : nodes.get(measure.bayesianNetworkNodeId);
    return {
      measure,
      eventCode: event?.code ?? measure.basicEventId,
      eventName: event?.name ?? "",
      nodeCode: node?.code ?? measure.bayesianNetworkNodeId ?? "",
    };
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / IMPORTANCE_ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const firstIndex = currentPage * IMPORTANCE_ROWS_PER_PAGE;
  const visibleRows = rows.slice(firstIndex, firstIndex + IMPORTANCE_ROWS_PER_PAGE);
  const exportRows: HclImportanceExportRow[] = rows.map(({
    measure,
    eventCode,
    nodeCode,
  }) => ({
    rank: measure.rank,
    basicEvent: eventCode,
    bayesianNetworkNode: nodeCode,
    eventProbability: measure.eventProbability,
    probabilityIfTrue: measure.probabilityIfTrue,
    probabilityIfFalse: measure.probabilityIfFalse,
    birnbaum: measure.birnbaum,
    criticality: measure.criticality,
    fussellVesely: measure.fussellVesely,
    riskAchievementWorth: measure.riskAchievementWorth,
    riskReductionWorth: measure.riskReductionWorth,
  }));

  const content = rows.length === 0 ? (
        <p>No structural basic events affect this target.</p>
      ) : (
        <>
          <div className="hcleditor__cut-set-toolbar">
            <span>Showing {String(firstIndex + 1)}–{String(firstIndex + visibleRows.length)} of {String(rows.length)}</span>
            <button
              type="button"
              className="posnav__btn posnav__btn--sm"
              onClick={() => downloadText(
                importanceExportFilename(label),
                serializeHclImportanceCsv(exportRows),
                "text/csv;charset=utf-8",
              )}
            >Export CSV</button>
          </div>
          <div className="hcleditor__importance-header" aria-hidden="true">
            <span>Basic event</span>
            <span>FV</span>
            <span>RAW</span>
            <span>RRW</span>
          </div>
          <div className="hcleditor__importance-list">
            {visibleRows.map(({ measure, eventCode, eventName, nodeCode }) => (
              <details key={measure.basicEventId} className="hcleditor__importance-row">
                <summary>
                  <span><b>{String(measure.rank)}</b><strong title={eventName}>{eventCode}</strong></span>
                  <output>{measure.fussellVesely === null ? "—" : formatPercentage(measure.fussellVesely)}</output>
                  <output>{formatWorth(measure.riskAchievementWorth)}</output>
                  <output>{formatWorth(measure.riskReductionWorth)}</output>
                </summary>
                <div className="hcleditor__importance-detail">
                  <HclResultMetric label="Event probability" value={formatScientific(measure.eventProbability)} />
                  <HclResultMetric label="Target if true" value={formatScientific(measure.probabilityIfTrue)} />
                  <HclResultMetric label="Target if false" value={formatScientific(measure.probabilityIfFalse)} />
                  <HclResultMetric label="Birnbaum" value={formatScientific(measure.birnbaum)} />
                  <HclResultMetric label="Criticality" value={measure.criticality === null ? "—" : formatPercentage(measure.criticality)} />
                  {nodeCode !== "" && <HclResultMetric label="BN condition" value={nodeCode} />}
                </div>
              </details>
            ))}
          </div>
          {pageCount > 1 && (
            <nav className="hcleditor__cut-set-pagination" aria-label={`${label} pagination`}>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={currentPage === 0} onClick={() => setPage(Math.max(0, currentPage - 1))}>Previous</button>
              <output>Page {String(currentPage + 1)} of {String(pageCount)}</output>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={currentPage === pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}>Next</button>
            </nav>
          )}
        </>
      );
  if (embedded) {
    return (
      <div className="hcleditor__cut-sets hcleditor__cut-sets--embedded hcleditor__importance" aria-label={`${label} results`}>
        <div className="hcleditor__embedded-result-head"><strong>{label}</strong><output>{String(analysis.totalCount)}</output></div>
        {content}
      </div>
    );
  }
  return (
    <details className="hcleditor__cut-sets hcleditor__importance">
      <summary>
        <span>{label}</span>
        <output>{String(analysis.totalCount)}</output>
      </summary>
      {content}
    </details>
  );
}

interface HclFaultTreeDirectoryItem {
  id: string;
  code: string;
  title?: string;
}

function HclFaultTreeDirectory({
  ariaLabel,
  heading,
  items,
  emptyText,
  className = "",
}: {
  ariaLabel: string;
  heading: string;
  items: HclFaultTreeDirectoryItem[];
  emptyText: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={`hcleditor__trees${className === "" ? "" : ` ${className}`}`} aria-label={ariaLabel}>
      <div className="hcleditor__trees-head">
        <strong>{heading}</strong>
        <span>{items.length} {items.length === 1 ? "tree" : "trees"}</span>
      </div>
      {items.length > 0 ? (
        <div className="hcleditor__tree-cloud" role="list">
          {items.map((item) => (
            <span
              key={item.id}
              className="hcleditor__tree-token"
              role="listitem"
              title={item.title ?? item.code}
              aria-label={item.title ?? item.code}
            >
              <span className="hcleditor__tree-mark" aria-hidden="true">✓</span>
              <strong>{item.code}</strong>
            </span>
          ))}
        </div>
      ) : (
        <p className="hcleditor__trees-empty">{emptyText}</p>
      )}
    </div>
  );
}

function HclIcon({ name }: { name: "configuration" | "evidence" | "run" | "trash" }): JSX.Element {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "configuration" && <><circle {...common} cx="6" cy="12" r="3" /><circle {...common} cx="18" cy="6" r="3" /><circle {...common} cx="18" cy="18" r="3" /><path {...common} d="m9 11 6-4M9 13l6 4" /></>}
      {name === "evidence" && <><path {...common} d="M4 7h16M4 17h16" /><circle {...common} cx="9" cy="7" r="2" /><circle {...common} cx="15" cy="17" r="2" /></>}
      {name === "run" && <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m10 8.5 6 3.5-6 3.5z" /></>}
      {name === "trash" && <><path {...common} d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>}
    </svg>
  );
}

function HclBindingEditor({
  model,
  editable,
  workbookId,
  configurations,
  scope = "BOTH",
  faultTreeOptions,
  eventTreeOptions,
  baseEvidence,
  validation,
  quantificationBlocked = false,
  running,
  runError,
  runResult,
  batchRunResult,
  evidenceEditorOpen = false,
  evidenceEditor = null,
  calculationType = "PROBABILITY",
  workflow = "MANUAL",
  onEditEvidence,
  onChange,
  onRunFaultTree,
  onRunEventTree,
  onRunFaultTreeBatch,
  onRunEventTreeBatch,
}: HclBindingEditorProps): JSX.Element {
  const hasBlockingIssue = quantificationBlocked
    || validation.some((issue) => issue.severity === "ERROR");
  const configuration = configurations.find(
    (candidate) =>
      candidate.bayesianNetwork.modelId === model.modelId
      && (workbookId === null || candidate.bayesianNetwork.workbookId === workbookId),
  );
  const [faultTreeKey, setFaultTreeKey] = useState("");
  const [basicEventId, setBasicEventId] = useState("");
  const [nodeId, setNodeId] = useState(model.nodes[0]?.id ?? "");
  const [trueStateIds, setTrueStateIds] = useState<string[]>([]);
  const [targetKind, setTargetKind] = useState<"FAULT_TREE" | "EVENT_TREE">(
    scope === "EVENT_TREE" ? "EVENT_TREE" : "FAULT_TREE",
  );
  const [batchMode, setBatchMode] = useState<"SCENARIOS" | "HAZARD_GRID">("SCENARIOS");
  const [runFaultTreeKey, setRunFaultTreeKey] = useState("");
  const [eventTreeKey, setEventTreeKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [uncertainBasicEventKey, setUncertainBasicEventKey] = useState("");
  const [uncertainBasicEventFamily, setUncertainBasicEventFamily] = useState<HclBasicEventProbabilityDistribution["family"]>("BETA");
  const [uncertainCptRowKey, setUncertainCptRowKey] = useState("");
  const [uploadedBatchScenarios, setUploadedBatchScenarios] = useState<HclEvidenceScenario[] | null>(null);
  const batchImportRef = useRef<HTMLInputElement>(null);
  const batchSampleMenuRef = useRef<HTMLDetailsElement>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const selectedTree = faultTreeOptions.find(
    (option) => `${option.workbookId}:${option.modelId}` === faultTreeKey,
  );
  const selectedNode = model.nodes.find((node) => node.id === nodeId);
  const declaredFaultTrees = useMemo(() => {
    if (configuration === undefined) return [];
    const declared = new Set(configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`));
    return faultTreeOptions.filter((option) => declared.has(`${option.workbookId}:${option.modelId}`));
  }, [configuration, faultTreeOptions]);
  const executableFaultTrees = useMemo(
    () => declaredFaultTrees.filter((option) => option.topGateId !== null),
    [declaredFaultTrees],
  );
  const executableEventTrees = useMemo(() => {
    if (configuration === undefined) return [];
    const declared = new Set(configuration.faultTrees.map((reference) => hclTargetKey(reference)));
    return eventTreeOptions.filter((option) =>
      scope === "EVENT_TREE"
      || option.faultTrees.every((reference) => declared.has(hclTargetKey(reference))),
    );
  }, [configuration, eventTreeOptions, scope]);
  const enabledScenarios = useMemo(
    () => (uploadedBatchScenarios ?? configuration?.evidenceScenarios ?? []).filter((scenario) => scenario.enabled),
    [configuration?.evidenceScenarios, uploadedBatchScenarios],
  );
  const batchSamples = useMemo(() => createEvidenceBatchSamples(model), [model.nodes]);
  const batchRelevance = useMemo(() => configuration === undefined
    ? null
    : resolveHclBatchTargetRelevance({
        bayesianNetwork: model,
        baseEvidence: configuration.baseEvidence,
        scenarios: enabledScenarios,
        bindings: configuration.bindings,
        faultTrees: declaredFaultTrees.map((option) => ({
          workbookId: option.workbookId,
          modelId: option.modelId,
          topGateId: option.topGateId,
          gates: option.gates,
          leafNodes: option.leafNodes,
          gateInputs: option.gateInputs,
          constantBasicEventStates: option.constantBasicEventStates,
        })),
        eventTrees: executableEventTrees.map((option) => ({
          workbookId: option.workbookId,
          modelId: option.modelId,
          faultTrees: option.faultTrees,
          transferTargets: option.transferTargets,
        })),
      }), [configuration, declaredFaultTrees, enabledScenarios, executableEventTrees, model]);
  const batchFaultTreeKeys = useMemo(
    () => new Set(batchRelevance?.faultTreeKeys ?? []),
    [batchRelevance?.faultTreeKeys],
  );
  const batchEventTreeKeys = useMemo(
    () => new Set(batchRelevance?.eventTreeKeys ?? []),
    [batchRelevance?.eventTreeKeys],
  );
  const effectiveEvidenceMode = workflow === "MANUAL" ? "BASE" : batchMode;
  const runFaultTreeOptions = effectiveEvidenceMode !== "BASE"
    ? executableFaultTrees.filter((option) => batchFaultTreeKeys.has(hclTargetKey(option)))
    : executableFaultTrees;
  const runEventTreeOptions = effectiveEvidenceMode !== "BASE"
    ? executableEventTrees.filter((option) => batchEventTreeKeys.has(hclTargetKey(option)))
    : executableEventTrees;
  const batchNumericallyUnchanged = batchRunResult !== null
    && batchHasNoNumericVariation(batchRunResult);
  const selectedEventTree = runEventTreeOptions.find(
    (option) => `${option.workbookId}:${option.modelId}` === eventTreeKey,
  );
  const boundBasicEventKeys = useMemo(
    () => new Set((configuration?.bindings ?? []).map((binding) => `${binding.faultTreeBasicEvent.workbookId}:${binding.faultTreeBasicEvent.entityId}`)),
    [configuration?.bindings],
  );
  const basicEventUncertaintyOptions = useMemo(() => {
    const options = declaredFaultTrees.flatMap((tree) => tree.basicEvents.flatMap((event) => {
      const key = `${tree.workbookId}:${event.id}`;
      return boundBasicEventKeys.has(key) ? [] : [{ key, tree, event }];
    }));
    return [...new Map(options.map((option) => [option.key, option])).values()];
  }, [boundBasicEventKeys, declaredFaultTrees]);
  const cptRowUncertaintyOptions = useMemo(() => model.conditionalProbabilityTables.flatMap((table) => {
    const node = model.nodes.find((candidate) => candidate.id === table.nodeId);
    return table.rows.map((row) => {
      const condition = row.parentStates.map((selection) => {
        const parent = model.nodes.find((candidate) => candidate.id === selection.parentNodeId);
        const state = parent?.states.find((candidate) => candidate.id === selection.stateId);
        return `${parent?.code ?? selection.parentNodeId}=${state?.code ?? selection.stateId}`;
      }).join(", ");
      return {
        key: `${table.nodeId}:${row.id}`,
        nodeId: table.nodeId,
        rowId: row.id,
        label: `${node?.code ?? table.nodeId}${condition.length === 0 ? " · prior" : ` · ${condition}`}`,
      };
    });
  }), [model.conditionalProbabilityTables, model.nodes]);

  useEffect(() => {
    if (scope === "EVENT_TREE") setTargetKind("EVENT_TREE");
    if (scope === "FAULT_TREE") setTargetKind("FAULT_TREE");
  }, [scope]);
  useEffect(() => {
    if (faultTreeOptions.some((option) => `${option.workbookId}:${option.modelId}` === faultTreeKey)) return;
    const first = faultTreeOptions[0];
    setFaultTreeKey(first === undefined ? "" : `${first.workbookId}:${first.modelId}`);
  }, [faultTreeKey, faultTreeOptions]);
  useEffect(() => {
    if (selectedTree?.basicEvents.some((event) => event.id === basicEventId) === true) return;
    setBasicEventId(selectedTree?.basicEvents[0]?.id ?? "");
  }, [basicEventId, selectedTree]);
  useEffect(() => {
    if (model.nodes.some((node) => node.id === nodeId)) return;
    setNodeId(model.nodes[0]?.id ?? "");
    setTrueStateIds([]);
  }, [model.nodes, nodeId]);
  useEffect(() => {
    if (runEventTreeOptions.some((option) => hclTargetKey(option) === eventTreeKey)) return;
    const first = runEventTreeOptions[0];
    setEventTreeKey(first === undefined ? "" : `${first.workbookId}:${first.modelId}`);
  }, [eventTreeKey, runEventTreeOptions]);
  useEffect(() => {
    if (runFaultTreeOptions.some((option) => hclTargetKey(option) === runFaultTreeKey)) return;
    const first = runFaultTreeOptions[0];
    setRunFaultTreeKey(first === undefined ? "" : `${first.workbookId}:${first.modelId}`);
  }, [runFaultTreeKey, runFaultTreeOptions]);
  useEffect(() => {
    setUploadedBatchScenarios(null);
  }, [configuration?.modelId, model.modelId]);
  useEffect(() => {
    const closeSampleMenu = (event: PointerEvent): void => {
      const menu = batchSampleMenuRef.current;
      if (menu?.open === true && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const closeSampleMenuOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && batchSampleMenuRef.current !== null) batchSampleMenuRef.current.open = false;
    };
    window.addEventListener("pointerdown", closeSampleMenu);
    window.addEventListener("keydown", closeSampleMenuOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeSampleMenu);
      window.removeEventListener("keydown", closeSampleMenuOnEscape);
    };
  }, []);

  function createConfiguration(): void {
    if (workbookId === null) {
      setError("Save this workbook before creating an HCL configuration.");
      return;
    }
    const created: WorkbookHclConfiguration = {
      modelId: crypto.randomUUID(),
      code: uniqueCode("HCL", configurations.map((candidate) => candidate.code)),
      name: `${model.name} HCL bindings`,
      description: "Fault-tree events bound to Bayesian-network states.",
      bayesianNetwork: { workbookId, modelId: model.modelId },
      faultTrees: [],
      bindings: [],
      baseEvidence,
      evidenceScenarios: [],
      solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
    };
    onChange([...configurations, created]);
    setManageOpen(true);
    setError(null);
  }

  function replaceConfiguration(next: WorkbookHclConfiguration): void {
    onChange(configurations.map((candidate) => candidate.modelId === next.modelId ? next : candidate));
  }

  function replaceUncertainty(uncertainty: HclUncertaintySettings | undefined): void {
    if (configuration === undefined) return;
    const solverSettings = { ...configuration.solverSettings };
    if (uncertainty === undefined) delete solverSettings.uncertainty;
    else solverSettings.uncertainty = uncertainty;
    replaceConfiguration({ ...configuration, solverSettings });
  }

  function enableUncertainty(): void {
    replaceUncertainty({
      sampleCount: 1_000,
      seed: 42,
      basicEventDistributions: [],
      cptRowDistributions: [],
    });
  }

  function addBasicEventUncertainty(): void {
    const uncertainty = configuration?.solverSettings.uncertainty;
    if (configuration === undefined || uncertainty === undefined) return;
    const selected = basicEventUncertaintyOptions.find((option) => option.key === uncertainBasicEventKey)
      ?? basicEventUncertaintyOptions[0];
    if (selected === undefined) {
      setError("No unbound basic event is available for uncertainty.");
      return;
    }
    if (uncertainty.basicEventDistributions.some(({ faultTreeBasicEvent }) =>
      `${faultTreeBasicEvent.workbookId}:${faultTreeBasicEvent.entityId}` === selected.key,
    )) {
      setError("That basic event already has an uncertainty distribution.");
      return;
    }
    const distribution = createBasicEventDistribution(uncertainBasicEventFamily);
    replaceUncertainty({
      ...uncertainty,
      basicEventDistributions: [...uncertainty.basicEventDistributions, {
        faultTreeBasicEvent: {
          referenceType: "FAULT_TREE_BASIC_EVENT",
          workbookId: selected.tree.workbookId,
          entityId: selected.event.id,
        },
        distribution,
      }],
    });
    setError(null);
  }

  function addCptRowUncertainty(): void {
    const uncertainty = configuration?.solverSettings.uncertainty;
    if (configuration === undefined || uncertainty === undefined) return;
    const selected = cptRowUncertaintyOptions.find((option) => option.key === uncertainCptRowKey)
      ?? cptRowUncertaintyOptions[0];
    if (selected === undefined) {
      setError("No CPT row is available for uncertainty.");
      return;
    }
    if (uncertainty.cptRowDistributions.some((row) => row.bayesianNetworkNode.entityId === selected.nodeId && row.cptRowId === selected.rowId)) {
      setError("That CPT row already has an uncertainty distribution.");
      return;
    }
    replaceUncertainty({
      ...uncertainty,
      cptRowDistributions: [...uncertainty.cptRowDistributions, {
        bayesianNetworkNode: {
          referenceType: "BAYESIAN_NETWORK_NODE",
          workbookId: configuration.bayesianNetwork.workbookId,
          modelId: model.modelId,
          entityId: selected.nodeId,
        },
        cptRowId: selected.rowId,
        equivalentSampleSize: 100,
      }],
    });
    setError(null);
  }

  function updateBasicEventDistribution(index: number, distribution: HclBasicEventProbabilityDistribution): void {
    const uncertainty = configuration?.solverSettings.uncertainty;
    if (uncertainty === undefined) return;
    replaceUncertainty({
      ...uncertainty,
      basicEventDistributions: uncertainty.basicEventDistributions.map((definition, definitionIndex) =>
        definitionIndex === index ? { ...definition, distribution } : definition,
      ),
    });
  }

  function deleteConfiguration(): void {
    if (configuration === undefined) return;
    requestConfirmation({
      title: `Delete ${configuration.code}?`,
      message: `${String(configuration.bindings.length)} fault-tree binding${configuration.bindings.length === 1 ? "" : "s"} will also be removed.`,
      confirmLabel: "Delete configuration",
      tone: "danger",
    }, () => {
      onChange(configurations.filter((candidate) => candidate.modelId !== configuration.modelId));
      setManageOpen(false);
    });
  }

  function addBinding(): void {
    if (configuration === undefined || selectedTree === undefined || selectedNode === undefined) {
      setError("Choose a fault tree, basic event, and Bayesian-network node.");
      return;
    }
    if (basicEventId === "") {
      setError("Choose a basic event.");
      return;
    }
    if (trueStateIds.length === 0) {
      setError("Select at least one true state.");
      return;
    }
    if (trueStateIds.length === selectedNode.states.length) {
      setError("The true-state selection cannot contain every state of the node.");
      return;
    }
    if (configuration.bindings.some((binding) =>
      binding.faultTreeBasicEvent.workbookId === selectedTree.workbookId
      && binding.faultTreeBasicEvent.entityId === basicEventId,
    )) {
      setError("That basic event already has an HCL binding.");
      return;
    }
    const faultTreeAddress = { workbookId: selectedTree.workbookId, modelId: selectedTree.modelId };
    replaceConfiguration({
      ...configuration,
      faultTrees: configuration.faultTrees.some((reference) =>
        reference.workbookId === faultTreeAddress.workbookId && reference.modelId === faultTreeAddress.modelId,
      ) ? configuration.faultTrees : [...configuration.faultTrees, faultTreeAddress],
      bindings: [
        ...configuration.bindings,
        {
          id: crypto.randomUUID(),
          faultTreeBasicEvent: {
            referenceType: "FAULT_TREE_BASIC_EVENT",
            workbookId: selectedTree.workbookId,
            entityId: basicEventId,
          },
          bayesianNetworkNode: {
            referenceType: "BAYESIAN_NETWORK_NODE",
            workbookId: configuration.bayesianNetwork.workbookId,
            modelId: model.modelId,
            entityId: selectedNode.id,
          },
          trueStateIds: trueStateIds as [string, ...string[]],
        },
      ],
    });
    setTrueStateIds([]);
    setError(null);
  }

  function includeSelectedFaultTree(): void {
    if (configuration === undefined || selectedTree === undefined) {
      setError("Choose a fault tree to include.");
      return;
    }
    if (configuration.faultTrees.some((reference) =>
      reference.workbookId === selectedTree.workbookId && reference.modelId === selectedTree.modelId,
    )) {
      setError("That fault tree is already included.");
      return;
    }
    replaceConfiguration({
      ...configuration,
      faultTrees: [...configuration.faultTrees, {
        workbookId: selectedTree.workbookId,
        modelId: selectedTree.modelId,
      }],
    });
    setError(null);
  }

  async function importBatchScenarios(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined || configuration === undefined) return;
    try {
      const source = await file.text();
      const imported = file.name.toLowerCase().endsWith(".csv")
        ? importHclEvidenceScenariosCsv(source, model)
        : importHclEvidenceScenariosJson(source, model);
      setUploadedBatchScenarios(imported);
      setError(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import the evidence batch.");
    }
  }

  function downloadBatchSample(format: "JSON" | "CSV"): void {
    if (batchSamples.length === 0) {
      setError("Add at least one BN node with a state before downloading a sample.");
      return;
    }
    const filename = `${model.code || "bayesian-network"}-hcl-evidence-sample.${format.toLowerCase()}`;
    if (format === "JSON") {
      downloadText(filename, exportHclEvidenceScenariosJson(batchSamples, model), "application/json");
    } else {
      downloadText(filename, exportHclEvidenceScenariosCsv(batchSamples, model), "text/csv");
    }
    setError(null);
  }

  function run(): void {
    if (configuration === undefined) return;
    const scenarioIds = enabledScenarios.map((scenario) => scenario.id);
    const isBatchWorkflow = workflow === "BATCH";
    const runConfiguration = isBatchWorkflow && uploadedBatchScenarios !== null
      ? { ...configuration, evidenceScenarios: uploadedBatchScenarios }
      : configuration;
    if (isBatchWorkflow && scenarioIds.length === 0) {
      setError("Enable at least one evidence scenario before running the batch.");
      return;
    }
    if (effectiveEvidenceMode === "HAZARD_GRID" && configuration.hazardGrid === undefined) {
      setError("Configure a hazard grid before running the convolution.");
      return;
    }
    if (targetKind === "FAULT_TREE") {
      const tree = runFaultTreeOptions.find((option) => `${option.workbookId}:${option.modelId}` === runFaultTreeKey);
      if (tree === undefined) {
        setError(isBatchWorkflow
          ? "No configured fault-tree target is affected by evidence that varies across the enabled scenarios."
          : "Choose a linked fault tree with a top event.");
        return;
      }
      if (isBatchWorkflow) onRunFaultTreeBatch(runConfiguration, tree, scenarioIds, effectiveEvidenceMode === "HAZARD_GRID");
      else onRunFaultTree(configuration, tree);
      return;
    }
    if (selectedEventTree === undefined) {
      setError(isBatchWorkflow
        ? "No linked event-tree target is affected by evidence that varies across the enabled scenarios."
        : "Choose an event tree.");
      return;
    }
    if (isBatchWorkflow) onRunEventTreeBatch(runConfiguration, selectedEventTree, scenarioIds, effectiveEvidenceMode === "HAZARD_GRID");
    else onRunEventTree(configuration, selectedEventTree);
  }

  const calculationLabel = calculationType === "CUT_SETS"
    ? "cut sets"
    : calculationType === "UNCERTAINTY"
      ? "uncertainty"
      : calculationType === "IMPORTANCE"
        ? "importance"
        : "probability";
  const targetFields = (
    <>
      {scope === "BOTH" && (
        <label className="hcleditor__run-field hcleditor__run-field--kind">
          <span>Quantify</span>
          <select aria-label="HCL target type" value={targetKind} onChange={(event) => setTargetKind(event.target.value as "FAULT_TREE" | "EVENT_TREE")}>
            <option value="FAULT_TREE">Fault tree</option>
            <option value="EVENT_TREE">Event tree</option>
          </select>
        </label>
      )}
      {targetKind === "FAULT_TREE" ? (
        <label className="hcleditor__run-field hcleditor__run-field--target">
          <span>Top event</span>
          <select aria-label="HCL fault-tree target" value={runFaultTreeKey} onChange={(event) => setRunFaultTreeKey(event.target.value)}>
            {runFaultTreeOptions.length === 0 && <option value="">{effectiveEvidenceMode !== "BASE" ? "No affected fault tree" : "No linked fault tree"}</option>}
            {runFaultTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode} · {option.modelName}</option>)}
          </select>
        </label>
      ) : (
        <label className="hcleditor__run-field hcleditor__run-field--target">
          <span>Event tree</span>
          <select aria-label="HCL event-tree target" value={eventTreeKey} onChange={(event) => setEventTreeKey(event.target.value)}>
            {runEventTreeOptions.length === 0 && <option value="">{effectiveEvidenceMode !== "BASE" ? "No affected event tree" : "No linked event tree"}</option>}
            {runEventTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode}</option>)}
          </select>
        </label>
      )}
    </>
  );

  return (
    <section className="hcleditor" aria-label="HCL bindings">
      {configuration === undefined ? (
        <div className="hcleditor__empty-state">
          <span>No HCL configuration</span>
          {editable && scope !== "EVENT_TREE" && (
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createConfiguration}>
            <HclIcon name="configuration" />
            <span>Create HCL configuration</span>
          </button>
          )}
        </div>
      ) : (
        <>
          <div className={`hcleditor__composer hcleditor__composer--${workflow.toLowerCase()}`} aria-label="HCL quantification controls">
            <div className="hcleditor__setup-row">
              {workflow === "MANUAL" ? (
                <div className="hcleditor__setup-actions">
                  {onEditEvidence !== undefined && (
                    <div className="hcleditor__evidence-anchor">
                      <button type="button" className="posnav__btn posnav__btn--sm bneditor__evidence-trigger" aria-label="Edit evidence" aria-expanded={evidenceEditorOpen} onClick={onEditEvidence}>
                        <HclIcon name="evidence" />
                        <span>Evidence</span>
                        {baseEvidence.observations.length > 0 && <b>{String(baseEvidence.observations.length)}</b>}
                      </button>
                      {evidenceEditor}
                    </div>
                  )}
                  {scope !== "EVENT_TREE" && (
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={manageOpen} onClick={() => setManageOpen((open) => !open)}>
                      <HclIcon name="configuration" />
                      <span>Configuration</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="hcleditor__batch-setup">
                  <label className="hcleditor__run-field hcleditor__run-field--evidence">
                    <span>Batch type</span>
                    <select aria-label="HCL batch type" value={batchMode} onChange={(event) => setBatchMode(event.target.value as "SCENARIOS" | "HAZARD_GRID")}>
                      <option value="SCENARIOS">Evidence scenarios</option>
                      <option value="HAZARD_GRID">Hazard convolution</option>
                    </select>
                  </label>
                  {scope !== "EVENT_TREE" && (
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={manageOpen} onClick={() => setManageOpen((open) => !open)}>
                      <HclIcon name="configuration" />
                      <span>Configuration</span>
                    </button>
                  )}
                </div>
              )}
              <div className="hcleditor__setup-actions hcleditor__setup-actions--end">
                {workflow === "BATCH" && (
                  <>
                    <input ref={batchImportRef} hidden type="file" accept=".json,.csv,application/json,text/csv" aria-label="Upload HCL evidence batch" onChange={(event) => { void importBatchScenarios(event); }} />
                    <button type="button" className="posnav__btn posnav__btn--sm hcleditor__batch-upload" aria-label="Upload JSON/CSV" onClick={() => batchImportRef.current?.click()}>
                      <span>Upload JSON/CSV</span>
                      {enabledScenarios.length > 0 && <b>{String(enabledScenarios.length)}</b>}
                    </button>
                    <details ref={batchSampleMenuRef} className="hcleditor__download-menu">
                      <summary className="posnav__btn posnav__btn--sm" role="button"><span>Download samples</span><svg viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5" /></svg></summary>
                      <div className="hcleditor__download-popover" role="menu" aria-label="HCL batch samples">
                        <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); downloadBatchSample("JSON"); }}>Sample JSON</button>
                        <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); downloadBatchSample("CSV"); }}>Sample CSV</button>
                      </div>
                    </details>
                  </>
                )}
                {scope !== "EVENT_TREE" && (
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
                    <HclIcon name="configuration" />
                    <span>Advanced</span>
                  </button>
                )}
              </div>
            </div>
            <div className="hcleditor__execution-row">
              <div className="hcleditor__run-fields">{targetFields}</div>
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || hasBlockingIssue || (calculationType === "UNCERTAINTY" && configuration.solverSettings.uncertainty === undefined) || (targetKind === "FAULT_TREE" ? runFaultTreeOptions.length === 0 : runEventTreeOptions.length === 0)} onClick={run}>
                <HclIcon name="run" />
                <span>{running ? "Running…" : `Run ${calculationLabel}${workflow === "BATCH" ? " batch" : ""}`}</span>
              </button>
            </div>
          </div>

          {targetKind === "EVENT_TREE" && selectedEventTree !== undefined && (
            <details className="hcleditor__supporting-details hcleditor__linked-tree-directory">
              <summary>Linked fault trees <span>{String(selectedEventTree.linkedFaultTrees?.length ?? 0)}</span></summary>
              <HclFaultTreeDirectory
                ariaLabel="Automatically linked fault trees"
                heading="Linked fault trees"
                items={(selectedEventTree.linkedFaultTrees ?? []).map((tree) => ({
                  id: `${tree.workbookId}:${tree.modelId}`,
                  code: tree.modelCode,
                  title: `${tree.modelCode} · ${tree.modelName} · ${tree.functionalEvents.map((event) => event.code).join(", ")}`,
                }))}
                emptyText="No functional-event fault-tree links were found."
              />
            </details>
          )}

          {manageOpen && (
            <div className="hcleditor__manage" aria-label="HCL configuration manager">
              <div className="hcleditor__manage-head">
                <strong>Configuration</strong>
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Close HCL manager" onClick={() => setManageOpen(false)}>Close</button>
              </div>
              <div className="hcleditor__configuration-stack">

              {workflow === "MANUAL" && calculationType !== "UNCERTAINTY" && (
                <>
              <details className="hcleditor__configuration-group">
                <summary>Fault trees <span>{String(configuration.faultTrees.length)}</span></summary>
                <div role="tabpanel" aria-label="HCL fault trees">
                  {editable && (
                    <div className="hcleditor__tree-picker">
                      <label>
                        <span>Fault tree</span>
                        <select aria-label="Fault tree to include" value={faultTreeKey} onChange={(event) => setFaultTreeKey(event.target.value)}>
                          {faultTreeOptions.length === 0 && <option value="">No Systems Analysis fault tree available</option>}
                          {faultTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode}</option>)}
                        </select>
                      </label>
                      <button type="button" className="posnav__btn posnav__btn--sm" onClick={includeSelectedFaultTree}>Include</button>
                    </div>
                  )}
                  <HclFaultTreeDirectory
                    ariaLabel="Included HCL fault trees"
                    heading="Included"
                    items={configuration.faultTrees.map((reference) => {
                      const tree = faultTreeOptions.find((option) =>
                        option.workbookId === reference.workbookId && option.modelId === reference.modelId,
                      );
                      const code = tree?.modelCode ?? reference.modelId;
                      return {
                        id: `${reference.workbookId}:${reference.modelId}`,
                        code,
                        title: tree === undefined ? code : `${code} · ${tree.modelName}`,
                      };
                    })}
                    emptyText="No fault trees included."
                  />
                </div>
              </details>

              <details className="hcleditor__configuration-group">
                <summary>Bindings <span>{String(configuration.bindings.length)}</span></summary>
                <div role="tabpanel" aria-label="HCL binding manager">
                  {editable && (
                    <div className="bneditor__binding-form hcleditor__binding-form">
                      <label>
                        <span>Fault tree</span>
                        <select aria-label="Fault tree for binding" value={faultTreeKey} onChange={(event) => setFaultTreeKey(event.target.value)}>
                          {faultTreeOptions.length === 0 && <option value="">No Systems Analysis fault tree available</option>}
                          {faultTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Basic event</span>
                        <select aria-label="Basic event for binding" value={basicEventId} onChange={(event) => setBasicEventId(event.target.value)}>
                          {(selectedTree?.basicEvents ?? []).map((event) => <option key={event.id} value={event.id}>{event.code}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>BN node</span>
                        <select aria-label="BN node for binding" value={nodeId} onChange={(event) => { setNodeId(event.target.value); setTrueStateIds([]); }}>
                          {model.nodes.map((node) => <option key={node.id} value={node.id}>{node.code}</option>)}
                        </select>
                      </label>
                      <fieldset>
                        <legend>True states</legend>
                        {selectedNode?.states.map((state) => (
                          <label key={state.id} className="bneditor__check">
                            <input type="checkbox" checked={trueStateIds.includes(state.id)} onChange={(event) => setTrueStateIds((current) => event.target.checked ? [...current, state.id] : current.filter((id) => id !== state.id))} />
                            {state.code}
                          </label>
                        ))}
                      </fieldset>
                      <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary hcleditor__add-binding" onClick={addBinding}>Add binding</button>
                    </div>
                  )}
                  <div className="hcleditor__binding-directory">
                    <div className="hcleditor__binding-list-head">
                      <strong>Bindings</strong>
                      <span>{configuration.bindings.length} {configuration.bindings.length === 1 ? "mapping" : "mappings"}</span>
                    </div>
                    <div className="bneditor__binding-list hcleditor__binding-list">
                      {configuration.bindings.map((binding) => {
                        const tree = faultTreeOptions.find((option) => option.workbookId === binding.faultTreeBasicEvent.workbookId && option.basicEvents.some((event) => event.id === binding.faultTreeBasicEvent.entityId));
                        const basicEvent = tree?.basicEvents.find((event) => event.id === binding.faultTreeBasicEvent.entityId);
                        const node = model.nodes.find((candidate) => candidate.id === binding.bayesianNetworkNode.entityId);
                        const states = node?.states.filter((state) => binding.trueStateIds.includes(state.id)) ?? [];
                        const invalid = node === undefined || states.length === 0 || states.length === node.states.length;
                        return (
                          <div key={binding.id} className={`bneditor__binding${invalid ? " is-invalid" : ""}`}>
                            <span className="hcleditor__binding-endpoint">
                              <small>FT / basic event</small>
                              <strong>{tree?.modelCode ?? "Missing FT"} / {basicEvent?.code ?? "Missing basic event"}</strong>
                            </span>
                            <span className="hcleditor__binding-arrow" aria-hidden="true">→</span>
                            <span className="hcleditor__binding-endpoint">
                              <small>BN condition</small>
                              <strong>{node?.code ?? "Missing BN node"} = {states.map((state) => state.code).join(" | ") || "No valid state"}</strong>
                            </span>
                            {editable && <button type="button" className="hcleditor__binding-delete" aria-label={`Delete binding ${basicEvent?.code ?? binding.id}`} onClick={() => replaceConfiguration({ ...configuration, bindings: configuration.bindings.filter((candidate) => candidate.id !== binding.id) })}>Delete</button>}
                          </div>
                        );
                      })}
                      {configuration.bindings.length === 0 && <p className="bneditor__empty">No fault-tree events are bound yet.</p>}
                    </div>
                  </div>
                </div>
              </details>
                </>
              )}

              {workflow === "BATCH" && (
              <details className="hcleditor__configuration-group" open>
                <summary>Evidence scenarios <span>{String(configuration.evidenceScenarios?.length ?? 0)}</span></summary>
                <HclEvidenceScenarioEditor
                    model={model}
                    configuration={configuration}
                    editable={editable}
                    showHazardConvolution={batchMode === "HAZARD_GRID"}
                    onChange={replaceConfiguration}
                    onError={setError}
                  />
              </details>
              )}

              {calculationType === "UNCERTAINTY" && (
              <details
                key={`uncertainty:${calculationType}:${workflow}`}
                className="hcleditor__configuration-group"
                open
              >
                <summary>Uncertainty <span>{configuration.solverSettings.uncertainty === undefined ? "Off" : "On"}</span></summary>
                <div className="hcleditor__uncertainty" role="tabpanel" aria-label="HCL uncertainty settings">
                  {configuration.solverSettings.uncertainty === undefined ? (
                    <div className="hcleditor__uncertainty-empty">
                      <span>Propagate uncertain basic-event probabilities and BN parameters through PRAXIS.</span>
                      {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={enableUncertainty}>Enable uncertainty</button>}
                    </div>
                  ) : (
                    <>
                      <section className="hcleditor__uncertainty-section hcleditor__uncertainty-section--sampling">
                        <div className="hcleditor__uncertainty-section-head">
                          <div><strong>Monte Carlo</strong><span>PRAXIS sampling settings</span></div>
                        </div>
                        <div className="hcleditor__uncertainty-controls">
                          <label>
                            <span>Samples</span>
                            <input
                              key={`samples:${String(configuration.solverSettings.uncertainty.sampleCount)}`}
                              type="number"
                              min="10"
                              max="10000"
                              step="10"
                              defaultValue={configuration.solverSettings.uncertainty.sampleCount}
                              disabled={!editable}
                              onBlur={(event) => {
                                const value = Number(event.target.value);
                                if (Number.isInteger(value) && value >= 10 && value <= 10_000) replaceUncertainty({ ...configuration.solverSettings.uncertainty!, sampleCount: value });
                                else setError("Uncertainty samples must be a whole number from 10 to 10,000.");
                              }}
                            />
                          </label>
                          <label>
                            <span>Seed</span>
                            <input
                              key={`seed:${String(configuration.solverSettings.uncertainty.seed)}`}
                              type="number"
                              min="0"
                              max="4294967295"
                              step="1"
                              defaultValue={configuration.solverSettings.uncertainty.seed}
                              disabled={!editable}
                              onBlur={(event) => {
                                const value = Number(event.target.value);
                                if (Number.isInteger(value) && value >= 0 && value <= 4_294_967_295) replaceUncertainty({ ...configuration.solverSettings.uncertainty!, seed: value });
                                else setError("Uncertainty seed must be a nonnegative whole number.");
                              }}
                            />
                          </label>
                          {editable && <button type="button" className="posnav__btn posnav__btn--sm hcleditor__uncertainty-disable" onClick={() => replaceUncertainty(undefined)}>Disable</button>}
                        </div>
                      </section>

                      <section className="hcleditor__uncertainty-section">
                        <div className="hcleditor__uncertainty-section-head">
                          <strong>Basic events</strong>
                        </div>
                        {editable && (
                          <div className="hcleditor__uncertainty-add hcleditor__uncertainty-add--event">
                            <label><span>Basic event</span><select aria-label="Uncertain basic event" value={uncertainBasicEventKey || basicEventUncertaintyOptions[0]?.key || ""} onChange={(event) => setUncertainBasicEventKey(event.target.value)}>{basicEventUncertaintyOptions.map(({ key, tree, event }) => <option key={key} value={key}>{tree.modelCode} / {event.code}</option>)}</select></label>
                            <label><span>Distribution</span><select aria-label="Basic-event uncertainty distribution" value={uncertainBasicEventFamily} onChange={(event) => setUncertainBasicEventFamily(event.target.value as HclBasicEventProbabilityDistribution["family"])}><option value="BETA">Beta</option><option value="LOGNORMAL">Lognormal</option><option value="UNIFORM">Uniform</option></select></label>
                            <button type="button" className="posnav__btn posnav__btn--sm" onClick={addBasicEventUncertainty}>Add</button>
                          </div>
                        )}
                        {configuration.solverSettings.uncertainty.basicEventDistributions.length > 0 && (
                          <details className="hcleditor__uncertainty-collection">
                            <summary>Configured basic events <span>{String(configuration.solverSettings.uncertainty.basicEventDistributions.length)}</span></summary>
                            <div className="hcleditor__uncertainty-list">
                            {configuration.solverSettings.uncertainty.basicEventDistributions.map((definition, index) => {
                            const tree = faultTreeOptions.find((candidate) => candidate.workbookId === definition.faultTreeBasicEvent.workbookId && candidate.basicEvents.some((event) => event.id === definition.faultTreeBasicEvent.entityId));
                            const basicEvent = tree?.basicEvents.find((candidate) => candidate.id === definition.faultTreeBasicEvent.entityId);
                            const distribution = definition.distribution;
                            return (
                              <details key={`${definition.faultTreeBasicEvent.workbookId}:${definition.faultTreeBasicEvent.entityId}`} className="hcleditor__uncertainty-item">
                                <summary>
                                  <span className="hcleditor__uncertainty-item-name">
                                    <small>FT / basic event</small>
                                    <strong>{tree?.modelCode ?? "Fault tree"} / {basicEvent?.code ?? definition.faultTreeBasicEvent.entityId}</strong>
                                  </span>
                                  <span className="hcleditor__uncertainty-family">{probabilityDistributionLabel(distribution)}</span>
                                  <span className="hcleditor__uncertainty-expand">Settings</span>
                                </summary>
                                <div className="hcleditor__uncertainty-item-settings">
                                  <div className="hcleditor__uncertainty-parameters">
                                    <label>
                                      <span>Distribution</span>
                                      <select aria-label={`Distribution for ${basicEvent?.code ?? definition.faultTreeBasicEvent.entityId}`} value={distribution.family} disabled={!editable} onChange={(event) => updateBasicEventDistribution(index, createBasicEventDistribution(event.target.value as HclBasicEventProbabilityDistribution["family"]))}>
                                        <option value="BETA">Beta</option>
                                        <option value="LOGNORMAL">Lognormal</option>
                                        <option value="UNIFORM">Uniform</option>
                                      </select>
                                    </label>
                                    {distribution.family === "BETA" && <><label><span>Alpha</span><input type="number" min="0.000001" step="any" defaultValue={distribution.alpha} disabled={!editable} onBlur={(event) => { const value = Number(event.target.value); if (value > 0) updateBasicEventDistribution(index, { ...distribution, alpha: value }); }} /></label><label><span>Beta</span><input type="number" min="0.000001" step="any" defaultValue={distribution.beta} disabled={!editable} onBlur={(event) => { const value = Number(event.target.value); if (value > 0) updateBasicEventDistribution(index, { ...distribution, beta: value }); }} /></label></>}
                                    {distribution.family === "LOGNORMAL" && <><label><span>Median</span><input type="number" min="0.000001" max="1" step="any" defaultValue={distribution.median} disabled={!editable} onBlur={(event) => { const value = Number(event.target.value); if (value > 0 && value <= 1) updateBasicEventDistribution(index, { ...distribution, median: value }); }} /></label><label><span>Error factor</span><input type="number" min="1.000001" step="any" defaultValue={distribution.errorFactor} disabled={!editable} onBlur={(event) => { const value = Number(event.target.value); if (value > 1) updateBasicEventDistribution(index, { ...distribution, errorFactor: value }); }} /></label></>}
                                    {distribution.family === "UNIFORM" && <><label><span>Lower</span><input type="number" min="0" max="1" step="any" defaultValue={distribution.lower} disabled={!editable} onBlur={(event) => { const value = Number(event.target.value); if (value >= 0 && value < distribution.upper) updateBasicEventDistribution(index, { ...distribution, lower: value }); }} /></label><label><span>Upper</span><input type="number" min="0" max="1" step="any" defaultValue={distribution.upper} disabled={!editable} onBlur={(event) => { const value = Number(event.target.value); if (value > distribution.lower && value <= 1) updateBasicEventDistribution(index, { ...distribution, upper: value }); }} /></label></>}
                                  </div>
                                  {editable && <button type="button" className="hcleditor__uncertainty-delete" onClick={() => replaceUncertainty({ ...configuration.solverSettings.uncertainty!, basicEventDistributions: configuration.solverSettings.uncertainty!.basicEventDistributions.filter((_, candidateIndex) => candidateIndex !== index) })}>Delete</button>}
                                </div>
                              </details>
                            );
                          })}
                            </div>
                          </details>
                        )}
                      </section>

                      <section className="hcleditor__uncertainty-section">
                        <div className="hcleditor__uncertainty-section-head">
                          <strong>BN parameters</strong>
                        </div>
                        {editable && (
                          <div className="hcleditor__uncertainty-add">
                            <label><span>CPT row</span><select aria-label="Uncertain CPT row" value={uncertainCptRowKey || cptRowUncertaintyOptions[0]?.key || ""} onChange={(event) => setUncertainCptRowKey(event.target.value)}>{cptRowUncertaintyOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
                            <button type="button" className="posnav__btn posnav__btn--sm" onClick={addCptRowUncertainty}>Add</button>
                          </div>
                        )}
                        {configuration.solverSettings.uncertainty.cptRowDistributions.length > 0 && (
                          <details className="hcleditor__uncertainty-collection">
                            <summary>Configured CPT rows <span>{String(configuration.solverSettings.uncertainty.cptRowDistributions.length)}</span></summary>
                            <div className="hcleditor__uncertainty-list">
                            {configuration.solverSettings.uncertainty.cptRowDistributions.map((definition, index) => {
                            const option = cptRowUncertaintyOptions.find((candidate) => candidate.nodeId === definition.bayesianNetworkNode.entityId && candidate.rowId === definition.cptRowId);
                            return (
                              <details key={`${definition.bayesianNetworkNode.entityId}:${definition.cptRowId}`} className="hcleditor__uncertainty-item">
                                <summary>
                                  <span className="hcleditor__uncertainty-item-name">
                                    <small>BN / CPT row</small>
                                    <strong>{option?.label ?? definition.cptRowId}</strong>
                                  </span>
                                  <span className="hcleditor__uncertainty-family">Dirichlet</span>
                                  <span className="hcleditor__uncertainty-expand">Settings</span>
                                </summary>
                                <div className="hcleditor__uncertainty-item-settings">
                                  <div className="hcleditor__uncertainty-parameters"><label><span>Equivalent sample size</span><input type="number" min="0.000001" max="1000000" step="any" defaultValue={definition.equivalentSampleSize} disabled={!editable} onBlur={(event) => { const value = Number(event.target.value); if (value > 0 && value <= 1_000_000) replaceUncertainty({ ...configuration.solverSettings.uncertainty!, cptRowDistributions: configuration.solverSettings.uncertainty!.cptRowDistributions.map((row, rowIndex) => rowIndex === index ? { ...row, equivalentSampleSize: value } : row) }); }} /></label></div>
                                  {editable && <button type="button" className="hcleditor__uncertainty-delete" onClick={() => replaceUncertainty({ ...configuration.solverSettings.uncertainty!, cptRowDistributions: configuration.solverSettings.uncertainty!.cptRowDistributions.filter((_, candidateIndex) => candidateIndex !== index) })}>Delete</button>}
                                </div>
                              </details>
                            );
                          })}
                            </div>
                          </details>
                        )}
                      </section>
                    </>
                  )}
                </div>
              </details>
              )}
              </div>
            </div>
          )}

          {advancedOpen && scope !== "EVENT_TREE" && (
            <div className="hcleditor__advanced-panel" aria-label="Advanced HCL settings">
              <div className="hcleditor__manage-head">
                <strong>Advanced</strong>
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Close advanced HCL settings" onClick={() => setAdvancedOpen(false)}>Close</button>
              </div>
              <div className="hcleditor__advanced">
                <div className="hcleditor__identity">
                  <label><span>Code</span><input value={configuration.code} disabled={!editable} onChange={(event) => replaceConfiguration({ ...configuration, code: event.target.value })} /></label>
                  <label><span>Name</span><input value={configuration.name} disabled={!editable} onChange={(event) => replaceConfiguration({ ...configuration, name: event.target.value })} /></label>
                </div>
                <div className="hcleditor__solver-settings">
                  <label><input type="checkbox" checked={configuration.solverSettings.foldConstants} disabled={!editable} onChange={(event) => replaceConfiguration({ ...configuration, solverSettings: { ...configuration.solverSettings, foldConstants: event.target.checked } })} />Fold constants</label>
                  <label><input type="checkbox" checked={configuration.solverSettings.spliceNullGates} disabled={!editable} onChange={(event) => replaceConfiguration({ ...configuration, solverSettings: { ...configuration.solverSettings, spliceNullGates: event.target.checked } })} />Splice null gates</label>
                </div>
                {editable && <button type="button" className="posnav__btn posnav__btn--sm hcleditor__aligned-action" onClick={deleteConfiguration}><HclIcon name="trash" />Delete configuration</button>}
              </div>
            </div>
          )}

          {runError !== null && <p className="bneditor__error" role="alert">{runError}</p>}
          {workflow === "MANUAL" && runResult?.kind === "FAULT_TREE" && (
            <div className="hcleditor__analysis-result" aria-label="HCL fault-tree result">
              {calculationType === "PROBABILITY" && (
                <div className="hcleditor__result-grid hcleditor__result-grid--single">
                  <HclResultMetric
                    label="Top event probability"
                    value={formatScientific(runResult.result.probability)}
                    ratio={runResult.result.probability}
                  />
                </div>
              )}
              {calculationType === "UNCERTAINTY" && <HclUncertaintyResults summary={runResult.result.uncertainty} />}
              {calculationType === "CUT_SETS" && (
                <HclCutSetResults
                  analysis={runResult.result.cutSets}
                  model={model}
                  faultTreeOptions={faultTreeOptions}
                />
              )}
              {calculationType === "IMPORTANCE" && (
                <HclImportanceResults
                  analysis={runResult.result.importance}
                  model={model}
                  faultTreeOptions={faultTreeOptions}
                />
              )}
            </div>
          )}
          {workflow === "MANUAL" && runResult?.kind === "EVENT_TREE" && (
            <div className="hcleditor__batch-result" aria-label="HCL event-tree result">
              <div className="hcleditor__batch-heading">
                <strong>Sequence results</strong>
                <span>{String(runResult.result.sequences.length)} sequences calculated</span>
              </div>
              <div className="hcleditor__batch-table">
                {runResult.result.sequences.map((sequence) => {
                  const target = eventTreeOptions.flatMap((option) => option.sequences).find(({ id }) => id === sequence.sequenceId);
                  return (
                    <div key={sequence.sequenceId} className="hcleditor__sequence-analysis">
                      {calculationType === "PROBABILITY" && (
                        <HclResultMetric
                          label={target?.name ?? sequence.sequenceId}
                          value={`${formatScientific(sequence.annualFrequency)}/yr`}
                          ratio={sequence.conditionalProbability}
                          detail={`Conditional probability ${formatScientific(sequence.conditionalProbability)}`}
                        />
                      )}
                      {calculationType === "UNCERTAINTY" && <HclUncertaintyResults summary={sequence.uncertainty?.annualFrequency} annual label={target?.name ?? sequence.sequenceId} />}
                      {calculationType === "CUT_SETS" && (
                        <HclCutSetResults
                          analysis={sequence.cutSets}
                          model={model}
                          faultTreeOptions={faultTreeOptions}
                          label="Sequence cut sets"
                        />
                      )}
                      {calculationType === "IMPORTANCE" && (
                        <HclImportanceResults
                          analysis={sequence.importance}
                          model={model}
                          faultTreeOptions={faultTreeOptions}
                          label="Sequence importance"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {workflow === "BATCH" && batchRunResult !== null && (
            <div className="hcleditor__batch-result" aria-label="HCL scenario batch result">
              <div className="hcleditor__batch-heading">
                <strong>{batchRunResult.hazardConvolution === undefined ? "Scenario results" : "Hazard convolution"}</strong>
                <span>{String(batchRunResult.scenarios.filter((scenario) => scenario.status === "SUCCEEDED").length)} of {String(batchRunResult.scenarios.length)} completed{batchNumericallyUnchanged ? " · No variation across scenarios" : ""}</span>
              </div>
              {calculationType === "PROBABILITY" && batchRunResult.hazardConvolution !== undefined && (
                <><div className="hcleditor__convolution-summary" aria-label="Hazard convolution summary">
                  <HclResultMetric
                    label="Grid"
                    value={batchRunResult.hazardConvolution.gridName}
                  />
                  <HclResultMetric
                    label="Covered probability"
                    value={formatPercentage(batchRunResult.hazardConvolution.rawWeightSum)}
                    ratio={batchRunResult.hazardConvolution.rawWeightSum}
                  />
                  <HclResultMetric
                    label="Annual scale"
                    value={`${formatScientific(batchRunResult.hazardConvolution.annualizedFrequencyScale)}/yr`}
                  />
                  {batchRunResult.hazardConvolution.targetKind === "FAULT_TREE" ? (
                    <HclResultMetric
                      label="Integrated frequency"
                      value={`${formatScientific(batchRunResult.hazardConvolution.integratedAnnualFrequency)}/yr`}
                    />
                  ) : (
                    <HclResultMetric
                      label="Integrated frequency"
                      value={`${formatScientific(batchRunResult.hazardConvolution.endStateAggregates.reduce((sum, endState) => sum + endState.integratedAnnualFrequency, 0))}/yr`}
                    />
                  )}
                </div></>
              )}
              {calculationType === "UNCERTAINTY" && batchRunResult.hazardConvolution?.targetKind === "FAULT_TREE" && (
                <HclUncertaintyResults summary={batchRunResult.hazardConvolution.uncertainty} annual label="Hazard convolution" />
              )}
              <div className="hcleditor__batch-table">
                {batchRunResult.scenarios.map((scenario) => {
                  let value = scenario.failure ?? scenario.status;
                  let ratio: number | undefined;
                  let detail = scenario.scenarioName;
                  if (scenario.result?.kind === "FAULT_TREE") {
                    value = formatScientific(scenario.result.result.probability);
                    ratio = scenario.result.result.probability;
                  }
                  if (scenario.result?.kind === "EVENT_TREE") {
                    const frequency = scenario.result.result.sequences.reduce((sum, sequence) => sum + sequence.annualFrequency, 0);
                    value = `${formatScientific(frequency)}/yr`;
                    detail = `${scenario.scenarioName} · ${String(scenario.result.result.sequences.length)} sequences`;
                  }
                  const convolution = batchRunResult.hazardConvolution;
                  if (convolution?.targetKind === "FAULT_TREE") {
                    const row = convolution.rows.find((candidate) => candidate.scenarioId === scenario.scenarioId);
                    if (row !== undefined) {
                      value = `${formatScientific(row.annualContribution)}/yr`;
                      ratio = row.convolutionWeight;
                      detail = `${scenario.scenarioName} · ${formatPercentage(row.convolutionWeight)} weight`;
                    }
                  } else if (convolution?.targetKind === "EVENT_TREE") {
                    const row = convolution.rows.find((candidate) => candidate.scenarioId === scenario.scenarioId);
                    if (row !== undefined) {
                      const contribution = row.sequences.reduce((sum, sequence) => sum + sequence.annualContribution, 0);
                      value = `${formatScientific(contribution)}/yr`;
                      ratio = row.convolutionWeight;
                      detail = `${scenario.scenarioName} · ${formatPercentage(row.convolutionWeight)} weight`;
                    }
                  }
                  if (calculationType === "PROBABILITY") {
                    return (
                      <div key={scenario.scenarioId} className="hcleditor__scenario-analysis">
                        <HclResultMetric
                          label={scenario.scenarioCode}
                          value={value}
                          ratio={ratio}
                          detail={detail}
                        />
                      </div>
                    );
                  }
                  let scenarioSummary = scenario.failure === null && scenario.status === "SUCCEEDED" ? "Complete" : "Failed";
                  if (scenario.result?.kind === "FAULT_TREE" && calculationType === "CUT_SETS") {
                    const count = scenario.result.result.cutSets?.totalCount ?? 0;
                    scenarioSummary = `${String(count)} cut ${count === 1 ? "set" : "sets"}`;
                  } else if (scenario.result?.kind === "FAULT_TREE" && calculationType === "IMPORTANCE") {
                    const count = scenario.result.result.importance?.totalCount ?? 0;
                    scenarioSummary = `${String(count)} ${count === 1 ? "measure" : "measures"}`;
                  } else if (scenario.result?.kind === "FAULT_TREE" && calculationType === "UNCERTAINTY") {
                    const uncertainty = scenario.result.result.uncertainty;
                    scenarioSummary = uncertainty === undefined ? "No uncertainty result" : `Mean ${formatScientific(uncertainty.mean)}`;
                  } else if (scenario.result?.kind === "EVENT_TREE") {
                    scenarioSummary = `${String(scenario.result.result.sequences.length)} ${scenario.result.result.sequences.length === 1 ? "sequence" : "sequences"}`;
                  }
                  return (
                    <details key={scenario.scenarioId} className="hcleditor__scenario-result">
                      <summary>
                        <span className="hcleditor__scenario-result-identity">
                          <strong>{scenario.scenarioCode}</strong>
                          <small>{scenario.scenarioName}</small>
                        </span>
                        <output>{scenarioSummary}</output>
                      </summary>
                      <div className="hcleditor__scenario-result-body">
                      {scenario.failure !== null && <p className="bneditor__error">{scenario.failure}</p>}
                      {calculationType === "UNCERTAINTY" && scenario.result?.kind === "FAULT_TREE" && (
                        <HclUncertaintyResults summary={scenario.result.result.uncertainty} label="Statistics" inline />
                      )}
                      {calculationType === "UNCERTAINTY" && scenario.result?.kind === "EVENT_TREE" && scenario.result.result.sequences.map((sequence) => {
                        const target = eventTreeOptions.flatMap((option) => option.sequences).find(({ id }) => id === sequence.sequenceId);
                        return <HclUncertaintyResults key={sequence.sequenceId} summary={sequence.uncertainty?.annualFrequency} annual label={target?.name ?? sequence.sequenceId} inline />;
                      })}
                      {calculationType === "CUT_SETS" && scenario.result?.kind === "FAULT_TREE" && (
                        <HclCutSetResults
                          analysis={scenario.result.result.cutSets}
                          model={model}
                          faultTreeOptions={faultTreeOptions}
                          label="Cut sets"
                          embedded
                        />
                      )}
                      {calculationType === "IMPORTANCE" && scenario.result?.kind === "FAULT_TREE" && (
                        <HclImportanceResults
                          analysis={scenario.result.result.importance}
                          model={model}
                          faultTreeOptions={faultTreeOptions}
                          label="Importance measures"
                          embedded
                        />
                      )}
                      {calculationType === "CUT_SETS" && scenario.result?.kind === "EVENT_TREE" && scenario.result.result.sequences.map((sequence) => {
                        const target = eventTreeOptions.flatMap((option) => option.sequences).find(({ id }) => id === sequence.sequenceId);
                        return (
                          <HclCutSetResults
                            key={sequence.sequenceId}
                            analysis={sequence.cutSets}
                            model={model}
                            faultTreeOptions={faultTreeOptions}
                            label={`${target?.name ?? sequence.sequenceId} cut sets`}
                            embedded
                          />
                        );
                      })}
                      {calculationType === "IMPORTANCE" && scenario.result?.kind === "EVENT_TREE" && scenario.result.result.sequences.map((sequence) => {
                        const target = eventTreeOptions.flatMap((option) => option.sequences).find(({ id }) => id === sequence.sequenceId);
                        return (
                          <HclImportanceResults
                            key={`importance:${sequence.sequenceId}`}
                            analysis={sequence.importance}
                            model={model}
                            faultTreeOptions={faultTreeOptions}
                            label={`${target?.name ?? sequence.sequenceId} importance`}
                            embedded
                          />
                        );
                      })}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {error !== null && <p className="bneditor__error" role="alert">{error}</p>}
      {validation.map((issue, index) => <p key={`${issue.code}-${String(index)}`} className={issue.severity === "ERROR" ? "bneditor__error" : "bneditor__warning"}>{issue.message}</p>)}
      {confirmationDialog}
    </section>
  );
}

export { HclBindingEditor };
export type { HclEventTreeOption, HclFaultTreeOption };
