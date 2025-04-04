import { NodeTypes } from "reactflow";
import { MasterLogicDiagramNode } from "./masterLogicDiagramNode";

export type MasterLogicDiagramNodeProps =
  | {
      isGrayed?: boolean | undefined;
      branchId?: string | undefined;
    }
  | undefined;

// two different node types are needed for our example: workflow and placeholder nodes
const MasterLogicDiagramNodeTypes: NodeTypes = {
  orGate: MasterLogicDiagramNode("orGate"),
  andGate: MasterLogicDiagramNode("andGate"),
  basicEvent: MasterLogicDiagramNode("basicEvent"),
};

export { MasterLogicDiagramNodeTypes };
