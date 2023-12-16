import { OutcomeJSON } from "../Outcome";
import { FormulaJSON } from "../Formula";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";

export type GateVertexValueJSON = {
  formula: FormulaJSON | OutcomeJSON;
} & HCLTreeVertexValueJSON;

export type GateVertexJSON = {} & GateVertexValueJSON & HCLTreeVertexJSON;
