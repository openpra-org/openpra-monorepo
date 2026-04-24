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
  // Short horizontal stub to the node's right edge, then vertical to target y, then horizontal.
  // The stub (70px = half node width) keeps the +/- buttons at node center clear of the vertical tick line.
  const tickX = sourceX + 70;
  const edgePath = `M ${sourceX} ${sourceY} L ${tickX} ${sourceY} L ${tickX} ${targetY} L ${targetX} ${targetY}`;

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
