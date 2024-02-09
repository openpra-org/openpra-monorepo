import { FC } from "react";
import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  getStraightPath,
} from "reactflow";
import { memo } from "react";

interface CustomEdgeData {
  color?: string;
  text?: string;
  straight?: boolean;
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
    const { color = "white", text = "", straight = false } = data;

    if (straight) {
      const [edgePath] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
      return (
        <>
          <BaseEdge style={{ stroke: color }} path={edgePath} id={id} />
          {text && (
            <text>
              <textPath
                href={`#${id}`}
                style={{ fontSize: "12px" }}
                startOffset="50%"
                textAnchor="middle"
              >
                {text}
              </textPath>
            </text>
          )}
        </>
      );
    } else {
      const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return (
        <>
          <BaseEdge style={{ stroke: color }} path={edgePath} id={id} />
          {text && (
            <text>
              <textPath
                href={`#${id}`}
                style={{ fontSize: "12px" }}
                startOffset="50%"
                textAnchor="middle"
              >
                {text}
              </textPath>
            </text>
          )}
        </>
      );
    }
  },
);

export default CustomEdge;
