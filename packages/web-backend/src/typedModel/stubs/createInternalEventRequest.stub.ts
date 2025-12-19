import { TypedModel } from "../schemas/typed-model.schema";

/**
 * Test stub payload for creating an Internal Events typed model.
 * Used in examples and unit tests.
 */
export const createInternalEventRequest: Partial<TypedModel> = {
  label: {
    name: "Internal Event Model",
    description: "Description for Internal Event Model",
  },
  users: [1, 2, 3],
};
