import React, { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import cx from "classnames";

import { NodeIcon } from "../icons/nodeIcon";
import { NodeTypes } from "../icons/interfaces/nodeProps";
import styles from "./styles/nodeTypes.module.css";

/**
 * At Least Gate Node
 * @param id - Node identifier
 * @param data - Data that the node holds
 * @returns AtLeastGateNode JSX Element
 */
const AtLeastGateNode = memo(({ id, data }: NodeProps) => (
  <div className={styles.node_container}>
    <div className={cx(styles.node)} title="click to add a child node">
      {"At Least Gate"}

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
      nodeType={NodeTypes.AtLeastGate}
      iconProps={{ width: "30px", height: "100%", viewBox: "96 96 308 308" }}
    />
  </div>
));

export { AtLeastGateNode };
