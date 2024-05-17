/**
 * This example shows how you can use custom nodes and edges to dynamically add elements to your react flow graph.
 * A global layouting function calculates the new positions for the nodes every time the graph changes and animates existing nodes to their new position.
 *
 * There are three ways of adding nodes to the graph:
 *  1. Click an existing node: Create a new child node of the clicked node
 *  2. Click on the plus icon of an existing edge: Create a node in between the connected nodes of the edge
 *  3. Click a placeholder node: Turn the placeholder into a "real" node to prevent jumping of the layout
 *
 * The graph elements are added via hook calls in the custom nodes and edges. The layout is calculated every time the graph changes (see hooks/useLayout.ts).
 **/
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  ProOptions,
  ReactFlowProvider,
} from "reactflow";

import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EuiGlobalToastList, EuiPopover, EuiSkeletonRectangle, useGeneratedHtmlId } from "@elastic/eui";
import { FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { Route, Routes, useParams } from "react-router-dom";
import { shallow } from "zustand/shallow";
import { UseLayout } from "../../hooks/faultTree/useLayout";
import { FaultTreeNodeTypes } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
import { EdgeTypes } from "../../components/treeEdges/faultTreeEdges/faultTreeEdgeType";

import "reactflow/dist/style.css";

import { FaultTreeList } from "../../components/lists/nestedLists/faultTreeList";
import {
  FaultTreeNodeContextMenu,
  TreeNodeContextMenuProps,
} from "../../components/context_menu/faultTreeNodeContextMenu";
import { GenerateUUID } from "../../../utils/treeUtils";
import { allToasts, initialEdges, initialNodes } from "../../../utils/faultTreeData";
import { RFState, useStore } from "../../store/faultTreeStore";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

const fitViewOptions = {
  padding: 0.95,
};

interface Toast {
  id: string;
  title: string;
  color: "warning" | "success" | "primary" | "danger" | undefined;
  iconType: string;
  type: string;
}

const selector = (
  state: RFState,
): {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
} => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  setNodes: state.setNodes,
  setEdges: state.setEdges,
});

function ReactFlowPro(): JSX.Element {
  // this hook call ensures that the layout is re-calculated every time the graph changes
  UseLayout();
  const [menu, setMenu] = useState<TreeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });

  const { nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges } = useStore(selector, shallow);
  const [isLoading, setIsLoading] = useState(true);
  const { faultTreeId } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const loadGraph = async (): Promise<void> => {
      await GraphApiManager.getFaultTree(faultTreeId).then((res: FaultTreeGraph) => {
        setNodes(res.nodes.length !== 0 ? res.nodes : initialNodes);
        setEdges(res.edges.length !== 0 ? res.edges : initialEdges);

        setIsLoading(false);
      });
    };
    void (isLoading && loadGraph());
  }, [faultTreeId, isLoading, nodes, toasts]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Prevent native context menu from showing
      event.preventDefault();
      // Calculate position of the context menu. We want to make sure it
      // doesn't get positioned off-screen.
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
    [setMenu, isOpen],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => {
    setMenu(null);
    setIsOpen(false);
  }, [setMenu]);

  const removeToast = (): void => {
    setToasts([]);
  };

  const addToastHandler = (type: string): void => {
    const toast = allToasts.filter((toast) => toast.type === type)[0];
    setToasts([
      {
        id: GenerateUUID(),
        ...toast,
      },
    ]);
  };

  return isLoading ? (
    <EuiSkeletonRectangle
      isLoading={isLoading}
      width={"100%"}
      height={500}
    ></EuiSkeletonRectangle>
  ) : (
    <>
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
        minZoom={1.2}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        // we are setting deleteKeyCode to null to prevent the deletion of nodes in order to keep the example simple.
        // If you want to enable deletion of nodes, you need to make sure that you only have one root node in your graph.
        // deleteKeyCode={"Delete"}
      >
        <Background />
        <EuiPopover
          id={headerAppPopoverId}
          button={""}
          isOpen={isOpen}
          anchorPosition="downRight"
          style={{
            top: typeof menu?.top === "number" ? menu.top : undefined,
            left: typeof menu?.left === "number" ? menu.left : undefined,
            bottom: typeof menu?.bottom === "number" ? menu.bottom : undefined,
            right: typeof menu?.right === "number" ? menu.right : undefined,
          }}
          closePopover={onPaneClick}
        >
          {menu && (
            <FaultTreeNodeContextMenu
              onClick={onPaneClick}
              addToastHandler={addToastHandler}
              {...menu}
            />
          )}
        </EuiPopover>
      </ReactFlow>
      <EuiGlobalToastList
        toasts={toasts}
        dismissToast={removeToast}
        toastLifeTimeMs={3000}
      />
    </>
  );
}

export function FaultTreeEditor(): JSX.Element {
  return (
    <ReactFlowProvider>
      <ReactFlowPro />
    </ReactFlowProvider>
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
