import AbstractDistribution, {
  DistributionSummary,
} from "./AbstractDistribution";
const linspace = require("linspace");

/**
 * Referenced from {@link http://mathworld.wolfram.com/UniformDistribution.html}
 */
class Uniform extends AbstractDistribution {
  private max: number;
  private min: number;

  constructor() {
    super();
    this.max = 1;
    this.min = 0;
  }

  /**
   * @override
   * @return {number}
   */
  getMax() {
    return this.max;
  }

  /**
   * @param {number} max
   */
  setMax(max: number): void {
    this.max = max;
  }

  /**
   * @override
   * @return {number}
   */
  getMin() {
    return this.min;
  }

  /**
   * @param {number} min
   */
  setMin(min: number): void {
    this.min = min;
  }

  pdf(): (x: number) => number {
    return (x: number) => {
      if (this.min <= x && x <= this.max) {
        return 1 / (this.max - this.min);
      }
      return 0;
    };
  }

  cdf(): (x: number) => number {
    return (x: number) => {
      if (this.min <= x && x <= this.max) {
        return (x - this.min) / (this.max - this.min);
      } else if (x > this.max) {
        return 1;
      }
      return 0;
    };
  }

  quantile(): (x: number) => number {
    throw new Error("Not supported for uniform distribution");
  }

  getSummary(n = 100): DistributionSummary {
    const x = linspace(this.min, this.max, n);

    return {
      x: x,
      pdf: this.getPDFs(x),
      cdf: this.getCDFs(x),
    };
  }
}

export default Uniform;
