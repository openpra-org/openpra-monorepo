import { Route, Routes } from "react-router-dom";
import { ReactElement, useCallback } from "react";

import ReactFlow, {
  addEdge,
  Node,
  Edge,
  Connection,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import { EventTreeList } from "../../components/lists/nestedLists/eventTreeList";
// TODO:: Need a nx or @nx/webpack based approach to bundle external CSS
import "reactflow/dist/style.css";

/**
 * Initial set of nodes to be used in the ReactFlow component.
 * @type {Node[]}
 */
const initialNodes: Node[] = [
  {
    id: "horizontal-1",
    sourcePosition: Position.Right,
    type: "input",
    data: { label: "Input" },
    position: { x: 0, y: 80 },
  },
  {
    id: "horizontal-2",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "A Node" },
    position: { x: 250, y: 0 },
  },
  {
    id: "horizontal-3",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Node 3" },
    position: { x: 250, y: 160 },
  },
  {
    id: "horizontal-4",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Node 4" },
    position: { x: 500, y: 0 },
  },
  {
    id: "horizontal-5",
    sourcePosition: Position.Top,
    targetPosition: Position.Bottom,
    data: { label: "Node 5" },
    position: { x: 500, y: 100 },
  },
  {
    id: "horizontal-6",
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: { label: "Node 6" },
    position: { x: 500, y: 230 },
  },
  {
    id: "horizontal-7",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Node 7" },
    position: { x: 750, y: 50 },
  },
  {
    id: "horizontal-8",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Node 8" },
    position: { x: 750, y: 300 },
  },
];

/**
 * Represents the configuration for a connection between two nodes.
 *
 * @property {string} id - The unique identifier for the connection.
 * @property {string} source - The identifier of the source node from which the connection originates.
 * @property {string} type - The type of the connection curve.
 * @property {string} target - The identifier of the target node to which the connection goes.
 * @property {boolean} animated - Indicates whether the connection has animations enabled.
 */
type ConnectionConfig = {
  /** The unique identifier for the connection. */
  id: string;

  /** The identifier of the source node from which the connection originates. */
  source: string;

  /** The type of the connection curve. */
  type: "smoothstep";

  /** The identifier of the target node to which the connection goes. */
  target: string;

  /** Indicates whether the connection has animations enabled. */
  animated: boolean;
};

/**
 * Initial set of edges to be used in the ReactFlow component.
 * @type {Edge<ConnectionConfig>[]}
 */
const initialEdges: Edge<ConnectionConfig>[] = [
  {
    id: "horizontal-e1-2",
    source: "horizontal-1",
    type: "smoothstep",
    target: "horizontal-2",
    animated: true,
  },
  {
    id: "horizontal-e1-3",
    source: "horizontal-1",
    type: "smoothstep",
    target: "horizontal-3",
    animated: true,
  },
  {
    id: "horizontal-e1-4",
    source: "horizontal-2",
    type: "smoothstep",
    target: "horizontal-4",
    label: "edge label",
  },
  {
    id: "horizontal-e3-5",
    source: "horizontal-3",
    type: "smoothstep",
    target: "horizontal-5",
    animated: true,
  },
  {
    id: "horizontal-e3-6",
    source: "horizontal-3",
    type: "smoothstep",
    target: "horizontal-6",
    animated: true,
  },
  {
    id: "horizontal-e5-7",
    source: "horizontal-5",
    type: "smoothstep",
    target: "horizontal-7",
    animated: true,
  },
  {
    id: "horizontal-e6-8",
    source: "horizontal-6",
    type: "smoothstep",
    target: "horizontal-8",
    animated: true,
  },
];

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
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<ConnectionConfig>(initialEdges);

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
function EventTrees(): ReactElement {
  return (
    <Routes>
      <Route path="" element={<EventTreeList />} />
      <Route path=":eventTreeId" element={<EventTreeEditor />}></Route>
    </Routes>
  );
}

export { EventTrees };
