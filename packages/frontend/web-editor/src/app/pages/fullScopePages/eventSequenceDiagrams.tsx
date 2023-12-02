import { Route, Routes } from "react-router-dom";
import ReactFlow, {
  Background,
  Edge,
  Node,
  ProOptions,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { EuiPopover, useGeneratedHtmlId } from "@elastic/eui";
import EventSequenceList from "../../components/lists/nestedLists/eventSequenceList";
import useLayout from "../../hooks/eventSequence/useLayout";
import nodeTypes from "../../components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import edgeTypes from "../../components/treeEdges/eventSequenceEdges/eventSequenceEdgeType";
import { EventSequenceContextMenuOptions } from "../../components/context_menu/interfaces/eventSequenceContextMenuOptions.interface";
import EventSequenceContextMenu from "../../components/context_menu/eventSequenceContextMenu";
import { generateUUID } from "../../../utils/treeUtils";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

// initial setup: an initiating event followed by a functional node and 2 end state nodes
const initiating_event_id = generateUUID();
const functional_event_id = generateUUID();
const first_end_state_id = generateUUID();
const second_end_state_id = generateUUID();

const defaultNodes: Node[] = [
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
 * @returns {JSX.Element} The JSX element representing the customized React Flow diagram for event sequence editing.
 */
function ReactFlowPro(): JSX.Element {
  // this hook call ensures that the layout is re-calculated every time the graph changes
  useLayout();

  const { fitView } = useReactFlow();
  const [nodes] = useState<Node[]>(defaultNodes);

  useEffect(() => {
    fitView({ duration: 400 });
  }, [nodes, fitView]);

  const [menu, setMenu] = useState<EventSequenceContextMenuOptions | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });
  const [isOpen, setIsOpen] = useState(false);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Prevent native context menu from showing
      event.preventDefault();

      // context menu not needed for initiating node
      if (node.type === "initiating") return;

      setIsOpen(!isOpen);

      // Calculate position of the context menu. We want to make sure it
      // doesn't get positioned off-screen.
      const left =
        event.clientX + 342 > window.innerWidth
          ? event.clientX - 342
          : event.clientX;
      const top =
        event.clientY + 228 > window.innerHeight
          ? event.clientY - 228
          : event.clientY;
      setMenu({
        id: node.id,
        top: top,
        left: left,
      });
    },
    [setMenu],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => {
    setMenu(null);
    setIsOpen(false);
  }, [setMenu, isOpen]);

  return (
    <ReactFlow
      ref={ref}
      defaultNodes={defaultNodes}
      defaultEdges={defaultEdges}
      proOptions={proOptions}
      fitView
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitViewOptions={fitViewOptions}
      minZoom={1.2}
      nodesDraggable={false}
      nodesConnectable={false}
      zoomOnDoubleClick={false}
      onPaneClick={onPaneClick}
      onNodeContextMenu={onNodeContextMenu}
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
        hasArrow={false}
        style={{
          top: menu?.top,
          left: menu?.left,
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
 * @returns {JSX.Element} The JSX element representing the event sequence editor.
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
 * @returns {JSX.Element} The JSX element representing the component with defined routes.
 */
export default function EventSequenceDiagrams(): JSX.Element {
  return (
    <Routes>
      <Route path="" element={<EventSequenceList />} />
      <Route path=":eventSequenceId" element={<EventSequenceEditor />} />
    </Routes>
  );
}
