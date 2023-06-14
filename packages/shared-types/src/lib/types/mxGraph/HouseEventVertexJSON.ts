import HCLTreeVertexValueJSON from "./HCLTreeVertexJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import { ConstantJSON } from "../Constant";

export interface HouseEventVertexValueJSON extends HCLTreeVertexValueJSON {
  constant: ConstantJSON;
}
export interface HouseEventVertexJSON extends HouseEventVertexValueJSON, HCLTreeVertexJSON {

}
