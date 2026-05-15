import React from "react";
import { EdgeProps, getStraightPath } from "reactflow";
import { UseStore } from "../../../hooks/bayesianNetwork/mindmap/useStore";
import { GetEdgeParams } from "../../../../utils/bayesianNodeIntersectionCalculator";
const MindMapEdge: React.FC<EdgeProps> = (props: EdgeProps) => {
  const { id, source, target, style } = props;
  const { nodes } = UseStore((state) => state);
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);
  if (!sourceNode || !targetNode) {
    return null;
  }
  const edgeParams = GetEdgeParams(sourceNode, targetNode);
  const { sx, sy, tx, ty } = edgeParams;
  const [edgePath] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });
  const markerEndId = `url(#react-flow__arrow-${id})`;
  return (
    <>
      <svg
        width="0"
        height="0"
        style={{ overflow: "visible" }}
      >
        <defs>
          <marker
            id={`react-flow__arrow-${id}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,0 L0,6 L6,3 z"
              fill="#0984e3"
            />
          </marker>
        </defs>
      </svg>
      <path
        id={id}
        style={{ ...style, stroke: "#0984e3", strokeWidth: 0.7 }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEndId}
      />
    </>
  );
};
export { MindMapEdge };
