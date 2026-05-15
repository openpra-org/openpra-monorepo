import { Unique, Named, Versioned } from "./meta";
import { isValidComponentReference } from "./validators";
export const COMPONENT_ID_PATTERN = "^SYS-[A-Z0-9-]+/CMP-[A-Za-z0-9_-]+/FM-[A-Za-z0-9_-]+$";
export const COMPONENT_TYPE_ID_PATTERN = "^CMPTYPE-[A-Za-z0-9_-]+$";
export type ComponentReference = string;
export type ComponentTypeReference = string;
export interface Component extends Unique, Named {
  description?: string;
  type: string;
  systemId: string;
}
export interface ComponentRegistry extends Unique {
  components: Record<ComponentReference, Component>;
  description?: string;
  version: string;
  lastUpdated: string;
}
export interface ComponentType extends Unique, Named, Versioned {
  description?: string;
  category: string;
  commonCharacteristics: Record<string, any>;
}
export const ComponentUtils = {
  generateComponentId: (): ComponentReference => {
    return `CMP-${Math.random().toString(36).substring(2, 10).toUpperCase()}` as ComponentReference;
  },
  validateComponentId: (id: string): boolean => {
    return isValidComponentReference(id);
  },
};
