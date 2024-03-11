import { memo } from "react";
import { EdgeProps, getBezierPath } from "reactflow";
import { UseEdgeClick } from "../../../hooks/eventSequence/useEdgeClick";
import styles from "./styles/edgeType.module.css";
import { EventSequenceTypeProps } from "./eventSequenceEdgeType";

/**
 * Normal Edge between two nodes
 * @param id - id of edge
 * @param sourceX - x co-ordinate of source of edge
 * @param sourceY - y co-ordinate of source of edge
 * @param targetX - x co-ordinate of target of edge
 * @param targetY - y co-ordinate of target of edge
 * @param sourcePosition - source position
 * @param targetPosition - target position
 * @param style - styling of edge
 * @param markerEnd - marker
 * @param data - data attributes of edge
 * @returns JSX Element for the edge
 */
const NormalEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data = {},
  }: EdgeProps<EventSequenceTypeProps>): JSX.Element => {
    const onClick = UseEdgeClick(id);
    const stylesMap = styles as Record<string, string>;
    const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const edgeBtn = (
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
        <text className={stylesMap.edgeButtonText} y={3} x={-3}>
          +
        </text>
      </g>
    );

    return (
      <>
        <path
          id={id}
          style={style}
          className={
            data.tentative ? stylesMap.placeholderPath : stylesMap.edgePath
          }
          d={edgePath}
          markerEnd={markerEnd}
        />
        {data.tentative ? <></> : edgeBtn}
      </>
    );
  },
);

export { NormalEdge };
