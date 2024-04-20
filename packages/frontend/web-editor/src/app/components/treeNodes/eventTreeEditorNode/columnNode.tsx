import { Handle, NodeProps, Position, useUpdateNodeInternals } from "reactflow";
import React, { memo, useEffect, useState } from "react";
import { EuiText, EuiTextArea } from "@elastic/eui";
import useCreateColClick from "../../../hooks/eventTree/useCreateColClick";
import useDeleteColClick from "../../../hooks/eventTree/useDeleteColClick";
import styles from "./styles/nodeTypes.module.css";

function ColumnNode({ id, data }: NodeProps) {
  const onClickAddColumn = useCreateColClick(id);
  const onClickDeleteColumn = useDeleteColClick(id);

  const handleValueChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newHeight = Number(Math.floor(e.target.value.length / 20) + 1.5);
    const isIncreaseHeight = newHeight > data.height;
    data.onNodeDataChange(id, {
      ...data,
      value: e.target.value,
    });
    console.log(newHeight, data.height);

    if (newHeight !== data.height) {
      data.onAllColumnHeightChange(newHeight, isIncreaseHeight);
    }
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
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <EuiTextArea
            onChange={handleValueChange}
            value={data.value}
            style={{
              fontSize: "0.6rem",
              background: "transparent",
              border: "none",
              maxHeight: "10rem",
              overflow: "auto",
              outline: "none",
              // boxShadow: "none",
              padding: 4,
              maxWidth: 100,
              height: data.height + "rem",

              scrollbarWidth: "none",
            }}
            resize="none"
          />
          {data.depth !== 1 && (
            <>
              <text
                onClick={onClickAddColumn}
                className={styles.addNodeButtonText}
              >
                +
              </text>
              <text
                onClick={onClickDeleteColumn}
                className={styles.addNodeButtonText}
              >
                -
              </text>
            </>
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
