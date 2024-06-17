import { Route, Routes, useParams } from "react-router-dom";
import React, {
  FC,
  ReactElement,
  useCallback,
  useContext,
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
  Panel,
  ProOptions,
  ReactFlowProvider,
} from "reactflow";
import {
  EuiButton,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPopover,
  useGeneratedHtmlId,
} from "@elastic/eui";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { set } from "lodash";
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

import nodeTypes from "../../components/treeNodes/eventTreeEditorNode/eventTreeNodeType";

import { UseEventTreeStore } from "../../zustand/Store";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";

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
  depth: number;
};

const ReactFlowPro: React.FC<Props> = ({ depth }) => {
  // this hook call ensures that the layout is re-calculated every time the graph changes
  useLayout(depth);

  const [menu, setMenu] = useState<treeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));

  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });

  const { eventTreeId } = useParams();
  const [isOpen, setIsOpen] = useState(false);

  const { addToast } = UseToastContext();
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    undoStack,
    redoStack,
    undo,
    redo,
    saveGraph,
    onNodesChange,
    onEdgesChange,
    onConnect,
    loadGraph,
    loading,
    setLoading,
    saved,
    setSaved,
  } = UseEventTreeStore((state) => ({
    nodes: state.nodes,
    edges: state.edges,
    setNodes: state.setNodes,
    setEdges: state.setEdges,
    undoStack: state.undoStack,
    redoStack: state.redoStack,
    undo: state.undo,
    redo: state.redo,
    saveGraph: state.saveGraph,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,
    onConnect: state.onConnect,
    loadGraph: state.loadGraph,
    loading: state.loading,
    setLoading: state.setLoading,
    setEventTreeId: state.setEventTreeId,
    saved: state.saved,
    setSaved: state.setSaved,
  }));

  if (saved) {
    addToast({ id: GenerateUUID(), color: "success", text: "Saved!" });
    setSaved(false);
  }

  useEffect(() => {
    void (loading && eventTreeId && loadGraph(eventTreeId));
  }, [eventTreeId]);

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
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
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
      <Panel position={"top-right"}>
        <EuiFlexGroup style={{ marginTop: "4rem" }}>
          <EuiFlexItem>
            <EuiButton
              onClick={undo}
              disabled={!(undoStack.length > 0)}
              iconType={"editorUndo"}
            >
              Undo
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiButton
              onClick={redo}
              disabled={!(redoStack.length > 0)}
              iconType={"editorRedo"}
            >
              Redo
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </Panel>

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
  const input = 2;
  const output = 1;

  const resetSlice = UseEventTreeStore((state) => state.resetSlice);
  resetSlice();
  return (
    <ReactFlowProvider>
      <ReactFlowPro depth={input + output} />
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
