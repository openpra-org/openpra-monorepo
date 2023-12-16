import { ExpressionJSON } from "../Expression";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";

export type BasicEventVertexValueJSON = {
  expression: ExpressionJSON;
  source_type: string;
} & HCLTreeVertexValueJSON;

export type BasicEventVertexJSON = {} & BasicEventVertexValueJSON &
  HCLTreeVertexJSON;
