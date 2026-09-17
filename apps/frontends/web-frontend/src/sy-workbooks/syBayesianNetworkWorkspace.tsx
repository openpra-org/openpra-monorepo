import { stringifyJson } from "interfaces-shared-types/json";
import { useAnalysisSourceGuard } from "../newly-developed-methods/shared/useAnalysisSourceGuard";
import { type JSX, useEffect, useMemo, useState } from "react";
import type {
  BayesianNetworkEvidenceConfiguration,
  HclEvidenceScenario,
  WorkbookBayesianNetwork,
  WorkbookHclConfiguration,
} from "interfaces-mef-types/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkAnalysisResult,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  BayesianNetworkEditor,
  createEmptyBayesianNetwork,
  type BayesianNetworkFaultTreeOption,
  type BayesianNetworkQueryBatchResult,
} from "../newly-developed-methods/bayesian-network";
import type {
  HclEditorBatchRunResult,
  HclEditorRunResult,
  HclEditorScenarioRunResult,
  HclFaultTreeOption,
  HclCalculationType,
} from "../newly-developed-methods/hybrid-causal-logic";
import { useEditorConfirmation } from "../newly-developed-methods/shared";
import { analysisSaveBlock, useAnalysisScope } from "../newly-developed-methods/shared/useAnalysisScope";
import { useSyWorkbook } from "./syWorkbookContext";
import {
  getSyBayesianNetworkResult,
  getSyBayesianNetworkBatchResult,
  runSyBayesianNetworkBatch,
  getSyHclFaultTreeResult,
  runSyBayesianNetwork,
  runSyHclFaultTree,
  runSyHclFaultTreeBatch,
  generateSyHclScenarios,
} from "./syWorkbookApi";

function SyBayesianNetworkWorkspace(): JSX.Element {
  const { sy, editable, mutateSy, runtime } = useSyWorkbook();
  const networks = sy.dependencyBayesianNetworks ?? [];
  const configurations = sy.dependencyHclConfigurations ?? [];
  const [selectedModelId, setSelectedModelId] = useState(networks[0]?.modelId ?? "");
  const [evidenceByModel, setEvidenceByModel] = useState<Record<string, BayesianNetworkEvidenceConfiguration>>({});
  const [queryByModel, setQueryByModel] = useState<Record<string, string | null>>({});
  const [results, setResults] = useState<Record<string, BayesianNetworkAnalysisResult>>({});
  const [queryBatchResults, setQueryBatchResults] = useState<Record<string, BayesianNetworkQueryBatchResult>>({});
  const [runningModelId, setRunningModelId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [hclResults, setHclResults] = useState<Record<string, HclEditorRunResult>>({});
  const [hclBatchResults, setHclBatchResults] = useState<Record<string, HclEditorBatchRunResult>>({});
  const [runningConfigurationId, setRunningConfigurationId] = useState<string | null>(null);
  const [hclRunError, setHclRunError] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const model = networks.find((candidate) => candidate.modelId === selectedModelId) ?? networks[0];
  const relevantConfigurations = useMemo(
    () => model === undefined ? [] : configurations.filter((configuration) =>
      configuration.bayesianNetwork.workbookId === runtime.workbookId
      && configuration.bayesianNetwork.modelId === model.modelId),
    [configurations, model, runtime.workbookId],
  );
  const evidence = model === undefined
    ? { observations: [] }
    : evidenceByModel[model.modelId] ?? relevantConfigurations[0]?.baseEvidence ?? { observations: [] };
  const queryNodeId = model === undefined
    ? null
    : queryByModel[model.modelId] ?? model.nodes[0]?.id ?? null;

  useEffect(() => {
    if (model !== undefined && model.modelId !== selectedModelId) setSelectedModelId(model.modelId);
  }, [model, selectedModelId]);

  const faultTreeOptions = useMemo<BayesianNetworkFaultTreeOption[]>(() =>
    sy.systemLogicModels.map((logic) => {
      const usedEventIds = new Set(logic.leafNodes.flatMap((leaf) =>
        leaf.kind === "BASIC_EVENT_REFERENCE" ? [leaf.basicEventId] : [],
      ));
      return {
        workbookId: runtime.workbookId ?? "",
        workbookName: "This Systems Analysis workbook",
        modelId: logic.uuid,
        modelCode: logic.code,
        modelName: logic.name,
        topGateId: logic.topGate?.gateId ?? null,
        basicEvents: sy.systemBasicEvents
          .filter((event) => usedEventIds.has(event.uuid))
          .map((event) => ({ id: event.uuid, code: event.code, name: event.name })),
      };
    }), [runtime.workbookId, sy.systemBasicEvents, sy.systemLogicModels]);

  const validation = model === undefined ? [] : validateBayesianNetworkModel(model, {
    evidence,
    hclBindings: relevantConfigurations.flatMap((configuration) => configuration.bindings),
    ...(runtime.workbookId === null ? {} : { workbookId: runtime.workbookId }),
  });

  const saveBlockedReason = analysisSaveBlock(runtime);
  const {sourceEpoch, sourceWarning} = useAnalysisSourceGuard("sy", runtime.workbookId);
  const inputKey = stringifyJson([sourceEpoch, runtime.workbookId, runtime.revision, runtime.saveStatus,
    networks, configurations, sy.systemLogicModels, sy.systemBasicEvents, model?.modelId, evidenceByModel, queryByModel]);
  const analysis = useAnalysisScope(inputKey!, () => {
    setResults({});
    setQueryBatchResults({});
    setHclResults({});
    setHclBatchResults({});
    setRunningModelId(null);
    setRunningConfigurationId(null);
    setRunError(null);
    setHclRunError(null);
  });

  function changeConfigurations(next: WorkbookHclConfiguration[]): void {
    analysis.invalidate();
    mutateSy((current) => ({ ...current, dependencyHclConfigurations: next }));
  }

  function createNetwork(): void {
    const created = createEmptyBayesianNetwork("Dependency network") as WorkbookBayesianNetwork;
    mutateSy((current) => ({
      ...current,
      dependencyBayesianNetworks: [...(current.dependencyBayesianNetworks ?? []), created],
    }));
    setSelectedModelId(created.modelId);
  }

  function replaceNetwork(next: BayesianNetworkModel): void {
    analysis.invalidate();
    // Keep evidence and bindings intact: undo restores their referenced IDs.
    mutateSy((current) => ({
      ...current,
      dependencyBayesianNetworks: (current.dependencyBayesianNetworks ?? []).map((candidate) =>
        candidate.modelId === next.modelId ? next as WorkbookBayesianNetwork : candidate,
      ),
    }));
  }

  function removeNetwork(): void {
    if (model === undefined) return;
    requestConfirmation({
      title: `Delete ${model.code}?`,
      message: `${String(relevantConfigurations.length)} HCL configuration${relevantConfigurations.length === 1 ? "" : "s"} using this network will also be removed.`,
      confirmLabel: "Delete network",
      tone: "danger",
    }, () => {
      mutateSy((current) => ({
        ...current,
        dependencyBayesianNetworks: (current.dependencyBayesianNetworks ?? []).filter((candidate) => candidate.modelId !== model.modelId),
        dependencyHclConfigurations: (current.dependencyHclConfigurations ?? []).filter((configuration) => configuration.bayesianNetwork.modelId !== model.modelId),
      }));
      setSelectedModelId("");
    });
  }

  async function runExactQuery(): Promise<void> {
    if (saveBlockedReason !== null) { setRunError(saveBlockedReason); return; }
    if (model === undefined || queryNodeId === null || runtime.workbookId === null || runtime.revision === null) {
      setRunError("Exact inference is available after this SY workbook has been saved.");
      return;
    }
    const issue = validation.find((candidate) => candidate.severity === "ERROR" && !candidate.code.startsWith("BN_HCL_"));
    if (issue !== undefined) {
      setRunError(issue.message);
      return;
    }
    analysis.invalidate();
    const isCurrent = analysis.capture();
    setRunningModelId(model.modelId);
    setRunError(null);
    try {
      const execution = await runSyBayesianNetwork(runtime.workbookId, model.modelId, runtime.revision, evidence, queryNodeId);
      if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? `Inference did not complete (${execution.run.status}).`);
      const result = await getSyBayesianNetworkResult(runtime.workbookId, model.modelId, execution.run.id);
      if (!isCurrent()) return;
      setResults((current) => ({ ...current, [model.modelId]: result }));
    } catch (error) {
      if (!isCurrent()) return;
      setRunError(error instanceof Error ? error.message : "Bayesian-network inference failed.");
    } finally {
      if (isCurrent()) setRunningModelId(null);
    }
  }

  async function runExactQueryBatch(scenarios: HclEvidenceScenario[]): Promise<void> {
    if (saveBlockedReason !== null) { setRunError(saveBlockedReason); return; }
    if (model === undefined || queryNodeId === null || runtime.workbookId === null || runtime.revision === null) {
      setRunError("Exact inference is available after this SY workbook has been saved.");
      return;
    }
    analysis.invalidate();
    const isCurrent = analysis.capture();
    setRunningModelId(model.modelId);
    setRunError(null);
    try {
      const execution = await runSyBayesianNetworkBatch(
        runtime.workbookId, model.modelId, runtime.revision, scenarios, queryNodeId,
      );
      if (execution.run.status !== "SUCCEEDED") {
        throw new Error(execution.run.failure?.message ?? `Inference did not complete (${execution.run.status}).`);
      }
      const result = await getSyBayesianNetworkBatchResult(runtime.workbookId, model.modelId, execution.run.id);
      if (!isCurrent()) return;
      setQueryBatchResults((current) => ({
        ...current,
        [model.modelId]: { queryNodeId, scenarios: result.scenarios },
      }));
    } catch (error) {
      if (!isCurrent()) return;
      setRunError(error instanceof Error ? error.message : "Bayesian-network batch inference failed.");
    } finally {
      if (isCurrent()) setRunningModelId(null);
    }
  }

  function replaceEvidence(next: BayesianNetworkEvidenceConfiguration): void {
    if (model === undefined) return;
    setEvidenceByModel((current) => ({ ...current, [model.modelId]: next }));
    analysis.invalidate();
    if (relevantConfigurations.length === 0) return;
    mutateSy((current) => ({
      ...current,
      dependencyHclConfigurations: (current.dependencyHclConfigurations ?? []).map((configuration) =>
        configuration.bayesianNetwork.workbookId === runtime.workbookId && configuration.bayesianNetwork.modelId === model.modelId
          ? { ...configuration, baseEvidence: next }
          : configuration,
      ),
    }));
  }

  async function runHcl(configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption, calculationType: HclCalculationType): Promise<void> {
    if (saveBlockedReason !== null) { setHclRunError(saveBlockedReason); return; }
    if (runtime.workbookId === null || runtime.revision === null || faultTree.topGateId === null) {
      setHclRunError("HCL quantification is available after this workbook and top event have been saved.");
      return;
    }
    analysis.invalidate();
    const isCurrent = analysis.capture();
    setRunningConfigurationId(configuration.modelId);
    setHclRunError(null);
    try {
      const execution = await runSyHclFaultTree(runtime.workbookId, configuration.modelId, runtime.revision, {
        referenceType: "FAULT_TREE_TOP_EVENT",
        workbookId: faultTree.workbookId,
        modelId: faultTree.modelId,
        entityId: faultTree.topGateId,
      }, calculationType);
      if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? `HCL quantification did not complete (${execution.run.status}).`);
      const result = await getSyHclFaultTreeResult(runtime.workbookId, configuration.modelId, execution.run.id);
      if (!isCurrent()) return;
      setHclResults((current) => ({ ...current, [configuration.modelId]: { kind: "FAULT_TREE", result } }));
    } catch (error) {
      if (!isCurrent()) return;
      setHclRunError(error instanceof Error ? error.message : "HCL fault-tree quantification failed.");
    } finally {
      if (isCurrent()) setRunningConfigurationId(null);
    }
  }

  async function runHclBatch(
    configuration: WorkbookHclConfiguration,
    faultTree: HclFaultTreeOption,
    scenarioIds: string[],
    integrateHazardGrid: boolean,
    calculationType: HclCalculationType,
  ): Promise<void> {
    if (saveBlockedReason !== null) { setHclRunError(saveBlockedReason); return; }
    if (runtime.workbookId === null || runtime.revision === null || faultTree.topGateId === null) return;
    analysis.invalidate();
    const isCurrent = analysis.capture();
    setRunningConfigurationId(configuration.modelId);
    setHclRunError(null);
    try {
      const execution = await runSyHclFaultTreeBatch(
        runtime.workbookId,
        configuration.modelId,
        runtime.revision,
        {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: faultTree.workbookId,
          modelId: faultTree.modelId,
          entityId: faultTree.topGateId,
        },
        calculationType,
        scenarioIds,
        integrateHazardGrid,
        { evidenceScenarios: configuration.evidenceScenarios ?? [], hazardGrid: configuration.hazardGrid },
      );
      const scenarios: HclEditorScenarioRunResult[] = await Promise.all(execution.runs.map(async (scenario) => ({
        scenarioId: scenario.scenarioId,
        scenarioCode: scenario.scenarioCode,
        scenarioName: scenario.scenarioName,
        status: scenario.run.status,
        failure: scenario.run.failure?.message ?? null,
        result: scenario.run.status !== "SUCCEEDED" ? null : {
          kind: "FAULT_TREE" as const,
          result: await getSyHclFaultTreeResult(runtime.workbookId!, configuration.modelId, scenario.run.id),
        },
      })));
      if (!isCurrent()) return;
      setHclBatchResults((current) => ({
        ...current,
        [configuration.modelId]: {
          kind: "FAULT_TREE",
          scenarios,
          ...(execution.hazardConvolution === undefined ? {} : { hazardConvolution: execution.hazardConvolution }),
        ...(execution.compilationReuse === undefined ? {} : { compilationReuse: execution.compilationReuse }),
        },
      }));
    } catch (error) {
      if (!isCurrent()) return;
      setHclRunError(error instanceof Error ? error.message : "HCL fault-tree scenario batch failed.");
    } finally {
      if (isCurrent()) setRunningConfigurationId(null);
    }
  }

  return (
    <section className="poscard" aria-label="Systems Analysis dependency models">
      <div className="poscard__head bneditor__network-head">
        <h3 className="poscard__title">Bayesian dependency network</h3>
        <div className="posrow esqbn__network-actions" style={{ gap: 8 }}>
          {model !== undefined && (
            <select aria-label="Bayesian network" className="posfield__select" value={model.modelId} onChange={(event) => setSelectedModelId(event.target.value)}>
              {networks.map((candidate) => <option key={candidate.modelId} value={candidate.modelId}>{candidate.code} · {candidate.name}</option>)}
            </select>
          )}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createNetwork}><span aria-hidden="true">+</span>Add network</button>}
          {editable && model !== undefined && <button type="button" className="posnav__btn posnav__btn--sm bneditor__network-delete" onClick={removeNetwork}>Delete network</button>}
        </div>
      </div>
      {model === undefined ? (
        null
      ) : (
        <BayesianNetworkEditor
          model={model}
          saveBlockedReason={saveBlockedReason}
          onAnalysisInputChange={analysis.invalidate}
          editable={editable}
          hclScope="FAULT_TREE"
          evidence={evidence}
          queryNodeId={queryNodeId}
          validation={validation}
          analysisResult={results[model.modelId] ?? null}
          queryBatchResult={queryBatchResults[model.modelId] ?? null}
          running={runningModelId === model.modelId}
          runError={runError ?? sourceWarning}
          workbookId={runtime.workbookId}
          hclConfigurations={configurations}
          faultTreeOptions={faultTreeOptions}
          eventTreeOptions={[]}
          hclRunning={relevantConfigurations.some((configuration) => configuration.modelId === runningConfigurationId)}
          hclRunError={hclRunError ?? sourceWarning}
          hclRunResult={relevantConfigurations.length === 0 ? null : hclResults[relevantConfigurations[0]!.modelId] ?? null}
          hclBatchRunResult={relevantConfigurations.length === 0 ? null : hclBatchResults[relevantConfigurations[0]!.modelId] ?? null}
          onModelChange={replaceNetwork}
          onEvidenceChange={replaceEvidence}
          onQueryNodeChange={(next) => {
            analysis.invalidate();
            setQueryByModel((current) => ({ ...current, [model.modelId]: next }));
          }}
          onHclConfigurationsChange={changeConfigurations}
          onGenerateHclScenarios={async (configuration, spec) => {
            if (saveBlockedReason !== null) throw new Error(saveBlockedReason);
            if (runtime.workbookId === null || runtime.revision === null) throw new Error("Save the workbook first.");
            return (await generateSyHclScenarios(runtime.workbookId, configuration.modelId, runtime.revision, spec)).scenarios;
          }}
          onRunHclFaultTree={(configuration, faultTree, calculationType) => { void runHcl(configuration, faultTree, calculationType); }}
          onRunHclEventTree={() => undefined}
          onRunHclFaultTreeBatch={(configuration, faultTree, scenarioIds, integrateHazardGrid, calculationType) => { void runHclBatch(configuration, faultTree, scenarioIds, integrateHazardGrid, calculationType); }}
          onRunHclEventTreeBatch={() => undefined}
          onRun={() => { void runExactQuery(); }}
          onRunBatch={(scenarios) => { void runExactQueryBatch(scenarios); }}
        />
      )}
      {confirmationDialog}
    </section>
  );
}

export { SyBayesianNetworkWorkspace };
