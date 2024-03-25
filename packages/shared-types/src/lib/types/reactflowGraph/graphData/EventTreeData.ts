export type EventTreeData = {
  label: string;
  depth: number;
  width: number;
  output: boolean;
  inputDepth?: number;
  outputDepth?: number;
  isTentative?: boolean;
  isDelete?: boolean;
  tentativeDeleteNodes?: string[];
};
