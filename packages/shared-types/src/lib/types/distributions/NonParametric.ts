import AbstractDistribution, {
  DistributionSummary,
} from "./AbstractDistribution";

class NonParametric extends AbstractDistribution {
  private timeToFailure: number[];
  private estimatedReliability: number[];

  /**
   * @return {number[]}
   */
  getTimeToFailure(): number[] {
    return this.timeToFailure;
  }

  /**
   * @param {number[]} timeToFailure
   * @throws Error if entry is not a positive number
   */
  setTimeToFailure(timeToFailure: number[]) {
    this.timeToFailure = timeToFailure;
  }

  /**
   * @return {number[]}
   */
  getEstimatedReliability(): number[] {
    return this.estimatedReliability;
  }

  /**
   * @param {number[]} estimatedReliability
   * @throws Error if entry is not a number between 0 and 1
   */
  setEstimatedReliability(estimatedReliability: number[]) {
    this.estimatedReliability = estimatedReliability;
  }

  cdf(): (x: number) => number {
    return function (p1: number) {
      return 0;
    };
  }

  getSummary(): DistributionSummary {
    return {
      x: this.timeToFailure,
      pdf: this.estimatedReliability,
      cdf: this.estimatedReliability,
    };
  }

  pdf(): (x: number) => number {
    return function (p1: number) {
      return 0;
    };
  }

  quantile(): (x: number) => number {
    return function (p1: number) {
      return 0;
    };
  }
}

export default NonParametric;
