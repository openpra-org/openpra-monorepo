import { FC } from "react";
import { BaseEdge, EdgeProps, getSmoothStepPath, getStraightPath } from "reactflow";
import { memo } from "react";

interface CustomEdgeData {
  color?: string;
  text?: string;
  straight?: boolean;
}

const CustomEdge: FC<EdgeProps<CustomEdgeData>> = memo(
  ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data = {} }) => {
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
      />
    );
  },
);
export default CustomEdge;
