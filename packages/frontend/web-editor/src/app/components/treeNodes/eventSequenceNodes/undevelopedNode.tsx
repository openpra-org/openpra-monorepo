import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import useNodeClickHandler from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";
import { NodeIcon } from "./icons/nodeIcon";
import { NodeTypes } from "./icons/interfaces/nodeProps";

/**
 * Sequence Not Developed Node
 * @param id - node identifier
 * @param selected - node selection flag (true if selected)
 * @returns Sequence Not Developed Node JSX Element
 */
const UndevelopedNode = ({ id, selected }: NodeProps): JSX.Element => {
  const onClick = useNodeClickHandler(id);

  return (
    <div onClick={onClick} style={{ position: "relative" }}>
      <Handle
        className={styles.handle}
        type="target"
        position={Position.Left}
        isConnectable={false}
      />
      <NodeIcon
        nodeType={NodeTypes.Undeveloped}
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

export default memo(UndevelopedNode);
