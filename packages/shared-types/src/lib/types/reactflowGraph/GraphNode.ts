import { Position } from "./Position";

/**
 * Graph Node with id, data, position and type properties
 */
export interface GraphNode<T> {
  id: string;
  data: T;
  position: Position;
  type: string;
}
