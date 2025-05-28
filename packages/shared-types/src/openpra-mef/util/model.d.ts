// Top-level PRA Model
export interface Model {
  name?: string;
  description?: string;
  eventTrees?: EventTree[];
  faultTrees?: FaultTree[];
  ccfGroups?: CCFGroup[];
  modelData?: Value[];
}

// Event Tree
export interface EventTree {
  name: string;
  description?: string;
  initiatingEvents?: InitiatingEvent[];
  eventSequences?: EventSequence[];
}

// Initiating Event
export interface InitiatingEvent {
  name: string;
  description?: string;
  group?: { name?: string; description?: string; subGroup?: { name?: string; description?: string } };
  frequency: number; // frequency is usually expressed in float value
  unit: "yr-1" | "ryr-1" | "rcyr-1"; // per year | per reactor year | per reactor critical year;
}

// Sequence
export interface EventSequence {
  functionalEvents: FunctionalEvent[];
  endState: string;
}

export interface FunctionalEvent {
  name: string;
  state: "failure" | "success" | "bypass";
  refGate: Gate;
}

// Fault Tree
export interface FaultTree {
  name: string;
  description?: string;
  topEvent: Gate;
  ccfGroups?: CCFGroup[];
}

//
export interface Gate {
  name: string;
  description?: string;
  type?: GateType;
  gates?: Gate[];
  events?: Event[];
}

// Gate Types
export type GateType = "and" | "or" | "not" | "xor" | "nand" | "nor" | "iff" | "atleast" | "cardinality" | "imply";

// Event
export interface Event {
  name: string;
  description?: string;
  type?: "basic" | "house" | "undeveloped";
  value?: Value;
  systemMissionTime?: number;
}

// CCF Group
export interface CCFGroup {
  name: string;
  description?: string;
  model: "beta-factor" | "MGL" | "alpha-factor";
  members: string[]; // list of basic event names
  distribution: Value;
  factors: Factor[];
}

// CCF Factor
export interface Factor {
  level?: number;
  factorValue: number;
}

// Value types
export type Value = boolean | number | Parameter | BuiltInFunction | RandomDeviate | NumericalOperation;

// Parameter
export interface Parameter {
  name: string;
  description?: string;
  value: Value;
  unit?: Unit;
}

// Built-in Functions
export type BuiltInFunction =
  | { exponential: [Value, Value] }
  | { GLM: [Value, Value, Value, Value] }
  | { Weibull: [Value, Value, Value, Value] }
  | { periodicTest: Value[] };

// Random Deviates
export type RandomDeviate =
  | { uniformDeviate: [Value, Value] }
  | { normalDeviate: [Value, Value] }
  | { lognormalDeviate: [Value, Value, Value?] }
  | { gammaDeviate: [Value, Value] }
  | { betaDeviate: [Value, Value] }
  | { histogram: { base: Value; bins: [Value, Value][] } };

// Numerical Operations
export type NumericalOperation =
  | { neg: Value }
  | { add: Value[] }
  | { sub: Value[] }
  | { mul: Value[] }
  | { div: Value[] }
  | { pi: Value }
  | { abs: Value }
  | { acos: Value }
  | { asin: Value }
  | { atan: Value }
  | { cos: Value }
  | { cosh: Value }
  | { exp: Value }
  | { log: Value }
  | { log10: Value }
  | { mod: [Value, Value] }
  | { pow: [Value, Value] }
  | { sin: Value }
  | { sinh: Value }
  | { tan: Value }
  | { tanh: Value }
  | { sqrt: Value }
  | { ceil: Value }
  | { floor: Value }
  | { min: Value[] }
  | { max: Value[] }
  | { mean: Value[] };

export type Unit = "unitless" | "bool" | "int" | "float" | "hours" | "hour-1" | "years" | "year-1" | "fit" | "demands";
