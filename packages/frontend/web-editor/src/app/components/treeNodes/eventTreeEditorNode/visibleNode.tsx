import { Handle, NodeProps, Position, useReactFlow } from "reactflow";
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

function VisibleNode({ id, data }: NodeProps) {
  const onClickCreate = useCreateNodeClick(id);
  const onClickDelete = useDeleteNodeClick(id);
  const [isEditingFreq, setIsEditingFreq] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const { setNodes, getNodes, getEdges } = useReactFlow();
  const { addToast } = UseToastContext();

  const updateNodeLabel = (newValue: string) => {
    setNodes((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label: newValue } } : node)),
    );
  };

  const updateNodeProbability = (newValue: number) => {
    setNodes((nodes) => {
      const siblingNodes = nodes.filter((node) => node.data.depth === data.depth);

      let siblingSum = 0;
      siblingNodes.forEach((node) => {
        if (node.id !== id) {
          const nodeProb =
            node.data.probability ??
            (node.data.depth === 1
              ? 1.0
              : node.data.depth === 2 && (node.data.label === "Success" || node.data.label === "Failure")
              ? 0.5
              : 0.0);
          siblingSum += nodeProb;
        }
      });

      if (siblingSum + newValue > 1) {
        addToast({
          id: GenerateUUID(),
          title: "Probability Limit Exceeded",
          color: "warning",
          text: "Total probability in this column cannot exceed 1",
        });

        return nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, probability: 0.0 } } : node));
      }

      // Update probability
      const updatedNodes = nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, probability: newValue } } : node,
      );

      // ✅ Recalculate frequency nodes
      const edges = getEdges();
      const recalculated = recalculateFrequencies(updatedNodes, edges);
      return recalculated;
    });
  };

  const getDefaultProbability = () => {
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
          className={styles.inputNode}
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
              onBlur={(e) => {
                let value;

                const scientificValue = ScientificNotation.fromScientific(e.target.value);
                if (!isNaN(scientificValue)) {
                  value = scientificValue;
                } else {
                  const regularValue = parseFloat(e.target.value);
                  value = isNaN(regularValue) ? 0 : regularValue;
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
              className={styles.addNodeButtonText}
            >
              +
            </p>
            <p
              onClick={onClickDelete}
              className={styles.addNodeButtonText}
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
