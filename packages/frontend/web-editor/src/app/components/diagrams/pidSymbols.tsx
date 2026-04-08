import { memo, CSSProperties } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import type { PidNodeData, PidSymbolType } from "shared-sdk/lib/api/PlantDiagramApiManager";

function VesselSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <ellipse
        cx="20"
        cy="9"
        rx="10"
        ry="3.5"
      />
      <line
        x1="10"
        y1="9"
        x2="10"
        y2="31"
      />
      <line
        x1="30"
        y1="9"
        x2="30"
        y2="31"
      />
      <ellipse
        cx="20"
        cy="31"
        rx="10"
        ry="3.5"
      />
    </g>
  );
}

function TankSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <ellipse
        cx="9"
        cy="20"
        rx="3.5"
        ry="10"
      />
      <line
        x1="9"
        y1="10"
        x2="31"
        y2="10"
      />
      <line
        x1="9"
        y1="30"
        x2="31"
        y2="30"
      />
      <ellipse
        cx="31"
        cy="20"
        rx="3.5"
        ry="10"
      />
    </g>
  );
}

function PumpSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <circle
        cx="20"
        cy="20"
        r="13"
      />
      {}
      <polygon
        points="10,27 20,7 30,27"
        fill="none"
        strokeWidth="1.2"
      />
      <line
        x1="10"
        y1="27"
        x2="30"
        y2="27"
        strokeWidth="1.2"
      />
    </g>
  );
}

function CompressorSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <circle
        cx="20"
        cy="20"
        r="13"
      />
      {}
      <path
        d="M27,12 Q10,12 10,20 Q10,28 27,28"
        fill="none"
        strokeWidth="1.5"
      />
    </g>
  );
}

function HeatExchangerSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <circle
        cx="13"
        cy="20"
        r="9"
      />
      <circle
        cx="27"
        cy="20"
        r="9"
      />
    </g>
  );
}

function ColumnSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <ellipse
        cx="20"
        cy="6"
        rx="8"
        ry="3"
      />
      <line
        x1="12"
        y1="6"
        x2="12"
        y2="34"
      />
      <line
        x1="28"
        y1="6"
        x2="28"
        y2="34"
      />
      <ellipse
        cx="20"
        cy="34"
        rx="8"
        ry="3"
      />
      {}
      <line
        x1="12"
        y1="14"
        x2="28"
        y2="14"
        strokeWidth="1"
      />
      <line
        x1="12"
        y1="20"
        x2="28"
        y2="20"
        strokeWidth="1"
      />
      <line
        x1="12"
        y1="26"
        x2="28"
        y2="26"
        strokeWidth="1"
      />
    </g>
  );
}

function ReactorSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <circle
        cx="20"
        cy="20"
        r="13"
      />
      {}
      <line
        x1="20"
        y1="7"
        x2="20"
        y2="33"
        strokeWidth="1.2"
      />
      <line
        x1="14"
        y1="20"
        x2="26"
        y2="20"
        strokeWidth="1.2"
      />
      <line
        x1="14"
        y1="26"
        x2="20"
        y2="20"
        strokeWidth="1.2"
      />
      <line
        x1="26"
        y1="26"
        x2="20"
        y2="20"
        strokeWidth="1.2"
      />
    </g>
  );
}

function FurnaceSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <rect
        x="7"
        y="7"
        width="26"
        height="26"
        rx="2"
      />
      {}
      <path
        d="M13,26 Q13,18 17,22 Q17,14 20,18 Q20,10 23,14 Q23,18 27,26"
        fill="none"
        strokeWidth="1.2"
      />
    </g>
  );
}

function FilterSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <polygon points="20,5 35,20 20,35 5,20" />
      {}
      <line
        x1="12"
        y1="20"
        x2="28"
        y2="20"
        strokeWidth="1"
      />
      <line
        x1="14"
        y1="15"
        x2="26"
        y2="15"
        strokeWidth="1"
      />
      <line
        x1="14"
        y1="25"
        x2="26"
        y2="25"
        strokeWidth="1"
      />
    </g>
  );
}

function GateValveSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="miter"
    >
      <polygon points="8,8 8,32 20,20" />
      <polygon points="32,8 32,32 20,20" />
    </g>
  );
}

function GlobeValveSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="miter"
    >
      <polygon points="8,8 8,32 20,20" />
      <polygon points="32,8 32,32 20,20" />
      <circle
        cx="20"
        cy="20"
        r="4"
      />
    </g>
  );
}

function BallValveSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="miter"
    >
      <polygon points="8,8 8,32 20,20" />
      <polygon points="32,8 32,32 20,20" />
      <circle
        cx="20"
        cy="20"
        r="4"
        fill="currentColor"
      />
    </g>
  );
}

function ButterflyValveSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <polygon points="8,8 8,32 20,20" />
      <polygon points="32,8 32,32 20,20" />
      <line
        x1="20"
        y1="8"
        x2="20"
        y2="32"
        strokeWidth="2"
      />
    </g>
  );
}

function CheckValveSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
    >
      <polygon points="8,10 26,20 8,30" />
      <line
        x1="26"
        y1="10"
        x2="26"
        y2="30"
      />
    </g>
  );
}

function ControlValveSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="miter"
    >
      {}
      <polygon points="9,13 9,27 20,20" />
      <polygon points="31,13 31,27 20,20" />
      {}
      <line
        x1="20"
        y1="13"
        x2="20"
        y2="7"
      />
      <circle
        cx="20"
        cy="5"
        r="4"
      />
    </g>
  );
}

function ReliefValveSvg(): JSX.Element {
  return (
    <g
      stroke="currentColor"
      fill="white"
      strokeWidth="1.5"
      strokeLinejoin="miter"
    >
      <polygon points="8,14 8,32 20,23" />
      <polygon points="32,14 32,32 20,23" />
      {}
      <line
        x1="20"
        y1="14"
        x2="20"
        y2="8"
      />
      <path
        d="M17,8 Q20,5 23,8"
        fill="none"
        strokeWidth="1.2"
      />
      <path
        d="M17,5 Q20,2 23,5"
        fill="none"
        strokeWidth="1.2"
      />
    </g>
  );
}

function InstrumentSvg({ code }: { code: string }): JSX.Element {
  const first = code.slice(0, 3);
  const second = code.slice(3, 7);
  return (
    <g>
      <circle
        cx="20"
        cy="20"
        r="14"
        stroke="currentColor"
        fill="white"
        strokeWidth="1.5"
      />
      {}
      <line
        x1="6"
        y1="20"
        x2="34"
        y2="20"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      <text
        x="20"
        y="18"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="7"
        fontFamily="monospace"
        fill="currentColor"
        fontWeight="bold"
      >
        {first}
      </text>
      {second && (
        <text
          x="20"
          y="27"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="6"
          fontFamily="monospace"
          fill="currentColor"
        >
          {second}
        </text>
      )}
    </g>
  );
}

export function SymbolShape({
  symbolType,
  instrumentCode,
}: {
  symbolType: PidSymbolType;
  instrumentCode: string;
}): JSX.Element {
  switch (symbolType) {
    case "vessel":
      return <VesselSvg />;
    case "tank":
      return <TankSvg />;
    case "pump":
      return <PumpSvg />;
    case "compressor":
      return <CompressorSvg />;
    case "heat_exchanger":
      return <HeatExchangerSvg />;
    case "column":
      return <ColumnSvg />;
    case "reactor":
      return <ReactorSvg />;
    case "furnace":
      return <FurnaceSvg />;
    case "filter":
      return <FilterSvg />;
    case "gate_valve":
      return <GateValveSvg />;
    case "globe_valve":
      return <GlobeValveSvg />;
    case "ball_valve":
      return <BallValveSvg />;
    case "butterfly_valve":
      return <ButterflyValveSvg />;
    case "check_valve":
      return <CheckValveSvg />;
    case "control_valve":
      return <ControlValveSvg />;
    case "relief_valve":
      return <ReliefValveSvg />;
    case "instrument":
      return <InstrumentSvg code={instrumentCode || "AI"} />;
    case "text_label":
      return <></>;
    default:
      return (
        <rect
          x="8"
          y="8"
          width="24"
          height="24"
          stroke="currentColor"
          fill="white"
          strokeWidth="1.5"
        />
      );
  }
}

const handleStyle: CSSProperties = {
  width: 8,
  height: 8,
  background: "#aaa",
  border: "1px solid #666",
};

function PidNodeComponent({ data, selected }: NodeProps<PidNodeData>): JSX.Element {
  const isText = data.symbolType === "text_label";
  const nodeW = isText ? "auto" : 60;
  const nodeH = isText ? "auto" : 60;

  const outerStyle: CSSProperties = {
    width: nodeW,
    height: nodeH,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    outline: selected ? "2px solid #006bb4" : "none",
    outlineOffset: 3,
    borderRadius: 4,
    padding: isText ? "4px 8px" : 0,
    background: isText ? "rgba(255,255,255,0.85)" : "transparent",
    border: isText ? "1px dashed #aaa" : "none",
    userSelect: "none",
  };

  return (
    <div style={outerStyle}>
      {}
      <Handle
        type="source"
        position={Position.Top}
        id="t"
        style={{ ...handleStyle, top: -4 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        style={{ ...handleStyle, bottom: -4 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="l"
        style={{ ...handleStyle, left: -4 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        style={{ ...handleStyle, right: -4 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="tt"
        style={{ ...handleStyle, top: -4 }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="tb"
        style={{ ...handleStyle, bottom: -4 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="tl"
        style={{ ...handleStyle, left: -4 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="tr"
        style={{ ...handleStyle, right: -4 }}
      />

      {isText ?
        <span style={{ fontSize: 13, color: "#333", whiteSpace: "pre-wrap", maxWidth: 200 }}>
          {data.label || "Text"}
        </span>
      : <>
          <svg
            viewBox="0 0 40 40"
            width={52}
            height={52}
            style={{ color: selected ? "#006bb4" : "#1a1a2e", overflow: "visible" }}
          >
            <SymbolShape
              symbolType={data.symbolType}
              instrumentCode={data.instrumentCode}
            />
          </svg>
          {data.tagNumber && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "#333",
                marginTop: 2,
                lineHeight: 1.2,
                textAlign: "center",
              }}
            >
              {data.tagNumber}
            </span>
          )}
        </>
      }
    </div>
  );
}

export const PidNode = memo(PidNodeComponent);

export const NODE_TYPES = { pid: PidNode };

export type PaletteSymbol = {
  symbolType: PidSymbolType;
  label: string;
  group: "Equipment" | "Valves" | "Instruments" | "Annotation";
  defaultInstrumentCode?: string;
};

export const PALETTE_SYMBOLS: PaletteSymbol[] = [
  { symbolType: "vessel", label: "Vessel / Tank (vertical)", group: "Equipment" },
  { symbolType: "tank", label: "Horizontal Tank", group: "Equipment" },
  { symbolType: "pump", label: "Centrifugal Pump", group: "Equipment" },
  { symbolType: "compressor", label: "Compressor", group: "Equipment" },
  { symbolType: "heat_exchanger", label: "Heat Exchanger", group: "Equipment" },
  { symbolType: "column", label: "Column / Tower", group: "Equipment" },
  { symbolType: "reactor", label: "Reactor / Vessel with Agitator", group: "Equipment" },
  { symbolType: "furnace", label: "Furnace / Fired Heater", group: "Equipment" },
  { symbolType: "filter", label: "Filter / Strainer", group: "Equipment" },

  { symbolType: "gate_valve", label: "Gate Valve", group: "Valves" },
  { symbolType: "globe_valve", label: "Globe Valve", group: "Valves" },
  { symbolType: "ball_valve", label: "Ball Valve", group: "Valves" },
  { symbolType: "butterfly_valve", label: "Butterfly Valve", group: "Valves" },
  { symbolType: "check_valve", label: "Check Valve", group: "Valves" },
  { symbolType: "control_valve", label: "Control Valve", group: "Valves" },
  { symbolType: "relief_valve", label: "Safety / Relief Valve", group: "Valves" },

  { symbolType: "instrument", label: "Flow Indicator (FI)", group: "Instruments", defaultInstrumentCode: "FI" },
  { symbolType: "instrument", label: "Flow Controller (FC)", group: "Instruments", defaultInstrumentCode: "FC" },
  { symbolType: "instrument", label: "Pressure Indicator (PI)", group: "Instruments", defaultInstrumentCode: "PI" },
  { symbolType: "instrument", label: "Pressure Controller (PC)", group: "Instruments", defaultInstrumentCode: "PC" },
  { symbolType: "instrument", label: "Temperature Indicator (TI)", group: "Instruments", defaultInstrumentCode: "TI" },
  { symbolType: "instrument", label: "Temperature Controller (TC)", group: "Instruments", defaultInstrumentCode: "TC" },
  { symbolType: "instrument", label: "Level Indicator (LI)", group: "Instruments", defaultInstrumentCode: "LI" },
  { symbolType: "instrument", label: "Level Controller (LC)", group: "Instruments", defaultInstrumentCode: "LC" },
  { symbolType: "instrument", label: "Analyzer Transmitter (AT)", group: "Instruments", defaultInstrumentCode: "AT" },

  { symbolType: "text_label", label: "Text / Annotation", group: "Annotation" },
];
