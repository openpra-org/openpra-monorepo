import { EuiText } from "@elastic/eui";
import { useState } from "react";
import { Handle, NodeProps, Position, useReactFlow } from "reactflow";

import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useDeleteNodeClick from "../../../hooks/eventTree/useDeleteNodeClick";
import styles from "./styles/nodeTypes.module.css";

const VisibleNode = ({ id, data }: NodeProps) => {
  const onClickCreate = useCreateNodeClick(id);
  const onClickDelete = useDeleteNodeClick(id);
  const [isEditingProb, setIsEditingProb] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const { setNodes } = useReactFlow();

  const updateNodeLabel = (newValue: string) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newValue,
            },
          };
        }
        return node;
      }),
    );
  };

  const updateNodeProbability = (newValue: number) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              probability: newValue,
            },
          };
        }
        return node;
      }),
    );
  };

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
            setIsEditingProb(true);
          }}
        >
          {isEditingProb ? (
            <input
              type="text"
              defaultValue={data.probability?.toFixed(2) || "0.55"}
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
                const value = Math.min(
                  1,
                  Math.max(0, parseFloat(e.target.value) || 0),
                );
                const parsedValue = parseFloat(value.toFixed(2));
                updateNodeProbability(parsedValue);
                setIsEditingProb(false);
              }}
              autoFocus
            />
          ) : (
            <EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>
              {data.probability?.toFixed(2) || "0.55"}
            </EuiText>
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
            <EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>
              {data.label}
            </EuiText>
          )}
        </div>

        {data.depth != 1 && (
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
};

export default VisibleNode;
