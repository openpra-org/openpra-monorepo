import { TypedModel } from "../schemas/typed-model.schema";

export const updateInternalHazardRequest: Partial<TypedModel> = {
    label: {
        name: 'Updated Internal Hazard Model',
        description: 'Description for Updated Internal Hazard Model'
    },
    users: [1]
}