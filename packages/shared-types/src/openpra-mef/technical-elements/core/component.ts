/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Core component types and interfaces
 */
import typia, { tags } from "typia";
import { Unique, Named, Versioned } from "./meta";
import { isValidComponentReference } from "./validators";

/**
 * Standard pattern for component IDs
 * @memberof technical_elements.core
 * @group Component
 */
export const COMPONENT_ID_PATTERN = "^CMP-[A-Za-z0-9_-]+$";

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
export type ComponentReference = string & tags.Pattern<typeof COMPONENT_ID_PATTERN>;

/**
 * Type representing a component type reference
 * @memberof technical_elements.core
 * @group Component
 */
export type ComponentTypeReference = string & tags.Pattern<typeof COMPONENT_TYPE_ID_PATTERN>;

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
export const ComponentReferenceSchema = typia.json.application<[ComponentReference], "3.0">();

/**
 * Runtime validation for components
 * @memberof technical_elements.core
 * @hidden
 */
export const validateComponent = typia.createValidate<Component>();

/**
 * Type guard for components
 * @memberof technical_elements.core
 * @hidden
 */
export const isComponent = typia.createIs<Component>();

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
export const ComponentTypeReferenceSchema = typia.json.application<[ComponentTypeReference], "3.0">();

/**
 * Runtime validation for component types
 * @memberof technical_elements.core
 * @hidden
 */
export const validateComponentType = typia.createValidate<ComponentType>();

/**
 * Type guard for component types
 * @memberof technical_elements.core
 * @hidden
 */
export const isComponentType = typia.createIs<ComponentType>();

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
    }
}; 