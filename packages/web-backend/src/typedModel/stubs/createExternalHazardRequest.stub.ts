import { TypedModel } from "../schemas/typed-model.schema";

export const createExternalHazardRequest: Partial<TypedModel> = {
  label: {
    name: "External Hazard Model",
    description: "Description for External Hazard Model",
  },
  users: [1],
};
