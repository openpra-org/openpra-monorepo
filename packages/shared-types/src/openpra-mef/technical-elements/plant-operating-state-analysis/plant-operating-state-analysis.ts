import typia from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique } from "../meta";

export interface PlantOperatingStatesTable extends Unique {
  state_fields: unknown[];
}

export interface PlantOperatingStatesAnalysis
  extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
  states: PlantOperatingStatesTable;
}

export const PlantOperatingStatesAnalysisSchema = typia.json.application<[PlantOperatingStatesAnalysis], "3.0">();
