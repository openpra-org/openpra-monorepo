/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Core component types and interfaces
 */
import { Unique, Named, Versioned } from "./meta";
import { isValidComponentReference } from "./validators";

/**
 * Standard pattern for component IDs
 * @memberof technical_elements.core
 * @group Component
 */
export const COMPONENT_ID_PATTERN = "^SYS-[A-Z0-9-]+/CMP-[A-Za-z0-9_-]+/FM-[A-Za-z0-9_-]+$";

/**
 * Standard pattern for component type IDs
 * @memberof technical_elements.core
 * @group Component
 */
export const COMPONENT_TYPE_ID_PATTERN = "^CMPTYPE-[A-Za-z0-9_-]+$";

/**
 * Type representing a component reference
 * @memberof technical_elements.core
 * @group Component
 */
export type ComponentReference = string;

/**
 * Type representing a component type reference
 * @memberof technical_elements.core
 * @group Component
 */
export type ComponentTypeReference = string;

/**
 * Base interface for components
 * @memberof technical_elements.core
 * @extends {Unique}
 * @extends {Named}
 * @group Component
 */
export interface Component extends Unique, Named {
  /** Description of the component */
  description?: string;

  /** Type of component */
  type: string;

  /** System this component belongs to */
  systemId: string;
}

/**
 * JSON schema for validating {@link ComponentReference}.
 * @memberof technical_elements.core
 * @group Component
 */

/**
 * Runtime validation for components
 * @memberof technical_elements.core
 * @hidden
 */

/**
 * Type guard for components
 * @memberof technical_elements.core
 * @hidden
 */

/**
 * Interface representing a component registry
 * @memberof technical_elements.core
 * @extends {Unique}
 * @group Component
 */
export interface ComponentRegistry extends Unique {
  /** Map of component IDs to components */
  components: Record<ComponentReference, Component>;

  /** Description of this registry */
  description?: string;

  /** Version of this registry */
  version: string;

  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Interface for component types
 * @memberof technical_elements.core
 * @extends {Unique}
 * @extends {Named}
 * @extends {Versioned}
 * @group Component
 */
export interface ComponentType extends Unique, Named, Versioned {
  /** Description of the component type */
  description?: string;
  /** Category of the component type */
  category: string;
  /** Common characteristics of this component type */
  commonCharacteristics: Record<string, any>;
}

/**
 * JSON schema for validating {@link ComponentTypeReference}.
 * @memberof technical_elements.core
 * @group Component
 */

/**
 * Runtime validation for component types
 * @memberof technical_elements.core
 * @hidden
 */

/**
 * Type guard for component types
 * @memberof technical_elements.core
 * @hidden
 */

/**
 * Utility functions for components
 * @memberof technical_elements.core
 * @hidden
 */
export const ComponentUtils = {
  /**
   * Generates a new component ID
   */
  generateComponentId: (): ComponentReference => {
    return `CMP-${Math.random().toString(36).substring(2, 10).toUpperCase()}` as ComponentReference;
  },

  /**
   * Validates a component ID
   * @memberof technical_elements.core
   * @hidden
   */
  validateComponentId: (id: string): boolean => {
    return isValidComponentReference(id);
  },
};
