import { FC, memo } from "react";
import { BaseEdge, EdgeProps, getSmoothStepPath } from "reactflow";

interface CustomEdgeData {
  color?: string;
  text?: string;
  straight?: boolean;
  hidden?: boolean;
}

const CustomEdge: FC<EdgeProps<CustomEdgeData>> = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data = {},
  }) => {
    const [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 0,
    });

    return (
      <BaseEdge
        path={edgePath}
        id={id}
        style={{
          opacity: data.hidden ? 0 : 1, // Hide visually but keep edge in DOM
          pointerEvents: data.hidden ? "none" : "auto", // Prevent interaction with hidden edges
        }}
      />
    );
  },
);
export default CustomEdge;
