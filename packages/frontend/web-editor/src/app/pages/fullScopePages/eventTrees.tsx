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
import CustomEdge from "../../components/treeEdges/eventTreeEditorEdges/customEdge";

import { edgeData } from "../../components/treeEdges/eventTreeEditorEdges/edgeData";
import { nodeData } from "../../components/treeNodes/eventTreeEditorNode/nodeData";

/**
 * Initial set of nodes to be used in the ReactFlow component.
 * @type {Node[]}
 */

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
  const [nodes, , onNodesChange] = useNodesState<Node[]>(nodeData);

  // State hook for edges, initialized with `initialEdges`.
  // `setEdges` is used to update the edges state when new connections are made.
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgeData);

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
