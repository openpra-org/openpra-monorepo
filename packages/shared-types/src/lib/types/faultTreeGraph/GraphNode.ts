import { Position } from "./Position";

export interface GraphNode {
  id: string;
  data: object;
  position: Position;
  type: string;
}
