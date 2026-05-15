type Identifier = string;
type Reference = string;
type NonEmptyString = string;
type Unit = "bool" | "int" | "float" | "hours" | "hours-1" | "years" | "years-1" | "fit" | "demands";
type CCFModelType = "beta-factor" | "MGL" | "alpha-factor" | "phi-factor";
type SubstitutionType = "delete-terms" | "recovery-rule" | "exchange-event";
type Role = "private" | "public";
type EventType = "gate" | "basic-event" | "house-event";
type Direction = "forward";
interface Attribute {
  name: Identifier;
  value: NonEmptyString;
  dataType?: NonEmptyString;
}
interface BaseElement {
  name: Identifier;
  label?: NonEmptyString;
  attributes?: Attribute[];
}
interface Event {
  name: Reference;
  type?: EventType;
}
interface BasicEvent {
  name: Reference;
}
interface HouseEvent {
  name: Reference;
}
interface Gate {
  name: Reference;
}
type Argument =
  | Event
  | {
      not: Event;
    }
  | boolean;
interface Formula {
  and?: Argument[];
  or?: Argument[];
  xor?: [Argument, Argument];
  iff?: [Argument, Argument];
  nand?: Argument[];
  nor?: Argument[];
  atleast?: {
    min: number;
    arguments: Argument[];
  };
  cardinality?: {
    min: number;
    max: number;
    arguments: Argument[];
  };
  imply?: [Argument, Argument];
}
interface BoolExpression {
  value: boolean;
}
interface IntExpression {
  value: number;
}
interface FloatExpression {
  value: number;
}
interface ParameterExpression {
  name: Reference;
  unit?: Unit;
}
interface SystemMissionTimeExpression {
  unit?: Unit;
}
type NumericalOperation =
  | {
      neg: Expression;
    }
  | {
      add: Expression[];
    }
  | {
      sub: Expression[];
    }
  | {
      mul: Expression[];
    }
  | {
      div: Expression[];
    }
  | {
      pi: null;
    }
  | {
      abs: Expression;
    }
  | {
      acos: Expression;
    }
  | {
      asin: Expression;
    }
  | {
      atan: Expression;
    }
  | {
      cos: Expression;
    }
  | {
      cosh: Expression;
    }
  | {
      exp: Expression;
    }
  | {
      log: Expression;
    }
  | {
      log10: Expression;
    }
  | {
      mod: [Expression, Expression];
    }
  | {
      pow: [Expression, Expression];
    }
  | {
      sin: Expression;
    }
  | {
      sinh: Expression;
    }
  | {
      tan: Expression;
    }
  | {
      tanh: Expression;
    }
  | {
      sqrt: Expression;
    }
  | {
      ceil: Expression;
    }
  | {
      floor: Expression;
    }
  | {
      min: Expression[];
    }
  | {
      max: Expression[];
    }
  | {
      mean: Expression[];
    };
type BooleanOperation =
  | {
      not: Expression;
    }
  | {
      and: Expression[];
    }
  | {
      or: Expression[];
    }
  | {
      eq: [Expression, Expression];
    }
  | {
      df: [Expression, Expression];
    }
  | {
      lt: [Expression, Expression];
    }
  | {
      gt: [Expression, Expression];
    }
  | {
      leq: [Expression, Expression];
    }
  | {
      geq: [Expression, Expression];
    };
interface IfThenElseOperation {
  ite: [Expression, Expression, Expression];
}
interface SwitchOperation {
  cases: {
    condition: Expression;
    result: Expression;
  }[];
  default: Expression;
}
type ConditionalOperation = IfThenElseOperation | SwitchOperation;
interface ExponentialFunction {
  exponential: [Expression, Expression];
}
interface GLMFunction {
  GLM: [Expression, Expression, Expression, Expression];
}
interface WeibullFunction {
  Weibull: [Expression, Expression, Expression, Expression];
}
interface PeriodicTestFunction {
  periodicTest: Expression[];
}
interface ExternFunction {
  name: Identifier;
  arguments: Expression[];
}
type BuiltInFunction = ExponentialFunction | GLMFunction | WeibullFunction | PeriodicTestFunction | ExternFunction;
interface UniformDeviate {
  uniformDeviate: [Expression, Expression];
}
interface NormalDeviate {
  normalDeviate: [Expression, Expression];
}
interface LognormalDeviate {
  lognormalDeviate: [Expression, Expression, Expression?];
}
interface GammaDeviate {
  gammaDeviate: [Expression, Expression];
}
interface BetaDeviate {
  betaDeviate: [Expression, Expression];
}
interface HistogramBin {
  binValue: Expression;
  binProbability: Expression;
}
interface HistogramDeviate {
  expression: Expression;
  bins: HistogramBin[];
}
type RandomDeviate = UniformDeviate | NormalDeviate | LognormalDeviate | GammaDeviate | BetaDeviate | HistogramDeviate;
interface TestInitiatingEvent {
  name: Identifier;
}
interface TestFunctionalEvent {
  name: Identifier;
  state: NonEmptyString;
}
type TestEvent = TestInitiatingEvent | TestFunctionalEvent;
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
interface GateDefinition extends BaseElement {
  role?: Role;
  formula: Formula;
}
interface HouseEventDefinition extends BaseElement {
  role?: Role;
  constant?: boolean;
}
interface BasicEventDefinition extends BaseElement {
  role?: Role;
  expression?: Expression;
}
interface ParameterDefinition extends BaseElement {
  role?: Role;
  unit?: Unit;
  expression: Expression;
}
interface CCFGroupDefinition extends BaseElement {
  model: CCFModelType;
  members: {
    basicEvents: BasicEvent[];
  };
  distribution: {
    expression: Expression;
  };
  factors:
    | {
        factor: {
          level?: number;
          expression: Expression;
        }[];
      }
    | {
        level?: number;
        expression: Expression;
      };
}
interface ComponentDefinition extends BaseElement {
  role?: Role;
  ccfGroups?: CCFGroupDefinition[];
  events?: (GateDefinition | HouseEventDefinition | BasicEventDefinition)[];
  components?: ComponentDefinition[];
  parameters?: ParameterDefinition[];
}
interface FaultTreeDefinition extends BaseElement {
  ccfGroups?: CCFGroupDefinition[];
  events?: (GateDefinition | HouseEventDefinition | BasicEventDefinition)[];
  components?: ComponentDefinition[];
  parameters?: ParameterDefinition[];
}
interface SetHouseEvent {
  name: Identifier;
  direction?: Direction;
  value: boolean;
}
interface CollectFormula {
  formula: Formula;
}
interface CollectExpression {
  expression: Expression;
}
interface IfThenElse {
  expression: Expression;
  thenInstruction: Instruction;
  elseInstruction?: Instruction;
}
interface Block {
  instructions: Instruction[];
}
interface Rule {
  name: Identifier;
}
interface Link {
  name: Identifier;
}
type Instruction = SetHouseEvent | CollectFormula | CollectExpression | IfThenElse | Block | Rule | Link;
interface PhaseDefinition extends BaseElement {
  timeFraction: number;
  setHouseEvents?: SetHouseEvent[];
}
interface AlignmentDefinition extends BaseElement {
  phases: PhaseDefinition[];
}
interface SubstitutionDefinition extends BaseElement {
  type?: SubstitutionType;
  hypothesis: {
    formula: Formula;
  };
  source?: {
    basicEvents: BasicEvent[];
  };
  target: BasicEvent | boolean;
}
interface ExternLibraryDefinition extends BaseElement {
  path: string;
  system?: boolean;
  decorate?: boolean;
}
type ExternFunctionParameterType = "int" | "double";
interface ExternFunctionDefinition extends BaseElement {
  symbol: Identifier;
  library: Identifier;
  returnType: ExternFunctionParameterType;
  parameterTypes?: ExternFunctionParameterType[];
}
interface Branch {
  instructions?: Instruction[];
  fork?: Fork;
  endState?: EndState;
}
interface Fork {
  functionalEvent: Identifier;
  paths: Path[];
}
interface Path {
  state: Identifier;
  branch: Branch;
}
type EndState =
  | {
      sequence: {
        name: Identifier;
      };
    }
  | {
      branch: {
        name: Identifier;
      };
    };
type FunctionalEventDefinition = BaseElement;
interface SequenceDefinition extends BaseElement {
  instructions?: Instruction[];
}
interface BranchDefinition extends BaseElement {
  branch: Branch;
}
interface InitiatingEventDefinition extends BaseElement {
  eventTree?: Identifier;
}
interface EventTreeDefinition extends BaseElement {
  functionalEvents?: FunctionalEventDefinition[];
  sequences?: SequenceDefinition[];
  branches?: BranchDefinition[];
  initialState: {
    branch: Branch;
  };
}
interface RuleDefinition extends BaseElement {
  instructions: Instruction[];
}
export interface QuantificationInput {
  name?: Identifier;
  label?: NonEmptyString;
  attributes?: Attribute[];
  modelData?: {
    houseEvents?: HouseEventDefinition[];
    basicEvents?: BasicEventDefinition[];
    parameters?: ParameterDefinition[];
  };
  eventTrees?: EventTreeDefinition[];
  alignments?: AlignmentDefinition[];
  rules?: RuleDefinition[];
  initiatingEvents?: InitiatingEventDefinition[];
  faultTrees?: FaultTreeDefinition[];
  substitutions?: SubstitutionDefinition[];
  ccfGroups?: CCFGroupDefinition[];
  externLibraries?: ExternLibraryDefinition[];
  externFunctions?: ExternFunctionDefinition[];
}
