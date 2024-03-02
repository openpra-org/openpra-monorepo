import { NodeTypes } from "reactflow";
import HiddenNode from "./hiddenNode";
import ColumnNode from "./columnNode";

export const nodeTypes: NodeTypes = {
  hiddenNode: HiddenNode,
  columnNode: ColumnNode,
};

export default nodeTypes;
