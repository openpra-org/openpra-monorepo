import React, { useCallback, useRef, useState } from "react";
import "reactflow/dist/style.css";
import { Route, Routes } from "react-router-dom";
import ReactFlow, {
  Node,
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  FitViewOptions,
  ProOptions,
  NodeOrigin,
  OnConnectStart,
  OnConnectEnd,
  useStoreApi,
  useReactFlow,
  Edge,
  MarkerType,
} from "reactflow";
import { EuiToast } from "@elastic/eui";
import { BayesianNetworkList } from "../../components/lists/nestedLists/bayesianNetworkList";
import { MindMapNode } from "../../components/treeNodes/bayesianNetwork/mindMapNode";
import { MindMapEdge } from "../../components/treeEdges/bayesianNetworkEdges/mindMapEdge";
import CustomMiniMap from "../../components/minimap/minimap";
import { BayesianNodeContextMenu } from "../../components/context_menu/bayesianNodeContextMenu";
import { UseStore, RFState } from "../../hooks/bayesianNetwork/mindmap/useStore";
import { GetEdgeParams } from "../../../utils/bayesianNodeIntersectionCalculator";
interface SelectorReturnType {
  nodes: RFState["nodes"];
  edges: RFState["edges"];
  onNodesChange: RFState["onNodesChange"];
  onEdgesChange: RFState["onEdgesChange"];
}
const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };
const selector = (state: RFState): SelectorReturnType => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
});
const nodeOrigin: NodeOrigin = [0.5, 0.5];
const fitViewOptions: FitViewOptions = {
  padding: 0.95,
};
const nodeTypes = {
  mindmap: MindMapNode,
};
const edgeTypes = {
  mindmap: MindMapEdge,
};
const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed },
};
type ExtendedNode = {
  positionAbsolute: {
    x: number;
    y: number;
  };
  width?: number;
  height?: number;
} & Node;
function ReactFlowPro(): JSX.Element {
  const { nodes, edges, onNodesChange, onEdgesChange } = UseStore(selector);
  const reactFlow = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const store = useStoreApi();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [showCycleWarning, setShowCycleWarning] = useState(false);
  const { addChildNode } = UseStore((state) => ({
    addChildNode: state.addChildNode,
  }));
  const getChildNodePosition = useCallback(
    (
      event: MouseEvent,
    ): {
      x: number;
      y: number;
    } =>
      reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }),
    [reactFlow],
  );
  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);
  const onConnectEnd: OnConnectEnd = useCallback(
    (event): void => {
      const { nodeInternals } = store.getState();
      const targetIsPane = (event.target as Element).classList.contains("react-flow__pane");
      const node = (event.target as Element).closest(".react-flow__node");
      const targetNodeId = (event.target as Element).closest(".react-flow__node")?.getAttribute("data-id");
      const hasCycles = (sourceNodeId: string, targetNodeId: string, nodes: Node[], edges: Edge[]): boolean => {
        const visited = new Set();
        const stack = [targetNodeId];
        while (stack.length > 0) {
          const node = stack.pop();
          if (node === sourceNodeId) {
            return true;
          }
          if (!visited.has(node)) {
            visited.add(node);
            const children = edges.filter((e) => e.source === node).map((e) => e.target);
            stack.push(...children);
          }
        }
        return false;
      };
      if (targetNodeId && connectingNodeId.current) {
        if (targetNodeId !== connectingNodeId.current) {
          const sourceNode: string = connectingNodeId.current;
          const targetNode: string = targetNodeId;
          const edges = UseStore.getState().edges;
          const nodes = UseStore.getState().nodes;
          if (hasCycles(sourceNode, targetNode, nodes, edges)) {
            setShowCycleWarning(true);
          } else {
            const source = nodes.find((node) => node.id === sourceNode);
            const target = nodes.find((node) => node.id === targetNode);
            if (source && target) {
              const edgeParams = GetEdgeParams(source, target);
              const { sx, sy, tx, ty } = edgeParams;
              const newEdge = {
                id: `e${connectingNodeId.current}-${targetNodeId}`,
                source: connectingNodeId.current,
                target: targetNodeId,
                type: "mindmap",
                sourceX: sx,
                sourceY: sy,
                targetX: tx,
                targetY: ty,
                ...defaultEdgeOptions,
              };
              UseStore.getState().addEdge(newEdge);
            }
          }
        }
      } else if (targetIsPane && connectingNodeId.current) {
        const parentNode = nodeInternals.get(connectingNodeId.current) as ExtendedNode;
        const childNodePosition = getChildNodePosition(event as MouseEvent);
        addChildNode(parentNode, childNodePosition);
      }
      if (node) {
        node.querySelector("input")?.focus({ preventScroll: true });
      }
      connectingNodeId.current = null;
    },
    [getChildNodePosition, addChildNode, store],
  );
  const onNodeSelect = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNodeId(node.id);
    setShowContextMenu(true);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);
  const handleContextMenuAction = useCallback((action: string, nodeId: string) => {
    const childNode = UseStore.getState().nodes.find((n) => n.id === nodeId);
    switch (action) {
      case "deleteNode":
        UseStore.getState().deleteNodeAndReattachChildren(nodeId);
        break;
      case "highlightNode":
        break;
      case "addParent":
        if (childNode) {
          const newParentPosition = {
            x: childNode.position.x,
            y: childNode.position.y - 100,
          };
          UseStore.getState().addParentNode(childNode, newParentPosition);
        }
        break;
      default:
    }
    setShowContextMenu(false);
  }, []);
  const onPaneClick = useCallback(() => {
    setShowContextMenu(false);
  }, []);
  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={proOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeOrigin={nodeOrigin}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeSelect}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        minZoom={1.6}
        fitViewOptions={fitViewOptions}
        nodesDraggable={true}
        nodesConnectable={true}
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
        <Panel position="top-left">React Flow Mind Map</Panel>
        <CustomMiniMap />
      </ReactFlow>
      {showContextMenu && selectedNodeId && (
        <BayesianNodeContextMenu
          nodeId={selectedNodeId}
          onActionSelect={handleContextMenuAction}
          onClose={(): void => {
            setShowContextMenu(false);
          }}
          position={contextMenuPosition}
          getParents={UseStore.getState().getParents}
          getChildren={UseStore.getState().getChildren}
          getParentLabels={UseStore.getState().getParentLabels}
          getChildrenLabels={UseStore.getState().getChildrenLabels}
        />
      )}
      {showCycleWarning && (
        <EuiToast
          title="Invalid Operation"
          color="warning"
          onClose={(): void => {
            setShowCycleWarning(false);
          }}
        >
          <p>
            Creating this link would create a cycle, which is not allowed in a directed acyclic graph (DAG). Please try
            a different connection.
          </p>
        </EuiToast>
      )}
    </>
  );
}
export function BayesianNetworkEditor(): JSX.Element {
  return (
    <ReactFlowProvider>
      <ReactFlowPro />
    </ReactFlowProvider>
  );
}
function BayesianNetworks(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<BayesianNetworkList />}
      />
      <Route
        path=":bayesianNetworkId"
        element={<BayesianNetworkEditor />}
      />
    </Routes>
  );
}
export { BayesianNetworks };
