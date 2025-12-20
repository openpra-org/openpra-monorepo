/**
 * Data attributes attached to a node in the Event Tree graph.
 */
export interface EventTreeData {
  label: string;
  depth: number;
  width: number;
  output: boolean;
  inputDepth?: number;
  outputDepth?: number;
}
