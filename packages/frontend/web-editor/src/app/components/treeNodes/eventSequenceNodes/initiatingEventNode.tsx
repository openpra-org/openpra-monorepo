import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import cx from "classnames";
import { UseNodeClick } from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";

/**
 * Initiating Event Node
 * @param id - node identifier
 * @param selected - node selection flag (true if selected)
 * @returns Initiating Event Node JSX Element
 */
const InitiatingEventNode = memo(({ id, selected }: NodeProps): JSX.Element => {
  const onClick = UseNodeClick(id, {});
  const stylesMap = styles as Record<string, string>;
  const border = selected ? "#7c0a02" : "#0984e3";
  return (
    <div className={cx(stylesMap.node_container)}>
      <div
        className={cx(stylesMap.node)}
        data-testid={"initiating-event-node"}
        onClick={onClick}
        style={{ position: "relative", borderColor: border }}
      >
        {"Initiating Event"}
        <Handle
          className={stylesMap.handle}
          type="source"
          position={Position.Right}
          isConnectable={false}
        />
      </div>
      <div className={cx(stylesMap.line)} />
    </div>
  );
});

export { InitiatingEventNode };
