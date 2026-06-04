export interface EventTreeData {
  label: string;
  depth: number;
  width: number;
  output: boolean;
  inputDepth?: number;
  outputDepth?: number;
  faultTreeId?: string;
  isSequenceId?: boolean;
  allowAdd?: boolean;
  allowDelete?: boolean;
  hideText?: boolean;
  successProbability?: number;
  frequency?: number;
}
