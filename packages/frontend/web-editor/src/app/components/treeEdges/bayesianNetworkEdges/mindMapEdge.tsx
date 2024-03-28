import {
  BaseEdge,
  EdgeProps,
  getMarkerEnd,
  getStraightPath,
  MarkerType,
} from "reactflow";

function MindMapEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, style } = props;
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY: sourceY + 20,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      style={{ ...style, stroke: " #0984e3" }}
    />
  );
}

export default MindMapEdge;

