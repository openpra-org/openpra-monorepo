import { Handle, NodeProps, Position } from "reactflow";
import React, { memo } from "react";
import useCreateColClick from "../../../hooks/eventTree/useCreateColClick";
import styles from "./styles/nodeTypes.module.css";

function ColumnNode({ id, data }: NodeProps) {
  const onClick = useCreateColClick(id);
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
        {data.label}
        <text onClick={onClick} className={styles.addNodeButtonText}>
          +
        </text>
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
