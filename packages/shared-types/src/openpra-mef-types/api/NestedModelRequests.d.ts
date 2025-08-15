import { NESTED_MODEL_NAMES } from "./Constants";

export type NestedModelName = (typeof NESTED_MODEL_NAMES)[keyof typeof NESTED_MODEL_NAMES];
