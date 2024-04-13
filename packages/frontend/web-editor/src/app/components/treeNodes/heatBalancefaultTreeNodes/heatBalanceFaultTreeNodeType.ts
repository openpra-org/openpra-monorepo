import { NodeTypes } from "reactflow";
import { HeatBalanceFaultTreeNode } from "./heatBalanceFaultTreeNode";


export type HeatBalanceFaultTreeNodeProps = {
  isGrayed?: boolean | undefined;
  branchId?: string | undefined;
  label?: string;
};

// two different node types are needed for our example: workflow and placeholder nodes
const HeatBalanceFaultTreeNodeTypes: NodeTypes = {
  orGate: HeatBalanceFaultTreeNode("orGate"),
  andGate: HeatBalanceFaultTreeNode("andGate"),
  notGate: HeatBalanceFaultTreeNode("notGate"),
  basicEvent: HeatBalanceFaultTreeNode("basicEvent"),
  transferGate: HeatBalanceFaultTreeNode("transferGate"),
  initiator: HeatBalanceFaultTreeNode("initiator"),
};

export { HeatBalanceFaultTreeNodeTypes };
