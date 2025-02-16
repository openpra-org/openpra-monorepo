import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique } from "../meta";

/**
 * Interface representing a single plant operating state entry
 * 
 * @example
 * ```
 * const entry: StateField = {
 *   state: "Maintenance",
 *   duration: 240 // hours
 * };
 * ```
 */
export interface StateField {
  /** 
   * The name/identifier of the operating state
   * @pattern ^[A-Za-z ]+$  // Enforces alphabetical characters and spaces
   */
  state: string;

  /**
   * Duration in hours for this state
   * @minimum 0  // Ensures non-negative values
   * @maximum 8760  // Max 1 year
   */
  duration: number & tags.Minimum<0> & tags.Maximum<8760>;
}

/**
 * Interface representing a table of plant operating states, which is unique.
 * Improved type safety for state_fields using StateField interface.
 * 
 * @interface
 * @extends {Unique}
 * 
 * @example
 * ```
 * const table: PlantOperatingStatesTable = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   state_fields: [
 *     { state: "Normal Operation", duration: 8760 },
 *     { state: "Shutdown", duration: 720 }
 *   ]
 * };
 * ```
 */
export interface PlantOperatingStatesTable extends Unique {
  /**
   * Array of validated state entries.
   * Each state name must be unique within the array.
   * @minItems 1  // Requires at least one state entry
   * @uniqueItems true  // Ensures no duplicate state entries
   */
  state_fields: StateField[];
}

/**
 * Interface representing an analysis of plant operating states with strict typing.
 * Now uses properly typed PlantOperatingStatesTable for states property.
 * 
 * @interface
 * @extends {TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS>}
 * 
 * @example
 * ```
 * const analysis: PlantOperatingStatesAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
 *   states: {
 *     uuid: "123e4567-e89b-12d3-a456-426614174000",
 *     state_fields: [
 *       { state: "Normal Operation", duration: 8760 },
 *       { state: "Shutdown", duration: 720 }
 *     ]
 *   }
 * };
 * ```
 */
export interface PlantOperatingStatesAnalysis
  extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
  /** Validated operating states container */
  states: PlantOperatingStatesTable;
}

/**
 * JSON schema for validating {@link PlantOperatingStatesAnalysis} entities.
 * Now includes validation for nested StateField structure through type inheritance.
 * 
 * @example
 * ```
 * const isValid = PlantOperatingStatesAnalysisSchema.validate(someData);
 * ```
 */
export const PlantOperatingStatesAnalysisSchema = typia.json.application<[PlantOperatingStatesAnalysis], "3.0">(); 