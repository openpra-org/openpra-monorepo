import { Position } from "./Position";

/**
 * Graph Node with id, data, position and type properties
 */
export type GraphNode = {
  id: string;
  data: object;
  position: Position;
  type: string;
};

export type EventTreeNode = {
  id: string;
  data: EventTreeData;
  position: Position;
  type: string;
};

type EventTreeData = {
  label: string;
  depth: number;
  width: number;
  output: boolean;
  inputDepth?: number;
  outputDepth?: number;
};
