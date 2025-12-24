import { EdgeTypes } from 'reactflow';
import CustomEdge from './customEdge';

/**
 * Edge type mapping for the Event Tree editor.
 *
 * Registers the custom edge component under the "custom" type key.
 */
const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

export default edgeTypes;
