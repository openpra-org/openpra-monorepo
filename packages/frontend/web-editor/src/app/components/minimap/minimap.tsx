import React from "react";
import { MiniMap, Node } from "reactflow";
interface CustomMiniMapProps {
  nodeColor?: (node: Node) => string;
  nodeStrokeWidth?: number;
  nodeBorderRadius?: number;
}
const CustomMiniMap: React.FC<CustomMiniMapProps> = ({
  nodeColor = (): string => "#0984e3",
  nodeStrokeWidth = 3,
  nodeBorderRadius = 2,
  ...props
}): JSX.Element => (
  <MiniMap
    zoomable
    pannable
    nodeColor={nodeColor}
    nodeStrokeWidth={nodeStrokeWidth}
    nodeBorderRadius={nodeBorderRadius}
    {...props}
  />
);
export default CustomMiniMap;
