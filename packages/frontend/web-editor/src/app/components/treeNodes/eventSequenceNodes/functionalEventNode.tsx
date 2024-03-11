import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import cx from "classnames";
import { UseNodeClick } from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";
import { EventSequenceNodeProps } from "./eventSequenceNodeType";

/**
 * Functional Node
 * @param id - node identifier
 * @param selected - node selection flag (true if selected)
 * @param data - node data and attributes
 * @returns Functional Node JSX Element
 */
const FunctionalEventNode = memo(
  ({
    id,
    selected,
    data = {},
  }: NodeProps<EventSequenceNodeProps>): JSX.Element => {
    const onClick = UseNodeClick(id, data);
    const stylesMap = styles as Record<string, string>;
    const border = selected ? "#7c0a02" : "#0984e3";
    return (
      <div
        className={cx(stylesMap.node_container)}
        style={{
          opacity: data.tentative ? "0.5" : "1",
        }}
      >
        <div
          className={cx(stylesMap.node, stylesMap.functional_node)}
          data-testid={"functional-node"}
          onClick={onClick}
          style={{
            position: "relative",
            borderColor: border,
          }}
        >
          {"Functional"}
          <Handle
            className={stylesMap.handle}
            type="target"
            position={Position.Left}
            isConnectable={false}
          />
          <Handle
            className={stylesMap.handle}
            type="source"
            position={Position.Right}
            isConnectable={false}
          />
        </div>
      </div>
    );
  },
);

export { FunctionalEventNode };
