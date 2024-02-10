import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import useNodeClickHandler from "../../../hooks/eventSequence/useNodeClick";
import styles from "./styles/nodeTypes.module.css";
import { NodeIcon } from "./icons/nodeIcon";
import { NodeTypes } from "./icons/interfaces/nodeProps";

/**
 * Description Node
 * @param id - node identifier
 * @param selected - node selection flag (true if selected)
 * @returns Description Node JSX Element
 */
const DescriptionNode = ({ id, selected }: NodeProps): JSX.Element => {
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
        nodeType={NodeTypes.Description}
        iconProps={{
          showText: true,
          width: "80",
          height: "50",
          data: {
            cx: "50%",
            cy: "50%",
            rx: "39",
            ry: "23",
          },
          selected: selected,
        }}
      />
    </div>
  );
};

export default memo(DescriptionNode);
