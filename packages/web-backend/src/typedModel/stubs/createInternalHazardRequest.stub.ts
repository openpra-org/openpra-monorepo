import { TypedModel } from "../schemas/typed-model.schema";

export const createInternalHazardRequest: Partial<TypedModel> = {
  label: {
    name: "Internal Hazard Model",
    description: "Description for Internal Hazard Model",
  },
  users: [1,2,3],
};
