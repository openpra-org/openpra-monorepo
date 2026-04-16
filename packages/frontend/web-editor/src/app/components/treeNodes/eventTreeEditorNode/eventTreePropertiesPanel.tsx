import React from "react";
import { Node, useReactFlow } from "reactflow";
import { EuiFormRow, EuiFieldText, EuiTitle, EuiSpacer, EuiButton } from "@elastic/eui";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";

interface EventTreePropertiesPanelProps {
  node: Node;
  eventTreeId: string;
}

export function EventTreePropertiesPanel({ node, eventTreeId }: EventTreePropertiesPanelProps): JSX.Element {
  const { setNodes, getNodes } = useReactFlow();

  const handleFaultTreeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, faultTreeId: val } } : n)));
  };

  const handleSave = async () => {
    // In a real app, we would sync the entire graph.
    // For now we just assume nodes/edges are saved via another mechanism or we can call storeEventTree.
  };

  const isColumn = node.type === "columnNode";
  const isFunctionalEvent = isColumn && node.data.allowAdd;

  return (
    <div style={{ padding: "24px 16px 16px" }}>
      <EuiTitle size="xs">
        <h3>Properties</h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFormRow label="Label">
        <EuiFieldText
          value={node.data.label || ""}
          readOnly
        />
      </EuiFormRow>
      {isFunctionalEvent && (
        <EuiFormRow
          label="Linked Fault Tree ID"
          helpText="Enter the ID of the fault tree to link."
        >
          <EuiFieldText
            value={node.data.faultTreeId || ""}
            onChange={handleFaultTreeIdChange}
            placeholder="e.g. ft-1234"
          />
        </EuiFormRow>
      )}
    </div>
  );
}
