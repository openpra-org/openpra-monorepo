import { TypedModel } from "../schemas/typed-model.schema";

export const updateInternalEventRequest: Partial<TypedModel> = {
  label: {
    name: "Updated Internal Event Model",
    description: "Description for Updated Internal Event Model",
  },
  users: [1],
};
