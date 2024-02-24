import { Handle, NodeProps, Position } from "reactflow";
import { memo } from "react";
import React from "react";
import { EuiText } from "@elastic/eui";
import { EuiTextAlign } from "@elastic/eui/src/components/text";
import styles from "./styles/nodeTypes.module.css";
const hiddenNode: React.FC<NodeProps> = memo(({ data }) => (
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
      }}
    >
      <div className={data.output ? styles.outputNode : null}>
        <EuiText
          style={{
            fontSize: "0.7rem",
            borderColor: "white",
            borderLeft: "1px",
          }}
          textAlign={"center"}
        >
          0.543
        </EuiText>
      </div>
      {data.output ? null : (
        <EuiText style={{ fontSize: "0.7rem" }} textAlign={"center"}>
          Yes
        </EuiText>
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
));

export default hiddenNode;
