import { Node, Position } from "reactflow";

const xDistance = 100;
const yDistance = 60;
export const nodeData: Node[] = [
  {
    id: "vertical-1",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    position: { x: xDistance / 2, y: -200 },
  },
  {
    id: "vertical-1-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    position: { x: xDistance / 2, y: 200 },
  },
  {
    id: "vertical-2",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    width: xDistance / 4,
    position: { x: (3 / 2) * xDistance, y: -200 },
  },
  {
    id: "vertical-2-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    width: xDistance / 4,
    position: { x: (3 / 2) * xDistance, y: 200 },
  },
  {
    id: "vertical-3",

    type: "columnNode",
    data: { label: "Input", width: xDistance },
    width: xDistance / 4,
    position: { x: (5 / 2) * xDistance, y: -200 },
  },
  {
    id: "vertical-3-connect",

    type: "columnNode",
    data: { label: "Input", width: xDistance, hideText: true },
    width: xDistance / 4,
    position: { x: (5 / 2) * xDistance, y: 200 },
  },
  {
    id: "horizontal-1",
    sourcePosition: Position.Right,
    type: "hiddenNode",
    data: { label: "Input" },
    position: { x: 0, y: 0 },
  },
  {
    id: "horizontal-2",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: xDistance, y: -yDistance },
  },
  {
    id: "horizontal-3",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: xDistance, y: yDistance },
  },
  {
    id: "horizontal-4",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: 2 * xDistance, y: (-3 / 2) * yDistance },
  },
  {
    id: "horizontal-5",
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: "hiddenNode",
    data: { label: "A Node" },
    position: { x: 2 * xDistance, y: -yDistance / 2 },
  },
];
