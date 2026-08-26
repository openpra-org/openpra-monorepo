import { type JSX, useEffect, useMemo, useState } from "react";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkAnalysisResult,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  BayesianNetworkEditor,
  createEmptyBayesianNetwork,
  type BayesianNetworkFaultTreeOption,
} from "../newly-developed-methods/bayesian-network";
import type {
  HclEditorRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
} from "../newly-developed-methods/hybrid-causal-logic";
import type { AnalysisRunProvenance } from "interfaces-shared-types/newly-developed-methods";
import { useEditorConfirmation } from "../newly-developed-methods/shared";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { listWorkbooks } from "../workbooks/workbookApi";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  getEsqAnalysisRunProvenance,
  getEsqBayesianNetworkResult,
  getEsqHclEventTreeResult,
  getEsqHclFaultTreeResult,
  runEsqBayesianNetwork,
  runEsqHclEventTree,
  runEsqHclFaultTree,
} from "./esqWorkbookApi";
import { EsqAnalysisRunProvenance } from "./esqAnalysisRunProvenance";

function EsqBayesianNetworkWorkspace(): JSX.Element {
  const { esq, editable, mutateEsq, runtime } = useEsqWorkbook();
  const [selectedModelId, setSelectedModelId] = useState(esq.bayesianNetworks[0]?.modelId ?? "");
  const [evidenceByModel, setEvidenceByModel] = useState<Record<string, BayesianNetworkEvidenceConfiguration>>({});
  const [queryByModel, setQueryByModel] = useState<Record<string, string | null>>({});
  const [results, setResults] = useState<Record<string, BayesianNetworkAnalysisResult>>({});
  const [runningModelId, setRunningModelId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [faultTreeOptions, setFaultTreeOptions] = useState<BayesianNetworkFaultTreeOption[]>([]);
  const [eventTreeOptions, setEventTreeOptions] = useState<HclEventTreeOption[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [hclResults, setHclResults] = useState<Record<string, HclEditorRunResult>>({});
  const [runningHclConfigurationId, setRunningHclConfigurationId] = useState<string | null>(null);
  const [hclRunError, setHclRunError] = useState<string | null>(null);
  const [provenanceRuns, setProvenanceRuns] = useState<AnalysisRunProvenance[]>([]);
  const [provenanceLoading, setProvenanceLoading] = useState(false);
  const [provenanceError, setProvenanceError] = useState<string | null>(null);
  const [provenanceRefresh, setProvenanceRefresh] = useState(0);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const model = esq.bayesianNetworks.find((candidate) => candidate.modelId === selectedModelId)
    ?? esq.bayesianNetworks[0];
  const relevantConfigurations = useMemo(
    () => model === undefined
      ? []
      : esq.hclConfigurations.filter((configuration) => configuration.bayesianNetwork.modelId === model.modelId),
    [esq.hclConfigurations, model],
  );
  const evidence = model === undefined
    ? { observations: [] }
    : (evidenceByModel[model.modelId] ?? relevantConfigurations[0]?.baseEvidence ?? { observations: [] });
  const queryNodeId = model === undefined
    ? null
    : (queryByModel[model.modelId] ?? model.nodes[0]?.id ?? null);

  useEffect(() => {
    if (model !== undefined && model.modelId !== selectedModelId) setSelectedModelId(model.modelId);
  }, [model, selectedModelId]);

  useEffect(() => {
    let cancelled = false;
    if (runtime.projectId === null) {
      setFaultTreeOptions([]);
      setEventTreeOptions([]);
      return () => { cancelled = true; };
    }
    setSourceError(null);
    Promise.all([
      listWorkbooks(runtime.projectId, "SY").then(async ({ workbooks }) => Promise.all(workbooks.map(async (workbook) => ({
          workbook,
          source: await getSyWorkbook(workbook.id),
        })))),
      listWorkbooks(runtime.projectId, "ES").then(async ({ workbooks }) => Promise.all(workbooks.map(async (workbook) => ({
          workbook,
          source: await getEsWorkbook(workbook.id),
        })))),
    ])
      .then(([systemSources, eventSequenceSources]) => {
        if (cancelled) return;
        setFaultTreeOptions(systemSources.flatMap(({ workbook, source }) =>
          source.mef.systemLogicModels.map((logic) => {
            const usedEventIds = new Set(logic.leafNodes.flatMap((leaf) =>
              leaf.kind === "BASIC_EVENT_REFERENCE" ? [leaf.basicEventId] : [],
            ));
            return {
              workbookId: workbook.id,
              workbookName: workbook.name,
              modelId: logic.uuid,
              modelCode: logic.code,
              modelName: logic.name,
              topGateId: logic.topGate?.gateId ?? null,
              basicEvents: source.mef.systemBasicEvents
                .filter((event) => usedEventIds.has(event.uuid))
                .map((event) => ({ id: event.uuid, code: event.code, name: event.name })),
            };
          }),
        ));
        setEventTreeOptions(eventSequenceSources.flatMap(({ workbook, source }) =>
          (source.mef.eventTrees ?? [])
            .filter((tree) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tree.uuid))
            .map((tree) => ({
              workbookId: workbook.id,
              workbookName: workbook.name,
              modelId: tree.uuid,
              modelName: tree.name,
              sequences: Object.values(tree.sequences).map((sequence) => ({ id: sequence.uuid, name: sequence.name })),
              faultTrees: [...new Map(Object.values(tree.functionalEvents).flatMap((functionalEvent) => {
                const reference = functionalEvent.faultTreeTopEvent;
                return reference === undefined
                  ? []
                  : [[`${reference.workbookId}:${reference.modelId}`, {
                      workbookId: reference.workbookId,
                      modelId: reference.modelId,
                    }] as const];
              })).values()],
            })),
        ));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFaultTreeOptions([]);
        setEventTreeOptions([]);
        setSourceError(error instanceof Error ? error.message : "Could not load the linked fault-tree and event-tree models.");
      });
    return () => { cancelled = true; };
  }, [runtime.projectId]);

  useEffect(() => {
    let cancelled = false;
    if (runtime.workbookId === null) {
      setProvenanceRuns([]);
      setProvenanceLoading(false);
      setProvenanceError(null);
      return () => { cancelled = true; };
    }
    setProvenanceLoading(true);
    setProvenanceError(null);
    getEsqAnalysisRunProvenance(runtime.workbookId)
      .then((response) => {
        if (!cancelled) setProvenanceRuns(response.runs);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProvenanceRuns([]);
          setProvenanceError(error instanceof Error ? error.message : "Could not load immutable analysis runs.");
        }
      })
      .finally(() => {
        if (!cancelled) setProvenanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [provenanceRefresh, runtime.workbookId]);

  const validation = model === undefined
    ? []
    : validateBayesianNetworkModel(model, {
        evidence,
        hclBindings: relevantConfigurations.flatMap((configuration) => configuration.bindings),
        ...(runtime.workbookId === null ? {} : { workbookId: runtime.workbookId }),
      });

  function createNetwork(): void {
    const created = createEmptyBayesianNetwork();
    mutateEsq((draft) => ({ ...draft, bayesianNetworks: [...draft.bayesianNetworks, created] }));
    setSelectedModelId(created.modelId);
  }

  function replaceNetwork(next: BayesianNetworkModel): void {
    const statesByNode = new Map(next.nodes.map((node) => [node.id, new Set(node.states.map((state) => state.id))]));
    const sanitizedEvidence = {
      observations: evidence.observations.filter((observation) => statesByNode.get(observation.nodeId)?.has(observation.stateId) === true),
    };
    mutateEsq((draft) => ({
      ...draft,
      bayesianNetworks: draft.bayesianNetworks.map((candidate) =>
        candidate.modelId === next.modelId ? next as EsqBayesianNetwork : candidate,
      ),
      hclConfigurations: draft.hclConfigurations.map((configuration) =>
        configuration.bayesianNetwork.modelId === next.modelId
          ? { ...configuration, baseEvidence: sanitizedEvidence }
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
    const useCount = relevantConfigurations.length;
    requestConfirmation({
      title: `Delete ${model.code}?`,
      message: `${String(useCount)} HCL configuration${useCount === 1 ? "" : "s"} using this network will also be removed.`,
      confirmLabel: "Delete network",
      tone: "danger",
    }, () => {
      mutateEsq((draft) => ({
        ...draft,
        bayesianNetworks: draft.bayesianNetworks.filter((candidate) => candidate.modelId !== model.modelId),
        hclConfigurations: draft.hclConfigurations.filter((configuration) => configuration.bayesianNetwork.modelId !== model.modelId),
      }));
      setSelectedModelId("");
    });
  }

  async function run(): Promise<void> {
    if (model === undefined || queryNodeId === null || runtime.workbookId === null || runtime.revision === null) {
      setRunError("Exact inference is available after this ESQ workbook has been saved.");
      return;
    }
    const errorIssue = validation.find((issue) => issue.severity === "ERROR" && !issue.code.startsWith("BN_HCL_"));
    if (errorIssue !== undefined) {
      setRunError(errorIssue.message);
      return;
    }
    setRunningModelId(model.modelId);
    setRunError(null);
    try {
      const execution = await runEsqBayesianNetwork(
        runtime.workbookId,
        model.modelId,
        runtime.revision,
        evidence,
        queryNodeId,
      );
      if (execution.run.status === "FAILED") throw new Error(execution.run.failure?.message ?? "Bayesian-network inference failed.");
      if (execution.run.status !== "SUCCEEDED") throw new Error(`Inference did not complete (status: ${execution.run.status}).`);
      const result = await getEsqBayesianNetworkResult(runtime.workbookId, model.modelId, execution.run.id);
      setResults((current) => ({ ...current, [model.modelId]: result }));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Bayesian-network inference failed.");
    } finally {
      setRunningModelId(null);
      setProvenanceRefresh((current) => current + 1);
    }
  }

  function replaceEvidence(next: BayesianNetworkEvidenceConfiguration): void {
    if (model === undefined) return;
    setEvidenceByModel((current) => ({ ...current, [model.modelId]: next }));
    setResults((current) => {
      const { [model.modelId]: _stale, ...remaining } = current;
      return remaining;
    });
    if (relevantConfigurations.length === 0) return;
    mutateEsq((draft) => ({
      ...draft,
      hclConfigurations: draft.hclConfigurations.map((configuration) =>
        configuration.bayesianNetwork.modelId === model.modelId
          ? { ...configuration, baseEvidence: next }
          : configuration,
      ),
    }));
  }

  async function runHclFaultTree(configuration: EsqHclConfiguration, faultTree: HclFaultTreeOption): Promise<void> {
    if (runtime.workbookId === null || runtime.revision === null || faultTree.topGateId === null) {
      setHclRunError("HCL quantification is available after the workbooks and top event have been saved.");
      return;
    }
    setRunningHclConfigurationId(configuration.modelId);
    setHclRunError(null);
    try {
      const execution = await runEsqHclFaultTree(runtime.workbookId, configuration.modelId, runtime.revision, {
        referenceType: "FAULT_TREE_TOP_EVENT",
        workbookId: faultTree.workbookId,
        modelId: faultTree.modelId,
        entityId: faultTree.topGateId,
      });
      if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? `HCL quantification did not complete (${execution.run.status}).`);
      const result = await getEsqHclFaultTreeResult(runtime.workbookId, configuration.modelId, execution.run.id);
      setHclResults((current) => ({ ...current, [configuration.modelId]: { kind: "FAULT_TREE", result } }));
    } catch (error) {
      setHclRunError(error instanceof Error ? error.message : "HCL fault-tree quantification failed.");
    } finally {
      setRunningHclConfigurationId(null);
      setProvenanceRefresh((current) => current + 1);
    }
  }

  async function runHclEventTree(configuration: EsqHclConfiguration, eventTree: HclEventTreeOption): Promise<void> {
    if (runtime.workbookId === null || runtime.revision === null) {
      setHclRunError("HCL quantification is available after the workbooks have been saved.");
      return;
    }
    setRunningHclConfigurationId(configuration.modelId);
    setHclRunError(null);
    try {
      const execution = await runEsqHclEventTree(runtime.workbookId, configuration.modelId, runtime.revision, {
        workbookId: eventTree.workbookId,
        modelId: eventTree.modelId,
      });
      if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? `HCL quantification did not complete (${execution.run.status}).`);
      const result = await getEsqHclEventTreeResult(runtime.workbookId, configuration.modelId, execution.run.id);
      setHclResults((current) => ({ ...current, [configuration.modelId]: { kind: "EVENT_TREE", result } }));
    } catch (error) {
      setHclRunError(error instanceof Error ? error.message : "HCL event-tree quantification failed.");
    } finally {
      setRunningHclConfigurationId(null);
      setProvenanceRefresh((current) => current + 1);
    }
  }

  return (
    <>
      <div className="poscard" aria-label="Bayesian-network dependency model">
      <div className="poscard__head">
        <div>
          <WorkbookSectionHeading workbook="ESQ" title="Bayesian dependency network" level={3} />
          <p className="poscard__sub">Build discrete dependencies, query exact posteriors, and bind fault-tree events to causal states.</p>
        </div>
        <div className="posrow esqbn__network-actions" style={{ gap: 8 }}>
          {model !== undefined && (
            <select aria-label="Bayesian network" className="posfield__select" value={model.modelId} onChange={(event) => setSelectedModelId(event.target.value)}>
              {esq.bayesianNetworks.map((candidate) => <option key={candidate.modelId} value={candidate.modelId}>{candidate.code} · {candidate.name}</option>)}
            </select>
          )}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createNetwork}><span className="esqbn__add-icon" aria-hidden="true">+</span>Add network</button>}
          {editable && model !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeNetwork}>Delete network</button>}
        </div>
      </div>
      {sourceError !== null && <p className="pws-status pws-status--error">{sourceError}</p>}
      {model === undefined ? (
        <div className="eswarn"><span>No Bayesian network exists in this ESQ workbook yet.</span></div>
      ) : (
        <BayesianNetworkEditor
          model={model}
          editable={editable}
          evidence={evidence}
          queryNodeId={queryNodeId}
          validation={validation}
          analysisResult={results[model.modelId] ?? null}
          running={runningModelId === model.modelId}
          runError={runError}
          workbookId={runtime.workbookId}
          hclConfigurations={esq.hclConfigurations}
          faultTreeOptions={faultTreeOptions}
          eventTreeOptions={eventTreeOptions}
          hclRunning={relevantConfigurations.some((configuration) => configuration.modelId === runningHclConfigurationId)}
          hclRunError={hclRunError}
          hclRunResult={relevantConfigurations.length === 0 ? null : (hclResults[relevantConfigurations[0]!.modelId] ?? null)}
          onModelChange={replaceNetwork}
          onEvidenceChange={replaceEvidence}
          onQueryNodeChange={(nodeId) => setQueryByModel((current) => ({ ...current, [model.modelId]: nodeId }))}
          onHclConfigurationsChange={(configurations) => mutateEsq((draft) => ({ ...draft, hclConfigurations: configurations }))}
          onRunHclFaultTree={(configuration, faultTree) => { void runHclFaultTree(configuration, faultTree); }}
          onRunHclEventTree={(configuration, eventTree) => { void runHclEventTree(configuration, eventTree); }}
          onRun={() => { void run(); }}
        />
      )}
        {confirmationDialog}
      </div>
      <EsqAnalysisRunProvenance
        runs={provenanceRuns}
        loading={provenanceLoading}
        error={provenanceError}
      />
    </>
  );
}

export { EsqBayesianNetworkWorkspace };
