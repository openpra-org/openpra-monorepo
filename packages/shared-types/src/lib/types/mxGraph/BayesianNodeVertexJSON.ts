import { OutcomeJSON } from "../Outcome";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";
import { BayesianNodeStateJSON } from "./BayesianNodeStateJSON";

export interface BayesianNodeVertexValueJSON extends HCLTreeVertexValueJSON {
  states: Record<string, BayesianNodeStateJSON>;
  dependencies?: OutcomeJSON[];
}
