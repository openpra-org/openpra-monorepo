import { Handle, NodeProps, Position } from "reactflow";

import React from "react";

import useCreateNodeClick from "../../../hooks/eventTree/useCreateNodeClick";

import styles from "./styles/nodeTypes.module.css";
const css = styles as Record<string, string>;

interface InvisibleNodeData {
  width: number;
  depth: number;
  addNodeButtonText?: string;
}

function InvisibleNode({ id, data }: NodeProps<InvisibleNodeData>): JSX.Element {
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
        {/*<div className={styles.inputNode}>*/}
        {/*  <EuiText*/}
        {/*    style={{ fontSize: "0.7rem", height: "1.2rem", resize: "none" }}*/}
        {/*  >*/}
        {/*    0.55*/}
        {/*  </EuiText>*/}
        {/*</div>*/}

        {/*<EuiText style={{ fontSize: "0.7rem", height: "1.2rem" }}>Yes</EuiText>*/}

        {data.depth !== 1 && (
          <p
            onClick={onClick}
            className={css.addNodeButtonText}
          >
            +
          </p>
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

export { InvisibleNode };
