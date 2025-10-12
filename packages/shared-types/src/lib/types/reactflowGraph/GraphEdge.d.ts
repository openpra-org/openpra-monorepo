export interface GraphEdge<T> {
    id: string;
    source: string;
    target: string;
    type: string;
    data: T;
    animated: boolean;
}
