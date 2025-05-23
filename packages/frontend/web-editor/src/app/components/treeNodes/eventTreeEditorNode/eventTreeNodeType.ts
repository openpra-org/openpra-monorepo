import { NodeTypes } from "reactflow";

import ColumnNode from "./columnNode";
import InvisibleNode from "./invisibleNode";
import OutputNode from "./outputNode";
import VisibleNode from "./visibleNode";

export const nodeTypes: NodeTypes = {
  visibleNode: VisibleNode,
  invisibleNode: InvisibleNode,
  outputNode: OutputNode,
  columnNode: ColumnNode,
};

export default nodeTypes;
