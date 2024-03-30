import { NodeTypes } from "reactflow";
import { FaultTreeNode } from "./faultTreeNode";

export type FaultTreeNodeProps = {
  isGrayed?: boolean | undefined;
  branchId?: string | undefined;
};

// two different node types are needed for our example: workflow and placeholder nodes
const nodeTypes: NodeTypes = {
  orGate: FaultTreeNode("orGate"),
  andGate: FaultTreeNode("andGate"),
  notGate: FaultTreeNode("notGate"),
  atLeastGate: FaultTreeNode("atLeastGate"),
  basicEvent: FaultTreeNode("basicEvent"),
  houseEvent: FaultTreeNode("houseEvent"),
  transferGate: FaultTreeNode("transferGate"),
};

export { FaultTreeNodeTypes };
