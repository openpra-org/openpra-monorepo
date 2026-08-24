import {
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
import type { BayesianNetworkEditorProps } from "./bayesianNetworkTypes";
import { useEditorConfirmation } from "../shared";
import { HclBindingEditor } from "../hybrid-causal-logic";
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

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 84;
const DOCK_REVEAL_MARGIN = 28;
const DOCK_RADIUS = 22;
const CONNECTION_SIDES = ["top", "right", "bottom", "left"] as const;

function EditorIcon({
  name,
}: {
  name: "undo" | "redo" | "file" | "add-node" | "zoom-out" | "zoom-in" | "fit" | "auto-layout" | "trash" | "run" | "configuration";
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
      {name === "add-node" && <><rect {...common} x="4" y="4" width="16" height="16" rx="3" /><path {...common} d="M12 8v8M8 12h8" /></>}
      {name === "trash" && <><path {...common} d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>}
      {name === "run" && <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m10 8.5 6 3.5-6 3.5z" /></>}
      {name === "configuration" && <><circle {...common} cx="6" cy="12" r="3" /><circle {...common} cx="18" cy="6" r="3" /><circle {...common} cx="18" cy="18" r="3" /><path {...common} d="m9 11 6-4M9 13l6 4" /></>}
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
): { x: number; y: number } {
  if (side === "top") return { x: position.x + NODE_WIDTH / 2, y: position.y };
  if (side === "right") return { x: position.x + NODE_WIDTH, y: position.y + NODE_HEIGHT / 2 };
  if (side === "bottom") return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT };
  return { x: position.x, y: position.y + NODE_HEIGHT / 2 };
}

function edgePath(
  parent: { x: number; y: number },
  child: { x: number; y: number },
): string {
  const parentCenter = { x: parent.x + NODE_WIDTH / 2, y: parent.y + NODE_HEIGHT / 2 };
  const childCenter = { x: child.x + NODE_WIDTH / 2, y: child.y + NODE_HEIGHT / 2 };
  const dx = childCenter.x - parentCenter.x;
  const dy = childCenter.y - parentCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const start = connectionPoint(parent, dx >= 0 ? "right" : "left");
    const end = connectionPoint(child, dx >= 0 ? "left" : "right");
    const controlX = (start.x + end.x) / 2;
    return `M ${String(start.x)} ${String(start.y)} C ${String(controlX)} ${String(start.y)}, ${String(controlX)} ${String(end.y)}, ${String(end.x)} ${String(end.y)}`;
  }
  const start = connectionPoint(parent, dy >= 0 ? "bottom" : "top");
  const end = connectionPoint(child, dy >= 0 ? "top" : "bottom");
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

function rowTotal(row: BayesianNetworkCptRow): number {
  return row.values.reduce((sum, value) => sum + value.probability, 0);
}


function BayesianNetworkEditor(props: BayesianNetworkEditorProps): JSX.Element {
  const {
    model,
    editable,
    evidence,
    queryNodeId,
    validation,
    analysisResult,
    running,
    runError,
    workbookId,
    hclConfigurations,
    faultTreeOptions,
    eventTreeOptions,
    hclRunning,
    hclRunError,
    hclRunResult,
    onModelChange,
    onEvidenceChange,
    onQueryNodeChange,
    onHclConfigurationsChange,
    onRunHclFaultTree,
    onRunHclEventTree,
    onRun,
  } = props;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(model.nodes[0]?.id ?? null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const history = useRef<BayesianNetworkModel[]>([]);
  const future = useRef<BayesianNetworkModel[]>([]);
  const importRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageContentRef = useRef<HTMLDivElement>(null);
  const importKind = useRef<"XDSL" | "JSON">("XDSL");
  const modelIdRef = useRef(model.modelId);
  const selectedNode = model.nodes.find((node) => node.id === selectedNodeId);
  const selectedTable = model.conditionalProbabilityTables.find((table) => table.nodeId === selectedNodeId);
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const positionById = useMemo(() => new Map(model.nodePositions.map((entry) => [entry.nodeId, entry.position])), [model.nodePositions]);

  useEffect(() => {
    if (modelIdRef.current === model.modelId) return;
    modelIdRef.current = model.modelId;
    history.current = [];
    future.current = [];
    setConnectionDrag(null);
    setEdgeContextMenu(null);
    setSelectedNodeId(model.nodes[0]?.id ?? null);
  }, [model.modelId, model.nodes]);
  useEffect(() => {
    if (selectedNodeId !== null && model.nodes.some((node) => node.id === selectedNodeId)) return;
    setSelectedNodeId(model.nodes[0]?.id ?? null);
  }, [model.nodes, selectedNodeId]);
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

  function addState(): void {
    if (selectedNode === undefined) return;
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

  function removeState(stateId: string): void {
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
    const activeZoom = clampZoom(model.layout.viewport.zoom);
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
    const start = connectionPoint(position, side);
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
        position: positionById.get(node.id) ?? {
          x: 40 + (index % 3) * 230,
          y: 40 + Math.floor(index / 3) * 140,
        },
      }))
      .reverse()
      .find(({ node, position }) =>
        canConnect(model, parentNodeId, node.id)
        && point.x >= position.x - DOCK_REVEAL_MARGIN
        && point.x <= position.x + NODE_WIDTH + DOCK_REVEAL_MARGIN
        && point.y >= position.y - DOCK_REVEAL_MARGIN
        && point.y <= position.y + NODE_HEIGHT + DOCK_REVEAL_MARGIN,
      );
    if (candidate === undefined) {
      return { candidateNodeId: null, dockSide: null, endpoint: point };
    }
    const nearestDock = CONNECTION_SIDES
      .map((side) => {
        const endpoint = connectionPoint(candidate.position, side);
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

  function removeSelectedNode(): void {
    if (selectedNode === undefined) return;
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
    const activeZoom = clampZoom(model.layout.viewport.zoom);
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

  const graphPositions = new Map(model.nodes.map((node, index) => {
    const position = drag?.nodeId === node.id
      ? { x: drag.x, y: drag.y }
      : positionById.get(node.id) ?? { x: 40 + (index % 3) * 230, y: 40 + Math.floor(index / 3) * 140 };
    return [node.id, position] as const;
  }));
  const graphWidth = Math.max(720, ...[...graphPositions.values()].map(({ x }) => x + NODE_WIDTH + 30));
  const graphHeight = Math.max(400, ...[...graphPositions.values()].map(({ y }) => y + NODE_HEIGHT + 30));
  const zoom = clampZoom(model.layout.viewport.zoom);
  const orderedParents = selectedTable === undefined
    ? []
    : [...selectedTable.parents].sort((left, right) => left.order - right.order);
  const contextEdge = model.edges.find((edge) => edge.id === edgeContextMenu?.edgeId);
  const hclIssues = validation.filter((issue) => issue.code.startsWith("BN_HCL_"));
  const nonHclIssues = validation.filter((issue) => !issue.code.startsWith("BN_HCL_"));

  return (
    <div className="bneditor" data-testid="bayesian-network-editor">
      <header className="bneditor__header">
        <div className="bneditor__identity">
          <label>
            <span>Network code</span>
            <input aria-label="Bayesian-network code" value={model.code} disabled={!editable} onChange={(event) => commit({ ...model, code: event.target.value })} />
          </label>
          <label>
            <span>Network name</span>
            <input aria-label="Bayesian-network name" value={model.name} disabled={!editable} onChange={(event) => commit({ ...model, name: event.target.value })} />
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
          <div className="bneditor__canvas-controls" aria-label="Bayesian-network canvas controls">
            <button type="button" className="bneditor__icon-btn bneditor__icon-btn--primary" aria-label="Add node" title="Add node" disabled={!editable} onClick={addNewNode}><EditorIcon name="add-node" /></button>
            <button type="button" className="bneditor__icon-btn" aria-label="Auto arrange" title="Auto arrange" disabled={!editable || model.nodes.length === 0} onClick={() => commit(autoArrange(model))}><EditorIcon name="auto-layout" /></button>
            <span className="bneditor__control-separator" aria-hidden="true" />
            <button type="button" className="bneditor__icon-btn" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(zoom - 0.1)}><EditorIcon name="zoom-out" /></button>
            <output className="bneditor__zoom" aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
            <button type="button" className="bneditor__icon-btn" aria-label="Zoom in" title="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(zoom + 0.1)}><EditorIcon name="zoom-in" /></button>
            <button type="button" className="bneditor__icon-btn" aria-label="Fit" title="Fit to screen" disabled={model.nodes.length === 0} onClick={() => {
              const viewport = viewportRef.current;
              if (viewport === null) return;
              setZoom(Math.min((viewport.clientWidth - 32) / graphWidth, (viewport.clientHeight - 32) / graphHeight));
              viewport.scrollTo({ left: 0, top: 0 });
            }}><EditorIcon name="fit" /></button>
          </div>
          <div ref={viewportRef} className="bneditor__viewport" aria-label="Bayesian-network graph">
            {model.nodes.length === 0 ? (
              <div className="bneditor__graph-empty">Add a node to begin.</div>
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
                      const path = edgePath(parent, child);
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
              <label className="bneditor__field">
                <span>Code</span>
                <input value={selectedNode.code} disabled={!editable} onChange={(event) => updateSelectedNode({ ...selectedNode, code: event.target.value })} />
              </label>
              <label className="bneditor__field">
                <span>Name</span>
                <input value={selectedNode.name} disabled={!editable} onChange={(event) => updateSelectedNode({ ...selectedNode, name: event.target.value })} />
              </label>
              <label className="bneditor__field">
                <span>Description</span>
                <textarea value={selectedNode.description} disabled={!editable} onChange={(event) => updateSelectedNode({ ...selectedNode, description: event.target.value })} />
              </label>

              <div className="bneditor__section-head"><strong>States</strong>{editable && <button type="button" onClick={addState}>Add state</button>}</div>
              <div className="bneditor__states">
                {selectedNode.states.map((state, index) => (
                  <div key={state.id} className="bneditor__state">
                    <input aria-label={`State code ${String(index + 1)}`} value={state.code} disabled={!editable} onChange={(event) => updateSelectedNode({
                      ...selectedNode,
                      states: selectedNode.states.map((candidate) => candidate.id === state.id ? { ...candidate, code: event.target.value } : candidate) as BayesianNetworkNode["states"],
                    })} />
                    <input aria-label={`State name ${String(index + 1)}`} value={state.name} disabled={!editable} onChange={(event) => updateSelectedNode({
                      ...selectedNode,
                      states: selectedNode.states.map((candidate) => candidate.id === state.id ? { ...candidate, name: event.target.value } : candidate) as BayesianNetworkNode["states"],
                    })} />
                    {editable && (
                      <span>
                        <button type="button" aria-label={`Move ${state.code} up`} disabled={index === 0} onClick={() => moveState(state.id, -1)}>↑</button>
                        <button type="button" aria-label={`Move ${state.code} down`} disabled={index === selectedNode.states.length - 1} onClick={() => moveState(state.id, 1)}>↓</button>
                        <button type="button" aria-label={`Delete state ${state.code}`} disabled={selectedNode.states.length <= 2} onClick={() => removeState(state.id)}>×</button>
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
            <div><h3>Conditional probability table · {selectedNode.code}</h3><p>Rows are never normalized automatically. Use Normalize row explicitly.</p></div>
          </div>
          <div className="bneditor__table-wrap">
            <table className="bneditor__cpt">
              <thead>
                <tr>
                  {orderedParents.map((parent) => <th key={parent.nodeId}>{nodeById.get(parent.nodeId)?.code}</th>)}
                  {selectedNode.states.map((state) => <th key={state.id}>P({state.code})</th>)}
                  <th>Total</th>
                  {editable && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {selectedTable.rows.map((row) => {
                  const total = rowTotal(row);
                  const invalid = !Number.isFinite(total) || Math.abs(total - 1) > 1e-9 || row.values.some((value) => value.probability < 0 || value.probability > 1);
                  return (
                    <tr key={row.id} className={invalid ? "is-invalid" : ""}>
                      {orderedParents.map((parent) => {
                        const selection = row.parentStates.find((state) => state.parentNodeId === parent.nodeId);
                        return <td key={parent.nodeId}>{nodeById.get(parent.nodeId)?.states.find((state) => state.id === selection?.stateId)?.code ?? "—"}</td>;
                      })}
                      {selectedNode.states.map((state) => {
                        const value = row.values.find((candidate) => candidate.stateId === state.id);
                        return (
                          <td key={state.id}>
                            <input
                              aria-label={`${selectedNode.code} ${state.code} probability`}
                              type="number"
                              min="0"
                              max="1"
                              step="any"
                              value={value?.probability ?? ""}
                              disabled={!editable}
                              onChange={(event) => updateRow({
                                ...row,
                                values: row.values.map((candidate) => candidate.stateId === state.id
                                  ? { ...candidate, probability: Number(event.target.value) }
                                  : candidate,
                                ) as typeof row.values,
                              })}
                            />
                          </td>
                        );
                      })}
                      <td><output aria-label={`Row total ${row.id}`}>{Number.isFinite(total) ? total.toFixed(6) : "Invalid"}</output></td>
                      {editable && <td><button type="button" onClick={() => updateRow(normalizeCptRow(row))}>Normalize row</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bneditor__panel" aria-label="Bayesian-network evidence and query">
        <div className="bneditor__panel-head">
          <div><h3>Evidence and exact query</h3><p>Evidence is applied to one state per node. Exact inference runs through PRAXIS and TensorBayes.</p></div>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || queryNodeId === null || nonHclIssues.some((issue) => issue.severity === "ERROR")} onClick={onRun}>
            <EditorIcon name="run" />
            <span>{running ? "Running…" : "Run exact inference"}</span>
          </button>
        </div>
        <div className="bneditor__query-grid">
          <label>
            <span>Query node</span>
            <select aria-label="Bayesian-network query node" value={queryNodeId ?? ""} onChange={(event) => onQueryNodeChange(event.target.value || null)}>
              <option value="">Choose a node</option>
              {model.nodes.map((node) => <option key={node.id} value={node.id}>{node.code}</option>)}
            </select>
          </label>
          {model.nodes.map((node) => {
            const observation = evidence.observations.find((candidate) => candidate.nodeId === node.id);
            return (
              <label key={node.id}>
                <span>Evidence · {node.code}</span>
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
        </div>
        {runError !== null && <p className="bneditor__error" role="alert">{runError}</p>}
        {analysisResult !== null && (
          <div className="bneditor__posterior" aria-label="Posterior distribution">
            {analysisResult.marginals.map((marginal) => {
              const node = nodeById.get(marginal.nodeId);
              return (
                <div key={marginal.nodeId}>
                  <strong>{node?.code ?? marginal.nodeId}</strong>
                  {marginal.values.map((value) => (
                    <span key={value.stateId}>
                      {node?.states.find((state) => state.id === value.stateId)?.code ?? value.stateId}
                      <b>{(value.probability * 100).toFixed(4)}%</b>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <HclBindingEditor
        model={model}
        editable={editable}
        workbookId={workbookId}
        configurations={hclConfigurations}
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={eventTreeOptions}
        baseEvidence={evidence}
        validation={hclIssues}
        running={hclRunning}
        runError={hclRunError}
        runResult={hclRunResult}
        onChange={onHclConfigurationsChange}
        onRunFaultTree={onRunHclFaultTree}
        onRunEventTree={onRunHclEventTree}
      />

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
