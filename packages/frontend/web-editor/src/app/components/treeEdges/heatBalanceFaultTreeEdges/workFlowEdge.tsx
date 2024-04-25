import React from "react";
import { EdgeProps, getSmoothStepPath } from "reactflow";

import { UseEdgeClick } from "../../../hooks/heatBalanceFaultTree/useEdgeClick";
import styles from "./styles/edgeType.module.css";

function WorkFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps): JSX.Element {
  // see the hook for implementation details
  // onClick adds a node in between the nodes that are connected by this edge
  const onClick = UseEdgeClick(id);
  const stylesMap = styles as Record<string, string>;

  const [edgePath, edgeCenterX, edgeCenterY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });
  return (
    <>
      <path
        id={id}
        style={style}
        className={
          data?.isGrayed ? stylesMap.placeholderPath : stylesMap.edgePath
        }
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data?.isGrayed ? (
        ""
      ) : (
        <g transform={`translate(${edgeCenterX}, ${edgeCenterY})`}>
          <rect
            onClick={onClick}
            x={-5}
            y={-5}
            width={10}
            ry={2}
            rx={2}
            height={10}
            className={stylesMap.edgeButton}
          />
          <text className={stylesMap.edgeButtonText} y={3.5} x={-4}>
            +
          </text>
        </g>
      )}
    </>
  );
}

export { WorkFlowEdge };
