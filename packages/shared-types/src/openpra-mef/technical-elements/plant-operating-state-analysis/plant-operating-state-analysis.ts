import typia from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique } from "../meta";

/**
 * Interface representing a table of plant operating states, which is unique.
 *
 * @example
 * ```
 * const table: PlantOperatingStatesTable = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   state_fields: [
 *     { state: "Normal Operation", duration: 8760 }, // hours per year
 *     { state: "Shutdown", duration: 720 } // hours per year
 *   ]
 * };
 * ```
 */
export interface PlantOperatingStatesTable extends Unique {
  /**
   * An array of state fields representing different operating states of the plant.
   *
   * @example
   * ```
   * const stateFields: unknown[] = [
   *   { state: "Normal Operation", duration: 8760 },
   *   { state: "Shutdown", duration: 720 }
   * ];
   * ```
   */
  state_fields: unknown[];
}

/**
 * Interface representing an analysis of plant operating states, which is a type of technical element.
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
  states: PlantOperatingStatesTable;
}

/**
 * JSON schema for validating {@link PlantOperatingStatesAnalysis} entities.
 *
 * @example
 * ```
 * const isValid = PlantOperatingStatesAnalysisSchema.validate(someData);
 * ```
 */
export const PlantOperatingStatesAnalysisSchema = typia.json.application<[PlantOperatingStatesAnalysis], "3.0">();
