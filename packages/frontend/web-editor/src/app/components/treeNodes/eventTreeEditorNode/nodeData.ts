import { Node, Position } from "reactflow";

const xDistance = 100;
const yDistance = 60;
const pos = { x: 0, y: 0 };

export const nodeData: Node[] = [
  {
    id: "horizontal-1",
    sourcePosition: Position.Right,
    type: "hiddenNode",
    data: { label: "Input" },
    position: pos,
  },
  {
    id: "horizontal-2-a",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: pos,
  },
  {
    id: "horizontal-2-b",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "b Node" },
    position: pos,
  },
  {
    id: "horizontal-3-a",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "c Node" },
    position: pos,
  },
  {
    id: "horizontal-3-b",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "d Node" },
    position: pos,
  },
  {
    id: "horizontal-4-a",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "e Node" },
    position: pos,
  },
  {
    id: "horizontal-4-b",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "f Node" },
    position: pos,
  },
];

export const colData: Node[] = [
  {
    id: "vertical-1",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    position: pos,
  },
  {
    id: "vertical-1-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    position: pos,
  },
  {
    id: "vertical-2",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    width: xDistance / 4,
    position: pos,
  },
  {
    id: "vertical-2-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    width: xDistance / 4,
    position: pos,
  },
  {
    id: "vertical-3",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    width: xDistance / 4,
    position: pos,
  },
  {
    id: "vertical-3-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    width: xDistance / 4,
    position: pos,
  },
  {
    id: "vertical-4",
    type: "columnNode",
    data: { label: "Input", width: xDistance },
    width: xDistance / 4,
    position: pos,
  },
  {
    id: "vertical-4-connect",
    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    width: xDistance / 4,
    position: pos,
  },
];
