import { OutcomeJSON } from "../Outcome";
import { FormulaJSON } from "../Formula";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";

export interface GateVertexValueJSON extends HCLTreeVertexValueJSON {
  formula: FormulaJSON | OutcomeJSON;
}

export interface GateVertexJSON
  extends GateVertexValueJSON,
    HCLTreeVertexJSON {}
