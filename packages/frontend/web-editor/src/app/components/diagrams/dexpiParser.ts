import { nanoid } from "nanoid";
import type { PidNode, PidEdge, PidSymbolType } from "shared-sdk/lib/api/PlantDiagramApiManager";
const EQUIPMENT_MAP: Record<string, PidSymbolType> = {
  Vessel: "vessel",
  VerticalVessel: "vessel",
  HorizontalVessel: "tank",
  Column: "column",
  Tower: "column",
  Reactor: "reactor",
  HeatExchanger: "heat_exchanger",
  Cooler: "heat_exchanger",
  Heater: "heat_exchanger",
  Condenser: "heat_exchanger",
  Pump: "pump",
  CentrifugalPump: "pump",
  Compressor: "compressor",
  Turbine: "compressor",
  Furnace: "furnace",
  FiredHeater: "furnace",
  Filter: "filter",
  Strainer: "filter",
  Separator: "vessel",
  Drum: "vessel",
  Tank: "tank",
  Agitator: "reactor",
};
const VALVE_MAP: Record<string, PidSymbolType> = {
  ManualValve: "gate_valve",
  GateValve: "gate_valve",
  GlobeValve: "globe_valve",
  BallValve: "ball_valve",
  ButterflyValve: "butterfly_valve",
  CheckValve: "check_valve",
  NonReturnValve: "check_valve",
  AutomaticValve: "control_valve",
  ControlValve: "control_valve",
  SafetyValve: "relief_valve",
  ReliefValve: "relief_valve",
  PressureReliefValve: "relief_valve",
};
const INSTRUMENT_CODES: Record<string, string> = {
  FlowTransmitter: "FT",
  FlowIndicator: "FI",
  FlowController: "FC",
  PressureTransmitter: "PT",
  PressureIndicator: "PI",
  PressureController: "PC",
  TemperatureTransmitter: "TT",
  TemperatureIndicator: "TI",
  TemperatureController: "TC",
  LevelTransmitter: "LT",
  LevelIndicator: "LI",
  LevelController: "LC",
  Analyzer: "AT",
  Controller: "IC",
  Indicator: "XI",
  Transmitter: "XT",
  Recorder: "XR",
};
function attr(el: Element, ...names: string[]): string {
  for (const n of names) {
    const v = el.getAttribute(n);
    if (v !== null) return v;
  }
  return "";
}
function getPosition(el: Element): {
  x: number;
  y: number;
} | null {
  const extent = el.querySelector("Extent");
  if (extent) {
    const x1 = parseFloat(attr(extent, "X1", "x1") || "0");
    const x2 = parseFloat(attr(extent, "X2", "x2") || "0");
    const y1 = parseFloat(attr(extent, "Y1", "y1") || "0");
    const y2 = parseFloat(attr(extent, "Y2", "y2") || "0");
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }
  const pos = el.querySelector("Position");
  if (pos) {
    const x = parseFloat(attr(pos, "X", "x") || "0");
    const y = parseFloat(attr(pos, "Y", "y") || "0");
    return { x, y };
  }
  const x = attr(el, "X", "x");
  const y = attr(el, "Y", "y");
  if (x || y) return { x: parseFloat(x || "0"), y: parseFloat(y || "0") };
  return null;
}
function scalePos(
  raw: {
    x: number;
    y: number;
  },
  offset: {
    x: number;
    y: number;
  },
): {
  x: number;
  y: number;
} {
  return { x: (raw.x - offset.x) * 1.0, y: (raw.y - offset.y) * 1.0 };
}
export function parseDexpiXml(xmlString: string): {
  nodes: PidNode[];
  edges: PidEdge[];
  error?: string;
} {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) throw new Error(parseError.textContent ?? "XML parse error");
  } catch (e) {
    return { nodes: [], edges: [], error: String(e) };
  }
  const nodes: PidNode[] = [];
  const edges: PidEdge[] = [];
  const rawPositions: {
    x: number;
    y: number;
  }[] = [];
  const allEquipment = Array.from(doc.querySelectorAll("Equipment"));
  const allPipingComps = Array.from(doc.querySelectorAll("PipingComponent"));
  const allInstruments = Array.from(doc.querySelectorAll("InstrumentComponent"));
  for (const el of [...allEquipment, ...allPipingComps, ...allInstruments]) {
    const p = getPosition(el);
    if (p) rawPositions.push(p);
  }
  const minX = rawPositions.length ? Math.min(...rawPositions.map((p) => p.x)) - 50 : 0;
  const minY = rawPositions.length ? Math.min(...rawPositions.map((p) => p.y)) - 50 : 0;
  const offset = { x: minX, y: minY };
  const idMap = new Map<string, string>();
  for (const el of allEquipment) {
    const compClass = attr(el, "ComponentClass");
    const tagName = attr(el, "TagName");
    const persistId = attr(el, "ID") || attr(el, "PersistentID") || tagName || nanoid(8);
    const symbolType: PidSymbolType = EQUIPMENT_MAP[compClass] ?? "vessel";
    const rawPos = getPosition(el);
    const position = rawPos ? scalePos(rawPos, offset) : { x: 80 + nodes.length * 120, y: 80 };
    const rfId = nanoid();
    idMap.set(persistId, rfId);
    if (tagName) idMap.set(tagName, rfId);
    for (const nozzle of Array.from(el.querySelectorAll("Nozzle"))) {
      const nId = attr(nozzle, "ID");
      const nTag = attr(nozzle, "TagName");
      if (nId) idMap.set(nId, rfId);
      if (nTag) idMap.set(nTag, rfId);
    }
    nodes.push({
      id: rfId,
      type: "pid",
      position,
      data: {
        label: tagName,
        tagNumber: tagName,
        symbolType,
        description: compClass,
        service: "",
        instrumentCode: "",
        properties: {},
      },
    });
  }
  for (const el of allPipingComps) {
    const compClass = attr(el, "ComponentClass");
    const tagName = attr(el, "TagName");
    const persistId = attr(el, "ID") || tagName || nanoid(8);
    const symbolType: PidSymbolType = VALVE_MAP[compClass] ?? "gate_valve";
    const rawPos = getPosition(el);
    const position = rawPos ? scalePos(rawPos, offset) : { x: 80 + nodes.length * 100, y: 200 };
    const rfId = nanoid();
    idMap.set(persistId, rfId);
    if (tagName) idMap.set(tagName, rfId);
    for (const nozzle of Array.from(el.querySelectorAll("Nozzle"))) {
      const nId = attr(nozzle, "ID");
      const nTag = attr(nozzle, "TagName");
      if (nId) idMap.set(nId, rfId);
      if (nTag) idMap.set(nTag, rfId);
    }
    nodes.push({
      id: rfId,
      type: "pid",
      position,
      data: {
        label: tagName,
        tagNumber: tagName,
        symbolType,
        description: compClass,
        service: "",
        instrumentCode: "",
        properties: {},
      },
    });
  }
  for (const el of allInstruments) {
    const compClass = attr(el, "ComponentClass");
    const tagName = attr(el, "TagName");
    const persistId = attr(el, "ID") || tagName || nanoid(8);
    const instrCode = (INSTRUMENT_CODES[compClass] ?? tagName.replace(/[0-9-_]+$/, "").slice(0, 4)) || "XI";
    const rawPos = getPosition(el);
    const position = rawPos ? scalePos(rawPos, offset) : { x: 80 + nodes.length * 100, y: 350 };
    const rfId = nanoid();
    idMap.set(persistId, rfId);
    if (tagName) idMap.set(tagName, rfId);
    nodes.push({
      id: rfId,
      type: "pid",
      position,
      data: {
        label: tagName,
        tagNumber: tagName,
        symbolType: "instrument",
        description: compClass,
        service: "",
        instrumentCode: instrCode,
        properties: {},
      },
    });
  }
  for (const el of doc.querySelectorAll("PipeConnector")) {
    const node1 = attr(el, "Node1", "StartNode");
    const node2 = attr(el, "Node2", "EndNode");
    const src = idMap.get(node1);
    const tgt = idMap.get(node2);
    if (src && tgt && src !== tgt) {
      edges.push({
        id: nanoid(),
        source: src,
        target: tgt,
        sourceHandle: null,
        targetHandle: null,
        type: "straight",
        data: { lineType: "process", label: "" },
      });
    }
  }
  for (const el of doc.querySelectorAll("SignalLine")) {
    const srcAttr = attr(el, "Source", "StartTag", "FromTag");
    const tgtAttr = attr(el, "Target", "EndTag", "ToTag");
    const src = idMap.get(srcAttr);
    const tgt = idMap.get(tgtAttr);
    if (src && tgt && src !== tgt) {
      edges.push({
        id: nanoid(),
        source: src,
        target: tgt,
        sourceHandle: null,
        targetHandle: null,
        type: "straight",
        data: { lineType: "instrument_signal", label: "" },
      });
    }
  }
  return { nodes, edges };
}
