import { FC } from "react";
import { BaseEdge, EdgeProps } from "reactflow";
import { memo } from "react";

interface CustomEdgeData {
  color?: string;
  text?: string;
  straight?: boolean;
  hidden?: boolean;
}

const CustomEdge: FC<EdgeProps<CustomEdgeData>> = memo(({ id, sourceX, sourceY, targetX, targetY, data = {} }) => {
  // Drop vertically at source x to the target y, then travel horizontally.
  const edgePath = `M ${sourceX} ${sourceY} L ${sourceX} ${targetY} L ${targetX} ${targetY}`;

  return (
    <BaseEdge
      path={edgePath}
      id={id}
      style={{
        opacity: data.hidden ? 0 : 1,
        pointerEvents: data.hidden ? "none" : "auto",
      }}
    />
  );
});
export default CustomEdge;
