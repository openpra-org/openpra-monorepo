import { Unique, Named, Versioned } from "./meta";

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
  commonCharacteristics: Record<string, unknown>;
}
