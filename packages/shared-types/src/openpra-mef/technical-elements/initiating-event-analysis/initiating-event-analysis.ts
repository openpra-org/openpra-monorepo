import typia, { tags } from "typia";

import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../meta";

export interface InitiatingEvent extends Unique, Named {
  /**
   * The frequency definition here is incomplete because it does not specify a period.
   */
  frequency: number & tags.Minimum<0>;
}

export interface InitiatingEventsAnalysis extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
  initiating_events: InitiatingEvent[];
}

export const InitiatingEventsAnalysisSchema = typia.json.application<[InitiatingEventsAnalysis], "3.0">();
