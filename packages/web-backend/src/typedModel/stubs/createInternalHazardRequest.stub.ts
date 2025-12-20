import { TypedModel } from '../schemas/typed-model.schema';

/**
 * Test stub payload for creating an Internal Hazards typed model.
 * Used in examples and unit tests.
 */
export const createInternalHazardRequest: Partial<TypedModel> = {
  label: {
    name: 'Internal Hazard Model',
    description: 'Description for Internal Hazard Model',
  },
  users: [1, 2, 3],
};
