import { AuthService } from "./AuthService";

const ENDPOINT = "/api/plant-diagrams";
const OPTION_CACHE = "no-cache" as const;

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `JWT ${AuthService.getEncodedToken()}`,
  };
}

export type PidSymbolType =
  | "vessel"
  | "tank"
  | "pump"
  | "compressor"
  | "heat_exchanger"
  | "column"
  | "reactor"
  | "furnace"
  | "filter"
  | "gate_valve"
  | "globe_valve"
  | "ball_valve"
  | "butterfly_valve"
  | "check_valve"
  | "control_valve"
  | "relief_valve"
  | "instrument"
  | "text_label";

export type PidLineType = "process" | "instrument_signal" | "electrical" | "pneumatic";

export type PidNodeData = {
  label: string;
  tagNumber: string;
  symbolType: PidSymbolType;
  description: string;
  service: string;
  instrumentCode: string;
  properties: Record<string, string>;
};

export type PidNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: PidNodeData;
};

export type PidEdgeData = {
  lineType: PidLineType;
  label: string;
};

export type PidEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  type: string;
  data: PidEdgeData;
};

export type PlantDiagramType = {
  id: number;
  typedModelId?: number;
  title: string;
  description: string;
  diagramType: "PID" | "PFD";
  nodes: PidNode[];
  edges: PidEdge[];
  viewport: { x: number; y: number; zoom: number };
};

export async function CreatePlantDiagram(body: {
  typedModelId: number;
  title: string;
  description?: string;
  diagramType?: "PID" | "PFD";
}): Promise<PlantDiagramType> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: authHeaders(),
    cache: OPTION_CACHE,
    body: JSON.stringify(body),
  });
  return res.json() as Promise<PlantDiagramType>;
}

export async function GetPlantDiagramsByModel(typedModelId: number): Promise<PlantDiagramType[]> {
  const res = await fetch(`${ENDPOINT}/by-model/${typedModelId}`, {
    headers: authHeaders(),
    cache: OPTION_CACHE,
  });
  return res.json() as Promise<PlantDiagramType[]>;
}

export async function GetPlantDiagramById(id: number): Promise<PlantDiagramType | null> {
  const res = await fetch(`${ENDPOINT}/${id}`, {
    headers: authHeaders(),
    cache: OPTION_CACHE,
  });
  return res.json() as Promise<PlantDiagramType>;
}

export async function SavePlantDiagram(id: number, body: Partial<PlantDiagramType>): Promise<PlantDiagramType | null> {
  const res = await fetch(`${ENDPOINT}/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    cache: OPTION_CACHE,
    body: JSON.stringify(body),
  });
  return res.json() as Promise<PlantDiagramType>;
}

export async function DeletePlantDiagram(id: number): Promise<void> {
  await fetch(`${ENDPOINT}/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    cache: OPTION_CACHE,
  });
}
