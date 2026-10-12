import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import type { WorkbookBayesianNetwork, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { FUNCTIONAL_EVENT_MODEL_ID, functionalEventBindingId, unlinkedFunctionalEvents } from "interfaces-mef-types/es/es-dependency-bindings";
import { validateBayesianNetworkModel, type BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkEditor, createEmptyBayesianNetwork, type BayesianNetworkFaultTreeOption } from "../newly-developed-methods/bayesian-network";
import { useEditorConfirmation } from "../newly-developed-methods/shared";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { coverageView } from "./esSelectors";
import { useEsWorkbook } from "./esWorkbookContext";

function systemFaultTreeOptions(workbookId: string, sy: SystemsAnalysis): BayesianNetworkFaultTreeOption[] {
  return sy.systemLogicModels.map((logic) => {
    const used = new Set(logic.leafNodes.flatMap((leaf) => (leaf.kind === "BASIC_EVENT_REFERENCE" ? [leaf.basicEventId] : [])));
    return {
      workbookId,
      workbookName: sy.name,
      modelId: logic.uuid,
      modelCode: logic.code,
      modelName: logic.name,
      topGateId: logic.topGate?.gateId ?? null,
      basicEvents: sy.systemBasicEvents.filter((event) => used.has(event.uuid)).map((event) => ({ id: event.uuid, code: event.code, name: event.name })),
    };
  });
}

function DependenciesScreen(): JSX.Element {
  const { es, upstream, posLink, ieLink, editable, mutateEs, runtime } = useEsWorkbook();
  const networks = es.dependencyBayesianNetworks ?? [];
  const configurations = es.dependencyHclConfigurations ?? [];
  const [selectedModelId, setSelectedModelId] = useState(networks[0]?.modelId ?? "");
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const model = networks.find((candidate) => candidate.modelId === selectedModelId) ?? networks[0];
  const relevant = useMemo(() => (model === undefined ? [] : configurations.filter((configuration) =>
    configuration.bayesianNetwork.modelId === model.modelId
    && (runtime.workbookId === null || configuration.bayesianNetwork.workbookId === runtime.workbookId))), [configurations, model, runtime.workbookId]);
  const evidence = relevant[0]?.baseEvidence ?? { observations: [] };
  const syWorkbookId = es.linkedWorkbooks?.SY;
  const sy = upstream?.sy;
  const coverage = useMemo(() => coverageView(es, posLink, ieLink), [es, posLink, ieLink]);
  const scopeChoices = useMemo(() => ({ initiatingEvents: coverage.groups, plantOperatingStates: coverage.states }), [coverage]);

  const [fetchedSy, setFetchedSy] = useState<ReadonlyMap<string, SystemsAnalysis>>(new Map());
  const requestedSy = useRef(new Set<string>());
  const referencedSyIds = useMemo(() => [...new Set((es.dependencyHclConfigurations ?? []).flatMap((configuration) => [
    ...configuration.faultTrees.map((reference) => reference.workbookId),
    ...configuration.bindings.map((binding) => binding.faultTreeBasicEvent.workbookId),
  ]))].filter((workbookId) => workbookId.length > 0 && workbookId !== runtime.workbookId), [es.dependencyHclConfigurations, runtime.workbookId]);

  useEffect(() => {
    for (const workbookId of referencedSyIds) {
      if ((workbookId === syWorkbookId && sy !== undefined) || requestedSy.current.has(workbookId)) continue;
      requestedSy.current.add(workbookId);
      getSyWorkbook(workbookId)
        .then((workbook) => setFetchedSy((current) => new Map(current).set(workbookId, workbook.mef)))
        .catch(() => undefined);
    }
  }, [referencedSyIds, sy, syWorkbookId]);

  const faultTreeOptions = useMemo<BayesianNetworkFaultTreeOption[]>(() => {
    const systemOptions = sy === undefined || syWorkbookId === undefined ? [] : systemFaultTreeOptions(syWorkbookId, sy);
    const functionalEvents = unlinkedFunctionalEvents(es.eventTrees ?? []);
    if (runtime.workbookId === null || functionalEvents.length === 0) return systemOptions;
    return [...systemOptions, {
      workbookId: runtime.workbookId,
      workbookName: es.name,
      modelId: FUNCTIONAL_EVENT_MODEL_ID,
      modelCode: "Functional events",
      modelName: "Functional events without a fault tree",
      topGateId: null,
      basicEvents: functionalEvents.map((event) => ({ id: functionalEventBindingId(event.uuid), code: event.label ?? event.name, name: event.name })),
    }];
  }, [es.eventTrees, es.name, runtime.workbookId, sy, syWorkbookId]);

  const referencedFaultTrees = useMemo<BayesianNetworkFaultTreeOption[]>(() => {
    const fetched = [...fetchedSy].flatMap(([workbookId, mef]) => systemFaultTreeOptions(workbookId, mef));
    if (runtime.workbookId === null) return fetched;
    const functionalEvents = [...new Map((es.eventTrees ?? []).flatMap((tree) => Object.values(tree.functionalEvents)).map((event) => [event.uuid, event])).values()];
    return [...fetched, {
      workbookId: runtime.workbookId,
      workbookName: es.name,
      modelId: FUNCTIONAL_EVENT_MODEL_ID,
      modelCode: "Functional events",
      modelName: "Functional events",
      topGateId: null,
      basicEvents: functionalEvents.map((event) => ({ id: functionalEventBindingId(event.uuid), code: event.label ?? event.name, name: event.name })),
    }];
  }, [es.eventTrees, es.name, fetchedSy, runtime.workbookId]);

  const syBindingLabels = useMemo(() => new Map((sy?.dependencyHclConfigurations ?? []).flatMap((configuration) =>
    configuration.bindings.map((binding) => [
      `${binding.faultTreeBasicEvent.workbookId}:${binding.faultTreeBasicEvent.entityId}`,
      `SY ${configuration.code}`,
    ] as const))), [sy]);

  useEffect(() => {
    if (model !== undefined && model.modelId !== selectedModelId) setSelectedModelId(model.modelId);
  }, [model, selectedModelId]);

  const validation = model === undefined ? [] : validateBayesianNetworkModel(model, {
    evidence,
    hclBindings: relevant.flatMap((configuration) => configuration.bindings),
    ...(runtime.workbookId === null ? {} : { workbookId: runtime.workbookId }),
  });

  function createNetwork(): void {
    if (!editable) return;
    const created = createEmptyBayesianNetwork("Dependency network") as WorkbookBayesianNetwork;
    mutateEs((current) => ({ ...current, dependencyBayesianNetworks: [...(current.dependencyBayesianNetworks ?? []), created] }));
    setSelectedModelId(created.modelId);
  }

  function replaceNetwork(next: BayesianNetworkModel): void {
    mutateEs((current) => ({
      ...current,
      dependencyBayesianNetworks: (current.dependencyBayesianNetworks ?? []).map((candidate) => (candidate.modelId === next.modelId ? next as WorkbookBayesianNetwork : candidate)),
    }));
  }

  function changeConfigurations(next: WorkbookHclConfiguration[]): void {
    mutateEs((current) => ({ ...current, dependencyHclConfigurations: next }));
  }

  function removeNetwork(): void {
    if (model === undefined) return;
    requestConfirmation({
      title: `Delete ${model.code}?`,
      message: `${String(relevant.length)} HCL configuration${relevant.length === 1 ? "" : "s"} using this network will also be removed.`,
      confirmLabel: "Delete network",
      tone: "danger",
    }, () => {
      mutateEs((current) => ({
        ...current,
        dependencyBayesianNetworks: (current.dependencyBayesianNetworks ?? []).filter((candidate) => candidate.modelId !== model.modelId),
        dependencyHclConfigurations: (current.dependencyHclConfigurations ?? []).filter((configuration) => configuration.bayesianNetwork.modelId !== model.modelId),
      }));
      setSelectedModelId("");
    });
  }

  return (
    <section className="poscard" aria-label="Event sequence dependency networks">
      <div className="poscard__head bneditor__network-head">
        <WorkbookSectionHeading workbook="ES" title="Bayesian dependency network" level={3} />
        <div className="posrow esqbn__network-actions" style={{ gap: 8 }}>
          {model !== undefined && (
            <select aria-label="Bayesian network" className="posfield__select" value={model.modelId} onChange={(event) => setSelectedModelId(event.target.value)}>
              {networks.map((candidate) => <option key={candidate.modelId} value={candidate.modelId}>{candidate.code} · {candidate.name}</option>)}
            </select>
          )}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createNetwork}>Add network</button>}
          {editable && model !== undefined && <button type="button" className="posnav__btn posnav__btn--sm bneditor__network-delete" onClick={removeNetwork}>Delete network</button>}
        </div>
      </div>
      {model === undefined ? <p className="posmuted">No dependency network yet.</p> : (
        <BayesianNetworkEditor
          model={model}
          editable={editable}
          hclSetupOnly
          hclScopeChoices={scopeChoices}
          hclExternalBindingLabels={syBindingLabels}
          hclReferencedFaultTrees={referencedFaultTrees}
          showQueryAnalysis={false}
          hclScope="BOTH"
          evidence={evidence}
          queryNodeId={model.nodes[0]?.id ?? null}
          validation={validation}
          analysisResult={null}
          running={false}
          runError={null}
          workbookId={runtime.workbookId}
          hclConfigurations={configurations}
          faultTreeOptions={faultTreeOptions}
          eventTreeOptions={[]}
          hclRunning={false}
          hclRunError={null}
          hclRunResult={null}
          hclBatchRunResult={null}
          onModelChange={replaceNetwork}
          onEvidenceChange={() => undefined}
          onQueryNodeChange={() => undefined}
          onHclConfigurationsChange={changeConfigurations}
          onRunHclFaultTree={() => undefined}
          onRunHclEventTree={() => undefined}
          onRunHclFaultTreeBatch={() => undefined}
          onRunHclEventTreeBatch={() => undefined}
          onRun={() => undefined}
        />
      )}
      {confirmationDialog}
    </section>
  );
}

export { DependenciesScreen };
