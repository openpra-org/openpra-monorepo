import { getBezierPath, EdgeProps } from "reactflow";

import useEdgeClick from "../../../hooks/eventSequence/useEdgeClick";
import styles from "./styles/edgeType.module.css";

/**
 * Functional Edge (having a label Yes/No)
 * @param id - id of edge
 * @param sourceX - x co-ordinate of source of edge
 * @param sourceY - y co-ordinate of source of edge
 * @param targetX - x co-ordinate of target of edge
 * @param targetY - y co-ordinate of target of edge
 * @param sourcePosition - source position
 * @param targetPosition - target position
 * @param style - styling of edge
 * @param markerEnd - marker
 * @param label - label of edge
 * @returns JSX Element for the edge
 */
export default function FunctionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
}: EdgeProps) {
  const onClick = useEdgeClick(id);

  const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className={styles.edgePath}
        d={edgePath}
        markerEnd={markerEnd}
      />
      <g transform={`translate(${edgeCenterX}, ${edgeCenterY})`}>
        <rect
          onClick={onClick}
          x={-5}
          y={-5}
          width={10}
          ry={2}
          rx={2}
          height={10}
          className={styles.edgeButton}
        />
        <text className={styles.edgeButtonText} y={3} x={-3}>
          +
        </text>
        <text className={styles.edgeButtonText} y={3} x={10}>
          {label}
        </text>
      </g>
    </>
  );
}
