/**
 * Graph Edge with id, source, target, type and data properties
 */
export type GraphEdge<T> = {
  id: string;
  source: string;
  target: string;
  type: string;
  data: T;
  animated: boolean;
};
