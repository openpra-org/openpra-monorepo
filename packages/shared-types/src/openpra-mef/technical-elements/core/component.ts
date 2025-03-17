/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Core component types and interfaces
 */
import typia, { tags } from "typia";
import { Unique, Named } from "./meta";

/**
 * Standard pattern for component IDs
 * @memberof technical_elements.core
 * @group Component
 */
export const COMPONENT_ID_PATTERN = "^CMP-[A-Za-z0-9_-]+$";

/**
 * Type representing a component reference
 * @memberof technical_elements.core
 * @group Component
 */
export type ComponentReference = string & tags.Pattern<typeof COMPONENT_ID_PATTERN>;

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
 */
export const validateComponent = typia.createValidate<Component>();

/**
 * Type guard for components
 * @memberof technical_elements.core
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
 * Utility functions for components
 * @memberof technical_elements.core
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
     */
    validateComponentId: (id: string): boolean => {
        return new RegExp(COMPONENT_ID_PATTERN).test(id);
    }
}; 