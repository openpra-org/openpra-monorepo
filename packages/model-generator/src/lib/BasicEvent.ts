import { BasicEventSchema } from "shared-types/src/openpra-mef/basic-event";
import { PointEstimateSchema } from "shared-types/src/openpra-mef/data/point-estimate";
import { throwInvalidNumberError } from "jsonc-eslint-parser/lib/parser/errors";
import { Event } from "./Event";

export class BasicEvent extends Event implements BasicEventSchema {
  protected _probability: PointEstimateSchema = 0;

  constructor(name: string, parents: Event[] = [], probability: PointEstimateSchema = 0) {
    super(name, parents); // Call the constructor of the base Event class
    this.probability = probability;
  }

  get probability(): PointEstimateSchema {
    return this._probability;
  }

  set probability(toSet) {
    if (BasicEvent.validateProbability(toSet)) {
      this._probability = toSet;
    } else {
      throwInvalidNumberError("Probability must be between 0 and 1.", { range: [0, 1] });
    }
  }
  /**
   * Validates the probability to ensure it is between 0 and 1.
   */
  protected static validateProbability(toValidate: PointEstimateSchema): boolean {
    return toValidate >= 0 && toValidate <= 1;
  }
}
