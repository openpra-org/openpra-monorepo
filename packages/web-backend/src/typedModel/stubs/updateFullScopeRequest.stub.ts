import { TypedModel } from "../schemas/typed-model.schema";

export const updateFullScopeRequest: Partial<TypedModel> = {
  label: {
    name: "Updated Full Scope Model",
    description: "Description for Updated Full Scope Model",
  },
  users: [1],
};
