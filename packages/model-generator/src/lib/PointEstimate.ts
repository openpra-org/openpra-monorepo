// PointEstimate.ts
import { Probability } from "./Probability";
import { FactorError } from "./FactorError";

/**
 * @public PointEstimate
 * @remarks PointEstimate class that implements Probability interface with validation.
 * Compatible with the shared PointEstimate type definition.
 */
export class PointEstimate implements Probability {
  value: number;

  constructor(value: number) {
    // Validate the value
    if (value <= 0 || value >= 1) {
      throw new FactorError("PointEstimate value must be in (0, 1) range.");
    }
    this.value = value;
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