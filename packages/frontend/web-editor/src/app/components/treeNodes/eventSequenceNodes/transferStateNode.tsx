import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import cx from "classnames";
import { UseNodeClick } from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";
import { EventSequenceNodeProps } from "./eventSequenceNodeType";

/**
 * Transfer State Node
 * @param id - node identifier
 * @param selected - node selection flag (true if selected)
 * @param data - node data and attributes
 * @returns Transfer State Node JSX Element
 */
const TransferStateNode = memo(
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
        className={cx(stylesMap.transfer_state_node_container)}
        style={{
          opacity: data.tentative ? "0.5" : "1",
        }}
      >
        <div
          className={cx(stylesMap.transfer_state_node_border)}
          style={{ borderColor: border }}
        ></div>
        <div
          className={cx(stylesMap.node, stylesMap.transfer_state_node)}
          data-testid={"transfer-state-node"}
          onClick={onClick}
          style={{
            position: "relative",
          }}
        >
          {"Transfer State"}
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

export { TransferStateNode };
