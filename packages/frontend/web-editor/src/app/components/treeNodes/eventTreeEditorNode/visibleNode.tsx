import { Handle, Node, NodeProps, Position, useReactFlow } from "reactflow";
import React, { useState } from "react";
import { EuiText } from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useDeleteNodeClick from "../../../hooks/eventTree/useDeleteNodeClick";
import { ScientificNotation } from "../../../../utils/scientificNotation";
import { UseToastContext } from "../../../providers/toastProvider";
import { GenerateUUID } from "../../../../utils/treeUtils";
import Tooltip from "../../tooltips/customTooltip";
import { recalculateFrequencies } from "../../../../utils/recalculateFrequencies";
import styles from "./styles/nodeTypes.module.css";
const css = styles as Record<string, string>;

interface VisibleNodeData {
  label: string;
  width: number;
  depth: number;
  probability?: number;
}

function VisibleNode({ id, data }: NodeProps<VisibleNodeData>): JSX.Element {
  const onClickCreate = useCreateNodeClick(id);
  const onClickDelete = useDeleteNodeClick(id);
  const [isEditingFreq, setIsEditingFreq] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const { setNodes, getEdges } = useReactFlow<VisibleNodeData, unknown>();
  const { addToast } = UseToastContext();

  const updateNodeLabel = (newValue: string): void => {
    setNodes((nodes: Node<VisibleNodeData>[]) =>
      nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label: newValue } } : node)),
    );
  };

  const updateNodeProbability = (newValue: number): void => {
    setNodes((nodes: Node<VisibleNodeData>[]) => {
      const edges = getEdges();

      // Find the parent of this node
      const parentEdge = edges.find((edge) => edge.target === id);
      const parentId = parentEdge ? parentEdge.source : null;

      // If there's no parent, use the original logic (root node)
      if (!parentId) {
        return nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, probability: newValue } } : node,
        );
      }

      // Find all edges coming from the same parent
      const siblingEdges = edges.filter((edge) => edge.source === parentId);
      const siblingIds = siblingEdges.map((edge) => edge.target);

      // Calculate sum of probabilities from the same parent
      let siblingSum = 0;
      siblingIds.forEach((siblingId) => {
        if (siblingId !== id) {
          const siblingNode = nodes.find((node) => node.id === siblingId);
          if (siblingNode) {
            const siblingProb =
              siblingNode.data.probability ??
              (siblingNode.data.depth === 1
                ? 1.0
                : siblingNode.data.depth === 2 &&
                  (siblingNode.data.label === "Success" || siblingNode.data.label === "Failure")
                ? 0.5
                : 0.0);
            siblingSum += siblingProb;
          }
        }
      });

      // Check if the new value would exceed 1 when combined with siblings
      if (siblingSum + newValue > 1) {
        addToast({
          id: GenerateUUID(),
          title: "Probability Limit Exceeded",
          color: "warning",
          text: "Total probability from the same parent cannot exceed 1",
        });

        return nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, probability: 0.0 } } : node));
      }

      // Update probability
      const updatedNodes = nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, probability: newValue } } : node,
      );

      // Recalculate frequency nodes
      const recalculated = recalculateFrequencies(updatedNodes, edges);
      return recalculated;
    });
  };

  const getDefaultProbability = (): number => {
    if (data.depth === 1) return 1.0;
    if (data.depth === 2 && (data.label === "Success" || data.label === "Failure")) return 0.5;
    return 0.0;
  };

  const defaultProbability = getDefaultProbability();
  const probability = data.probability ?? defaultProbability;
  const tooltipContent = ScientificNotation.toScientific(probability, 8);

  return (
    <div>
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          visibility: "hidden",
        }}
      />
      <div
        style={{
          width: data.width,
          height: 40,
          textAlign: "center",
        }}
      >
        <div
          className={css.inputNode}
          onDoubleClick={() => {
            setIsEditingFreq(true);
          }}
        >
          {isEditingFreq ? (
            <input
              type="text"
              defaultValue={probability.toFixed(2)}
              style={{
                fontSize: "0.7rem",
                width: "100%",
                height: "1.2rem",
                textAlign: "center",
                border: "none",
                background: "transparent",
                outline: "none",
              }}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                let value: number;

                const scientificValue = ScientificNotation.fromScientific(e.target.value);
                if (!Number.isNaN(scientificValue)) {
                  value = scientificValue;
                } else {
                  const regularValue = parseFloat(e.target.value);
                  value = Number.isNaN(regularValue) ? 0 : regularValue;
                }

                value = Math.max(0, Math.min(1, value));
                updateNodeProbability(value);
                setIsEditingFreq(false);
              }}
              autoFocus
            />
          ) : (
            <Tooltip content={tooltipContent}>
              <EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>
                {ScientificNotation.toScientific(probability, 3)}
              </EuiText>
            </Tooltip>
          )}
        </div>

        <div
          onDoubleClick={() => {
            setIsEditingLabel(true);
          }}
        >
          {isEditingLabel ? (
            <input
              type="text"
              defaultValue={data.label}
              style={{
                fontSize: "0.7rem",
                width: "100%",
                height: "1.2rem",
                textAlign: "center",
                border: "none",
                background: "transparent",
                outline: "none",
              }}
              onBlur={(e) => {
                updateNodeLabel(e.target.value);
                setIsEditingLabel(false);
              }}
              autoFocus
            />
          ) : (
            <EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>{data.label}</EuiText>
          )}
        </div>

        {data.depth !== 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              onClick={onClickCreate}
              className={css.addNodeButtonText}
            >
              +
            </p>
            <p
              onClick={onClickDelete}
              className={css.addNodeButtonText}
            >
              -
            </p>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{
          position: "absolute",
          top: "50%",
          right: "50%",
          visibility: "hidden",
        }}
      />
    </div>
  );
}

export default VisibleNode;
