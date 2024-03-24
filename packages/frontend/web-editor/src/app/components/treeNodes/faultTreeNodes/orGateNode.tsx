import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import cx from "classnames";

import { UseNodeDoubleClick } from "../../../hooks/faultTree/useNodeDoubleClick";
import { NodeTypes } from "../icons/interfaces/nodeProps";
import { NodeIcon } from "../icons/nodeIcon";
import styles from "./styles/nodeTypes.module.css";

/**
 * Or Gate Node
 * @param id - Node identifier
 * @param data - Data that the node holds
 * @returns OrGateNode JSX Element
 */
const OrGateNode = memo(({ id, data }: NodeProps) => {
  const { handleNodeDoubleClick } = UseNodeDoubleClick(id);
  return (
    <div
      className={styles.node_container}
      onDoubleClick={handleNodeDoubleClick}
    >
      <div
        className={cx(styles.node)}
        title="double click to add a basic event"
      >
        {"OR Gate"}

        <Handle
          className={styles.handle}
          type="target"
          position={Position.Top}
          isConnectable={false}
        />
        <Handle
          className={styles.handle}
          type="source"
          position={Position.Bottom}
          isConnectable={false}
        />
      </div>
      <NodeIcon
        nodeType={NodeTypes.OrGate}
        iconProps={{
          width: "30px",
          height: "100%",
          viewBox: "109.34 8.5 234.19 193.67",
        }}
      />
    </div>
  );
});

export { OrGateNode };
