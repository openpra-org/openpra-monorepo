import type { EventSequence } from "interfaces-mef-types/es/event-sequence-analysis";
import type { HazardConditionedMethodModels } from "interfaces-mef-types/hazard-conditioned-models";
import type { WorkbookBayesianNetwork, WorkbookFaultTree } from "interfaces-mef-types/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { type JSX, useEffect, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import {
  BayesianNetworkEditor,
  createEmptyBayesianNetwork,
} from "../newly-developed-methods/bayesian-network";
import {
  EventTreeEditor,
  applyEventTreeOperation,
  createEmptyEventTree,
  validateEventTree,
  type EventTreeOperation,
  type EventTreeRepresentation,
} from "../newly-developed-methods/event-tree";
import {
  FaultTreeEditor,
  applyFaultTreeOperation,
  type FaultTreeOperation,
  type FaultTreeSelection,
} from "../newly-developed-methods/fault-tree";
import "./hazardConditionedModelEditors.css";

interface HazardModelEditorProps {
  models: HazardConditionedMethodModels;
  editable: boolean;
  onChange: (models: HazardConditionedMethodModels) => void;
}

interface WorkbookBayesianNetworkCollectionEditorProps {
  networks: WorkbookBayesianNetwork[];
  editable: boolean;
  onChange: (networks: WorkbookBayesianNetwork[]) => void;
  ariaLabel?: string;
  newNetworkName?: string;
}

function CollectionToolbar({
  label,
  value,
  options,
  editable,
  onChange,
  onAdd,
  onDelete,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; code: string; name: string }>;
  editable: boolean;
  onChange: (id: string) => void;
  onAdd: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <div className="hazmodels__toolbar">
      <label>
        <span>{label}</span>
        <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.code} · {option.name}</option>
          ))}
        </select>
      </label>
      {editable && (
        <div>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onAdd}><POSIcon.Plus /> Add model</button>
          <button type="button" className="posnav__btn posnav__btn--sm hazmodels__delete" disabled={value === ""} onClick={onDelete}><POSIcon.Close /> Delete model</button>
        </div>
      )}
    </div>
  );
}

function EmptyModel({ type, editable, onAdd, qualifier = "hazard-conditioned " }: { type: string; editable: boolean; onAdd: () => void; qualifier?: string }): JSX.Element {
  return (
    <div className="hazmodels__empty">
      <strong>No {type} yet</strong>
      <span>{editable ? `Add the first ${qualifier}${type}.` : `No ${qualifier}${type} has been authored.`}</span>
      {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onAdd}><POSIcon.Plus /> Add model</button>}
    </div>
  );
}

function createFaultTree(): WorkbookFaultTree {
  const gateId = crypto.randomUUID();
  return {
    modelId: crypto.randomUUID(),
    code: "HAZ-IE-FT",
    name: "Hazard-conditioned initiating-event logic",
    description: "",
    topGate: { gateId },
    gates: [{ id: gateId, kind: "GATE", gateType: "OR", code: "TOP", name: "Hazard-induced plant challenge", description: "" }],
    leafNodes: [],
    gateInputs: [],
    nodePositions: [{ nodeId: gateId, position: { x: 320, y: 80 } }],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
  };
}

function HazardFaultTreeEditor({ models, editable, onChange }: HazardModelEditorProps): JSX.Element {
  const [selectedId, setSelectedId] = useState(models.initiatingEventFaultTrees[0]?.modelId ?? "");
  const [selection, setSelection] = useState<FaultTreeSelection>(null);
  const selected = models.initiatingEventFaultTrees.find((model) => model.modelId === selectedId)
    ?? models.initiatingEventFaultTrees[0];
  useEffect(() => {
    if (selected !== undefined && selectedId !== selected.modelId) setSelectedId(selected.modelId);
  }, [selected, selectedId]);
  const add = (): void => {
    const model = createFaultTree();
    onChange({ ...models, initiatingEventFaultTrees: [...models.initiatingEventFaultTrees, model] });
    setSelectedId(model.modelId);
  };
  if (selected === undefined) return <EmptyModel type="initiating-event fault tree" editable={editable} onAdd={add} />;
  const operate = (operation: FaultTreeOperation): void => {
    const result = applyFaultTreeOperation(selected, models.faultTreeCatalogue, operation);
    onChange({
      ...models,
      initiatingEventFaultTrees: models.initiatingEventFaultTrees.map((model) => model.modelId === selected.modelId ? result.model : model),
      faultTreeCatalogue: result.catalogue,
    });
  };
  return (
    <section className="hazmodels" aria-label="Hazard-conditioned fault trees">
      <CollectionToolbar
        label="Initiating-event fault tree"
        value={selected.modelId}
        options={models.initiatingEventFaultTrees.map((model) => ({ id: model.modelId, code: model.code, name: model.name }))}
        editable={editable}
        onChange={(id) => { setSelectedId(id); setSelection(null); }}
        onAdd={add}
        onDelete={() => {
          const remaining = models.initiatingEventFaultTrees.filter((model) => model.modelId !== selected.modelId);
          onChange({ ...models, initiatingEventFaultTrees: remaining });
          setSelectedId(remaining[0]?.modelId ?? "");
          setSelection(null);
        }}
      />
      <FaultTreeEditor
        model={selected}
        catalogue={models.faultTreeCatalogue}
        capabilities={{ mode: editable ? "AUTHOR" : "READ_ONLY", canEditBasicEvents: editable, canEditLayout: editable, canImport: editable, canExport: true, canRunAnalysis: false }}
        selection={selection}
        validation={[]}
        saveState="saved"
        analysisResult={null}
        resultIsStale={false}
        onOperation={operate}
        onSelectionChange={setSelection}
        onOpenReference={() => undefined}
        onRun={() => undefined}
      />
    </section>
  );
}

function HazardEventTreeEditor({ models, editable, onChange }: HazardModelEditorProps): JSX.Element {
  const [selectedId, setSelectedId] = useState(models.eventTrees[0]?.uuid ?? "");
  const [selection, setSelection] = useState<string | null>(null);
  const [representation, setRepresentation] = useState<EventTreeRepresentation>("event-tree");
  const selected = models.eventTrees.find((model) => model.uuid === selectedId) ?? models.eventTrees[0];
  useEffect(() => {
    if (selected !== undefined && selectedId !== selected.uuid) setSelectedId(selected.uuid);
  }, [selected, selectedId]);
  const add = (): void => {
    const model = createEmptyEventTree(crypto.randomUUID(), undefined, 0);
    onChange({ ...models, eventTrees: [...models.eventTrees, model] });
    setSelectedId(model.uuid);
  };
  if (selected === undefined) return <EmptyModel type="event tree" editable={editable} onAdd={add} />;
  const updateSequence = (id: string, changes: Partial<Pick<EventSequence, "sequenceFamilyId" | "releaseCategoryId">>): void => {
    onChange({ ...models, eventSequences: models.eventSequences.map((sequence) => sequence.uuid === id ? { ...sequence, ...changes } : sequence) });
  };
  const operate = (operation: EventTreeOperation): void => {
    const next = applyEventTreeOperation(selected, operation);
    onChange({ ...models, eventTrees: models.eventTrees.map((model) => model.uuid === selected.uuid ? next : model) });
  };
  return (
    <section className="hazmodels" aria-label="Hazard-conditioned event trees">
      <CollectionToolbar
        label="Hazard event tree"
        value={selected.uuid}
        options={models.eventTrees.map((model) => ({ id: model.uuid, code: model.label ?? model.uuid.slice(0, 8), name: model.name }))}
        editable={editable}
        onChange={(id) => { setSelectedId(id); setSelection(null); }}
        onAdd={add}
        onDelete={() => {
          const remaining = models.eventTrees.filter((model) => model.uuid !== selected.uuid);
          onChange({
            ...models,
            eventTrees: remaining,
            eventSequences: models.eventSequences.filter((sequence) => sequence.eventTreeId !== selected.uuid),
          });
          setSelectedId(remaining[0]?.uuid ?? "");
          setSelection(null);
        }}
      />
      <EventTreeEditor
        model={selected}
        eventSequences={models.eventSequences.filter((sequence) => sequence.eventTreeId === selected.uuid)}
        availableInitiatingEvents={models.eventTrees.map((tree) => ({ id: tree.initiatingEventId, name: tree.name, frequency: tree.initiatingEventFrequency?.value }))}
        availableTransfers={models.eventTrees.filter((tree) => tree.uuid !== selected.uuid).map((tree) => ({ id: tree.uuid, name: tree.name, sequenceIds: Object.keys(tree.sequences) }))}
        representation={representation}
        capabilities={{ author: editable }}
        selection={selection}
        validation={validateEventTree(selected, models.eventTrees)}
        saveState="saved"
        onOperation={operate}
        onRepresentationChange={setRepresentation}
        onSelectionChange={setSelection}
        onUpdateEventSequence={updateSequence}
      />
    </section>
  );
}

function WorkbookBayesianNetworkCollectionEditor({
  networks,
  editable,
  onChange,
  ariaLabel = "Dependency Bayesian networks",
  newNetworkName = "Dependency network",
}: WorkbookBayesianNetworkCollectionEditorProps): JSX.Element {
  const [selectedId, setSelectedId] = useState(networks[0]?.modelId ?? "");
  const [evidence, setEvidence] = useState({ observations: [] as Array<{ nodeId: string; stateId: string }> });
  const [queryNodeId, setQueryNodeId] = useState<string | null>(null);
  const selected = networks.find((model) => model.modelId === selectedId) ?? networks[0];
  useEffect(() => {
    if (selected !== undefined && selectedId !== selected.modelId) setSelectedId(selected.modelId);
  }, [selected, selectedId]);
  const add = (): void => {
    const model = createEmptyBayesianNetwork(newNetworkName) as WorkbookBayesianNetwork;
    onChange([...networks, model]);
    setSelectedId(model.modelId);
  };
  if (selected === undefined) return <EmptyModel type="dependency Bayesian network" editable={editable} onAdd={add} qualifier="workbook-owned " />;
  const validation = validateBayesianNetworkModel(selected as BayesianNetworkModel, { evidence });
  return (
    <section className="hazmodels" aria-label={ariaLabel}>
      <CollectionToolbar
        label="Dependency Bayesian network"
        value={selected.modelId}
        options={networks.map((model) => ({ id: model.modelId, code: model.code, name: model.name }))}
        editable={editable}
        onChange={(id) => { setSelectedId(id); setEvidence({ observations: [] }); setQueryNodeId(null); }}
        onAdd={add}
        onDelete={() => {
          const remaining = networks.filter((model) => model.modelId !== selected.modelId);
          onChange(remaining);
          setSelectedId(remaining[0]?.modelId ?? "");
          setEvidence({ observations: [] });
          setQueryNodeId(null);
        }}
      />
      <BayesianNetworkEditor
        model={selected as BayesianNetworkModel}
        editable={editable}
        showAnalysis={false}
        evidence={evidence}
        queryNodeId={queryNodeId}
        validation={validation}
        analysisResult={null}
        running={false}
        runError={null}
        workbookId={null}
        hclConfigurations={[]}
        faultTreeOptions={[]}
        eventTreeOptions={[]}
        hclRunning={false}
        hclRunError={null}
        hclRunResult={null}
        hclBatchRunResult={null}
        onModelChange={(model) => onChange(networks.map((candidate) => candidate.modelId === selected.modelId ? model : candidate))}
        onEvidenceChange={setEvidence}
        onQueryNodeChange={setQueryNodeId}
        onHclConfigurationsChange={() => undefined}
        onRunHclFaultTree={() => undefined}
        onRunHclEventTree={() => undefined}
        onRunHclFaultTreeBatch={() => undefined}
        onRunHclEventTreeBatch={() => undefined}
        onRun={() => undefined}
      />
    </section>
  );
}

function HazardBayesianNetworkEditor({ models, editable, onChange }: HazardModelEditorProps): JSX.Element {
  return (
    <WorkbookBayesianNetworkCollectionEditor
      networks={models.dependencyBayesianNetworks}
      editable={editable}
      onChange={(dependencyBayesianNetworks) => onChange({ ...models, dependencyBayesianNetworks })}
      ariaLabel="Hazard-conditioned dependency networks"
      newNetworkName="Hazard dependency network"
    />
  );
}

export {
  HazardBayesianNetworkEditor,
  HazardEventTreeEditor,
  HazardFaultTreeEditor,
  WorkbookBayesianNetworkCollectionEditor,
};
