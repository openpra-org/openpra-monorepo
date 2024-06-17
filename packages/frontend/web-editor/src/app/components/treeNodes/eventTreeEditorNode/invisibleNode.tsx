import { Handle, NodeProps, Position } from "reactflow";

import React from "react";

import { EuiIcon, useEuiTheme } from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";

import { UseEventTreeStore, UseGlobalStore } from "../../../zustand/Store";
import styles from "./styles/nodeTypes.module.css";

function InvisibleNode({ id, data }: NodeProps) {
  const onClick = UseEventTreeStore((state) => state.createNodeClick);
  const addSnapshot = UseEventTreeStore((state) => state.addSnapshot);

  return (
    <div style={{ opacity: data.isTentative ? "0.5" : "1" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          display: "none",
        }}
      />
      <div
        style={{
          width: data.width,
          height: 50,
          textAlign: "center",
        }}
      >
        {data.depth != 1 && (
          <EuiIcon
            size={"s"}
            type={"plus"}
            onClick={(evt) => {
              addSnapshot();
              onClick(id);
            }}
            className={styles.addNodeButtonText}
          />
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

export default InvisibleNode;
