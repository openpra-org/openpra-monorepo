import { Handle, NodeProps, Position } from "reactflow";

import React from "react";
import { EuiText } from "@elastic/eui";

import styles from "./styles/nodeTypes.module.css";

function OutputNode({ id, data }: NodeProps) {
  return (
    <div style={{ opacity: data.isTentative ? "0.5" : "1" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{
          position: "absolute",
          top: "50%",
          left: "0%",

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
        <div className={styles.outputNode}>
          <EuiText
            style={{ fontSize: "0.7rem", height: "1.2rem", resize: "none" }}
          >
            0.55
          </EuiText>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{
          position: "absolute",
          top: "50%",
          right: "0%",
          visibility: "hidden",
        }}
      />
    </div>
  );
}

export default OutputNode;
