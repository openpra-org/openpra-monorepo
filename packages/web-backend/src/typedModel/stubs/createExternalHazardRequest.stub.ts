import { TypedModel } from '../schemas/typed-model.schema';

/**
 * Test stub payload for creating an External Hazards typed model.
 * Used in examples and unit tests.
 */
export const createExternalHazardRequest: Partial<TypedModel> = {
  label: {
    name: 'External Hazard Model',
    description: 'Description for External Hazard Model',
  },
  users: [1, 2, 3],
};
