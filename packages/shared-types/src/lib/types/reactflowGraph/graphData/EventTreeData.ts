export type EventTreeData = {
  label: string;
  depth: number;
  width: number;
  output: boolean;
  inputDepth?: number;
  outputDepth?: number;
  option?: string;
  onNodeDataChange: (nodeId: string, newData: EventTreeData) => void;
};
