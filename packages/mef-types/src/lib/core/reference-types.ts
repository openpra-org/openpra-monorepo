export const COMPONENT_TYPE_ID_PATTERN = "^CMPTYPE-[A-Za-z0-9_-]+$";
export const COMPONENT_REFERENCE_PATTERN = "^CMP-[A-Za-z0-9_-]+$";
export const BASIC_EVENT_REFERENCE_PATTERN = "^EVT-[A-Za-z0-9_-]+$";
export const FAILURE_MODE_REFERENCE_PATTERN = "^FM-[A-Za-z0-9_-]+$";
export type ComponentTypeReference = string;
export type ComponentReference = string;
export type BasicEventReference = string;
export type FailureModeReference = string;
export const createModuleReference = (namespace: string, entityType: string, id: string): string =>
  `${namespace}:${entityType}:${id}`;
export const parseModuleReference = (
  reference: string,
): {
  namespace: string;
  entityType: string;
  id: string;
} => {
  const parts = reference.split(":");
  if (parts.length !== 3) {
    throw new Error(`Invalid reference format: ${reference}`);
  }
  return {
    namespace: parts[0],
    entityType: parts[1],
    id: parts[2],
  };
};
export const createBasicEventReference = (id: string): string => createModuleReference("data", "basic-event", id);
export const createComponentReference = (id: string): string => createModuleReference("systems", "component", id);
export const createFailureModeReference = (id: string): string => createModuleReference("systems", "failure-mode", id);
