import { type JSX, useEffect, useMemo, useState } from "react";
import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import { useEditorConfirmation } from "../shared";
import type {
  HclBindingEditorProps,
  HclEventTreeOption,
  HclFaultTreeOption,
} from "./hclBindingTypes";
import "./css/hclBindingEditor.css";

function uniqueCode(prefix: string, codes: readonly string[]): string {
  const normalized = new Set(codes.map((code) => code.trim().toUpperCase()));
  let suffix = normalized.size + 1;
  while (normalized.has(`${prefix}-${String(suffix)}`)) suffix += 1;
  return `${prefix}-${String(suffix)}`;
}

function HclIcon({ name }: { name: "configuration" | "run" | "trash" }): JSX.Element {
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
  faultTreeOptions,
  eventTreeOptions,
  baseEvidence,
  validation,
  running,
  runError,
  runResult,
  onChange,
  onRunFaultTree,
  onRunEventTree,
}: HclBindingEditorProps): JSX.Element {
  const configuration = configurations.find(
    (candidate) =>
      candidate.bayesianNetwork.modelId === model.modelId
      && (workbookId === null || candidate.bayesianNetwork.workbookId === workbookId),
  );
  const [faultTreeKey, setFaultTreeKey] = useState("");
  const [basicEventId, setBasicEventId] = useState("");
  const [nodeId, setNodeId] = useState(model.nodes[0]?.id ?? "");
  const [trueStateIds, setTrueStateIds] = useState<string[]>([]);
  const [targetKind, setTargetKind] = useState<"FAULT_TREE" | "EVENT_TREE">("FAULT_TREE");
  const [runFaultTreeKey, setRunFaultTreeKey] = useState("");
  const [eventTreeKey, setEventTreeKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const selectedTree = faultTreeOptions.find(
    (option) => `${option.workbookId}:${option.modelId}` === faultTreeKey,
  );
  const selectedEventTree = eventTreeOptions.find(
    (option) => `${option.workbookId}:${option.modelId}` === eventTreeKey,
  );
  const selectedNode = model.nodes.find((node) => node.id === nodeId);
  const executableFaultTrees = useMemo(() => {
    if (configuration === undefined) return [];
    const declared = new Set(configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`));
    return faultTreeOptions.filter((option) => declared.has(`${option.workbookId}:${option.modelId}`) && option.topGateId !== null);
  }, [configuration, faultTreeOptions]);

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
    const selected = `${selectedEventTree?.workbookId ?? ""}:${selectedEventTree?.modelId ?? ""}`;
    if (selectedEventTree !== undefined && selected === eventTreeKey) return;
    const first = eventTreeOptions[0];
    setEventTreeKey(first === undefined ? "" : `${first.workbookId}:${first.modelId}`);
  }, [eventTreeKey, eventTreeOptions, selectedEventTree]);
  useEffect(() => {
    if (executableFaultTrees.some((option) => `${option.workbookId}:${option.modelId}` === runFaultTreeKey)) return;
    const first = executableFaultTrees[0];
    setRunFaultTreeKey(first === undefined ? "" : `${first.workbookId}:${first.modelId}`);
  }, [executableFaultTrees, runFaultTreeKey]);

  function createConfiguration(): void {
    if (workbookId === null) {
      setError("Save this ESQ workbook before creating an HCL configuration.");
      return;
    }
    const created: EsqHclConfiguration = {
      modelId: crypto.randomUUID(),
      code: uniqueCode("HCL", configurations.map((candidate) => candidate.code)),
      name: `${model.name} HCL bindings`,
      description: "Fault-tree events bound to Bayesian-network states.",
      bayesianNetwork: { workbookId, modelId: model.modelId },
      faultTrees: [],
      bindings: [],
      baseEvidence,
      solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
    };
    onChange([...configurations, created]);
    setError(null);
  }

  function replaceConfiguration(next: EsqHclConfiguration): void {
    onChange(configurations.map((candidate) => candidate.modelId === next.modelId ? next : candidate));
  }

  function deleteConfiguration(): void {
    if (configuration === undefined) return;
    requestConfirmation({
      title: `Delete ${configuration.code}?`,
      message: `${String(configuration.bindings.length)} fault-tree binding${configuration.bindings.length === 1 ? "" : "s"} will also be removed.`,
      confirmLabel: "Delete configuration",
      tone: "danger",
    }, () => onChange(configurations.filter((candidate) => candidate.modelId !== configuration.modelId)));
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
    if (targetKind === "FAULT_TREE") {
      const tree = executableFaultTrees.find((option) => `${option.workbookId}:${option.modelId}` === runFaultTreeKey);
      if (tree === undefined) {
        setError("Choose a linked fault tree with a top event.");
        return;
      }
      onRunFaultTree(configuration, tree);
      return;
    }
    if (selectedEventTree === undefined) {
      setError("Choose an event tree.");
      return;
    }
    const declared = new Set(configuration.faultTrees.map(({ workbookId: sourceWorkbookId, modelId }) =>
      `${sourceWorkbookId}:${modelId}`,
    ));
    if (selectedEventTree.faultTrees.some(({ workbookId: sourceWorkbookId, modelId }) =>
      !declared.has(`${sourceWorkbookId}:${modelId}`),
    )) {
      setError("Include every fault tree linked by this event tree before running HCL.");
      return;
    }
    onRunEventTree(configuration, selectedEventTree);
  }

  return (
    <section className="bneditor__panel hcleditor" aria-label="HCL bindings">
      <div className="bneditor__panel-head">
        <div>
          <h3>Hybrid causal logic</h3>
          <p>Map fault-tree basic events to BN states, then quantify the connected fault tree or event tree.</p>
        </div>
        {configuration === undefined && editable && (
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createConfiguration}>
            <HclIcon name="configuration" />
            <span>Create HCL configuration</span>
          </button>
        )}
      </div>
      {configuration === undefined ? (
        <p className="bneditor__empty">Create a configuration to connect this BN to fault-tree events.</p>
      ) : (
        <>
          <div className="hcleditor__identity">
            <label><span>Code</span><input value={configuration.code} disabled={!editable} onChange={(event) => replaceConfiguration({ ...configuration, code: event.target.value })} /></label>
            <label><span>Name</span><input value={configuration.name} disabled={!editable} onChange={(event) => replaceConfiguration({ ...configuration, name: event.target.value })} /></label>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={deleteConfiguration}><HclIcon name="trash" />Delete configuration</button>}
          </div>
          <div className="hcleditor__trees" aria-label="Included HCL fault trees">
            <strong>Included fault trees</strong>
            <span>{configuration.faultTrees.map((reference) => {
              const tree = faultTreeOptions.find((option) =>
                option.workbookId === reference.workbookId && option.modelId === reference.modelId,
              );
              return tree?.modelCode ?? reference.modelId;
            }).join(" · ") || "None"}</span>
            {editable && (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={includeSelectedFaultTree}>
                Include selected fault tree
              </button>
            )}
          </div>
          {editable && (
            <div className="bneditor__binding-form">
              <label>
                <span>Fault tree</span>
                <select aria-label="Fault tree for binding" value={faultTreeKey} onChange={(event) => setFaultTreeKey(event.target.value)}>
                  {faultTreeOptions.length === 0 && <option value="">No Systems Analysis fault tree available</option>}
                  {faultTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.workbookName} · {option.modelCode}</option>)}
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
              <button type="button" className="bneditor__btn bneditor__btn--primary" onClick={addBinding}>Add binding</button>
            </div>
          )}
          <div className="bneditor__binding-list">
            {configuration.bindings.map((binding) => {
              const tree = faultTreeOptions.find((option) => option.workbookId === binding.faultTreeBasicEvent.workbookId && option.basicEvents.some((event) => event.id === binding.faultTreeBasicEvent.entityId));
              const basicEvent = tree?.basicEvents.find((event) => event.id === binding.faultTreeBasicEvent.entityId);
              const node = model.nodes.find((candidate) => candidate.id === binding.bayesianNetworkNode.entityId);
              const states = node?.states.filter((state) => binding.trueStateIds.includes(state.id)) ?? [];
              const invalid = node === undefined || states.length === 0 || states.length === node.states.length;
              return (
                <div key={binding.id} className={`bneditor__binding${invalid ? " is-invalid" : ""}`}>
                  <span>{tree?.modelCode ?? "Missing FT"} / {basicEvent?.code ?? "Missing basic event"}</span>
                  <span>→</span>
                  <span>{node?.code ?? "Missing BN node"} = {states.map((state) => state.code).join(" | ") || "No valid state"}</span>
                  {editable && <button type="button" aria-label={`Delete binding ${basicEvent?.code ?? binding.id}`} onClick={() => replaceConfiguration({ ...configuration, bindings: configuration.bindings.filter((candidate) => candidate.id !== binding.id) })}>Delete</button>}
                </div>
              );
            })}
            {configuration.bindings.length === 0 && <p className="bneditor__empty">No fault-tree events are bound yet.</p>}
          </div>
          <div className="hcleditor__run" aria-label="HCL quantification">
            <label>
              <span>Quantify</span>
              <select aria-label="HCL target type" value={targetKind} onChange={(event) => setTargetKind(event.target.value as "FAULT_TREE" | "EVENT_TREE")}>
                <option value="FAULT_TREE">Fault tree</option>
                <option value="EVENT_TREE">Event tree</option>
              </select>
            </label>
            {targetKind === "FAULT_TREE" ? (
              <label>
                <span>Top event</span>
                <select aria-label="HCL fault-tree target" value={runFaultTreeKey} onChange={(event) => setRunFaultTreeKey(event.target.value)}>
                  {executableFaultTrees.length === 0 && <option value="">No linked fault tree</option>}
                  {executableFaultTrees.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.modelCode} · {option.modelName}</option>)}
                </select>
              </label>
            ) : (
              <label>
                <span>Event tree</span>
                <select aria-label="HCL event-tree target" value={eventTreeKey} onChange={(event) => setEventTreeKey(event.target.value)}>
                  {eventTreeOptions.length === 0 && <option value="">No Event Sequence workbook tree available</option>}
                  {eventTreeOptions.map((option) => <option key={`${option.workbookId}:${option.modelId}`} value={`${option.workbookId}:${option.modelId}`}>{option.workbookName} · {option.modelName}</option>)}
                </select>
              </label>
            )}
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || validation.some((issue) => issue.severity === "ERROR")} onClick={run}>
              <HclIcon name="run" />{running ? "Running…" : "Run HCL quantification"}
            </button>
          </div>
          {runError !== null && <p className="bneditor__error" role="alert">{runError}</p>}
          {runResult?.kind === "FAULT_TREE" && (
            <div className="hcleditor__result" aria-label="HCL fault-tree result">
              <strong>Top-event probability</strong><output>{runResult.result.probability.toExponential(6)}</output>
            </div>
          )}
          {runResult?.kind === "EVENT_TREE" && (
            <div className="hcleditor__result hcleditor__result--sequences" aria-label="HCL event-tree result">
              <strong>Sequence results</strong>
              {runResult.result.sequences.map((sequence) => {
                const target = eventTreeOptions.flatMap((option) => option.sequences).find(({ id }) => id === sequence.sequenceId);
                return <span key={sequence.sequenceId}><b>{target?.name ?? sequence.sequenceId}</b><output>{sequence.conditionalProbability.toExponential(6)} · {sequence.annualFrequency.toExponential(6)}/yr</output></span>;
              })}
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
