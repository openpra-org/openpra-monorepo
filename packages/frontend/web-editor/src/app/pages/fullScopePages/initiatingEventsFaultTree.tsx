import {Route, Routes} from "react-router-dom";
import React from "react";
import ReactFlow, {
  Background,
  Edge,
  Node,
  ProOptions,
  ReactFlowProvider,
} from 'reactflow';

// import useLayout from './hooks/useLayout';
// import nodeTypes from './NodeTypes';
// import edgeTypes from './EdgeTypes';
import useLayout from "../../hooks/faultTree/useLayout";
import nodeTypes from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
import edgeTypes from "../../components/treeEdges/faultTreeEdges/faultTreeEdgeType";

import 'reactflow/dist/style.css';

const proOptions: ProOptions = { account: 'paid-pro', hideAttribution: true };

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

  return (
    <>
      <ReactFlow
        defaultNodes={defaultNodes}
        defaultEdges={defaultEdges}
        proOptions={proOptions}
        fitView
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        // we are setting deleteKeyCode to null to prevent the deletion of nodes in order to keep the example simple.
        // If you want to enable deletion of nodes, you need to make sure that you only have one root node in your graph.
        deleteKeyCode={null}
      >
        <Background />
      </ReactFlow>
    </>
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
