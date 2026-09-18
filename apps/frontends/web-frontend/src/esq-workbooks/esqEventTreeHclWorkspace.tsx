import { stringifyJson } from "interfaces-shared-types/json";
import { useAnalysisSourceGuard } from "../newly-developed-methods/shared/useAnalysisSourceGuard";
import { hclEventTreeResultMetadata } from "../newly-developed-methods/hybrid-causal-logic/hclResultLabels";
import { type JSX, useEffect, useMemo, useState } from "react";
import type { EsqBayesianNetwork } from "interfaces-mef-types/esq/workbook-models";
import type {
  BayesianNetworkEvidenceConfiguration,
  WorkbookBayesianNetwork,
  WorkbookHclConfiguration,
} from "interfaces-mef-types/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  BayesianNetworkEditor,
  createEmptyBayesianNetwork,
} from "../newly-developed-methods/bayesian-network";
import type {
  HclEditorBatchRunResult,
  HclEditorRunResult,
  HclEditorScenarioRunResult,
  HclEventTreeOption,
  HclCalculationType,
  HclFaultTreeOption,
} from "../newly-developed-methods/hybrid-causal-logic";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { analysisSaveBlock, useAnalysisScope } from "../newly-developed-methods/shared/useAnalysisScope";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  getEsqHclEventTreeResult,
  runEsqHclEventTree,
  runEsqHclEventTreeBatch,
  generateEsqHclScenarios,
} from "./esqWorkbookApi";

type DependencyOwner = "SY" | "ESQ";

interface OwnedNetwork {
  owner: DependencyOwner;
  workbookId: string;
  workbookName: string;
  network: WorkbookBayesianNetwork;
}

interface OwnedConfiguration extends OwnedNetwork {
  configuration: WorkbookHclConfiguration;
}

interface EsqEventTreeHclWorkspaceProps {
  onRunComplete?: () => void;
  onNetworkAvailabilityChange?: (available: boolean) => void;
  initialNetworkId?: string | null;
  initialSourceWorkbookId?: string | null;
}

function connectedEventTreeModelIds(
  trees: ReadonlyArray<{ uuid: string; transfers?: Record<string, { targetEventTreeId: string }> }>,
  modelId: string,
): string[] {
  const byId = new Map(trees.map((tree) => [tree.uuid, tree]));
  const pending = [modelId];
  const seen = new Set<string>();
  const connected: string[] = [];
  while (pending.length > 0) {
    const currentId = pending.shift()!;
    if (seen.has(currentId)) continue;
    seen.add(currentId);
    const tree = byId.get(currentId);
    if (tree === undefined) continue;
    connected.push(currentId);
    Object.values(tree.transfers ?? {}).forEach((transfer) => pending.push(transfer.targetEventTreeId));
  }
  return connected;
}

function configurationFaultTreeKeys(configuration: WorkbookHclConfiguration): Set<string> {
  return new Set(
    configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`),
  );
}

function configurationMatchesEventTree(
  configuration: WorkbookHclConfiguration,
  eventTree: HclEventTreeOption,
): boolean {
  const configured = configurationFaultTreeKeys(configuration);
  return eventTree.faultTrees.some((reference) => configured.has(`${reference.workbookId}:${reference.modelId}`));
}

function EsqEventTreeHclWorkspace({
  onRunComplete,
  onNetworkAvailabilityChange,
  initialNetworkId = null,
  initialSourceWorkbookId = null,
}: EsqEventTreeHclWorkspaceProps): JSX.Element {
  const { esq, editable, mutateEsq, runtime } = useEsqWorkbook();
  const {sourceEpoch, sourceWarning} = useAnalysisSourceGuard("esq", runtime.workbookId);
  const [syNetworks, setSyNetworks] = useState<OwnedNetwork[]>([]);
  const [syConfigurations, setSyConfigurations] = useState<OwnedConfiguration[]>([]);
  const [faultTrees, setFaultTrees] = useState<HclFaultTreeOption[]>([]);
  const [eventTrees, setEventTrees] = useState<HclEventTreeOption[]>([]);
  const [configurationSelection, setConfigurationSelection] = useState<{
    workbookId: string | null;
    esqUuid: string;
    key: string;
  } | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<HclEditorRunResult | null>(null);
  const [batchRunResult, setBatchRunResult] = useState<HclEditorBatchRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (runtime.projectId === null) {
      setSyNetworks([]);
      setSyConfigurations([]);
      setFaultTrees([]);
      setEventTrees([]);
      setSourceLoading(false);
      return () => { cancelled = true; };
    }
    setSourceLoading(true);
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
    ]).then(([systemSources, eventSources]) => {
      if (cancelled) return;
      const options: HclFaultTreeOption[] = systemSources.flatMap(({ workbook, source }) =>
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
      );
      const optionByKey = new Map(options.map((option) => [`${option.workbookId}:${option.modelId}`, option]));
      setFaultTrees(options);
      setSyNetworks(systemSources.flatMap(({ workbook, source }) =>
        (source.mef.dependencyBayesianNetworks ?? []).map((network) => ({
          owner: "SY" as const,
          workbookId: workbook.id,
          workbookName: workbook.name,
          network,
        })),
      ));
      setSyConfigurations(systemSources.flatMap(({ workbook, source }) => {
        const networks = new Map((source.mef.dependencyBayesianNetworks ?? []).map((network) => [network.modelId, network]));
        return (source.mef.dependencyHclConfigurations ?? []).flatMap((configuration) => {
          const network = configuration.bayesianNetwork.workbookId === workbook.id
            ? networks.get(configuration.bayesianNetwork.modelId)
            : undefined;
          return network === undefined ? [] : [{
            owner: "SY" as const,
            workbookId: workbook.id,
            workbookName: workbook.name,
            configuration,
            network,
          }];
        });
      }));
      setEventTrees(eventSources.flatMap(({ workbook, source }) =>
        (source.mef.eventTrees ?? []).map((tree) => {
          const connectedIds = new Set(connectedEventTreeModelIds(source.mef.eventTrees ?? [], tree.uuid));
          const connectedTrees = (source.mef.eventTrees ?? []).filter((candidate) => connectedIds.has(candidate.uuid));
          const linkedByKey = new Map<string, NonNullable<HclEventTreeOption["linkedFaultTrees"]>[number]>();
          connectedTrees.forEach((connectedTree) => {
            Object.values(connectedTree.functionalEvents).forEach((functionalEvent) => {
              const reference = functionalEvent.faultTreeTopEvent;
              if (reference === undefined) return;
              const key = `${reference.workbookId}:${reference.modelId}`;
              const option = optionByKey.get(key);
              const current = linkedByKey.get(key);
              linkedByKey.set(key, {
                workbookId: reference.workbookId,
                workbookName: option?.workbookName ?? "Missing Systems Analysis workbook",
                modelId: reference.modelId,
                modelCode: option?.modelCode ?? reference.modelId,
                modelName: option?.modelName ?? "Unresolved fault tree",
                functionalEvents: [
                  ...(current?.functionalEvents ?? []),
                  {
                    id: functionalEvent.uuid,
                    code: functionalEvent.label ?? functionalEvent.name,
                    name: functionalEvent.name,
                    topGateId: reference.entityId,
                  },
                ],
              });
            });
          });
          const linkedFaultTrees = [...linkedByKey.values()];
          return {
            workbookId: workbook.id,
            workbookName: workbook.name,
            modelId: tree.uuid,
            modelCode: tree.label?.trim() || tree.name,
            modelName: tree.name,
            ...hclEventTreeResultMetadata(connectedTrees),
            faultTrees: linkedFaultTrees.map(({ workbookId, modelId }) => ({ workbookId, modelId })),
            linkedFaultTrees,
          };
        }),
      ));
    }).catch((error: unknown) => {
      if (!cancelled) {
        setSyNetworks([]);
        setSyConfigurations([]);
        setFaultTrees([]);
        setEventTrees([]);
        setSourceError(error instanceof Error ? error.message : "Could not load SY dependencies and ES event trees.");
      }
    }).finally(() => {
      if (!cancelled) setSourceLoading(false);
    });
    return () => { cancelled = true; };
  }, [runtime.projectId, sourceEpoch]);

  const localNetworks = useMemo<OwnedNetwork[]>(() => runtime.workbookId === null ? [] : esq.bayesianNetworks.map((network) => ({
    owner: "ESQ",
    workbookId: runtime.workbookId!,
    workbookName: "This ESQ workbook",
    network,
  })), [esq.bayesianNetworks, runtime.workbookId]);
  const localConfigurations = useMemo<OwnedConfiguration[]>(() => runtime.workbookId === null ? [] : esq.hclConfigurations.flatMap((configuration) => {
    const network = esq.bayesianNetworks.find((candidate) => candidate.modelId === configuration.bayesianNetwork.modelId);
    return network === undefined ? [] : [{
      owner: "ESQ",
      workbookId: runtime.workbookId!,
      workbookName: "This ESQ workbook",
      configuration,
      network,
    }];
  }), [esq.bayesianNetworks, esq.hclConfigurations, runtime.workbookId]);

  const matchingSyConfigurations = useMemo(() => syConfigurations.filter((candidate) =>
    eventTrees.some((eventTree) => configurationMatchesEventTree(candidate.configuration, eventTree)),
  ), [eventTrees, syConfigurations]);
  const matchingLocalConfigurations = useMemo(() => localConfigurations.filter((candidate) =>
    eventTrees.some((eventTree) => configurationMatchesEventTree(candidate.configuration, eventTree)),
  ), [eventTrees, localConfigurations]);
  const relevantConfigurations = [...matchingLocalConfigurations, ...matchingSyConfigurations];
  const configuredNetworkKeys = new Set(relevantConfigurations.map((candidate) =>
    `${candidate.owner}:${candidate.workbookId}:${candidate.network.modelId}`,
  ));
  const standaloneSyNetworks = syNetworks.filter((candidate) =>
    !configuredNetworkKeys.has(`${candidate.owner}:${candidate.workbookId}:${candidate.network.modelId}`),
  );
  const selectionBelongsToWorkbook = configurationSelection?.workbookId === runtime.workbookId
    && configurationSelection?.esqUuid === esq.uuid;
  const deepLinkedConfiguration = relevantConfigurations.find((candidate) =>
    candidate.network.modelId === initialNetworkId
    && (initialSourceWorkbookId === null || candidate.workbookId === initialSourceWorkbookId),
  );
  const deepLinkedStandaloneNetwork = standaloneSyNetworks.find((candidate) =>
    candidate.network.modelId === initialNetworkId
    && (initialSourceWorkbookId === null || candidate.workbookId === initialSourceWorkbookId),
  );
  // Owned models may have been created or explicitly loaded as an example.
  // Discovering a project's SY models must not select one for a blank workbook.
  const selected = selectionBelongsToWorkbook
    ? relevantConfigurations.find((candidate) =>
      `${candidate.owner}:${candidate.workbookId}:${candidate.configuration.modelId}` === configurationSelection.key,
    )
    : deepLinkedConfiguration ?? matchingLocalConfigurations[0];
  const selectedStandaloneNetwork = selectionBelongsToWorkbook
    ? standaloneSyNetworks.find((candidate) =>
      `NETWORK:${candidate.owner}:${candidate.workbookId}:${candidate.network.modelId}` === configurationSelection.key,
    )
    : selected === undefined ? deepLinkedStandaloneNetwork : undefined;
  const selectedConfigurationKey = selected === undefined
    ? selectedStandaloneNetwork === undefined
      ? ""
      : `NETWORK:${selectedStandaloneNetwork.owner}:${selectedStandaloneNetwork.workbookId}:${selectedStandaloneNetwork.network.modelId}`
    : `${selected.owner}:${selected.workbookId}:${selected.configuration.modelId}`;

  const displayedNetwork = selected ?? selectedStandaloneNetwork ?? localNetworks[0];

  useEffect(() => {
    if (!sourceLoading) onNetworkAvailabilityChange?.(displayedNetwork !== undefined);
  }, [displayedNetwork, onNetworkAvailabilityChange, sourceLoading]);

  const eligibleEventTrees = useMemo(() => selected === undefined
    ? []
    : eventTrees.filter((eventTree) => configurationMatchesEventTree(selected.configuration, eventTree)),
  [eventTrees, selected]);
  const evidence: BayesianNetworkEvidenceConfiguration = selected?.configuration.baseEvidence ?? { observations: [] };
  const validation = displayedNetwork === undefined ? [] : validateBayesianNetworkModel(displayedNetwork.network, {
    evidence,
    hclBindings: selected?.configuration.bindings ?? [],
    workbookId: displayedNetwork.workbookId,
  });

  const saveBlockedReason = analysisSaveBlock(runtime)
    ?? (sourceLoading ? "Wait for linked models to load." : sourceError);
  const inputKey = stringifyJson([sourceEpoch, runtime.workbookId, runtime.revision, runtime.saveStatus,
    esq.bayesianNetworks, esq.hclConfigurations, selected, faultTrees, eventTrees, sourceLoading, sourceError]);
  const analysis = useAnalysisScope(inputKey!, () => {
    setRunResult(null);
    setBatchRunResult(null);
    setRunError(null);
    setRunning(false);
  });

  function replaceLegacyNetwork(next: BayesianNetworkModel): void {
    if (displayedNetwork?.owner !== "ESQ") return;
    analysis.invalidate();
    mutateEsq((current) => ({
      ...current,
      bayesianNetworks: current.bayesianNetworks.map((candidate) =>
        candidate.modelId === next.modelId ? next as EsqBayesianNetwork : candidate,
      ),
    }));
  }

  function createLegacyNetwork(): void {
    const created = createEmptyBayesianNetwork("Dependency network") as EsqBayesianNetwork;
    mutateEsq((current) => ({
      ...current,
      bayesianNetworks: [...current.bayesianNetworks, created],
    }));
  }

  function replaceLegacyEvidence(next: BayesianNetworkEvidenceConfiguration): void {
    if (displayedNetwork?.owner !== "ESQ") return;
    analysis.invalidate();
    mutateEsq((current) => ({
      ...current,
      hclConfigurations: current.hclConfigurations.map((configuration) =>
        configuration.bayesianNetwork.modelId === displayedNetwork.network.modelId
          ? { ...configuration, baseEvidence: next }
          : configuration,
      ),
    }));
  }

  async function runEventTree(configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption, calculationType: HclCalculationType): Promise<void> {
    if (saveBlockedReason !== null) { setRunError(saveBlockedReason); return; }
    if (runtime.workbookId === null || runtime.revision === null || selected === undefined) return;
    analysis.invalidate();
    const isCurrent = analysis.capture();
    setRunning(true);
    setRunError(null);
    try {
      const execution = await runEsqHclEventTree(
        runtime.workbookId,
        configuration.modelId,
        runtime.revision,
        { workbookId: eventTree.workbookId, modelId: eventTree.modelId },
        calculationType,
        selected.owner === "SY"
          ? { workbookId: selected.workbookId, modelId: configuration.modelId }
          : undefined,
      );
      if (execution.run.status !== "SUCCEEDED") {
        throw new Error(execution.run.failure?.message ?? `HCL event-tree quantification did not complete (${execution.run.status}).`);
      }
      const result = await getEsqHclEventTreeResult(runtime.workbookId, configuration.modelId, execution.run.id);
      if (!isCurrent()) return;
      setRunResult({ kind: "EVENT_TREE", result });
      setBatchRunResult(null);
    } catch (error) {
      if (!isCurrent()) return;
      setRunError(error instanceof Error ? error.message : "HCL event-tree quantification failed.");
    } finally {
      if (isCurrent()) setRunning(false);
      onRunComplete?.();
    }
  }

  async function runEventTreeBatch(
    configuration: WorkbookHclConfiguration,
    eventTree: HclEventTreeOption,
    scenarioIds: string[],
    integrateHazardGrid: boolean,
    calculationType: HclCalculationType,
  ): Promise<void> {
    if (saveBlockedReason !== null) { setRunError(saveBlockedReason); return; }
    if (runtime.workbookId === null || runtime.revision === null || selected === undefined) return;
    analysis.invalidate();
    const isCurrent = analysis.capture();
    setRunning(true);
    setRunError(null);
    try {
      const execution = await runEsqHclEventTreeBatch(
        runtime.workbookId,
        configuration.modelId,
        runtime.revision,
        { workbookId: eventTree.workbookId, modelId: eventTree.modelId },
        calculationType,
        scenarioIds,
        integrateHazardGrid,
        selected.owner === "SY"
          ? { workbookId: selected.workbookId, modelId: configuration.modelId }
          : undefined,
        { evidenceScenarios: configuration.evidenceScenarios ?? [], hazardGrid: configuration.hazardGrid },
      );
      const scenarios: HclEditorScenarioRunResult[] = await Promise.all(execution.runs.map(async (scenario) => ({
        scenarioId: scenario.scenarioId,
        scenarioCode: scenario.scenarioCode,
        scenarioName: scenario.scenarioName,
        status: scenario.run.status,
        failure: scenario.run.failure?.message ?? null,
        result: scenario.run.status !== "SUCCEEDED" ? null : {
          kind: "EVENT_TREE" as const,
          result: await getEsqHclEventTreeResult(runtime.workbookId!, configuration.modelId, scenario.run.id),
        },
      })));
      if (!isCurrent()) return;
      setBatchRunResult({
        kind: "EVENT_TREE",
        scenarios,
        ...(execution.hazardConvolution === undefined ? {} : { hazardConvolution: execution.hazardConvolution }),
        ...(execution.compilationReuse === undefined ? {} : { compilationReuse: execution.compilationReuse }),
      });
      setRunResult(null);
    } catch (error) {
      if (!isCurrent()) return;
      setRunError(error instanceof Error ? error.message : "HCL event-tree scenario batch failed.");
    } finally {
      if (isCurrent()) setRunning(false);
      onRunComplete?.();
    }
  }

  const dependencyOptionsAvailable = relevantConfigurations.length > 0 || standaloneSyNetworks.length > 0;
  const addNetworkAction = !sourceLoading && displayedNetwork === undefined && editable ? (
    <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createLegacyNetwork}>
      <span aria-hidden="true">+</span>
      Add network
    </button>
  ) : null;

  return (
    <section className="poscard esq-hcl-et" aria-label="Event tree Bayesian dependency quantification">
      <div className="poscard__head bneditor__network-head">
        <h3 className="poscard__title">Bayesian dependency network</h3>
        {dependencyOptionsAvailable ? (
          <div className="posrow esqbn__network-actions" style={{ gap: 8 }}>
            <select className="posfield__select" aria-label="Dependency configuration" value={selectedConfigurationKey} onChange={(event) => {
              setConfigurationSelection({ workbookId: runtime.workbookId, esqUuid: esq.uuid, key: event.target.value });
              setRunResult(null);
              setBatchRunResult(null);
            }}>
              <option value="">Choose a dependency configuration</option>
              {relevantConfigurations.map((candidate) => (
                <option
                  key={`${candidate.owner}:${candidate.workbookId}:${candidate.configuration.modelId}`}
                  value={`${candidate.owner}:${candidate.workbookId}:${candidate.configuration.modelId}`}
                >
                  {candidate.workbookName} · {candidate.configuration.code}
                </option>
              ))}
              {standaloneSyNetworks.map((candidate) => (
                <option
                  key={`NETWORK:${candidate.owner}:${candidate.workbookId}:${candidate.network.modelId}`}
                  value={`NETWORK:${candidate.owner}:${candidate.workbookId}:${candidate.network.modelId}`}
                >
                  {candidate.workbookName} · {candidate.network.code} (network only)
                </option>
              ))}
            </select>
            {addNetworkAction}
          </div>
        ) : addNetworkAction}
      </div>
      {sourceLoading && <p className="pws-status">Loading dependency networks and linked event trees…</p>}
      {sourceError !== null && <p className="pws-status pws-status--error">{sourceError}</p>}
      {displayedNetwork !== undefined && (
        <BayesianNetworkEditor
          model={displayedNetwork.network}
          saveBlockedReason={saveBlockedReason}
          onAnalysisInputChange={analysis.invalidate}
          editable={displayedNetwork.owner === "ESQ" && editable}
          readOnlyNotice={displayedNetwork.owner === "SY" ? {
            message: `This network is linked from ${displayedNetwork.workbookName.replace(/\s+—.*$/, "")} and is read-only here. Open that workbook's Dependencies step to import XDSL or manage groups.`,
            sourceHref: `/sy-workbooks/${encodeURIComponent(displayedNetwork.workbookId)}?step=deps&network=${encodeURIComponent(displayedNetwork.network.modelId)}&esqWorkbook=${encodeURIComponent(runtime.workbookId ?? "")}`,
            sourceLabel: "Open Systems workbook",
          } : undefined}
          showQueryAnalysis={false}
          hclScope="EVENT_TREE"
          evidence={evidence}
          queryNodeId={displayedNetwork.network.nodes[0]?.id ?? null}
          validation={validation}
          analysisResult={null}
          running={false}
          runError={null}
          workbookId={displayedNetwork.workbookId}
          hclConfigurations={selected === undefined ? [] : [selected.configuration]}
          faultTreeOptions={faultTrees}
          eventTreeOptions={eligibleEventTrees}
          hclRunning={running}
          hclRunError={runError ?? sourceWarning}
          hclRunResult={runResult}
          hclBatchRunResult={batchRunResult}
          onModelChange={replaceLegacyNetwork}
          onEvidenceChange={replaceLegacyEvidence}
          onQueryNodeChange={() => undefined}
          onHclConfigurationsChange={() => undefined}
          onGenerateHclScenarios={async (configuration, spec) => {
            if (saveBlockedReason !== null) throw new Error(saveBlockedReason);
            if (runtime.workbookId === null || runtime.revision === null || selected === undefined) throw new Error("Save the workbook first.");
            return (await generateEsqHclScenarios(runtime.workbookId, configuration.modelId, runtime.revision, spec,
              selected.owner === "SY" ? { workbookId: selected.workbookId, modelId: configuration.modelId } : undefined)).scenarios;
          }}
          onRunHclFaultTree={() => undefined}
          onRunHclEventTree={(configuration, eventTree, calculationType) => { void runEventTree(configuration, eventTree, calculationType); }}
          onRunHclFaultTreeBatch={() => undefined}
          onRunHclEventTreeBatch={(configuration, eventTree, scenarioIds, integrateHazardGrid, calculationType) => {
            void runEventTreeBatch(configuration, eventTree, scenarioIds, integrateHazardGrid, calculationType);
          }}
          onRun={() => undefined}
        />
      )}
    </section>
  );
}

export { EsqEventTreeHclWorkspace };
