// Top-level PRA Quantification Report
export interface Report {
  modelName?: string;
  faultTrees?: FaultTreeResult[];
  eventTrees?: EventTreeResult[];
}

export interface FaultTreeResult {
  name: string;
  description?: string;
  topEventProbability: number;
  cutSets?: CutSets;
}

export interface CutSets {
  products: number;
  distributionByOrder?: number[];
  list: CutSet[];
}

export interface CutSet {
  order: number; // number of literals in this set
  literals: CutSetLiteral[];
  // If probability analysis ran:
  probability?: number;
  contribution?: number;
}

export type CutSetLiteral =
  | { type: 'basic-event'; name: string }
  | { type: 'not-basic-event'; name: string };

export interface EventTreeResult {
  name: string;
  description?: string;
  initiatingEvent: {
    name: string;
    frequencyPerYear: number;
  };
  sequences: SequenceResult[];
}

// Each sequence end state and yearly frequency
export interface SequenceResult {
  name?: string;
  endState: string;
  frequencyPerYear: number;
  functionalStates?: FunctionalStateResult[];
}

export interface FunctionalStateResult {
  name: string;
  state: 'failure' | 'success';
}
