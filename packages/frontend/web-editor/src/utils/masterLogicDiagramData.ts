// initial setup: one OR gate node and two basic events
// basic event nodes can be turned into any type by right click
import { Edge, Node } from "reactflow";
import {
  ATLEAST_TWO_CHILDREN,
  BASIC_EVENT,
  DELETE_ROOT_NODE,
  FAULT_TREE_ROOT_NODE_ID,
  OR_GATE,
  UPDATE_ROOT_NODE,
  WARNING,
  WORKFLOW,
} from "./constants";

// initial setup: connect the OR gate node to the basic event nodes with a workflow edge
export const initialNodes: Node[] = [
  {
    id: FAULT_TREE_ROOT_NODE_ID,
    data: { label: "OR Gate" },
    position: { x: 0, y: 0 },
    type: OR_GATE,
  },
  {
    id: "2",
    data: { label: "Basic Event" },
    position: { x: 0, y: 150 },
    type: BASIC_EVENT,
  },
  {
    id: "3",
    data: { label: "Basic Event" },
    position: { x: 0, y: 150 },
    type: BASIC_EVENT,
  },
];

export const initialEdges: Edge[] = [
  {
    id: "1=>2",
    source: "1",
    target: "2",
    type: WORKFLOW,
  },
  {
    id: "1=>3",
    source: "1",
    target: "3",
    type: WORKFLOW,
  },
];

export const allToasts = [
  {
    type: DELETE_ROOT_NODE,
    title: "Cannot delete root node",
    color: "warning" as const,
    iconType: WARNING,
  },
  {
    type: ATLEAST_TWO_CHILDREN,
    title: "Should have at least 2 children",
    color: "warning" as const,
    iconType: WARNING,
  },
  {
    type: UPDATE_ROOT_NODE,
    title: "Cannot update root node to this type",
    color: "warning" as const,
    iconType: WARNING,
  },
];
