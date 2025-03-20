import { NodeTypes } from "reactflow";
import VisibleNode from "./visibleNode";
import ColumnNode from "./columnNode";
import OutputNode from "./outputNode";
import InvisibleNode from "./invisibleNode";
import ComputeButtonColumn from "./ComputeButtonColumn";

export const nodeTypes: NodeTypes = {
  visibleNode: VisibleNode,
  invisibleNode: InvisibleNode,
  outputNode: OutputNode,
  columnNode: ColumnNode,
  computeButtonColumn: ComputeButtonColumn,
};

export default nodeTypes;
