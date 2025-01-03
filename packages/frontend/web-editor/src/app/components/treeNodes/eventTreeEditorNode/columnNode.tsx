import { Handle, NodeProps, Position, useUpdateNodeInternals } from "reactflow";
import React, { memo, useEffect, useState } from "react";
import { EuiText, EuiTextArea } from "@elastic/eui";
import useCreateColClick from "../../../hooks/eventTree/useCreateColClick";
import styles from "./styles/nodeTypes.module.css";

function ColumnNode({ id, data }: NodeProps) {
  const onClickAddColumn = useCreateColClick(id);
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
        <div style={{ display: "flex" }}>
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
              // overflow: "hidden",
            }}
            compressed={true}
            resize="none"
            rows={1}
            cols={1}
          />
          {/*<text*/}
          {/*  onClick={onClickAddColumn}*/}
          {/*  className={styles.addNodeButtonText}*/}
          {/*>*/}
          {/*  +*/}
          {/*</text>*/}
          {/* "+" Button - Only Render if allowAdd is true */}
          {allowAdd && (
            <text
              onClick={onClickAddColumn}
              className={styles.addNodeButtonText}
              style={{
                cursor: "pointer",
                marginLeft: "4px",
                fontSize: "0.8rem",
              }}
            >
              +
            </text>
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

export default ColumnNode;
