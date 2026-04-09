import { NodeTypes } from "reactflow";
import { FaultTreeNode } from "./faultTreeNode";
import type { FaultTreeNodeQuantification } from "../../../types/faultTreeQuantification";

/**
 * Optional UI flags and quantification data stored on Fault Tree nodes.
 */
export type FaultTreeNodeProps =
  | {
      isGrayed?: boolean | undefined;
      branchId?: string | undefined;
      /** Quantification / properties for this node */
      quantification?: FaultTreeNodeQuantification;
    }
  | undefined;

/**
 * Registered React Flow node types used by the Fault Tree editor.
 */
const FaultTreeNodeTypes: NodeTypes = {
  orGate: FaultTreeNode("orGate"),
  andGate: FaultTreeNode("andGate"),
  notGate: FaultTreeNode("notGate"),
  atLeastGate: FaultTreeNode("atLeastGate"),
  basicEvent: FaultTreeNode("basicEvent"),
  houseEvent: FaultTreeNode("houseEvent"),
  transferGate: FaultTreeNode("transferGate"),
};

export { FaultTreeNodeTypes };
