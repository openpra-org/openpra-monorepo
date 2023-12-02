import { NodeTypes } from "reactflow";
import InitiatingEventNode from "./initiatingEventNode";
import FunctionalEventNode from "./functionalEventNode";
import DescriptionNode from "./descriptionNode";
import UndevelopedNode from "./undevelopedNode";
import IntermediateStateNode from "./intermediateStateNode";
import TransferStateNode from "./transferStateNode";
import EndStateNode from "./endStateNode";

/**
 * Represents the types of nodes of event sequence diagram
 */
const nodeTypes: NodeTypes = {
  initiating: InitiatingEventNode,
  functional: FunctionalEventNode,
  description: DescriptionNode,
  undeveloped: UndevelopedNode,
  intermediate: IntermediateStateNode,
  transfer: TransferStateNode,
  end: EndStateNode,
};

export default nodeTypes;
