import { type JSX, useEffect, useMemo, useState } from "react";
import type { EsqBayesianNetwork } from "interfaces-mef-types/esq/workbook-models";
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
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { listWorkbooks } from "../workbooks/workbookApi";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { getEsqBayesianNetworkResult, runEsqBayesianNetwork } from "./esqWorkbookApi";

function EsqBayesianNetworkWorkspace(): JSX.Element {
  const { esq, editable, mutateEsq, runtime } = useEsqWorkbook();
  const [selectedModelId, setSelectedModelId] = useState(esq.bayesianNetworks[0]?.modelId ?? "");
  const [evidenceByModel, setEvidenceByModel] = useState<Record<string, BayesianNetworkEvidenceConfiguration>>({});
  const [queryByModel, setQueryByModel] = useState<Record<string, string | null>>({});
  const [results, setResults] = useState<Record<string, BayesianNetworkAnalysisResult>>({});
  const [runningModelId, setRunningModelId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [faultTreeOptions, setFaultTreeOptions] = useState<BayesianNetworkFaultTreeOption[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const model = esq.bayesianNetworks.find((candidate) => candidate.modelId === selectedModelId)
    ?? esq.bayesianNetworks[0];
  const evidence = model === undefined
    ? { observations: [] }
    : (evidenceByModel[model.modelId] ?? { observations: [] });
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
      return () => { cancelled = true; };
    }
    setSourceError(null);
    listWorkbooks(runtime.projectId, "SY")
      .then(async ({ workbooks }) => Promise.all(workbooks.map(async (workbook) => ({
        workbook,
        source: await getSyWorkbook(workbook.id),
      }))))
      .then((sources) => {
        if (cancelled) return;
        setFaultTreeOptions(sources.flatMap(({ workbook, source }) =>
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
              basicEvents: source.mef.systemBasicEvents
                .filter((event) => usedEventIds.has(event.uuid))
                .map((event) => ({ id: event.uuid, code: event.code, name: event.name })),
            };
          }),
        ));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFaultTreeOptions([]);
        setSourceError(error instanceof Error ? error.message : "Could not load Systems Analysis fault trees.");
      });
    return () => { cancelled = true; };
  }, [runtime.projectId]);

  const relevantConfigurations = useMemo(
    () => model === undefined
      ? []
      : esq.hclConfigurations.filter((configuration) => configuration.bayesianNetwork.modelId === model.modelId),
    [esq.hclConfigurations, model],
  );
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
    mutateEsq((draft) => ({
      ...draft,
      bayesianNetworks: draft.bayesianNetworks.map((candidate) =>
        candidate.modelId === next.modelId ? next as EsqBayesianNetwork : candidate,
      ),
    }));
    setResults((current) => {
      const { [next.modelId]: _stale, ...remaining } = current;
      return remaining;
    });
  }

  function removeNetwork(): void {
    if (model === undefined) return;
    const useCount = relevantConfigurations.length;
    if (!window.confirm(`Delete ${model.code}? ${String(useCount)} HCL configuration${useCount === 1 ? "" : "s"} using it will also be removed.`)) return;
    mutateEsq((draft) => ({
      ...draft,
      bayesianNetworks: draft.bayesianNetworks.filter((candidate) => candidate.modelId !== model.modelId),
      hclConfigurations: draft.hclConfigurations.filter((configuration) => configuration.bayesianNetwork.modelId !== model.modelId),
    }));
    setSelectedModelId("");
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
    }
  }

  return (
    <div className="poscard" aria-label="Bayesian-network dependency model">
      <div className="poscard__head">
        <div>
          <WorkbookSectionHeading workbook="ESQ" title="Bayesian dependency network" level={3} />
          <p className="poscard__sub">Build discrete dependencies, query exact posteriors, and bind fault-tree events to causal states.</p>
        </div>
        <div className="posrow" style={{ gap: 8 }}>
          {model !== undefined && (
            <select aria-label="Bayesian network" className="posfield__select" value={model.modelId} onChange={(event) => setSelectedModelId(event.target.value)}>
              {esq.bayesianNetworks.map((candidate) => <option key={candidate.modelId} value={candidate.modelId}>{candidate.code} · {candidate.name}</option>)}
            </select>
          )}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createNetwork}>Add network</button>}
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
          onModelChange={replaceNetwork}
          onEvidenceChange={(next) => setEvidenceByModel((current) => ({ ...current, [model.modelId]: next }))}
          onQueryNodeChange={(nodeId) => setQueryByModel((current) => ({ ...current, [model.modelId]: nodeId }))}
          onHclConfigurationsChange={(configurations) => mutateEsq((draft) => ({ ...draft, hclConfigurations: configurations }))}
          onRun={() => { void run(); }}
        />
      )}
    </div>
  );
}

export { EsqBayesianNetworkWorkspace };
