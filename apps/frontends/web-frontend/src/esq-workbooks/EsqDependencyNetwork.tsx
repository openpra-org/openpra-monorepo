import { JSX, useMemo, useState } from "react";
import { stringifyJson } from "interfaces-shared-types/json";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration, HclEvidenceScenario } from "interfaces-mef-types/modeling";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
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
import { useEditorConfirmation } from "../newly-developed-methods/shared";
import { analysisSaveBlock, analysisSaveNotice, useAnalysisScope } from "../newly-developed-methods/shared/useAnalysisScope";
import { useAnalysisSourceGuard } from "../newly-developed-methods/shared/useAnalysisSourceGuard";
import { linkOf } from "./esqModel";
import { exampleLinkLabel } from "./esqViewData";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  buildBayesianNetworkFromSpecification,
  getEsqBayesianNetworkBatchResult,
  getEsqBayesianNetworkResult,
  runEsqBayesianNetwork,
  runEsqBayesianNetworkBatch,
} from "./esqWorkbookApi";

const NO_EVIDENCE: BayesianNetworkEvidenceConfiguration = { observations: [] };

function faultTreeOptionsOf(sy: SystemsAnalysis | undefined, syId: string | undefined, syName: string): BayesianNetworkFaultTreeOption[] {
  if (sy === undefined || syId === undefined) return [];
  return sy.systemLogicModels.map((logic) => {
    const used = new Set(logic.leafNodes.flatMap((leaf) => (leaf.kind === "BASIC_EVENT_REFERENCE" ? [leaf.basicEventId] : [])));
    return {
      workbookId: syId,
      workbookName: syName,
      modelId: logic.uuid,
      modelCode: logic.code,
      modelName: logic.name,
      topGateId: logic.topGate?.gateId ?? null,
      basicEvents: sy.systemBasicEvents.filter((event) => used.has(event.uuid)).map((event) => ({ id: event.uuid, code: event.code, name: event.name })),
    };
  });
}

function configurationOf(configurations: readonly EsqHclConfiguration[], networkId: string): EsqHclConfiguration | undefined {
  return configurations.find((candidate) => candidate.bayesianNetwork.modelId === networkId);
}

function nodeLinkCount(esq: EventSequenceQuantification, networkId: string): number {
  const targets = (esq.modelDecisions?.functionLinks ?? []).flatMap((link) => [link.target, ...(link.rules ?? []).map((rule) => rule.target)]);
  return targets.filter((target) => target?.kind === "NETWORK_NODE" && target.node.modelId === networkId).length;
}

function useDependencyFaultTrees(): BayesianNetworkFaultTreeOption[] {
  const { esq, upstream } = useEsqWorkbook();
  const syId = linkOf(esq, "SY");
  const syName = syId === undefined ? "" : upstream.options.SY.find((workbook) => workbook.id === syId)?.name ?? exampleLinkLabel(syId) ?? "The linked SY workbook";
  return useMemo(() => faultTreeOptionsOf(upstream.sy, syId, syName), [syId, syName, upstream.sy]);
}

function EsqDependencyNetwork({ network, faultTreeOptions, onNetwork }: {
  network: EsqBayesianNetwork | undefined;
  faultTreeOptions: BayesianNetworkFaultTreeOption[];
  onNetwork: (modelId: string) => void;
}): JSX.Element {
  const { esq, editable, mutateEsq, runtime } = useEsqWorkbook();
  const networks = esq.bayesianNetworks;
  const configurations = esq.hclConfigurations;
  const [evidenceByModel, setEvidenceByModel] = useState<Record<string, BayesianNetworkEvidenceConfiguration>>({});
  const [queryByModel, setQueryByModel] = useState<Record<string, string | null>>({});
  const [results, setResults] = useState<Record<string, BayesianNetworkAnalysisResult>>({});
  const [batchResults, setBatchResults] = useState<Record<string, BayesianNetworkQueryBatchResult>>({});
  const [runningModelId, setRunningModelId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const configuration = network === undefined ? undefined : configurationOf(configurations, network.modelId);
  const evidence = network === undefined ? NO_EVIDENCE : evidenceByModel[network.modelId] ?? configuration?.baseEvidence ?? NO_EVIDENCE;
  const queryNodeId = network === undefined ? null : queryByModel[network.modelId] ?? network.nodes[0]?.id ?? null;
  const validation = useMemo(() => (network === undefined ? [] : validateBayesianNetworkModel(network, {
    evidence,
    hclBindings: configurations.filter((candidate) => candidate.bayesianNetwork.modelId === network.modelId).flatMap((candidate) => candidate.bindings),
    ...(runtime.workbookId === null ? {} : { workbookId: runtime.workbookId }),
  })), [configurations, evidence, network, runtime.workbookId]);
  const saveBlockedReason = analysisSaveBlock(runtime);
  const { sourceEpoch } = useAnalysisSourceGuard("esq", runtime.workbookId);
  const baseEvidence = configurations.map((candidate) => [candidate.bayesianNetwork.modelId, candidate.baseEvidence]);
  const inputKey = stringifyJson([sourceEpoch, runtime.workbookId, networks, network?.modelId, evidenceByModel, queryByModel, baseEvidence]);
  const analysis = useAnalysisScope(inputKey ?? "", () => {
    setResults({});
    setBatchResults({});
    setRunningModelId(null);
    setRunError(null);
  });

  function addNetwork(added: EsqBayesianNetwork): void {
    mutateEsq((current) => ({ ...current, bayesianNetworks: [...current.bayesianNetworks, added] }));
    onNetwork(added.modelId);
  }

  function replaceNetwork(next: BayesianNetworkModel): void {
    analysis.invalidate();
    mutateEsq((current) => ({
      ...current,
      bayesianNetworks: current.bayesianNetworks.map((candidate) => (candidate.modelId === next.modelId ? { ...candidate, ...next } : candidate)),
    }));
  }

  function removeNetwork(): void {
    if (network === undefined) return;
    const using = configurations.filter((candidate) => candidate.bayesianNetwork.modelId === network.modelId).length;
    const linked = nodeLinkCount(esq, network.modelId);
    const links = linked === 0 ? "" : ` ${String(linked)} function link${linked === 1 ? "" : "s"} in Step 02 will lose ${linked === 1 ? "its node" : "their nodes"}.`;
    requestConfirmation({
      title: `Delete ${network.code}?`,
      message: `${String(using)} dependency configuration${using === 1 ? "" : "s"} using this network will also be removed.${links}`,
      confirmLabel: "Delete network",
      tone: "danger",
    }, () => {
      mutateEsq((current) => ({
        ...current,
        bayesianNetworks: current.bayesianNetworks.filter((candidate) => candidate.modelId !== network.modelId),
        hclConfigurations: current.hclConfigurations.filter((candidate) => candidate.bayesianNetwork.modelId !== network.modelId),
      }));
      onNetwork("");
    });
  }

  function replaceEvidence(next: BayesianNetworkEvidenceConfiguration): void {
    if (network === undefined) return;
    setEvidenceByModel((current) => ({ ...current, [network.modelId]: next }));
    analysis.invalidate();
    if (configuration === undefined) return;
    mutateEsq((current) => ({
      ...current,
      hclConfigurations: current.hclConfigurations.map((candidate) => (candidate.bayesianNetwork.modelId === network.modelId ? { ...candidate, baseEvidence: next } : candidate)),
    }));
  }

  function changeConfigurations(next: EsqHclConfiguration[]): void {
    mutateEsq((current) => ({ ...current, hclConfigurations: next }));
  }

  async function queryResult(modelId: string, nodeId: string, workbookId: string, revision: number): Promise<BayesianNetworkAnalysisResult> {
    const execution = await runEsqBayesianNetwork(workbookId, modelId, revision, evidence, nodeId);
    if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? "The inference did not finish.");
    return getEsqBayesianNetworkResult(workbookId, modelId, execution.run.id);
  }

  async function queryBatchResult(modelId: string, nodeId: string, workbookId: string, revision: number, scenarios: HclEvidenceScenario[]): Promise<BayesianNetworkQueryBatchResult> {
    const execution = await runEsqBayesianNetworkBatch(workbookId, modelId, revision, scenarios, nodeId);
    if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? "The inference did not finish.");
    const result = await getEsqBayesianNetworkBatchResult(workbookId, modelId, execution.run.id);
    return { queryNodeId: nodeId, scenarios: result.scenarios };
  }

  function run(scenarios?: HclEvidenceScenario[]): void {
    if (saveBlockedReason !== null) {
      setRunError(saveBlockedReason);
      return;
    }
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (network === undefined || queryNodeId === null || workbookId === null || revision === null) return;
    const issue = validation.find((candidate) => candidate.severity === "ERROR" && !candidate.code.startsWith("BN_HCL_"));
    if (issue !== undefined) {
      setRunError(issue.message);
      return;
    }
    analysis.invalidate();
    const isCurrent = analysis.capture();
    const modelId = network.modelId;
    setRunningModelId(modelId);
    setRunError(null);
    const started = scenarios === undefined
      ? queryResult(modelId, queryNodeId, workbookId, revision).then((result) => { if (isCurrent()) setResults((current) => ({ ...current, [modelId]: result })); })
      : queryBatchResult(modelId, queryNodeId, workbookId, revision, scenarios).then((result) => { if (isCurrent()) setBatchResults((current) => ({ ...current, [modelId]: result })); });
    started
      .catch((caught: Error) => { if (isCurrent()) setRunError(caught.message); })
      .finally(() => { if (isCurrent()) setRunningModelId(null); });
  }

  return (
    <div className="esq-dep" role="region" aria-label="Dependency network">
      <div className="posrow esq-dep__networks">
        {network !== undefined && (
          <select aria-label="Dependency network" className="posfield__select" value={network.modelId} onChange={(event) => onNetwork(event.target.value)}>
            {networks.map((candidate) => <option key={candidate.modelId} value={candidate.modelId}>{`${candidate.code} · ${candidate.name}`}</option>)}
          </select>
        )}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addNetwork(createEmptyBayesianNetwork("Dependency network"))}>Add network</button>}
        {editable && network !== undefined && <button type="button" className="posnav__btn posnav__btn--sm bneditor__network-delete" onClick={removeNetwork}>Delete network</button>}
      </div>
      {network !== undefined && (
        <BayesianNetworkEditor
          model={network}
          editable={editable}
          saveBlockedReason={analysisSaveNotice(runtime)}
          saving={runtime.saveStatus === "saving"}
          onAnalysisInputChange={analysis.invalidate}
          evidence={evidence}
          queryNodeId={queryNodeId}
          validation={validation}
          analysisResult={results[network.modelId] ?? null}
          queryBatchResult={batchResults[network.modelId] ?? null}
          running={runningModelId === network.modelId}
          runError={runError}
          workbookId={runtime.workbookId}
          hclConfigurations={configurations}
          faultTreeOptions={faultTreeOptions}
          onModelChange={replaceNetwork}
          onModelImport={addNetwork}
          onEvidenceChange={replaceEvidence}
          onQueryNodeChange={(next) => {
            analysis.invalidate();
            setQueryByModel((current) => ({ ...current, [network.modelId]: next }));
          }}
          onHclConfigurationsChange={changeConfigurations}
          onRun={() => run()}
          onRunBatch={run}
          onBuildFromSpecification={buildBayesianNetworkFromSpecification}
        />
      )}
      {confirmationDialog}
    </div>
  );
}

export { EsqDependencyNetwork, configurationOf, useDependencyFaultTrees };
