import {
  COMPONENT_TYPE_ID_PATTERN,
  COMPONENT_REFERENCE_PATTERN,
  BASIC_EVENT_REFERENCE_PATTERN,
  FAILURE_MODE_REFERENCE_PATTERN,
  parseModuleReference,
} from "./reference-types";
export const isValidComponentTypeReference = (ref: string): boolean => {
  return new RegExp(COMPONENT_TYPE_ID_PATTERN).test(ref);
};
export const isValidComponentReference = (ref: string): boolean => {
  return new RegExp(COMPONENT_REFERENCE_PATTERN).test(ref);
};
export const isValidBasicEventReference = (ref: string): boolean => {
  return new RegExp(BASIC_EVENT_REFERENCE_PATTERN).test(ref);
};
export const isValidFailureModeReference = (ref: string): boolean => {
  return new RegExp(FAILURE_MODE_REFERENCE_PATTERN).test(ref);
};
export const isValidModuleReference = (reference: string): boolean => {
  try {
    parseModuleReference(reference);
    return true;
  } catch (e) {
    return false;
  }
};
