import { useState, type JSX } from "react";
import type { UncertainVector } from "interfaces-mef-types/core/uncertainty";
import type { BayesianNetworkNode, HclCptRowUncertainty, HclUncertaintySettings, WorkbookModelAddress } from "interfaces-mef-types/modeling";
import { VectorLawSchema } from "interfaces-mef-types/zod/core/uncertainty";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { VectorEditor } from "../shared/uncertainEditor";

interface CptRowChoice {
  key: string;
  node: BayesianNetworkNode;
  rowId: string;
  label: string;
}

function rowKey(nodeId: string, rowId: string): string {
  return `${nodeId}:${rowId}`;
}

function rowChoices(model: BayesianNetworkModel): CptRowChoice[] {
  return model.conditionalProbabilityTables.flatMap((table) => {
    const node = model.nodes.find((candidate) => candidate.id === table.nodeId);
    if (node === undefined || node.states.length < 2) return [];
    return table.rows.map((row) => {
      const condition = row.parentStates.map((selection) => {
        const parent = model.nodes.find((candidate) => candidate.id === selection.parentNodeId);
        const state = parent?.states.find((candidate) => candidate.id === selection.stateId);
        return `${parent?.code ?? selection.parentNodeId}=${state?.code ?? selection.stateId}`;
      }).join(", ");
      return { key: rowKey(table.nodeId, row.id), node, rowId: row.id, label: `${node.code}${condition.length === 0 ? " · prior" : ` · ${condition}`}` };
    });
  });
}

function cptRowVector(model: BayesianNetworkModel, choice: CptRowChoice): UncertainVector | string {
  const row = model.conditionalProbabilityTables.find((table) => table.nodeId === choice.node.id)?.rows.find((candidate) => candidate.id === choice.rowId);
  if (row === undefined) return "That CPT row is no longer in the network.";
  const values = choice.node.states.map((state) => row.values.find((value) => value.stateId === state.id)?.probability);
  const complete = values.flatMap((value) => (value === undefined ? [] : [value]));
  if (complete.length !== values.length) return "That CPT row does not give a probability for every state.";
  const parsed = VectorLawSchema.safeParse({ family: "FIXED", values: complete });
  return parsed.success ? { node: "VALUE", law: parsed.data } : `That CPT row cannot start a law. ${parsed.error.issues[0]?.message ?? ""}`.trim();
}

function rowFamily(row: UncertainVector): string {
  if (row.node === "PARAMETER") return "Linked";
  switch (row.law.family) {
    case "DIRICHLET": return "Dirichlet";
    case "WEIGHTED_DIRICHLET": return "Weighted Dirichlet";
    case "FIXED": return "Fixed fractions";
  }
}

function rowLength(row: UncertainVector): number | null {
  if (row.node === "PARAMETER") return null;
  return row.law.family === "FIXED" ? row.law.values.length : row.law.concentrations.length;
}

function HclCptRowControls({ model, reference, settings, editable, onChange, onError }: {
  model: BayesianNetworkModel;
  reference: WorkbookModelAddress;
  settings: HclUncertaintySettings;
  editable: boolean;
  onChange: (settings: HclUncertaintySettings) => void;
  onError: (message: string | null) => void;
}): JSX.Element {
  const [selectedKey, setSelectedKey] = useState("");
  const choices = rowChoices(model);
  const generated = new Set(settings.cptGenerators.map((definition) => definition.bayesianNetworkNode.entityId));
  const configured = new Set(settings.cptRows.map((row) => rowKey(row.bayesianNetworkNode.entityId, row.cptRowId)));
  const available = choices.filter((choice) => !generated.has(choice.node.id) && !configured.has(choice.key));
  const selected = available.find((choice) => choice.key === selectedKey) ?? available[0];

  function add(): void {
    if (selected === undefined) {
      onError("No CPT row is left for a row law.");
      return;
    }
    const row = cptRowVector(model, selected);
    if (typeof row === "string") {
      onError(row);
      return;
    }
    onChange({
      ...settings,
      cptRows: [...settings.cptRows, {
        bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: reference.workbookId, modelId: reference.modelId, entityId: selected.node.id },
        cptRowId: selected.rowId,
        row,
      }],
    });
    onError(null);
  }

  function update(index: number, row: UncertainVector): void {
    onChange({ ...settings, cptRows: settings.cptRows.map((definition, at) => (at === index ? { ...definition, row } : definition)) });
  }

  function remove(index: number): void {
    onChange({ ...settings, cptRows: settings.cptRows.filter((_, at) => at !== index) });
  }

  function item(definition: HclCptRowUncertainty, index: number): JSX.Element {
    const node = model.nodes.find((candidate) => candidate.id === definition.bayesianNetworkNode.entityId);
    const choice = choices.find((candidate) => candidate.key === rowKey(definition.bayesianNetworkNode.entityId, definition.cptRowId));
    const length = rowLength(definition.row);
    return (
      <details key={rowKey(definition.bayesianNetworkNode.entityId, definition.cptRowId)} className="hcleditor__uncertainty-item">
        <summary>
          <span className="hcleditor__uncertainty-item-name"><small>BN / CPT row</small><strong>{choice?.label ?? definition.cptRowId}</strong></span>
          <span className="hcleditor__uncertainty-family">{rowFamily(definition.row)}</span>
          <span className="hcleditor__uncertainty-expand">Settings</span>
        </summary>
        <div className="hcleditor__uncertainty-item-settings hcleditor__uncertainty-item-settings--editor">
          {node === undefined ? <p role="alert">The configured BN node is missing.</p> : (
            <>
              {length !== null && length !== node.states.length && <p role="alert">The row law has {length} values but {node.code} has {node.states.length} states.</p>}
              <VectorEditor vector={definition.row} labels={node.states.map((state) => state.name)} disabled={!editable} onChange={(row) => update(index, row)} />
            </>
          )}
          {editable && <button type="button" className="hcleditor__uncertainty-delete" onClick={() => remove(index)}>Delete</button>}
        </div>
      </details>
    );
  }

  return (
    <section className="hcleditor__uncertainty-section" aria-label="CPT row uncertainty">
      <div className="hcleditor__uncertainty-section-head">
        <div><strong>BN parameters</strong><span>A row law gives the state probabilities of one CPT row in the node's state order.</span></div>
      </div>
      {editable && available.length > 0 && (
        <div className="hcleditor__uncertainty-add">
          <label><span>CPT row</span><select aria-label="Uncertain CPT row" value={selected?.key ?? ""} onChange={(event) => setSelectedKey(event.target.value)}>
            {available.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
          </select></label>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={add}>Add row law</button>
        </div>
      )}
      {settings.cptRows.length > 0 && (
        <details className="hcleditor__uncertainty-collection">
          <summary>Configured CPT rows <span>{String(settings.cptRows.length)}</span></summary>
          <div className="hcleditor__uncertainty-list">{settings.cptRows.map(item)}</div>
        </details>
      )}
    </section>
  );
}

export { HclCptRowControls, cptRowVector, rowChoices };
