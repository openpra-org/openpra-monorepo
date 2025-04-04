import { tags } from "typia";

// Pattern constants for validation
export const COMPONENT_TYPE_ID_PATTERN = "^CMPTYPE-[A-Za-z0-9_-]+$";
export const COMPONENT_REFERENCE_PATTERN = "^CMP-[A-Za-z0-9_-]+$";
export const BASIC_EVENT_REFERENCE_PATTERN = "^EVT-[A-Za-z0-9_-]+$";
export const FAILURE_MODE_REFERENCE_PATTERN = "^FM-[A-Za-z0-9_-]+$";

// Type definitions with pattern validation
export type ComponentTypeReference = string & tags.Pattern<typeof COMPONENT_TYPE_ID_PATTERN>;
export type ComponentReference = string & tags.Pattern<typeof COMPONENT_REFERENCE_PATTERN>;
export type BasicEventReference = string & tags.Pattern<typeof BASIC_EVENT_REFERENCE_PATTERN>;
export type FailureModeReference = string & tags.Pattern<typeof FAILURE_MODE_REFERENCE_PATTERN>;

// Cross-module reference patterns
export const createModuleReference = (
  namespace: string,
  entityType: string,
  id: string
): string => `${namespace}:${entityType}:${id}`;

export const parseModuleReference = (
  reference: string
): { namespace: string; entityType: string; id: string } => {
  const parts = reference.split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid reference format: ${reference}`);
  }
  return {
    namespace: parts[0],
    entityType: parts[1],
    id: parts[2]
  };
};

/**
 * Create a reference to a basic event in the data-analysis module
 * @param id ID of the basic event
 * @returns A formatted cross-module reference string
 */
export const createBasicEventReference = (id: string): string => 
  createModuleReference('data', 'basic-event', id);

/**
 * Create a reference to a component in the systems-analysis module
 * @param id ID of the component
 * @returns A formatted cross-module reference string
 */
export const createComponentReference = (id: string): string =>
  createModuleReference('systems', 'component', id);

/**
 * Create a reference to a failure mode in the systems-analysis module
 * @param id ID of the failure mode
 * @returns A formatted cross-module reference string
 */
export const createFailureModeReference = (id: string): string =>
  createModuleReference('systems', 'failure-mode', id);