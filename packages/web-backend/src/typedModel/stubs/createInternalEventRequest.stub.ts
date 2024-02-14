import { TypedModel } from "../schemas/typed-model.schema";

export const createInternalEventRequest: Partial<TypedModel> = {
  label: {
    name: "Internal Event Model",
    description: "Description for Internal Event Model",
  },
  users: [1, 2, 3],
};
