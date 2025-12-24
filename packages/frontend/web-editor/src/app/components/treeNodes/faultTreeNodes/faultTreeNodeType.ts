import { NodeTypes } from 'reactflow';
import { FaultTreeNode } from './faultTreeNode';

/**
 * Optional UI flags stored on Fault Tree nodes during editing.
 */
export type FaultTreeNodeProps =
  | {
      isGrayed?: boolean | undefined;
      branchId?: string | undefined;
    }
  | undefined;

/**
 * Registered React Flow node types used by the Fault Tree editor.
 */
const FaultTreeNodeTypes: NodeTypes = {
  orGate: FaultTreeNode('orGate'),
  andGate: FaultTreeNode('andGate'),
  notGate: FaultTreeNode('notGate'),
  atLeastGate: FaultTreeNode('atLeastGate'),
  basicEvent: FaultTreeNode('basicEvent'),
  houseEvent: FaultTreeNode('houseEvent'),
  transferGate: FaultTreeNode('transferGate'),
};

export { FaultTreeNodeTypes };
