import { Handle, NodeProps, Position, useReactFlow } from "reactflow";
import React, { useState } from "react";
import { EuiText } from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useDeleteNodeClick from "../../../hooks/eventTree/useDeleteNodeClick";
import { ScientificNotation } from "../../../../utils/scientificNotation";
import styles from "./styles/nodeTypes.module.css";

function VisibleNode({ id, data }: NodeProps) {
  const onClickCreate = useCreateNodeClick(id);
  const onClickDelete = useDeleteNodeClick(id);
  const [isEditingFreq, setIsEditingFreq] = useState(false);
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

  const getDefaultProbability = () => {
    if (data.depth === 1) return 1.0;
    if (data.depth === 2 && (data.label === "Success" || data.label === "Failure")) return 0.5;
    return 0.0;
  };

  const defaultProbability = getDefaultProbability();
  const probability = data.probability ?? defaultProbability;
  const tooltipContent = probability.toExponential(8);

  // Custom tooltip styles
  const tooltipStyles = {
    position: "relative",
    display: "inline-block",
    cursor: "pointer",
  } as React.CSSProperties;

  // Add the custom tooltip CSS
  const tooltipContainerStyles = {
    ".custom-tooltip": {
      position: "relative",
      display: "inline-block",
      cursor: "pointer",
    },
    ".custom-tooltip .tooltip-text": {
      visibility: "hidden",
      backgroundColor: "rgba(0, 119, 204, 0.2)",
      color: "#006bb8",
      textAlign: "center",
      borderRadius: "6px",
      padding: "8px 10px",
      position: "absolute",
      zIndex: 1000,
      bottom: "125%",
      left: "50%",
      transform: "translateX(-50%)",
      opacity: 0,
      transition: "opacity 0.3s",
      fontSize: "0.8rem",
      fontWeight: 500,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    },
    ".custom-tooltip .tooltip-text::after": {
      content: '""',
      position: "absolute",
      top: "100%",
      left: "50%",
      marginLeft: "-5px",
      borderWidth: "5px",
      borderStyle: "solid",
      borderColor: "rgba(0, 119, 204, 0.2) transparent transparent transparent",
    },
    ".custom-tooltip:hover .tooltip-text": {
      visibility: "visible",
      opacity: 1,
    },
  };

  return (
    <div>
      <style>
        {`
          .custom-tooltip {
            position: relative;
            display: inline-block;
            cursor: pointer;
          }
          .custom-tooltip .tooltip-text {
            visibility: hidden;
            background-color: rgba(0, 119, 204, 0.2);
            color: #006bb8;
            text-align: center;
            border-radius: 6px;
            padding: 4px 6px;
            position: absolute;
            z-index: 1000;
            bottom: 70%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 0.6rem;
            font-weight: 500;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
          .custom-tooltip .tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -3px;
            border-width: 3px;
            border-style: solid;
            border-color: rgba(0, 119, 204, 0.2) transparent transparent transparent;
          }
          .custom-tooltip:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
          }
        `}
      </style>
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
                const inputValue = parseFloat(e.target.value); // Parse the input once
                const value = isNaN(inputValue) || inputValue > 1 ? 0.0 : Math.max(0, inputValue);
                const parsedValue = ScientificNotation.fromScientific(e.target.value);
                if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 1) {
                  updateNodeProbability(parsedValue);
                }
                setIsEditingFreq(false);
              }}
              autoFocus
            />
          ) : (
            <div className="custom-tooltip">
              <EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>
                {ScientificNotation.toScientific(probability, 3)}
              </EuiText>
              <span className="tooltip-text">{tooltipContent}</span>
            </div>
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
}

export default VisibleNode;
