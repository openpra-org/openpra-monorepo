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
  HclFaultTreeOption,
} from "../newly-developed-methods/hybrid-causal-logic";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  getEsqHclEventTreeResult,
  runEsqHclEventTree,
  runEsqHclEventTreeBatch,
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
}: EsqEventTreeHclWorkspaceProps): JSX.Element {
  const { esq, editable, mutateEsq, runtime } = useEsqWorkbook();
  const [syConfigurations, setSyConfigurations] = useState<OwnedConfiguration[]>([]);
  const [syNetworks, setSyNetworks] = useState<OwnedNetwork[]>([]);
  const [faultTrees, setFaultTrees] = useState<HclFaultTreeOption[]>([]);
  const [eventTrees, setEventTrees] = useState<HclEventTreeOption[]>([]);
  const [selectedConfigurationKey, setSelectedConfigurationKey] = useState("");
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<HclEditorRunResult | null>(null);
  const [batchRunResult, setBatchRunResult] = useState<HclEditorBatchRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (runtime.projectId === null) {
      setSyConfigurations([]);
      setSyNetworks([]);
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
                    workbookId: workbook.id,
                    modelId: leaf.target.modelId,
                    entityId: leaf.target.entityId,
                  },
                };
              }
              return { id: leaf.id, kind: leaf.kind };
            }),
            gateInputs: logic.gateInputs.map(({ gateId, childId, order }) => ({ gateId, childId, order })),
            constantBasicEventStates: Object.fromEntries(source.mef.systemBasicEvents.flatMap((event) =>
              event.controlledDataSource === undefined && (event.probability === 0 || event.probability === 1)
                ? [[event.uuid, event.probability === 1]]
                : [],
            )),
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
            modelName: tree.name,
            sequences: connectedTrees.flatMap((connectedTree) =>
              Object.values(connectedTree.sequences).map((sequence) => ({ id: sequence.uuid, name: sequence.name })),
            ),
            faultTrees: linkedFaultTrees.map(({ workbookId, modelId }) => ({ workbookId, modelId })),
            linkedFaultTrees,
            transferTargets: [...new Map(Object.values(tree.transfers ?? {}).map((transfer) => [
              `${workbook.id}:${transfer.targetEventTreeId}`,
              { workbookId: workbook.id, modelId: transfer.targetEventTreeId },
            ])).values()],
          };
        }),
      ));
    }).catch((error: unknown) => {
      if (!cancelled) {
        setSyConfigurations([]);
        setSyNetworks([]);
        setFaultTrees([]);
        setEventTrees([]);
        setSourceError(error instanceof Error ? error.message : "Could not load SY dependencies and ES event trees.");
      }
    }).finally(() => {
      if (!cancelled) setSourceLoading(false);
    });
    return () => { cancelled = true; };
  }, [runtime.projectId]);

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
  const relevantConfigurations = matchingSyConfigurations.length > 0
    ? matchingSyConfigurations
    : matchingLocalConfigurations;
  const selected = relevantConfigurations.find((candidate) =>
    `${candidate.owner}:${candidate.workbookId}:${candidate.configuration.modelId}` === selectedConfigurationKey,
  ) ?? relevantConfigurations[0];

  useEffect(() => {
    if (selected === undefined) {
      setSelectedConfigurationKey("");
      return;
    }
    const key = `${selected.owner}:${selected.workbookId}:${selected.configuration.modelId}`;
    if (key !== selectedConfigurationKey) setSelectedConfigurationKey(key);
  }, [selected, selectedConfigurationKey]);

  const displayedNetwork = selected ?? localNetworks[0] ?? syNetworks[0];

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

  function replaceLegacyNetwork(next: BayesianNetworkModel): void {
    if (displayedNetwork?.owner !== "ESQ") return;
    const statesByNode = new Map(next.nodes.map((node) => [node.id, new Set(node.states.map((state) => state.id))]));
    mutateEsq((current) => ({
      ...current,
      bayesianNetworks: current.bayesianNetworks.map((candidate) =>
        candidate.modelId === next.modelId ? next as EsqBayesianNetwork : candidate,
      ),
      hclConfigurations: current.hclConfigurations.map((configuration) =>
        configuration.bayesianNetwork.modelId === next.modelId
          ? {
              ...configuration,
              baseEvidence: {
                observations: configuration.baseEvidence.observations.filter((observation) =>
                  statesByNode.get(observation.nodeId)?.has(observation.stateId) === true,
                ),
              },
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
  }

  function createLegacyNetwork(): void {
    const created = createEmptyBayesianNetwork("Dependency network") as EsqBayesianNetwork;
    mutateEsq((current) => ({
      ...current,
      bayesianNetworks: [...current.bayesianNetworks, created],
    }));
    setRunResult(null);
    setBatchRunResult(null);
  }

  function replaceLegacyEvidence(next: BayesianNetworkEvidenceConfiguration): void {
    if (displayedNetwork?.owner !== "ESQ") return;
    mutateEsq((current) => ({
      ...current,
      hclConfigurations: current.hclConfigurations.map((configuration) =>
        configuration.bayesianNetwork.modelId === displayedNetwork.network.modelId
          ? { ...configuration, baseEvidence: next }
          : configuration,
      ),
    }));
    setRunResult(null);
    setBatchRunResult(null);
  }

  async function runEventTree(configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption): Promise<void> {
    if (runtime.workbookId === null || runtime.revision === null || selected === undefined) return;
    setRunning(true);
    setRunError(null);
    try {
      const execution = await runEsqHclEventTree(
        runtime.workbookId,
        configuration.modelId,
        runtime.revision,
        { workbookId: eventTree.workbookId, modelId: eventTree.modelId },
        selected.owner === "SY"
          ? { workbookId: selected.workbookId, modelId: configuration.modelId }
          : undefined,
      );
      if (execution.run.status !== "SUCCEEDED") {
        throw new Error(execution.run.failure?.message ?? `HCL event-tree quantification did not complete (${execution.run.status}).`);
      }
      const result = await getEsqHclEventTreeResult(runtime.workbookId, configuration.modelId, execution.run.id);
      setRunResult({ kind: "EVENT_TREE", result });
      setBatchRunResult(null);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "HCL event-tree quantification failed.");
    } finally {
      setRunning(false);
      onRunComplete?.();
    }
  }

  async function runEventTreeBatch(
    configuration: WorkbookHclConfiguration,
    eventTree: HclEventTreeOption,
    scenarioIds: string[],
    integrateHazardGrid: boolean,
  ): Promise<void> {
    if (runtime.workbookId === null || runtime.revision === null || selected === undefined) return;
    setRunning(true);
    setRunError(null);
    try {
      const execution = await runEsqHclEventTreeBatch(
        runtime.workbookId,
        configuration.modelId,
        runtime.revision,
        { workbookId: eventTree.workbookId, modelId: eventTree.modelId },
        scenarioIds,
        integrateHazardGrid,
        selected.owner === "SY"
          ? { workbookId: selected.workbookId, modelId: configuration.modelId }
          : undefined,
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
      setBatchRunResult({
        kind: "EVENT_TREE",
        scenarios,
        ...(execution.hazardConvolution === undefined ? {} : { hazardConvolution: execution.hazardConvolution }),
      });
      setRunResult(null);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "HCL event-tree scenario batch failed.");
    } finally {
      setRunning(false);
      onRunComplete?.();
    }
  }

  return (
    <section className="poscard esq-hcl-et" aria-label="Event-tree Bayesian dependency quantification">
      <div className="poscard__head">
        <div>
          <h3>Event-tree Bayesian dependency network</h3>
          {displayedNetwork !== undefined && <p className="poscard__sub">Inspect the dependency network and quantify event trees; linked fault trees are derived automatically.</p>}
        </div>
        {!sourceLoading && displayedNetwork === undefined && editable && (
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createLegacyNetwork}>
            <span aria-hidden="true">+</span>
            Add network
          </button>
        )}
        {displayedNetwork !== undefined && relevantConfigurations.length > 0 && (
          <label className="esq-hcl-et__configuration">
            <span>Dependency configuration</span>
            <select value={selectedConfigurationKey} onChange={(event) => {
              setSelectedConfigurationKey(event.target.value);
              setRunResult(null);
              setBatchRunResult(null);
            }}>
              {relevantConfigurations.map((candidate) => (
                <option
                  key={`${candidate.owner}:${candidate.workbookId}:${candidate.configuration.modelId}`}
                  value={`${candidate.owner}:${candidate.workbookId}:${candidate.configuration.modelId}`}
                >
                  {candidate.workbookName} · {candidate.configuration.code}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {sourceLoading && <p className="pws-status">Loading dependency networks and linked event trees…</p>}
      {sourceError !== null && <p className="pws-status pws-status--error">{sourceError}</p>}
      {displayedNetwork !== undefined && (
        <BayesianNetworkEditor
          model={displayedNetwork.network}
          editable={displayedNetwork.owner === "ESQ" && editable}
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
          hclRunError={runError}
          hclRunResult={runResult}
          hclBatchRunResult={batchRunResult}
          onModelChange={replaceLegacyNetwork}
          onEvidenceChange={replaceLegacyEvidence}
          onQueryNodeChange={() => undefined}
          onHclConfigurationsChange={() => undefined}
          onRunHclFaultTree={() => undefined}
          onRunHclEventTree={(configuration, eventTree) => { void runEventTree(configuration, eventTree); }}
          onRunHclFaultTreeBatch={() => undefined}
          onRunHclEventTreeBatch={(configuration, eventTree, scenarioIds, integrateHazardGrid) => {
            void runEventTreeBatch(configuration, eventTree, scenarioIds, integrateHazardGrid);
          }}
          onRun={() => undefined}
        />
      )}
    </section>
  );
}

export { EsqEventTreeHclWorkspace };
