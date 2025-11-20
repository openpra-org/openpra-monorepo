import { FactorError } from "./FactorError";
import { Probability } from "./Probability";

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
    printer('<lognormal-deviate>'); // Fixed typo
    printer(`<mean>${this.mean}</mean>`);
    printer(`<sigma>${this.sigma}</sigma>`);
    if (this.errorFactor !== undefined) {
      printer(`<error-factor>${this.errorFactor}</error-factor>`);
    }
    printer('</lognormal-deviate>');
  }

  toAralia(printer: (line: string) => void): void {
    if (this.errorFactor !== undefined) {
      printer(`${this.mean} ${this.errorFactor}`);
    } else {
      printer(`${this.mean} ${this.sigma}`);
    }
  }
}