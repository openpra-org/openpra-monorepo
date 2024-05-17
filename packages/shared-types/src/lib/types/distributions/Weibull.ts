import AbstractDistribution, { DistributionSummary } from "./AbstractDistribution";

const linspace = require("linspace");

/**
 * Referenced from {@link https://en.wikipedia.org/wiki/Weibull_distribution}
 */
class Weibull extends AbstractDistribution {
  private scale: number;
  private shape: number;

  constructor() {
    super();
    this.scale = 1;
    this.shape = 1;
  }

  /**
   * @return {number}
   */
  getScale(): number {
    return this.scale;
  }

  /**
   * @param {number} scale
   */
  setScale(scale: number): void {
    this.scale = scale;
  }

  /**
   * @return {number}
   */
  getShape(): number {
    return this.shape;
  }

  /**
   * @param shape
   * @throws Error if shape is not a positive number
   */
  setShape(shape: number) {
    if (shape < 0) throw new TypeError("lambda()::invalid input argument. Shape parameter must be a positive number.");
    this.shape = shape;
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  quantile(): (x: number) => number {
    return (x: number) => (0 <= x && x <= 1 ? this.scale * Math.pow(-Math.log(1 - x), 1 / this.shape) : NaN);
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  pdf(): (x: number) => number {
    return (x: number) => {
      if (x >= 0) {
        const A = this.shape / this.scale;
        const B = x / this.scale;
        return A * Math.pow(B, this.shape - 1) * Math.exp(-Math.pow(B, this.shape));
      } else {
        return 0;
      }
    };
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  cdf(): (x: number) => number {
    return (x: number) => {
      if (x >= 0) {
        const A = x / this.scale;
        return 1 - Math.exp(-Math.pow(A, this.shape));
      } else {
        return 0;
      }
    };
  }

  /**
   * @param {number} n
   * @return {DistributionSummary}
   */
  getSummary(n = 100): DistributionSummary {
    const [lowX, highX] = this.getInverse([0.0001, 0.9999]);
    const x = linspace(lowX, highX, n).filter((i: number) => i >= 0);
    return {
      x,
      pdf: this.getPDFs(x),
      cdf: this.getCDFs(x),
    };
  }
}

export default Weibull;
