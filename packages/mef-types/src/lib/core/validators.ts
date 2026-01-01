import {
  COMPONENT_TYPE_ID_PATTERN,
  COMPONENT_REFERENCE_PATTERN,
  BASIC_EVENT_REFERENCE_PATTERN,
  FAILURE_MODE_REFERENCE_PATTERN,
  parseModuleReference,
} from "./reference-types";

/**
 * Validates if a string matches the component type reference pattern
 * @param ref - The string to validate
 * @returns boolean indicating if the string is a valid component type reference
 */
export const isValidComponentTypeReference = (ref: string): boolean => {
  return new RegExp(COMPONENT_TYPE_ID_PATTERN).test(ref);
};

/**
 * Validates if a string matches the component reference pattern
 * @param ref - The string to validate
 * @returns boolean indicating if the string is a valid component reference
 */
export const isValidComponentReference = (ref: string): boolean => {
  return new RegExp(COMPONENT_REFERENCE_PATTERN).test(ref);
};

/**
 * Validates if a string matches the basic event reference pattern
 * @param ref - The string to validate
 * @returns boolean indicating if the string is a valid basic event reference
 */
export const isValidBasicEventReference = (ref: string): boolean => {
  return new RegExp(BASIC_EVENT_REFERENCE_PATTERN).test(ref);
};

/**
 * Validates if a string matches the failure mode reference pattern
 * @param ref - The string to validate
 * @returns boolean indicating if the string is a valid failure mode reference
 */
export const isValidFailureModeReference = (ref: string): boolean => {
  return new RegExp(FAILURE_MODE_REFERENCE_PATTERN).test(ref);
};

/**
 * Validates if a string matches the module reference format (namespace:entityType:id)
 * @param reference - The string to validate
 * @returns boolean indicating if the string is a valid module reference
 */
export const isValidModuleReference = (reference: string): boolean => {
  try {
    parseModuleReference(reference);
    return true;
  } catch (e) {
    return false;
  }
};
