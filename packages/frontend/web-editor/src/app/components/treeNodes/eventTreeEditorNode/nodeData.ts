import { Node, Position } from 'reactflow';

const xDistance = 140;
const pos = { x: 0, y: 0 };

/**
 * Example node definitions used by the Event Tree editor demo.
 *
 * These nodes are rendered to showcase custom node/edge components and layout.
 */
export const nodeData: Node[] = [
  {
    id: 'horizontal-1',
    sourcePosition: Position.Right,
    type: 'hiddenNode',
    data: { label: 'Input', width: xDistance, input: true },
    position: pos,
  },
  {
    id: 'horizontal-2-a',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: 'hiddenNode',
    data: { label: 'A Node', width: xDistance },
    position: pos,
  },
  {
    id: 'horizontal-2-b',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: 'hiddenNode',
    data: { label: 'b Node', width: xDistance, output: true },
    position: pos,
  },

  {
    id: 'horizontal-3-a',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: 'hiddenNode',
    data: { label: 'c Node', width: xDistance },
    position: pos,
  },
  {
    id: 'horizontal-3-b',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: 'hiddenNode',
    data: { label: 'd Node', width: xDistance, output: true },

    position: pos,
  },
  {
    id: 'horizontal-4-a',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: 'hiddenNode',
    data: { label: 'e Node', width: xDistance, output: true },
    position: pos,
  },
  {
    id: 'horizontal-4-b',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: 'hiddenNode',
    data: { label: 'f Node', width: xDistance, output: true },
    position: pos,
  },
  {
    id: 'horizontal-4-c',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    type: 'hiddenNode',
    data: { label: 'c Node', width: xDistance },
    position: pos,
  },
  {
    id: 'vertical-1',

    type: 'columnNode',
    data: { label: 'Input', width: xDistance },

    position: pos,
  },

  {
    id: 'vertical-2',

    type: 'columnNode',
    data: { label: 'Input', width: xDistance },

    position: pos,
  },

  {
    id: 'vertical-3',

    type: 'columnNode',
    data: { label: 'Input', width: xDistance },

    position: pos,
  },

  {
    id: 'vertical-4',
    type: 'columnNode',
    data: { label: 'Input', width: xDistance },

    position: pos,
  },
];
