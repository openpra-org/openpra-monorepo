import { Handle, NodeProps, Position } from "reactflow";
import { memo } from "react";
import React from "react";
import { EuiText } from "@elastic/eui";
import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";
import useNodeClick from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";

function HiddenNode({ id, data }: NodeProps) {
  const onClick = useCreateNodeClick(id);

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
        <div className={data.output ? styles.outputNode : styles.inputNode}>
          <EuiText
            style={{
              fontSize: "0.7rem",
              height: "1.2rem",
            }}
          >
            0.55
          </EuiText>{" "}
        </div>
        {data.output ? null : (
          <>
            <EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>
              Yes
            </EuiText>

            <p onClick={onClick} className={styles.addNodeButtonText}>
              +
            </p>
          </>
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

export default HiddenNode;
