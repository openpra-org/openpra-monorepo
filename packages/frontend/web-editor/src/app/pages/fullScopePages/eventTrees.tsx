import { Route, Routes, useParams } from "react-router-dom";
import React, {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import ReactFlow, {
  Background,
  Edge,
  Node,
  NodeProps,
  NodeTypes,
  ProOptions,
  ReactFlowProvider,
} from "reactflow";
import { EuiPopover, useGeneratedHtmlId } from "@elastic/eui";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventTreeData } from "shared-types/src/lib/types/reactflowGraph/graphData/EventTreeData";
import useTreeData from "../../hooks/eventTree/useTreeData";
import { EventTreeList } from "../../components/lists/nestedLists/eventTreeList";
// TODO:: Need a nx or @nx/webpack based approach to bundle external CSS
import "reactflow/dist/style.css";

import edgeTypes from "../../components/treeEdges/eventTreeEditorEdges/eventTreeEdgeType";

import useLayout from "../../hooks/eventTree/useLayout";
import EventTreeNodeContextMenu, {
  treeNodeContextMenuProps,
} from "../../components/menus/eventTreeNodeContextMenu";
import { LoadingCard } from "../../components/cards/loadingCard";
import VisibleNode from "../../components/treeNodes/eventTreeEditorNode/visibleNode";
import InvisibleNode from "../../components/treeNodes/eventTreeEditorNode/invisibleNode";
import OutputNode from "../../components/treeNodes/eventTreeEditorNode/outputNode";
import ColumnNode from "../../components/treeNodes/eventTreeEditorNode/columnNode";
import nodeTypes from "../../components/treeNodes/eventTreeEditorNode/eventTreeNodeType";

/**
 * Initial set of nodes to be used in the ReactFlow component.
 * @type {Node[]}
 */

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

const fitViewOptions = {
  padding: 0.95,
};

/**
 * The `HorizontalFlow` component sets up a React Flow instance with predefined nodes and edges.
 * It utilizes the `useNodesState` and `useEdgesState` hooks from React Flow to manage the state of nodes and edges.
 * The `onConnect` callback is used to handle new connections between nodes.
 *
 * @returns ReactElement The React Flow component with nodes and edges configured for horizontal layout.
 */
type Props = {
  nodeData: Node[];
  edgeData: Edge[];
  depth: number;
};
type CustomNodeData = {
  label: string;
  depth: number;
  width: number;
  output: boolean;
  inputDepth?: number;
  outputDepth?: number;
};
const ReactFlowPro: React.FC<Props> = ({ nodeData, edgeData, depth }) => {
  // this hook call ensures that the layout is re-calculated every time the graph changes
  useLayout(depth);

  const [menu, setMenu] = useState<treeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });

  const [nodes, setNodes] = useState<Node<CustomNodeData>[]>(nodeData);
  const [edges, setEdges] = useState<Edge[]>(edgeData);

  const [loading, setLoading] = useState(true);
  const { eventTreeId } = useParams();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadGraph = async (): Promise<void> => {
      await GraphApiManager.getEventTree(eventTreeId).then(
        (res: EventTreeGraph) => {
          setNodes(res.nodes.length !== 0 ? res.nodes : nodeData);
          setEdges(res.edges.length !== 0 ? res.edges : edgeData);
          setLoading(false);
        },
      );
    };
    void (loading && loadGraph());
  }, [eventTreeId, loading, nodes]);

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
  return loading ? (
    <LoadingCard />
  ) : (
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
      minZoom={0.8}
      maxZoom={100}
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
        {menu && <EventTreeNodeContextMenu onClick={onPaneClick} {...menu} />}
      </EuiPopover>
    </ReactFlow>
  );
};
/**
 * The EventTreeEditor component wraps the HorizontalFlow component for editing event trees.
 * @returns ReactElement The HorizontalFlow component for editing event trees.
 */

export const EventTreeEditor = (): ReactElement => {
  const input = 4;
  const output = 1;
  const { nodes, edges } = useTreeData(input, output, 140);

  return (
    <ReactFlowProvider>
      <ReactFlowPro nodeData={nodes} edgeData={edges} depth={input + output} />
    </ReactFlowProvider>
  );
};

/**
 * The EventTrees component provides routing for the event tree list and the event tree editor.
 * @returns ReactElement Routes component containing the EventTreeList and EventTreeEditor components.
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
