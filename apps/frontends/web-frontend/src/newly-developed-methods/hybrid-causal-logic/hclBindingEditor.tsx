import { type JSX, useEffect, useMemo, useState } from "react";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import {
  hclTargetKey,
  resolveHclBatchTargetRelevance,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { useEditorConfirmation } from "../shared";
import type {
  HclBindingEditorProps,
  HclEditorBatchRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
} from "./hclBindingTypes";
import { HclEvidenceScenarioEditor } from "./hclEvidenceScenarioEditor";
import "./css/hclBindingEditor.css";

function uniqueCode(prefix: string, codes: readonly string[]): string {
  const normalized = new Set(codes.map((code) => code.trim().toUpperCase()));
  let suffix = normalized.size + 1;
  while (normalized.has(`${prefix}-${String(suffix)}`)) suffix += 1;
  return `${prefix}-${String(suffix)}`;
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
  const [evidenceMode, setEvidenceMode] = useState<"BASE" | "SCENARIOS" | "HAZARD_GRID">("BASE");
  const [runFaultTreeKey, setRunFaultTreeKey] = useState("");
  const [eventTreeKey, setEventTreeKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<"TREES" | "BINDINGS" | "SCENARIOS" | "ADVANCED">("BINDINGS");
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
    () => (configuration?.evidenceScenarios ?? []).filter((scenario) => scenario.enabled),
    [configuration?.evidenceScenarios],
  );
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
  const runFaultTreeOptions = evidenceMode !== "BASE"
    ? executableFaultTrees.filter((option) => batchFaultTreeKeys.has(hclTargetKey(option)))
    : executableFaultTrees;
  const runEventTreeOptions = evidenceMode !== "BASE"
    ? executableEventTrees.filter((option) => batchEventTreeKeys.has(hclTargetKey(option)))
    : executableEventTrees;
  const batchNumericallyUnchanged = batchRunResult !== null
    && batchHasNoNumericVariation(batchRunResult);
  const selectedEventTree = runEventTreeOptions.find(
    (option) => `${option.workbookId}:${option.modelId}` === eventTreeKey,
  );

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

  function run(): void {
    if (configuration === undefined) return;
    const scenarioIds = enabledScenarios.map((scenario) => scenario.id);
    const batchMode = evidenceMode !== "BASE";
    if (batchMode && scenarioIds.length === 0) {
      setError("Enable at least one evidence scenario before running the batch.");
      return;
    }
    if (evidenceMode === "HAZARD_GRID" && configuration.hazardGrid === undefined) {
      setError("Configure a hazard grid before running the convolution.");
      return;
    }
    if (targetKind === "FAULT_TREE") {
      const tree = runFaultTreeOptions.find((option) => `${option.workbookId}:${option.modelId}` === runFaultTreeKey);
      if (tree === undefined) {
        setError(batchMode
          ? "No configured fault-tree target is affected by evidence that varies across the enabled scenarios."
          : "Choose a linked fault tree with a top event.");
        return;
      }
      if (batchMode) onRunFaultTreeBatch(configuration, tree, scenarioIds, evidenceMode === "HAZARD_GRID");
      else onRunFaultTree(configuration, tree);
      return;
    }
    if (selectedEventTree === undefined) {
      setError(batchMode
        ? "No linked event-tree target is affected by evidence that varies across the enabled scenarios."
        : "Choose an event tree.");
      return;
    }
    if (batchMode) onRunEventTreeBatch(configuration, selectedEventTree, scenarioIds, evidenceMode === "HAZARD_GRID");
    else onRunEventTree(configuration, selectedEventTree);
  }

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
          <div className="hcleditor__composer" aria-label="HCL quantification controls">
            <div className="hcleditor__run-fields">
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
                    {runFaultTreeOptions.length === 0 && <option value="">{evidenceMode !== "BASE" ? "No affected fault tree" : "No linked fault tree"}</option>}
                    {runFaultTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode} · {option.modelName}</option>)}
                  </select>
                </label>
              ) : (
                <label className="hcleditor__run-field hcleditor__run-field--target">
                  <span>Event tree</span>
                  <select aria-label="HCL event-tree target" value={eventTreeKey} onChange={(event) => setEventTreeKey(event.target.value)}>
                    {runEventTreeOptions.length === 0 && <option value="">{evidenceMode !== "BASE" ? "No affected event tree" : "No linked event tree"}</option>}
                    {runEventTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode}</option>)}
                  </select>
                </label>
              )}
              <label className="hcleditor__run-field hcleditor__run-field--evidence">
                <span>Evidence</span>
                <select aria-label="HCL evidence mode" value={evidenceMode} onChange={(event) => setEvidenceMode(event.target.value as "BASE" | "SCENARIOS" | "HAZARD_GRID")}>
                  <option value="BASE">Common evidence</option>
                  <option value="SCENARIOS">Enabled scenarios ({String((configuration.evidenceScenarios ?? []).filter((scenario) => scenario.enabled).length)})</option>
                  {configuration.hazardGrid !== undefined && <option value="HAZARD_GRID">Hazard-grid convolution</option>}
                </select>
              </label>
            </div>
            <div className="hcleditor__run-actions">
              {onEditEvidence !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm bneditor__evidence-trigger" aria-label="Edit evidence" aria-expanded={evidenceEditorOpen} onClick={onEditEvidence}>
                  <HclIcon name="evidence" />
                  <span>Evidence</span>
                  {baseEvidence.observations.length > 0 && <b>{String(baseEvidence.observations.length)}</b>}
                </button>
              )}
              {scope !== "EVENT_TREE" && (
                <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={manageOpen} onClick={() => setManageOpen(true)}>
                  <HclIcon name="configuration" />
                  <span>Manage</span>
                </button>
              )}
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || hasBlockingIssue || (targetKind === "FAULT_TREE" ? runFaultTreeOptions.length === 0 : runEventTreeOptions.length === 0)} onClick={run}>
                <HclIcon name="run" />
                <span>{running ? "Running…" : evidenceMode === "HAZARD_GRID" ? "Run hazard convolution" : evidenceMode === "SCENARIOS" ? "Run scenario batch" : "Run HCL quantification"}</span>
              </button>
            </div>
          </div>

          {targetKind === "EVENT_TREE" && selectedEventTree !== undefined && (
            <HclFaultTreeDirectory
              ariaLabel="Automatically linked fault trees"
              heading="Linked fault trees"
              className="hcleditor__linked-tree-directory"
              items={(selectedEventTree.linkedFaultTrees ?? []).map((tree) => ({
                id: `${tree.workbookId}:${tree.modelId}`,
                code: tree.modelCode,
                title: `${tree.modelCode} · ${tree.modelName} · ${tree.functionalEvents.map((event) => event.code).join(", ")}`,
              }))}
              emptyText="No functional-event fault-tree links were found."
            />
          )}

          {manageOpen && (
            <div className="hcleditor__manage" aria-label="HCL configuration manager">
              <div className="hcleditor__manage-head">
                <div className="hcleditor__manage-tabs" role="tablist" aria-label="HCL configuration sections">
                  <button type="button" role="tab" aria-selected={manageTab === "TREES"} className={manageTab === "TREES" ? "is-active" : ""} onClick={() => setManageTab("TREES")}>Fault trees</button>
                  <button type="button" role="tab" aria-selected={manageTab === "BINDINGS"} className={manageTab === "BINDINGS" ? "is-active" : ""} onClick={() => setManageTab("BINDINGS")}>Bindings</button>
                  <button type="button" role="tab" aria-selected={manageTab === "SCENARIOS"} className={manageTab === "SCENARIOS" ? "is-active" : ""} onClick={() => setManageTab("SCENARIOS")}>Evidence scenarios</button>
                  <button type="button" role="tab" aria-selected={manageTab === "ADVANCED"} className={manageTab === "ADVANCED" ? "is-active" : ""} onClick={() => setManageTab("ADVANCED")}>Advanced</button>
                </div>
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Close HCL manager" onClick={() => setManageOpen(false)}>Close</button>
              </div>

              {manageTab === "TREES" && (
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
              )}

              {manageTab === "BINDINGS" && (
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
              )}

              {manageTab === "SCENARIOS" && (
                <HclEvidenceScenarioEditor
                  model={model}
                  configuration={configuration}
                  editable={editable}
                  onChange={replaceConfiguration}
                  onError={setError}
                />
              )}

              {manageTab === "ADVANCED" && (
                <div className="hcleditor__advanced" role="tabpanel" aria-label="Advanced HCL settings">
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
              )}
            </div>
          )}

          {runError !== null && <p className="bneditor__error" role="alert">{runError}</p>}
          {runResult?.kind === "FAULT_TREE" && (
            <div className="hcleditor__result-grid hcleditor__result-grid--single" aria-label="HCL fault-tree result">
              <HclResultMetric
                label="Top event probability"
                value={formatScientific(runResult.result.probability)}
                ratio={runResult.result.probability}
              />
            </div>
          )}
          {runResult?.kind === "EVENT_TREE" && (
            <div className="hcleditor__batch-result" aria-label="HCL event-tree result">
              <div className="hcleditor__batch-heading">
                <strong>Sequence results</strong>
                <span>{String(runResult.result.sequences.length)} sequences calculated</span>
              </div>
              <div className="hcleditor__batch-table">
                {runResult.result.sequences.map((sequence) => {
                  const target = eventTreeOptions.flatMap((option) => option.sequences).find(({ id }) => id === sequence.sequenceId);
                  return (
                    <HclResultMetric
                      key={sequence.sequenceId}
                      label={target?.name ?? sequence.sequenceId}
                      value={`${formatScientific(sequence.annualFrequency)}/yr`}
                      ratio={sequence.conditionalProbability}
                      detail={`Conditional probability ${formatScientific(sequence.conditionalProbability)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {batchRunResult !== null && (
            <div className="hcleditor__batch-result" aria-label="HCL scenario batch result">
              <div className="hcleditor__batch-heading">
                <strong>{batchRunResult.hazardConvolution === undefined ? "Scenario results" : "Hazard convolution"}</strong>
                <span>{String(batchRunResult.scenarios.filter((scenario) => scenario.status === "SUCCEEDED").length)} of {String(batchRunResult.scenarios.length)} completed{batchNumericallyUnchanged ? " · No variation across scenarios" : ""}</span>
              </div>
              {batchRunResult.hazardConvolution !== undefined && (
                <div className="hcleditor__convolution-summary" aria-label="Hazard convolution summary">
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
                </div>
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
                  return (
                    <HclResultMetric
                      key={scenario.scenarioId}
                      label={scenario.scenarioCode}
                      value={value}
                      ratio={ratio}
                      detail={detail}
                    />
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
