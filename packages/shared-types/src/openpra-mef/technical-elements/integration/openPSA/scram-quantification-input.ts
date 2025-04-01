/**
 * Type representing identifiers that follow a specific pattern.
 * Pattern: [^\-.]+(-[^\-.]+)* (characters excluding hyphens and periods, with optional hyphen-separated parts)
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const validId: Identifier = "pump-failure-mode";
 * ```
 */
type Identifier = string; // NCName pattern: [^\-.]+(-[^\-.]+)*

/**
 * Type representing references to other elements in the model.
 * Pattern: ([^\-.]+(-[^\-.]+)*)(\.\i[^\-.]*(-[^\-.]+)*)* (allowing qualified references with dots)
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const reference: Reference = "system1.pump2.failure-to-start";
 * ```
 */
type Reference = string; // Pattern for references to other elements: ([^\-.]+(-[^\-.]+)*)(\.\i[^\-.]*(-[^\-.]+)*)*

/**
 * Type representing non-empty strings without line feeds or special characters.
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const label: NonEmptyString = "Reactor Cooling System";
 * ```
 */
type NonEmptyString = string; // Length > 1. Texts without LF and other special chars.

/**
 * Type representing valid units for parameters and expressions.
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const failureRateUnit: Unit = "years-1";
 * ```
 */
type Unit = "bool" | "int" | "float" | "hours" | "hours-1" | "years" | "years-1" | "fit" | "demands";

/**
 * Type representing Common Cause Failure model types.
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const ccfModel: CCFModelType = "beta-factor";
 * ```
 */
type CCFModelType = "beta-factor" | "MGL" | "alpha-factor" | "phi-factor";

/**
 * Type representing substitution operation types.
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const substituteType: SubstitutionType = "exchange-event";
 * ```
 */
type SubstitutionType = "delete-terms" | "recovery-rule" | "exchange-event";

/**
 * Type representing the visibility role of an element.
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const eventRole: Role = "public";
 * ```
 */
type Role = "private" | "public";

/**
 * Type representing the type of an event in a fault tree.
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const type: EventType = "basic-event";
 * ```
 */
type EventType = "gate" | "basic-event" | "house-event";

/**
 * Type representing the direction of operations.
 * @memberof Quantification
 * @type {string}
 */
type Direction = "forward";

/**
 * Interface representing an attribute with name, value, and optional data type.
 * Attributes provide additional metadata for model elements.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const attr: Attribute = {
 *   name: "source-document",
 *   value: "PRA-Report-2023",
 *   dataType: "string"
 * };
 * ```
 */
interface Attribute {
  /**
   * Name of the attribute
   */
  name: Identifier;

  /**
   * Value of the attribute
   */
  value: NonEmptyString;

  /**
   * Optional data type of the attribute
   */
  dataType?: NonEmptyString;
}

/**
 * Base interface for elements with common properties like name, label, and attributes.
 * This is the foundation for most model elements.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const element: BaseElement = {
 *   name: "cooling-system",
 *   label: "Primary Cooling System",
 *   attributes: [
 *     { name: "reliability", value: "high" }
 *   ]
 * };
 * ```
 */
interface BaseElement {
  /**
   * Unique identifier for the element
   */
  name: Identifier;

  /**
   * Optional human-readable label
   */
  label?: NonEmptyString;

  /**
   * Optional list of attributes providing additional metadata
   */
  attributes?: Attribute[];
}

/**
 * Interface representing an event in a fault tree or event tree.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const event: Event = {
 *   name: "pump-failure",
 *   type: "basic-event"
 * };
 * ```
 */
interface Event {
  /**
   * Reference to the event's name
   */
  name: Reference;

  /**
   * Optional type of the event
   */
  type?: EventType;
}

/**
 * Interface representing a basic event in a fault tree.
 * Basic events are elementary failure events with probabilities.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const basicEvent: BasicEvent = {
 *   name: "valve-failure"
 * };
 * ```
 */
interface BasicEvent {
  /**
   * Reference to the basic event's name
   */
  name: Reference;
}

/**
 * Interface representing a house event in a fault tree.
 * House events are boundary conditions that are either true or false.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const houseEvent: HouseEvent = {
 *   name: "maintenance-mode"
 * };
 * ```
 */
interface HouseEvent {
  /**
   * Reference to the house event's name
   */
  name: Reference;
}

/**
 * Interface representing a gate in a fault tree.
 * Gates combine events using logical operations.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const gate: Gate = {
 *   name: "system-failure"
 * };
 * ```
 */
interface Gate {
  /**
   * Reference to the gate's name
   */
  name: Reference;
}

/**
 * Type representing an argument in a formula.
 * Can be an event, a negated event, or a boolean constant.
 *
 * @memberof Quantification
 * @type {Event | { not: Event } | boolean}
 *
 * @example
 * ```typescript
 * const arg1: Argument = { name: "pump-failure" };
 * const arg2: Argument = { not: { name: "backup-available" } };
 * const arg3: Argument = true;
 * ```
 */
type Argument = Event | { not: Event } | boolean;

/**
 * Interface representing a logical formula in a fault tree.
 * Formulas define the logical relationships between events.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const orFormula: Formula = {
 *   or: [
 *     { name: "pump1-failure" },
 *     { name: "pump2-failure" }
 *   ]
 * };
 *
 * const andFormula: Formula = {
 *   and: [
 *     { name: "power-loss" },
 *     { not: { name: "backup-power-available" } }
 *   ]
 * };
 *
 * const atleastFormula: Formula = {
 *   atleast: {
 *     min: 2,
 *     arguments: [
 *       { name: "sensor1-failure" },
 *       { name: "sensor2-failure" },
 *       { name: "sensor3-failure" }
 *     ]
 *   }
 * };
 * ```
 */
interface Formula {
  /**
   * Logical AND operation between arguments
   */
  and?: Argument[];

  /**
   * Logical OR operation between arguments
   */
  or?: Argument[];

  /**
   * Exclusive OR operation between exactly two arguments
   */
  xor?: [Argument, Argument];

  /**
   * If and only if operation between exactly two arguments
   */
  iff?: [Argument, Argument];

  /**
   * Logical NAND operation between arguments
   */
  nand?: Argument[];

  /**
   * Logical NOR operation between arguments
   */
  nor?: Argument[];

  /**
   * At least K-out-of-N operation
   */
  atleast?: {
    /**
     * Minimum number of arguments that must be true
     */
    min: number;

    /**
     * List of arguments to evaluate
     */
    arguments: Argument[];
  };

  /**
   * Cardinality operation, requiring between min and max arguments to be true
   */
  cardinality?: {
    /**
     * Minimum number of arguments that must be true
     */
    min: number;

    /**
     * Maximum number of arguments that can be true
     */
    max: number;

    /**
     * List of arguments to evaluate
     */
    arguments: Argument[];
  };

  /**
   * Logical implication operation between exactly two arguments
   */
  imply?: [Argument, Argument];
}

/**
 * Interface representing a boolean expression with a constant value.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const trueExpr: BoolExpression = {
 *   value: true
 * };
 * ```
 */
interface BoolExpression {
  /**
   * Boolean value
   */
  value: boolean;
}

/**
 * Interface representing an integer expression with a constant value.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const count: IntExpression = {
 *   value: 5
 * };
 * ```
 */
interface IntExpression {
  /**
   * Integer value
   */
  value: number;
}

/**
 * Interface representing a floating-point expression with a constant value.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const probability: FloatExpression = {
 *   value: 1.5e-4
 * };
 * ```
 */
interface FloatExpression {
  /**
   * Floating-point value
   */
  value: number;
}

/**
 * Interface representing a reference to a parameter in an expression.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const paramRef: ParameterExpression = {
 *   name: "failure-rate",
 *   unit: "years-1"
 * };
 * ```
 */
interface ParameterExpression {
  /**
   * Reference to the parameter's name
   */
  name: Reference;

  /**
   * Optional unit of the parameter
   */
  unit?: Unit;
}

/**
 * Interface representing the system mission time in an expression.
 * This is a special expression that refers to the mission time of the system.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const missionTime: SystemMissionTimeExpression = {
 *   unit: "hours"
 * };
 * ```
 */
interface SystemMissionTimeExpression {
  /**
   * Optional unit for the mission time
   */
  unit?: Unit;
}

/**
 * Type representing numerical operations in expressions.
 * Includes arithmetic operations, trigonometric functions, and other mathematical functions.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const sum: NumericalOperation = {
 *   add: [
 *     { value: 0.01 },
 *     { name: "failure-rate", unit: "years-1" }
 *   ]
 * };
 *
 * const product: NumericalOperation = {
 *   mul: [
 *     { value: 2.5 },
 *     { name: "base-rate" }
 *   ]
 * };
 *
 * const squareRoot: NumericalOperation = {
 *   sqrt: { name: "variance" }
 * };
 * ```
 */
type NumericalOperation =
  | { neg: Expression }
  | { add: Expression[] }
  | { sub: Expression[] }
  | { mul: Expression[] }
  | { div: Expression[] }
  | { pi: null }
  | { abs: Expression }
  | { acos: Expression }
  | { asin: Expression }
  | { atan: Expression }
  | { cos: Expression }
  | { cosh: Expression }
  | { exp: Expression }
  | { log: Expression }
  | { log10: Expression }
  | { mod: [Expression, Expression] }
  | { pow: [Expression, Expression] }
  | { sin: Expression }
  | { sinh: Expression }
  | { tan: Expression }
  | { tanh: Expression }
  | { sqrt: Expression }
  | { ceil: Expression }
  | { floor: Expression }
  | { min: Expression[] }
  | { max: Expression[] }
  | { mean: Expression[] };

/**
 * Type representing boolean operations in expressions.
 * Includes logical operations and comparison operations.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const andOperation: BooleanOperation = {
 *   and: [
 *     { value: true },
 *     { name: "condition-met" }
 *   ]
 * };
 *
 * const comparison: BooleanOperation = {
 *   lt: [
 *     { name: "temperature" },
 *     { value: 100 }
 *   ]
 * };
 *
 * const notOperation: BooleanOperation = {
 *   not: { name: "system-available" }
 * };
 * ```
 */
type BooleanOperation =
  | { not: Expression }
  | { and: Expression[] }
  | { or: Expression[] }
  | { eq: [Expression, Expression] }
  | { df: [Expression, Expression] }
  | { lt: [Expression, Expression] }
  | { gt: [Expression, Expression] }
  | { leq: [Expression, Expression] }
  | { geq: [Expression, Expression] };

/**
 * Interface representing an if-then-else operation in expressions.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const ifThenElse: IfThenElseOperation = {
 *   ite: [
 *     { gt: [{ name: "temperature" }, { value: 80 }] },
 *     { value: 0.05 },
 *     { value: 0.01 }
 *   ]
 * };
 * ```
 */
interface IfThenElseOperation {
  /**
   * If-then-else operation with condition, then-result, and else-result expressions
   */
  ite: [Expression, Expression, Expression];
}

/**
 * Interface representing a switch operation with multiple cases and a default case.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const switchOp: SwitchOperation = {
 *   cases: [
 *     {
 *       condition: { lt: [{ name: "temperature" }, { value: 50 }] },
 *       result: { value: 0.01 }
 *     },
 *     {
 *       condition: { lt: [{ name: "temperature" }, { value: 100 }] },
 *       result: { value: 0.05 }
 *     }
 *   ],
 *   default: { value: 0.1 }
 * };
 * ```
 */
interface SwitchOperation {
  /**
   * List of cases, each with a condition and a result
   */
  cases: { condition: Expression; result: Expression }[];

  /**
   * Default result if no case conditions are met
   */
  default: Expression;
}

/**
 * Type representing conditional operations in expressions.
 *
 * @memberof Quantification
 * @type {IfThenElseOperation | SwitchOperation}
 *
 * @example
 * ```typescript
 * const conditional1: ConditionalOperation = {
 *   ite: [
 *     { name: "condition" },
 *     { value: true },
 *     { value: false }
 *   ]
 * };
 *
 * const conditional2: ConditionalOperation = {
 *   cases: [
 *     {
 *       condition: { eq: [{ name: "mode" }, { value: 1 }] },
 *       result: { value: "low" }
 *     },
 *     {
 *       condition: { eq: [{ name: "mode" }, { value: 2 }] },
 *       result: { value: "medium" }
 *     }
 *   ],
 *   default: { value: "high" }
 * };
 * ```
 */
type ConditionalOperation = IfThenElseOperation | SwitchOperation;

/**
 * Interface representing an exponential function.
 * Commonly used for time-dependent failure models.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const expFunc: ExponentialFunction = {
 *   exponential: [
 *     { name: "lambda" },
 *     { name: "mission-time", unit: "hours" }
 *   ]
 * };
 * ```
 */
interface ExponentialFunction {
  /**
   * Exponential function with rate and time parameters
   */
  exponential: [Expression, Expression];
}

/**
 * Interface representing a Generalized Linear Model function.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const glm: GLMFunction = {
 *   GLM: [
 *     { name: "alpha" },
 *     { name: "beta" },
 *     { name: "gamma" },
 *     { name: "time" }
 *   ]
 * };
 * ```
 */
interface GLMFunction {
  /**
   * GLM function with model parameters
   */
  GLM: [Expression, Expression, Expression, Expression];
}

/**
 * Interface representing a Weibull function.
 * Used for modeling time-dependent failure rates with aging effects.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const weibull: WeibullFunction = {
 *   Weibull: [
 *     { name: "alpha" },
 *     { name: "beta" },
 *     { name: "t0" },
 *     { name: "time" }
 *   ]
 * };
 * ```
 */
interface WeibullFunction {
  /**
   * Weibull function with shape, scale, location, and time parameters
   */
  Weibull: [Expression, Expression, Expression, Expression];
}

/**
 * Interface representing a periodic test function.
 * Used for modeling periodically tested components.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const periodicTest: PeriodicTestFunction = {
 *   periodicTest: [
 *     { name: "lambda" },
 *     { name: "tau" },
 *     { name: "time" }
 *   ]
 * };
 * ```
 */
interface PeriodicTestFunction {
  /**
   * Periodic test function with parameters
   */
  periodicTest: Expression[];
}

/**
 * Interface representing an external function call.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const extern: ExternFunction = {
 *   name: "custom-reliability-model",
 *   arguments: [
 *     { name: "parameter1" },
 *     { value: 2.5 },
 *     { name: "time" }
 *   ]
 * };
 * ```
 */
interface ExternFunction {
  /**
   * Name of the external function
   */
  name: Identifier;

  /**
   * List of argument expressions
   */
  arguments: Expression[];
}

/**
 * Type representing built-in functions for reliability modeling.
 *
 * @memberof Quantification
 * @type {ExponentialFunction | GLMFunction | WeibullFunction | PeriodicTestFunction | ExternFunction}
 *
 * @example
 * ```typescript
 * const expModel: BuiltInFunction = {
 *   exponential: [
 *     { value: 1e-6 },
 *     { name: "mission-time" }
 *   ]
 * };
 *
 * const customFunction: BuiltInFunction = {
 *   name: "custom-model",
 *   arguments: [
 *     { name: "param1" },
 *     { value: 10 }
 *   ]
 * };
 * ```
 */
type BuiltInFunction = ExponentialFunction | GLMFunction | WeibullFunction | PeriodicTestFunction | ExternFunction;

/**
 * Interface representing a uniform distribution for random deviates.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const uniform: UniformDeviate = {
 *   uniformDeviate: [
 *     { value: 0.0 },
 *     { value: 1.0 }
 *   ]
 * };
 * ```
 */
interface UniformDeviate {
  /**
   * Uniform distribution with minimum and maximum values
   */
  uniformDeviate: [Expression, Expression];
}

/**
 * Interface representing a normal distribution for random deviates.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const normal: NormalDeviate = {
 *   normalDeviate: [
 *     { value: 0.0 },
 *     { value: 1.0 }
 *   ]
 * };
 * ```
 */
interface NormalDeviate {
  /**
   * Normal distribution with mean and standard deviation
   */
  normalDeviate: [Expression, Expression];
}

/**
 * Interface representing a log-normal distribution for random deviates.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const lognormal: LognormalDeviate = {
 *   lognormalDeviate: [
 *     { value: 0.0 },
 *     { value: 1.0 },
 *     { value: 0.0 }
 *   ]
 * };
 * ```
 */
interface LognormalDeviate {
  /**
   * Log-normal distribution with mean, error factor, and optional location parameter
   */
  lognormalDeviate: [Expression, Expression, Expression?];
}

/**
 * Interface representing a gamma distribution for random deviates.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const gamma: GammaDeviate = {
 *   gammaDeviate: [
 *     { value: 2.0 },
 *     { value: 1.0 }
 *   ]
 * };
 * ```
 */
interface GammaDeviate {
  /**
   * Gamma distribution with shape and scale parameters
   */
  gammaDeviate: [Expression, Expression];
}

/**
 * Interface representing a beta distribution for random deviates.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const beta: BetaDeviate = {
 *   betaDeviate: [
 *     { value: 2.0 },
 *     { value: 5.0 }
 *   ]
 * };
 * ```
 */
interface BetaDeviate {
  /**
   * Beta distribution with alpha and beta parameters
   */
  betaDeviate: [Expression, Expression];
}

/**
 * Interface representing a bin in a histogram distribution.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const bin: HistogramBin = {
 *   binValue: { value: 0.01 },
 *   binProbability: { value: 0.2 }
 * };
 * ```
 */
interface HistogramBin {
  /**
   * Value of the bin
   */
  binValue: Expression;

  /**
   * Probability associated with the bin
   */
  binProbability: Expression;
}

/**
 * Interface representing a histogram distribution for random deviates.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const histogram: HistogramDeviate = {
 *   expression: { name: "failure-rate" },
 *   bins: [
 *     {
 *       binValue: { value: 0.001 },
 *       binProbability: { value: 0.25 }
 *     },
 *     {
 *       binValue: { value: 0.01 },
 *       binProbability: { value: 0.5 }
 *     },
 *     {
 *       binValue: { value: 0.1 },
 *       binProbability: { value: 0.25 }
 *     }
 *   ]
 * };
 * ```
 */
interface HistogramDeviate {
  /**
   * Expression to sample
   */
  expression: Expression;

  /**
   * List of histogram bins
   */
  bins: HistogramBin[];
}

/**
 * Type representing random deviate distributions.
 * Used for representing uncertainty in parameters.
 *
 * @memberof Quantification
 * @type {UniformDeviate | NormalDeviate | LognormalDeviate | GammaDeviate | BetaDeviate | HistogramDeviate}
 *
 * @example
 * ```typescript
 * const failureRateUncertainty: RandomDeviate = {
 *   lognormalDeviate: [
 *     { value: 1e-6 },
 *     { value: 3.0 }
 *   ]
 * };
 *
 * const discreteDistribution: RandomDeviate = {
 *   expression: { name: "parameter" },
 *   bins: [
 *     {
 *       binValue: { value: 1 },
 *       binProbability: { value: 0.3 }
 *     },
 *     {
 *       binValue: { value: 2 },
 *       binProbability: { value: 0.7 }
 *     }
 *   ]
 * };
 * ```
 */
type RandomDeviate = UniformDeviate | NormalDeviate | LognormalDeviate | GammaDeviate | BetaDeviate | HistogramDeviate;

/**
 * Interface representing a test initiating event.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const initiatingEvent: TestInitiatingEvent = {
 *   name: "loss-of-power"
 * };
 * ```
 */
interface TestInitiatingEvent {
  /**
   * Name of the test initiating event
   */
  name: Identifier;
}

/**
 * Interface representing a test functional event with a state.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const functionalEvent: TestFunctionalEvent = {
 *   name: "operator-action",
 *   state: "success"
 * };
 * ```
 */
interface TestFunctionalEvent {
  /**
   * Name of the test functional event
   */
  name: Identifier;

  /**
   * State of the functional event
   */
  state: NonEmptyString;
}

/**
 * Type representing test events for scenario evaluation.
 *
 * @memberof Quantification
 * @type {TestInitiatingEvent | TestFunctionalEvent}
 *
 * @example
 * ```typescript
 * const testEvent1: TestEvent = {
 *   name: "loss-of-cooling"
 * };
 *
 * const testEvent2: TestEvent = {
 *   name: "backup-system",
 *   state: "failure"
 * };
 * ```
 */
type TestEvent = TestInitiatingEvent | TestFunctionalEvent;

/**
 * Type representing expressions for calculations in the model.
 * Can be constants, parameters, operations, functions, or random deviates.
 *
 * @memberof Quantification
 * @type {BoolExpression | IntExpression | FloatExpression | ParameterExpression | SystemMissionTimeExpression | NumericalOperation | BooleanOperation | ConditionalOperation | BuiltInFunction | RandomDeviate | TestEvent}
 *
 * @example
 * ```typescript
 * const constExpr: Expression = { value: 1.0e-5 };
 *
 * const paramExpr: Expression = {
 *   name: "failure-rate",
 *   unit: "years-1"
 * };
 *
 * const calcExpr: Expression = {
 *   mul: [
 *     { name: "lambda" },
 *     { name: "mission-time" }
 *   ]
 * };
 *
 * const condExpr: Expression = {
 *   ite: [
 *     { name: "maintenance-mode" },
 *     { value: 0.1 },
 *     { value: 0.01 }
 *   ]
 * };
 * ```
 */
type Expression =
  | BoolExpression
  | IntExpression
  | FloatExpression
  | ParameterExpression
  | SystemMissionTimeExpression
  | NumericalOperation
  | BooleanOperation
  | ConditionalOperation
  | BuiltInFunction
  | RandomDeviate
  | TestEvent;

/**
 * Interface representing a gate definition in a fault tree.
 * Gates combine events using logical formulas.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const gate: GateDefinition = {
 *   name: "system-failure",
 *   label: "System Failure",
 *   role: "public",
 *   formula: {
 *     or: [
 *       { name: "power-failure" },
 *       { name: "cooling-failure" }
 *     ]
 *   }
 * };
 * ```
 */
interface GateDefinition extends BaseElement {
  /**
   * Optional visibility role
   */
  role?: Role;

  /**
   * Logical formula defining the gate
   */
  formula: Formula;
}

/**
 * Interface representing a house event definition.
 * House events are boundary conditions that are either true or false.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const houseEvent: HouseEventDefinition = {
 *   name: "maintenance-mode",
 *   label: "System in Maintenance Mode",
 *   role: "public",
 *   constant: false
 * };
 * ```
 */
interface HouseEventDefinition extends BaseElement {
  /**
   * Optional visibility role
   */
  role?: Role;

  /**
   * Optional constant value
   */
  constant?: boolean;
}

/**
 * Interface representing a basic event definition.
 * Basic events are elementary failure events with probabilities.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const basicEvent: BasicEventDefinition = {
 *   name: "pump-failure",
 *   label: "Pump Fails to Start",
 *   role: "public",
 *   expression: {
 *     value: 1.0e-3
 *   }
 * };
 *
 * const timeDepBasicEvent: BasicEventDefinition = {
 *   name: "valve-failure",
 *   label: "Valve Fails to Operate",
 *   expression: {
 *     exponential: [
 *       { value: 1.0e-6 },
 *       { unit: "hours" }
 *     ]
 *   }
 * };
 * ```
 */
interface BasicEventDefinition extends BaseElement {
  /**
   * Optional visibility role
   */
  role?: Role;

  /**
   * Optional expression defining the event probability or rate
   */
  expression?: Expression;
}

/**
 * Interface representing a parameter definition.
 * Parameters are constants or expressions used throughout the model.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const parameter: ParameterDefinition = {
 *   name: "failure-rate",
 *   label: "Component Failure Rate",
 *   role: "public",
 *   unit: "years-1",
 *   expression: {
 *     value: 1.0e-6
 *   }
 * };
 *
 * const derivedParameter: ParameterDefinition = {
 *   name: "unavailability",
 *   label: "Component Unavailability",
 *   expression: {
 *     mul: [
 *       { name: "failure-rate" },
 *       { name: "mission-time" }
 *     ]
 *   }
 * };
 * ```
 */
interface ParameterDefinition extends BaseElement {
  /**
   * Optional visibility role
   */
  role?: Role;

  /**
   * Optional unit of the parameter
   */
  unit?: Unit;

  /**
   * Expression defining the parameter value
   */
  expression: Expression;
}

/**
 * Interface representing a Common Cause Failure group definition.
 * CCF groups model dependencies between failure events.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const betaFactorGroup: CCFGroupDefinition = {
 *   name: "pump-ccf",
 *   label: "Pumps Common Cause Failure Group",
 *   model: "beta-factor",
 *   members: {
 *     basicEvents: [
 *       { name: "pump1-failure" },
 *       { name: "pump2-failure" }
 *     ]
 *   },
 *   distribution: {
 *     expression: { value: 1.0e-4 }
 *   },
 *   factors: {
 *     factor: [
 *       {
 *         level: 2,
 *         expression: { value: 0.1 }
 *       }
 *     ]
 *   }
 * };
 *
 * const alphaFactorGroup: CCFGroupDefinition = {
 *   name: "valve-ccf",
 *   label: "Valves Common Cause Failure Group",
 *   model: "alpha-factor",
 *   members: {
 *     basicEvents: [
 *       { name: "valve1-failure" },
 *       { name: "valve2-failure" },
 *       { name: "valve3-failure" }
 *     ]
 *   },
 *   distribution: {
 *     expression: { value: 1.0e-3 }
 *   },
 *   factors: [
 *     {
 *       level: 1,
 *       expression: { value: 0.95 }
 *     },
 *     {
 *       level: 2,
 *       expression: { value: 0.04 }
 *     },
 *     {
 *       level: 3,
 *       expression: { value: 0.01 }
 *     }
 *   ]
 * };
 * ```
 */
interface CCFGroupDefinition extends BaseElement {
  /**
   * Type of CCF model
   */
  model: CCFModelType;

  /**
   * Members of the CCF group
   */
  members: {
    /**
     * Basic events affected by the common cause
     */
    basicEvents: BasicEvent[];
  };

  /**
   * Total probability distribution
   */
  distribution: {
    /**
     * Expression defining the total failure probability
     */
    expression: Expression;
  };

  /**
   * Factors for different levels of common cause failures
   */
  factors:
    | {
        /**
         * Array of factors with levels and expressions
         */
        factor: {
          /**
           * Optional level (number of concurrent failures)
           */
          level?: number;

          /**
           * Expression defining the factor value
           */
          expression: Expression;
        }[];
      }
    | {
        /**
         * Optional level (number of concurrent failures)
         */
        level?: number;

        /**
         * Expression defining the factor value
         */
        expression: Expression;
      };
}

/**
 * Interface representing a component definition in a fault tree.
 * Components can contain events, parameters, and sub-components.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const component: ComponentDefinition = {
 *   name: "cooling-system",
 *   label: "Primary Cooling System",
 *   role: "public",
 *   events: [
 *     {
 *       name: "cooling-failure",
 *       label: "Cooling System Failure",
 *       formula: {
 *         or: [
 *           { name: "pump-failure" },
 *           { name: "valve-failure" }
 *         ]
 *       }
 *     },
 *     {
 *       name: "pump-failure",
 *       label: "Pump Failure",
 *       expression: { value: 1.0e-3 }
 *     },
 *     {
 *       name: "valve-failure",
 *       label: "Valve Failure",
 *       expression: { value: 5.0e-4 }
 *     }
 *   ],
 *   parameters: [
 *     {
 *       name: "test-interval",
 *       label: "Component Test Interval",
 *       unit: "hours",
 *       expression: { value: 720 }
 *     }
 *   ],
 *   components: [
 *     {
 *       name: "backup-system",
 *       label: "Backup Cooling System",
 *       events: [
 *         {
 *           name: "backup-failure",
 *           label: "Backup System Failure",
 *           expression: { value: 2.0e-2 }
 *         }
 *       ]
 *     }
 *   ]
 * };
 * ```
 */
interface ComponentDefinition extends BaseElement {
  /**
   * Optional visibility role
   */
  role?: Role;

  /**
   * Optional CCF groups defined in this component
   */
  ccfGroups?: CCFGroupDefinition[];

  /**
   * Optional events defined in this component
   */
  events?: (GateDefinition | HouseEventDefinition | BasicEventDefinition)[];

  /**
   * Optional sub-components
   */
  components?: ComponentDefinition[];

  /**
   * Optional parameters defined in this component
   */
  parameters?: ParameterDefinition[];
}

/**
 * Interface representing a fault tree definition.
 * Fault trees model logical combinations of failure events.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const faultTree: FaultTreeDefinition = {
 *   name: "system-failure",
 *   label: "System Failure Analysis",
 *   events: [
 *     {
 *       name: "top-event",
 *       label: "System Failure",
 *       formula: {
 *         and: [
 *           { name: "primary-failure" },
 *           { name: "backup-failure" }
 *         ]
 *       }
 *     },
 *     {
 *       name: "primary-failure",
 *       label: "Primary System Failure",
 *       expression: { value: 1.0e-3 }
 *     },
 *     {
 *       name: "backup-failure",
 *       label: "Backup System Failure",
 *       expression: { value: 1.0e-2 }
 *     }
 *   ],
 *   parameters: [
 *     {
 *       name: "mission-time",
 *       label: "Mission Time",
 *       unit: "hours",
 *       expression: { value: 8760 }
 *     }
 *   ],
 *   components: [
 *     {
 *       name: "control-system",
 *       label: "Control System",
 *       events: [
 *         {
 *           name: "control-failure",
 *           label: "Control System Failure",
 *           expression: { value: 2.0e-4 }
 *         }
 *       ]
 *     }
 *   ]
 * };
 * ```
 */
interface FaultTreeDefinition extends BaseElement {
  /**
   * Optional CCF groups defined in this fault tree
   */
  ccfGroups?: CCFGroupDefinition[];

  /**
   * Optional events defined in this fault tree
   */
  events?: (GateDefinition | HouseEventDefinition | BasicEventDefinition)[];

  /**
   * Optional components defined in this fault tree
   */
  components?: ComponentDefinition[];

  /**
   * Optional parameters defined in this fault tree
   */
  parameters?: ParameterDefinition[];
}

/**
 * Interface representing a house event setting.
 * Used to set the state of house events in analyses.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const setting: SetHouseEvent = {
 *   name: "maintenance-mode",
 *   direction: "forward",
 *   value: true
 * };
 * ```
 */
interface SetHouseEvent {
  /**
   * Name of the house event to set
   */
  name: Identifier;

  /**
   * Optional direction of propagation
   */
  direction?: Direction;

  /**
   * Value to set (true or false)
   */
  value: boolean;
}

/**
 * Interface representing an instruction to collect a formula.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const collect: CollectFormula = {
 *   formula: {
 *     and: [
 *       { name: "event1" },
 *       { name: "event2" }
 *     ]
 *   }
 * };
 * ```
 */
interface CollectFormula {
  /**
   * Formula to collect
   */
  formula: Formula;
}

/**
 * Interface representing an instruction to collect an expression.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const collect: CollectExpression = {
 *   expression: {
 *     mul: [
 *       { name: "param1" },
 *       { name: "param2" }
 *     ]
 *   }
 * };
 * ```
 */
interface CollectExpression {
  /**
   * Expression to collect
   */
  expression: Expression;
}

/**
 * Interface representing an if-then-else instruction.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const ifThenElse: IfThenElse = {
 *   expression: { name: "condition" },
 *   thenInstruction: {
 *     name: "maintenance-mode",
 *     value: true
 *   },
 *   elseInstruction: {
 *     name: "maintenance-mode",
 *     value: false
 *   }
 * };
 * ```
 */
interface IfThenElse {
  /**
   * Condition expression
   */
  expression: Expression;

  /**
   * Instruction to execute if condition is true
   */
  thenInstruction: Instruction;

  /**
   * Optional instruction to execute if condition is false
   */
  elseInstruction?: Instruction;
}

/**
 * Interface representing a block of instructions.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const block: Block = {
 *   instructions: [
 *     {
 *       name: "maintenance-mode",
 *       value: true
 *     },
 *     {
 *       formula: {
 *         and: [
 *           { name: "event1" },
 *           { name: "event2" }
 *         ]
 *       }
 *     }
 *   ]
 * };
 * ```
 */
interface Block {
  /**
   * List of instructions to execute
   */
  instructions: Instruction[];
}

/**
 * Interface representing a reference to a rule.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const rule: Rule = {
 *   name: "apply-maintenance-mode"
 * };
 * ```
 */
interface Rule {
  /**
   * Name of the rule to execute
   */
  name: Identifier;
}

/**
 * Interface representing a link to another model element.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const link: Link = {
 *   name: "other-fault-tree"
 * };
 * ```
 */
interface Link {
  /**
   * Name of the element to link to
   */
  name: Identifier;
}

/**
 * Type representing instructions for analysis.
 *
 * @memberof Quantification
 * @type {SetHouseEvent | CollectFormula | CollectExpression | IfThenElse | Block | Rule | Link}
 *
 * @example
 * ```typescript
 * const instruction1: Instruction = {
 *   name: "test-mode",
 *   value: true
 * };
 *
 * const instruction2: Instruction = {
 *   formula: {
 *     or: [
 *       { name: "failure1" },
 *       { name: "failure2" }
 *     ]
 *   }
 * };
 *
 * const instruction3: Instruction = {
 *   expression: {
 *     add: [
 *       { name: "value1" },
 *       { name: "value2" }
 *     ]
 *   }
 * };
 * ```
 */
type Instruction = SetHouseEvent | CollectFormula | CollectExpression | IfThenElse | Block | Rule | Link;

/**
 * Interface representing a phase definition in an alignment.
 * Phases represent different time periods in the analysis.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const phase: PhaseDefinition = {
 *   name: "startup-phase",
 *   label: "Startup Phase",
 *   timeFraction: 0.1,
 *   setHouseEvents: [
 *     {
 *       name: "startup-mode",
 *       value: true
 *     },
 *     {
 *       name: "normal-operation",
 *       value: false
 *     }
 *   ]
 * };
 * ```
 */
interface PhaseDefinition extends BaseElement {
  /**
   * Fraction of the total mission time for this phase
   */
  timeFraction: number;

  /**
   * Optional house event settings for this phase
   */
  setHouseEvents?: SetHouseEvent[];
}

/**
 * Interface representing an alignment definition.
 * Alignments represent sequences of operational phases.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const alignment: AlignmentDefinition = {
 *   name: "plant-cycle",
 *   label: "Plant Operating Cycle",
 *   phases: [
 *     {
 *       name: "startup",
 *       label: "Plant Startup",
 *       timeFraction: 0.05,
 *       setHouseEvents: [
 *         {
 *           name: "startup-mode",
 *           value: true
 *         }
 *       ]
 *     },
 *     {
 *       name: "operation",
 *       label: "Normal Operation",
 *       timeFraction: 0.9,
 *       setHouseEvents: [
 *         {
 *           name: "normal-operation",
 *           value: true
 *         }
 *       ]
 *     },
 *     {
 *       name: "shutdown",
 *       label: "Plant Shutdown",
 *       timeFraction: 0.05,
 *       setHouseEvents: [
 *         {
 *           name: "shutdown-mode",
 *           value: true
 *         }
 *       ]
 *     }
 *   ]
 * };
 * ```
 */
interface AlignmentDefinition extends BaseElement {
  /**
   * Phases in the alignment
   */
  phases: PhaseDefinition[];
}

/**
 * Interface representing a substitution definition.
 * Substitutions define rules for model transformations.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const substitution: SubstitutionDefinition = {
 *   name: "recovery-action",
 *   label: "Operator Recovery Action",
 *   type: "recovery-rule",
 *   hypothesis: {
 *     formula: {
 *       and: [
 *         { name: "system-failure" },
 *         { name: "operator-available" }
 *       ]
 *     }
 *   },
 *   source: {
 *     basicEvents: [
 *       { name: "system-failure" }
 *     ]
 *   },
 *   target: { name: "system-failure-with-recovery" }
 * };
 * ```
 */
interface SubstitutionDefinition extends BaseElement {
  /**
   * Optional type of substitution
   */
  type?: SubstitutionType;

  /**
   * Hypothesis for when the substitution applies
   */
  hypothesis: {
    /**
     * Formula defining the condition for substitution
     */
    formula: Formula;
  };

  /**
   * Optional source basic events to replace
   */
  source?: {
    /**
     * Basic events to be replaced
     */
    basicEvents: BasicEvent[];
  };

  /**
   * Target event or constant to replace with
   */
  target: BasicEvent | boolean;
}

/**
 * Interface representing an external library definition.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const library: ExternLibraryDefinition = {
 *   name: "custom-models",
 *   label: "Custom Reliability Models Library",
 *   path: "/libs/custom-models.so",
 *   system: false,
 *   decorate: true
 * };
 * ```
 */
interface ExternLibraryDefinition extends BaseElement {
  /**
   * Path to the library file
   */
  path: string;

  /**
   * Optional flag indicating if this is a system library
   */
  system?: boolean;

  /**
   * Optional flag for function name decoration
   */
  decorate?: boolean;
}

/**
 * Type representing parameter types for external functions.
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const paramType: ExternFunctionParameterType = "double";
 * ```
 */
type ExternFunctionParameterType = "int" | "double";

/**
 * Interface representing an external function definition.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const function: ExternFunctionDefinition = {
 *   name: "custom-weibull",
 *   label: "Custom Weibull Function",
 *   symbol: "calc_weibull",
 *   library: "reliability-lib",
 *   returnType: "double",
 *   parameterTypes: ["double", "double", "double"]
 * };
 * ```
 */
interface ExternFunctionDefinition extends BaseElement {
  /**
   * Symbol name in the library
   */
  symbol: Identifier;

  /**
   * Reference to the library
   */
  library: Identifier;

  /**
   * Return type of the function
   */
  returnType: ExternFunctionParameterType;

  /**
   * Optional parameter types
   */
  parameterTypes?: ExternFunctionParameterType[];
}

/**
 * Interface representing a branch in an event tree.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const branch: Branch = {
 *   instructions: [
 *     {
 *       name: "operator-action",
 *       value: true
 *     }
 *   ],
 *   fork: {
 *     functionalEvent: "safety-system",
 *     paths: [
 *       {
 *         state: "success",
 *         branch: {
 *           endState: { sequence: { name: "safe-shutdown" } }
 *         }
 *       },
 *       {
 *         state: "failure",
 *         branch: {
 *           endState: { sequence: { name: "core-damage" } }
 *         }
 *       }
 *     ]
 *   }
 * };
 * ```
 */
interface Branch {
  /**
   * Optional instructions to execute at this branch
   */
  instructions?: Instruction[];

  /**
   * Optional fork to follow
   */
  fork?: Fork;

  /**
   * Optional end state of this branch
   */
  endState?: EndState;
}

/**
 * Interface representing a fork in an event tree.
 * Forks represent decision points based on functional events.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const fork: Fork = {
 *   functionalEvent: "operator-action",
 *   paths: [
 *     {
 *       state: "success",
 *       branch: {
 *         instructions: [
 *           {
 *             name: "operator-success",
 *             value: true
 *           }
 *         ],
 *         endState: { sequence: { name: "success-sequence" } }
 *       }
 *     },
 *     {
 *       state: "failure",
 *       branch: {
 *         instructions: [
 *           {
 *             name: "operator-success",
 *             value: false
 *           }
 *         ],
 *         endState: { sequence: { name: "failure-sequence" } }
 *       }
 *     }
 *   ]
 * };
 * ```
 */
interface Fork {
  /**
   * Functional event that determines the paths
   */
  functionalEvent: Identifier;

  /**
   * Possible paths from this fork
   */
  paths: Path[];
}

/**
 * Interface representing a path in an event tree fork.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const path: Path = {
 *   state: "success",
 *   branch: {
 *     endState: { sequence: { name: "safe-shutdown" } }
 *   }
 * };
 * ```
 */
interface Path {
  /**
   * State of the functional event for this path
   */
  state: Identifier;

  /**
   * Branch to follow for this path
   */
  branch: Branch;
}

/**
 * Type representing an end state in an event tree.
 * Can reference a sequence or another branch.
 *
 * @memberof Quantification
 * @type {{ sequence: { name: Identifier } } | { branch: { name: Identifier } }}
 *
 * @example
 * ```typescript
 * const endState1: EndState = {
 *   sequence: { name: "safe-shutdown" }
 * };
 *
 * const endState2: EndState = {
 *   branch: { name: "common-branch" }
 * };
 * ```
 */
type EndState = { sequence: { name: Identifier } } | { branch: { name: Identifier } };

/**
 * Interface representing a functional event definition in an event tree.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const functionalEvent: FunctionalEventDefinition = {
 *   name: "safety-injection",
 *   label: "Safety Injection System"
 * };
 * ```
 */
type FunctionalEventDefinition = BaseElement;

/**
 * Interface representing a sequence definition in an event tree.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const sequence: SequenceDefinition = {
 *   name: "safe-shutdown",
 *   label: "Safe Shutdown Sequence",
 *   instructions: [
 *     {
 *       formula: {
 *         and: [
 *           { name: "initiating-event" },
 *           { name: "safety-system-success" }
 *         ]
 *       }
 *     }
 *   ]
 * };
 * ```
 */
interface SequenceDefinition extends BaseElement {
  /**
   * Optional instructions for this sequence
   */
  instructions?: Instruction[];
}

/**
 * Interface representing a branch definition in an event tree.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const branchDef: BranchDefinition = {
 *   name: "common-branch",
 *   label: "Common Recovery Branch",
 *   branch: {
 *     instructions: [
 *       {
 *         name: "recovery-mode",
 *         value: true
 *       }
 *     ],
 *     fork: {
 *       functionalEvent: "operator-recovery",
 *       paths: [
 *         {
 *           state: "success",
 *           branch: {
 *             endState: { sequence: { name: "recovery-success" } }
 *           }
 *         },
 *         {
 *           state: "failure",
 *           branch: {
 *             endState: { sequence: { name: "recovery-failure" } }
 *           }
 *         }
 *       ]
 *     }
 *   }
 * };
 * ```
 */
interface BranchDefinition extends BaseElement {
  /**
   * Branch content
   */
  branch: Branch;
}

/**
 * Interface representing an initiating event definition.
 * Initiating events start accident sequences in event trees.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const initiatingEvent: InitiatingEventDefinition = {
 *   name: "loss-of-coolant",
 *   label: "Loss of Coolant Accident",
 *   eventTree: "loca-tree"
 * };
 * ```
 */
interface InitiatingEventDefinition extends BaseElement {
  /**
   * Optional reference to the event tree for this initiating event
   */
  eventTree?: Identifier;
}

/**
 * Interface representing an event tree definition.
 * Event trees model accident progression from initiating events.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const eventTree: EventTreeDefinition = {
 *   name: "loss-of-power",
 *   label: "Loss of Offsite Power Event Tree",
 *   functionalEvents: [
 *     {
 *       name: "emergency-power",
 *       label: "Emergency Power Supply"
 *     },
 *     {
 *       name: "cooling-system",
 *       label: "Cooling System"
 *     }
 *   ],
 *   sequences: [
 *     {
 *       name: "success-sequence",
 *       label: "Successful Mitigation"
 *     },
 *     {
 *       name: "core-damage",
 *       label: "Core Damage Sequence"
 *     }
 *   ],
 *   initialState: {
 *     branch: {
 *       fork: {
 *         functionalEvent: "emergency-power",
 *         paths: [
 *           {
 *             state: "success",
 *             branch: {
 *               fork: {
 *                 functionalEvent: "cooling-system",
 *                 paths: [
 *                   {
 *                     state: "success",
 *                     branch: {
 *                       endState: { sequence: { name: "success-sequence" } }
 *                     }
 *                   },
 *                   {
 *                     state: "failure",
 *                     branch: {
 *                       endState: { sequence: { name: "core-damage" } }
 *                     }
 *                   }
 *                 ]
 *               }
 *             }
 *           },
 *           {
 *             state: "failure",
 *             branch: {
 *               endState: { sequence: { name: "core-damage" } }
 *             }
 *           }
 *         ]
 *       }
 *     }
 *   }
 * };
 * ```
 */
interface EventTreeDefinition extends BaseElement {
  /**
   * Optional functional events in this event tree
   */
  functionalEvents?: FunctionalEventDefinition[];

  /**
   * Optional sequences defined in this event tree
   */
  sequences?: SequenceDefinition[];

  /**
   * Optional branches defined in this event tree
   */
  branches?: BranchDefinition[];

  /**
   * Initial state of the event tree
   */
  initialState: {
    /**
     * Branch representing the initial state
     */
    branch: Branch;
  };
}

/**
 * Interface representing a rule definition.
 * Rules define model transformations to be applied in analyses.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const rule: RuleDefinition = {
 *   name: "maintenance-rule",
 *   label: "Apply Maintenance Mode Changes",
 *   instructions: [
 *     {
 *       expression: { name: "maintenance-mode" },
 *       thenInstruction: {
 *         instructions: [
 *           {
 *             name: "backup-available",
 *             value: false
 *           },
 *           {
 *             name: "test-mode",
 *             value: true
 *           }
 *         ]
 *       },
 *       elseInstruction: {
 *         instructions: [
 *           {
 *             name: "backup-available",
 *             value: true
 *           },
 *           {
 *             name: "test-mode",
 *             value: false
 *           }
 *         ]
 *       }
 *     }
 *   ]
 * };
 * ```
 */
interface RuleDefinition extends BaseElement {
  /**
   * Instructions to execute in this rule
   */
  instructions: Instruction[];
}

/**
 * Interface representing the input data for quantification of fault trees and event trees.
 * This comprehensive interface defines the structure of models to be analyzed, including
 * basic events, gates, fault trees, event trees, and their relationships.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const input: QuantificationInput = {
 *   name: "reactor-protection-system",
 *   label: "Reactor Protection System Analysis",
 *   modelData: {
 *     basicEvents: [
 *       {
 *         name: "pump-a-fail",
 *         label: "Pump A Fails to Start",
 *         expression: { value: 1.0e-3 }
 *       },
 *       {
 *         name: "pump-b-fail",
 *         label: "Pump B Fails to Start",
 *         expression: { value: 1.2e-3 }
 *       }
 *     ],
 *     houseEvents: [
 *       {
 *         name: "maintenance-mode",
 *         label: "System in Maintenance Mode",
 *         constant: false
 *       }
 *     ],
 *     parameters: [
 *       {
 *         name: "mission-time",
 *         label: "Mission Time",
 *         unit: "hours",
 *         expression: { value: 24 }
 *       }
 *     ]
 *   },
 *   faultTrees: [
 *     {
 *       name: "cooling-system-failure",
 *       label: "Cooling System Failure Analysis",
 *       events: [
 *         {
 *           name: "cooling-failure",
 *           label: "Cooling System Failure",
 *           formula: {
 *             or: [
 *               { name: "pump-a-fail" },
 *               { name: "pump-b-fail" }
 *             ]
 *           }
 *         }
 *       ]
 *     }
 *   ],
 *   eventTrees: [
 *     {
 *       name: "loss-of-cooling",
 *       label: "Loss of Cooling Event Tree",
 *       functionalEvents: [
 *         { name: "operator-action", label: "Operator Takes Corrective Action" }
 *       ],
 *       initialState: {
 *         branch: {
 *           fork: {
 *             functionalEvent: "operator-action",
 *             paths: [
 *               {
 *                 state: "success",
 *                 branch: {
 *                   endState: { sequence: { name: "safe-shutdown" } }
 *                 }
 *               },
 *               {
 *                 state: "failure",
 *                 branch: {
 *                   endState: { sequence: { name: "core-damage" } }
 *                 }
 *               }
 *             ]
 *           }
 *         }
 *       },
 *       sequences: [
 *         { name: "safe-shutdown", label: "Safe Shutdown Sequence" },
 *         { name: "core-damage", label: "Core Damage Sequence" }
 *       ]
 *     }
 *   ],
 *   ccfGroups: [
 *     {
 *       name: "pump-ccf",
 *       label: "Pump Common Cause Failure Group",
 *       model: "beta-factor",
 *       members: {
 *         basicEvents: [
 *           { name: "pump-a-fail" },
 *           { name: "pump-b-fail" }
 *         ]
 *       },
 *       distribution: {
 *         expression: { value: 1.0e-4 }
 *       },
 *       factors: {
 *         factor: [
 *           {
 *             level: 2,
 *             expression: { value: 0.1 }
 *           }
 *         ]
 *       }
 *     }
 *   ]
 * };
 * ```
 */
export interface QuantificationInput {
  /**
   * Name of the model or analysis
   */
  name?: Identifier;

  /**
   * Human-readable label for the model
   */
  label?: NonEmptyString;

  /**
   * Additional attributes for the model
   */
  attributes?: Attribute[];

  /**
   * Global model data including basic events, house events, and parameters
   */
  modelData?: {
    /**
     * House events (boundary conditions that are either true or false)
     */
    houseEvents?: HouseEventDefinition[];

    /**
     * Basic events (elementary failure events with probabilities)
     */
    basicEvents?: BasicEventDefinition[];

    /**
     * Parameters (constants or expressions used in the model)
     */
    parameters?: ParameterDefinition[];
  };

  /**
   * Event tree definitions (models of accident progression)
   */
  eventTrees?: EventTreeDefinition[];

  /**
   * Alignment definitions (representing phases of operation)
   */
  alignments?: AlignmentDefinition[];

  /**
   * Rule definitions (instructions for model transformations)
   */
  rules?: RuleDefinition[];

  /**
   * Initiating event definitions (events that start accident sequences)
   */
  initiatingEvents?: InitiatingEventDefinition[];

  /**
   * Fault tree definitions (logical models of system failures)
   */
  faultTrees?: FaultTreeDefinition[];

  /**
   * Substitution definitions (rules for model transformations)
   */
  substitutions?: SubstitutionDefinition[];

  /**
   * Common cause failure group definitions
   */
  ccfGroups?: CCFGroupDefinition[];

  /**
   * External library definitions for custom functions
   */
  externLibraries?: ExternLibraryDefinition[];

  /**
   * External function definitions for custom calculations
   */
  externFunctions?: ExternFunctionDefinition[];
}
