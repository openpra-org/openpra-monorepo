import { useCallback, useEffect, useRef, useState, DragEvent } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  ConnectionLineType,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { nanoid } from "nanoid";
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTitle,
  EuiToolTip,
} from "@elastic/eui";
import { NODE_TYPES } from "./pidSymbols";
import { SymbolPalette, DragPayload } from "./symbolPalette";
import { parseDexpiXml } from "./dexpiParser";
import type {
  PidEdgeData,
  PidLineType,
  PidNodeData,
  PidSymbolType,
  PlantDiagramType,
} from "shared-sdk/lib/api/PlantDiagramApiManager";

const LINE_STYLES: Record<PidLineType, React.CSSProperties> = {
  process: { stroke: "#1a1a2e", strokeWidth: 2 },
  instrument_signal: { stroke: "#666", strokeWidth: 1.5, strokeDasharray: "5 4" },
  electrical: { stroke: "#666", strokeWidth: 1.5, strokeDasharray: "8 3 1 3" },
  pneumatic: { stroke: "#999", strokeWidth: 1.5, strokeDasharray: "1 4" },
};

const LINE_TYPE_OPTIONS: { value: PidLineType; text: string }[] = [
  { value: "process", text: "Process line" },
  { value: "instrument_signal", text: "Instrument signal" },
  { value: "electrical", text: "Electrical" },
  { value: "pneumatic", text: "Pneumatic" },
];

function defaultNodeData(symbolType: PidSymbolType, instrumentCode: string, label: string): PidNodeData {
  return {
    label,
    tagNumber: "",
    symbolType,
    description: "",
    service: "",
    instrumentCode,
    properties: {},
  };
}

interface PropertiesPanelProps {
  node: Node<PidNodeData>;
  onChange: (id: string, data: Partial<PidNodeData>) => void;
  onDelete: (id: string) => void;
}

function PropertiesPanel({ node, onChange, onDelete }: PropertiesPanelProps): JSX.Element {
  const d = node.data;
  const isInstr = d.symbolType === "instrument";
  const isText = d.symbolType === "text_label";

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderLeft: "1px solid #d3dae6",
        overflowY: "auto",
        padding: "12px 12px 24px",
        background: "#fafbfd",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <EuiTitle size="xs">
        <h3>Properties</h3>
      </EuiTitle>
      <EuiSpacer size="s" />

      {!isText && (
        <>
          <EuiFormRow
            label="Tag number"
            display="rowCompressed"
          >
            <EuiFieldText
              compressed
              value={d.tagNumber}
              onChange={(e): void => {
                onChange(node.id, { tagNumber: e.target.value });
              }}
              placeholder="e.g. V-101"
            />
          </EuiFormRow>
          {isInstr && (
            <EuiFormRow
              label="Instrument code"
              display="rowCompressed"
            >
              <EuiFieldText
                compressed
                value={d.instrumentCode}
                onChange={(e): void => {
                  onChange(node.id, { instrumentCode: e.target.value });
                }}
                placeholder="e.g. FI, FC, TIC"
                style={{ fontFamily: "monospace" }}
              />
            </EuiFormRow>
          )}
          <EuiFormRow
            label="Description"
            display="rowCompressed"
          >
            <EuiFieldText
              compressed
              value={d.description}
              onChange={(e): void => {
                onChange(node.id, { description: e.target.value });
              }}
              placeholder="e.g. Feed surge vessel"
            />
          </EuiFormRow>
          <EuiFormRow
            label="Service"
            display="rowCompressed"
          >
            <EuiFieldText
              compressed
              value={d.service}
              onChange={(e): void => {
                onChange(node.id, { service: e.target.value });
              }}
              placeholder="e.g. Cooling water"
            />
          </EuiFormRow>
        </>
      )}

      {isText && (
        <EuiFormRow
          label="Text"
          display="rowCompressed"
        >
          <EuiFieldText
            compressed
            value={d.label}
            onChange={(e): void => {
              onChange(node.id, { label: e.target.value });
            }}
            placeholder="Annotation text"
          />
        </EuiFormRow>
      )}

      <EuiSpacer size="m" />
      <EuiText
        size="xs"
        color="subdued"
      >
        <p>
          Symbol type: <strong>{d.symbolType.replace(/_/g, " ")}</strong>
        </p>
        <p>
          Node id: <code style={{ fontSize: 10 }}>{node.id}</code>
        </p>
      </EuiText>
      <EuiSpacer size="s" />
      <EuiButton
        color="danger"
        size="s"
        iconType="trash"
        onClick={(): void => {
          onDelete(node.id);
        }}
      >
        Delete node
      </EuiButton>
    </div>
  );
}

interface EdgePanelProps {
  edge: Edge<PidEdgeData>;
  onChange: (id: string, data: Partial<PidEdgeData>) => void;
  onDelete: (id: string) => void;
}

function EdgePanel({ edge, onChange, onDelete }: EdgePanelProps): JSX.Element {
  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderLeft: "1px solid #d3dae6",
        overflowY: "auto",
        padding: "12px 12px 24px",
        background: "#fafbfd",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <EuiTitle size="xs">
        <h3>Line Properties</h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFormRow
        label="Line type"
        display="rowCompressed"
      >
        <EuiSelect
          compressed
          options={LINE_TYPE_OPTIONS}
          value={edge.data?.lineType ?? "process"}
          onChange={(e): void => {
            onChange(edge.id, { lineType: e.target.value as PidLineType });
          }}
        />
      </EuiFormRow>
      <EuiFormRow
        label="Label (optional)"
        display="rowCompressed"
      >
        <EuiFieldText
          compressed
          value={edge.data?.label ?? ""}
          onChange={(e): void => {
            onChange(edge.id, { label: e.target.value });
          }}
          placeholder={'e.g. 4" CS'}
        />
      </EuiFormRow>
      <EuiSpacer size="m" />
      <EuiButton
        color="danger"
        size="s"
        iconType="trash"
        onClick={(): void => {
          onDelete(edge.id);
        }}
      >
        Delete line
      </EuiButton>
    </div>
  );
}

interface DexpiModalProps {
  onImport: (xmlStr: string) => void;
  onClose: () => void;
}

function DexpiImportModal({ onImport, onClose }: DexpiModalProps): JSX.Element {
  const [xmlText, setXmlText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (): void => {
      setXmlText(reader.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <EuiModal
      onClose={onClose}
      style={{ minWidth: 540 }}
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>Import DEXPI / Proteus XML</EuiModalHeaderTitle>
      </EuiModalHeader>
      <EuiModalBody>
        <EuiText size="s">
          <p>
            Select a DEXPI-format XML file (Proteus schema) or paste the XML below. Equipment, valves, instruments, and
            piping connections will be imported and positioned automatically.
          </p>
        </EuiText>
        <EuiSpacer size="s" />
        <input
          ref={fileRef}
          type="file"
          accept=".xml"
          onChange={handleFile}
          style={{ display: "block", marginBottom: 12 }}
        />
        <textarea
          rows={10}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "6px 8px",
            border: "1px solid #d3dae6",
            borderRadius: 4,
            resize: "vertical",
          }}
          placeholder="Paste DEXPI / Proteus XML here…"
          value={xmlText}
          onChange={(e): void => {
            setXmlText(e.target.value);
          }}
        />
      </EuiModalBody>
      <EuiModalFooter>
        <EuiButtonEmpty onClick={onClose}>Cancel</EuiButtonEmpty>
        <EuiButton
          fill
          isDisabled={!xmlText.trim()}
          onClick={(): void => {
            onImport(xmlText);
            onClose();
          }}
        >
          Import
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
}

interface PlantDiagramEditorInnerProps {
  diagram: PlantDiagramType;
  onSave: (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => Promise<void>;
  onBack: () => void;
}

function PlantDiagramEditorInner({ diagram, onSave, onBack }: PlantDiagramEditorInnerProps): JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<PidNodeData>(diagram.nodes as Node<PidNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PidEdgeData>(diagram.edges as Edge<PidEdgeData>[]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<PidNodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge<PidEdgeData> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDexpi, setShowDexpi] = useState(false);
  const [dexpiError, setDexpiError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode) {
      const updated = nodes.find((n) => n.id === selectedNode.id);
      if (updated) setSelectedNode(updated as Node<PidNodeData>);
      else setSelectedNode(null);
    }
  }, [nodes]);

  useEffect(() => {
    if (selectedEdge) {
      const updated = edges.find((e) => e.id === selectedEdge.id);
      if (updated) setSelectedEdge(updated as Edge<PidEdgeData>);
      else setSelectedEdge(null);
    }
  }, [edges]);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onPaletteDragStart = useCallback((e: DragEvent<HTMLDivElement>, payload: DragPayload): void => {
    e.dataTransfer.setData("application/pid-symbol", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      if (!rfInstance || !wrapperRef.current) return;
      const raw = e.dataTransfer.getData("application/pid-symbol");
      if (!raw) return;
      const payload: DragPayload = JSON.parse(raw);
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstance.project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
      const newNode: Node<PidNodeData> = {
        id: nanoid(),
        type: "pid",
        position,
        data: defaultNodeData(payload.symbolType, payload.instrumentCode, payload.label),
      };
      setNodes((ns) => [...ns, newNode]);
    },
    [rfInstance, setNodes],
  );

  const onConnect = useCallback(
    (params: Connection): void => {
      if (!params.source || !params.target) return;
      const newEdge: Edge<PidEdgeData> = {
        id: nanoid(),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? null,
        targetHandle: params.targetHandle ?? null,
        type: "straight",
        data: { lineType: "process", label: "" },
      };
      setEdges((es) => addEdge(newEdge, es));
    },
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node): void => {
    setSelectedNode(node as Node<PidNodeData>);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge): void => {
    setSelectedEdge(edge as Edge<PidEdgeData>);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback((): void => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // ── Property change handlers ──
  const onNodeDataChange = useCallback(
    (id: string, patch: Partial<PidNodeData>): void => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes],
  );

  const onEdgeDataChange = useCallback(
    (id: string, patch: Partial<PidEdgeData>): void => {
      setEdges((es) => es.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } as PidEdgeData } : e)));
    },
    [setEdges],
  );

  const onDeleteNode = useCallback(
    (id: string): void => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  const onDeleteEdge = useCallback(
    (id: string): void => {
      setEdges((es) => es.filter((e) => e.id !== id));
      setSelectedEdge(null);
    },
    [setEdges],
  );

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const viewport = rfInstance?.toObject().viewport ?? { x: 0, y: 0, zoom: 1 };
      await onSave(nodes, edges, viewport);
    } finally {
      setSaving(false);
    }
  };

  const handleDexpiImport = useCallback(
    (xmlStr: string): void => {
      const result = parseDexpiXml(xmlStr);
      if (result.error) {
        setDexpiError(result.error);
        return;
      }

      const offsetX = nodes.length > 0 ? 40 : 0;
      const offsetY = nodes.length > 0 ? 40 : 0;
      const imported = result.nodes.map((n) => ({
        ...n,
        position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
      }));
      setNodes((ns) => [...ns, ...(imported as Node<PidNodeData>[])]);
      setEdges((es) => [...es, ...(result.edges as Edge<PidEdgeData>[])]);
    },
    [nodes.length, setNodes, setEdges],
  );

  const styledEdges = edges.map((e) => {
    const lineType: PidLineType = (e.data?.lineType as PidLineType) ?? "process";
    return {
      ...e,
      style: LINE_STYLES[lineType] ?? LINE_STYLES.process,
      label: e.data?.label || undefined,
      labelStyle: { fontSize: 10, fontFamily: "monospace" },
    };
  });

  const showRightPanel = selectedNode !== null || selectedEdge !== null;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {}
      <div
        style={{
          height: 48,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          borderBottom: "1px solid #d3dae6",
          background: "#fff",
        }}
      >
        <EuiToolTip content="Back to diagram list">
          <EuiButtonIcon
            iconType="arrowLeft"
            aria-label="Back"
            onClick={onBack}
          />
        </EuiToolTip>
        <EuiText style={{ fontWeight: 600, fontSize: 15 }}>
          <span>{diagram.title}</span>
        </EuiText>
        <EuiBadge color={diagram.diagramType === "PFD" ? "accent" : "primary"}>{diagram.diagramType}</EuiBadge>
        <div style={{ flex: 1 }} />

        {dexpiError && (
          <EuiText
            color="danger"
            size="xs"
          >
            <span>Import error: {dexpiError}</span>
          </EuiText>
        )}

        <EuiButton
          size="s"
          iconType="importAction"
          onClick={(): void => {
            setShowDexpi(true);
            setDexpiError(null);
          }}
        >
          Import DEXPI XML
        </EuiButton>
        <EuiButton
          size="s"
          fill
          iconType="save"
          isLoading={saving}
          onClick={handleSave}
        >
          Save
        </EuiButton>
      </div>

      {}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <SymbolPalette onDragStart={onPaletteDragStart} />

        {}
        <div
          ref={wrapperRef}
          style={{ flex: 1, minWidth: 0, position: "relative" }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={styledEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            defaultViewport={diagram.viewport}
            fitView={diagram.nodes.length > 0}
            deleteKeyCode="Delete"
            snapToGrid
            snapGrid={[10, 10]}
            minZoom={0.1}
            maxZoom={4}
            defaultEdgeOptions={{ type: "straight" }}
            connectionLineType={ConnectionLineType.Straight}
          >
            <Background
              color="#e0e4f0"
              gap={20}
            />
            <Controls />
            <MiniMap
              nodeColor="#006bb4"
              style={{ background: "#f5f7fa" }}
            />
          </ReactFlow>
        </div>

        {/* Right panel */}
        {showRightPanel && selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onChange={onNodeDataChange}
            onDelete={onDeleteNode}
          />
        )}
        {showRightPanel && selectedEdge && !selectedNode && (
          <EdgePanel
            edge={selectedEdge}
            onChange={onEdgeDataChange}
            onDelete={onDeleteEdge}
          />
        )}
      </div>

      {}
      {showDexpi && (
        <DexpiImportModal
          onImport={handleDexpiImport}
          onClose={(): void => {
            setShowDexpi(false);
          }}
        />
      )}
    </div>
  );
}

export interface PlantDiagramEditorProps {
  diagram: PlantDiagramType;
  onSave: (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => Promise<void>;
  onBack: () => void;
}

export function PlantDiagramEditor(props: PlantDiagramEditorProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <PlantDiagramEditorInner {...props} />
    </ReactFlowProvider>
  );
}
