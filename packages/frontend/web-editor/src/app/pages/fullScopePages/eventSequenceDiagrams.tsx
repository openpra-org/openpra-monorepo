import { Route, Routes, useParams } from "react-router-dom";
import ReactFlow, {
  Background,
  Edge,
  Node,
  ProOptions,
  ReactFlowProvider,
  useKeyPress,
  useReactFlow,
  MiniMap,
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
  EventSequenceNodeTypes,
} from "../../components/treeNodes/eventSequenceNodes/eventSequenceNodeType";
import {
  ESEdgeTypes,
  EventSequenceEdgeProps,
} from "../../components/treeEdges/eventSequenceEdges/eventSequenceEdgeType";
import { EventSequenceContextMenuOptions } from "../../components/context_menu/interfaces/eventSequenceContextMenuOptions.interface";
import { EventSequenceContextMenu } from "../../components/context_menu/eventSequenceContextMenu";
import {
  DeleteEventSequenceNode,
  GetESToast,
  IsCurrentStateTentative,
  IsNodeDeletable,
  RevertTentativeState,
  UpdateEventSequenceDiagram,
} from "../../../utils/treeUtils";
import { LoadingCard } from "../../components/cards/loadingCard";
import { UseToastContext } from "../../providers/toastProvider";
import { FocusProvider } from "../../providers/focusProvider";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

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
  const { addToast } = UseToastContext();
  const [nodes, updateNodes] = useState<Node<object>[]>([]);
  const [edges, updateEdges] = useState<Edge[]>([]);
  const { eventSequenceId } = useParams() as { eventSequenceId: string };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fitView({ duration: 400 });
    const loadGraph = async (): Promise<void> => {
      await GraphApiManager.getEventSequence(eventSequenceId).then((res: EventSequenceGraph) => {
        updateNodes(res.nodes.length !== 0 ? res.nodes : []);
        updateEdges(res.edges.length !== 0 ? res.edges : []);
        setLoading(false);
      });
    };
    void (loading && loadGraph());
  }, [nodes, fitView, loading, eventSequenceId]);

  const [menu, setMenu] = useState<EventSequenceContextMenuOptions | null>(null);
  const ref = useRef<HTMLDivElement>(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });
  const [isOpen, setIsOpen] = useState(false);
  const deleteKeyPressed = useKeyPress(["Delete", "Backspace"]);

  const onPopoverClose = useCallback(() => {
    setMenu(null);
    setIsOpen(false);
  }, []);

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => {
    if (isOpen) {
      setMenu(null);
      setIsOpen(false);
    }
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    if (IsCurrentStateTentative(currentNodes, currentEdges)) {
      addToast(GetESToast("primary", "Reverting the tentative state."));
      const { updatedState } = RevertTentativeState(currentNodes, currentEdges);
      setNodes(updatedState.nodes);
      setEdges(updatedState.edges);
    }
  }, [addToast, getEdges, getNodes, isOpen, setEdges, setNodes]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<EventSequenceNodeProps>) => {
      // Prevent native context menu from showing
      event.preventDefault();

      // context menu not needed for initiating node
      if (node.type === "initiating") return;

      // if node is tentative or can be deleted (in case of functional node deletion process), don't show context menu
      if (node.data.isDeleted === true || node.data.tentative === true) return;

      // if the current state is tentative, disallow node to be updated
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      if (IsCurrentStateTentative(currentNodes, currentEdges)) {
        addToast(GetESToast("primary", "Reverting the tentative state."));
        const { updatedState } = RevertTentativeState(currentNodes, currentEdges);
        setNodes(updatedState.nodes);
        setEdges(updatedState.edges);
      }

      setIsOpen(!isOpen);

      // Calculate position of the context menu. We want to make sure it
      // doesn't get positioned off-screen.
      const left = event.clientX - 200;
      const top = event.clientY + 228 > window.innerHeight ? event.clientY - 160 : event.clientY;
      setMenu({
        id: node.id,
        top: top,
        left: left,
        isDelete: IsNodeDeletable(node.type),
        onClick: onPopoverClose,
      });
    },
    [addToast, getEdges, getNodes, isOpen, onPopoverClose, setEdges, setNodes],
  );

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node<EventSequenceNodeProps>) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      if (IsCurrentStateTentative(currentNodes, currentEdges)) {
        const solidNodes: Node<EventSequenceNodeProps>[] = currentNodes.map((_node: Node<EventSequenceNodeProps>) => {
          if (
            _node.data.branchId !== undefined &&
            _node.data.tentative === true &&
            _node.data.branchId === node.data.branchId
          ) {
            _node.selected = true;
            _node.data.tentative = false;
          }
          return _node;
        });

        const solidEdges: Edge<EventSequenceEdgeProps>[] = currentEdges.map((_edge: Edge<EventSequenceEdgeProps>) => {
          if (_edge.data && _edge.data.tentative === true && _edge.data.branchId === node.data.branchId) {
            _edge.data.tentative = false;
            _edge.animated = false;
          }
          return _edge;
        });

        setNodes(solidNodes);
        setEdges(solidEdges);
      }
    },
    [getEdges, getNodes, setEdges, setNodes],
  );

  const onNodeMouseLeave = useCallback(
    (_: React.MouseEvent, node: Node<EventSequenceNodeProps>) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      if (IsCurrentStateTentative(currentNodes, currentEdges)) {
        const grayedNodes: Node<EventSequenceNodeProps>[] = currentNodes.map((_node: Node<EventSequenceNodeProps>) => {
          if (
            _node.data.tentative !== undefined &&
            _node.data.branchId !== undefined &&
            _node.data.branchId === node.data.branchId &&
            !_node.data.tentative
          ) {
            _node.selected = false;
            _node.data.tentative = true;
          }
          return _node;
        });

        const grayedEdges: Edge<EventSequenceEdgeProps>[] = currentEdges.map((_edge: Edge<EventSequenceEdgeProps>) => {
          if (
            _edge.data?.branchId !== undefined &&
            _edge.data.branchId === node.data.branchId &&
            _edge.data.tentative === false
          ) {
            _edge.data.tentative = true;
            _edge.animated = true;
          }
          return _edge;
        });

        setNodes(grayedNodes);
        setEdges(grayedEdges);
      }
    },
    [getEdges, getNodes, setEdges, setNodes],
  );

  useEffect(() => {
    const selectedNode: Node<EventSequenceNodeProps, EventSequenceNodeTypes> | undefined = getNodes().find(
      (node) => node.selected,
    ) as Node<EventSequenceNodeProps, EventSequenceNodeTypes> | undefined;
    if (selectedNode !== undefined) {
      const onDeleteState = DeleteEventSequenceNode(selectedNode, getNodes(), getEdges());
      if (onDeleteState !== undefined) {
        setNodes(onDeleteState.updatedState.nodes);
        setEdges(onDeleteState.updatedState.edges);
        if (onDeleteState.syncState) {
          UpdateEventSequenceDiagram(eventSequenceId, onDeleteState.updatedSubgraph, onDeleteState.deletedSubgraph)
            .then((r) => {
              if (!r) {
                addToast(GetESToast("danger", "Something went wrong"));
              }
            })
            .catch(() => {
              addToast(GetESToast("danger", "Something went wrong"));
            });
        }
      }
    }
  }, [addToast, deleteKeyPressed, eventSequenceId, getEdges, getNodes, setEdges, setNodes]);

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
      minZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      zoomOnDoubleClick={false}
      onPaneClick={onPaneClick}
      onNodeContextMenu={onNodeContextMenu}
      multiSelectionKeyCode={null}
      deleteKeyCode={null}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
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
        closePopover={onPopoverClose}
      >
        {menu && (
          <EventSequenceContextMenu
            onClick={onPopoverClose}
            {...menu}
          />
        )}
      </EuiPopover>
      <MiniMap
        draggable={true}
        zoomable={true}
        nodeColor={"#0984e3"}
        position={"bottom-left"}
      />
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
    <FocusProvider>
      <ReactFlowProvider>
        <ReactFlowPro />
      </ReactFlowProvider>
    </FocusProvider>
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
      <Route
        path=""
        element={<EventSequenceList />}
      />
      <Route
        path=":eventSequenceId"
        element={<EventSequenceEditor />}
      />
    </Routes>
  );
}

export { EventSequenceDiagrams };
