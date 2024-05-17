import AbstractDistribution, { DistributionSummary } from "./AbstractDistribution";
const linspace = require("linspace");
const erf = require("compute-erf");
const erfinv = require("compute-erfinv");

/**
 * Referenced from {@link https://en.wikipedia.org/wiki/Exponential_distribution}
 */
class Exponential extends AbstractDistribution {
  private rate: number;

  constructor() {
    super();
    this.rate = 1;
  }

  /**
   * @return {number}
   */
  getRate(): number {
    return this.rate;
  }

  /**
   * @param {number} rate
   * @throws Error if rate is not a positive number
   */
  setRate(rate: number) {
    if (rate < 0) throw new Error("setRate()::invalid input argument. Rate must be greater than 0.");
    this.rate = rate;
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  pdf(): (x: number) => number {
    return (x: number) => this.rate * Math.exp(-this.rate * x);
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  cdf(): (x: number) => number {
    return (x: number) => 1 - Math.exp(-this.rate * x);
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  quantile(): (x: number) => number {
    return (x: number) => -Math.log(1 - x) / this.rate;
  }

  /**
   * @param {number} n
   * @return {DistributionSummary}
   */
  getSummary(n = 100): DistributionSummary {
    const [lowX, highX] = this.getInverse([0.0001, 0.9999]);
    const x = linspace(lowX, highX, n).filter((i: number) => i >= 0);
    return {
      x: x,
      pdf: this.getPDFs(x),
      cdf: this.getCDFs(x),
    };
  }
}

export default Exponential;
