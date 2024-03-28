import React, { useCallback, useRef, useEffect, useState } from "react";
import "reactflow/dist/style.css";
import { Route, Routes } from "react-router-dom";
import { shallow } from "zustand/shallow";
import { nanoid } from "nanoid";
import ReactFlow, {
  Node,
  Controls,
  Panel,
  ReactFlowProvider,
  NodeOrigin,
  NodeChange,
  OnConnectStart,
  OnConnectEnd,
  useStoreApi,
  useReactFlow,
  addEdge,
  Edge,
  MarkerType,
} from "reactflow";
import { EuiButton, EuiToast } from "@elastic/eui";
import BayesianNetworkList from "../../components/lists/nestedLists/bayesianNetworkList";
import MindMapNode from "../../components/treeNodes/bayesianNetwork/mindMapNode";
import MindMapEdge from "../../components/treeEdges/bayesianNetworkEdges/mindMapEdge";
import CustomMiniMap from "../../components/minimap/minimap";
import BayesianNodeContextMenu from "../../components/context_menu/bayesianNodeContextMenu";
import useStore, {
  RFState,
} from "../../hooks/bayesianNetwork/mindmap/useStore";

const selector = (state: RFState) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
});

// this places the node origin in the center of a node
const nodeOrigin: NodeOrigin = [0.5, 0.5];

const nodeTypes = {
  mindmap: MindMapNode,
};

const edgeTypes = {
  mindmap: MindMapEdge,
};

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed },
};

// Define a type for the Node that includes custom properties you are using
type ExtendedNode = {
  positionAbsolute: { x: number; y: number };
  width?: number;
  height?: number;
} & Node;

function ReactFlowPro() {
  const { nodes, edges, onNodesChange, onEdgesChange } = useStore(
    selector,
    shallow,
  );
  const reactFlow = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const store = useStoreApi();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const [showCycleWarning, setShowCycleWarning] = useState(false);
  const addNode = useStore((state) => state.addNode);

  const { addChildNode } = useStore((state) => ({
    addChildNode: state.addChildNode,
  }));

  const getChildNodePosition = (
    event: MouseEvent,
    parentNode?: ExtendedNode,
  ) => {
    const { domNode } = store.getState();

    if (
      !domNode ||
      !parentNode?.positionAbsolute || // assuming parentNode is of type ExtendedNode
      !parentNode.width ||
      !parentNode.height
    ) {
      return;
    }

    const panePosition = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    return {
      x: panePosition.x - parentNode.positionAbsolute.x + parentNode.width / 2,
      y: panePosition.y - parentNode.positionAbsolute.y + parentNode.height / 2,
    };
  };

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event: any) => {
      const { nodeInternals } = store.getState();
      const targetIsPane = (event.target as Element).classList.contains(
        "react-flow__pane",
      );
      const node = (event.target as Element).closest(".react-flow__node");
      const targetNodeId = event.target
        .closest(".react-flow__node")
        ?.getAttribute("data-id");

      // Function to check for cycles
      const hasCycles = (
        sourceNodeId: string,
        targetNodeId: string,
        nodes: Node[],
        edges: Edge[],
      ): boolean => {
        const visited = new Set();
        const stack = [targetNodeId];

        while (stack.length > 0) {
          const node = stack.pop();
          if (node === sourceNodeId) {
            return true; // Cycle detected
          }
          if (!visited.has(node)) {
            visited.add(node);
            const children = edges
              .filter((e) => e.source === node)
              .map((e) => e.target);
            stack.push(...children);
          }
        }
        return false; // No cycle detected
      };

      if (targetNodeId && connectingNodeId.current) {
        // Only perform cycle check if we are connecting to a different node
        if (targetNodeId !== connectingNodeId.current) {
          const sourceNode = connectingNodeId.current;
          const targetNode = targetNodeId;

          // Assuming 'edges' is an array of Edge objects and 'nodes' is an array of Node objects
          const edges = useStore.getState().edges;
          const nodes = useStore.getState().nodes;

          if (hasCycles(sourceNode, targetNode, nodes, edges)) {
            // Display a toast message when a cycle is detected
            setShowCycleWarning(true);
          } else {
            // Existing node connected
            const newEdge = {
              id: `e${connectingNodeId.current}-${targetNodeId}`,
              source: connectingNodeId.current,
              target: targetNodeId,
              type: "mindmap",
              ...defaultEdgeOptions,
            };
            useStore.getState().addEdge(newEdge);
          }
        }
      } else if (targetIsPane && connectingNodeId.current) {
        const parentNode = nodeInternals.get(
          connectingNodeId.current,
        ) as ExtendedNode;
        const childNodePosition = getChildNodePosition(
          event as MouseEvent,
          parentNode,
        );

        if (parentNode && childNodePosition) {
          addChildNode(parentNode, childNodePosition);
        }
      }
      if (node) {
        node.querySelector("input")?.focus({ preventScroll: true });
      }

      // Reset connecting node id after the connection is complete
      connectingNodeId.current = null;
    },
    [getChildNodePosition, addEdge, nodes, edges],
  );

  const handleAddNodeClick = () => {
    const reactFlowInstance = reactFlow; // Directly from the useReactFlow hook
    const paneElement = document.querySelector(".react-flow__pane");
    if (!paneElement) {
      return;
    }

    // Get the dimensions of the pane element
    const paneRect = paneElement.getBoundingClientRect();

    // Calculate the center of the pane
    const canvasCenter = reactFlowInstance.project({
      x: paneRect.width / Math.floor(Math.random() * 10) + 2,
      y: paneRect.height / Math.floor(Math.random() * 10) + 2,
    });

    // You could also incorporate some offset if you want the new node to appear slightly off-center
    addNode({
      x: canvasCenter.x,
      y: canvasCenter.y,
    });
  };

  // Event handler for node selection
  const onNodeSelect = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    console.log("selcted node is");
    console.log(node.id);
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setSelectedNodeId(node.id);
      setShowContextMenu(true);
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  const highlightNode = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId); // Highlight the node

    setTimeout(() => {
      setHighlightedNodeId(null); // Stop highlighting after 3 seconds
    }, 3000);
  }, []);

  // Update this inside the ReactFlowPro component
  const handleContextMenuAction = useCallback(
    (action: string, nodeId: string) => {
      switch (action) {
        case "deleteNode":
          // deleteNodeAndReattachChildren(nodeId);
          break;
        case "highlightNode":
          highlightNode(nodeId);
          break;
        default:
          console.log(`Action ${action} is not supported.`);
      }
      setShowContextMenu(false);
    },
    // Include highlightNodes and deleteNodeAndReattachChildren in the dependency array
    //[highlightNode, deleteNodeAndReattachChildren, edges],
    [highlightNode, edges],
  );

  const onPaneClick = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  // Map over your nodes to conditionally apply a highlighted style or class
  const nodesWithHighlight = nodes.map((node) => ({
    ...node,
    style: {
      ...node.style,
      // Conditional styling: if this node is the one being highlighted, apply styles
      borderColor:
        node.id === highlightedNodeId ? "red" : node.style?.borderColor,
      borderWidth: node.id === highlightedNodeId ? 3 : node.style?.borderWidth,
    },
  }));

  return (
    <>
      <div style={{ position: "absolute", zIndex: 10, top: 60, left: 340 }}>
        <EuiButton
          onClick={handleAddNodeClick}
          iconType="plusInCircle"
          iconSide={"left"}
        >
          Add Node
        </EuiButton>
      </div>

      <ReactFlow
        nodes={nodesWithHighlight}
        edges={edges}
        defaultEdgeOptions={defaultEdgeOptions}
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
        nodesDraggable={true}
        nodesConnectable={true}
        fitView
      >
        <Controls showInteractive={false} />
        <Panel position="top-left">React Flow Mind Map</Panel>
        <CustomMiniMap />
      </ReactFlow>
      {showContextMenu && selectedNodeId && (
        <BayesianNodeContextMenu
          nodeId={selectedNodeId}
          onActionSelect={handleContextMenuAction}
          onClose={() => {
            setShowContextMenu(false);
          }}
          position={contextMenuPosition}
          getParent={useStore.getState().getParent}
          getChildren={useStore.getState().getChildren}
          getParentLabel={useStore.getState().getParentLabel}
          getChildrenLabels={useStore.getState().getChildrenLabels}
        />
      )}
      {showCycleWarning && (
        <EuiToast
          title="Invalid Operation"
          color="warning"
          onClose={() => {
            setShowCycleWarning(false);
          }}
        >
          <p>
            Creating this link would create a cycle, which is not allowed in a
            directed acyclic graph (DAG). Please try a different connection.
          </p>
        </EuiToast>
      )}
    </>
  );
}

export function BayesianNetworkEditor() {
  return (
    <ReactFlowProvider>
      <ReactFlowPro />
    </ReactFlowProvider>
  );
}

export default function BayesianNetworks() {
  return (
    <Routes>
      <Route path="" element={<BayesianNetworkList />} />
      <Route path=":bayesianNetworkId" element={<BayesianNetworkEditor />} />
    </Routes>
  );
}
