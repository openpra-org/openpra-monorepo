import { FactorError } from "./FactorError";

/**
 * @public Probability
 * @remarks Abstract base class for probability distributions used in fault tree analysis.
 */
export abstract class Probability {
  /**
   * @remarks Generates XML representation of the probability distribution.
   * @param printer - Function to output XML strings
   */
  abstract toXml(printer: (line: string) => void): void;

  /**
   * @remarks Generates Aralia format representation of the probability.
   * @param printer - Function to output strings
   */
  abstract toAralia(printer: (line: string) => void): void;

  /**
   * @remarks Gets the probability value or expected value.
   * @returns The probability value
   */
  abstract getValue(): number;
}

/**
  * @public PointEstimate
  * @remarks Representation of a decimal point number used for probabilities, restricted to the range (0, 1).
  */
export class PointEstimate extends Probability {
  toAralia(printer: (line: string) => void): void {
    printer(`${this.value}`);
  }
  constructor (public value: number) {
    super();
    if (value <= 0 || value >= 1) {
      throw new FactorError("PointEstimate value must be in (0, 1) range.");
    }
  }

  getValue(): number {
    return this.value;
  }

  toXml(printer: (line: string) => void): void {
    printer(`<float value="${this.value}"/>`);
  }
}

/**
 * @public LogNormal
 * @remarks Representation of a log-normal distribution used for probabilities.
 */
export class LogNormal extends Probability {
  constructor(
    private mean: number,
    private sigma: number,
    private errorFactor?: number
  ) {
    super();
    if (mean <= 0) {
      throw new FactorError("LogNormal mean must be positive.");
    }
    if (sigma <= 0) {
      throw new FactorError("LogNormal sigma must be positive.");
    }
  }

  getValue(): number {
    return this.mean;
  }

  getMean(): number {
    return this.mean;
  }

  getSigma(): number {
    return this.sigma;
  }

  getErrorFactor(): number | undefined {
    return this.errorFactor;
  }

  toXml(printer: (line: string) => void): void {
    printer('<lognoraml-deviate>');
    printer(`<mean>${this.mean}</mean>`);
    printer(`<sigma>${this.sigma}</sigma>`);
    if (this.errorFactor !== undefined) {
      printer(`<error-factor>${this.errorFactor}</error-factor>`);
    }
    printer('</lognoraml-deviate>');
  }

  toAralia(printer: (line: string) => void): void {
    if (this.errorFactor !== undefined) {
      printer(`${this.mean} ${this.errorFactor}`);
    } else {
      printer(`${this.mean} ${this.sigma}`);
    }
  }
}
