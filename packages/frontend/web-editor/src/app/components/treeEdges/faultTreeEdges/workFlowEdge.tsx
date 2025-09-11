import React from "react";
import { EdgeProps, getSmoothStepPath } from "reactflow";
import { UseEdgeClick } from "../../../hooks/faultTree/useEdgeClick";
import styles from "./styles/edgeType.module.css";
import { FaultTreeNodeProps } from "../../treeNodes/faultTreeNodes/faultTreeNodeType";
import { hasIsGrayed } from "../../../../utils/treeUtils";

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
}: EdgeProps<FaultTreeNodeProps>): JSX.Element {
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

  const isGrayed = data && hasIsGrayed(data) ? data.isGrayed : false;

  return (
    <>
      <path
        id={id}
        style={style}
        className={isGrayed ? stylesMap.placeholderPath : stylesMap.edgePath}
        d={edgePath}
        markerEnd={markerEnd}
      />
      {isGrayed ? (
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
          <text
            className={stylesMap.edgeButtonText}
            y={3.5}
            x={-4}
          >
            +
          </text>
        </g>
      )}
    </>
  );
}

export { WorkFlowEdge };