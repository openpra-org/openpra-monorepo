import { NodeTypes } from 'reactflow';

import OrGateNode from "./orGateNode";
import AndGateNode from "./andGateNode";
import NotGateNode from "./notGateNode";
import BasicEventNode from "./basicEventNode";
import AtLeastGateNode from "./atLeastGateNode";
import HouseEventNode from "./houseEventNode";
import TransferGateNode from "./transferGateNode";

export interface IFaultTreeNodeIconProps {
    className?: string
}

// two different node types are needed for our example: workflow and placeholder nodes
const nodeTypes: NodeTypes = {
    orGate: OrGateNode,
    andGate: AndGateNode,
    notGate: NotGateNode,
    atLeastGate: AtLeastGateNode,
    basicEvent: BasicEventNode,
    houseEvent: HouseEventNode,
    transferGate: TransferGateNode
};

export default nodeTypes;
