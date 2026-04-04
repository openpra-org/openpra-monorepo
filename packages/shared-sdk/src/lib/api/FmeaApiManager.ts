import { AuthService } from "./AuthService";

const FMEA_ENDPOINT = "/api/fmea";
const OPTION_CACHE = "no-cache" as const;

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `JWT ${AuthService.getEncodedToken()}`,
  };
}

export type FmeaColumn = {
  id: string;
  name: string;
  type: "string" | "dropdown";
  dropdownOptions: { number: number; description: string }[];
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
  body: { name: string; type: "string" | "dropdown"; dropdownOptions?: { number: number; description: string }[] },
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
  body: { name: string; type: "string" | "dropdown"; dropdownOptions?: { number: number; description: string }[] },
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
