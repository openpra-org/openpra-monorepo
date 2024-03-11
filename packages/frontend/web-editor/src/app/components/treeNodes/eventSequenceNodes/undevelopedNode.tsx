import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import cx from "classnames";
import { UseNodeClick } from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";
import { EventSequenceNodeProps } from "./eventSequenceNodeType";

/**
 * Sequence Not Developed Node
 * @param id - node identifier
 * @param selected - node selection flag (true if selected)
 * @param data - node data and attributes
 * @returns Sequence Not Developed Node JSX Element
 */
const UndevelopedNode = memo(
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
        className={cx(stylesMap.undeveloped_node_container)}
        style={{
          opacity: data.tentative ? "0.5" : "1",
        }}
      >
        <div
          className={cx(stylesMap.undeveloped_node_border)}
          style={{ borderColor: border }}
        ></div>
        <div
          className={cx(stylesMap.node, stylesMap.undeveloped_node)}
          data-testid={"undeveloped-node"}
          onClick={onClick}
          style={{
            position: "relative",
          }}
        >
          {"Undeveloped"}
          <Handle
            className={stylesMap.handle}
            type="target"
            position={Position.Left}
            isConnectable={false}
          />
        </div>
      </div>
    );
  },
);

export { UndevelopedNode };
