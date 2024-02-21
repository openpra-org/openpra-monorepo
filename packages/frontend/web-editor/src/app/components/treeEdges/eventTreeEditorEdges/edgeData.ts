import { Edge } from "reactflow";

export const edgeData: Edge[] = [
  {
    id: "horizontal-e1-2",
    source: "horizontal-1",
    type: "custom",
    target: "horizontal-2-a",
    animated: false,
  },
  {
    id: "horizontal-e1-3",
    source: "horizontal-1",
    type: "custom",
    target: "horizontal-2-b",
    animated: false,
  },
  {
    id: "horizontal-e2-4",
    source: "horizontal-2-a",
    type: "custom",
    target: "horizontal-3-a",
    animated: false,
  },
  {
    id: "horizontal-e2-5",
    source: "horizontal-2-a",
    type: "custom",
    target: "horizontal-3-b",
    animated: false,
  },
  {
    id: "horizontal-e4-6",
    source: "horizontal-3-a",
    type: "custom",
    target: "horizontal-4-a",
    animated: false,
  },
  {
    id: "horizontal-e4-7",
    source: "horizontal-3-a",
    type: "custom",
    target: "horizontal-4-b",
    animated: false,
  },
  {
    id: "vertical-e1",
    source: "vertical-1",
    type: "custom",
    target: "vertical-2",
    animated: false,
  },
  {
    id: "vertical-e2",
    source: "vertical-2",
    type: "custom",
    target: "vertical-3",
    animated: false,
  },
  {
    id: "vertical-e3",
    source: "vertical-3",
    type: "custom",
    target: "vertical-4",
    animated: false,
  },
];
