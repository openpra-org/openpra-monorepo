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
import {
  EuiGlobalToastList,
  EuiPopover,
  EuiSkeletonRectangle,
  useGeneratedHtmlId,
} from "@elastic/eui";
import { HeatBalanceFaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { Route, Routes, useParams } from "react-router-dom";
import { shallow } from "zustand/shallow";
import { UseLayout } from "../../hooks/heatBalanceFaultTree/useLayout";
import { HeatBalanceFaultTreeNodeTypes } from "../../components/treeNodes/heatBalancefaultTreeNodes/heatBalanceFaultTreeNodeType";
import { EdgeTypes } from "../../components/treeEdges/heatBalanceFaultTreeEdges/heatBalanceFaultTreeEdgeType";

import "reactflow/dist/style.css";

import { HeatBalanceFaultTreeList } from "../../components/lists/nestedLists/heatBalanceFaultTreeList";
import {
  HeatBalanceFaultTreeContextMenu,
  TreeNodeContextMenuProps,
} from "../../components/context_menu/heatBalanceFaultTreeContextMenu";
import { GenerateUUID } from "../../../utils/treeUtils";
import {
  allToasts,
  initialEdges,
  initialNodes,
} from "../../../utils/faultTreeData";
import { RFState, useStore } from "../../store/heatBalanceFaultTreeStore";
import CustomMiniMap from "../../components/minimap/minimap";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

const fitViewOptions = {
  padding: 0.95,
};

type Toast = {
  id: string;
  title: string;
  color: "warning" | "success" | "primary" | "danger" | undefined;
  iconType: string;
  type: string;
};

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

  const { nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges } =
    useStore(selector, shallow);
  const [isLoading, setIsLoading] = useState(true);
  const { heatBalanceFaultTreeId } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const loadGraph = async (): Promise<void> => {
      await GraphApiManager.getHeatBalanceFaultTree(
        heatBalanceFaultTreeId,
      ).then((res: HeatBalanceFaultTreeGraph) => {
        setNodes(res.nodes.length !== 0 ? res.nodes : initialNodes);
        setEdges(res.edges.length !== 0 ? res.edges : initialEdges);

        setIsLoading(false);
      });
    };
    void (isLoading && loadGraph());
  }, [heatBalanceFaultTreeId, isLoading, nodes, toasts]);

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
        right:
          event.clientX - 320 >= pane.width - 200 &&
          pane.width - event.clientX - 800,
        bottom:
          event.clientY >= pane.height - 200 &&
          pane.height - event.clientY - 800,
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
        nodeTypes={HeatBalanceFaultTreeNodeTypes}
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
            <HeatBalanceFaultTreeContextMenu
              onClick={onPaneClick}
              addToastHandler={addToastHandler}
              {...menu}
            />
          )}
        </EuiPopover>
        <CustomMiniMap />
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

/**
 * Function to mimic fault tree behaviour for heat balance fault tree
 * @constructor
 */
function HeatBalanceFaultTrees() {
  return (
    <Routes>
      <Route path="" element={<HeatBalanceFaultTreeList />} />
      <Route path=":heatBalanceFaultTreeId" element={<FaultTreeEditor />} />
    </Routes>
  );
}

export { HeatBalanceFaultTrees };
