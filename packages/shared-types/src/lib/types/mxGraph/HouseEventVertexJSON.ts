import { ConstantJSON } from "../Constant";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";

export type HouseEventVertexValueJSON = {
  constant: ConstantJSON;
} & HCLTreeVertexValueJSON;
export type HouseEventVertexJSON = {} & HouseEventVertexValueJSON & HCLTreeVertexJSON;
