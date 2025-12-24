import { WorkFlowEdge } from './workFlowEdge';

/**
 * Edge type mapping for the Fault Tree editor.
 *
 * Registers the workflow edge implementation under the "workflow" type key.
 */
const EdgeTypes = {
  workflow: WorkFlowEdge,
};

export { EdgeTypes };
