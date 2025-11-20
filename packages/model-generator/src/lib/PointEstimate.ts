// PointEstimate.ts
import { PointEstimate as SharedPointEstimate } from "shared-types/src/openpra-mef/data/point-estimate";
import { Probability } from "./Probability";
import { FactorError } from "./FactorError";

/**
 * @public PointEstimate
 * @remarks Extended PointEstimate that implements Probability interface with validation.
 */
export class PointEstimate extends SharedPointEstimate implements Probability {
  constructor(value: number) {
    // Validate before calling super
    if (value <= 0 || value >= 1) {
      throw new FactorError("PointEstimate value must be in (0, 1) range.");
    }
    super(value);
  }

  getValue(): number {
    return this.value;
  }

  toAralia(printer: (line: string) => void): void {
    printer(`${this.value}`);
  }

  // If you need different XML format, override it
  toXml(printer: (line: string) => void): void {
    printer(`<float value="${this.value}"/>`);
  }
}