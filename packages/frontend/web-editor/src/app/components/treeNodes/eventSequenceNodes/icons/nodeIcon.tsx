import { IIconProps } from "./interfaces/iconProps";
import { INodeProps, NodeTypes } from "./interfaces/nodeProps";

/**
 * Represents the shape of the node based on the type of node and icon properties
 * @param nodeType type of node
 * @param data additional properties of icon (in case of elliptical shape)
 * @param selected flag determining whether a node is selected or not
 */
function getNodeShape(nodeType: NodeTypes, { data, selected }: IIconProps) {
  const outerStroke = selected ? "#7c0a02" : "#0984e3";
  switch (nodeType) {
    case NodeTypes.Initiating:
      return (
        <>
          <rect
            x={"1%"}
            y={"1%"}
            rx="10"
            ry="10"
            width="98%"
            height="98%"
            fill={"none"}
            stroke={outerStroke}
            strokeWidth={1}
          />
          <line
            x1={"1%"}
            y1={37}
            x2={"99%"}
            y2={37}
            stroke={"#0984e3"}
            strokeWidth={1}
          />
        </>
      );
    case NodeTypes.Functional:
      return (
        <rect
          x={"1%"}
          y={"1%"}
          rx="10"
          ry="10"
          width="96%"
          height="90%"
          fill={"none"}
          stroke={outerStroke}
          strokeWidth={1}
        />
      );
    case NodeTypes.Description:
      return (
        <ellipse
          cx={data?.cx}
          cy={data?.cy}
          rx={data?.rx}
          ry={data?.ry}
          fill={"none"}
          stroke={outerStroke}
          strokeWidth={1}
        />
      );
    case NodeTypes.Intermediate:
      return (
        <polygon
          fill={"none"}
          stroke={outerStroke}
          strokeWidth={1}
          points="0,25 15,48 45,48 60,25 45,2 15,2"
        />
      );
    case NodeTypes.Undeveloped:
      return (
        <polygon
          fill={"none"}
          stroke={outerStroke}
          strokeWidth={1}
          points="0,25 30,50 60,25 30,0"
        />
      );
    case NodeTypes.Transfer:
      return (
        <polygon
          fill={"none"}
          stroke={outerStroke}
          strokeWidth={1}
          points="2,10 30,10 30,0 60,25 30,50 30,40 2,40"
        />
      );
    case NodeTypes.End:
      return (
        <polygon
          fill={"none"}
          stroke={outerStroke}
          strokeWidth={1}
          points="2,16 2,34 20,48 40,48 58,34 58,16 40,2 20,2"
        />
      );
  }
}

/**
 * Represents the node's icon based on the type of the node
 * @param nodeType type of node
 * @param iconProps icon properties
 * @returns JSX Element of the node's icon
 */
export const NodeIcon = ({ nodeType, iconProps }: INodeProps) => {
  let text = <></>;
  if (iconProps.showText) {
    text = (
      <text
        x={"50%"}
        y={"50%"}
        dominantBaseline={"middle"}
        textAnchor={"middle"}
        fill={"black"}
        fontFamily={"monospace"}
        fontWeight={"bold"}
        color={"black"}
        fontSize={8}
      >
        {nodeType.valueOf()}
      </text>
    );
  }
  return (
    <svg width={iconProps.width} height={iconProps.height}>
      {getNodeShape(nodeType, iconProps)}
      {text}
    </svg>
  );
};
