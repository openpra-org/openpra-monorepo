import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import useNodeClickHandler from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";
import { NodeIcon } from "./icons/nodeIcon";
import { NodeTypes } from "./icons/interfaces/nodeProps";

/**
 * Initiating Event Node
 * @param id node identifier
 * @param selected node selection flag (true if selected)
 * @returns Initiating Event Node JSX Element
 */
const InitiatingEventNode = ({ id, selected }: NodeProps) => {
  const onClick = useNodeClickHandler(id);

  return (
    <div onClick={onClick} style={{ position: "relative" }}>
      <Handle
        className={styles.handle}
        type="source"
        position={Position.Right}
        isConnectable={false}
      />
      <NodeIcon
        nodeType={NodeTypes.Initiating}
        iconProps={{
          width: "90",
          height: "50",
          showText: true,
          selected: selected,
        }}
      />
    </div>
  );
};

export default memo(InitiatingEventNode);
