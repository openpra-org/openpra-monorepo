import {
  type ChangeEvent,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BayesianNetworkCptRow,
  BayesianNetworkEvidenceConfiguration,
  HclEvidenceScenario,
  BayesianNetworkModuleTemplate,
  BayesianNetworkNode,
} from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  addNode,
  autoArrange,
  canConnect,
  connectNodes,
  deleteNode,
  disconnectNodes,
  newId,
  normalizeCptRow,
  rebuildNodeAndChildren,
  reorderParents,
  replaceCpt,
  uniqueCode,
} from "./bayesianNetworkOperations";
import {
  exportBayesianNetworkJson,
  exportBayesianNetworkXdsl,
  importBayesianNetworkJson,
  importBayesianNetworkXdsl,
} from "./bayesianNetworkInterchange";
import {
  compatibleBayesianNetworkModuleInputNodes,
  createBayesianNetworkModuleFromBranch,
  deleteBayesianNetworkModuleInstance,
  deleteBayesianNetworkModuleTemplate,
  instantiateBayesianNetworkModule,
} from "./bayesianNetworkModules";
import type { BayesianNetworkEditorProps } from "./bayesianNetworkTypes";
import { useEditorConfirmation } from "../shared";
import { HclBindingEditor } from "../hybrid-causal-logic";
import {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
} from "../hybrid-causal-logic/hclEvidenceScenarioInterchange";
import { useToast } from "../../toast/toastProvider";
import "./css/bayesianNetwork.css";

interface DragState {
  pointerId: number;
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

type ConnectionSide = "top" | "right" | "bottom" | "left";

interface ConnectionDragState {
  pointerId: number;
  parentNodeId: string;
  start: { x: number; y: number };
  current: { x: number; y: number };
  candidateNodeId: string | null;
  dockSide: ConnectionSide | null;
}

interface EdgeContextMenuState {
  edgeId: string;
  x: number;
  y: number;
}

interface ModuleInstanceDraft {
  code: string;
  name: string;
  inputBindings: Record<string, string>;
}

interface NodeIdentityDraft {
  nodeId: string;
  code: string;
  name: string;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const ZOOM_EPSILON = 1e-6;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 84;
const DOCK_REVEAL_MARGIN = 28;
const DOCK_RADIUS = 22;
const CONNECTION_SIDES = ["top", "right", "bottom", "left"] as const;

function EditorIcon({
  name,
}: {
  name: "undo" | "redo" | "file" | "modules" | "add-node" | "zoom-out" | "zoom-in" | "fit" | "auto-layout" | "trash" | "run" | "configuration" | "evidence";
}): JSX.Element {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };
  return (
    <svg className="bneditor__button-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "undo" && <><path {...common} d="M9 7H4V2" /><path {...common} d="M4.5 7A9 9 0 1 1 7 19.5" /></>}
      {name === "redo" && <><path {...common} d="M15 7h5V2" /><path {...common} d="M19.5 7A9 9 0 1 0 17 19.5" /></>}
      {name === "file" && <><path {...common} d="M6 3h8l4 4v14H6z" /><path {...common} d="M14 3v5h4" /><path {...common} d="M9 13h6M9 17h6" /></>}
      {name === "modules" && <><rect {...common} x="4" y="4" width="7" height="7" rx="1.5" /><rect {...common} x="13" y="4" width="7" height="7" rx="1.5" /><rect {...common} x="8.5" y="13" width="7" height="7" rx="1.5" /><path {...common} d="M11 7.5h2M8 11v2.5M16 11v2.5" /></>}
      {name === "add-node" && <><rect {...common} x="4" y="4" width="16" height="16" rx="3" /><path {...common} d="M12 8v8M8 12h8" /></>}
      {name === "trash" && <><path {...common} d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>}
      {name === "run" && <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m10 8.5 6 3.5-6 3.5z" /></>}
      {name === "configuration" && <><circle {...common} cx="6" cy="12" r="3" /><circle {...common} cx="18" cy="6" r="3" /><circle {...common} cx="18" cy="18" r="3" /><path {...common} d="m9 11 6-4M9 13l6 4" /></>}
      {name === "evidence" && <><path {...common} d="M4 7h16M4 17h16" /><circle {...common} cx="9" cy="7" r="2" /><circle {...common} cx="15" cy="17" r="2" /></>}
      {(name === "zoom-out" || name === "zoom-in") && <><circle {...common} cx="10.5" cy="10.5" r="6.5" /><path {...common} d="m15.5 15.5 5 5M7.5 10.5h6" />{name === "zoom-in" && <path {...common} d="M10.5 7.5v6" />}</>}
      {name === "fit" && <><path {...common} d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /><rect {...common} x="8" y="8" width="8" height="8" rx="1" /></>}
      {name === "auto-layout" && <><rect {...common} x="9" y="3" width="6" height="5" rx="1" /><rect {...common} x="3" y="16" width="6" height="5" rx="1" /><rect {...common} x="15" y="16" width="6" height="5" rx="1" /><path {...common} d="M12 8v4M6 12h12M6 12v4M18 12v4" /></>}
    </svg>
  );
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function connectionPoint(
  position: { x: number; y: number },
  side: ConnectionSide,
  height = NODE_HEIGHT,
): { x: number; y: number } {
  if (side === "top") return { x: position.x + NODE_WIDTH / 2, y: position.y };
  if (side === "right") return { x: position.x + NODE_WIDTH, y: position.y + height / 2 };
  if (side === "bottom") return { x: position.x + NODE_WIDTH / 2, y: position.y + height };
  return { x: position.x, y: position.y + height / 2 };
}

function edgePath(
  parent: { x: number; y: number },
  child: { x: number; y: number },
  parentHeight = NODE_HEIGHT,
  childHeight = NODE_HEIGHT,
): string {
  const parentCenter = { x: parent.x + NODE_WIDTH / 2, y: parent.y + parentHeight / 2 };
  const childCenter = { x: child.x + NODE_WIDTH / 2, y: child.y + childHeight / 2 };
  const dx = childCenter.x - parentCenter.x;
  const dy = childCenter.y - parentCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const start = connectionPoint(parent, dx >= 0 ? "right" : "left", parentHeight);
    const end = connectionPoint(child, dx >= 0 ? "left" : "right", childHeight);
    const controlX = (start.x + end.x) / 2;
    return `M ${String(start.x)} ${String(start.y)} C ${String(controlX)} ${String(start.y)}, ${String(controlX)} ${String(end.y)}, ${String(end.x)} ${String(end.y)}`;
  }
  const start = connectionPoint(parent, dy >= 0 ? "bottom" : "top", parentHeight);
  const end = connectionPoint(child, dy >= 0 ? "top" : "bottom", childHeight);
  const controlY = (start.y + end.y) / 2;
  return `M ${String(start.x)} ${String(start.y)} C ${String(start.x)} ${String(controlY)}, ${String(end.x)} ${String(controlY)}, ${String(end.x)} ${String(end.y)}`;
}

function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createQueryBatchSamples(model: BayesianNetworkModel): HclEvidenceScenario[] {
  const sampleNodes = model.nodes.filter((node) => node.states.length > 0).slice(0, 3);
  if (sampleNodes.length === 0) return [];
  return [0, 1].map((scenarioIndex) => ({
    id: newId(),
    code: `SAMPLE-${String(scenarioIndex + 1).padStart(2, "0")}`,
    name: `Sample evidence ${String(scenarioIndex + 1)}`,
    enabled: true,
    evidence: {
      observations: sampleNodes.map((node) => ({
        nodeId: node.id,
        stateId: node.states[scenarioIndex % node.states.length]!.id,
      })),
    },
  }));
}

function cptDraftKey(rowId: string, stateId: string): string {
  return `${rowId}:${stateId}`;
}

function cptDraftValue(
  row: BayesianNetworkCptRow,
  stateId: string,
  drafts: Record<string, string>,
): string {
  const key = cptDraftKey(row.id, stateId);
  const draft = drafts[key];
  if (draft !== undefined) return draft;
  const value = row.values.find((candidate) => candidate.stateId === stateId);
  return value === undefined ? "" : value.probability.toFixed(2);
}

function cptDraftRowStatus(
  row: BayesianNetworkCptRow,
  drafts: Record<string, string>,
): { probabilities: number[]; total: number; valid: boolean } {
  const probabilities = row.values.map((value) => {
    const draft = drafts[cptDraftKey(row.id, value.stateId)];
    if (draft === undefined) return value.probability;
    return draft.trim() === "" ? Number.NaN : Number(draft);
  });
  const valuesValid = probabilities.every((probability) =>
    Number.isFinite(probability) && probability >= 0 && probability <= 1,
  );
  const total = valuesValid
    ? probabilities.reduce((sum, probability) => sum + probability, 0)
    : Number.NaN;
  return {
    probabilities,
    total,
    valid: valuesValid && Math.abs(total - 1) <= 1e-9,
  };
}


function BayesianNetworkEditor(props: BayesianNetworkEditorProps): JSX.Element {
  const {
    model,
    editable,
    showAnalysis = true,
    showQueryAnalysis = true,
    showHclAnalysis = true,
    hclScope = "BOTH",
    evidence,
    queryNodeId,
    validation,
    analysisResult,
    queryBatchResult = null,
    running,
    runError,
    workbookId,
    hclConfigurations,
    faultTreeOptions,
    eventTreeOptions,
    hclRunning,
    hclRunError,
    hclRunResult,
    hclBatchRunResult,
    onModelChange,
    onEvidenceChange,
    onQueryNodeChange,
    onHclConfigurationsChange,
    onRunHclFaultTree,
    onRunHclEventTree,
    onRunHclFaultTreeBatch,
    onRunHclEventTreeBatch,
    onRun,
    onRunBatch,
  } = props;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(model.nodes[0]?.id ?? null);
  const [displayZoom, setDisplayZoom] = useState(() => clampZoom(model.layout.viewport.zoom));
  const persistedZoomRef = useRef(clampZoom(model.layout.viewport.zoom));
  const userChangedZoomRef = useRef(false);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const { addToast } = useToast();
  const history = useRef<BayesianNetworkModel[]>([]);
  const future = useRef<BayesianNetworkModel[]>([]);
  const importRef = useRef<HTMLInputElement>(null);
  const moduleMenuRef = useRef<HTMLDetailsElement>(null);
  const queryBatchSampleMenuRef = useRef<HTMLDetailsElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageContentRef = useRef<HTMLDivElement>(null);
  const nodeShellRefs = useRef(new Map<string, HTMLDivElement>());
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [calculationType, setCalculationType] = useState<"BN_QUERY" | "PROBABILITY" | "CUT_SETS" | "UNCERTAINTY" | "IMPORTANCE">(
    showQueryAnalysis ? "BN_QUERY" : "PROBABILITY",
  );
  const [quantificationWorkflow, setQuantificationWorkflow] = useState<"MANUAL" | "BATCH" | null>(null);
  const [queryBatchScenarios, setQueryBatchScenarios] = useState<HclEvidenceScenario[]>([]);
  const [queryBatchError, setQueryBatchError] = useState<string | null>(null);
  const queryBatchImportRef = useRef<HTMLInputElement>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, ModuleInstanceDraft>>({});
  const importKind = useRef<"XDSL" | "JSON">("XDSL");
  const modelIdRef = useRef(model.modelId);
  const selectedNode = model.nodes.find((node) => node.id === selectedNodeId);
  const [nodeIdentityDraft, setNodeIdentityDraft] = useState<NodeIdentityDraft | null>(() =>
    selectedNode === undefined
      ? null
      : { nodeId: selectedNode.id, code: selectedNode.code, name: selectedNode.name },
  );
  const [stateCodeDrafts, setStateCodeDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(model.nodes.flatMap((node) => node.states.map((state) => [state.id, state.code]))),
  );
  const [cptValueDrafts, setCptValueDrafts] = useState<Record<string, string>>({});
  const selectedTable = model.conditionalProbabilityTables.find((table) => table.nodeId === selectedNodeId);
  const selectedModuleInstance = model.moduleInstances?.find((instance) =>
    instance.nodeMappings.some((mapping) => mapping.nodeId === selectedNodeId),
  );
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const positionById = useMemo(() => new Map(model.nodePositions.map((entry) => [entry.nodeId, entry.position])), [model.nodePositions]);
  const evidenceNodes = useMemo(() => {
    const query = evidenceSearch.trim().toLowerCase();
    if (query === "") return model.nodes;
    return model.nodes.filter((node) =>
      node.code.toLowerCase().includes(query)
      || node.name.toLowerCase().includes(query),
    );
  }, [evidenceSearch, model.nodes]);
  const queryBatchSamples = useMemo(() => createQueryBatchSamples(model), [model.nodes]);

  useEffect(() => {
    if (modelIdRef.current === model.modelId) return;
    modelIdRef.current = model.modelId;
    history.current = [];
    future.current = [];
    setConnectionDrag(null);
    setEdgeContextMenu(null);
    setCptValueDrafts({});
    userChangedZoomRef.current = false;
    setSelectedNodeId(model.nodes[0]?.id ?? null);
    setDisplayZoom(clampZoom(model.layout.viewport.zoom));
  }, [model.modelId, model.nodes]);
  useEffect(() => {
    const persistedZoom = clampZoom(model.layout.viewport.zoom);
    persistedZoomRef.current = persistedZoom;
    setDisplayZoom(persistedZoom);
  }, [model.layout.viewport.zoom]);
  useEffect(() => {
    if (selectedNodeId === null || model.nodes.some((node) => node.id === selectedNodeId)) return;
    setSelectedNodeId(model.nodes[0]?.id ?? null);
  }, [model.nodes, selectedNodeId]);
  useEffect(() => {
    setNodeIdentityDraft((current) => {
      if (selectedNode === undefined) return null;
      if (
        current?.nodeId === selectedNode.id
        && (current.code.trim() === "" || current.name.trim() === "")
      ) return current;
      return { nodeId: selectedNode.id, code: selectedNode.code, name: selectedNode.name };
    });
  }, [selectedNode]);
  useEffect(() => {
    setStateCodeDrafts((current) => Object.fromEntries(model.nodes.flatMap((node) =>
      node.states.map((state) => [
        state.id,
        current[state.id]?.trim() === "" ? current[state.id] : state.code,
      ]),
    )));
  }, [model.nodes]);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      setNodeHeights((current) => {
        let changed = false;
        const next = { ...current };
        for (const entry of entries) {
          const nodeId = (entry.target as HTMLElement).dataset.bnNodeId;
          if (nodeId === undefined) continue;
          const height = Math.max(NODE_HEIGHT, Math.ceil(entry.contentRect.height));
          if (next[nodeId] === height) continue;
          next[nodeId] = height;
          changed = true;
        }
        return changed ? next : current;
      });
    });
    nodeShellRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [model.nodes]);
  useEffect(() => {
    if (edgeContextMenu === null) return undefined;
    const closeOnPointerDown = (event: PointerEvent): void => {
      if ((event.target as HTMLElement).closest(".bneditor__edge-menu") === null) {
        setEdgeContextMenu(null);
      }
    };
    const closeOnKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setEdgeContextMenu(null);
    };
    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [edgeContextMenu]);
  useEffect(() => {
    const menus = (): Array<HTMLDetailsElement | null> => [
      moduleMenuRef.current,
      queryBatchSampleMenuRef.current,
    ];
    const closeMenus = (event: PointerEvent): void => {
      for (const menu of menus()) {
        if (
          menu?.open === true
          && event.target instanceof Node
          && !menu.contains(event.target)
        ) menu.open = false;
      }
    };
    const closeMenusOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      for (const menu of menus()) {
        if (menu !== null) menu.open = false;
      }
    };
    window.addEventListener("pointerdown", closeMenus);
    window.addEventListener("keydown", closeMenusOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenus);
      window.removeEventListener("keydown", closeMenusOnEscape);
    };
  }, []);

  function commit(next: BayesianNetworkModel, record = true): void {
    if (!editable) return;
    if (record) {
      history.current.push(model);
      if (history.current.length > 100) history.current.shift();
      future.current = [];
    }
    onModelChange(next);
    setOperationError(null);
  }

  function undo(): void {
    const previous = history.current.pop();
    if (previous === undefined) return;
    future.current.push(model);
    commit(previous, false);
  }

  function redo(): void {
    const next = future.current.pop();
    if (next === undefined) return;
    history.current.push(model);
    commit(next, false);
  }

  function confirmRebuild(message: string, action: () => void): void {
    requestConfirmation({
      title: "Rebuild probability tables?",
      message: `${message}\n\nThe affected CPT will be rebuilt with uniform values. Existing probabilities will not be reinterpreted.`,
      confirmLabel: "Rebuild CPTs",
    }, action);
  }

  function addNewNode(): void {
    const added = addNode(model);
    commit(added.model);
    setSelectedNodeId(added.nodeId);
  }

  function updateSelectedNode(node: BayesianNetworkNode): void {
    commit({ ...model, nodes: model.nodes.map((candidate) => candidate.id === node.id ? node : candidate) });
  }

  function updateSelectedNodeIdentity(field: "code" | "name", value: string): void {
    if (selectedNode === undefined) return;
    setNodeIdentityDraft((current) => ({
      nodeId: selectedNode.id,
      code: current?.nodeId === selectedNode.id ? current.code : selectedNode.code,
      name: current?.nodeId === selectedNode.id ? current.name : selectedNode.name,
      [field]: value,
    }));
    if (value.trim() === "") {
      addToast({
        id: `bn-node-${field}-required`,
        type: "warning",
        message: `Node ${field} is required.`,
      });
      return;
    }
    if (
      field === "code"
      && model.nodes.some((node) =>
        node.id !== selectedNode.id
        && node.code.trim().toUpperCase() === value.trim().toUpperCase(),
      )
    ) {
      addToast({
        id: "bn-node-code-duplicate",
        type: "warning",
        message: "Bayesian-network node codes must be unique.",
      });
      return;
    }
    updateSelectedNode({ ...selectedNode, [field]: value });
  }

  function addState(): void {
    if (selectedNode === undefined) return;
    if (selectedModuleInstance !== undefined) {
      setOperationError("Module instance states follow the reusable template and cannot be added locally.");
      return;
    }
    const code = uniqueCode("STATE", selectedNode.states.map((state) => state.code));
    const updated = {
      ...selectedNode,
      states: [...selectedNode.states, { id: newId(), code, name: "New state" }] as BayesianNetworkNode["states"],
    };
    confirmRebuild("Adding a state changes this node and every child CPT.", () => {
      commit(rebuildNodeAndChildren({
        ...model,
        nodes: model.nodes.map((node) => node.id === updated.id ? updated : node),
      }, updated.id));
    });
  }

  function updateSelectedStateCode(stateId: string, value: string): void {
    if (selectedNode === undefined) return;
    setStateCodeDrafts((current) => ({ ...current, [stateId]: value }));
    if (value.trim() === "") {
      addToast({
        id: "bn-state-code-required",
        type: "warning",
        message: "State code is required.",
      });
      return;
    }
    updateSelectedNode({
      ...selectedNode,
      states: selectedNode.states.map((candidate) =>
        candidate.id === stateId ? { ...candidate, code: value } : candidate,
      ) as BayesianNetworkNode["states"],
    });
  }

  function removeState(stateId: string): void {
    if (selectedModuleInstance !== undefined) {
      setOperationError("Module instance states follow the reusable template and cannot be removed locally.");
      return;
    }
    if (selectedNode === undefined || selectedNode.states.length <= 2) {
      setOperationError("A discrete Bayesian-network node requires at least two states.");
      return;
    }
    const updated = {
      ...selectedNode,
      states: selectedNode.states.filter((state) => state.id !== stateId) as BayesianNetworkNode["states"],
    };
    confirmRebuild("Removing a state changes this node and every child CPT.", () => {
      commit(rebuildNodeAndChildren({
        ...model,
        nodes: model.nodes.map((node) => node.id === updated.id ? updated : node),
      }, updated.id));
    });
  }

  function moveState(stateId: string, direction: -1 | 1): void {
    if (selectedNode === undefined) return;
    if (selectedModuleInstance !== undefined) {
      setOperationError("Module instance state order follows the reusable template.");
      return;
    }
    const index = selectedNode.states.findIndex((state) => state.id === stateId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedNode.states.length) return;
    const states = [...selectedNode.states];
    [states[index], states[nextIndex]] = [states[nextIndex]!, states[index]!];
    const updated = { ...selectedNode, states: states as BayesianNetworkNode["states"] };
    confirmRebuild("Reordering states changes CPT interpretation.", () => {
      commit(rebuildNodeAndChildren({
        ...model,
        nodes: model.nodes.map((node) => node.id === updated.id ? updated : node),
      }, updated.id));
    });
  }

  function graphCoordinates(clientX: number, clientY: number): { x: number; y: number } | null {
    const stage = stageContentRef.current;
    if (stage === null) return null;
    const bounds = stage.getBoundingClientRect();
    const activeZoom = displayZoom;
    return {
      x: (clientX - bounds.left) / activeZoom,
      y: (clientY - bounds.top) / activeZoom,
    };
  }

  function beginConnection(
    nodeId: string,
    side: ConnectionSide,
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    if (!editable || event.button !== 0) return;
    const position = positionById.get(nodeId);
    if (position === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const start = connectionPoint(position, side, nodeHeights[nodeId] ?? NODE_HEIGHT);
    setSelectedNodeId(nodeId);
    setEdgeContextMenu(null);
    setConnectionDrag({
      pointerId: event.pointerId,
      parentNodeId: nodeId,
      start,
      current: start,
      candidateNodeId: null,
      dockSide: null,
    });
  }

  function resolveConnectionDock(
    point: { x: number; y: number },
    parentNodeId: string,
  ): {
    candidateNodeId: string | null;
    dockSide: ConnectionSide | null;
    endpoint: { x: number; y: number };
  } {
    const candidate = model.nodes
      .map((node, index) => ({
        node,
        height: nodeHeights[node.id] ?? NODE_HEIGHT,
        position: positionById.get(node.id) ?? {
          x: 40 + (index % 3) * 230,
          y: 40 + Math.floor(index / 3) * 140,
        },
      }))
      .reverse()
      .find(({ node, position, height }) =>
        canConnect(model, parentNodeId, node.id)
        && point.x >= position.x - DOCK_REVEAL_MARGIN
        && point.x <= position.x + NODE_WIDTH + DOCK_REVEAL_MARGIN
        && point.y >= position.y - DOCK_REVEAL_MARGIN
        && point.y <= position.y + height + DOCK_REVEAL_MARGIN,
      );
    if (candidate === undefined) {
      return { candidateNodeId: null, dockSide: null, endpoint: point };
    }
    const nearestDock = CONNECTION_SIDES
      .map((side) => {
        const endpoint = connectionPoint(candidate.position, side, candidate.height);
        return {
          side,
          endpoint,
          distance: Math.hypot(point.x - endpoint.x, point.y - endpoint.y),
        };
      })
      .sort((left, right) => left.distance - right.distance)[0]!;
    if (nearestDock.distance > DOCK_RADIUS) {
      return { candidateNodeId: candidate.node.id, dockSide: null, endpoint: point };
    }
    return {
      candidateNodeId: candidate.node.id,
      dockSide: nearestDock.side,
      endpoint: nearestDock.endpoint,
    };
  }

  function moveConnection(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (connectionDrag === null || connectionDrag.pointerId !== event.pointerId) return;
    const point = graphCoordinates(event.clientX, event.clientY);
    if (point === null) return;
    const dock = resolveConnectionDock(point, connectionDrag.parentNodeId);
    setConnectionDrag({
      ...connectionDrag,
      current: dock.endpoint,
      candidateNodeId: dock.candidateNodeId,
      dockSide: dock.dockSide,
    });
  }

  function endConnection(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (connectionDrag === null || connectionDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const point = graphCoordinates(event.clientX, event.clientY);
    const dock = point === null
      ? null
      : resolveConnectionDock(point, connectionDrag.parentNodeId);
    if (dock !== null && dock.candidateNodeId !== null && dock.dockSide !== null) {
      commit(connectNodes(model, connectionDrag.parentNodeId, dock.candidateNodeId));
      setSelectedNodeId(dock.candidateNodeId);
    }
    setConnectionDrag(null);
  }

  function openEdgeContextMenu(edgeId: string, event: ReactMouseEvent<SVGPathElement>): void {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const bounds = canvas.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 52;
    setEdgeContextMenu({
      edgeId,
      x: Math.max(10, Math.min(event.clientX - bounds.left, canvas.clientWidth - menuWidth - 10)),
      y: Math.max(58, Math.min(event.clientY - bounds.top, canvas.clientHeight - menuHeight - 10)),
    });
  }

  function deleteContextEdge(): void {
    const edge = model.edges.find((candidate) => candidate.id === edgeContextMenu?.edgeId);
    if (edge === undefined) return;
    commit(disconnectNodes(model, edge.parentNodeId, edge.childNodeId));
    setEdgeContextMenu(null);
  }

  function moveParent(parentNodeId: string, direction: -1 | 1): void {
    if (selectedNode === undefined || selectedTable === undefined) return;
    const parentIds = [...selectedTable.parents]
      .sort((left, right) => left.order - right.order)
      .map((parent) => parent.nodeId);
    const index = parentIds.indexOf(parentNodeId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= parentIds.length) return;
    [parentIds[index], parentIds[nextIndex]] = [parentIds[nextIndex]!, parentIds[index]!];
    confirmRebuild("Reordering parents changes CPT interpretation.", () => {
      commit(reorderParents(model, selectedNode.id, parentIds));
    });
  }

  function updateRow(row: BayesianNetworkCptRow): void {
    if (selectedTable === undefined) return;
    commit(replaceCpt(model, selectedTable.nodeId, {
      ...selectedTable,
      rows: selectedTable.rows.map((candidate) => candidate.id === row.id ? row : candidate),
    }));
  }

  function clearCptRowDrafts(
    drafts: Record<string, string>,
    row: BayesianNetworkCptRow,
  ): Record<string, string> {
    const rowKeys = new Set(row.values.map((value) => cptDraftKey(row.id, value.stateId)));
    return Object.fromEntries(Object.entries(drafts).filter(([key]) => !rowKeys.has(key)));
  }

  function updateCptValueDraft(
    row: BayesianNetworkCptRow,
    stateId: string,
    value: string,
  ): void {
    const nextDrafts = {
      ...cptValueDrafts,
      [cptDraftKey(row.id, stateId)]: value,
    };
    setCptValueDrafts(nextDrafts);
    const status = cptDraftRowStatus(row, nextDrafts);
    if (!status.valid) return;
    const nextRow = {
      ...row,
      values: row.values.map((candidate, index) => ({
        ...candidate,
        probability: status.probabilities[index]!,
      })) as typeof row.values,
    };
    setCptValueDrafts((current) => clearCptRowDrafts(current, row));
    updateRow(nextRow);
  }

  function normalizeDraftRow(row: BayesianNetworkCptRow): void {
    const draftValues = row.values.map((candidate) => {
      const draft = cptValueDrafts[cptDraftKey(row.id, candidate.stateId)];
      const probability = draft === undefined
        ? candidate.probability
        : draft.trim() === "" ? Number.NaN : Number(draft);
      return { ...candidate, probability };
    }) as typeof row.values;
    if (draftValues.some(({ probability }) =>
      !Number.isFinite(probability) || probability < 0 || probability > 1,
    )) {
      addToast({
        id: "bn-cpt-normalize-invalid-probability",
        type: "warning",
        message: "Enter probabilities between 0 and 1 before normalizing this row.",
      });
      return;
    }
    const normalized = normalizeCptRow({ ...row, values: draftValues });
    setCptValueDrafts((current) => clearCptRowDrafts(current, row));
    updateRow(normalized);
  }

  function defaultModuleDraft(template: BayesianNetworkModuleTemplate): ModuleInstanceDraft {
    const instanceNumber = (model.moduleInstances?.filter(
      (instance) => instance.templateId === template.id,
    ).length ?? 0) + 1;
    return {
      code: `${template.code}-${String(instanceNumber)}`,
      name: `${template.name} ${String(instanceNumber)}`,
      inputBindings: Object.fromEntries(template.inputPorts.map((port) => {
        const compatible = compatibleBayesianNetworkModuleInputNodes(model, port);
        const exactCode = compatible.find(
          (node) => node.code.trim().toUpperCase() === port.code.trim().toUpperCase(),
        );
        return [port.id, exactCode?.id ?? (compatible.length === 1 ? compatible[0]!.id : "")];
      })),
    };
  }

  function moduleDraft(template: BayesianNetworkModuleTemplate): ModuleInstanceDraft {
    return moduleDrafts[template.id] ?? defaultModuleDraft(template);
  }

  function updateModuleDraft(
    template: BayesianNetworkModuleTemplate,
    update: (draft: ModuleInstanceDraft) => ModuleInstanceDraft,
  ): void {
    setModuleDrafts((current) => ({
      ...current,
      [template.id]: update(current[template.id] ?? defaultModuleDraft(template)),
    }));
  }

  function saveSelectedBranchAsModule(): void {
    if (selectedNode === undefined) {
      setOperationError("Select the first node of the branch you want to reuse.");
      return;
    }
    try {
      const created = createBayesianNetworkModuleFromBranch(model, selectedNode.id);
      commit(created.model);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Could not create the reusable module.");
    }
  }

  function addModuleInstance(template: BayesianNetworkModuleTemplate): void {
    const draft = moduleDraft(template);
    try {
      const instantiated = instantiateBayesianNetworkModule(model, template.id, {
        code: draft.code,
        name: draft.name,
        inputBindings: template.inputPorts.map((port) => ({
          portId: port.id,
          nodeId: draft.inputBindings[port.id] ?? "",
        })),
      });
      commit(instantiated.model);
      setSelectedNodeId(instantiated.outputNodeIds[0] ?? null);
      setModuleDrafts((current) => {
        const next = { ...current };
        delete next[template.id];
        return next;
      });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Could not instantiate the reusable module.");
    }
  }

  function requestDeleteModuleTemplate(template: BayesianNetworkModuleTemplate): void {
    requestConfirmation({
      title: `Delete ${template.code}?`,
      message: "The reusable template will be removed. Materialized instances must be deleted first.",
      confirmLabel: "Delete template",
      tone: "danger",
    }, () => {
      try {
        commit(deleteBayesianNetworkModuleTemplate(model, template.id));
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : "Could not delete the reusable module.");
      }
    });
  }

  function requestDeleteModuleInstance(instanceId: string): void {
    const instance = model.moduleInstances?.find((candidate) => candidate.id === instanceId);
    if (instance === undefined) return;
    requestConfirmation({
      title: `Delete ${instance.code}?`,
      message: `${String(instance.nodeMappings.length)} materialized node${instance.nodeMappings.length === 1 ? "" : "s"} and their connections will be removed. Downstream CPTs will be rebuilt.` ,
      confirmLabel: "Delete instance",
      tone: "danger",
    }, () => {
      try {
        commit(deleteBayesianNetworkModuleInstance(model, instance.id));
        setSelectedNodeId(null);
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : "Could not delete the module instance.");
      }
    });
  }

  function removeSelectedNode(): void {
    if (selectedNode === undefined) return;
    if (selectedModuleInstance !== undefined) {
      requestDeleteModuleInstance(selectedModuleInstance.id);
      return;
    }
    const impact = model.edges.filter((edge) => edge.parentNodeId === selectedNode.id || edge.childNodeId === selectedNode.id).length;
    requestConfirmation({
      title: `Delete ${selectedNode.code}?`,
      message: `${String(impact)} connected edge${impact === 1 ? "" : "s"} will also be removed, and child CPTs will be rebuilt.`,
      confirmLabel: "Delete node",
      tone: "danger",
    }, () => {
      commit(deleteNode(model, selectedNode.id));
      setSelectedNodeId(null);
    });
  }

  function beginDrag(nodeId: string, event: ReactPointerEvent<HTMLButtonElement>): void {
    if (!editable || event.button !== 0) return;
    event.stopPropagation();
    const position = positionById.get(nodeId) ?? { x: 40, y: 40 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedNodeId(nodeId);
    setEdgeContextMenu(null);
    setDrag({
      pointerId: event.pointerId,
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      x: position.x,
      y: position.y,
    });
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const activeZoom = displayZoom;
    setDrag({
      ...drag,
      x: Math.max(8, drag.originX + (event.clientX - drag.startX) / activeZoom),
      y: Math.max(8, drag.originY + (event.clientY - drag.startY) / activeZoom),
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const next = {
      ...model,
      nodePositions: [
        ...model.nodePositions.filter((entry) => entry.nodeId !== drag.nodeId),
        { nodeId: drag.nodeId, position: { x: drag.x, y: drag.y } },
      ],
      layout: { ...model.layout, mode: "MANUAL" as const },
    };
    setDrag(null);
    if (drag.x !== drag.originX || drag.y !== drag.originY) commit(next);
  }

  function setZoom(zoom: number): void {
    const nextZoom = clampZoom(zoom);
    userChangedZoomRef.current = true;
    persistedZoomRef.current = nextZoom;
    setDisplayZoom(nextZoom);
    if (nextZoom === model.layout.viewport.zoom) return;
    commit({
      ...model,
      layout: {
        ...model.layout,
        viewport: { ...model.layout.viewport, zoom: nextZoom },
      },
    });
  }

  async function importFile(file: File): Promise<void> {
    try {
      const source = await file.text();
      const imported = importKind.current === "XDSL"
        ? importBayesianNetworkXdsl(source, model)
        : { ...importBayesianNetworkJson(source), modelId: model.modelId };
      requestConfirmation({
        title: "Replace this Bayesian network?",
        message: "The imported model will replace the current network, nodes, connections, states, and probability tables.",
        confirmLabel: "Replace network",
      }, () => {
        commit(imported);
        setSelectedNodeId(imported.nodes[0]?.id ?? null);
      });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Could not import that Bayesian network.");
    } finally {
      if (importRef.current !== null) importRef.current.value = "";
    }
  }

  async function importQueryBatch(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      const source = await file.text();
      const imported = file.name.toLowerCase().endsWith(".csv")
        ? importHclEvidenceScenariosCsv(source, model)
        : importHclEvidenceScenariosJson(source, model);
      setQueryBatchScenarios(imported.filter((scenario) => scenario.enabled));
      setQueryBatchError(null);
    } catch (error) {
      setQueryBatchScenarios([]);
      setQueryBatchError(error instanceof Error ? error.message : "Could not import the evidence batch.");
    }
  }

  function downloadQueryBatchSample(format: "JSON" | "CSV"): void {
    if (queryBatchSamples.length === 0) {
      setQueryBatchError("Add at least one node with a state before downloading a sample.");
      return;
    }
    setQueryBatchError(null);
    const filename = `${model.code || "bayesian-network"}-evidence-sample.${format.toLowerCase()}`;
    if (format === "JSON") {
      download(filename, exportHclEvidenceScenariosJson(queryBatchSamples, model), "application/json");
      return;
    }
    download(filename, exportHclEvidenceScenariosCsv(queryBatchSamples, model), "text/csv");
  }

  const graphPositions = new Map(model.nodes.map((node, index) => {
    const position = drag?.nodeId === node.id
      ? { x: drag.x, y: drag.y }
      : positionById.get(node.id) ?? { x: 40 + (index % 3) * 230, y: 40 + Math.floor(index / 3) * 140 };
    return [node.id, position] as const;
  }));
  const graphWidth = Math.max(520, ...[...graphPositions.values()].map(({ x }) => x + NODE_WIDTH + 30));
  const graphHeight = Math.max(320, ...[...graphPositions.entries()].map(([nodeId, { y }]) => y + (nodeHeights[nodeId] ?? NODE_HEIGHT) + 30));
  const zoom = displayZoom;
  const zoomInDisabled = zoom >= MAX_ZOOM - ZOOM_EPSILON
    || (userChangedZoomRef.current && persistedZoomRef.current > zoom + ZOOM_EPSILON);
  const orderedParents = selectedTable === undefined
    ? []
    : [...selectedTable.parents].sort((left, right) => left.order - right.order);
  const contextEdge = model.edges.find((edge) => edge.id === edgeContextMenu?.edgeId);
  const hclIssues = validation.filter((issue) => issue.code.startsWith("BN_HCL_"));
  const nonHclIssues = validation.filter((issue) => !issue.code.startsWith("BN_HCL_"));
  const hasCptDraftErrors = model.conditionalProbabilityTables.some((table) =>
    table.rows.some((row) => !cptDraftRowStatus(row, cptValueDrafts).valid),
  );
  const quantificationBlocked = hasCptDraftErrors
    || nonHclIssues.some((issue) => issue.severity === "ERROR");

  function renderEvidenceEditor(): JSX.Element {
    return (
      <div className="bneditor__evidence-popover" role="dialog" aria-label="Evidence editor">
        <div className="bneditor__evidence-popover-head">
          <label>
            <span>Find a node</span>
            <input type="search" aria-label="Search evidence nodes" placeholder="Search by code or name" value={evidenceSearch} onChange={(event) => setEvidenceSearch(event.target.value)} />
          </label>
          <button type="button" className="posnav__btn posnav__btn--sm bneditor__evidence-close" onClick={() => setEvidenceOpen(false)}>Close</button>
        </div>
        <div className="bneditor__evidence-editor">
          {evidenceNodes.map((node) => {
            const observation = evidence.observations.find((candidate) => candidate.nodeId === node.id);
            return (
              <label key={node.id}>
                <span>{node.code}</span>
                <select aria-label={`Evidence for ${node.code}`} value={observation?.stateId ?? ""} disabled={!editable} onChange={(event) => onEvidenceChange({
                  observations: [
                    ...evidence.observations.filter((candidate) => candidate.nodeId !== node.id),
                    ...(event.target.value === "" ? [] : [{ nodeId: node.id, stateId: event.target.value }]),
                  ],
                })}>
                  <option value="">No evidence</option>
                  {node.states.map((state) => <option key={state.id} value={state.id}>{state.code}</option>)}
                </select>
              </label>
            );
          })}
          {evidenceNodes.length === 0 && <p className="bneditor__empty">No matching nodes.</p>}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (calculationType === "BN_QUERY" && !showQueryAnalysis) {
      setCalculationType("PROBABILITY");
      setQuantificationWorkflow(null);
    }
    if (calculationType !== "BN_QUERY" && !showHclAnalysis) {
      setCalculationType("BN_QUERY");
      setQuantificationWorkflow(null);
    }
  }, [calculationType, showHclAnalysis, showQueryAnalysis]);

  function clearNodeSelectionFromCanvas(event: ReactMouseEvent<HTMLDivElement>): void {
    const target = event.target;
    if (
      target instanceof Element
      && target.closest("button, input, select, textarea, summary, a, .bneditor__node-shell") !== null
    ) return;
    setSelectedNodeId(null);
    setEdgeContextMenu(null);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || model.nodes.length === 0) return undefined;
    const fit = (): void => {
      if (viewport.clientWidth === 0 || viewport.clientHeight === 0) return;
      setDisplayZoom(clampZoom(Math.min(
        persistedZoomRef.current,
        (viewport.clientWidth - 32) / graphWidth,
        (viewport.clientHeight - 32) / graphHeight,
      )));
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [graphHeight, graphWidth, model.modelId, model.nodes.length, selectedNode !== undefined]);

  return (
    <div className={`bneditor${editable ? "" : " bneditor--readonly"}`} data-testid="bayesian-network-editor">
      <header className="bneditor__header">
        <div className="bneditor__identity">
          <label>
            <span>Network code</span>
            {editable ? (
              <input aria-label="Bayesian-network code" value={model.code} onChange={(event) => commit({ ...model, code: event.target.value })} />
            ) : (
              <output className="bneditor__identity-value" aria-label="Bayesian-network code" title={model.code}>{model.code}</output>
            )}
          </label>
          <label>
            <span>Network name</span>
            {editable ? (
              <input aria-label="Bayesian-network name" value={model.name} onChange={(event) => commit({ ...model, name: event.target.value })} />
            ) : (
              <output className="bneditor__identity-value" aria-label="Bayesian-network name" title={model.name}>{model.name}</output>
            )}
          </label>
        </div>
        <div className="bneditor__toolbar" aria-label="Bayesian-network tools">
          <div role="group" aria-label="Bayesian-network history controls">
            <button type="button" className="bneditor__icon-btn" aria-label="Undo" title="Undo" disabled={!editable || history.current.length === 0} onClick={undo}><EditorIcon name="undo" /></button>
            <button type="button" className="bneditor__icon-btn" aria-label="Redo" title="Redo" disabled={!editable || future.current.length === 0} onClick={redo}><EditorIcon name="redo" /></button>
          </div>
          <div role="group" aria-label="Bayesian-network interchange controls">
            <details className="bneditor__file-menu">
              <summary className="bneditor__icon-btn" role="button" aria-label="File" title="File" aria-haspopup="menu"><EditorIcon name="file" /></summary>
              <div className="bneditor__file-menu-popover" role="menu" aria-label="Bayesian-network file actions">
                <button type="button" role="menuitem" onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  download(`${model.code}.xdsl`, exportBayesianNetworkXdsl(model), "application/xml");
                }}>Export XDSL</button>
                <button type="button" role="menuitem" onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  download(`${model.code}.json`, exportBayesianNetworkJson(model), "application/json");
                }}>Export JSON</button>
                {editable && (
                  <>
                    <button type="button" role="menuitem" onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      importKind.current = "XDSL";
                      importRef.current?.click();
                    }}>Import XDSL</button>
                    <button type="button" role="menuitem" onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      importKind.current = "JSON";
                      importRef.current?.click();
                    }}>Import JSON</button>
                  </>
                )}
              </div>
            </details>
            {editable ? (
              <details ref={moduleMenuRef} className="bneditor__file-menu bneditor__module-menu">
                <summary className="bneditor__icon-btn" role="button" aria-label="Reusable modules" title="Reusable modules" aria-haspopup="menu"><EditorIcon name="modules" /></summary>
                <div className="bneditor__file-menu-popover bneditor__module-popover" aria-label="Reusable Bayesian-network modules">
                  <div className="bneditor__module-heading">
                    <p>Select the branch root and save it as a module</p>
                    <button type="button" className="bneditor__module-save" disabled={selectedNode === undefined} onClick={saveSelectedBranchAsModule}>Save</button>
                  </div>
                  {(model.moduleTemplates?.length ?? 0) === 0 ? (
                    null
                  ) : (
                    <div className="bneditor__module-list" aria-label="Saved modules">
                      {model.moduleTemplates?.map((template) => {
                        const draft = moduleDraft(template);
                        return (
                          <details key={template.id} className="bneditor__module-card">
                            <summary className="bneditor__module-card-head">
                              <strong>{template.code}</strong>
                              <span>{template.name}</span>
                              <i aria-hidden="true">›</i>
                            </summary>
                            <div className="bneditor__module-card-body">
                              <div className="bneditor__module-form">
                                <div className="bneditor__module-identity-fields">
                                  <label>
                                    <span>Code</span>
                                    <input value={draft.code} onChange={(event) => updateModuleDraft(template, (current) => ({ ...current, code: event.target.value }))} />
                                  </label>
                                  <label>
                                    <span>Name</span>
                                    <input value={draft.name} onChange={(event) => updateModuleDraft(template, (current) => ({ ...current, name: event.target.value }))} />
                                  </label>
                                </div>
                                <div className="bneditor__module-inputs">
                                  <span>Input</span>
                                  {template.inputPorts.length === 0 && <em>None</em>}
                                  {template.inputPorts.map((port) => (
                                    <div key={port.id}>
                                      <strong>{port.code}</strong>
                                    </div>
                                  ))}
                                </div>
                                <div className="bneditor__module-actions">
                                  <button
                                    type="button"
                                    className="bneditor__module-add"
                                    disabled={draft.code.trim() === "" || template.inputPorts.some((port) => (draft.inputBindings[port.id] ?? "") === "")}
                                    onClick={() => addModuleInstance(template)}
                                  >
                                    Use this module
                                  </button>
                                  <button type="button" className="bneditor__module-delete" aria-label={`Delete module ${template.code}`} onClick={() => requestDeleteModuleTemplate(template)}>Delete</button>
                                </div>
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            ) : (
              <button type="button" className="bneditor__icon-btn" aria-label="Reusable modules" title="Reusable modules" disabled><EditorIcon name="modules" /></button>
            )}
            {editable && (
              <input ref={importRef} hidden type="file" accept=".xdsl,.xml,.json,application/xml,application/json" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) void importFile(file);
              }} />
            )}
          </div>
        </div>
      </header>

      {operationError !== null && <p className="bneditor__error" role="alert">{operationError}</p>}

      <div className={`bneditor__workspace${selectedNode === undefined ? "" : " bneditor__workspace--inspecting"}`}>
        <div ref={canvasRef} className="bneditor__canvas">
          {model.nodes.length > 0 && (
            <div className="bneditor__canvas-controls" aria-label="Bayesian-network canvas controls">
              <button type="button" className="bneditor__icon-btn bneditor__icon-btn--primary" aria-label="Add node" title="Add node" disabled={!editable} onClick={addNewNode}><EditorIcon name="add-node" /></button>
              <button type="button" className="bneditor__icon-btn" aria-label="Auto arrange" title="Auto arrange" disabled={!editable} onClick={() => commit(autoArrange(model))}><EditorIcon name="auto-layout" /></button>
              <span className="bneditor__control-separator" aria-hidden="true" />
              <button type="button" className="bneditor__icon-btn" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(zoom - 0.1)}><EditorIcon name="zoom-out" /></button>
              <output className="bneditor__zoom" aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
              <button type="button" className="bneditor__icon-btn" aria-label="Zoom in" title="Zoom in" disabled={zoomInDisabled} onClick={() => setZoom(zoom + 0.1)}><EditorIcon name="zoom-in" /></button>
              <button type="button" className="bneditor__icon-btn" aria-label="Fit" title="Fit to screen" onClick={() => {
                const viewport = viewportRef.current;
                if (viewport === null) return;
                setZoom(Math.min((viewport.clientWidth - 32) / graphWidth, (viewport.clientHeight - 32) / graphHeight));
                viewport.scrollTo({ left: 0, top: 0 });
              }}><EditorIcon name="fit" /></button>
            </div>
          )}
          <div
            ref={viewportRef}
            className="bneditor__viewport"
            aria-label="Bayesian-network graph"
            onClick={clearNodeSelectionFromCanvas}
          >
            {model.nodes.length === 0 ? (
              <div className="bneditor__graph-empty">
                {editable && (
                  <button type="button" className="bneditor__graph-empty-add" aria-label="Add first node" title="Add node" onClick={addNewNode}>
                    <EditorIcon name="add-node" />
                  </button>
                )}
                <span>Add node to begin.</span>
              </div>
            ) : (
              <div className="bneditor__stage" style={{ width: graphWidth * zoom, height: graphHeight * zoom }}>
                <div ref={stageContentRef} className="bneditor__stage-content" style={{ width: graphWidth, height: graphHeight, transform: `scale(${String(zoom)})` }}>
                  <svg width={graphWidth} height={graphHeight} aria-label="Bayesian-network directed edges">
                    <defs>
                      <marker id={`bn-arrow-${model.modelId}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M0,0 L8,4 L0,8 Z" />
                      </marker>
                    </defs>
                    {model.edges.map((edge) => {
                      const parent = graphPositions.get(edge.parentNodeId);
                      const child = graphPositions.get(edge.childNodeId);
                      if (parent === undefined || child === undefined) return null;
                      const path = edgePath(
                        parent,
                        child,
                        nodeHeights[edge.parentNodeId] ?? NODE_HEIGHT,
                        nodeHeights[edge.childNodeId] ?? NODE_HEIGHT,
                      );
                      return (
                        <g key={edge.id}>
                          <path
                            className="bneditor__edge-hit"
                            data-testid="bayesian-network-edge-hit"
                            d={path}
                            onContextMenu={(event) => openEdgeContextMenu(edge.id, event)}
                          />
                          <path
                            className="bneditor__edge"
                            data-testid="bayesian-network-edge"
                            d={path}
                            markerEnd={`url(#bn-arrow-${model.modelId})`}
                            onContextMenu={(event) => openEdgeContextMenu(edge.id, event)}
                          />
                        </g>
                      );
                    })}
                    {connectionDrag !== null && (
                      <path
                        className={`bneditor__connection-preview${connectionDrag.dockSide === null ? "" : " is-docked"}`}
                        d={`M ${String(connectionDrag.start.x)} ${String(connectionDrag.start.y)} L ${String(connectionDrag.current.x)} ${String(connectionDrag.current.y)}`}
                      />
                    )}
                  </svg>
                  {model.nodes.map((node) => {
                    const position = graphPositions.get(node.id)!;
                    const observed = evidence.observations.find((observation) => observation.nodeId === node.id);
                    const invalid = validation.some((issue) => issue.entityId === node.id);
                    const connectionCandidate = connectionDrag?.candidateNodeId === node.id;
                    const connectionTarget = connectionCandidate && connectionDrag.dockSide !== null;
                    return (
                      <div
                        key={node.id}
                        className={`bneditor__node-shell${connectionCandidate ? " is-connection-candidate" : ""}${connectionTarget ? " is-connection-target" : ""}`}
                        style={{ left: position.x, top: position.y }}
                        data-bn-node-id={node.id}
                        ref={(element) => {
                          if (element === null) nodeShellRefs.current.delete(node.id);
                          else nodeShellRefs.current.set(node.id, element);
                        }}
                      >
                        <button
                          type="button"
                          className={`bneditor__node${selectedNodeId === node.id ? " is-selected" : ""}${observed !== undefined ? " is-observed" : ""}${invalid ? " is-invalid" : ""}`}
                          aria-label={`BN node ${node.name}`}
                          onClick={() => setSelectedNodeId(node.id)}
                          onPointerDown={(event) => beginDrag(node.id, event)}
                          onPointerMove={moveDrag}
                          onPointerUp={endDrag}
                          onPointerCancel={() => setDrag(null)}
                        >
                          <span className="bneditor__node-code">{node.code}</span>
                          <strong>{node.name}</strong>
                          <span>{node.states.map((state) => state.code).join(" · ")}</span>
                          {observed !== undefined && <em>Evidence: {node.states.find((state) => state.id === observed.stateId)?.code}</em>}
                        </button>
                        {editable && CONNECTION_SIDES.map((side) => (
                          <button
                            key={side}
                            type="button"
                            className={`bneditor__handle bneditor__handle--${side}${connectionCandidate ? " is-dock-option" : ""}${connectionTarget && connectionDrag.dockSide === side ? " is-dock-active" : ""}`}
                            aria-label={`Connection handle ${node.code} ${side}`}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => beginConnection(node.id, side, event)}
                            onPointerMove={moveConnection}
                            onPointerUp={endConnection}
                            onPointerCancel={() => setConnectionDrag(null)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {edgeContextMenu !== null && contextEdge !== undefined && (
            <div
              className="bneditor__edge-menu"
              role="menu"
              aria-label={`Actions for connection ${nodeById.get(contextEdge.parentNodeId)?.code ?? contextEdge.parentNodeId} to ${nodeById.get(contextEdge.childNodeId)?.code ?? contextEdge.childNodeId}`}
              style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button type="button" role="menuitem" onClick={deleteContextEdge}>Delete connection</button>
            </div>
          )}
        </div>

        {selectedNode !== undefined && (
          <aside className="bneditor__inspector" aria-label="Bayesian-network node inspector">
              {selectedModuleInstance !== undefined && (
                <div className="bneditor__module-badge">
                  <span>Module instance</span>
                  <strong>{selectedModuleInstance.code}</strong>
                </div>
              )}
              <label className="bneditor__field">
                <span>Code</span>
                <input value={nodeIdentityDraft?.nodeId === selectedNode.id ? nodeIdentityDraft.code : selectedNode.code} readOnly={!editable} onChange={(event) => updateSelectedNodeIdentity("code", event.target.value)} />
              </label>
              <label className="bneditor__field">
                <span>Name</span>
                <input value={nodeIdentityDraft?.nodeId === selectedNode.id ? nodeIdentityDraft.name : selectedNode.name} readOnly={!editable} onChange={(event) => updateSelectedNodeIdentity("name", event.target.value)} />
              </label>
              <label className="bneditor__field">
                <span>Description</span>
                <textarea value={selectedNode.description} readOnly={!editable} onChange={(event) => updateSelectedNode({ ...selectedNode, description: event.target.value })} />
              </label>

              <div className="bneditor__section-head"><strong>States</strong>{editable && <button type="button" disabled={selectedModuleInstance !== undefined} title={selectedModuleInstance === undefined ? "Add state" : "Module states follow the template"} onClick={addState}>Add state</button>}</div>
              <div className="bneditor__states">
                {selectedNode.states.map((state, index) => (
                  <div key={state.id} className="bneditor__state">
                    <input aria-label={`State code ${String(index + 1)}`} value={stateCodeDrafts[state.id] ?? state.code} readOnly={!editable} onChange={(event) => updateSelectedStateCode(state.id, event.target.value)} />
                    {editable && (
                      <span>
                        <button type="button" aria-label={`Move ${state.code} up`} disabled={index === 0 || selectedModuleInstance !== undefined} onClick={() => moveState(state.id, -1)}>↑</button>
                        <button type="button" aria-label={`Move ${state.code} down`} disabled={index === selectedNode.states.length - 1 || selectedModuleInstance !== undefined} onClick={() => moveState(state.id, 1)}>↓</button>
                        <button type="button" aria-label={`Delete state ${state.code}`} disabled={selectedNode.states.length <= 2 || selectedModuleInstance !== undefined} onClick={() => removeState(state.id)}>×</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="bneditor__section-head"><strong>Relationships</strong></div>
              <span className="bneditor__field-hint">Parents of {selectedNode.code}</span>
              <div className="bneditor__parents">
                {orderedParents.map((parent, index) => (
                  <div key={parent.nodeId}>
                    <span>{nodeById.get(parent.nodeId)?.code ?? "Missing node"}</span>
                    {editable && (
                      <span>
                        <button type="button" aria-label={`Move parent ${String(index + 1)} up`} disabled={index === 0} onClick={() => moveParent(parent.nodeId, -1)}>↑</button>
                        <button type="button" aria-label={`Move parent ${String(index + 1)} down`} disabled={index === orderedParents.length - 1} onClick={() => moveParent(parent.nodeId, 1)}>↓</button>
                      </span>
                    )}
                  </div>
                ))}
                {orderedParents.length === 0 && <p className="bneditor__empty">This node has no parents.</p>}
              </div>
              {editable && <div className="bneditor__inspector-actions">
                <button type="button" className="posnav__btn posnav__btn--sm bneditor__delete-btn" onClick={removeSelectedNode}><EditorIcon name="trash" /><span>Delete node</span></button>
              </div>}
          </aside>
        )}
      </div>

      {selectedNode !== undefined && selectedTable !== undefined && (
        <section className="bneditor__panel" aria-label={`CPT for ${selectedNode.code}`}>
          <div className="bneditor__panel-head">
            <div><h3>Conditional probability table · {selectedNode.code}</h3></div>
          </div>
          <div className="bneditor__table-wrap">
            <table className="bneditor__cpt">
              <thead>
                <tr>
                  {orderedParents.map((parent) => <th key={parent.nodeId} className="bneditor__cpt-parent">{nodeById.get(parent.nodeId)?.code}</th>)}
                  {selectedNode.states.map((state) => <th key={state.id}>P({state.code})</th>)}
                  <th>Total</th>
                  {editable && <th aria-label="Row actions" />}
                </tr>
              </thead>
              <tbody>
                {selectedTable.rows.map((row) => {
                  const draftStatus = cptDraftRowStatus(row, cptValueDrafts);
                  const invalid = !draftStatus.valid;
                  return (
                    <tr key={row.id} className={invalid ? "is-invalid" : ""}>
                      {orderedParents.map((parent) => {
                        const selection = row.parentStates.find((state) => state.parentNodeId === parent.nodeId);
                        return <td key={parent.nodeId} className="bneditor__cpt-parent">{nodeById.get(parent.nodeId)?.states.find((state) => state.id === selection?.stateId)?.code ?? "—"}</td>;
                      })}
                      {selectedNode.states.map((state) => {
                        const value = row.values.find((candidate) => candidate.stateId === state.id);
                        return (
                          <td key={state.id}>
                            <input
                              aria-label={`${selectedNode.code} ${state.code} probability`}
                              type="text"
                              inputMode="decimal"
                              value={value === undefined ? "" : cptDraftValue(row, state.id, cptValueDrafts)}
                              readOnly={!editable}
                              onChange={(event) => updateCptValueDraft(row, state.id, event.target.value)}
                            />
                          </td>
                        );
                      })}
                      <td><output aria-label={`Row total ${row.id}`}>{Number.isFinite(draftStatus.total) ? draftStatus.total.toFixed(2) : "Invalid"}</output></td>
                      {editable && <td><button type="button" onClick={() => normalizeDraftRow(row)}>Normalize row</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showAnalysis && (showQueryAnalysis || showHclAnalysis) && <section className="bneditor__analysis" aria-label="Bayesian-network analysis">
        <div className="bneditor__quantification-shell">
          <fieldset className="bneditor__calculation-picker">
            <legend>Calculation</legend>
            <div role="radiogroup" aria-label="Calculation type">
              {showQueryAnalysis && (
                <label className={calculationType === "BN_QUERY" ? "is-selected" : ""}>
                  <input type="radio" name="bn-calculation" value="BN_QUERY" checked={calculationType === "BN_QUERY"} onChange={() => { setCalculationType("BN_QUERY"); setQuantificationWorkflow(null); }} />
                  <span>BN query</span>
                </label>
              )}
              {showHclAnalysis && (
                <>
                  <label className={calculationType === "PROBABILITY" ? "is-selected" : ""}>
                    <input type="radio" name="bn-calculation" value="PROBABILITY" checked={calculationType === "PROBABILITY"} onChange={() => { setCalculationType("PROBABILITY"); setQuantificationWorkflow(null); }} />
                    <span>Probability</span>
                  </label>
                  <label className={calculationType === "CUT_SETS" ? "is-selected" : ""}>
                    <input type="radio" name="bn-calculation" value="CUT_SETS" checked={calculationType === "CUT_SETS"} onChange={() => { setCalculationType("CUT_SETS"); setQuantificationWorkflow(null); }} />
                    <span>Cut sets</span>
                  </label>
                  <label className={calculationType === "UNCERTAINTY" ? "is-selected" : ""}>
                    <input type="radio" name="bn-calculation" value="UNCERTAINTY" checked={calculationType === "UNCERTAINTY"} onChange={() => { setCalculationType("UNCERTAINTY"); setQuantificationWorkflow(null); }} />
                    <span>Uncertainty</span>
                  </label>
                  <label className={calculationType === "IMPORTANCE" ? "is-selected" : ""}>
                    <input type="radio" name="bn-calculation" value="IMPORTANCE" checked={calculationType === "IMPORTANCE"} onChange={() => { setCalculationType("IMPORTANCE"); setQuantificationWorkflow(null); }} />
                    <span>Importance</span>
                  </label>
                </>
              )}
            </div>
          </fieldset>

          <fieldset className="bneditor__workflow-picker">
            <legend>Workflow</legend>
            <div role="radiogroup" aria-label="Quantification workflow">
              <label className={quantificationWorkflow === "MANUAL" ? "is-selected" : ""}>
                <input type="radio" name="bn-workflow" value="MANUAL" checked={quantificationWorkflow === "MANUAL"} onChange={() => setQuantificationWorkflow("MANUAL")} />
                <span>Manual</span>
              </label>
              <label className={quantificationWorkflow === "BATCH" ? "is-selected" : ""}>
                <input type="radio" name="bn-workflow" value="BATCH" checked={quantificationWorkflow === "BATCH"} onChange={() => setQuantificationWorkflow("BATCH")} />
                <span>Batch</span>
              </label>
            </div>
          </fieldset>

          {calculationType === "BN_QUERY" && showQueryAnalysis && quantificationWorkflow !== null && (
            <section className="bneditor__calculation-workspace" aria-label="BN query">
              <div className={`bneditor__query-composer${quantificationWorkflow === "MANUAL" ? " bneditor__manual-column" : " bneditor__query-composer--batch"}`}>
                <label className="bneditor__query-target">
                  <span>Query node</span>
                  <select aria-label="Bayesian-network query node" value={queryNodeId ?? ""} onChange={(event) => onQueryNodeChange(event.target.value || null)}>
                    <option value="">Choose a node</option>
                    {model.nodes.map((node) => <option key={node.id} value={node.id}>{node.code}</option>)}
                  </select>
                </label>
                {quantificationWorkflow === "MANUAL" ? (
                  <div className="bneditor__query-actions">
                    <div className="bneditor__evidence-anchor">
                      <button
                        type="button"
                        className="posnav__btn posnav__btn--sm bneditor__evidence-trigger"
                        aria-label="Edit evidence"
                        aria-expanded={evidenceOpen}
                        onClick={() => setEvidenceOpen((open) => !open)}
                      >
                        <EditorIcon name="evidence" />
                        <span>Evidence</span>
                        {evidence.observations.length > 0 && <b>{String(evidence.observations.length)}</b>}
                      </button>
                      {evidenceOpen && renderEvidenceEditor()}
                    </div>
                    <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary bneditor__query-submit" aria-label="Run exact inference" disabled={running || queryNodeId === null || quantificationBlocked} onClick={onRun}>
                      <EditorIcon name="run" />
                      <span>{running ? "Running…" : "Run inference"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bneditor__batch-intake">
                    <input ref={queryBatchImportRef} hidden type="file" accept=".json,.csv,application/json,text/csv" aria-label="Upload BN evidence batch" onChange={(event) => { void importQueryBatch(event); }} />
                    <button type="button" className="posnav__btn posnav__btn--sm bneditor__batch-upload" aria-label="Upload JSON/CSV" onClick={() => queryBatchImportRef.current?.click()}>
                      <span>Upload JSON/CSV</span>
                      {queryBatchScenarios.length > 0 && <b>{String(queryBatchScenarios.length)}</b>}
                    </button>
                    <details ref={queryBatchSampleMenuRef} className="bneditor__batch-sample-menu">
                      <summary className="posnav__btn posnav__btn--sm" role="button">
                        <span>Download samples</span>
                        <svg className="bneditor__batch-sample-chevron" viewBox="0 0 12 8" aria-hidden="true">
                          <path d="m1 1 5 5 5-5" />
                        </svg>
                      </summary>
                      <div className="bneditor__batch-sample-popover" role="menu" aria-label="BN query batch samples">
                        <button type="button" role="menuitem" onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                          downloadQueryBatchSample("JSON");
                        }}>Sample JSON</button>
                        <button type="button" role="menuitem" onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                          downloadQueryBatchSample("CSV");
                        }}>Sample CSV</button>
                      </div>
                    </details>
                    <button
                      type="button"
                      className="posnav__btn posnav__btn--sm posnav__btn--primary"
                      disabled={running || queryNodeId === null || quantificationBlocked || queryBatchScenarios.length === 0 || onRunBatch === undefined}
                      onClick={() => onRunBatch?.(queryBatchScenarios)}
                    >
                      <EditorIcon name="run" />
                      <span>{running ? "Running…" : "Run batch"}</span>
                    </button>
                  </div>
                )}
              </div>
              {(runError ?? queryBatchError) !== null && <p className="bneditor__error" role="alert">{runError ?? queryBatchError}</p>}
              {quantificationWorkflow === "MANUAL" && analysisResult !== null && (
                <div className="bneditor__posterior" aria-label="Posterior distribution">
                  {analysisResult.marginals.flatMap((marginal) => {
                    const node = nodeById.get(marginal.nodeId);
                    return marginal.values.map((value) => (
                      <div key={`${marginal.nodeId}:${value.stateId}`} className="bneditor__posterior-state">
                        <span>{node?.states.find((state) => state.id === value.stateId)?.code ?? value.stateId}</span>
                        <output>{(value.probability * 100).toFixed(2)}%</output>
                        <i aria-hidden="true"><b style={{ width: `${String(Math.max(0, Math.min(1, value.probability)) * 100)}%` }} /></i>
                      </div>
                    ));
                  })}
                </div>
              )}
              {quantificationWorkflow === "BATCH" && queryBatchResult !== null && (
                <div className="bneditor__query-batch-results" aria-label="BN query batch results">
                  {queryBatchResult.scenarios.map((scenario) => (
                    <details key={scenario.scenarioId} className="bneditor__query-batch-row">
                      <summary><strong>{scenario.scenarioCode}</strong><span>{scenario.status === "SUCCEEDED" ? "Complete" : "Failed"}</span></summary>
                      {scenario.failure !== null && <p className="bneditor__error">{scenario.failure}</p>}
                      {scenario.result !== null && (
                        <div className="bneditor__posterior">
                          {scenario.result.marginals.flatMap((marginal) => {
                            const node = nodeById.get(marginal.nodeId);
                            return marginal.values.map((value) => (
                              <div key={`${scenario.scenarioId}:${marginal.nodeId}:${value.stateId}`} className="bneditor__posterior-state">
                                <span>{node?.states.find((state) => state.id === value.stateId)?.code ?? value.stateId}</span>
                                <output>{(value.probability * 100).toFixed(2)}%</output>
                                <i aria-hidden="true"><b style={{ width: `${String(Math.max(0, Math.min(1, value.probability)) * 100)}%` }} /></i>
                              </div>
                            ));
                          })}
                        </div>
                      )}
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}

          {calculationType !== "BN_QUERY" && showHclAnalysis && quantificationWorkflow !== null && (
            <section className="bneditor__calculation-workspace" aria-label={`${calculationType.toLowerCase()} calculation`}>
              <HclBindingEditor
                model={model}
                editable={editable}
                workbookId={workbookId}
                configurations={hclConfigurations}
                scope={hclScope}
                faultTreeOptions={faultTreeOptions}
                eventTreeOptions={eventTreeOptions}
                baseEvidence={evidence}
                validation={hclIssues}
                quantificationBlocked={quantificationBlocked}
                running={hclRunning}
                runError={hclRunError}
                runResult={hclRunResult}
                batchRunResult={hclBatchRunResult}
                evidenceEditorOpen={evidenceOpen}
                evidenceEditor={evidenceOpen ? renderEvidenceEditor() : null}
                calculationType={calculationType}
                workflow={quantificationWorkflow}
                onEditEvidence={() => setEvidenceOpen((open) => !open)}
                onChange={onHclConfigurationsChange}
                onRunFaultTree={onRunHclFaultTree}
                onRunEventTree={onRunHclEventTree}
                onRunFaultTreeBatch={onRunHclFaultTreeBatch}
                onRunEventTreeBatch={onRunHclEventTreeBatch}
              />
            </section>
          )}
        </div>
      </section>}

      {nonHclIssues.length > 0 && (
        <section className="bneditor__validation" aria-label="Bayesian-network validation">
          <h3>Validation · {String(nonHclIssues.length)} issue{nonHclIssues.length === 1 ? "" : "s"}</h3>
          {nonHclIssues.map((issue, index) => (
            <button key={`${issue.code}-${issue.entityId ?? "model"}-${String(index)}`} type="button" onClick={() => {
              if (issue.entityId !== undefined && model.nodes.some((node) => node.id === issue.entityId)) setSelectedNodeId(issue.entityId);
            }}>
              <strong>{issue.severity}</strong> {issue.message}
            </button>
          ))}
        </section>
      )}
      {confirmationDialog}
    </div>
  );
}

export { BayesianNetworkEditor };
