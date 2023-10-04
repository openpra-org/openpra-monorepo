import { TypedModel } from "../schemas/typed-model.schema";

export const updateExternalHazardRequest: Partial<TypedModel> = {
    label: {
        name: 'Updated External Hazard Model',
        description: 'Description for Updated External Hazard Model'
    },
    users: [1]
}