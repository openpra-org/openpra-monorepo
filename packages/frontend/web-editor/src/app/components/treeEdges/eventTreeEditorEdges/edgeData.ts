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
    id: "vertical-l1-connect",
    source: "vertical-1",
    sourceHandle: "a",
    type: "custom",
    target: "vertical-1-connect",
    targetHandle: "a",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-r1-connect",
    source: "vertical-1",
    sourceHandle: "b",
    type: "custom",
    target: "vertical-1-connect",
    targetHandle: "b",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-l2-connect",
    source: "vertical-2",
    sourceHandle: "a",
    type: "custom",
    target: "vertical-2-connect",
    targetHandle: "a",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-r2-connect",
    source: "vertical-2",
    sourceHandle: "b",
    type: "custom",
    target: "vertical-2-connect",
    targetHandle: "b",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-l3-connect",
    source: "vertical-3",
    sourceHandle: "a",
    type: "custom",
    target: "vertical-3-connect",
    targetHandle: "a",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-r3-connect",
    source: "vertical-3",
    sourceHandle: "b",
    type: "custom",
    target: "vertical-3-connect",
    targetHandle: "b",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-l4-connect",
    source: "vertical-4",
    sourceHandle: "a",
    type: "custom",
    target: "vertical-4-connect",
    targetHandle: "a",
    data: { straight: true, color: "grey" },
    animated: false,
  },
  {
    id: "vertical-r4-connect",
    source: "vertical-4",
    sourceHandle: "b",
    type: "custom",
    target: "vertical-4-connect",
    targetHandle: "b",
    data: { straight: true, color: "grey" },
    animated: false,
  },
];
