import AbstractDistribution, {
  DistributionSummary,
} from "./AbstractDistribution";

const linspace = require("linspace");
const erf = require("compute-erf");
const erfinv = require("compute-erfinv");

/**
 * Referenced from {@link https://en.wikipedia.org/wiki/Log-normal_distribution}
 */
class LogNormal extends AbstractDistribution {
  private mu: number;
  private sigma: number;

  constructor() {
    super();
    this.mu = 0;
    this.sigma = 1;
  }

  /**
   * @override
   * @return {number}
   */
  getMu(): number {
    return this.mu;
  }

  /**
   * @param {number} mu
   */
  setMu(mu: number) {
    this.mu = mu;
  }

  /**
   * @override
   * @return {number}
   */
  getSigma(): number {
    return this.sigma;
  }

  /**
   * @param {number} sigma
   * @throws Error if sigma is a negative number
   */
  setSigma(sigma: number) {
    if (sigma <= 0)
      throw new Error(
        "setSigma()::invalid input argument. sigma parameter must be greater than 0.",
      );
    this.sigma = sigma;
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  pdf(): (x: number) => number {
    const A = 1 / (Math.sqrt(2 * Math.PI) * this.sigma);
    const B = -1 / (2 * this.sigma * this.sigma);
    return (x: number) => {
      if (x === 0) return 0;
      const C = Math.log(x) - this.mu;
      return (A / x) * Math.exp(B * C * C);
    };
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  cdf(): (x: number) => number {
    const A = 1 / 2;
    const B = Math.sqrt(2) * this.sigma;
    return (x: number) => {
      const C = Math.log(x) - this.mu;
      return A + A * erf(C / B);
    };
  }

  /**
   * @override
   * @return {(x: number) => number}
   */
  quantile(): (x: number) => number {
    const A = this.mu;
    const B = Math.sqrt(2) * this.sigma;
    return (x: number) => {
      const C = 2 * x - 1;
      return Math.exp(A + B * erfinv(C));
    };
  }

  /**
   * @override
   * @param {number} n
   * @return DistributionSummary
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

export default LogNormal;
