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
} from "../newly-developed-methods/hybrid-causal-logic";
import { useEditorConfirmation } from "../newly-developed-methods/shared";
import { useSyWorkbook } from "./syWorkbookContext";
import {
  getSyBayesianNetworkResult,
  getSyHclFaultTreeResult,
  runSyBayesianNetwork,
  runSyHclFaultTree,
  runSyHclFaultTreeBatch,
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
        gates: logic.gates.map((gate) => gate.gateType === "K_OF_N"
          ? { id: gate.id, gateType: gate.gateType, k: gate.k }
          : { id: gate.id, gateType: gate.gateType }),
        leafNodes: logic.leafNodes.map((leaf) => {
          if (leaf.kind === "BASIC_EVENT_REFERENCE") return { id: leaf.id, kind: leaf.kind, basicEventId: leaf.basicEventId };
          if (leaf.kind === "HOUSE_EVENT") return { id: leaf.id, kind: leaf.kind, state: leaf.state };
          if (leaf.kind === "TRANSFER_REFERENCE") {
            return {
              id: leaf.id,
              kind: leaf.kind,
              target: {
                workbookId: runtime.workbookId ?? "",
                modelId: leaf.target.modelId,
                entityId: leaf.target.entityId,
              },
            };
          }
          return { id: leaf.id, kind: leaf.kind };
        }),
        gateInputs: logic.gateInputs.map(({ gateId, childId, order }) => ({ gateId, childId, order })),
        constantBasicEventStates: Object.fromEntries(sy.systemBasicEvents.flatMap((event) =>
          event.controlledDataSource === undefined && (event.probability === 0 || event.probability === 1)
            ? [[event.uuid, event.probability === 1]]
            : [],
        )),
      };
    }), [runtime.workbookId, sy.systemBasicEvents, sy.systemLogicModels]);

  const validation = model === undefined ? [] : validateBayesianNetworkModel(model, {
    evidence,
    hclBindings: relevantConfigurations.flatMap((configuration) => configuration.bindings),
    ...(runtime.workbookId === null ? {} : { workbookId: runtime.workbookId }),
  });

  function changeConfigurations(next: WorkbookHclConfiguration[]): void {
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
    const statesByNode = new Map(next.nodes.map((node) => [node.id, new Set(node.states.map((state) => state.id))]));
    const sanitizedEvidence = {
      observations: evidence.observations.filter((observation) => statesByNode.get(observation.nodeId)?.has(observation.stateId) === true),
    };
    mutateSy((current) => ({
      ...current,
      dependencyBayesianNetworks: (current.dependencyBayesianNetworks ?? []).map((candidate) =>
        candidate.modelId === next.modelId ? next as WorkbookBayesianNetwork : candidate,
      ),
      dependencyHclConfigurations: (current.dependencyHclConfigurations ?? []).map((configuration) =>
        configuration.bayesianNetwork.modelId === next.modelId
          ? {
              ...configuration,
              baseEvidence: sanitizedEvidence,
              evidenceScenarios: (configuration.evidenceScenarios ?? []).map((scenario) => ({
                ...scenario,
                evidence: {
                  observations: scenario.evidence.observations.filter((observation) =>
                    statesByNode.get(observation.nodeId)?.has(observation.stateId) === true,
                  ),
                },
              })),
            }
          : configuration,
      ),
    }));
    setEvidenceByModel((current) => ({ ...current, [next.modelId]: sanitizedEvidence }));
    setResults((current) => {
      const { [next.modelId]: _stale, ...remaining } = current;
      return remaining;
    });
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
    if (model === undefined || queryNodeId === null || runtime.workbookId === null || runtime.revision === null) {
      setRunError("Exact inference is available after this SY workbook has been saved.");
      return;
    }
    const issue = validation.find((candidate) => candidate.severity === "ERROR" && !candidate.code.startsWith("BN_HCL_"));
    if (issue !== undefined) {
      setRunError(issue.message);
      return;
    }
    setRunningModelId(model.modelId);
    setRunError(null);
    try {
      const execution = await runSyBayesianNetwork(runtime.workbookId, model.modelId, runtime.revision, evidence, queryNodeId);
      if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? `Inference did not complete (${execution.run.status}).`);
      const result = await getSyBayesianNetworkResult(runtime.workbookId, model.modelId, execution.run.id);
      setResults((current) => ({ ...current, [model.modelId]: result }));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Bayesian-network inference failed.");
    } finally {
      setRunningModelId(null);
    }
  }

  async function runExactQueryBatch(scenarios: HclEvidenceScenario[]): Promise<void> {
    if (model === undefined || queryNodeId === null || runtime.workbookId === null || runtime.revision === null) {
      setRunError("Exact inference is available after this SY workbook has been saved.");
      return;
    }
    setRunningModelId(model.modelId);
    setRunError(null);
    const rows: BayesianNetworkQueryBatchResult["scenarios"] = [];
    for (const scenario of scenarios) {
      try {
        const execution = await runSyBayesianNetwork(
          runtime.workbookId,
          model.modelId,
          runtime.revision,
          scenario.evidence,
          queryNodeId,
        );
        if (execution.run.status !== "SUCCEEDED") {
          throw new Error(execution.run.failure?.message ?? `Inference did not complete (${execution.run.status}).`);
        }
        rows.push({
          scenarioId: scenario.id,
          scenarioCode: scenario.code,
          scenarioName: scenario.name,
          status: "SUCCEEDED",
          failure: null,
          result: await getSyBayesianNetworkResult(runtime.workbookId, model.modelId, execution.run.id),
        });
      } catch (error) {
        rows.push({
          scenarioId: scenario.id,
          scenarioCode: scenario.code,
          scenarioName: scenario.name,
          status: "FAILED",
          failure: error instanceof Error ? error.message : "Bayesian-network inference failed.",
          result: null,
        });
      }
    }
    setQueryBatchResults((current) => ({
      ...current,
      [model.modelId]: { queryNodeId, scenarios: rows },
    }));
    setRunningModelId(null);
  }

  function replaceEvidence(next: BayesianNetworkEvidenceConfiguration): void {
    if (model === undefined) return;
    setEvidenceByModel((current) => ({ ...current, [model.modelId]: next }));
    setResults((current) => {
      const { [model.modelId]: _stale, ...remaining } = current;
      return remaining;
    });
    if (relevantConfigurations.length === 0) return;
    const affectedConfigurationIds = new Set(relevantConfigurations.map((configuration) => configuration.modelId));
    setHclResults((current) => Object.fromEntries(
      Object.entries(current).filter(([configurationId]) => !affectedConfigurationIds.has(configurationId)),
    ));
    setHclBatchResults((current) => Object.fromEntries(
      Object.entries(current).filter(([configurationId]) => !affectedConfigurationIds.has(configurationId)),
    ));
    mutateSy((current) => ({
      ...current,
      dependencyHclConfigurations: (current.dependencyHclConfigurations ?? []).map((configuration) =>
        configuration.bayesianNetwork.modelId === model.modelId
          ? { ...configuration, baseEvidence: next }
          : configuration,
      ),
    }));
  }

  async function runHcl(configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption): Promise<void> {
    if (runtime.workbookId === null || runtime.revision === null || faultTree.topGateId === null) {
      setHclRunError("HCL quantification is available after this workbook and top event have been saved.");
      return;
    }
    setRunningConfigurationId(configuration.modelId);
    setHclRunError(null);
    try {
      const execution = await runSyHclFaultTree(runtime.workbookId, configuration.modelId, runtime.revision, {
        referenceType: "FAULT_TREE_TOP_EVENT",
        workbookId: faultTree.workbookId,
        modelId: faultTree.modelId,
        entityId: faultTree.topGateId,
      });
      if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? `HCL quantification did not complete (${execution.run.status}).`);
      const result = await getSyHclFaultTreeResult(runtime.workbookId, configuration.modelId, execution.run.id);
      setHclResults((current) => ({ ...current, [configuration.modelId]: { kind: "FAULT_TREE", result } }));
      setHclBatchResults((current) => {
        const { [configuration.modelId]: _stale, ...remaining } = current;
        return remaining;
      });
    } catch (error) {
      setHclRunError(error instanceof Error ? error.message : "HCL fault-tree quantification failed.");
    } finally {
      setRunningConfigurationId(null);
    }
  }

  async function runHclBatch(
    configuration: WorkbookHclConfiguration,
    faultTree: HclFaultTreeOption,
    scenarioIds: string[],
    integrateHazardGrid: boolean,
  ): Promise<void> {
    if (runtime.workbookId === null || runtime.revision === null || faultTree.topGateId === null) return;
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
        scenarioIds,
        integrateHazardGrid,
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
      setHclBatchResults((current) => ({
        ...current,
        [configuration.modelId]: {
          kind: "FAULT_TREE",
          scenarios,
          ...(execution.hazardConvolution === undefined ? {} : { hazardConvolution: execution.hazardConvolution }),
        },
      }));
      setHclResults((current) => {
        const { [configuration.modelId]: _stale, ...remaining } = current;
        return remaining;
      });
    } catch (error) {
      setHclRunError(error instanceof Error ? error.message : "HCL fault-tree scenario batch failed.");
    } finally {
      setRunningConfigurationId(null);
    }
  }

  return (
    <section className="poscard" aria-label="Systems Analysis dependency models">
      <div className="poscard__head">
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
          editable={editable}
          hclScope="FAULT_TREE"
          evidence={evidence}
          queryNodeId={queryNodeId}
          validation={validation}
          analysisResult={results[model.modelId] ?? null}
          queryBatchResult={queryBatchResults[model.modelId] ?? null}
          running={runningModelId === model.modelId}
          runError={runError}
          workbookId={runtime.workbookId}
          hclConfigurations={configurations}
          faultTreeOptions={faultTreeOptions}
          eventTreeOptions={[]}
          hclRunning={relevantConfigurations.some((configuration) => configuration.modelId === runningConfigurationId)}
          hclRunError={hclRunError}
          hclRunResult={relevantConfigurations.length === 0 ? null : hclResults[relevantConfigurations[0]!.modelId] ?? null}
          hclBatchRunResult={relevantConfigurations.length === 0 ? null : hclBatchResults[relevantConfigurations[0]!.modelId] ?? null}
          onModelChange={replaceNetwork}
          onEvidenceChange={replaceEvidence}
          onQueryNodeChange={(next) => {
            setQueryByModel((current) => ({ ...current, [model.modelId]: next }));
            setQueryBatchResults((current) => {
              const { [model.modelId]: _stale, ...remaining } = current;
              return remaining;
            });
          }}
          onHclConfigurationsChange={changeConfigurations}
          onRunHclFaultTree={(configuration, faultTree) => { void runHcl(configuration, faultTree); }}
          onRunHclEventTree={() => undefined}
          onRunHclFaultTreeBatch={(configuration, faultTree, scenarioIds, integrateHazardGrid) => { void runHclBatch(configuration, faultTree, scenarioIds, integrateHazardGrid); }}
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
