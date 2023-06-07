import HCLTreeVertexValueJSON, { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import { OutcomeJSON } from "../Outcome";

export interface InitVertexValueJSON extends HCLTreeVertexValueJSON {
  outcome?: OutcomeJSON;
}

export interface InitVertexJSON extends InitVertexValueJSON, HCLTreeVertexJSON {
}
