import { OutcomeJSON } from "../Outcome";
import HCLTreeVertexValueJSON, { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";

export interface InitVertexValueJSON extends HCLTreeVertexValueJSON {
  outcome?: OutcomeJSON;
}

export interface InitVertexJSON
  extends InitVertexValueJSON,
    HCLTreeVertexJSON {}
