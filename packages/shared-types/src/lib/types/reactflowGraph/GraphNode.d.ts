import { Position } from "./Position";
export interface GraphNode<T> {
    id: string;
    data: T;
    position: Position;
    type: string;
}
