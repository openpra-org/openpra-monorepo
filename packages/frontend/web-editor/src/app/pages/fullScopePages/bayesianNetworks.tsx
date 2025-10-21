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

/**
 * Selector type defining the parts of the state to be extracted.
 */
interface SelectorReturnType {
  nodes: RFState["nodes"];
  edges: RFState["edges"];
  onNodesChange: RFState["onNodesChange"];
  onEdgesChange: RFState["onEdgesChange"];
}

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

/**
 * Custom hook selector for extracting specific parts of the Bayesian network state.
 * @param  state - The current state of the React Flow instance.
 * @returns  Selected portions of the state including nodes, edges, and change handlers.
 */
const selector = (state: RFState): SelectorReturnType => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
});

// Places the node origin in the center of a node
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

/**
 * Extended node type including custom properties for absolute positioning and optional dimensions.
 */
type ExtendedNode = {
  positionAbsolute: { x: number; y: number };
  width?: number;
  height?: number;
} & Node;

/**
 * Main React component that provides an interactive environment to visualize and edit Bayesian Networks using React Flow.
 * It includes functionality for node and edge manipulation, context menu actions, and cycle detection.
 * @returns \{JSX.Element\} The rendered React Flow environment with nodes and edges.
 */
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

  /**
   * Callback function to calculate the position of a child node on the canvas based on a mouse event.
   * @param event - The mouse event triggering this callback.
   * @returns  The calculated position in the flow's coordinate system.
   */
  const getChildNodePosition = useCallback(
    (event: MouseEvent): { x: number; y: number } =>
      reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }),
    [reactFlow],
  );

  /**
   * Callback function triggered at the start of a connection event.
   * It stores the ID of the node where the connection starts.
   * @param event -The event triggering this callback (unused).
   * @param params - Parameters containing the ID of the starting node.
   */
  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  /**
   * Callback function triggered at the end of a connection event.
   * It handles the creation of new edges, checks for cycles, and manages node connections.
   * @param  event - The event triggering this callback.
   */
  const onConnectEnd: OnConnectEnd = useCallback(
    (event): void => {
      const { nodeInternals } = store.getState();
      const targetIsPane = (event.target as Element).classList.contains("react-flow__pane");
      const node = (event.target as Element).closest(".react-flow__node");
      const targetNodeId = (event.target as Element).closest(".react-flow__node")?.getAttribute("data-id");

      // Function to check for cycles
      const hasCycles = (sourceNodeId: string, targetNodeId: string, nodes: Node[], edges: Edge[]): boolean => {
        const visited = new Set();
        const stack = [targetNodeId];
        while (stack.length > 0) {
          const node = stack.pop();
          if (node === sourceNodeId) {
            return true; // Cycle detected
          }
          if (!visited.has(node)) {
            visited.add(node);
            const children = edges.filter((e) => e.source === node).map((e) => e.target);
            stack.push(...children);
          }
        }
        return false; // No cycle detected
      };

      if (targetNodeId && connectingNodeId.current) {
        // Only perform cycle check if we are connecting to a different node
        if (targetNodeId !== connectingNodeId.current) {
          const sourceNode: string = connectingNodeId.current;
          const targetNode: string = targetNodeId;

          // Assuming 'edges' is an array of Edge objects and 'nodes' is an array of Node objects
          const edges = UseStore.getState().edges;
          const nodes = UseStore.getState().nodes;

          if (hasCycles(sourceNode, targetNode, nodes, edges)) {
            // Display a toast message when a cycle is detected
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
        // if (childNodePosition) {
        addChildNode(parentNode, childNodePosition);
      }

      if (node) {
        node.querySelector("input")?.focus({ preventScroll: true });
      }

      // Reset connecting node id after the connection is complete
      connectingNodeId.current = null;
    },
    [getChildNodePosition, addChildNode, store],
  );

  /**
   * Event handler for selecting a node. It updates the state to reflect the currently selected node.
   * @param event - The event object for the mouse event.
   * @param  node - The node that was clicked.
   */
  const onNodeSelect = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  /**
   * Event handler for opening a context menu on a node.
   * It sets the position for the menu and marks the node as selected.
   * @param  event - The event object for the mouse event.
   * @param  node - The node on which the context menu is opened.
   */
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNodeId(node.id);
    setShowContextMenu(true);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  /**
   * Handler for context menu actions. Depending on the action, it might delete a node, highlight it, or add a parent node.
   * @param  action - The action to be performed.
   * @param  nodeId - The ID of the node on which the action is to be performed.
   */
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
          // Arbitrarily positioning the new parent 100 units above the child node
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

  /**
   * Event handler for clicking on the pane, used to close the context menu.
   */
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

/**
 * Top-level component that provides the context necessary for the ReactFlowPro component to function.
 * This component wraps ReactFlowPro in a ReactFlowProvider.
 * @returns \{JSX.Element\} The ReactFlowProvider component that contains ReactFlowPro.
 */
export function BayesianNetworkEditor(): JSX.Element {
  return (
    <ReactFlowProvider>
      <ReactFlowPro />
    </ReactFlowProvider>
  );
}

/**
 * Component that acts as a router for Bayesian network visualization and editing.
 * It routes between a list of Bayesian networks and individual network editors.
 * @returns \{JSX.Element\} The Routes component that manages navigation between different Bayesian network views.
 */
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
