import { TypedModel } from "../schemas/typed-model.schema";

export const createFullScopeRequest: Partial<TypedModel> = {
  label: {
    name: "Full Scope Model",
    description: "Description for Full Scope Model",
  },
  users: [1, 2, 3],
};
