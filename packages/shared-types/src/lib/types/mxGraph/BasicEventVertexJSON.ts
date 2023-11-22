import { ExpressionJSON } from "../Expression";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";

export interface BasicEventVertexValueJSON extends HCLTreeVertexValueJSON {
  expression: ExpressionJSON;
  source_type: string;
}

export interface BasicEventVertexJSON
  extends BasicEventVertexValueJSON,
    HCLTreeVertexJSON {}
