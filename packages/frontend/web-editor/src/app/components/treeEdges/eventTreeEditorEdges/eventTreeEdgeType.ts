import { EdgeTypes } from "reactflow";
import CustomEdge from "./customEdge";
export interface EventTreeEdgeData {
  branchState?: "bypass" | "success" | "failure";
  feId?: string;
  hidden?: boolean;
}
const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};
export default edgeTypes;
