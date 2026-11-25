import { HclUncertaintyReview } from "./hclUncertaintyReview";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import { HclSeismicGeneratorControls } from "./hclSeismicGeneratorControls";
import { HclCptRowControls } from "./hclCptPriorControls";
import { type JSX, useEffect, useMemo, useState } from "react";
import type { HclUncertaintySettings, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { useEditorConfirmation } from "../shared";
import type { HclBindingEditorProps } from "./hclBindingTypes";
import "./css/hclBindingEditor.css";

const START_SAMPLE_COUNT = 1_000;

const START_SEED = 42;

function uniqueCode(prefix: string, codes: readonly string[]): string {
  const normalized = new Set(codes.map((code) => code.trim().toUpperCase()));
  let suffix = normalized.size + 1;
  while (normalized.has(`${prefix}-${String(suffix)}`)) suffix += 1;
  return `${prefix}-${String(suffix)}`;
}

interface HclFaultTreeDirectoryItem {
  id: string;
  code: string;
  title: string;
}

function HclFaultTreeDirectory({ items }: { items: HclFaultTreeDirectoryItem[] }): JSX.Element {
  return (
    <div className="hcleditor__trees" aria-label="Included fault trees">
      <div className="hcleditor__trees-head">
        <strong>Included</strong>
        <span>{items.length} {items.length === 1 ? "tree" : "trees"}</span>
      </div>
      {items.length > 0 && (
        <div className="hcleditor__tree-cloud" role="list">
          {items.map((item) => (
            <span key={item.id} className="hcleditor__tree-token" role="listitem" title={item.title} aria-label={item.title}>
              <span className="hcleditor__tree-mark" aria-hidden="true">✓</span>
              <strong>{item.code}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HclIcon({ name }: { name: "configuration" | "trash" }): JSX.Element {
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
      {name === "trash" && <><path {...common} d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>}
    </svg>
  );
}

function HclToggleChevron(): JSX.Element {
  return (
    <svg className="bneditor__toggle-chevron" viewBox="0 0 12 8" aria-hidden="true">
      <path d="m1 1 5 5 5-5" />
    </svg>
  );
}

function HclBindingEditor({
  model,
  editable,
  workbookId,
  configurations,
  faultTreeOptions,
  baseEvidence,
  evidenceControl,
  onChange,
}: HclBindingEditorProps): JSX.Element {
  const configuration = configurations.find((candidate) => candidate.bayesianNetwork.modelId === model.modelId);
  const savedUncertainty = configuration?.solverSettings.uncertainty;
  const parsedUncertainty = useMemo(
    () => (savedUncertainty === undefined ? undefined : HclUncertaintySettingsSchema.safeParse(savedUncertainty)),
    [savedUncertainty],
  );
  const uncertainty = parsedUncertainty?.success ? parsedUncertainty.data : undefined;
  const [faultTreeKey, setFaultTreeKey] = useState("");
  const [basicEventId, setBasicEventId] = useState("");
  const [nodeId, setNodeId] = useState(model.nodes[0]?.id ?? "");
  const [trueStateIds, setTrueStateIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const selectedTree = faultTreeOptions.find(
    (option) => `${option.workbookId}:${option.modelId}` === faultTreeKey,
  );
  const selectedNode = model.nodes.find((node) => node.id === nodeId);

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

  function createConfiguration(): void {
    if (workbookId === null) {
      setError("Save this workbook before creating a dependency configuration.");
      return;
    }
    const created: WorkbookHclConfiguration = {
      modelId: crypto.randomUUID(),
      code: uniqueCode("DEP", configurations.map((candidate) => candidate.code)),
      name: `${model.name} bindings`,
      description: "Fault tree events bound to network states.",
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

  function replaceUncertainty(next: HclUncertaintySettings | undefined): void {
    if (configuration === undefined) return;
    const solverSettings = { ...configuration.solverSettings };
    if (next === undefined) delete solverSettings.uncertainty;
    else solverSettings.uncertainty = next;
    replaceConfiguration({ ...configuration, solverSettings });
  }

  function enableUncertainty(): void {
    replaceUncertainty({
      sampleCount: START_SAMPLE_COUNT,
      seed: START_SEED,
      sampler: "LHS",
      basicEvents: [],
      cptRows: [],
      cptGenerators: [],
    });
  }

  function deleteConfiguration(): void {
    if (configuration === undefined) return;
    requestConfirmation({
      title: `Delete ${configuration.code}?`,
      message: `${String(configuration.bindings.length)} binding${configuration.bindings.length === 1 ? "" : "s"} will also be removed.`,
      confirmLabel: "Delete configuration",
      tone: "danger",
    }, () => {
      onChange(configurations.filter((candidate) => candidate.modelId !== configuration.modelId));
      setManageOpen(false);
      setAdvancedOpen(false);
    });
  }

  function addBinding(): void {
    if (configuration === undefined || selectedTree === undefined || selectedNode === undefined) {
      setError("Choose a fault tree, basic event, and network node.");
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
      setError("That basic event already has a binding.");
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

  return (
    <section className="hcleditor" aria-label="Dependency configuration">
      <div className="hcleditor__composer" aria-label="Dependency configuration controls">
        <div className="hcleditor__setup-row">
          {evidenceControl}
          {configuration === undefined ? (
            editable && (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createConfiguration}>
                <HclIcon name="configuration" />
                <span>Create dependency configuration</span>
              </button>
            )
          ) : (
            <>
              <button type="button" className="posnav__btn posnav__btn--sm bneditor__toggle" aria-expanded={manageOpen} onClick={() => setManageOpen((open) => !open)}>
                <HclIcon name="configuration" />
                <span>Configuration</span>
                <HclToggleChevron />
              </button>
              <button type="button" className="posnav__btn posnav__btn--sm bneditor__toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
                <HclIcon name="configuration" />
                <span>Advanced</span>
                <HclToggleChevron />
              </button>
            </>
          )}
        </div>
      </div>
      {configuration !== undefined && (
        <>
          {manageOpen && (
            <div className="hcleditor__manage" aria-label="Dependency configuration manager">
              <div className="hcleditor__manage-head">
                <strong>Configuration</strong>
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Close configuration" onClick={() => setManageOpen(false)}>Close</button>
              </div>
              <div className="hcleditor__configuration-stack">
                <details className="hcleditor__configuration-group">
                  <summary>Fault trees</summary>
                  <div role="tabpanel" aria-label="Dependency fault trees">
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
                      items={configuration.faultTrees.map((reference) => {
                        const tree = faultTreeOptions.find((option) =>
                          option.workbookId === reference.workbookId && option.modelId === reference.modelId,
                        );
                        const code = tree?.modelCode ?? "Unresolved fault tree";
                        return {
                          id: `${reference.workbookId}:${reference.modelId}`,
                          code,
                          title: tree === undefined ? code : `${code} · ${tree.modelName}`,
                        };
                      })}
                    />
                  </div>
                </details>

                <details className="hcleditor__configuration-group">
                  <summary>Bindings</summary>
                  <div role="tabpanel" aria-label="Dependency bindings">
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
                          <span>Network node</span>
                          <select aria-label="Network node for binding" value={nodeId} disabled={model.nodes.length === 0} onChange={(event) => { setNodeId(event.target.value); setTrueStateIds([]); }}>
                            {model.nodes.map((node) => <option key={node.id} value={node.id}>{node.code}</option>)}
                          </select>
                        </label>
                        <fieldset>
                          <legend>True states</legend>
                          <div className="hcleditor__true-state-options">
                            {selectedNode?.states.map((state) => (
                              <label key={state.id} className="bneditor__check">
                                <input type="checkbox" checked={trueStateIds.includes(state.id)} onChange={(event) => setTrueStateIds((current) => event.target.checked ? [...current, state.id] : current.filter((id) => id !== state.id))} />
                                {state.code}
                              </label>
                            ))}
                          </div>
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
                                <small>Fault tree / basic event</small>
                                <strong>{tree?.modelCode ?? "Missing fault tree"} / {basicEvent?.code ?? "Missing basic event"}</strong>
                              </span>
                              <span className="hcleditor__binding-arrow" aria-hidden="true">→</span>
                              <span className="hcleditor__binding-endpoint">
                                <small>Network condition</small>
                                <strong>{node?.code ?? "Missing network node"} = {states.map((state) => state.code).join(" | ") || "No valid state"}</strong>
                              </span>
                              {editable && <button type="button" className="hcleditor__binding-delete" aria-label={`Delete binding ${basicEvent?.code ?? "of a missing basic event"}`} onClick={() => replaceConfiguration({ ...configuration, bindings: configuration.bindings.filter((candidate) => candidate.id !== binding.id) })}>Delete</button>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </details>

                <details className="hcleditor__configuration-group">
                  <summary>Uncertainty <span>{savedUncertainty === undefined ? "Off" : uncertainty === undefined ? "Needs review" : "On"}</span></summary>
                  <div className="hcleditor__uncertainty" role="tabpanel" aria-label="Dependency uncertainty settings">
                    {savedUncertainty === undefined ? (
                      editable && (
                        <div className="hcleditor__uncertainty-empty">
                          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={enableUncertainty}>Enable uncertainty</button>
                        </div>
                      )
                    ) : uncertainty === undefined ? (
                      <HclUncertaintyReview key={configuration.modelId} value={savedUncertainty} disabled={!editable} onChange={replaceUncertainty} />
                    ) : (
                      <>
                        <HclCptRowControls model={model} reference={configuration.bayesianNetwork} settings={uncertainty} editable={editable} onChange={replaceUncertainty} onError={setError} />
                        <HclSeismicGeneratorControls model={model} reference={configuration.bayesianNetwork} settings={uncertainty} disabled={!editable} onChange={replaceUncertainty} onError={setError} />
                        {editable && (
                          <div className="hcleditor__uncertainty-empty">
                            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => replaceUncertainty(undefined)}>Disable uncertainty</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
              </div>
            </div>
          )}

          {advancedOpen && (
            <div className="hcleditor__advanced-panel" aria-label="Advanced settings">
              <div className="hcleditor__manage-head">
                <strong>Advanced</strong>
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Close advanced settings" onClick={() => setAdvancedOpen(false)}>Close</button>
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
        </>
      )}
      {error !== null && <p className="bneditor__error" role="alert">{error}</p>}
      {confirmationDialog}
    </section>
  );
}

export { HclBindingEditor };
