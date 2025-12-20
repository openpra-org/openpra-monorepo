/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Configuration for different PRA model types (e.g., random failures, seismic, fire).
 * @remarks Required for SAPHIRE model type differentiation (MTD format)
 * @group PRA Model Types
 */

/**
 * Represents a specific PRA model type
 * @memberof technical_elements.core
 * @group PRA Model Types
 */
export interface ModelType {
  /**
   * Numerical identifier for the model type.
   */
  num: number;

  /**
   * Name of the model type.
   */
  name: string;

  /**
   * Suffix associated with this model type (used in SAPHIRE).
   */
  suffix?: string;

  /**
   * Colour code for visualization (integer representation, (used in SAPHIRE))
   */
  color?: number;

  /**
   * Detailed description of the model type.
   */
  description: string;
}

/**
 * Default model types supported in OpenPRA
 * @memberof technical_elements.core
 * @group PRA Model Types
 */
export const defaultModelTypes: ModelType[] = [
  {
    num: 1,
    name: 'Random Failures',
    suffix: 'RF',
    description:
      'Model considering only random hardware failures and human errors during normal operation.',
  },
  {
    num: 2,
    name: 'Seismic Events',
    suffix: 'SE',
    description:
      'Model focused on initiating events and failures caused by seismic activity.',
  },
  {
    num: 3,
    name: 'Internal Fire',
    suffix: 'IF',
    description:
      'Model addressing initiating events and failures resulting from internal fire events.',
  },
  {
    num: 4,
    name: 'Internal Flood',
    suffix: 'FL',
    description:
      'Model addressing initiating events and failures resulting from internal flooding events.',
  },
  {
    num: 5,
    name: 'High Winds',
    suffix: 'HW',
    description:
      'Model addressing initiating events and failures caused by high wind events.',
  },
  {
    num: 6,
    name: 'External Flooding',
    suffix: 'XF',
    description:
      'Model addressing initiating events and failures caused by external flooding events.',
  },
  {
    num: 7,
    name: 'Other Hazards',
    suffix: 'OH',
    description:
      'Model addressing initiating events and failures caused by other hazards not explicitly listed.',
  },
];

/**
 * Retrieves a model type by its identifier
 * @param id The numerical identifier of the model type
 * @returns The matching model type or undefined if not found
 * @memberof technical_elements.core
 * @hidden
 */
export function getModelTypeById(id: number): ModelType | undefined {
  return defaultModelTypes.find((model) => model.num === id);
}

/**
 * Retrieves a model type by its suffix
 * @param suffix The suffix of the model type
 * @returns The matching model type or undefined if not found
 * @memberof technical_elements.core
 * @hidden
 */
export function getModelTypeBySuffix(suffix: string): ModelType | undefined {
  return defaultModelTypes.find((model) => model.suffix === suffix);
}
