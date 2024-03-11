import { Handle, NodeProps, Position } from "reactflow";
import { memo } from "react";
import React from "react";
import { EuiText, EuiTextArea } from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useNodeClick from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";

function OutputNode({ id, data }: NodeProps) {
  return (
    <div>
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
