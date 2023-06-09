import { OutcomeJSON } from "../Outcome";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";
import { FormulaJSON } from "../Formula";

export interface GateVertexValueJSON extends HCLTreeVertexValueJSON {
  formula: FormulaJSON | OutcomeJSON;
}

export interface GateVertexJSON extends GateVertexValueJSON, HCLTreeVertexJSON {

}
