import { Route, Routes, useParams } from "react-router-dom";
import React, { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, { Edge, Node, ProOptions, ReactFlowProvider, useReactFlow, Panel } from "reactflow";
import { EuiPopover, useGeneratedHtmlId, EuiPanel, EuiFlexGroup, EuiFlexItem, EuiButtonIcon } from "@elastic/eui";
import { EventTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { PostFaultTree } from "shared-sdk/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { GetCurrentModelType } from "shared-sdk/lib/api/TypedModelApiManager";
import { useTreeData } from "../../hooks/eventTree/useTreeData";
import { EventTreeList } from "../../components/lists/nestedLists/eventTreeList";
import { CategoryProvider } from "../../hooks/eventTree/useCreateReleaseCategory";
import { parseOpenPsaEventTreeXml, buildImportedEventTreeGraph } from "../../../utils/parseOpenPsaEventTreeXml";
import { EventTreeState } from "../../../utils/treeUtils";
import "reactflow/dist/style.css";
import { nodeTypes } from "../../components/treeNodes/eventTreeEditorNode/eventTreeNodeType";
import edgeTypes from "../../components/treeEdges/eventTreeEditorEdges/eventTreeEdgeType";
import { EventTreeQuantificationPanel } from "../../components/treeNodes/eventTreeEditorNode/eventTreeQuantificationPanel";
import { EventTreePropertiesPanel } from "../../components/treeNodes/eventTreeEditorNode/eventTreePropertiesPanel";
import { useEventTreeStore } from "../../hooks/eventTree/useEventTreeStore";
import useLayout from "../../hooks/eventTree/useLayout";
import EventTreeNodeContextMenu, { TreeNodeContextMenuProps } from "../../components/menus/eventTreeNodeContextMenu";
import { LoadingCard } from "../../components/cards/loadingCard";
const proOptions: ProOptions = { account: "paid-pro", hideAttribution: true };
const fitViewOptions = {
  padding: 0.2,
  minZoom: 0.5,
  maxZoom: 2,
};
const PANEL_WIDTH = 300;
const FitViewHandler: React.FC = (): null => {
  const reactFlowInstance = useReactFlow();
  useEffect(() => {
    const timer = setTimeout((): void => {
      reactFlowInstance.setViewport({ zoom: 0.8, x: 0, y: 0 }, { duration: 0 });
      setTimeout((): void => {
        reactFlowInstance.fitView({
          ...fitViewOptions,
          duration: 200,
        });
      }, 50);
    }, 250);
    return (): void => {
      clearTimeout(timer);
    };
  }, [reactFlowInstance]);
  return null;
};
interface Props {
  nodeData: Node[];
  edgeData: Edge[];
  depth: number;
}
interface CustomNodeData {
  label: string;
  depth: number;
  width: number;
  output: boolean;
  inputDepth?: number;
  outputDepth?: number;
  faultTreeId?: string;
  allowAdd?: boolean;
}
const ReactFlowPro = ({ nodeData, edgeData, depth }: Props): ReactElement => {
  useLayout(depth);
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();
  const [menu, setMenu] = useState<TreeNodeContextMenuProps | null>(null);
  const ref = useRef(document.createElement("div"));
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });
  const [nodes, setNodes] = useState<Node<CustomNodeData>[]>(nodeData);
  const [edges, setEdges] = useState<Edge[]>(edgeData);
  const [loading, setLoading] = useState(true);
  const { eventTreeId, modelId } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuantifyOpen, setIsQuantifyOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const setFunctionalEvents = useEventTreeStore((s) => s.setFunctionalEvents);
  useEffect((): void => {
    const loadGraph = async (): Promise<void> => {
      await GraphApiManager.getEventTree(eventTreeId).then((res: EventTreeGraph) => {
        setNodes(res.nodes.length !== 0 ? res.nodes : nodeData);
        setEdges(res.edges.length !== 0 ? res.edges : edgeData);
        if (res.functionalEvents) {
          setFunctionalEvents(res.functionalEvents);
        }
        setLoading(false);
      });
    };
    void (loading && loadGraph());
  }, [eventTreeId, loading, nodeData, edgeData, setFunctionalEvents]);
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node): void => {
    event.preventDefault();
    setIsOpen((prev) => !prev);
    const pane = ref.current.getBoundingClientRect();
    setMenu({
      id: node.id,
      top: event.clientY < pane.height - 200 && event.clientY,
      left: event.clientX - 320 < pane.width - 200 && event.clientX - 320,
      right: event.clientX - 320 >= pane.width - 200 && pane.width - event.clientX - 800,
      bottom: event.clientY >= pane.height - 200 && pane.height - event.clientY - 800,
    });
  }, []);
  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node): void => {
      if (node.type === "columnNode") {
        setSelectedNodeId(node.id);
      } else if (node.type === "visibleNode" && (node.data as CustomNodeData).depth === 1) {
        const ieCol = getNodes().find(
          (n) =>
            n.type === "columnNode" && (n.data as CustomNodeData).depth === 1 && !(n.data as CustomNodeData).allowAdd,
        );
        setSelectedNodeId(ieCol?.id ?? null);
      } else {
        setSelectedNodeId(null);
      }
    },
    [getNodes],
  );
  const onPaneClick = useCallback((): void => {
    setMenu(null);
    setIsOpen(false);
    setSelectedNodeId(null);
  }, []);
  const handleImportXml = useCallback(
    async (file: File): Promise<void> => {
      if (!eventTreeId || !modelId) return;
      setIsImporting(true);
      try {
        const xml = await file.text();
        const parsed = parseOpenPsaEventTreeXml(xml);
        const ftNameToId: Record<string, string> = {};
        const typedModel = GetCurrentModelType();
        for (const fe of parsed.eventTree.functionalEvents) {
          if (!fe.faultTreeName || ftNameToId[fe.faultTreeName]) continue;
          const ftData = parsed.faultTrees[fe.faultTreeName];
          if (!ftData) continue;
          const meta = await PostFaultTree(
            { label: { name: fe.faultTreeName, description: "" }, parentIds: [modelId] },
            typedModel,
          );
          await GraphApiManager.storeFaultTree({
            faultTreeId: meta._id,
            topEventId: ftData.topEventId,
            nodes: ftData.nodes,
          });
          ftNameToId[fe.faultTreeName] = meta._id;
        }
        const { nodes: importedNodes, edges: importedEdges } = buildImportedEventTreeGraph(parsed, ftNameToId);
        await GraphApiManager.storeEventTree(
          EventTreeState({ eventTreeId, nodes: importedNodes, edges: importedEdges }),
        );
        setLoading(true);
      } catch (err) {
        console.error("[ET Import]", err);
        alert(`Import failed: ${err instanceof Error ? err.message : "unknown error"}`);
      } finally {
        setIsImporting(false);
        if (importFileRef.current) importFileRef.current.value = "";
      }
    },
    [eventTreeId, modelId, importFileRef],
  );
  return loading ?
      <LoadingCard />
    : <div style={{ position: "absolute", inset: 0, display: "flex", width: "100%", height: "100%" }}>
        <div
          className="react-flow-wrapper"
          style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}
        >
          <ReactFlow
            ref={ref}
            defaultNodes={nodes}
            defaultEdges={edges}
            proOptions={proOptions}
            fitView={false}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onPaneClick={onPaneClick}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            minZoom={0.4}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            className="react-flow-instance"
            style={{ width: "100%", height: "100%" }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
          >
            <Panel position="bottom-left">
              <EuiFlexGroup
                responsive={false}
                gutterSize="s"
                alignItems="center"
              >
                <EuiFlexItem grow={false}>
                  <EuiButtonIcon
                    iconType="compute"
                    display={isQuantifyOpen ? "fill" : "base"}
                    aria-label="quantify event tree"
                    onClick={() => setIsQuantifyOpen((v) => !v)}
                    title="Quantify"
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonIcon
                    iconType="importAction"
                    display="base"
                    aria-label="import OpenPSA XML"
                    isLoading={isImporting}
                    onClick={() => importFileRef.current?.click()}
                    title="Import OpenPSA XML"
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonIcon
                    iconType="plusInCircle"
                    display="base"
                    aria-label="zoom in"
                    onClick={() => void zoomIn({ duration: 200 })}
                    title="Zoom in"
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonIcon
                    iconType="minusInCircle"
                    display="base"
                    aria-label="zoom out"
                    onClick={() => void zoomOut({ duration: 200 })}
                    title="Zoom out"
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonIcon
                    iconType="expand"
                    display="base"
                    aria-label="fit view"
                    onClick={() => void fitView({ duration: 300, padding: 0.15 })}
                    title="Fit to screen"
                  />
                </EuiFlexItem>
              </EuiFlexGroup>
            </Panel>
            <FitViewHandler />
            <input
              ref={importFileRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportXml(file);
              }}
            />
            <EuiPopover
              id={headerAppPopoverId}
              button={<span />}
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
              {menu && (
                <EventTreeNodeContextMenu
                  onClick={onPaneClick}
                  {...menu}
                />
              )}
            </EuiPopover>
          </ReactFlow>
        </div>

        {isQuantifyOpen && eventTreeId && (
          <EuiPanel
            paddingSize="none"
            style={{
              width: PANEL_WIDTH,
              minWidth: PANEL_WIDTH,
              maxWidth: PANEL_WIDTH,
              height: "100%",
              minHeight: 0,
              overflowY: "auto",
              borderLeft: "1px solid #d3dae6",
              flexShrink: 0,
              borderRadius: 0,
            }}
          >
            <EventTreeQuantificationPanel eventTreeId={eventTreeId!} />
          </EuiPanel>
        )}

        {selectedNodeId && (
          <EuiPanel
            paddingSize="none"
            style={{
              width: PANEL_WIDTH,
              minWidth: PANEL_WIDTH,
              maxWidth: PANEL_WIDTH,
              height: "100%",
              minHeight: 0,
              overflowY: "auto",
              borderLeft: "1px solid #d3dae6",
              flexShrink: 0,
              borderRadius: 0,
            }}
          >
            <EventTreePropertiesPanel
              selectedNodeId={selectedNodeId}
              modelId={modelId ?? ""}
            />
          </EuiPanel>
        )}
      </div>;
};
export const EventTreeEditor = (): ReactElement => {
  const input = 2;
  const output = 2;
  const { nodes, edges } = useTreeData(input, output, 140);
  useEffect((): (() => void) => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .react-flow-wrapper {
        height: calc(100vh - 60px) !important;
        width: 100% !important;
        overflow: hidden;
      }
      .react-flow-instance {
        width: 100% !important;
        height: 100% !important;
      }
      .react-flow__viewport {
        transform-origin: 0 0 !important;
      }
      .react-flow__node-columnNode {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .react-flow__node-columnActionsNode {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 60px)", overflow: "hidden" }}>
      <ReactFlowProvider>
        <ReactFlowPro
          nodeData={nodes}
          edgeData={edges}
          depth={input + output}
        />
      </ReactFlowProvider>
    </div>
  );
};
function EventTrees(): ReactElement {
  return (
    <CategoryProvider>
      <Routes>
        <Route
          path=""
          element={<EventTreeList />}
        />
        <Route
          path=":eventTreeId"
          element={<EventTreeEditor />}
        />
      </Routes>
    </CategoryProvider>
  );
}
export { EventTrees };
