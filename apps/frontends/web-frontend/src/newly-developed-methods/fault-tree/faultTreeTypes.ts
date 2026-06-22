import { type Node, type Edge } from "reactflow";

export type FtGate = "AND" | "OR" | "NOT" | "ATLEAST";
export type FtNodeType = "GATE" | "BASIC" | "HOUSE" | "TRANSFER" | "UNDEVELOPED";
export type FtFlavor = "logic" | "heat";

export interface FtNodeData {
  label: string;
  type: FtNodeType;
  gate?: FtGate;
  k?: number;
  detail?: string;
  badges?: string[];
}

export interface FtInputNode {
  id: string;
  parentId?: string;
  data: FtNodeData;
}

export type FtNode = Node<FtNodeData>;
export type FtEdge = Edge;
