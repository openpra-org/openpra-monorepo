import React from "react";
import { INodeProps, NodeTypes } from "./interfaces/nodeProps";

/**
 * Represents the shape of the node based on the type of node and icon properties
 * @param nodeType - type of node
 * @param selected - boolean for showing selected state
 * @param isGrayed - boolean for showing grayed out state
 */
function getNodeShape(nodeType: NodeTypes, selected: boolean | undefined, isGrayed: boolean): JSX.Element {
  const stroke = isGrayed ? "#bbb" : selected ? "red" : "#0984e3";
  switch (nodeType) {
    case NodeTypes.AndGate:
      return (
        <path
          d="M204.521 130.389h-56.72V.068h57.085c30.944 0 56.354 29.191 56.354 65.161 0 35.969-25.41 65.16-56.719 65.16Z"
          style={{
            fill: "#fff",
            fillOpacity: 1,
            fillRule: "evenodd",
            stroke: stroke,
            strokeWidth: 3,
            strokeLinecap: "butt",
            strokeLinejoin: "round",
            strokeMiterlimit: 4,
            strokeDashoffset: 0,
            strokeOpacity: 1,
            transformOrigin: "203.52px 63.2285px",
          }}
          transform="rotate(-90 0 0)"
        />
      );
    case NodeTypes.OrGate:
      return (
        <path
          d="M133.356 218.682c-.163.005 49.259-10.636 49.259-113.345 0-103.72-49.263-113.346-49.259-113.346C212.93 2.38 264.757-12.332 319.522 105.337c-40.836 104.042-94.391 108.981-186.166 113.345Z"
          style={{
            fill: "#fff",
            fillOpacity: 1,
            fillRule: "evenodd",
            stroke: stroke,
            strokeWidth: 4.5,
            strokeLinecap: "butt",
            strokeLinejoin: "round",
            strokeMiterlimit: 4,
            strokeDashoffset: 0,
            strokeOpacity: 1,
            transformOrigin: "226.439px 105.336px",
          }}
          transform="rotate(-90 0 0)"
        />
      );
    case NodeTypes.NotGate:
      return (
        <>
          <path
            d="m168.681-9.931 113.28 79.25-113.28 79.25v-158.5Z"
            style={{
              fill: "#fff",
              fillOpacity: 1,
              fillRule: "evenodd",
              stroke: stroke,
              strokeWidth: 3.5,
              strokeLinecap: "butt",
              strokeLinejoin: "round",
              strokeMiterlimit: 4,
              strokeDashoffset: 0,
              strokeOpacity: 1,
              transformOrigin: "225.321px 69.319px",
            }}
            transform="rotate(90 0 0)"
          />
          <path
            d="M245.473 147.168c0 15.514-16.793 25.21-30.228 17.453a20.152 20.152 0 0 1-10.077-17.453c0-15.513 16.794-25.209 30.229-17.452a20.152 20.152 0 0 1 10.076 17.452Z"
            style={{
              opacity: 1,
              fill: "#fff",
              fillOpacity: 1,
              fillRule: "evenodd",
              stroke: stroke,
              strokeWidth: 3.5,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeMiterlimit: 4,
              strokeDasharray: "none",
              strokeDashoffset: 0,
              strokeOpacity: 1,
              transformOrigin: "227.321px 146.168px",
            }}
            transform="rotate(90 0 0)"
          />
        </>
      );
    case NodeTypes.AtLeastGate:
      return (
        <path
          d="M100 100h300v300H100z"
          style={{
            opacity: 1,
            fill: "#fff",
            fillOpacity: 1,
            fillRule: "evenodd",
            stroke: stroke,
            strokeWidth: 6,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeMiterlimit: 4,
            strokeDasharray: "none",
            strokeDashoffset: 0,
            strokeOpacity: 1,
          }}
        />
      );
    case NodeTypes.TransferGate:
      return (
        <path
          fill="#fff"
          stroke={stroke}
          strokeWidth={1.4}
          d="m50 16 35 69H15l35-69z"
        />
      );
    case NodeTypes.BasicEvent:
      return (
        <circle
          style={{
            stroke: stroke,
            strokeWidth: 2.5,
            fill: "white",
          }}
          cx="60"
          cy="60"
          r="55"
        />
      );
    case NodeTypes.HouseEvent:
      return (
        <path
          d="M90 522.362h40v-30l-20-10-20 10v30z"
          style={{
            opacity: 1,
            fill: "#fff",
            fillOpacity: 1,
            stroke: stroke,
            strokeWidth: 0.8,
            strokeLinecap: "square",
            strokeLinejoin: "miter",
            strokeMiterlimit: 4,
            strokeDasharray: "none",
            strokeDashoffset: 0,
            strokeOpacity: 1,
          }}
          transform="translate(-89 -481.362)"
        />
      );
    default:
      return <div></div>;
  }
}

/**
 * Represents the node's icon based on the type of the node
 * @param nodeType - type of node
 * @param iconProps - icon properties
 * @param selected - boolean for showing selected state
 * @param isGrayed - boolean for showing grayed out state
 * @returns JSX Element of the node's icon
 */
export const NodeIcon = ({ nodeType, iconProps, selected, isGrayed }: INodeProps): JSX.Element => (
  <svg
    viewBox={iconProps.viewBox}
    width={iconProps.width}
    height={iconProps.height}
  >
    {getNodeShape(nodeType, selected, isGrayed)}
  </svg>
);
