import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import useNodeClickHandler from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";
import { NodeIcon } from "./icons/nodeIcon";
import { NodeTypes } from "./icons/interfaces/nodeProps";

/**
 * Functional Node
 * @param id node identifier
 * @param selected node selection flag (true if selected)
 * @returns Functional Node JSX Element
 */
const FunctionalEventNode = ({ id, selected }: NodeProps) => {
  const onClick = useNodeClickHandler(id);

  return (
    <div onClick={onClick} style={{ position: "relative" }}>
      <Handle
        className={styles.handle}
        type="target"
        position={Position.Left}
        isConnectable={false}
      />
      <Handle
        className={styles.handle}
        type="source"
        position={Position.Right}
        isConnectable={false}
      />
      <NodeIcon
        nodeType={NodeTypes.Functional}
        iconProps={{
          showText: true,
          width: "60",
          height: "50",
          selected: selected,
        }}
      />
    </div>
  );
};

export default memo(FunctionalEventNode);
