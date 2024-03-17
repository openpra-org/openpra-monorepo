import {Route, Routes} from "react-router-dom";
import React, { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Edge,
  Node,
  ProOptions,
  ReactFlowProvider,
} from 'reactflow';

import { EuiPopover, useGeneratedHtmlId } from "@elastic/eui";
import useLayout from "../../hooks/faultTree/useLayout";
import nodeTypes from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
import edgeTypes from "../../components/treeEdges/faultTreeEdges/faultTreeEdgeType";

import "reactflow/dist/style.css";
import FaultTreeNodeContextMenu, {
  treeNodeContextMenuProps,
} from "../../components/context_menu/initiatingEventsFaultTreeContextMenu";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

const defaultNodes: Node[] = [
  {
    id: "1",
    data: { label: "OR Gate" },
    position: { x: 0, y: 0 },
    type: "orGate",
  },
  {
    id: "2",
    data: { label: "Basic Event" },
    position: { x: 0, y: 150 },
    type: "basicEvent",
  },
  {
    id: "3",
    data: { label: "Basic Event" },
    position: { x: 0, y: 150 },
    type: "basicEvent",
  },
];

const defaultEdges: Edge[] = [
  {
    id: "1=>2",
    source: "1",
    target: "2",
    type: "workflow",
  },
  {
    id: "1=>3",
    source: "1",
    target: "3",
    type: "workflow",
  },
];

const fitViewOptions = {
  padding: 0.95,
};


function ReactFlowPro() {
  // this hook call ensures that the layout is re-calculated every time the graph changes
  useLayout();
  const [menu, setMenu] = useState<treeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });

  const [nodes, setNodes] = useState<Node[]>(defaultNodes);
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);
  const [isOpen, setIsOpen] = useState(false);

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
    [setMenu],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => {
    setMenu(null);
    setIsOpen(false);
  }, [setMenu, isOpen]);

  return (
    <ReactFlow
      ref={ref}
      defaultNodes={nodes}
      defaultEdges={edges}
      proOptions={proOptions}
      fitView
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitViewOptions={fitViewOptions}
      onPaneClick={onPaneClick}
      onNodeContextMenu={onNodeContextMenu}
      minZoom={0.2}
      nodesDraggable={false}
      nodesConnectable={false}
      zoomOnDoubleClick={false}
      // we are setting deleteKeyCode to null to prevent the deletion of nodes in order to keep the example simple.
      // If you want to enable deletion of nodes, you need to make sure that you only have one root node in your graph.
      deleteKeyCode={null}
    >
      <Background />
      <EuiPopover
        id={headerAppPopoverId}
        button={<></>}
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
        {menu && <FaultTreeNodeContextMenu onClick={onPaneClick} {...menu} />}
      </EuiPopover>
    </ReactFlow>
  );
}

export function InitiatingEventsFaultTreeEditor() {
  return (
    <ReactFlowProvider>
      <ReactFlowPro />
    </ReactFlowProvider>
  )
}

export default function InitiatingEventsFaultTrees() {
  return (
    <Routes>
      <Route path="" element={<InitiatingEventsFaultTreeEditor />} />
      {/*<Route path=":faultTreeId" element={(<h2>hey</h2>)} />*/}
    </Routes>
  );
}
