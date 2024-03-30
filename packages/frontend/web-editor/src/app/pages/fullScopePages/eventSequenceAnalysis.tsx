import EventSequenceAnalysisList from "../../components/lists/nestedLists/eventSequenceAnalysisList";
import {Route, Routes, useParams} from "react-router-dom";
import React, {useState, useEffect, useCallback } from "react";
import * as d3 from 'd3';
import { tree, cluster, stratify } from "d3-hierarchy";
import ReactFlow, {
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
  Node,
  Edge,
  Panel,
  useReactFlow
} from "reactflow";

import 'reactflow/dist/style.css';


const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'input' },
    position: { x: 0, y: 0 },
  },
  {
    id: '2',
    data: { label: 'node 2' },
    position: { x: 0, y: 100 },
  },
  {
    id: '2a',
    data: { label: 'node 2a' },
    position: { x: 0, y: 200 },
  },
  {
    id: '2b',
    data: { label: 'node 2b' },
    position: { x: 0, y: 300 },
  },
  {
    id: '2c',
    data: { label: 'node 2c' },
    position: { x: 0, y: 400 },
  },
  {
    id: '2d',
    data: { label: 'node 2d' },
    position: { x: 0, y: 500 },
  },
  {
    id: '3',
    data: { label: 'node 3' },
    position: { x: 200, y: 100 },
  },
  {
      id: '4',
      data: { label: 'node 4' },
      position: { x: 200, y: 100 },
  },
  {
      id: '4a',
      data: { label: 'node 4a' },
      position: { x: 200, y: 100 },
  },
  {
      id: '4b',
      data: { label: 'node 4b' },
      position: { x: 200, y: 100 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e12', source: '1', target: '2', animated: true },
  { id: 'e13', source: '1', target: '3', animated: true },
  { id: 'e22a', source: '2', target: '2a', animated: true },
  { id: 'e22b', source: '2', target: '2b', animated: true },
  { id: 'e22c', source: '2', target: '2c', animated: true },
  { id: 'e2c2d', source: '2c', target: '2d', animated: true },
  { id: 'e14', source: '1', target: '4', animated: true },
  { id: 'e44a', source: '4', target: '4a', animated: true },
  { id: 'e44b', source: '4', target: '4b', animated: true },
];

const layout = cluster<Node>().size([360, 360])
    .separation(() => 1.5);

const getLayoutedElements = (nodes: Node[], edges:Edge[]) => {
  if (nodes.length === 0) return { nodes, edges };

  const hierarchy = stratify<Node>()
    .id((d) => d.id)
    // get the id of each node by searching through the edges
    // this only works if every node has one connection
    .parentId(
      (d: Node) => edges.find((e: Edge) => e.target === d.id)?.source,
    )(nodes);

  const root = layout(hierarchy);

  nodes = root.descendants().map((d) => {
      // For each node, calculate its polar coordinates (radius and angle)
      const radius = d.y;
      const angle = (d.x - 90) * (Math.PI / 180);

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return {
          ...d.data,
          position: {
              x: x,
              y: y,
          },
      };
  });
  return {
    nodes,
    edges,
  };
};

const LayoutFlow = () => {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onLayout = useCallback(
    () => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);

      window.requestAnimationFrame(() => {
        fitView();
      });
    },
    [nodes, edges]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      >
      <Panel position="bottom-center">
        <button onClick={onLayout}>layout</button>
      </Panel>
    </ReactFlow>
  );
};

export function EventSequenceAnalysisEditor() {
  // const [nodes, setNodes] = useState<Node[]>(initialNodes);
  // const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const { EventSequenceAnalysisId } = useParams();
  console.log(EventSequenceAnalysisId);
  return (
    <ReactFlowProvider>
      <LayoutFlow />
    </ReactFlowProvider>
  );
}

export default function EventSequenceAnalysis() {
  return (
    <Routes>
      <Route path="" element={<EventSequenceAnalysisList />} />
      <Route path=":EventSequenceAnalysisId" element={<EventSequenceAnalysisEditor />} />
    </Routes>
  );
}
