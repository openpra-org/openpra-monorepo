/**
 * This example shows how you can use custom nodes and edges to dynamically add elements to your react flow graph.
 * A global layouting function calculates the new positions for the nodes every time the graph changes and animates existing nodes to their new position.
 *
 * There are three ways of adding nodes to the graph:
 *  1. Click an existing node: Create a new child node of the clicked node
 *  2. Click on the plus icon of an existing edge: Create a node in between the connected nodes of the edge
 *  3. Click a placeholder node: Turn the placeholder into a "real" node to prevent jumping of the layout
 *
 * The graph elements are added via hook calls in the custom nodes and edges. The layout is calculated every time the graph changes (see hooks/useLayout.ts).
 **/
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, { Background, FitViewOptions, Node, Panel, ProOptions, ReactFlowProvider } from "reactflow";

import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { EuiButtonIcon, EuiFlexGroup, EuiFlexItem, EuiPopover, EuiSkeletonRectangle } from "@elastic/eui";
import { FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { Route, Routes, useParams } from "react-router-dom";
import { UseLayout } from "../../hooks/faultTree/useLayout";
import { FaultTreeNodeTypes } from "../../components/treeNodes/faultTreeNodes/faultTreeNodeType";
import { EdgeTypes } from "../../components/treeEdges/faultTreeEdges/faultTreeEdgeType";

import "reactflow/dist/style.css";

import { FaultTreeList } from "../../components/lists/nestedLists/faultTreeList";
import {
  FaultTreeNodeContextMenu,
  TreeNodeContextMenuProps,
} from "../../components/context_menu/faultTreeNodeContextMenu";
import { exitGrayedState, GenerateUUID, isSubgraphGrayed } from "../../../utils/treeUtils";
import { allToasts, initialEdges, initialNodes } from "../../../utils/faultTreeData";
import { useStore } from "../../store/faultTreeStore";
import { useUndoRedo } from "../../hooks/faultTree/useUndeRedo";
import { EDITOR_REDO, EDITOR_UNDO, SMALL } from "../../../utils/constants";
import Minimap from "../../components/minimap/minimap";
import { UseToastContext } from "../../providers/toastProvider";
import { getGraphSignature, shouldApplyGraph } from "../../hooks/faultTree/graphApplyGuard";

const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };

const fitViewOptions: FitViewOptions = {
  padding: 0.95,
};

function ReactFlowPro(): JSX.Element {
  const [menu, setMenu] = useState<TreeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const setNodes = useStore((s) => s.setNodes);
  const setEdges = useStore((s) => s.setEdges);
  const [isLoading, setIsLoading] = useState(true);
  const { faultTreeId } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const { addToast } = UseToastContext();
  // ensure layout only runs after initial load to avoid re-entrant state updates while loading
  UseLayout(!isLoading);
  // instrumentation & re-apply guard
  const lastAppliedSigRef = useRef<string | undefined>(undefined);
  const loadRunsRef = useRef<number>(0);

  // if the route param changes, reset loading state and last-applied signature
  // so we fetch and apply the new graph
  useEffect(() => {
    lastAppliedSigRef.current = undefined;
    setIsLoading(true);
  }, [faultTreeId]);

  useEffect(() => {
    // fetch and initialize graph only once per id when loading
    if (!isLoading) return;
    if (!faultTreeId) return;

    let cancelled = false;
    const loadGraph = async (): Promise<void> => {
      loadRunsRef.current += 1;
      try {
        const res: FaultTreeGraph = await GraphApiManager.getFaultTree(faultTreeId);
        if (cancelled) return;
        const backendEmpty = res.nodes.length === 0 && res.edges.length === 0;
        if (backendEmpty) {
          addToast({ id: GenerateUUID(), title: "No saved fault tree found; showing starter graph", color: "warning" });
        }
        const nextNodes = backendEmpty ? initialNodes : res.nodes;
        const nextEdges = backendEmpty ? initialEdges : res.edges;
        const nextSig = getGraphSignature(nextNodes, nextEdges);
        if (lastAppliedSigRef.current && !shouldApplyGraph(lastAppliedSigRef.current, nextSig)) {
          // same graph shape as last applied; skip to avoid redundant state updates
          // eslint-disable-next-line no-console
          console.debug("[FaultTreeEditor] loadGraph skipped redundant apply", {
            runs: loadRunsRef.current,
            faultTreeId,
            nextSig,
          });
        } else {
          setNodes(nextNodes);
          setEdges(nextEdges);
          lastAppliedSigRef.current = nextSig;
          // eslint-disable-next-line no-console
          console.debug("[FaultTreeEditor] loadGraph applied", { runs: loadRunsRef.current, faultTreeId, nextSig });
        }
      } catch (_err) {
        // graceful fallback if API is down or unauthorized
        if (cancelled) return;
        const fallbackSig = getGraphSignature(initialNodes, initialEdges);
        if (!lastAppliedSigRef.current || shouldApplyGraph(lastAppliedSigRef.current, fallbackSig)) {
          setNodes(initialNodes);
          setEdges(initialEdges);
          lastAppliedSigRef.current = fallbackSig;
        }
        addToast({ id: GenerateUUID(), title: "Failed to load fault tree", color: "warning" });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadGraph();
    return () => {
      cancelled = true;
    };
  }, [faultTreeId, isLoading]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Prevent native context menu from showing
      event.preventDefault();

      //exit grayed state if present
      if (isSubgraphGrayed(nodes, edges)) {
        const { newNodes, newEdges } = exitGrayedState(nodes, edges);
        setNodes(newNodes);
        setEdges(newEdges);
      }

      // Calculate position of the context menu. We want to make sure it
      // doesn't get positioned off-screen.
      setIsOpen(!isOpen);
      const pane = ref.current.getBoundingClientRect();
      setMenu({
        id: node.id,
        top: event.clientY < pane.height - 200 && event.clientY,
        left: event.clientX - 320 < pane.width - 200 && event.clientX - 320,
        right: event.clientX - 320 >= pane.width - 200 && pane.width - event.clientX - 800,
        bottom: event.clientY >= pane.height - 200 && pane.height - event.clientY - 800,
      });
    },
    [nodes, edges, isOpen, setNodes, setEdges],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => {
    closePopover();
    if (isSubgraphGrayed(nodes, edges)) {
      const { newNodes, newEdges } = exitGrayedState(nodes, edges);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [edges, nodes, setEdges, setNodes]);

  const closePopover = (): void => {
    setMenu(null);
    setIsOpen(false);
  };

  const addToastHandler = (type: string): void => {
    const toast = allToasts.filter((toast) => toast.type === type)[0];
    addToast({ id: GenerateUUID(), ...toast });
  };

  return isLoading ?
      <EuiSkeletonRectangle
        isLoading={isLoading}
        width={"100%"}
        height={500}
      ></EuiSkeletonRectangle>
    : <ReactFlow
        ref={ref}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        proOptions={proOptions}
        fitView
        nodeTypes={FaultTreeNodeTypes}
        edgeTypes={EdgeTypes}
        fitViewOptions={fitViewOptions}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        minZoom={1.2}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        // we are setting deleteKeyCode to null to prevent the deletion of nodes in order to keep the example simple.
        // If you want to enable deletion of nodes, you need to make sure that you only have one root node in your graph.
        // deleteKeyCode={"Delete"}
      >
        <Background />
        <Minimap />
        <Panel position="bottom-left">
          <EuiFlexGroup
            responsive={false}
            gutterSize={SMALL}
            alignItems="center"
          >
            <EuiFlexItem
              grow={false}
              onClick={undo}
            >
              <EuiButtonIcon
                isDisabled={canUndo}
                iconType={EDITOR_UNDO}
                display={"base"}
                aria-label="undo"
              />
            </EuiFlexItem>
            <EuiFlexItem
              grow={false}
              onClick={redo}
            >
              <EuiButtonIcon
                isDisabled={canRedo}
                iconType={EDITOR_REDO}
                display={"base"}
                aria-label="redo"
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </Panel>
        <EuiPopover
          button={""}
          isOpen={isOpen}
          anchorPosition="downRight"
          style={{
            top: typeof menu?.top === "number" ? menu.top : undefined,
            left: typeof menu?.left === "number" ? menu.left : undefined,
            bottom: typeof menu?.bottom === "number" ? menu.bottom : undefined,
            right: typeof menu?.right === "number" ? menu.right : undefined,
          }}
          closePopover={closePopover}
        >
          {menu && (
            <FaultTreeNodeContextMenu
              onClick={closePopover}
              addToastHandler={addToastHandler}
              {...menu}
            />
          )}
        </EuiPopover>
      </ReactFlow>;
}

export function FaultTreeEditor(): JSX.Element {
  return (
    <ReactFlowProvider>
      <ReactFlowPro />
    </ReactFlowProvider>
  );
}

function FaultTrees(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<FaultTreeList />}
      />
      <Route
        path=":faultTreeId"
        element={<FaultTreeEditor />}
      />
    </Routes>
  );
}

export { FaultTrees };
