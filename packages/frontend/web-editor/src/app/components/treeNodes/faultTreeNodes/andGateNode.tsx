import React, { memo, MouseEventHandler } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import cx from "classnames";

import { UseNodeDoubleClick } from "../../../hooks/faultTree/useNodeDoubleClick";
import { NodeIcon } from "../icons/nodeIcon";
import { NodeTypes } from "../icons/interfaces/nodeProps";
import styles from "./styles/nodeTypes.module.css";
import { FaultTreeNodeProps } from "./faultTreeNodeType";
import { UseGrayedNodeHover } from "../../../hooks/faultTree/useGrayedNodeHover";
import { UseGrayedNodeClick } from "../../../hooks/faultTree/useGrayedNodeClick";

/**
 * And Gate Node
 * @param id - Node identifier
 * @param data - Data that the node holds
 * @returns AndGateNode JSX Element
 */
const AndGateNode = memo(
  ({ id, selected, data }: NodeProps & FaultTreeNodeProps) => {
    const { handleNodeDoubleClick } = UseNodeDoubleClick(id);
    const { handleMouseEnter, handleMouseLeave } = UseGrayedNodeHover(id);
    const { handleGrayedNodeClick } = UseGrayedNodeClick(id);

    const mouseEnterHandler = () => {
      handleMouseEnter(data?.branchId);
    };
    const mouseLeaveHandler = () => {
      handleMouseLeave(data?.branchId);
    };
    const grayedNodeClickHandler = () => {
      handleGrayedNodeClick(data?.branchId);
    };

    return (
      <div
        className={styles.node_container}
        onDoubleClick={handleNodeDoubleClick}
        onClick={
          data?.branchId !== undefined ? grayedNodeClickHandler : undefined
        }
        onMouseEnter={mouseEnterHandler}
        onMouseLeave={mouseLeaveHandler}
      >
        <div
          className={data?.isGrayed ? styles.placeholder : cx(styles.node)}
          title="double click to add a basic event"
        >
          {"AND Gate"}

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
          nodeType={NodeTypes.AndGate}
          selected={selected}
          isGrayed={data?.isGrayed ? data.isGrayed : false}
          iconProps={{
            width: "30px",
            height: "100%",
            viewBox: "135.61 4.76 137.82 120.94",
          }}
        />
      </div>
    );
  },
);

export { AndGateNode };
