import { AuthService } from "./AuthService";

const FMEA_ENDPOINT = "/api/fmea";
const OPTION_CACHE = "no-cache" as const;

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `JWT ${AuthService.getEncodedToken()}`,
  };
}

export type FmeaColumnTypeString = "string";
export type FmeaColumnTypeNumber = "number";
export type FmeaColumnTypeDropdown = "dropdown";
export type FmeaColumnTypeComputed = "computed";
export type FmeaColumnTypeRisk = "risk";

export type FmeaColumnType =
  | FmeaColumnTypeString
  | FmeaColumnTypeNumber
  | FmeaColumnTypeDropdown
  | FmeaColumnTypeComputed
  | FmeaColumnTypeRisk;

export type FmeaColumn = {
  id: string;
  name: string;
  type: FmeaColumnType;
  dropdownOptions: { number: number; description: string }[];
  computedFrom?: string[];
  formula?: "product";
};

export type FmeaRow = {
  id: string;
  row_data: Record<string, string>;
};

export type FmeaType = {
  id: number;
  systemsAnalysisId?: number;
  title: string;
  description: string;
  columns: FmeaColumn[];
  rows: FmeaRow[];
};

export type FmeaColumnBadge = {
  text: string;
  color: "primary" | "success" | "accent" | "warning" | "danger";
};

export type FmeaColumnSpec = FmeaColumn & {
  group: string;
  badge?: FmeaColumnBadge;
  linkedTo?: string;
};

export const DEFAULT_FMEA_COLUMNS: FmeaColumnSpec[] = [
  { id: "fmea_id", name: "FMEA ID", type: "string", dropdownOptions: [], group: "Identification" },
  { id: "subsystem", name: "Subsystem", type: "string", dropdownOptions: [], group: "Identification" },

  { id: "component_id", name: "Component ID", type: "string", dropdownOptions: [], group: "Component" },
  { id: "component_desc", name: "Component Description", type: "string", dropdownOptions: [], group: "Component" },
  {
    id: "safety_class",
    name: "Safety Class",
    type: "dropdown",
    group: "Component",
    dropdownOptions: [
      { number: 1, description: "SR" },
      { number: 2, description: "NR" },
    ],
  },

  { id: "function", name: "Function", type: "string", dropdownOptions: [], group: "Analysis" },
  { id: "failure_mode", name: "Failure Mode", type: "string", dropdownOptions: [], group: "Analysis" },
  { id: "fm_code", name: "FM Code", type: "string", dropdownOptions: [], group: "Analysis" },
  { id: "failure_cause", name: "Failure Cause", type: "string", dropdownOptions: [], group: "Analysis" },

  { id: "local_effect", name: "Local Effect", type: "string", dropdownOptions: [], group: "Effects" },
  { id: "system_effect", name: "System Effect", type: "string", dropdownOptions: [], group: "Effects" },
  { id: "end_effect", name: "End Effect (Plant Level)", type: "string", dropdownOptions: [], group: "Effects" },

  {
    id: "S",
    name: "S — Severity",
    type: "number",
    dropdownOptions: [],
    group: "Risk Scoring",
    badge: { text: "Auto RPN", color: "accent" },
  },
  { id: "existing_detection", name: "Existing Detection", type: "string", dropdownOptions: [], group: "Risk Scoring" },
  {
    id: "D",
    name: "D — Detection",
    type: "number",
    dropdownOptions: [],
    group: "Risk Scoring",
    badge: { text: "Auto RPN", color: "accent" },
  },
  {
    id: "existing_mitigation",
    name: "Existing Mitigation",
    type: "string",
    dropdownOptions: [],
    group: "Risk Scoring",
  },
  {
    id: "O",
    name: "O — Occurrence",
    type: "number",
    dropdownOptions: [],
    group: "Risk Scoring",
    badge: { text: "Auto RPN", color: "accent" },
  },
  {
    id: "RPN",
    name: "RPN",
    type: "computed",
    dropdownOptions: [],
    computedFrom: ["S", "D", "O"],
    formula: "product",
    group: "Risk Scoring",
    badge: { text: "Auto-calculated", color: "success" },
  },
  {
    id: "risk",
    name: "Risk",
    type: "risk",
    dropdownOptions: [],
    computedFrom: ["RPN"],
    group: "Risk Scoring",
    badge: { text: "Auto-calculated", color: "success" },
  },

  { id: "recommended_actions", name: "Recommended Actions", type: "string", dropdownOptions: [], group: "Actions" },

  {
    id: "pra_be_id",
    name: "PRA BE ID",
    type: "string",
    dropdownOptions: [],
    group: "PRA Links",
    badge: { text: "Links: Fault Trees", color: "primary" },
    linkedTo: "fault-trees",
  },
  {
    id: "ccf_group",
    name: "CCF Group",
    type: "string",
    dropdownOptions: [],
    group: "PRA Links",
    badge: { text: "Links: CCF", color: "primary" },
    linkedTo: "ccf",
  },
];

export async function GetFmeaBySaId(saId: number): Promise<FmeaType[]> {
  const response = await fetch(`${FMEA_ENDPOINT}/by-sa/${saId}`, {
    method: "GET",
    cache: OPTION_CACHE,
    headers: authHeaders(),
  });
  return (await response.json()) as FmeaType[];
}

export async function GetFmeaById(fmeaId: number): Promise<FmeaType | null> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}`, {
    method: "GET",
    cache: OPTION_CACHE,
    headers: authHeaders(),
  });
  return (await response.json()) as FmeaType;
}

export async function CreateFmea(body: {
  systemsAnalysisId: number;
  title: string;
  description: string;
  columns?: FmeaColumn[];
}): Promise<FmeaType> {
  const response = await fetch(FMEA_ENDPOINT, {
    method: "POST",
    cache: OPTION_CACHE,
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return (await response.json()) as FmeaType;
}

export async function AddFmeaColumn(
  fmeaId: number,
  body: { name: string; type: FmeaColumnType; dropdownOptions?: { number: number; description: string }[] },
): Promise<FmeaType | null> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}/column`, {
    method: "PUT",
    cache: OPTION_CACHE,
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return (await response.json()) as FmeaType;
}

export async function AddFmeaRow(fmeaId: number): Promise<FmeaType | null> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}/row`, {
    method: "PUT",
    cache: OPTION_CACHE,
    headers: authHeaders(),
  });
  return (await response.json()) as FmeaType;
}

export async function UpdateFmeaCell(fmeaId: number, rowId: string, column: string, value: string): Promise<boolean> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}/cell`, {
    method: "PUT",
    cache: OPTION_CACHE,
    headers: authHeaders(),
    body: JSON.stringify({ rowId, column, value }),
  });
  return (await response.json()) as boolean;
}

export async function DeleteFmeaColumn(fmeaId: number, column: string): Promise<FmeaType | null> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${encodeURIComponent(column)}/delete`, {
    method: "PUT",
    cache: OPTION_CACHE,
    headers: authHeaders(),
  });
  return (await response.json()) as FmeaType;
}

export async function DeleteFmeaRow(fmeaId: number, rowId: string): Promise<FmeaType | null> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${encodeURIComponent(rowId)}/delete`, {
    method: "DELETE",
    cache: OPTION_CACHE,
    headers: authHeaders(),
  });
  return (await response.json()) as FmeaType;
}

export async function UpdateFmeaColumnDetails(
  fmeaId: number,
  columnId: string,
  body: { name: string; type: FmeaColumnType; dropdownOptions?: { number: number; description: string }[] },
): Promise<FmeaType | null> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${encodeURIComponent(columnId)}/update`, {
    method: "PUT",
    cache: OPTION_CACHE,
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return (await response.json()) as FmeaType;
}

export async function DeleteFmea(fmeaId: number): Promise<boolean> {
  const response = await fetch(`${FMEA_ENDPOINT}/${fmeaId}/delete`, {
    method: "PUT",
    cache: OPTION_CACHE,
    headers: authHeaders(),
  });
  return (await response.json()) as boolean;
}
