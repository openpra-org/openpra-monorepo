import { TypedModel } from "../schemas/typed-model.schema";

/**
 * Test stub payload for creating a Full Scope typed model.
 * Used in examples and unit tests.
 */
export const createFullScopeRequest: Partial<TypedModel> = {
  label: {
    name: "Full Scope Model",
    description: "Description for Full Scope Model",
  },
  users: [1, 2, 3],
};
