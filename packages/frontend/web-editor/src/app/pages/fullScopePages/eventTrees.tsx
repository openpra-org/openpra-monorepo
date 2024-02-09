import { Route, Routes } from "react-router-dom";
import { ReactElement, useCallback } from "react";

import ReactFlow, {
  addEdge,
  Connection,
  Edge,
  EdgeTypes,
  Node,
  NodeTypes,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import EventTreeList from "../../components/lists/nestedLists/eventTreeList";
// TODO:: Need a nx or @nx/webpack based approach to bundle external CSS
import "reactflow/dist/style.css";

import hiddenNode from "../../components/treeNodes/eventTreeEditorNode/hiddenNode";
import columnNode from "../../components/treeNodes/eventTreeEditorNode/columnNode";
import CustomEdge from "../../components/treeNodes/eventTreeEditorNode/customEdge";

/**
 * Initial set of nodes to be used in the ReactFlow component.
 * @type {Node[]}
 */
const xDistance = 100;
const yDistance = 60;

const initialNodes: Node[] = [
  {
    id: "vertical-1",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    position: { x: xDistance / 2, y: -200 },
  },
  {
    id: "vertical-1-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    position: { x: xDistance / 2, y: 200 },
  },
  {
    id: "vertical-2",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    width: xDistance / 4,
    position: { x: (3 / 2) * xDistance, y: -200 },
  },
  {
    id: "vertical-2-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    width: xDistance / 4,
    position: { x: (3 / 2) * xDistance, y: 200 },
  },
  {
    id: "vertical-3",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    width: xDistance / 4,
    position: { x: (5 / 2) * xDistance, y: -200 },
  },
  {
    id: "vertical-3-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    width: xDistance / 4,
    position: { x: (5 / 2) * xDistance, y: 200 },
  },
  {
    id: "horizontal-1",
    sourcePosition: Position.Right,
    type: "hiddenNode",
    data: { label: "Input" },
    position: { x: 0, y: 0 },
  },
  {
    id: "horizontal-2",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: xDistance, y: -yDistance },
  },
  {
    id: "horizontal-3",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: xDistance, y: yDistance },
  },
  {
    id: "horizontal-4",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: 2 * xDistance, y: (-3 / 2) * yDistance },
  },
  {
    id: "horizontal-5",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: 2 * xDistance, y: -yDistance / 2 },
  },
];

const initialEdges: Edge[] = [
  {
    id: "horizontal-e1-2",
    source: "horizontal-1",
    type: "custom",
    target: "horizontal-2",
    animated: false,
  },
  {
    id: "horizontal-e1-3",
    source: "horizontal-1",
    type: "custom",
    target: "horizontal-3",
    animated: false,
  },
  {
    id: "horizontal-e2-4",
    source: "horizontal-2",
    type: "custom",
    target: "horizontal-4",
    animated: false,
  },
  {
    id: "horizontal-e2-5",
    source: "horizontal-2",
    type: "custom",
    target: "horizontal-5",
    animated: false,
  },
  {
    id: "vertical-l1-connect",
    source: "vertical-1",
    sourceHandle: "a",
    type: "custom",
    target: "vertical-1-connect",
    targetHandle: "a",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-r1-connect",
    source: "vertical-1",
    sourceHandle: "b",
    type: "custom",
    target: "vertical-1-connect",
    targetHandle: "b",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-l2-connect",
    source: "vertical-2",
    sourceHandle: "a",
    type: "custom",
    target: "vertical-2-connect",
    targetHandle: "a",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-r2-connect",
    source: "vertical-2",
    sourceHandle: "b",
    type: "custom",
    target: "vertical-2-connect",
    targetHandle: "b",
    data: { straight: true, color: "grey" },
    animated: false,
  },
];

const nodeTypes: NodeTypes = {
  hiddenNode: hiddenNode,
  columnNode: columnNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};
/**
 * The `HorizontalFlow` component sets up a React Flow instance with predefined nodes and edges.
 * It utilizes the `useNodesState` and `useEdgesState` hooks from React Flow to manage the state of nodes and edges.
 * The `onConnect` callback is used to handle new connections between nodes.
 *
 * @returns {ReactElement} The React Flow component with nodes and edges configured for horizontal layout.
 */
const HorizontalFlow = (): ReactElement => {
  // State hook for nodes, initialized with `initialNodes`.
  // The second parameter (unused) would be a function to set nodes, hence the double comma.
  const [nodes, , onNodesChange] = useNodesState<Node[]>(initialNodes);

  // State hook for edges, initialized with `initialEdges`.
  // `setEdges` is used to update the edges state when new connections are made.
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // `useCallback` hook to memoize the `onConnect` function, which adds a new edge when nodes are connected.
  // It depends on `setEdges`, so it will only change if `setEdges` changes.
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((els) => addEdge(params, els));
    },
    [setEdges],
  );

  // The React Flow component is returned with the configured nodes and edges.
  // Event handlers for node and edge changes are provided, as well as the `onConnect` handler.
  // `fitView` is enabled to ensure all nodes are visible within the viewport.
  // `attributionPosition` is set to show the React Flow attribution in the bottom-left corner.
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      attributionPosition="bottom-left"
    ></ReactFlow>
  );
};

/**
 * The EventTreeEditor component wraps the HorizontalFlow component for editing event trees.
 * @returns {ReactElement} The HorizontalFlow component for editing event trees.
 */

export function EventTreeEditor(): ReactElement {
  return <HorizontalFlow />;
}

/**
 * The EventTrees component provides routing for the event tree list and the event tree editor.
 * @returns {ReactElement} Routes component containing the EventTreeList and EventTreeEditor components.
 */
export default function EventTrees(): ReactElement {
  return (
    <Routes>
      <Route path="" element={<EventTreeList />} />
      <Route path=":eventTreeId" element={<EventTreeEditor />}></Route>
    </Routes>
  );
}
