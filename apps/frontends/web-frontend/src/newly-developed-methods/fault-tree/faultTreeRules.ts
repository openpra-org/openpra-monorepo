import { type FtGate, type FtNodeType, type FtFlavor } from "./faultTreeTypes";

export interface NodeTypeOption {
  key: string;
  label: string;
  type: FtNodeType;
  gate?: FtGate;
}

export const NODE_TYPE_OPTIONS: NodeTypeOption[] = [
  { key: "OR", label: "OR gate", type: "GATE", gate: "OR" },
  { key: "AND", label: "AND gate", type: "GATE", gate: "AND" },
  { key: "NOT", label: "NOT gate", type: "GATE", gate: "NOT" },
  { key: "ATLEAST", label: "Voting gate (K of N)", type: "GATE", gate: "ATLEAST" },
  { key: "BASIC", label: "Basic event", type: "BASIC" },
  { key: "HOUSE", label: "House event", type: "HOUSE" },
  { key: "UNDEVELOPED", label: "Undeveloped event", type: "UNDEVELOPED" },
  { key: "TRANSFER", label: "Transfer gate", type: "TRANSFER" },
];

/** How many basic-event children a freshly-created gate is populated with. */
export function autoChildCount(gate: FtGate): number {
  if (gate === "NOT") return 1;
  if (gate === "ATLEAST") return 3;
  return 2;
}

/** Minimum children a gate must keep to stay valid. */
export function minChildCount(gate: FtGate): number {
  if (gate === "NOT") return 1;
  return 2;
}

export function newNodeLabel(option: NodeTypeOption, flavor: FtFlavor): string {
  if (option.type === "GATE") return "New gate";
  return flavor === "heat" ? "New cause" : "New event";
}
