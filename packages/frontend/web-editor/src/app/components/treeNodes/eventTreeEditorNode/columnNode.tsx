/* eslint-disable import/no-default-export */
import { Handle, Node, NodeProps, Position, useReactFlow } from "reactflow";
import React, { memo, useState } from "react";
import { EuiTextArea } from "@elastic/eui";
import useCreateColClick from "../../../hooks/eventTree/useCreateColClick";
import useDeleteColClick from "../../../hooks/eventTree/useDeleteColClick";
import { setFirstColumnLabel } from "./outputNode";
import styles from "./styles/nodeTypes.module.css";
const css = styles as Record<string, string>;

// Helper function to get initials
const getInitials = (str: string): string => {
  return str
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

interface ColumnNodeData {
  label: string;
  width: number;
  depth: number;
  output?: boolean;
  allowAdd?: boolean;
  allowDelete?: boolean;
  hideText?: boolean;
  isSequenceId?: boolean;
}

function ColumnNode({ id, data }: NodeProps<ColumnNodeData>): JSX.Element {
  const onClickAddColumn = useCreateColClick(id);
  const onClickDeleteColumn = useDeleteColClick(id);
  const { allowAdd } = data;
  const [textareaValue, setTextareaValue] = useState<string>(data.label);
  const { setNodes } = useReactFlow<ColumnNodeData, unknown>();

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const newValue = event.target.value;
    setTextareaValue(newValue);

    // If this is the first column (depth === 1), update all sequence IDs
    if (data.depth === 1) {
      const newInitials = getInitials(newValue);
      setFirstColumnLabel(newValue);

      // Update all sequence IDs with new initials
      setNodes((nodes: Node<ColumnNodeData>[]) =>
        nodes.map((node) => {
          if (node.type === "outputNode" && node.data.isSequenceId) {
            // Extract the trailing number from the existing sequence ID
            const match = node.data.label.match(/-(\d+)$/);
            const currentNum = match ? Number.parseInt(match[1], 10) : 1;
            return {
              ...node,
              data: {
                ...node.data,
                label: `${newInitials}-${String(currentNum)}`,
              },
            };
          }
          return node;
        }),
      );
    }

    setNodes((nodes: Node<ColumnNodeData>[]) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                label: newValue,
              },
            }
          : node,
      ),
    );
  };

  // useEffect(() => {
  //   updateNodeInternals(id);
  // }, [textareaValue, updateNodeInternals, id]);

  const canShowDeleteButton = (): boolean => {
    // Updated condition: Allow deletion for functional events (including the first one)
    return !data.output && data.depth !== 1 && Boolean(data.allowDelete);
  };

  const hasButtons = allowAdd || canShowDeleteButton();

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="a"
        style={{
          position: "absolute",
          top: "100%",
          left: "1%",
          visibility: "hidden",
        }}
      />

      <div
        style={{
          visibility: data.hideText ? "hidden" : "visible",
          borderColor: "white",
          borderLeft: "1px solid white",
          borderRight: "1px solid white",
          borderBottom: "1px solid white",
          padding: "4px",
          fontSize: "0.6rem",
          width: data.width,
          minHeight: 30,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <EuiTextArea
              onChange={handleTextareaChange}
              value={textareaValue}
              style={{
                fontSize: "0.6rem",
                background: "transparent",
                border: "none",
                padding: "4px",
                width: "100%",
                maxWidth: "100px",
                outline: "none",
                textAlign: "center",
                position: "relative",
                left: allowAdd && canShowDeleteButton() ? "37%" : allowAdd ? "45%" : "50%",
                transform: "translateX(-50%)",
              }}
              compressed={true}
              resize="none"
              rows={1}
              cols={1}
            />
          </div>

          {hasButtons && (
            <div
              className={css.columnButtons}
              style={{
                position: "absolute",
                right: "2px", // Adjusted right position
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                gap: "1px", // Reduced gap between buttons
                alignItems: "center",
              }}
            >
              {allowAdd && (
                <span
                  onClick={onClickAddColumn}
                  className={css.addNodeButtonText}
                  role="button"
                  style={{
                    padding: "0 2px",
                    cursor: "pointer",
                  }}
                >
                  +
                </span>
              )}
              {canShowDeleteButton() && (
                <span
                  onClick={onClickDeleteColumn}
                  className={css.deleteNodeButtonText}
                  role="button"
                  style={{
                    padding: "0 2px",
                    cursor: "pointer",
                  }}
                >
                  −
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{
          position: "absolute",
          top: "100%",
          right: "-1%",
          visibility: "hidden",
        }}
      />
    </>
  );
}

export default memo(ColumnNode);
