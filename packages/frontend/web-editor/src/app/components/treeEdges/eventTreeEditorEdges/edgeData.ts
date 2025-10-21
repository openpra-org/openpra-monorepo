import { Edge } from "reactflow";
export const edgeData: Edge[] = [
  {
    id: "horizontal-1-2a",
    source: "horizontal-1",
    type: "custom",
    target: "horizontal-2-a",
    animated: false,
  },
  {
    id: "horizontal-1-2b",
    source: "horizontal-1",
    type: "custom",
    target: "horizontal-2-b",
    animated: false,
  },

  {
    id: "horizontal-2a-3a",
    source: "horizontal-2-a",
    type: "custom",
    target: "horizontal-3-a",
    animated: false,
  },
  {
    id: "horizontal-2a-4c",
    source: "horizontal-2-a",
    type: "custom",
    target: "horizontal-4-c",
    animated: false,
  },
  {
    id: "horizontal-4c-3b",
    source: "horizontal-4-c",
    type: "custom",
    target: "horizontal-3-b",
    animated: false,
  },
  {
    id: "horizontal-e3a-4a",
    source: "horizontal-3-a",
    type: "custom",
    target: "horizontal-4-a",
    animated: false,
  },
  {
    id: "horizontal-e3a-4b",
    source: "horizontal-3-a",
    type: "custom",
    target: "horizontal-4-b",
    animated: false,
  },

  {
    id: "vertical-e1-2",
    source: "vertical-1",
    hidden: true,
    type: "custom",
    target: "vertical-2",
    animated: false,
  },
  {
    id: "vertical-e2-3",
    source: "vertical-2",
    hidden: true,
    type: "custom",

    target: "vertical-3",
    animated: false,
  },
  {
    id: "vertical-e3-4",
    source: "vertical-3",
    hidden: true,
    type: "custom",
    target: "vertical-4",
    animated: false,
  },
];
