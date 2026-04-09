import React from "react";
import { EdgeProps, getSmoothStepPath } from "reactflow";

import { FaultTreeNodeProps } from "../../treeNodes/faultTreeNodes/faultTreeNodeType";
import { useStore } from "../../../store/faultTreeStore";
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
}: EdgeProps<FaultTreeNodeProps>): JSX.Element {
  const setPendingEdge = useStore((s) => s.setPendingEdge);
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

  const handleAddClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setPendingEdge({ edgeId: id, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <path
        id={id}
        style={style}
        className={data?.isGrayed ? stylesMap.placeholderPath : stylesMap.edgePath}
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data?.isGrayed ? null : (
        <g transform={`translate(${String(edgeCenterX)}, ${String(edgeCenterY)})`}>
          <rect
            onClick={handleAddClick}
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
