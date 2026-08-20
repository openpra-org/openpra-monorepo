export type OeApplic = "high" | "med" | "screen" | "open";

export type OeDisp = "RETAINED" | "GROUPED" | "SCREENED" | "OPEN";

export interface OeSourceView {
  id: string;
  name: string;
  type: string;
  period: string;
  events: number;
  applic: OeApplic;
  note: string;
}

export interface OePrecursorView {
  id: string;
  event: string;
  sourceId: string;
  source: string;
  date: string;
  maps: string;
  disp: OeDisp;
}

export interface OeModel {
  sources: OeSourceView[];
  precursors: OePrecursorView[];
}

export const OE_DISPOSITIONS: OeDisp[] = ["RETAINED", "GROUPED", "SCREENED", "OPEN"];

export const OE_APPLIC_LABEL: Record<OeApplic, { label: string; cls: string }> = {
  high: { label: "High", cls: "iee-tag--lo" },
  med: { label: "Medium", cls: "iee-tag--med" },
  screen: { label: "Screened", cls: "iee-tag--neutral" },
  open: { label: "Open", cls: "iee-tag--hi" },
};

export function dispClass(d: OeDisp): string {
  if (d === "RETAINED") return "iee-tag--lo";
  if (d === "GROUPED") return "iee-tag--ie";
  if (d === "OPEN") return "iee-tag--hi";
  return "iee-tag--neutral";
}
