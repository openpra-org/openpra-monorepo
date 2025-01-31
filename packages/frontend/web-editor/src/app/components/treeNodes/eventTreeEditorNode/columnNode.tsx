import { Handle, NodeProps, Position, useUpdateNodeInternals } from "reactflow";
import React, { memo, useEffect, useState } from "react";
import { EuiText, EuiTextArea } from "@elastic/eui";
import useCreateColClick from "../../../hooks/eventTree/useCreateColClick";
import useDeleteColClick from "../../../hooks/eventTree/useDeleteColClick";
import styles from "./styles/nodeTypes.module.css";

function ColumnNode({ id, data }: NodeProps) {
  const onClickAddColumn = useCreateColClick(id);
  const onClickDeleteColumn = useDeleteColClick(id);
  const { label, allowAdd } = data;
  const [textareaValue, setTextareaValue] = useState<string>(data.label);
  const updateNodeInternals = useUpdateNodeInternals();

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextareaValue(event.target.value);
    // Optionally, update the node's data in React Flow's state here
    // This might involve setting the new value in a context or state management system
    // and then updating React Flow's representation of the node.
    updateNodeInternals(id);
  };

  useEffect(() => {
    // Notify React Flow that this node needs to be re-rendered
    // This is necessary to ensure React Flow's internal state is aware of the node's visual change
    updateNodeInternals(id);
  }, [textareaValue, updateNodeInternals, id]);

  const canShowDeleteButton = (): boolean => {
    return !data.output && // not an output column
           data.depth !== 1 && // not initiating event
           data.depth !== 2 && // not first functional event
           data.allowDelete; // controlled by parent based on node visibility
  };

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
          minWidth: data.width,
          minHeight: 30,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <EuiTextArea
            onChange={handleTextareaChange}
            value={textareaValue}
            style={{
              fontSize: "0.6rem",
              background: "transparent",
              border: "none",
              padding: 4,
              maxWidth: 100,
              outline: "none",
            }}
            compressed={true}
            resize="none"
            rows={1}
            cols={1}
          />
          
          <div className={styles.columnButtons}>
            {allowAdd && (
              <span
                onClick={onClickAddColumn}
                className={styles.addNodeButtonText}
                role="button"
              >
                +
              </span>
            )}
            {canShowDeleteButton() && (
              <span
                onClick={onClickDeleteColumn}
                className={styles.deleteNodeButtonText}
                role="button"
              >
                −
              </span>
            )}
          </div>
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
