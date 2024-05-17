import AbstractDistribution, { DistributionSummary } from "./AbstractDistribution";
const linspace = require("linspace");
const erf = require("compute-erf");
const erfinv = require("compute-erfinv");

/**
 * Referenced from {@link https://en.wikipedia.org/wiki/Normal_distribution}
 */
class Normal extends AbstractDistribution {
  private mu: number;
  private sigma: number;

  constructor() {
    super();
    this.mu = 0;
    this.sigma = 1;
  }

  /**
   * @param {number} mu
   */
  setMu(mu: number): void {
    this.mu = mu;
  }

  /**
   * @override
   * @return {number}
   */
  getMu() {
    return this.mu;
  }

  /**
   * @param {number} sigma
   * @throws Error if sigma is less than 0
   */
  setSigma(sigma: number): void {
    if (sigma <= 0) throw new TypeError("setSigma()::invalid input argument. sigma must be a positive number.");
    this.sigma = sigma;
  }

  /**
   * @override
   * @return {number}
   */
  getSigma() {
    return this.sigma;
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  pdf(): (x: number) => number {
    const mu = this.mu;
    const A = (1 / Math.sqrt(2 * Math.PI)) * this.sigma;
    const B = -1 / (2 * this.sigma * this.sigma);

    return (x: number) => {
      const C = x - mu;
      return A * Math.exp(B * C * C);
    };
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  cdf(): (x: number) => number {
    const A = 1 / 2;
    const B = 1 / (this.sigma * Math.sqrt(2));
    return (x: number) => {
      const C = x - this.mu;
      return A * (1 + erf(C / B));
    };
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  quantile(): (x: number) => number {
    const A = this.mu;
    const B = Math.sqrt(this.sigma * 2);
    return (x: number) => {
      const C = 2 * x - 1;
      return A + B * erfinv(C);
    };
  }

  /**
   * @override
   * @param {number} n
   */
  getSummary(n = 100): DistributionSummary {
    const x = linspace(0, 1, n);

    return {
      x: x,
      pdf: this.getPDFs(x),
      cdf: this.getCDFs(x),
    };
  }
}

export default Normal;
