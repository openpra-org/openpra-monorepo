import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import cx from "classnames";

import { NodeTypes } from "../icons/interfaces/nodeProps";
import { NodeIcon } from "../icons/nodeIcon";
import styles from "./styles/nodeTypes.module.css";

/**
 * Basic Event Node
 * @param id - Node identifier
 * @param data - Data that the node holds
 * @returns BasicEventNode JSX Element
 */
const BasicEventNode = memo(() => {
  const stylesMap = styles as Record<string, string>;

  return (
    <div className={stylesMap.node_container}>
      <div className={cx(stylesMap.node)} title="right click to update node">
        {"Basic Event"}

        <Handle
          className={stylesMap.handle}
          type="target"
          position={Position.Top}
          isConnectable={false}
        />
        <Handle
          className={stylesMap.handle}
          type="source"
          position={Position.Bottom}
          isConnectable={false}
        />
      </div>
      <NodeIcon
        nodeType={NodeTypes.BasicEvent}
        iconProps={{
          width: "30px",
          height: "100%",
          viewBox: "0 3 122.61 125.61",
        }}
      />
    </div>
  );
});

export { BasicEventNode };
