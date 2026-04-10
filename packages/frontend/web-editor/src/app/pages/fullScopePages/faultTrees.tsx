/**
 * Fault Tree editor page.
 * Canvas is ReactFlow; a right-side PropertiesPanel appears when a node is selected.
 * Clicking the + button on an edge opens a type-picker so the user can choose what
 * kind of node to insert.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  FitViewOptions,
  Node,
  NodeMouseHandler,
  Panel,
  ProOptions,
  ReactFlowProvider,
} from "reactflow";

import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import {
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  EuiPopover,
  EuiSkeletonRectangle,
} from "@elastic/eui";
import { mefToReactFlow, reactFlowToMEF } from "../../../utils/faultTreeMEFSerializer";
import { Route, Routes, useParams } from "react-router-dom";
import { UseLayout } from "../../hooks/faultTree/useLayout";
import { FaultTreeNodeTypes } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
import { EdgeTypes } from "../../components/treeEdges/faultTreeEdges/faultTreeEdgeType";

import "reactflow/dist/style.css";

import { FaultTreeList } from "../../components/lists/nestedLists/faultTreeList";
import {
  FaultTreeNodeContextMenu,
  TreeNodeContextMenuProps,
} from "../../components/context_menu/faultTreeNodeContextMenu";
import { exitGrayedState, GenerateUUID, isSubgraphGrayed } from "../../../utils/treeUtils";
import { allToasts, initialEdges, initialNodes } from "../../../utils/faultTreeData";
import { useStore } from "../../store/faultTreeStore";
import { useUndoRedo } from "../../hooks/faultTree/useUndeRedo";
import { useEdgeInsert } from "../../hooks/faultTree/useEdgeClick";
import {
  AND_GATE,
  AND_GATE_LABEL,
  ATLEAST_GATE,
  ATLEAST_GATE_LABEL,
  BASIC_EVENT,
  BASIC_EVENT_LABEL,
  EDITOR_REDO,
  EDITOR_UNDO,
  HOUSE_EVENT,
  HOUSE_EVENT_LABEL,
  LARGE,
  NOT_GATE,
  NOT_GATE_LABEL,
  OR_GATE,
  OR_GATE_LABEL,
  SMALL,
  TRANSFER_GATE,
  TRANSFER_GATE_LABEL,
} from "../../../utils/constants";
import Minimap from "../../components/minimap/minimap";
import { UseToastContext } from "../../providers/toastProvider";
import { getGraphSignature, shouldApplyGraph } from "../../hooks/faultTree/graphApplyGuard";
import { FaultTreePropertiesPanel } from "../../components/treeNodes/faultTreeNodes/faultTreePropertiesPanel";
import type { FaultTreeNodeQuantification } from "../../types/faultTreeQuantification";
import type { FaultTreeNodeProps } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
import { TypedContextMenu } from "../../components/context_menu/contextMenuTypes";
import AndGateIcon from "../../../assets/images/faultTreeNodeIcons/AndGateIcon.svg";
import OrGateIcon from "../../../assets/images/faultTreeNodeIcons/OrGateIcon.svg";
import AtLeastIcon from "../../../assets/images/faultTreeNodeIcons/AtLeastGateIcon.svg";
import NotGateIcon from "../../../assets/images/faultTreeNodeIcons/NotGateIcon.svg";
import TransferGateIcon from "../../../assets/images/faultTreeNodeIcons/TransferGateIcon.svg";
import BasicEventIcon from "../../../assets/images/faultTreeNodeIcons/BasicEventIcon.svg";
import HouseEventIcon from "../../../assets/images/faultTreeNodeIcons/HouseEventIcon.svg";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

const fitViewOptions: FitViewOptions = {
  padding: 0.95,
};

const PANEL_WIDTH = 300;

/** Node-type options shown in the edge + button picker. */
const NODE_TYPE_OPTIONS = [
  { type: AND_GATE, label: AND_GATE_LABEL, icon: AndGateIcon },
  { type: OR_GATE, label: OR_GATE_LABEL, icon: OrGateIcon },
  { type: ATLEAST_GATE, label: ATLEAST_GATE_LABEL, icon: AtLeastIcon },
  { type: NOT_GATE, label: NOT_GATE_LABEL, icon: NotGateIcon },
  { type: TRANSFER_GATE, label: TRANSFER_GATE_LABEL, icon: TransferGateIcon },
  { type: HOUSE_EVENT, label: HOUSE_EVENT_LABEL, icon: HouseEventIcon },
  { type: BASIC_EVENT, label: BASIC_EVENT_LABEL, icon: BasicEventIcon },
];

function ReactFlowPro(): JSX.Element {
  const [menu, setMenu] = useState<TreeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const setNodes = useStore((s) => s.setNodes);
  const setEdges = useStore((s) => s.setEdges);
  const pendingEdge = useStore((s) => s.pendingEdge);
  const setPendingEdge = useStore((s) => s.setPendingEdge);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { faultTreeId } = useParams();
  const { addToast } = UseToastContext();

  // ── Properties panel state ──────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<Node<FaultTreeNodeProps> | null>(null);

  // ── Edge insert hook ────────────────────────────────────────────────────
  const insertOnEdge = useEdgeInsert();

  UseLayout(!isLoading);
  const lastAppliedSigRef = useRef<string | undefined>(undefined);
  const loadRunsRef = useRef<number>(0);

  useEffect(() => {
    lastAppliedSigRef.current = undefined;
    setIsLoading(true);
    setSelectedNode(null);
  }, [faultTreeId]);

  useEffect(() => {
    if (!isLoading) return;
    if (!faultTreeId) return;

    let cancelled = false;
    const loadGraph = async (): Promise<void> => {
      loadRunsRef.current += 1;
      try {
        const res = await GraphApiManager.getFaultTree(faultTreeId);
        if (cancelled) return;
        const backendEmpty = Object.keys(res.nodes).length === 0;
        if (backendEmpty) {
          addToast({ id: GenerateUUID(), title: "No saved fault tree found; showing starter graph", color: "warning" });
        }
        const { nodes: rfNodes, edges: rfEdges } = mefToReactFlow(res.nodes);
        const nextNodes = backendEmpty ? initialNodes : rfNodes;
        const nextEdges = backendEmpty ? initialEdges : rfEdges;
        const nextSig = getGraphSignature(nextNodes, nextEdges);
        if (lastAppliedSigRef.current && !shouldApplyGraph(lastAppliedSigRef.current, nextSig)) {
          console.debug("[FaultTreeEditor] loadGraph skipped redundant apply", {
            runs: loadRunsRef.current,
            faultTreeId,
            nextSig,
          }); // eslint-disable-line no-console
        } else {
          setNodes(nextNodes);
          setEdges(nextEdges);
          lastAppliedSigRef.current = nextSig;
          console.debug("[FaultTreeEditor] loadGraph applied", { runs: loadRunsRef.current, faultTreeId, nextSig }); // eslint-disable-line no-console
        }
      } catch (_err) {
        if (cancelled) return;
        const fallbackSig = getGraphSignature(initialNodes, initialEdges);
        if (!lastAppliedSigRef.current || shouldApplyGraph(lastAppliedSigRef.current, fallbackSig)) {
          setNodes(initialNodes);
          setEdges(initialEdges);
          lastAppliedSigRef.current = fallbackSig;
        }
        addToast({ id: GenerateUUID(), title: "Failed to load fault tree", color: "warning" });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadGraph();
    return () => {
      cancelled = true;
    };
  }, [faultTreeId, isLoading]);

  // Keep selectedNode in sync when node data changes (e.g. quantification edits)
  useEffect(() => {
    if (!selectedNode) return;
    const updated = nodes.find((n) => n.id === selectedNode.id);
    if (updated) setSelectedNode(updated as Node<FaultTreeNodeProps>);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (isSubgraphGrayed(nodes, edges)) {
        const { newNodes, newEdges } = exitGrayedState(nodes, edges);
        setNodes(newNodes);
        setEdges(newEdges);
      }
      setIsOpen(!isOpen);
      const pane = ref.current.getBoundingClientRect();
      setMenu({
        id: node.id,
        top: event.clientY < pane.height - 200 && event.clientY,
        left: event.clientX - 320 < pane.width - 200 && event.clientX - 320,
        right: event.clientX - 320 >= pane.width - 200 && pane.width - event.clientX - 800,
        bottom: event.clientY >= pane.height - 200 && pane.height - event.clientY - 800,
      });
    },
    [nodes, edges, isOpen, setNodes, setEdges],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node as Node<FaultTreeNodeProps>);
  }, []);

  const onPaneClick = useCallback(() => {
    closePopover();
    setPendingEdge(null);
    setSelectedNode(null);
    if (isSubgraphGrayed(nodes, edges)) {
      const { newNodes, newEdges } = exitGrayedState(nodes, edges);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [edges, nodes, setEdges, setNodes, setPendingEdge]);

  const closePopover = (): void => {
    setMenu(null);
    setIsOpen(false);
  };

  const addToastHandler = (type: string): void => {
    const toast = allToasts.filter((t) => t.type === type)[0];
    addToast({ id: GenerateUUID(), ...toast });
  };

  // Properties panel: update node data + persist
  const onQuantificationChange = useCallback(
    (nodeId: string, q: FaultTreeNodeQuantification) => {
      const updatedNodes = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, quantification: q } } : n));
      setNodes(updatedNodes);
      if (faultTreeId) {
        const { topEventId, nodes: mefNodes } = reactFlowToMEF(updatedNodes, edges);
        void GraphApiManager.storeFaultTree({ faultTreeId, topEventId, nodes: mefNodes });
      }
    },
    [nodes, edges, faultTreeId, setNodes],
  );

  // Edge type-picker: build panels for TypedContextMenu
  const edgeTypePanelItems = NODE_TYPE_OPTIONS.map(({ type, label, icon }) => ({
    name: label,
    icon: (
      <EuiIcon
        type={icon}
        size={LARGE}
      />
    ),
    onClick: (): void => {
      if (pendingEdge) {
        insertOnEdge(pendingEdge.edgeId, type);
        setPendingEdge(null);
      }
    },
  }));

  if (isLoading) {
    return (
      <EuiSkeletonRectangle
        isLoading
        width="100%"
        height={500}
      />
    );
  }

  return (
    // position: absolute; inset: 0 fills the FaultTreeEditor container exactly,
    // avoiding height-100% inheritance issues across the EUI page template chain.
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      {/* ── Canvas ── */}
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <ReactFlow
          ref={ref}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          proOptions={proOptions}
          fitView
          nodeTypes={FaultTreeNodeTypes}
          edgeTypes={EdgeTypes}
          fitViewOptions={fitViewOptions}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeClick={onNodeClick}
          minZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnDoubleClick={false}
        >
          <Background />
          <Minimap />
          <Panel position="bottom-left">
            <EuiFlexGroup
              responsive={false}
              gutterSize={SMALL}
              alignItems="center"
            >
              <EuiFlexItem
                grow={false}
                onClick={undo}
              >
                <EuiButtonIcon
                  isDisabled={canUndo}
                  iconType={EDITOR_UNDO}
                  display="base"
                  aria-label="undo"
                />
              </EuiFlexItem>
              <EuiFlexItem
                grow={false}
                onClick={redo}
              >
                <EuiButtonIcon
                  isDisabled={canRedo}
                  iconType={EDITOR_REDO}
                  display="base"
                  aria-label="redo"
                />
              </EuiFlexItem>
            </EuiFlexGroup>
          </Panel>

          {/* Node context menu */}
          <EuiPopover
            button=""
            isOpen={isOpen}
            anchorPosition="downRight"
            style={{
              top: typeof menu?.top === "number" ? menu.top : undefined,
              left: typeof menu?.left === "number" ? menu.left : undefined,
              bottom: typeof menu?.bottom === "number" ? menu.bottom : undefined,
              right: typeof menu?.right === "number" ? menu.right : undefined,
            }}
            closePopover={closePopover}
          >
            {menu && (
              <FaultTreeNodeContextMenu
                onClick={closePopover}
                addToastHandler={addToastHandler}
                {...menu}
              />
            )}
          </EuiPopover>

          {/* Edge type picker */}
          <EuiPopover
            button=""
            isOpen={!!pendingEdge}
            anchorPosition="downLeft"
            style={{
              position: "fixed",
              top: pendingEdge?.y ?? 0,
              left: pendingEdge?.x ?? 0,
            }}
            closePopover={() => setPendingEdge(null)}
          >
            <TypedContextMenu
              panels={[{ id: 0, title: "Insert node", items: edgeTypePanelItems }]}
              size="s"
            />
          </EuiPopover>
        </ReactFlow>
      </div>

      {/* ── Properties panel ── */}
      {selectedNode && faultTreeId && (
        <EuiPanel
          paddingSize="none"
          style={{
            width: PANEL_WIDTH,
            minWidth: PANEL_WIDTH,
            maxWidth: PANEL_WIDTH,
            overflowY: "auto",
            borderLeft: "1px solid #d3dae6",
            flexShrink: 0,
            borderRadius: 0,
          }}
        >
          <FaultTreePropertiesPanel
            node={selectedNode}
            modelId={faultTreeId}
            onChange={onQuantificationChange}
          />
        </EuiPanel>
      )}
    </div>
  );
}

export function FaultTreeEditor(): JSX.Element {
  return (
    // position: relative establishes the containing block for the absolute inner div.
    // The height calc keeps the editor below the fixed EUI header.
    <div
      style={{
        position: "relative",
        height: "calc(100vh - var(--euiFixedHeadersOffset, 0px))",
        overflow: "hidden",
      }}
    >
      <ReactFlowProvider>
        <ReactFlowPro />
      </ReactFlowProvider>
    </div>
  );
}

function FaultTrees(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<FaultTreeList />}
      />
      <Route
        path=":faultTreeId"
        element={<FaultTreeEditor />}
      />
    </Routes>
  );
}

export { FaultTrees };
