import { HclUncertaintyReview } from "./hclUncertaintyReview";
import { HclUncertaintySeedSchema, HclUncertaintySettingsSchema, WorkbookHclUncertaintyConfigurationSchema } from "interfaces-mef-types/zod/modeling";
import { HclResults } from "./hclResults";
import { DEFAULT_ANNUALIZATION_CONVENTION } from "interfaces-mef-types/modeling";
import { HclHazardSweepControls } from "./hclHazardSweepControls";
import type { HclBatchInput } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { HclSeismicGeneratorControls } from "./hclSeismicGeneratorControls";
import { createCptPrior, HclCptPriorControls } from "./hclCptPriorControls";
import { normalizeHclUncertaintySampler } from "interfaces-mef-types/modeling";
import { type ChangeEvent, type JSX, useEffect, useMemo, useRef, useState } from "react";
import type {
  HclBasicEventProbabilityDistribution,
  HclEvidenceScenario,
  HclUncertaintySettings,
  WorkbookHclConfiguration,
} from "interfaces-mef-types/modeling";
import { validateBayesianNetworkEvidence, type BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { HCL_HAZARD_CONVOLUTION_POINT_ONLY } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { useEditorConfirmation } from "../shared";
import type {
  HclBindingEditorProps,
  HclEventTreeOption,
  HclFaultTreeOption,
} from "./hclBindingTypes";
import { HclEvidenceScenarioEditor } from "./hclEvidenceScenarioEditor";
import {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
} from "./hclEvidenceScenarioInterchange";
import "./css/hclBindingEditor.css";
import { createBasicEventDistribution, probabilityDistributionLabel, HclDistributionOptions, HclDistributionParameters } from "./hclUncertaintyControls";


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

function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  saveBlockedReason = null,
  onAnalysisInputChange,
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
  onGenerateScenarios,
  onRunEventTreeBatch,
}: HclBindingEditorProps): JSX.Element {
  const configuration = configurations.find(
    (candidate) =>
      candidate.bayesianNetwork.modelId === model.modelId
      && (workbookId === null || candidate.bayesianNetwork.workbookId === workbookId),
  );
  const savedUncertainty = configuration?.solverSettings.uncertainty;
  const parsedUncertainty = useMemo(
    () => calculationType !== "UNCERTAINTY" || savedUncertainty === undefined
      ? undefined : HclUncertaintySettingsSchema.safeParse(savedUncertainty),
    [calculationType, savedUncertainty],
  );
  const uncertainty = parsedUncertainty?.success ? parsedUncertainty.data : undefined;
  const uncertaintyError = useMemo(() => {
    if (calculationType !== "UNCERTAINTY" || configuration === undefined) return null;
    if (savedUncertainty === undefined) return "Configure uncertainty settings before running uncertainty.";
    const parsed = WorkbookHclUncertaintyConfigurationSchema.safeParse(configuration);
    return parsed.success ? null : `Uncertainty settings need review: ${parsed.error.issues[0]?.message ?? "invalid settings"}`;
  }, [calculationType, configuration, savedUncertainty]);
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
  const [batchInput, setBatchInput] = useState<HclBatchInput | null>(null);
  const batchImportEpoch = useRef(0);
  const batchConfiguration = useMemo(() => {
    if (configuration === undefined || batchInput === null) return configuration;
    const { hazardGrid: _savedGrid, ...saved } = configuration;
    return { ...saved, ...batchInput };
  }, [configuration, batchInput]);
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
    const declared = new Set(configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`));
    return eventTreeOptions.filter((option) =>
      scope === "EVENT_TREE"
      || option.faultTrees.every((reference) => declared.has(`${reference.workbookId}:${reference.modelId}`)),
    );
  }, [configuration, eventTreeOptions, scope]);
  const enabledScenarios = useMemo(
    () => (batchConfiguration?.evidenceScenarios ?? []).filter((scenario) => scenario.enabled),
    [batchConfiguration?.evidenceScenarios],
  );
  const invalidScenario = workflow === "BATCH" ? enabledScenarios.find((scenario) =>
    validateBayesianNetworkEvidence(model, scenario.evidence).some((issue) => issue.severity === "ERROR"),
  ) : undefined;
  const hasBlockingIssue = uncertaintyError !== null || quantificationBlocked || saveBlockedReason !== null || invalidScenario !== undefined
    || validation.some((issue) => issue.severity === "ERROR");
  useEffect(() => {
    onAnalysisInputChange?.();
  }, [configuration, batchInput, targetKind, runFaultTreeKey, eventTreeKey, batchMode, workflow, calculationType, onAnalysisInputChange]);
  const batchSamples = useMemo(() => createEvidenceBatchSamples(model), [model.nodes]);
  const effectiveEvidenceMode = workflow === "MANUAL" ? "BASE" : batchMode;
  const selectedEventTree = executableEventTrees.find(
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
    if (executableEventTrees.some((option) => `${option.workbookId}:${option.modelId}` === eventTreeKey)) return;
    const first = executableEventTrees[0];
    setEventTreeKey(first === undefined ? "" : `${first.workbookId}:${first.modelId}`);
  }, [eventTreeKey, executableEventTrees]);
  useEffect(() => {
    if (executableFaultTrees.some((option) => `${option.workbookId}:${option.modelId}` === runFaultTreeKey)) return;
    const first = executableFaultTrees[0];
    setRunFaultTreeKey(first === undefined ? "" : `${first.workbookId}:${first.modelId}`);
  }, [runFaultTreeKey, executableFaultTrees]);
  useEffect(() => {
    setBatchInput(null);
    batchImportEpoch.current += 1;
  }, [configuration?.modelId, model.modelId, workbookId]);
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
    else solverSettings.uncertainty = normalizeHclUncertaintySampler(uncertainty);
    replaceConfiguration({ ...configuration, solverSettings });
  }

  function enableUncertainty(): void {
    replaceUncertainty({
      sampleCount: 1_000,
      seed: 42,
      sampler: "LHS",
      basicEventDistributions: [],
      cptRowDistributions: [],
    });
  }

  function addBasicEventUncertainty(): void {
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
    if (configuration === undefined || uncertainty === undefined) return;
    const selected = cptRowUncertaintyOptions.find((option) => option.key === uncertainCptRowKey)
      ?? cptRowUncertaintyOptions[0];
    if (selected === undefined) {
      setError("No CPT row is available for uncertainty.");
      return;
    }
    if (uncertainty.cptGenerators?.some((g) => g.bayesianNetworkNode.entityId === selected.nodeId)) {
      setError("That node already uses a seismic generator. Delete it before adding row priors.");
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
        prior: createCptPrior(model.nodes.find((node) => node.id === selected.nodeId)?.states ?? []),
      }],
    });
    setError(null);
  }

  function updateBasicEventDistribution(index: number, distribution: HclBasicEventProbabilityDistribution): void {
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
    const epoch = ++batchImportEpoch.current;
    try {
      const source = await file.text();
      if (epoch !== batchImportEpoch.current) return;
      const imported = file.name.toLowerCase().endsWith(".csv")
        ? importHclEvidenceScenariosCsv(source, model)
        : importHclEvidenceScenariosJson(source, model);
      setBatchInput({ evidenceScenarios: imported, hazardGrid: batchConfiguration?.hazardGrid });
      setManageOpen(true);
      setError(null);
    } catch (importError) {
      if (epoch !== batchImportEpoch.current) return;
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
    if (hasBlockingIssue) return;
    if (configuration === undefined) return;
    if (effectiveEvidenceMode === "HAZARD_GRID" && hazardUncertaintyBlocked) {
      setError(HCL_HAZARD_CONVOLUTION_POINT_ONLY);
      return;
    }
    const scenarioIds = enabledScenarios.map((scenario) => scenario.id);
    const isBatchWorkflow = workflow === "BATCH";
    const runConfiguration = isBatchWorkflow ? batchConfiguration! : configuration;
    if (isBatchWorkflow && scenarioIds.length === 0) {
      setError("Enable at least one evidence scenario before running the batch.");
      return;
    }
    if (effectiveEvidenceMode === "HAZARD_GRID" && runConfiguration.hazardGrid === undefined) {
      setError("Configure a hazard grid before running the convolution.");
      return;
    }
    if (targetKind === "FAULT_TREE") {
      const tree = executableFaultTrees.find((option) => `${option.workbookId}:${option.modelId}` === runFaultTreeKey);
      if (tree === undefined) {
        setError("Choose a linked fault tree with a top event.");
        return;
      }
      if (isBatchWorkflow) onRunFaultTreeBatch(runConfiguration, tree, scenarioIds, effectiveEvidenceMode === "HAZARD_GRID", calculationType);
      else onRunFaultTree(configuration, tree, calculationType);
      return;
    }
    if (selectedEventTree === undefined) {
      setError("Choose an event tree.");
      return;
    }
    if (isBatchWorkflow) onRunEventTreeBatch(runConfiguration, selectedEventTree, scenarioIds, effectiveEvidenceMode === "HAZARD_GRID", calculationType);
    else onRunEventTree(configuration, selectedEventTree, calculationType);
  }

  const hazardUncertaintyBlocked = calculationType === "UNCERTAINTY";
  const calculationLabel = calculationType === "UNCERTAINTY" ? "uncertainty" : "probability";
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
            {executableFaultTrees.length === 0 && <option value="">No linked fault tree</option>}
            {executableFaultTrees.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode} · {option.modelName}</option>)}
          </select>
        </label>
      ) : (
        <label className="hcleditor__run-field hcleditor__run-field--target">
          <span>Event tree</span>
          <select aria-label="HCL event-tree target" value={eventTreeKey} onChange={(event) => setEventTreeKey(event.target.value)}>
            {executableEventTrees.length === 0 && <option value="">No linked event tree</option>}
            {executableEventTrees.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode}</option>)}
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
                      <option value="HAZARD_GRID" disabled={hazardUncertaintyBlocked}>Hazard convolution</option>
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
            {saveBlockedReason !== null && <p role="status">{saveBlockedReason}</p>}
            {uncertaintyError !== null && <p role="alert">{uncertaintyError}</p>}
            {invalidScenario !== undefined && <p role="alert">Scenario {invalidScenario.code} references missing or invalid BN evidence. Repair it or disable the scenario.</p>}
            {workflow === "BATCH" && hazardUncertaintyBlocked && (
              <p role="note">{HCL_HAZARD_CONVOLUTION_POINT_ONLY}</p>
            )}
            <div className="hcleditor__execution-row">
              <div className="hcleditor__run-fields">{targetFields}</div>
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || hasBlockingIssue || (workflow === "BATCH" && enabledScenarios.length === 0) || (effectiveEvidenceMode === "HAZARD_GRID" && hazardUncertaintyBlocked) || (targetKind === "FAULT_TREE" ? executableFaultTrees.length === 0 : executableEventTrees.length === 0)} onClick={run}>
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
                        const invalid = basicEvent === undefined || node === undefined || states.length !== binding.trueStateIds.length || states.length === 0 || states.length === node.states.length;
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
                <summary>Evidence scenarios <span>{String(batchConfiguration?.evidenceScenarios?.length ?? 0)}</span></summary>
                {onGenerateScenarios !== undefined && <HclHazardSweepControls
                  key={`${configuration.modelId}:${model.modelId}`}
                  model={model}
                  disabled={!editable || running}
                  onGenerate={(spec) => onGenerateScenarios(configuration, spec)}
                  onError={setError}
                  onGenerated={(evidenceScenarios, spec) => {
                    batchImportEpoch.current += 1;
                    setBatchInput({ evidenceScenarios, hazardGrid: {
                      name: `${configuration.code} hazard grid`,
                      annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { ...DEFAULT_ANNUALIZATION_CONVENTION } },
                      normalizeWeights: false,
                      ...batchConfiguration?.hazardGrid,
                      hazardNodeIds: spec.dimensions.map((d) => d.bnNode) as [string, ...string[]],
                    } });
                  }}
                />}
                {batchInput !== null && <p role="status">Using temporary batch rows. Saved scenarios are unchanged. <button type="button" onClick={() => { batchImportEpoch.current += 1; setBatchInput(null); }}>Use saved scenarios</button></p>}
                <HclEvidenceScenarioEditor
                    model={model}
                    configuration={batchConfiguration!}
                    editable={editable}
                    showHazardConvolution={batchMode === "HAZARD_GRID"}
                    onChange={(next) => {
                      if (batchInput === null) replaceConfiguration(next);
                      else setBatchInput({ evidenceScenarios: next.evidenceScenarios ?? [], hazardGrid: next.hazardGrid });
                    }}
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
                <summary>Uncertainty <span>{savedUncertainty === undefined ? "Off" : uncertainty === undefined ? "Needs review" : "On"}</span></summary>
                <div className="hcleditor__uncertainty" role="tabpanel" aria-label="HCL uncertainty settings">
                  {savedUncertainty === undefined ? (
                    <div className="hcleditor__uncertainty-empty">
                      <span>Propagate uncertain basic-event probabilities and BN parameters through PRAXIS.</span>
                      {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={enableUncertainty}>Enable uncertainty</button>}
                    </div>
                  ) : uncertainty === undefined ? (
                    <HclUncertaintyReview key={configuration.modelId} value={savedUncertainty} disabled={!editable || running} onChange={replaceUncertainty} />
                  ) : (
                    <>
                      <section className="hcleditor__uncertainty-section hcleditor__uncertainty-section--sampling">
                        <div className="hcleditor__uncertainty-section-head">
                          <div><strong>Sampling</strong><span>The selected method applies to both basic-event probabilities and BN CPT priors. Zero-spread normal, lognormal and logit-normal distributions require MC; constant uniform distributions support both methods.</span></div>
                        </div>
                        <div className="hcleditor__uncertainty-controls">
                          <label>
                            <span>Sampling method</span>
                            <select aria-label="Sampling method" value={normalizeHclUncertaintySampler(uncertainty).sampler} disabled={!editable} onChange={(event) => replaceUncertainty({ ...uncertainty, sampler: event.target.value as "MC" | "LHS" })}>
                              <option value="MC">Monte Carlo (MC)</option>
                              <option value="LHS">Latin hypercube (LHS)</option>
                            </select>
                          </label>
                          <label>
                            <span>Samples</span>
                            <input
                              key={`samples:${String(uncertainty.sampleCount)}`}
                              type="number"
                              min="10"
                              max="10000"
                              step="10"
                              defaultValue={uncertainty.sampleCount}
                              disabled={!editable}
                              onBlur={(event) => {
                                const value = Number(event.target.value);
                                if (Number.isInteger(value) && value >= 10 && value <= 10_000) replaceUncertainty({ ...uncertainty, sampleCount: value });
                                else setError("Uncertainty samples must be a whole number from 10 to 10,000.");
                              }}
                            />
                          </label>
                          <label>
                            <span>Seed</span>
                            <input
                              key={`seed:${String(uncertainty.seed)}`}
                              type="number"
                              min="0"
                              max={Number.MAX_SAFE_INTEGER}
                              step="1"
                              defaultValue={uncertainty.seed}
                              disabled={!editable}
                              onBlur={(event) => {
                                const value = event.target.valueAsNumber;
                                const parsed = HclUncertaintySeedSchema.safeParse(value);
                                if (parsed.success) replaceUncertainty({ ...uncertainty, seed: parsed.data });
                                else setError(`Uncertainty seed must be a whole number from 0 to ${String(Number.MAX_SAFE_INTEGER)}.`);
                              }}
                            />
                          </label>
                          {editable && <button type="button" className="posnav__btn posnav__btn--sm hcleditor__uncertainty-disable" onClick={() => replaceUncertainty(undefined)}>Disable</button>}
                        </div>
                      </section>

                      <section className="hcleditor__uncertainty-section">
                        <div className="hcleditor__uncertainty-section-head">
                          <div><strong>Basic events</strong><span>Samples outside 0–1 are clipped to that range.</span></div>
                        </div>
                        {editable && (
                          <div className="hcleditor__uncertainty-add hcleditor__uncertainty-add--event">
                            <label><span>Basic event</span><select aria-label="Uncertain basic event" value={uncertainBasicEventKey || basicEventUncertaintyOptions[0]?.key || ""} onChange={(event) => setUncertainBasicEventKey(event.target.value)}>{basicEventUncertaintyOptions.map(({ key, tree, event }) => <option key={key} value={key}>{tree.modelCode} / {event.code}</option>)}</select></label>
                            <label><span>Distribution</span><select aria-label="Basic-event uncertainty distribution" value={uncertainBasicEventFamily} onChange={(event) => setUncertainBasicEventFamily(event.target.value as HclBasicEventProbabilityDistribution["family"])}><HclDistributionOptions /></select></label>
                            <button type="button" className="posnav__btn posnav__btn--sm" onClick={addBasicEventUncertainty}>Add</button>
                          </div>
                        )}
                        {uncertainty.basicEventDistributions.length > 0 && (
                          <details className="hcleditor__uncertainty-collection">
                            <summary>Configured basic events <span>{String(uncertainty.basicEventDistributions.length)}</span></summary>
                            <div className="hcleditor__uncertainty-list">
                            {uncertainty.basicEventDistributions.map((definition, index) => {
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
                                        <HclDistributionOptions />
                                      </select>
                                    </label>
                                    <HclDistributionParameters distribution={distribution} sampler={normalizeHclUncertaintySampler(uncertainty).sampler ?? "MC"} disabled={!editable} onChange={(value) => updateBasicEventDistribution(index, value)} onError={setError} />
                                  </div>
                                  {editable && <button type="button" className="hcleditor__uncertainty-delete" onClick={() => replaceUncertainty({ ...uncertainty, basicEventDistributions: uncertainty.basicEventDistributions.filter((_, candidateIndex) => candidateIndex !== index) })}>Delete</button>}
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
                        <label><span>BN probability clipping epsilon</span><input
                          key={`cpt-clip:${uncertainty.cptProbabilityClipEpsilon ?? 0}`}
                          type="number" min="0" max="0.499999" step="any"
                          defaultValue={uncertainty.cptProbabilityClipEpsilon ?? 0}
                          disabled={!editable}
                          onBlur={(event) => {
                            const value = event.target.value.trim() === "" ? Number.NaN : Number(event.target.value);
                            if (Number.isFinite(value) && value >= 0 && value < 0.5) replaceUncertainty({ ...uncertainty, cptProbabilityClipEpsilon: value });
                            else { event.target.value = String(uncertainty.cptProbabilityClipEpsilon ?? 0); setError("BN probability clipping epsilon must be from 0 to less than 0.5."); }
                          }}
                        /></label>
                        <span>Zero disables clipping. A positive epsilon limits Beta probabilities to [epsilon, 1 - epsilon].</span>
                        {editable && (
                          <div className="hcleditor__uncertainty-add">
                            <label><span>CPT row</span><select aria-label="Uncertain CPT row" value={uncertainCptRowKey || cptRowUncertaintyOptions[0]?.key || ""} onChange={(event) => setUncertainCptRowKey(event.target.value)}>{cptRowUncertaintyOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
                            <button type="button" className="posnav__btn posnav__btn--sm" onClick={addCptRowUncertainty}>Add</button>
                          </div>
                        )}
                        {uncertainty.cptRowDistributions.length > 0 && (
                          <details className="hcleditor__uncertainty-collection">
                            <summary>Configured CPT rows <span>{String(uncertainty.cptRowDistributions.length)}</span></summary>
                            <div className="hcleditor__uncertainty-list">
                            {uncertainty.cptRowDistributions.map((definition, index) => {
                            const option = cptRowUncertaintyOptions.find((candidate) => candidate.nodeId === definition.bayesianNetworkNode.entityId && candidate.rowId === definition.cptRowId);
                            return (
                              <details key={`${definition.bayesianNetworkNode.entityId}:${definition.cptRowId}`} className="hcleditor__uncertainty-item">
                                <summary>
                                  <span className="hcleditor__uncertainty-item-name">
                                    <small>BN / CPT row</small>
                                    <strong>{option?.label ?? definition.cptRowId}</strong>
                                  </span>
                                  <span className="hcleditor__uncertainty-family">{definition.prior?.family === "BETA" ? "Beta" : definition.prior ? "Dirichlet" : "Prior required"}</span>
                                  <span className="hcleditor__uncertainty-expand">Settings</span>
                                </summary>
                                <div className="hcleditor__uncertainty-item-settings">
                                  <div className="hcleditor__uncertainty-parameters"><HclCptPriorControls
                                    prior={definition.prior}
                                    states={model.nodes.find((node) => node.id === definition.bayesianNetworkNode.entityId)?.states ?? []}
                                    disabled={!editable}
                                    onError={setError}
                                    onChange={(prior) => replaceUncertainty({ ...uncertainty, cptRowDistributions: uncertainty.cptRowDistributions.map((row, rowIndex) => {
                                      if (rowIndex !== index) {
                                        if (prior.family === "BETA" && row.prior?.family === "BETA" && row.bayesianNetworkNode.entityId === definition.bayesianNetworkNode.entityId) return { ...row, prior: { ...row.prior, trueStateId: prior.trueStateId } };
                                        return row;
                                      }
                                      return { bayesianNetworkNode: row.bayesianNetworkNode, cptRowId: row.cptRowId, prior };
                                    }) })}
                                  /></div>
                                  {editable && <button type="button" className="hcleditor__uncertainty-delete" onClick={() => replaceUncertainty({ ...uncertainty, cptRowDistributions: uncertainty.cptRowDistributions.filter((_, candidateIndex) => candidateIndex !== index) })}>Delete</button>}
                                </div>
                              </details>
                            );
                          })}
                            </div>
                          </details>
                        )}
                      </section>
                      <HclSeismicGeneratorControls model={model} reference={configuration.bayesianNetwork} settings={uncertainty} disabled={!editable} onChange={replaceUncertainty} onError={setError} />
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
          <HclResults runResult={runResult} batchRunResult={batchRunResult} workflow={workflow} calculationType={calculationType} eventTreeOptions={eventTreeOptions} faultTreeOptions={faultTreeOptions} />
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
