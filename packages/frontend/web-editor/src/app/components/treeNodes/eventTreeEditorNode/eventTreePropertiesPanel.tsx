import { useEffect, useState } from "react";
import {
  EuiFieldNumber,
  EuiFormRow,
  EuiHorizontalRule,
  EuiLoadingSpinner,
  EuiSelect,
  EuiText,
  EuiTextArea,
  EuiTitle,
} from "@elastic/eui";
import { useNodes, useReactFlow } from "reactflow";
import type { Node } from "reactflow";
import { useParams } from "react-router-dom";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { GetFaultTrees } from "shared-sdk/lib/api/NestedModelsAPI/FaultTreesApiManager";
import type { NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import type { ColumnNodeData } from "./columnNode";
import { useEventTreeStore } from "../../../hooks/eventTree/useEventTreeStore";
import { EventTreeState } from "../../../../utils/treeUtils";
import { getInitials } from "../../../hooks/eventTree/useTreeData";
import type { EventTreeEdgeData } from "../../treeEdges/eventTreeEditorEdges/eventTreeEdgeType";
import type { VisibleNodeData } from "./visibleNode";
import type { OutputNodeData } from "./outputNode";

export interface EventTreePropertiesPanelProps {
  selectedNodeId: string | null;
  modelId: string;
}

export function EventTreePropertiesPanel({ selectedNodeId, modelId }: EventTreePropertiesPanelProps): JSX.Element {
  const { setNodes, getNodes, getEdges } = useReactFlow<ColumnNodeData, EventTreeEdgeData>();
  const nodes = useNodes<ColumnNodeData>();
  const [faultTrees, setFaultTrees] = useState<NestedModelType[]>([]);
  const [loading, setLoading] = useState(false);
  const [ieNameDraft, setIeNameDraft] = useState("");
  const [ieFreqDraft, setIeFreqDraft] = useState("");
  const setFunctionalEvent = useEventTreeStore((s) => s.setFunctionalEvent);
  const { eventTreeId } = useParams() as { eventTreeId: string };

  const ieNode =
    selectedNodeId !== null ?
      ((nodes.find(
        (n) => n.id === selectedNodeId && n.type === "columnNode" && n.data.depth === 1 && !n.data.allowAdd,
      ) as Node<ColumnNodeData> | undefined) ?? null)
    : null;

  const selectedNode =
    selectedNodeId !== null ?
      ((nodes.find((n) => n.id === selectedNodeId && n.type === "columnNode" && n.data.allowAdd === true) as
        | Node<ColumnNodeData>
        | undefined) ?? null)
    : null;

  useEffect(() => {
    if (ieNode) {
      setIeNameDraft(ieNode.data.label ?? "");
      setIeFreqDraft(ieNode.data.frequency !== undefined ? String(ieNode.data.frequency) : "");
    }
  }, [ieNode?.id]);

  useEffect(() => {
    if (!modelId) return;
    setLoading(true);
    let cancelled = false;
    void GetFaultTrees(modelId)
      .then((list) => {
        if (!cancelled) setFaultTrees(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  if (ieNode) {
    const saveIeName = (name: string): void => {
      const initials = getInitials(name);
      const allNodes = getNodes();
      const seqNodes = [...allNodes]
        .filter((n) => n.type === "outputNode" && (n.data as OutputNodeData).isSequenceId)
        .sort((a, b) => a.position.y - b.position.y);
      const updated = allNodes.map((n) => {
        if (n.id === ieNode.id) return { ...n, data: { ...n.data, label: name } };
        if (n.type === "visibleNode" && (n.data as VisibleNodeData).depth === 1)
          return { ...n, data: { ...n.data, label: initials } };
        if (n.type === "outputNode" && (n.data as OutputNodeData).isSequenceId) {
          const idx = seqNodes.findIndex((s) => s.id === n.id);
          return { ...n, data: { ...n.data, label: `${initials}-${String(idx + 1)}` } };
        }
        return n;
      });
      setNodes(updated);
      const { functionalEvents } = useEventTreeStore.getState();
      void GraphApiManager.storeEventTree(
        EventTreeState({ eventTreeId, nodes: updated, edges: getEdges(), functionalEvents }),
      );
    };

    const saveIeFrequency = (raw: string): void => {
      const freq = parseFloat(raw);
      const allNodes = getNodes();
      const updated = allNodes.map((n) =>
        n.id === ieNode.id ? { ...n, data: { ...n.data, frequency: isNaN(freq) ? undefined : freq } } : n,
      );
      setNodes(updated);
      const { functionalEvents } = useEventTreeStore.getState();
      void GraphApiManager.storeEventTree(
        EventTreeState({ eventTreeId, nodes: updated, edges: getEdges(), functionalEvents }),
      );
    };

    return (
      <div style={{ padding: "12px 16px", overflowY: "auto", height: "100%" }}>
        <EuiTitle size="xs">
          <h4>Initiating Event Properties</h4>
        </EuiTitle>
        <EuiText
          size="xs"
          color="subdued"
        >
          <p>Node ID: {ieNode.id}</p>
        </EuiText>

        <EuiHorizontalRule margin="s" />

        <EuiFormRow
          label="Name"
          helpText="Initiating event name; used as prefix for sequence IDs"
        >
          <EuiTextArea
            value={ieNameDraft}
            rows={2}
            resize="vertical"
            onChange={(e) => {
              setIeNameDraft(e.target.value);
            }}
            onBlur={() => {
              saveIeName(ieNameDraft);
            }}
          />
        </EuiFormRow>

        <EuiHorizontalRule margin="s" />

        <EuiFormRow
          label="Frequency (per year)"
          helpText="Initiating event frequency used for sequence quantification"
        >
          <EuiFieldNumber
            value={ieFreqDraft}
            onChange={(e) => {
              setIeFreqDraft(e.target.value);
            }}
            onBlur={() => {
              saveIeFrequency(ieFreqDraft);
            }}
            placeholder="e.g. 1e-4"
            step="any"
          />
        </EuiFormRow>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div style={{ padding: "16px" }}>
        <EuiTitle size="xs">
          <h4>Properties</h4>
        </EuiTitle>
        <EuiHorizontalRule margin="s" />
        <EuiText
          size="s"
          color="subdued"
        >
          <p>Select the initiating event or a functional event column to edit its properties.</p>
        </EuiText>
      </div>
    );
  }

  const { data } = selectedNode;

  const ftOptions = [
    { value: "", text: "— none —" },
    ...faultTrees.map((ft) => ({ value: String(ft.id), text: ft.label?.name ?? String(ft.id) })),
  ];

  const handleLabelChange = (value: string): void => {
    setNodes((prev: Node<ColumnNodeData>[]) =>
      prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: value } } : n)),
    );
  };

  const handleFaultTreeChange = (value: string): void => {
    const selectedFt = faultTrees.find((ft) => String(ft.id) === value);
    const ftLabel = selectedFt ? (selectedFt.label?.name ?? value) : undefined;

    const updatedNodes: Node<ColumnNodeData>[] = getNodes().map((n) =>
      n.id === selectedNode.id ?
        { ...n, data: { ...n.data, faultTreeId: value || undefined, faultTreeLabel: value ? ftLabel : undefined } }
      : n,
    );
    setNodes(updatedNodes);

    setFunctionalEvent(selectedNode.id, {
      uuid: selectedNode.id,
      name: selectedNode.data.label,
      order: selectedNode.data.depth,
      faultTreeId: value || undefined,
    });

    const { functionalEvents } = useEventTreeStore.getState();
    void GraphApiManager.storeEventTree(
      EventTreeState({ eventTreeId, nodes: updatedNodes, edges: getEdges(), functionalEvents }),
    ).then(() => {});
  };

  return (
    <div style={{ padding: "12px 16px", overflowY: "auto", height: "100%" }}>
      <EuiTitle size="xs">
        <h4>Functional Event Properties</h4>
      </EuiTitle>
      <EuiText
        size="xs"
        color="subdued"
      >
        <p>Node ID: {selectedNode.id}</p>
      </EuiText>

      <EuiHorizontalRule margin="s" />

      <EuiFormRow
        label="Label"
        helpText="Functional event heading label"
      >
        <EuiTextArea
          value={data.label}
          rows={2}
          resize="vertical"
          onChange={(e) => {
            handleLabelChange(e.target.value);
          }}
        />
      </EuiFormRow>

      <EuiHorizontalRule margin="s" />

      <EuiFormRow
        label="Linked Fault Tree"
        helpText="Fault tree whose top event represents this functional event's failure probability"
      >
        {loading ?
          <EuiLoadingSpinner size="m" />
        : <EuiSelect
            options={ftOptions}
            value={data.faultTreeId ?? ""}
            onChange={(e) => {
              handleFaultTreeChange(e.target.value);
            }}
          />
        }
      </EuiFormRow>
    </div>
  );
}
