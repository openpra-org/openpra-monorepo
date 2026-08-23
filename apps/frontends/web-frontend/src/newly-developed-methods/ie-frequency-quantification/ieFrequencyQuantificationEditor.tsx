import { JSX, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type FrequencyDataSource,
  type FrequencyQuantificationBasis,
  type FrequencyDataPedigree,
  type FrequencyDistributionFamily,
  type FrequencyFaultTreeNode,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import {
  FaultTreeEditor,
  applyFaultTreeOperation,
  type FaultTreeEditorCapabilities,
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
  type FaultTreeSelection,
} from "../fault-tree";
import { validateFaultTreeModel } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { sourceMean, moduleAdjusted, fmtFreq } from "./frequencyMath";
import "./css/ieFrequencyQuantification.css";

const BASIS_OPTIONS: { value: FrequencyQuantificationBasis; label: string }[] = [
  { value: "OPERATING_DATA", label: "Operating data" },
  { value: "GENERIC_DATA", label: "Generic data" },
  { value: "SIMILAR_PLANT_DATA", label: "Similar-plant data" },
  { value: "DESIGN_BASED", label: "Design-based" },
  { value: "FAULT_TREE", label: "Fault tree" },
];

const BASIS_SHORT: Record<FrequencyQuantificationBasis, string> = {
  OPERATING_DATA: "Operating data",
  GENERIC_DATA: "Generic data",
  SIMILAR_PLANT_DATA: "Similar-plant",
  DESIGN_BASED: "Design-based",
  FAULT_TREE: "Fault tree",
};

const PEDIGREE_BY_BASIS: Partial<Record<FrequencyQuantificationBasis, { value: FrequencyDataPedigree; label: string }[]>> = {
  GENERIC_DATA: [
    { value: "TECHNOLOGY_INDEPENDENT", label: "Technology independent (e.g. LWR surrogate)" },
    { value: "OTHER_INDUSTRY", label: "Other-industry component" },
  ],
  SIMILAR_PLANT_DATA: [
    { value: "TECHNOLOGY_SPECIFIC", label: "Same reactor technology" },
    { value: "TECHNOLOGY_INDEPENDENT", label: "Similar reactor technology" },
  ],
  DESIGN_BASED: [
    { value: "TECHNOLOGY_SPECIFIC", label: "This reactor's design" },
    { value: "TEST_DATA", label: "Reactor-specific test data" },
  ],
};

const FAMILY_OPTIONS: { value: FrequencyDistributionFamily; label: string }[] = [
  { value: "POINT", label: "Point value" },
  { value: "GAMMA", label: "Gamma" },
  { value: "LOGNORMAL", label: "Lognormal" },
  { value: "BETA", label: "Beta" },
];

const PARAM_LABELS: Record<FrequencyDistributionFamily, string[]> = {
  POINT: ["Mean value"],
  GAMMA: ["Shape alpha", "Rate beta"],
  LOGNORMAL: ["Median", "Error factor"],
  BETA: ["alpha", "beta"],
};

function isDistributionBasis(basis: FrequencyQuantificationBasis): boolean {
  return basis === "GENERIC_DATA" || basis === "SIMILAR_PLANT_DATA" || basis === "DESIGN_BASED";
}

function nextSourceId(sources: FrequencyDataSource[]): string {
  let max = 0;
  for (const s of sources) {
    if (s.uuid.startsWith("DS-")) {
      const n = Number(s.uuid.slice(3));
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `DS-${max + 1}`;
}

interface FrequencyFaultTreeSnapshot {
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
}

const FREQUENCY_FAULT_TREE_CAPABILITIES: FaultTreeEditorCapabilities = {
  mode: "AUTHOR",
  canEditBasicEvents: true,
  canEditLayout: false,
  canImport: false,
  canExport: false,
  canRunAnalysis: false,
};

const FREQUENCY_FAULT_TREE_READ_ONLY_CAPABILITIES: FaultTreeEditorCapabilities = {
  ...FREQUENCY_FAULT_TREE_CAPABILITIES,
  mode: "READ_ONLY",
};

function starterTree(label: string): FrequencyFaultTreeNode[] {
  return [{
    id: "TOP",
    label: label.length > 0 ? label : "Top event",
    nodeType: "GATE",
    gate: "OR",
  }];
}

type CanonicalGateInput = FaultTreeEditorModel["gateInputs"][number];

function frequencyNodeInputs(
  nodes: readonly FrequencyFaultTreeNode[],
  gateIds: ReadonlySet<string>,
): CanonicalGateInput[] {
  const nextLegacyOrder = new Map<string, number>();
  return nodes.flatMap((node, nodeIndex) => {
    if (node.parentLinks !== undefined) {
      const links = node.parentLinks.flatMap(({ inputId, gateId, order }) =>
        gateIds.has(gateId)
          ? [{ id: inputId, gateId, childId: node.id, order }]
          : [],
      );
      for (const { gateId, order } of links) {
        nextLegacyOrder.set(gateId, Math.max(nextLegacyOrder.get(gateId) ?? 0, order + 1));
      }
      return links;
    }
    if (node.parentId === undefined || !gateIds.has(node.parentId)) return [];
    const order = nextLegacyOrder.get(node.parentId) ?? 0;
    nextLegacyOrder.set(node.parentId, order + 1);
    return [{
      id: `IE-FQ-IN:${nodeIndex}`,
      gateId: node.parentId,
      childId: node.id,
      order,
    }];
  });
}

function legacyBasicEventId(nodeId: string): string {
  return `IE-FQ-BE:${nodeId}`;
}

function frequencyFaultTreeToEditor(
  sourceId: string,
  sourceLabel: string,
  nodes: readonly FrequencyFaultTreeNode[],
): FrequencyFaultTreeSnapshot {
  const gateIds = new Set(nodes.filter(({ nodeType }) => nodeType === "GATE").map(({ id }) => id));
  const gateInputs = frequencyNodeInputs(nodes, gateIds);
  const gates = nodes.reduce<FaultTreeEditorModel["gates"]>((result, node) => {
    if (node.nodeType !== "GATE") return result;
    const identity = {
      id: node.id,
      kind: "GATE" as const,
      code: node.code ?? node.id,
      name: node.label,
      description: node.detail ?? "",
    };
    if (node.gate === "ATLEAST") {
      result.push({ ...identity, gateType: "K_OF_N", k: node.k ?? 1 });
    } else {
      result.push({ ...identity, gateType: node.gate ?? "OR" });
    }
    return result;
  }, []);
  const leafNodes = nodes.reduce<FaultTreeEditorModel["leafNodes"]>((result, node) => {
    if (node.nodeType === "GATE") return result;
    if (node.nodeType === "BASIC") {
      if (node.catalogueOnly !== true) {
        result.push({
          id: node.id,
          kind: "BASIC_EVENT_REFERENCE",
          basicEventId: node.basicEventId ?? legacyBasicEventId(node.id),
        });
      }
    } else {
      const identity = {
        id: node.id,
        code: node.code ?? node.id,
        name: node.label,
        description: node.detail ?? "",
      };
      if (node.nodeType === "HOUSE") {
        result.push({ ...identity, kind: "HOUSE_EVENT", state: node.houseState ?? false });
      } else if (node.nodeType === "TRANSFER") {
        result.push({
          ...identity,
          kind: "TRANSFER_REFERENCE",
          target: node.transferTarget ?? { modelId: node.id, entityId: node.id },
        });
      } else {
        result.push({ ...identity, kind: "UNDEVELOPED_EVENT" });
      }
    }
    return result;
  }, []);
  const explicitlyStoredTopGate = nodes.find(
    (node) => node.nodeType === "GATE" && node.isTopGate === true,
  );
  const hasExplicitTopGate = nodes.some(
    (node) => node.nodeType === "GATE" && node.isTopGate !== undefined,
  );
  const referencedNodeIds = new Set(gateInputs.map(({ childId }) => childId));
  const inferredTopGate =
    nodes.find(
      (node) => node.nodeType === "GATE" && !referencedNodeIds.has(node.id),
    ) ?? nodes.find(({ nodeType }) => nodeType === "GATE");
  const topGate = hasExplicitTopGate ? explicitlyStoredTopGate : inferredTopGate;

  const basicEvents = new Map<string, FaultTreeEditorCatalogue["basicEvents"][number]>();
  for (const node of nodes) {
    if (node.nodeType !== "BASIC") continue;
    const id = node.basicEventId ?? legacyBasicEventId(node.id);
    const existing = basicEvents.get(id);
    basicEvents.set(id, {
      id,
      code: node.basicEventCode ?? node.code ?? existing?.code ?? node.id,
      name: existing?.name ?? node.label,
      description: existing?.description ?? node.detail ?? "",
      probability: { value: node.probability ?? existing?.probability.value ?? 0 },
    });
  }

  return {
    model: {
      modelId: `IE-FQ:${sourceId}`,
      code: sourceId,
      name: sourceLabel,
      description: "Initiating-event frequency fault tree",
      topGate: topGate === undefined ? null : { gateId: topGate.id },
      gates,
      leafNodes,
      gateInputs,
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
      },
    },
    catalogue: {
      basicEvents: [...basicEvents.values()],
    },
  };
}

function sameInputs(
  left: readonly CanonicalGateInput[],
  right: readonly CanonicalGateInput[],
): boolean {
  return left.length === right.length && left.every((input, index) => {
    const other = right[index];
    return other !== undefined &&
      input.id === other.id &&
      input.gateId === other.gateId &&
      input.childId === other.childId &&
      input.order === other.order;
  });
}

function editorToFrequencyFaultTree(
  model: FaultTreeEditorModel,
  catalogue: FaultTreeEditorCatalogue,
  previousNodes: readonly FrequencyFaultTreeNode[] = [],
): FrequencyFaultTreeNode[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));
  const parentInputs = new Map<string, CanonicalGateInput[]>();
  for (const input of model.gateInputs) {
    const inputs = parentInputs.get(input.childId) ?? [];
    inputs.push(input);
    parentInputs.set(input.childId, inputs);
  }
  const previousGateIds = new Set(
    previousNodes.flatMap((node) => node.nodeType === "GATE" ? [node.id] : []),
  );
  const previousInputs = new Map<string, CanonicalGateInput[]>();
  for (const input of frequencyNodeInputs(previousNodes, previousGateIds)) {
    const inputs = previousInputs.get(input.childId) ?? [];
    inputs.push(input);
    previousInputs.set(input.childId, inputs);
  }
  const parentFieldsFor = (nodeId: string): Pick<FrequencyFaultTreeNode, "parentId" | "parentLinks"> => {
    const inputs = parentInputs.get(nodeId) ?? [];
    const previous = previousById.get(nodeId);
    const previousParentId = previous?.parentId;
    const parentId =
      previousParentId !== undefined && inputs.some(({ gateId }) => gateId === previousParentId)
        ? previousParentId
        : inputs[0]?.gateId;
    const expectedInputs = previousInputs.get(nodeId) ?? [];
    const storeParentLinks =
      previous?.parentLinks !== undefined || !sameInputs(inputs, expectedInputs);
    const includeLegacyParentId =
      parentId !== undefined &&
      (previous === undefined || previous.parentId !== undefined || previous.parentLinks === undefined);
    return {
      ...(includeLegacyParentId ? { parentId } : {}),
      ...(storeParentLinks
        ? {
            parentLinks: inputs.map(({ id, gateId, order }) => ({
              inputId: id,
              gateId,
              order,
            })),
          }
        : {}),
    };
  };
  const detailFor = (nodeId: string, description: string): string | undefined =>
    description.length > 0 || previousById.get(nodeId)?.detail !== undefined
      ? description
      : undefined;

  const inferredTopGateId =
    model.gates.find(({ id }) => (parentInputs.get(id) ?? []).length === 0)?.id;
  const selectedTopGateId = model.topGate?.gateId;
  const previousStoresTopGate = previousNodes.some(
    (node) => node.nodeType === "GATE" && node.isTopGate !== undefined,
  );
  const storeTopGate = previousStoresTopGate || selectedTopGateId !== inferredTopGateId;

  const codeFieldFor = (nodeId: string, code: string): Pick<FrequencyFaultTreeNode, "code"> =>
    previousById.get(nodeId)?.code !== undefined || code !== nodeId ? { code } : {};
  const basicEventCodeFieldsFor = (
    nodeId: string,
    code: string,
  ): Pick<FrequencyFaultTreeNode, "code" | "basicEventCode"> => {
    const previous = previousById.get(nodeId);
    return {
      ...(previous?.code !== undefined ? { code } : {}),
      ...(previous?.basicEventCode !== undefined ||
      (previous?.code === undefined && code !== nodeId)
        ? { basicEventCode: code }
        : {}),
    };
  };
  const topGateFieldFor = (nodeId: string): Pick<FrequencyFaultTreeNode, "isTopGate"> => {
    if (!storeTopGate) return {};
    if (selectedTopGateId === undefined) return { isTopGate: false };
    if (nodeId === selectedTopGateId) return { isTopGate: true };
    return previousById.get(nodeId)?.isTopGate === false ? { isTopGate: false } : {};
  };

  const converted = new Map<string, FrequencyFaultTreeNode>();
  for (const gate of model.gates) {
    const previous = previousById.get(gate.id);
    const gateType = gate.gateType === "K_OF_N" ? "ATLEAST" : gate.gateType;
    converted.set(gate.id, {
      id: gate.id,
      ...parentFieldsFor(gate.id),
      label: gate.name,
      ...codeFieldFor(gate.id, gate.code),
      nodeType: "GATE",
      ...(gateType === "OR" && previous?.gate === undefined ? {} : { gate: gateType }),
      ...(gate.gateType === "K_OF_N" ? { k: gate.k } : {}),
      ...(detailFor(gate.id, gate.description) === undefined
        ? {}
        : { detail: detailFor(gate.id, gate.description) }),
      ...topGateFieldFor(gate.id),
    });
  }
  for (const leaf of model.leafNodes) {
    const previous = previousById.get(leaf.id);
    const common = {
      id: leaf.id,
      ...parentFieldsFor(leaf.id),
    };
    if (leaf.kind === "BASIC_EVENT_REFERENCE") {
      const event = catalogue.basicEvents.find(({ id }) => id === leaf.basicEventId);
      const basicEventId = event?.id ?? leaf.basicEventId;
      const probability = event?.probability.value ?? 0;
      converted.set(leaf.id, {
        ...common,
        label: event?.name ?? leaf.basicEventId,
        nodeType: "BASIC",
        ...(previous?.basicEventId !== undefined || basicEventId !== legacyBasicEventId(leaf.id)
          ? { basicEventId }
          : {}),
        ...(event === undefined ? {} : basicEventCodeFieldsFor(leaf.id, event.code)),
        ...(previous?.probability !== undefined || probability !== 0 ? { probability } : {}),
        ...(detailFor(leaf.id, event?.description ?? "") === undefined
          ? {}
          : { detail: detailFor(leaf.id, event?.description ?? "") }),
      });
      continue;
    }
    converted.set(leaf.id, {
      ...common,
      label: leaf.name,
      ...codeFieldFor(leaf.id, leaf.code),
      nodeType:
        leaf.kind === "HOUSE_EVENT"
          ? "HOUSE"
          : leaf.kind === "TRANSFER_REFERENCE"
            ? "TRANSFER"
            : "UNDEVELOPED",
      ...(detailFor(leaf.id, leaf.description) === undefined
        ? {}
        : { detail: detailFor(leaf.id, leaf.description) }),
      ...(leaf.kind === "HOUSE_EVENT" &&
      (previous?.houseState !== undefined || leaf.state)
        ? { houseState: leaf.state }
        : {}),
      ...(leaf.kind === "TRANSFER_REFERENCE" &&
      (previous?.transferTarget !== undefined ||
        leaf.target.modelId !== leaf.id ||
        leaf.target.entityId !== leaf.id)
        ? { transferTarget: leaf.target }
        : {}),
    });
  }

  const referencedBasicEventIds = new Set(
    model.leafNodes.flatMap((leaf) =>
      leaf.kind === "BASIC_EVENT_REFERENCE" ? [leaf.basicEventId] : [],
    ),
  );
  for (const event of catalogue.basicEvents) {
    if (referencedBasicEventIds.has(event.id)) continue;
    const nodeId = converted.has(event.id) ? `${event.id}:NODE` : event.id;
    converted.set(nodeId, {
      id: nodeId,
      label: event.name,
      nodeType: "BASIC",
      catalogueOnly: true,
      ...(event.id === legacyBasicEventId(nodeId) ? {} : { basicEventId: event.id }),
      ...basicEventCodeFieldsFor(nodeId, event.code),
      ...(event.probability.value === 0 ? {} : { probability: event.probability.value }),
      ...(event.description.length === 0 ? {} : { detail: event.description }),
    });
  }

  const result = previousNodes.flatMap(({ id }) => {
    const node = converted.get(id);
    if (node === undefined) return [];
    converted.delete(id);
    return [node];
  });
  return [...result, ...converted.values()];
}

function NumField({ value, onChange, disabled, placeholder }: { value: number | undefined; onChange: (v: number) => void; disabled: boolean; placeholder?: string }): JSX.Element {
  const [text, setText] = useState<string>(value !== undefined && value !== 0 ? String(value) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value !== undefined && value !== 0 ? String(value) : "");
  }, [value, focused]);
  return (
    <input
      className="iefq-num"
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t);
        if (t.trim() !== "" && isFinite(n) && n >= 0) onChange(n);
      }}
    />
  );
}

interface IeFrequencyQuantificationEditorProps {
  sources: FrequencyDataSource[];
  primaryId: string | undefined;
  numberOfModules: number;
  editable: boolean;
  onChange: (sources: FrequencyDataSource[], primaryId: string | undefined, rolledMean: number | null) => void;
}

export function IeFrequencyQuantificationEditor({ sources, primaryId, numberOfModules, editable, onChange }: IeFrequencyQuantificationEditorProps): JSX.Element {
  const effectivePrimary = sources.find((s) => s.uuid === primaryId) ?? sources[0];
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(effectivePrimary !== undefined ? [effectivePrimary.uuid] : []));
  const [treeSourceId, setTreeSourceId] = useState<string | null>(null);
  const [faultTreeSelection, setFaultTreeSelection] = useState<FaultTreeSelection>(null);
  const treeSource = treeSourceId !== null ? sources.find((s) => s.uuid === treeSourceId) : undefined;
  const treeNodes = useMemo(
    () =>
      treeSource === undefined
        ? []
        : treeSource.faultTree !== undefined && treeSource.faultTree.length > 0
          ? treeSource.faultTree
          : starterTree(treeSource.label),
    [treeSource],
  );
  const treeSnapshot = useMemo(
    () =>
      treeSource === undefined
        ? null
        : frequencyFaultTreeToEditor(treeSource.uuid, treeSource.label, treeNodes),
    [treeNodes, treeSource],
  );

  useEffect(() => setFaultTreeSelection(null), [treeSourceId]);

  const toggleOpen = (uuid: string): void => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };
  const setAll = (open: boolean): void => {
    setOpenIds(open ? new Set(sources.map((s) => s.uuid)) : new Set());
  };

  const emit = (next: FrequencyDataSource[], nextPrimary: string | undefined): void => {
    const primary = next.find((s) => s.uuid === nextPrimary) ?? next[0];
    const rolled = primary !== undefined ? moduleAdjusted(sourceMean(primary), primary.perModule, numberOfModules) : null;
    onChange(next, primary?.uuid, rolled);
  };
  const patch = (uuid: string, p: Partial<FrequencyDataSource>): void => {
    emit(sources.map((s) => (s.uuid === uuid ? { ...s, ...p } : s)), primaryId);
  };
  const changeBasis = (s: FrequencyDataSource, basis: FrequencyQuantificationBasis): void => {
    const allowed = (PEDIGREE_BY_BASIS[basis] ?? []).map((o) => o.value);
    const pedigree = s.pedigree !== undefined && allowed.includes(s.pedigree) ? s.pedigree : undefined;
    patch(s.uuid, { basis, pedigree });
  };
  const setParam = (s: FrequencyDataSource, i: number, v: number): void => {
    const arr = [...(s.distributionParameters ?? [])];
    while (arr.length <= i) arr.push(0);
    arr[i] = v;
    patch(s.uuid, { distributionParameters: arr });
  };
  const add = (): void => {
    const created: FrequencyDataSource = {
      uuid: nextSourceId(sources),
      label: "New data source",
      basis: "GENERIC_DATA",
      perModule: false,
      sourceReference: "",
      distributionFamily: "POINT",
      distributionParameters: [0],
    };
    setOpenIds((prev) => new Set(prev).add(created.uuid));
    emit([...sources, created], primaryId ?? created.uuid);
  };
  const del = (uuid: string): void => {
    const next = sources.filter((s) => s.uuid !== uuid);
    emit(next, primaryId === uuid ? next[0]?.uuid : primaryId);
  };

  return (
    <div className="iefq">
      <div className="iefq__hero">
        <div className="iefq__hero-block">
          <span className="iefq__hero-val">{fmtFreq(effectivePrimary !== undefined ? moduleAdjusted(sourceMean(effectivePrimary), effectivePrimary.perModule, numberOfModules) : null)}</span>
          <span className="iefq__hero-unit">per plant-yr</span>
        </div>
        <span className="iefq__hero-cap">{sources.length} data source{sources.length === 1 ? "" : "s"} · the primary source sets the frequency. Click a source to expand it; right-click a fault-tree node to edit.</span>
        <span className="iefq__hero-spacer" />
        <div className="iefq__hero-actions">
          <button type="button" className="iefq__ghost" onClick={() => setAll(true)}>Expand all</button>
          <button type="button" className="iefq__ghost" onClick={() => setAll(false)}>Collapse all</button>
          {editable && <button type="button" className="iefq__add" onClick={add}>+ Add data source</button>}
        </div>
      </div>

      <div className="iefq__body">
        {sources.length === 0 ? (
          <div className="iefq__empty">No data sources yet.{editable ? " Add one to start building the frequency from data." : ""}</div>
        ) : (
          sources.map((s) => {
            const isPrimary = effectivePrimary !== undefined && s.uuid === effectivePrimary.uuid;
            const isOpen = openIds.has(s.uuid);
            const family = s.distributionFamily ?? "POINT";
            const pedigreeOptions = PEDIGREE_BY_BASIS[s.basis] ?? [];
            const mean = moduleAdjusted(sourceMean(s), s.perModule, numberOfModules);
            return (
              <div key={s.uuid} className={`iefq-card${isPrimary ? " iefq-card--primary" : ""}`}>
                <div className="iefq-card__bar">
                  <button type="button" className={`iefq-card__toggle${isOpen ? " iefq-card__toggle--open" : ""}`} onClick={() => toggleOpen(s.uuid)} aria-label={isOpen ? "Collapse source" : "Expand source"}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                  <label className="iefq-card__radio" title="Use this source for the frequency">
                    <input type="radio" name="iefq-primary" checked={isPrimary} disabled={!editable} onChange={() => emit(sources, s.uuid)} />
                    <span>Primary</span>
                  </label>
                  {editable && isOpen
                    ? <input className="iefq-card__label" value={s.label} onChange={(e) => patch(s.uuid, { label: e.target.value })} />
                    : <button type="button" className="iefq-card__label-text" onClick={() => toggleOpen(s.uuid)}>{s.label}</button>}
                  <span className="iefq-card__chip">{BASIS_SHORT[s.basis] ?? s.basis}</span>
                  <span className="iefq-card__mean">{fmtFreq(mean)}</span>
                  {editable && <button type="button" className="iefq-card__del" onClick={() => del(s.uuid)} aria-label="Delete data source">✕</button>}
                </div>

                {isOpen && (
                  <>
                    <div className="iefq-row">
                      <div className="iefq-field">
                        <span className="iefq-field__label">Basis</span>
                        <select className="iefq-select" value={s.basis} disabled={!editable} onChange={(e) => changeBasis(s, e.target.value as FrequencyQuantificationBasis)}>
                          {BASIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div className="iefq-field">
                        <span className="iefq-field__label">Rate basis</span>
                        <button type="button" className={`iefq-toggle${s.perModule ? " iefq-toggle--on" : ""}`} disabled={!editable} onClick={() => patch(s.uuid, { perModule: !s.perModule })}>
                          {s.perModule ? "Per module" : "Per site"}
                        </button>
                      </div>
                    </div>

                    <div className="iefq-field iefq-card__ref">
                      <span className="iefq-field__label">Source / justification</span>
                      {editable
                        ? <textarea className="iefq-textarea" rows={4} value={s.sourceReference} onChange={(e) => patch(s.uuid, { sourceReference: e.target.value })} />
                        : <span className="iefq-text">{s.sourceReference}</span>}
                    </div>

                    {s.basis === "OPERATING_DATA" && (
                      <div className="iefq-section">
                        <div className="iefq-section__title">Plant operating data, Bayesian update</div>
                        <div className="iefq-row">
                          <div className="iefq-field">
                            <span className="iefq-field__label">Events observed</span>
                            <NumField value={s.eventCount} disabled={!editable} placeholder="0" onChange={(v) => patch(s.uuid, { eventCount: v })} />
                          </div>
                          <div className="iefq-field">
                            <span className="iefq-field__label">Exposure (reactor-yr)</span>
                            <NumField value={s.exposureModuleYears} disabled={!editable} placeholder="e.g. 15" onChange={(v) => patch(s.uuid, { exposureModuleYears: v })} />
                          </div>
                        </div>
                        <div className="iefq-row">
                          <div className="iefq-field">
                            <span className="iefq-field__label">Prior mean (optional)</span>
                            <NumField value={s.priorMean} disabled={!editable} placeholder="noninformative" onChange={(v) => patch(s.uuid, { priorMean: v })} />
                          </div>
                          <div className="iefq-field">
                            <span className="iefq-field__label">Prior weight (pseudo-events)</span>
                            <NumField value={s.priorWeightPseudoEvents} disabled={!editable} placeholder="noninformative" onChange={(v) => patch(s.uuid, { priorWeightPseudoEvents: v })} />
                          </div>
                        </div>
                        <div className="iefq-note">Gamma-Poisson update. With no prior it uses a noninformative Jeffreys prior, giving (events + 0.5) / exposure.</div>
                      </div>
                    )}

                    {isDistributionBasis(s.basis) && (
                      <div className="iefq-section">
                        <div className="iefq-section__title">Read a value or distribution</div>
                        <div className="iefq-row">
                          <div className="iefq-field">
                            <span className="iefq-field__label">Data lineage</span>
                            <select className="iefq-select" value={s.pedigree ?? ""} disabled={!editable} onChange={(e) => patch(s.uuid, { pedigree: e.target.value === "" ? undefined : (e.target.value as FrequencyDataPedigree) })}>
                              <option value="">Not specified</option>
                              {pedigreeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div className="iefq-field">
                            <span className="iefq-field__label">Distribution</span>
                            <select className="iefq-select" value={family} disabled={!editable} onChange={(e) => patch(s.uuid, { distributionFamily: e.target.value as FrequencyDistributionFamily })}>
                              {FAMILY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="iefq-row">
                          {PARAM_LABELS[family].map((lbl, i) => (
                            <div key={lbl} className="iefq-field">
                              <span className="iefq-field__label">{lbl}</span>
                              <NumField value={s.distributionParameters?.[i]} disabled={!editable} onChange={(v) => setParam(s, i, v)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.basis === "FAULT_TREE" && (
                      <div className="iefq-section">
                        <div className="iefq-section__title">Fault tree</div>
                        <div className="iefq-row">
                          <div className="iefq-field">
                            <span className="iefq-field__label">Top-event mean frequency</span>
                            <NumField value={s.faultTreeTopMean} disabled={!editable} placeholder="e.g. 1e-3" onChange={(v) => patch(s.uuid, { faultTreeTopMean: v })} />
                          </div>
                        </div>
                        <div className="iefq-ftsummary">
                          <span className="iefq-ftsummary__text">{s.faultTree?.length ?? 1} node{(s.faultTree?.length ?? 1) === 1 ? "" : "s"} · open the full-screen editor to view, pan, zoom and edit the tree.</span>
                          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setTreeSourceId(s.uuid)}>Open fault tree editor →</button>
                        </div>
                      </div>
                    )}

                  </>
                )}
              </div>
            );
          })
        )}
      </div>
      {treeSource !== undefined && treeSnapshot !== null && createPortal(
        <div className="iefq-ftmodal">
          <div className="iefq-ftmodal__head">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setTreeSourceId(null)}>&larr; Back to data sources</button>
            <span className="iefq-ftmodal__title">Fault tree &middot; {treeSource.label}</span>
          </div>
          <div className="iefq-ftmodal__body">
            <FaultTreeEditor
              model={treeSnapshot.model}
              catalogue={treeSnapshot.catalogue}
              capabilities={
                editable
                  ? FREQUENCY_FAULT_TREE_CAPABILITIES
                  : FREQUENCY_FAULT_TREE_READ_ONLY_CAPABILITIES
              }
              selection={faultTreeSelection}
              validation={validateFaultTreeModel(treeSnapshot.model, {
                basicEventCatalogue: {
                  workbookId: "IE",
                  basicEvents: treeSnapshot.catalogue.basicEvents,
                },
                availableTransferTargets: treeSnapshot.model.leafNodes.flatMap((leaf) =>
                  leaf.kind === "TRANSFER_REFERENCE" ? [leaf.target] : [],
                ),
              })}
              saveState="saved"
              analysisResult={null}
              resultIsStale={false}
              transferTargets={treeSnapshot.model.leafNodes.flatMap((leaf) =>
                leaf.kind === "TRANSFER_REFERENCE"
                  ? [{
                      target: leaf.target,
                      code: leaf.code,
                      name: leaf.name,
                      description: leaf.description,
                    }]
                  : [],
              )}
              onOperation={(operation) => {
                const next = applyFaultTreeOperation(
                  treeSnapshot.model,
                  treeSnapshot.catalogue,
                  operation,
                );
                patch(treeSource.uuid, {
                  ...(operation.type === "UPDATE_MODEL" && operation.patch.name !== undefined
                    ? { label: operation.patch.name }
                    : {}),
                  faultTree: editorToFrequencyFaultTree(next.model, next.catalogue, treeNodes),
                });
              }}
              onSelectionChange={setFaultTreeSelection}
              onOpenReference={() => undefined}
              onRun={() => undefined}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export {
  editorToFrequencyFaultTree,
  frequencyFaultTreeToEditor,
};
export type { FrequencyFaultTreeSnapshot };
