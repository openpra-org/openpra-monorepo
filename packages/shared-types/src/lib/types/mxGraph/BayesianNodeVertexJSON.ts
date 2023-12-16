import { OutcomeJSON } from "../Outcome";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";
import { BayesianNodeStateJSON } from "./BayesianNodeStateJSON";

export type BayesianNodeVertexValueJSON = {
  states: Record<string, BayesianNodeStateJSON>;
  dependencies?: OutcomeJSON[];
} & HCLTreeVertexValueJSON;
