/**
 * Graph Edge with id, source, target and type properties
 */
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
};
