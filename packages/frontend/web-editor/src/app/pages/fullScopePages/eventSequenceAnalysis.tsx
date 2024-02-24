import EventSequenceAnalysisList from "../../components/lists/nestedLists/eventSequenceAnalysisList";
import {Route, Routes, useParams} from "react-router-dom";
import React, {useState, useCallback} from "react";
import { stratify, tree, hierarchy, HierarchyNode } from 'd3-hierarchy';
import ReactFlow, {
  ReactFlowProvider,
  Panel,
  useNodes,
  useEdges,
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
} from 'reactflow';

import 'reactflow/dist/style.css';

// Define the interfaces for Node and Edge
interface Node {
  id: string;
  type?: string;
  data: { label: string };
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
}

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
];

const initialEdges: Edge[] = [
  { id: 'e12', source: '1', target: '2', animated: true },
  { id: 'e13', source: '1', target: '3', animated: true },
  { id: 'e22a', source: '2', target: '2a', animated: true },
  { id: 'e22b', source: '2', target: '2b', animated: true },
  { id: 'e22c', source: '2', target: '2c', animated: true },
  { id: 'e2c2d', source: '2c', target: '2d', animated: true },
];


// Function to generate ReactFlow elements from initialNodes and initialEdges
const generateReactFlowElements = (): { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } => {
  // Convert initialNodes and initialEdges into a hierarchical structure
  const hierarchyData = {
    id: 'root',
    data: { label: 'root' }, // Add a label for the root node
    position: { x: 0, y: 0 }, // Set the position for the root node
    children: initialNodes.map((node) => ({
      id: node.id,
      data: { label: node.data.label }, // Set label data for each node
      position: { x: node.position.x, y: node.position.y }, // Set position for each node
      children: initialEdges
        .filter((edge) => edge.source === node.id)
        .map((edge) => ({
          id: edge.id,
          data: { label: `edge ${edge.id}` }, // Set label data for each edge (optional)
          source: edge.source,
          target: edge.target,
          animated: edge.animated,
        })),
    })),
  };

  // Create the tree layout
  const treeLayout = tree<Node>().nodeSize([300, 300]);

  // Apply the tree layout to the hierarchy data
  const rootNode = hierarchy<Node>(hierarchyData);
  const treeNodes: HierarchyNode<Node>[] = treeLayout(rootNode).descendants();

  // Convert tree nodes and edges to ReactFlow elements
  const nodes: ReactFlowNode[] = treeNodes.map((node) => ({
    id: node.data.id,
    data: { label: node.data.data.label },
    position: {
      x: node.data.position ? node.data.position.x : 0,
      y: node.data.position ? node.data.position.y : 0
    },
    type: node.data.type || 'default',
  }));


  const edges: ReactFlowEdge[] = initialEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.animated,
  }));

  return { nodes, edges };
};

const FlowChart = () => {
  const { nodes, edges } = generateReactFlowElements();

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ReactFlowProvider>
        <ReactFlow
          defaultNodes={nodes}
          defaultEdges={edges}
          style={{ height: '100%', width: '100%' }}>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export function EventSequenceAnalysisEditor() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const { EventSequenceAnalysisId } = useParams();
  return (
    <ReactFlowProvider>
      <FlowChart />
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
