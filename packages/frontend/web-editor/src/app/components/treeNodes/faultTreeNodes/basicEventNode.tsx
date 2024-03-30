import React, { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import cx from "classnames";

import { NodeTypes } from "../icons/interfaces/nodeProps";
import { NodeIcon } from "../icons/nodeIcon";
import styles from "./styles/nodeTypes.module.css";
import { UseGrayedNodeHover } from "../../../hooks/faultTree/useGrayedNodeHover";

/**
 * Basic Event Node
 * @param id - Node identifier
 * @param data - Data that the node holds
 * @returns BasicEventNode JSX Element
 */
const BasicEventNode = memo(({ id, data, selected }: NodeProps) => {
  const stylesMap = styles as Record<string, string>;
  const { handleMouseEnter, handleMouseLeave } = UseGrayedNodeHover(id);

  const mouseEnterHandler = () => {
    handleMouseEnter(data?.branchId);
  };
  const mouseLeaveHandler = () => {
    handleMouseLeave(data?.branchId);
  };
  return (
    <div
      className={stylesMap.node_container}
      onMouseEnter={mouseEnterHandler}
      onMouseLeave={mouseLeaveHandler}
    >
      <div
        className={data?.isGrayed ? styles.placeholder : cx(styles.node)}
        title="right click to update node"
      >
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
        selected={selected}
        isGrayed={data?.isGrayed ? data.isGrayed : false}
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
