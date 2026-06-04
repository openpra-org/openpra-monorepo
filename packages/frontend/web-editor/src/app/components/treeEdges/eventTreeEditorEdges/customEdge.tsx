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
