import { Route, Routes, useParams } from "react-router-dom";
import {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cluster, stratify, tree } from "d3-hierarchy";
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
import { useGeneratedHtmlId } from "@elastic/eui";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import EventTreeList from "../../components/lists/nestedLists/eventTreeList";
// TODO:: Need a nx or @nx/webpack based approach to bundle external CSS
import "reactflow/dist/style.css";

import hiddenNode from "../../components/treeNodes/eventTreeEditorNode/hiddenNode";
import columnNode from "../../components/treeNodes/eventTreeEditorNode/columnNode";
import CustomEdge from "../../components/treeEdges/eventTreeEditorEdges/customEdge";

import { edgeData } from "../../components/treeEdges/eventTreeEditorEdges/edgeData";
import { nodeData } from "../../components/treeNodes/eventTreeEditorNode/nodeData";
import { colData } from "../../components/treeNodes/eventTreeEditorNode/nodeData";
import useLayout from "../../hooks/eventTree/useLayout";
import { treeNodeContextMenuProps } from "../../components/menus/eventTreeNodeContextMenu";

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

const g = tree();

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  if (nodes.length === 0) return { nodes, edges };

  const element = document.querySelector(`[data-id="${nodes[0].id}"]`);
  if (!element) return { nodes, edges }; // Check if element is null

  const { width, height } = element.getBoundingClientRect();
  const hierarchy = stratify()
    .id((node: any) => node.id)
    .parentId(
      (node: any) => edges.find((edge) => edge.target === node.id)?.source,
    );
  const root = hierarchy(nodes);
  const layout = g.nodeSize([width * 2, height * 2])(root);
  return {
    nodes: layout.descendants().map((node) => ({
      ...(node.data as any),
      position: { x: node.y, y: node.x },
    })),
    edges,
    height: width * 3,
  };
};

/**
 * The `HorizontalFlow` component sets up a React Flow instance with predefined nodes and edges.
 * It utilizes the `useNodesState` and `useEdgesState` hooks from React Flow to manage the state of nodes and edges.
 * The `onConnect` callback is used to handle new connections between nodes.
 *
 * @returns {ReactElement} The React Flow component with nodes and edges configured for horizontal layout.
 */
function ReactFlowPro() {
  // this hook call ensures that the layout is re-calculated every time the graph changes
  useLayout();
  const [menu, setMenu] = useState<treeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });

  const [nodes, setNodes] = useState<Node[]>(nodeData);
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
