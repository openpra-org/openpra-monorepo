import { NodeTypes } from "reactflow";
import VisibleNode from "./visibleNode";
import ColumnNode from "./columnNode";
import OutputNode from "./outputNode";
import { InvisibleNode } from "./invisibleNode";

/**
 * Node type mapping for the Event Tree editor.
 *
 * Associates editor node component implementations with their type keys.
 */
export const nodeTypes: NodeTypes = {
  visibleNode: VisibleNode,
  invisibleNode: InvisibleNode,
  outputNode: OutputNode,
  columnNode: ColumnNode,
};
