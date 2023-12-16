import { ProxyTypes } from "../ProxyTypes";

export enum DistributionTimeDependence {
  TIME_INDEPENDENT = "On Demand",
  TIME_DEPENDENT = "During Operation",
}

export const DistributionDictionary = {
  [DistributionTimeDependence.TIME_INDEPENDENT]: [
    ProxyTypes.NORMAL_DISTRIBUTION,
    ProxyTypes.LOG_NORMAL_DISTRIBUTION,
    ProxyTypes.UNIFORM_DISTRIBUTION,
  ],
  [DistributionTimeDependence.TIME_DEPENDENT]: [
    ProxyTypes.WEIBULL_DISTRIBUTION,
    ProxyTypes.EXPONENTIAL_DISTRIBUTION,
    ProxyTypes.NON_PARAMETRIC_DISTRIBUTION,
  ],
};

const ReversedDistributionDictionary: Record<
  string,
  DistributionTimeDependence
> = {};
Object.keys(DistributionDictionary).forEach(
  (key: DistributionTimeDependence) => {
    DistributionDictionary[key].forEach((value) => {
      ReversedDistributionDictionary[value] = key;
    });
  },
);
export { ReversedDistributionDictionary };

export type DistributionSummary = {
  x: number[];
  pdf: number[];
  cdf: number[];
};

export default abstract class AbstractDistribution {
  /**
   * Return the probability density function
   * @return {(x: number) => number}
   */
  abstract pdf(): (x: number) => number;

  /**
   * Return the cumulative distribution function
   * @return {(x: number) => number}
   */
  abstract cdf(): (x: number) => number;

  /**
   * Return the quantile function (a.k.a inverse cumulative distribution function)
   * @return {(x: number) => number}
   */
  abstract quantile(): (x: number) => number;

  /**
   * @param {number} n - number of samples
   * @return {DistributionSummary} - summary of distribution
   */
  abstract getSummary(n: number): DistributionSummary;

  /**
   * Apply probability density function
   * @param {number[]} vec - array of x
   * @return {number[]} - array of corresponding y
   */
  getPDFs(vec: number[]): number[] {
    const pdf = this.pdf();
    const len = vec.length;
    const arr = new Array(len);
    for (let i = 0; i < len; i++) arr[i] = pdf(vec[i]);
    return arr;
  }

  /**
   * Apply cumulative distribution function
   * @param {number[]} vec - array of x
   * @return {number[]} - array of corresponding y
   */
  getCDFs(vec: number[]): number[] {
    const cdf = this.cdf();
    const len = vec.length;
    const arr = new Array(len);
    for (let i = 0; i < len; i++) arr[i] = cdf(vec[i]);
    return arr;
  }

  /**
   * Apply quantile function
   * @param {number[]} vec - array of x
   * @return {number[]} - array of corresponding y
   * @throws Error if vec contains a value that is not between 0 and 1
   */
  getInverse(vec: number[]): number[] {
    const quantile = this.quantile();
    const len = vec.length;
    const arr = new Array(len);
    for (let i = 0; i < len; i++) {
      const val = vec[i];
      if (val < 0 || val > 1)
        throw new Error(
          "getQuantiles::invalid input argument. Array values must exist on the interval [0,1].",
        );
      arr[i] = quantile(val);
    }
    return arr;
  }
}
