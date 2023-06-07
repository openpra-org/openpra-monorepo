import { ProxyTypes } from "./ProxyTypes";
import { NormalParams, NormalParamsMap, NormalParamsReverseMap } from "./NormalParams";
import { DistributionTimeDependence, ReversedDistributionDictionary } from "./AbstractDistribution/AbstractDistribution";
import Outcome, { OutcomeJSON } from "./Outcome";
import GateTypes from "./GateTypes";
import Normal from "./Distributions/Normal";
import LogNormal from "./Distributions/Lognormal";
import Weibull from "./Distributions/Weibull";
import Uniform from "./Distributions/Uniform";
import NonParametric from "./Distributions/NonParametric";
import { DistributionSummary } from "./Distributions/AbstractDistribution";
import Exponential from "./Distributions/Exponential";

export interface ExpressionJSON {
  _proxy: ProxyTypes;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.FLOAT}
   */
  value?: number;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.STRING_DISTRIBUTION}
   */
  user_expression?: string;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.EXPONENTIAL_DISTRIBUTION}
   */
  test_interval?: number;
  failure_rate?: number;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.NORMAL_DISTRIBUTION}
   * or {@link ProxyTypes.LOG_NORMAL_DISTRIBUTION}
   */
  mean?: number;
  std?: number;
  median?: number;
  error_factor?: number;
  p5?: number; // 5th percentile
  p95?: number; // 95th percentile
  // parameters to specify which parameters to use
  // to represent a normal distribution
  _params?: ['mean', 'std'] | ['median', 'error_factor'] | ['p5', 'p95'];

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.WEIBULL_DISTRIBUTION}
   */
  // test_interval: number;
  shape?: number;
  scale?: number;

  /**
   * These are not available from backend.
   * Only for front end development purpose.
   */
  normal_mean?: number;
  normal_std?: number;
  normal_median?: number;
  normal_error_factor?: number;
  normal_p5?: number;
  normal_p95?: number;
  normal_params?: NormalParams;
  log_normal_mean?: number;
  log_normal_std?: number;
  log_normal_median?: number;
  log_normal_error_factor?: number;
  log_normal_p5?: number;
  log_normal_p95?: number;
  log_normal_params?: NormalParams;
  exponential_test_interval?: number;
  weibull_test_interval?: number;
  parts_fit_test_interval?: number; // fit: failures in time
  distribution_time_dependence?: DistributionTimeDependence;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.UNIFORM_DISTRIBUTION}
   */
  max?: number;
  min?: number;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.BBN_LINK_EXPRESSION}
   */
  state_ref?: OutcomeJSON;
  uncertain?: boolean;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.PARTS_FIT_EXPRESSION}
   */
  part_id?: number;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.LOGICAL_EXPRESSION}
   */
  formulas?: ExpressionJSON[];
  expr?: GateTypes;

  /**
   * available if {@link ExpressionJSON._proxy} is
   * {@link ProxyTypes.NON_PARAMETRIC_DISTRIBUTION}
   */
  time_to_failure?: number[];
  estimated_reliability?: number[];
}


class Expression {
  private value?: number;

  private userExpression?: string;

  private testInterval?: number;

  private failureRate?: number;

  private normalMean?: number;

  private normalStd?: number;

  private logNormalMean?: number;

  private logNormalStd?: number;

  private shape?: number;

  private scale?: number;

  private exponentialTestInterval?: number;

  private weibullTestInterval?: number;

  private distributionTimeDependence?: DistributionTimeDependence;

  private max?: number;

  private min?: number;

  private stateRef?: Outcome;

  private uncertain?: boolean;

  private partId?: number;

  private partsFITTestInterval?: number;

  private formulas?: Expression[];

  private expr?: GateTypes;

  private timeToFailure?: number[];

  private estimatedReliability?: number[];

  private normalMedian?: number;

  private normalErrorFactor?: number;

  private normalP5?: number;

  private normalP95?: number;

  private normalParams?: NormalParams;

  private logNormalMedian?: number;

  private logNormalErrorFactor?: number;

  private logNormalP5?: number;

  private logNormalP95?: number;

  private logNormalParams?: NormalParams;

  private proxy: ProxyTypes;

  /**
   * Expect the obj to contain one of the following proxyTypes type.
   * {@link ProxyTypes.FLOAT}
   * {@link ProxyTypes.EXPONENTIAL_DISTRIBUTION}
   * {@link ProxyTypes.NORMAL_DISTRIBUTION}
   * {@link ProxyTypes.LOG_NORMAL_DISTRIBUTION}
   * {@link ProxyTypes.WEIBULL_DISTRIBUTION}
   *
   * @param {ExpressionJSON} obj - dictionary object to parse
   */
  constructor(obj: ExpressionJSON = { value: 0.5, _proxy: ProxyTypes.FLOAT }) {
    this.proxy = obj._proxy || ProxyTypes.FLOAT;
    this.distributionTimeDependence = obj.distribution_time_dependence || ReversedDistributionDictionary[obj._proxy];
    switch (this.proxy) {
      case ProxyTypes.FLOAT:
        this.value = obj.value;
        break;
      case ProxyTypes.STRING_DISTRIBUTION:
        this.userExpression = obj.user_expression;
        break;
      case ProxyTypes.EXPONENTIAL_DISTRIBUTION:
        this.exponentialTestInterval = obj.test_interval || obj.exponential_test_interval;
        this.failureRate = obj.failure_rate;
        break;
      case ProxyTypes.NORMAL_DISTRIBUTION:
        this.normalMean = obj.mean || obj.normal_mean;
        this.normalStd = obj.std || obj.normal_std;
        this.normalMedian = obj.median || obj.normal_median;
        this.normalErrorFactor = obj.error_factor || obj.normal_error_factor;
        this.normalP5 = obj.p5 || obj.normal_p5;
        this.normalP95 = obj.p95 || obj.normal_p95;
        this.normalParams = NormalParamsReverseMap[obj._params] || obj.normal_params;
        break;
      case ProxyTypes.LOG_NORMAL_DISTRIBUTION:
        this.logNormalMean = obj.mean || obj.log_normal_mean;
        this.logNormalStd = obj.std || obj.log_normal_std;
        this.logNormalMedian = obj.median || obj.log_normal_median;
        this.logNormalErrorFactor = obj.error_factor || obj.log_normal_error_factor;
        this.logNormalP5 = obj.p5 || obj.log_normal_p5;
        this.logNormalP95 = obj.p95 || obj.log_normal_p95;
        this.logNormalParams = NormalParamsReverseMap[obj._params] || obj.log_normal_params;
        break;
      case ProxyTypes.WEIBULL_DISTRIBUTION:
        this.weibullTestInterval = obj.test_interval || obj.weibull_test_interval;
        this.shape = obj.shape;
        this.scale = obj.scale;
        break;
      case ProxyTypes.DISTRIBUTION:
        break;
      case ProxyTypes.UNIFORM_DISTRIBUTION:
        this.max = obj.max;
        this.min = obj.min;
        break;
      case ProxyTypes.BBN_LINK_EXPRESSION:
        this.stateRef = Outcome.build(obj.state_ref);
        this.uncertain = obj.uncertain ? obj.uncertain : false;
        break;
      case ProxyTypes.PARTS_FIT_EXPRESSION:
        this.partId = obj.part_id;
        this.partsFITTestInterval = obj.test_interval || obj.parts_fit_test_interval;
        break;
      case ProxyTypes.LOGICAL_EXPRESSION:
        this.expr = obj.expr;
        this.formulas = obj.formulas.map(formula => new Expression(formula));
        break;
      case ProxyTypes.NON_PARAMETRIC_DISTRIBUTION:
        this.timeToFailure = obj.time_to_failure;
        this.estimatedReliability = obj.estimated_reliability;
        break;
      default:
        throw new Error(`Expression proxy type ${this.proxy} is not supported`);
    }
  }

  getPartId(): number | undefined {
    return this.partId;
  }

  getPartsFITTestInterval() {
    return this.partsFITTestInterval;
  }

  /**
   * @returns {ProxyTypes}
   */
  getProxy(): ProxyTypes {
    return this.proxy;
  }

  /**
   * @param {ProxyTypes} proxy
   */
  setProxy(proxy: ProxyTypes) {
    this.proxy = proxy;
  }

  /**
   * @returns {number}
   */
  getValue(): number | undefined {
    return this.value;
  }

  /**
   * @param {number} value
   */
  setValue(value: number) {
    this.value = value;
  }

  /**
   * @returns {number}
   */
  getUserExpression(): string | undefined {
    return this.userExpression;
  }

  /**
   * @return {number}
   */
  getFailureRate(): number | undefined {
    return this.failureRate;
  }

  /**
   * @return {number}
   */
  getNormalMean(): number | undefined {
    return this.normalMean;
  }

  /**
   * @return {number}
   */
  getNormalStd(): number | undefined {
    return this.normalStd;
  }

  getNormalMedian(): number | undefined {
    return this.normalMedian;
  }

  getNormalErrorFactor(): number | undefined {
    return this.normalErrorFactor;
  }

  getNormalP5(): number | undefined {
    return this.normalP5;
  }

  getNormalP95(): number | undefined {
    return this.normalP95;
  }

  getNormalParams(): NormalParams {
    return this.normalParams;
  }

  getLogNormalMean(): number | undefined {
    return this.logNormalMean;
  }

  getLogNormalStd(): number | undefined {
    return this.logNormalStd;
  }

  getLogNormalMedian(): number | undefined {
    return this.logNormalMedian;
  }

  getLogNormalErrorFactor(): number | undefined {
    return this.logNormalErrorFactor;
  }

  getLogNormalP5(): number | undefined {
    return this.logNormalP5;
  }

  getLogNormalP95(): number | undefined {
    return this.logNormalP95;
  }

  getLogNormalParams(): NormalParams {
    return this.logNormalParams;
  }

  getShape(): number | undefined {
    return this.shape;
  }

  getScale(): number | undefined {
    return this.scale;
  }

  getExponentialTestInterval(): number | undefined {
    return this.exponentialTestInterval;
  }

  getWeibullTestInterval(): number | undefined {
    return this.weibullTestInterval;
  }

  getDistributionTimeDependence(): DistributionTimeDependence | undefined {
    return this.distributionTimeDependence;
  }

  setDistributionTimeDependence(timeDependence: DistributionTimeDependence) {
    this.distributionTimeDependence = timeDependence;
  }

  getUniformMax(): number | undefined {
    return this.max;
  }

  getUniformMin(): number | undefined {
    return this.min;
  }

  getStateRef(): Outcome | undefined {
    return this.stateRef;
  }

  getTimeToFailure(): number[] | undefined {
    return this.timeToFailure;
  }

  getEstimatedReliability(): number[] | undefined {
    return this.estimatedReliability;
  }

  /**
   * Inverts this expression.
   * This is useful when converting failure path to
   * success path and vice versa
   * @see {@link FunctionalEventSelectionDialog#handleSave}
   * @return {Expression} - inverted expression
   */
  inverse(): Expression {
    if (this.proxy === ProxyTypes.FLOAT) {
      return new Expression({
        value: Number(1.0 - this.value),
        _proxy: this.proxy,
      });
    }
    // failure to success
    if (this.proxy !== ProxyTypes.LOGICAL_EXPRESSION) {
      return new Expression({
        formulas: [this.toJSON()],
        expr: GateTypes.NOT,
        _proxy: ProxyTypes.LOGICAL_EXPRESSION,
      });
    }
    // success to failure

    return new Expression(this.formulas[0].toJSON());
  }


  toFormattedExponential(decimalDigits = 3, param1?: string, param2?: string): string {
    switch (this.proxy) {
      case ProxyTypes.FLOAT:
        return `${this.value?.toExponential(decimalDigits)}`;
      default:
        return this.toString(param1, param2);
    }
  }

  /**
   * Generate JSON format of this object for the detailed node value
   * @return {[key: string]: string | number}
   */
  toString(param1?: string, param2?: string): string {
    switch (this.proxy) {
      case ProxyTypes.FLOAT:
        return `${this.value}`;
      case ProxyTypes.STRING_DISTRIBUTION:
        return `${this.userExpression}`;
      case ProxyTypes.EXPONENTIAL_DISTRIBUTION:
        return `Exp(λ=${this.failureRate}, t=${this.exponentialTestInterval})`;
      case ProxyTypes.NORMAL_DISTRIBUTION:
        switch (this.normalParams) {
          case NormalParams.MeanStd:
            return `Normal(μ=${this.normalMean}, σ=${this.normalStd})`;
          case NormalParams.MedianErrorFactor:
            return `Normal(p50=${this.normalMedian}, EF=${this.normalErrorFactor})`;
          case NormalParams.Percentiles:
            return `Normal(p5=${this.normalP5}, p95=${this.normalP95})`;
          default:
            console.error(`Error: normal params "${this.normalParams}" is not supported`);
            return '';
        }
      case ProxyTypes.LOG_NORMAL_DISTRIBUTION:
        switch (this.logNormalParams) {
          case NormalParams.MeanStd:
            if (param1 && param2) {
              return `Normal(${param1}=${this.logNormalMean}, ${param2}=${this.logNormalStd})`;
            }
            return `Normal(μ=${this.logNormalMean}, σ=${this.logNormalStd})`;
          case NormalParams.MedianErrorFactor:
            if (param1 && param2) {
              return `Normal(${param1}=${this.logNormalMedian}, ${param2}=${this.logNormalErrorFactor})`;
            }
            return `Normal(p50=${this.logNormalMedian}, EF=${this.logNormalErrorFactor})`;
          case NormalParams.Percentiles:
            if (param1 && param2) {
              return `Normal(${param1}=${this.logNormalP5}, ${param2}=${this.logNormalP95})`;
            }
            return `Normal(p5=${this.logNormalP5}, p95=${this.logNormalP95})`;
          default:
            console.error(`Error: lognormal params "${this.logNormalParams}" is not supported`);
            return '';
        }
      case ProxyTypes.WEIBULL_DISTRIBUTION:
        return `Weibull(β=${this.shape}, η=${this.scale}, t=${this.weibullTestInterval})`;
      case ProxyTypes.UNIFORM_DISTRIBUTION:
        return `Uniform(min=${this.min}, max=${this.max})`;
      case ProxyTypes.BBN_LINK_EXPRESSION:
        if (this.uncertain && this.uncertain !== 'false') {
          return `UBN: ${this.stateRef.toJSON().path}`;
        }
        return `BN: ${this.stateRef.toJSON().path}`;
      case ProxyTypes.PARTS_FIT_EXPRESSION:
        return `PART: ${this.partId}`;
      case ProxyTypes.DISTRIBUTION:
        return null;
      case ProxyTypes.LOGICAL_EXPRESSION:
        return null;
      case ProxyTypes.NON_PARAMETRIC_DISTRIBUTION:
        return 'NON-PARAMETRIC DATA';
      default:
        throw new Error(`Expression proxy type ${this.proxy} is not supported`);
    }
  }


  /**
   * Generate JSON format of this object for the server
   * @return ExpressionJSON
   */
  toJSON(): ExpressionJSON {
    switch (this.proxy) {
      case ProxyTypes.FLOAT:
        return ({
          value: Number(this.value),
          _proxy: this.proxy,
        });
      case ProxyTypes.STRING_DISTRIBUTION:
        return ({
          user_expression: String(this.userExpression),
          _proxy: this.proxy,
        });
      case ProxyTypes.EXPONENTIAL_DISTRIBUTION:
        return ({
          test_interval: Number(this.exponentialTestInterval),
          failure_rate: Number(this.failureRate),
          _proxy: this.proxy,
        });
      case ProxyTypes.NORMAL_DISTRIBUTION:
        switch (this.normalParams) {
          case NormalParams.MeanStd:
            return ({
              mean: Number(this.normalMean),
              std: Number(this.normalStd),
              _params: NormalParamsMap[NormalParams.MeanStd],
              _proxy: this.proxy,
            });
          case NormalParams.MedianErrorFactor:
            return ({
              median: Number(this.normalMedian),
              error_factor: Number(this.normalErrorFactor),
              _params: NormalParamsMap[NormalParams.MedianErrorFactor],
              _proxy: this.proxy,
            });
          case NormalParams.Percentiles:
            return ({
              p5: Number(this.normalP5),
              p95: Number(this.normalP95),
              _params: NormalParamsMap[NormalParams.Percentiles],
              _proxy: this.proxy,
            });
          default:
            console.error(`Erorr: normal params "${this.normalParams}" is not supported`);
            return { _proxy: this.proxy };
        }
      case ProxyTypes.LOG_NORMAL_DISTRIBUTION:
        switch (this.logNormalParams) {
          case NormalParams.MeanStd:
            return ({
              mean: Number(this.logNormalMean),
              std: Number(this.logNormalStd),
              _params: NormalParamsMap[NormalParams.MeanStd],
              _proxy: this.proxy,
            });
          case NormalParams.MedianErrorFactor:
            return ({
              median: Number(this.logNormalMedian),
              error_factor: Number(this.logNormalErrorFactor),
              _params: NormalParamsMap[NormalParams.MedianErrorFactor],
              _proxy: this.proxy,
            });
          case NormalParams.Percentiles:
            return ({
              p5: Number(this.logNormalP5),
              p95: Number(this.logNormalP95),
              _params: NormalParamsMap[NormalParams.Percentiles],
              _proxy: this.proxy,
            });
          default:
            console.error(`Erorr: lognormal params "${this.logNormalParams}" is not supported`);
            return { _proxy: this.proxy };
        }
      case ProxyTypes.WEIBULL_DISTRIBUTION:
        return ({
          test_interval: Number(this.weibullTestInterval),
          shape: Number(this.shape),
          scale: Number(this.scale),
          _proxy: this.proxy,
        });
      case ProxyTypes.UNIFORM_DISTRIBUTION:
        return ({
          max: Number(this.max),
          min: Number(this.min),
          _proxy: this.proxy,
        });
      case ProxyTypes.BBN_LINK_EXPRESSION:
        return ({
          state_ref: this.stateRef.toJSON(),
          uncertain: this.uncertain,
          _proxy: this.proxy,
        });
      case ProxyTypes.PARTS_FIT_EXPRESSION:
        return ({
          part_id: Number(this.partId),
          test_interval: Number(this.partsFITTestInterval),
          _proxy: this.proxy,
        });
      case ProxyTypes.DISTRIBUTION:
        return ({
          _proxy: ProxyTypes.NORMAL_DISTRIBUTION,
        });
      case ProxyTypes.LOGICAL_EXPRESSION:
        return ({
          formulas: this.formulas.map(formula => formula.toJSON()),
          expr: this.expr,
          _proxy: this.proxy,
        });
      case ProxyTypes.NON_PARAMETRIC_DISTRIBUTION:
        return ({
          time_to_failure: this.timeToFailure,
          estimated_reliability: this.estimatedReliability,
          _proxy: this.proxy,
        });
      default:
        throw new Error(`Expression proxy type ${this.proxy} is not supported`);
    }
  }

  /**
   * Generate JSON format of this object for {@link ExpressionInput}
   * @return {ExpressionJSON}
   */
  toExtendedJSON(): ExpressionJSON {
    switch (this.proxy) {
      case ProxyTypes.FLOAT:
        return ({
          value: this.value,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.STRING_DISTRIBUTION:
        return ({
          user_expression: this.userExpression,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.BBN_LINK_EXPRESSION:
        return ({
          state_ref: this.stateRef.toJSON(),
          uncertain: this.uncertain,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.PARTS_FIT_EXPRESSION:
        return ({
          part_id: this.partId,
          parts_fit_test_interval: this.partsFITTestInterval,
          _proxy: this.proxy,
        });
      case ProxyTypes.EXPONENTIAL_DISTRIBUTION:
        return ({
          exponential_test_interval: this.exponentialTestInterval,
          failure_rate: this.failureRate,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.NORMAL_DISTRIBUTION:
        return ({
          normal_mean: this.normalMean,
          normal_std: this.normalStd,
          normal_median: this.normalMedian,
          normal_error_factor: this.normalErrorFactor,
          normal_p5: this.normalP5,
          normal_p95: this.normalP95,
          normal_params: this.normalParams,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.LOG_NORMAL_DISTRIBUTION:
        return ({
          log_normal_mean: this.logNormalMean,
          log_normal_std: this.logNormalStd,
          log_normal_median: this.logNormalMedian,
          log_normal_error_factor: this.logNormalErrorFactor,
          log_normal_p5: this.logNormalP5,
          log_normal_p95: this.logNormalP95,
          log_normal_params: this.logNormalParams,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.WEIBULL_DISTRIBUTION:
        return ({
          weibull_test_interval: this.weibullTestInterval,
          shape: this.shape,
          scale: this.scale,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.UNIFORM_DISTRIBUTION:
        return ({
          max: this.max,
          min: this.min,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.NON_PARAMETRIC_DISTRIBUTION:
        return ({
          time_to_failure: this.timeToFailure,
          estimated_reliability: this.estimatedReliability,
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      case ProxyTypes.DISTRIBUTION:
        return ({
          distribution_time_dependence: this.distributionTimeDependence,
          _proxy: this.proxy,
        });
      default:
        throw new Error(`Expression proxy type ${this.proxy} is not supported`);
    }
  }

  /**
   * Generate distribution summary for {@link DistributionPlot}
   * @return {DistributionSummary}
   */
  toDistributionSummary(): DistributionSummary {
    let distributionSummary: DistributionSummary;
    switch (this.proxy) {
      case ProxyTypes.EXPONENTIAL_DISTRIBUTION:
        const { failureRate } = this;
        if (InputRules.isFailureRate((failureRate || '').toString())) {
          const exponential = new Exponential();
          exponential.setRate(Number(failureRate));
          distributionSummary = exponential.getSummary();
        }
        break;
      case ProxyTypes.NORMAL_DISTRIBUTION:
        const normalMean = this.computeNormalMean();
        const normalStd = this.computeNormalStd();

        if (InputRules.isMean((normalMean || '').toString()) && InputRules.isStd((normalStd || '').toString())) {
          const normal = new Normal();
          normal.setMu(Number(normalMean));
          normal.setSigma(Number(normalStd));
          distributionSummary = normal.getSummary();
        }
        break;
      case ProxyTypes.LOG_NORMAL_DISTRIBUTION:
        const lodNormalMean = this.computeLogNormalMean();
        const logNormalStd = this.computeLogNormalStd();
        if (InputRules.isMean((lodNormalMean || '').toString()) && InputRules.isStd((logNormalStd || '').toString())) {
          const logNormal = new LogNormal();
          logNormal.setMu(Number(lodNormalMean));
          logNormal.setSigma(Number(logNormalStd));
          distributionSummary = logNormal.getSummary();
        }
        break;
      case ProxyTypes.WEIBULL_DISTRIBUTION:
        const { shape } = this;
        const { scale } = this;
        if (InputRules.isShape((shape || '').toString()) && InputRules.isScale((scale || '').toString())) {
          const weibull = new Weibull();
          weibull.setShape(Number(shape));
          weibull.setScale(Number(scale));
          distributionSummary = weibull.getSummary();
        }
        break;
      case ProxyTypes.UNIFORM_DISTRIBUTION:
        const { max } = this;
        const { min } = this;
        if (InputRules.isMax((max || '').toString()) && InputRules.isMin((min || '').toString())) {
          const uniform = new Uniform();
          uniform.setMax(Number(max));
          uniform.setMin(Number(min));
          distributionSummary = uniform.getSummary();
        }
        break;
      case ProxyTypes.NON_PARAMETRIC_DISTRIBUTION:
        const { timeToFailure } = this;
        const { estimatedReliability } = this;
        const nonParametric = new NonParametric();
        if (timeToFailure && estimatedReliability) {
          nonParametric.setTimeToFailure(timeToFailure);
          nonParametric.setEstimatedReliability(estimatedReliability);
          distributionSummary = nonParametric.getSummary();
        }
        break;
      default:
        break;
    }

    return distributionSummary;
  }

  clone(): Expression {
    return new Expression(this.toJSON());
  }

  private computeMean(value1: number, value2: number, params: NormalParams) {
    switch (params) {
      case NormalParams.MeanStd:
        return value1;
      case NormalParams.MedianErrorFactor:
        return Math.log(value1);
      case NormalParams.Percentiles:
        return Math.log(value1 * value2) / 2;
      default:
        console.error(`Error: failed to compute mean with params "${params}"`);
        return 0;
    }
  }

  private computeStd(value1: number, value2: number, params: NormalParams) {
    switch (params) {
      case NormalParams.MeanStd:
        return value2;
      case NormalParams.MedianErrorFactor:
        return Math.log(value2) / 1.645;
      case NormalParams.Percentiles:
        return Math.log(value2 / value1) / (2 * 1.645);
      default:
        console.error(`Error: failed to compute std with params "${params}"`);
        return 0;
    }
  }

  private computeNormalMean() {
    switch (this.normalParams) {
      case NormalParams.MeanStd:
        return this.computeMean(this.normalMean, this.normalStd, this.normalParams);
      case NormalParams.MedianErrorFactor:
        return this.computeMean(this.normalMedian, this.normalErrorFactor, this.normalParams);
      case NormalParams.Percentiles:
        return this.computeMean(this.normalP5, this.normalP95, this.normalParams);
      default:
        console.error(`Error: Unrecognized params "${this.normalParams}" detected`);
        return 0;
    }
  }

  private computeNormalStd() {
    switch (this.normalParams) {
      case NormalParams.MeanStd:
        return this.computeStd(this.normalMean, this.normalStd, this.normalParams);
      case NormalParams.MedianErrorFactor:
        return this.computeStd(this.normalMedian, this.normalErrorFactor, this.normalParams);
      case NormalParams.Percentiles:
        return this.computeStd(this.normalP5, this.normalP95, this.normalParams);
      default:
        console.error(`Error: Unrecognized params "${this.normalParams}" detected`);
        return 0;
    }
  }

  private computeLogNormalMean() {
    switch (this.logNormalParams) {
      case NormalParams.MeanStd:
        return this.computeMean(this.logNormalMean, this.logNormalStd, this.logNormalParams);
      case NormalParams.MedianErrorFactor:
        return this.computeMean(this.logNormalMedian, this.logNormalErrorFactor, this.logNormalParams);
      case NormalParams.Percentiles:
        return this.computeMean(this.logNormalP5, this.logNormalP95, this.logNormalParams);
      default:
        console.error(`Error: Unrecognized params "${this.normalParams}" detected`);
        return 0;
    }
  }

  private computeLogNormalStd() {
    switch (this.logNormalParams) {
      case NormalParams.MeanStd:
        return this.computeStd(this.logNormalMean, this.logNormalStd, this.logNormalParams);
      case NormalParams.MedianErrorFactor:
        return this.computeStd(this.logNormalMedian, this.logNormalErrorFactor, this.logNormalParams);
      case NormalParams.Percentiles:
        return this.computeStd(this.logNormalP5, this.logNormalP95, this.logNormalParams);
      default:
        console.error(`Error: Unrecognized params "${this.normalParams}" detected`);
        return 0;
    }
  }
}
