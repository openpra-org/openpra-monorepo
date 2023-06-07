import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";
import { ExpressionJSON } from "../Expression";

export interface BasicEventVertexValueJSON extends HCLTreeVertexValueJSON {
  expression: ExpressionJSON;
  source_type: string;
}

export interface BasicEventVertexJSON extends BasicEventVertexValueJSON, HCLTreeVertexJSON {

}
