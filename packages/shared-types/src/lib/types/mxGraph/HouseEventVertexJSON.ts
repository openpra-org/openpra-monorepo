import { ConstantJSON } from "../Constant";
import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";

export interface HouseEventVertexValueJSON extends HCLTreeVertexValueJSON {
  constant: ConstantJSON;
}
export interface HouseEventVertexJSON
  extends HouseEventVertexValueJSON,
    HCLTreeVertexJSON {}
