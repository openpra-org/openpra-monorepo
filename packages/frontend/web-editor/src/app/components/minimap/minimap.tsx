import React from "react";
import { MiniMap, Node } from "reactflow";

interface CustomMiniMapProps {
  nodeColor?: (node: Node) => string;
  nodeStrokeWidth?: number;
  nodeBorderRadius?: number;
}

const CustomMiniMap: React.FC<CustomMiniMapProps> = ({
  nodeColor = (): string => "#0984e3", // Provide a default function for nodeColor
  nodeStrokeWidth = 3, // Default stroke width
  nodeBorderRadius = 2, // Default border radius
  ...props
}): JSX.Element => (
  <MiniMap
    zoomable
    pannable
    nodeColor={nodeColor}
    nodeStrokeWidth={nodeStrokeWidth}
    nodeBorderRadius={nodeBorderRadius}
    {...props} // Spread other props to allow further customization
  />
);

export default CustomMiniMap;
