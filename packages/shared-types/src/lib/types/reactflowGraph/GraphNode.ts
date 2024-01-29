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
