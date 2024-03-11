import { Route, Routes, useParams } from "react-router-dom";
import ReactFlow, {
  Background,
  Edge,
  Node,
  ProOptions,
  ReactFlowProvider,
  useKeyPress,
  useReactFlow,
} from "reactflow";
import { useEffect, useState, useRef, useCallback } from "react";
import { EuiPopover, useGeneratedHtmlId } from "@elastic/eui";
import { GraphApiManager } from "shared-types/src/lib/api/GraphApiManager";
import { EventSequenceGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { EventSequenceList } from "../../components/lists/nestedLists/eventSequenceList";
import { UseLayout } from "../../hooks/eventSequence/useLayout";
import {
  ESNodeTypes,
  EventSequenceNodeProps,
} from "../../components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import { ESEdgeTypes } from "../../components/treeEdges/eventSequenceEdges/eventSequenceEdgeType";
import { EventSequenceContextMenuOptions } from "../../components/context_menu/interfaces/eventSequenceContextMenuOptions.interface";
import { EventSequenceContextMenu } from "../../components/context_menu/eventSequenceContextMenu";
import {
  DeleteEventSequenceNode,
  GenerateUUID,
  IsNodeDeletable,
  StoreEventSequenceDiagramCurrentState,
} from "../../../utils/treeUtils";
import { LoadingCard } from "../../components/cards/loadingCard";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

// initial setup: an initiating event followed by a functional node and 2 end state nodes
const initiating_event_id = GenerateUUID();
const functional_event_id = GenerateUUID();
const first_end_state_id = GenerateUUID();
const second_end_state_id = GenerateUUID();

const defaultNodes: Node<object>[] = [
  {
    id: initiating_event_id,
    data: {},
    position: { x: 0, y: 0 },
    type: "initiating",
  },
  {
    id: functional_event_id,
    data: {},
    position: { x: 0, y: 0 },
    type: "functional",
  },
  {
    id: first_end_state_id,
    data: {},
    position: { x: 0, y: 0 },
    type: "end",
  },
  {
    id: second_end_state_id,
    data: {},
    position: { x: 0, y: 0 },
    type: "end",
  },
];

// initial setup: connect the initiating node to the functional node with a normal edge
// and connect the functional node to 2 end state nodes with functional edges (with labels)
const defaultEdges: Edge[] = [
  {
    id: `${initiating_event_id}->${functional_event_id}`,
    source: initiating_event_id,
    target: functional_event_id,
    type: "normal",
  },
  {
    id: `${functional_event_id}->${first_end_state_id}`,
    source: functional_event_id,
    target: first_end_state_id,
    type: "functional",
    label: "Yes",
  },
  {
    id: `${functional_event_id}->${second_end_state_id}`,
    source: functional_event_id,
    target: second_end_state_id,
    type: "functional",
    label: "No",
  },
];

const fitViewOptions = {
  padding: 0.95,
};

/**
 * React component representing a customized version of the React Flow diagram for event sequence editing.
 *
 * This component includes additional features and options for event sequence editing, such as context menus, popover,
 * and the ability to disable certain interactions like dragging and connecting nodes.
 *
 * @returns JSX.Element - The JSX element representing the customized React Flow diagram for event sequence editing.
 */
function ReactFlowPro(): JSX.Element {
  // this hook call ensures that the layout is re-calculated every time the graph changes
  UseLayout();

  const { fitView, getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const [nodes, updateNodes] = useState<Node<object>[]>(defaultNodes);
  const [edges, updateEdges] = useState<Edge[]>(defaultEdges);
  const { eventSequenceId } = useParams() as { eventSequenceId: string };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fitView({ duration: 400 });
    const loadGraph = async (): Promise<void> => {
      await GraphApiManager.getEventSequence(eventSequenceId).then(
        (res: EventSequenceGraph) => {
          updateNodes(res.nodes.length !== 0 ? res.nodes : defaultNodes);
          updateEdges(res.edges.length !== 0 ? res.edges : defaultEdges);
          setLoading(false);
        },
      );
    };
    void (loading && loadGraph());
  }, [nodes, fitView, loading, eventSequenceId]);

  const [menu, setMenu] = useState<EventSequenceContextMenuOptions | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });
  const [isOpen, setIsOpen] = useState(false);
  const deleteKeyPressed = useKeyPress(["Delete", "Backspace"]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<EventSequenceNodeProps>) => {
      // Prevent native context menu from showing
      event.preventDefault();

      // context menu not needed for initiating node
      if (node.type === "initiating") return;

      // if node is tentative or can be deleted (in case of functional node deletion process), don't show context menu
      if (node.data.isDeleted === true || node.data.tentative === true) return;

      setIsOpen(!isOpen);

      // Calculate position of the context menu. We want to make sure it
      // doesn't get positioned off-screen.
      const left = event.clientX - 200;
      const top =
        event.clientY + 228 > window.innerHeight
          ? event.clientY - 160
          : event.clientY;
      setMenu({
        id: node.id,
        top: top,
        left: left,
        isDelete: IsNodeDeletable(node.type),
        onClick: onPaneClick,
      });
    },
    [isOpen],
  );

  useEffect(() => {
    const selectedNode: Node<EventSequenceNodeProps> | undefined =
      getNodes().find((node) => node.selected);
    if (selectedNode !== undefined) {
      const updatedState = DeleteEventSequenceNode(
        selectedNode,
        getNodes(),
        getEdges(),
      );
      if (updatedState !== undefined) {
        setNodes(updatedState.nodes);
        setEdges(updatedState.edges);

        if (updatedState.updateState) {
          StoreEventSequenceDiagramCurrentState(
            eventSequenceId,
            updatedState.nodes,
            updatedState.edges,
          );
        }
      }
    }
  }, [
    deleteKeyPressed,
    eventSequenceId,
    getEdges,
    getNodes,
    setEdges,
    setNodes,
  ]);

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => {
    setMenu(null);
    setIsOpen(false);
  }, [setMenu]);

  return loading ? (
    <LoadingCard />
  ) : (
    <ReactFlow
      ref={ref}
      defaultNodes={nodes}
      defaultEdges={edges}
      proOptions={proOptions}
      fitView
      nodeTypes={ESNodeTypes}
      edgeTypes={ESEdgeTypes}
      fitViewOptions={fitViewOptions}
      minZoom={1.2}
      nodesDraggable={false}
      nodesConnectable={false}
      zoomOnDoubleClick={false}
      onPaneClick={onPaneClick}
      onNodeContextMenu={onNodeContextMenu}
      multiSelectionKeyCode={null}
      deleteKeyCode={null}
    >
      <Background />
      <EuiPopover
        id={headerAppPopoverId}
        button={<div style={{ width: 0, height: 0 }}></div>}
        isOpen={isOpen}
        anchorPosition="downRight"
        hasArrow={false}
        style={{
          top: menu?.top,
          left: menu?.left,
        }}
        panelStyle={{
          width: 220,
        }}
        closePopover={onPaneClick}
      >
        {menu && <EventSequenceContextMenu onClick={onPaneClick} {...menu} />}
      </EuiPopover>
    </ReactFlow>
  );
}

/**
 * React component representing an event sequence editor.
 *
 * This component uses the `ReactFlowProvider` to provide the necessary context for managing nodes and edges in a flowchart-like UI.
 * It also includes the `ReactFlowPro` component, which likely contains the interactive elements and controls for editing the event sequence.
 *
 * @returns JSX.Element - The JSX element representing the event sequence editor.
 */
export function EventSequenceEditor(): JSX.Element {
  return (
    <ReactFlowProvider>
      <ReactFlowPro />
    </ReactFlowProvider>
  );
}

/**
 * React component representing a set of routes for managing event sequence diagrams.
 *
 * This component uses the `Routes` and `Route` components from React Router to define different views for
 * displaying a list of event sequences (`EventSequenceList`) and editing a specific event sequence (`EventSequenceEditor`).
 *
 * @returns JSX.Element - The JSX element representing the component with defined routes.
 */
function EventSequenceDiagrams(): JSX.Element {
  return (
    <Routes>
      <Route path="" element={<EventSequenceList />} />
      <Route path=":eventSequenceId" element={<EventSequenceEditor />} />
    </Routes>
  );
}

export { EventSequenceDiagrams };
