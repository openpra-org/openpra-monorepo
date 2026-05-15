import { NodeTypes } from "reactflow";
import VisibleNode from "./visibleNode";
import ColumnNode from "./columnNode";
import OutputNode from "./outputNode";
import { InvisibleNode } from "./invisibleNode";
import ColumnActionsNode from "./columnActionsNode";
export const nodeTypes: NodeTypes = {
  visibleNode: VisibleNode,
  invisibleNode: InvisibleNode,
  outputNode: OutputNode,
  columnNode: ColumnNode,
  columnActionsNode: ColumnActionsNode,
};
