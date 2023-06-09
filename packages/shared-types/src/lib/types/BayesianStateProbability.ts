import {Parsable} from "./Parsable";
import Expression, { ExpressionJSON } from "./Expression";
import Outcome, { OutcomeJSON } from "./Outcome";
import Clonable from "./Clonable";
export interface BayesianStateProbabilityJSON {
  expression: ExpressionJSON;
  states?: OutcomeJSON[];
}
export type BayesianStateProbabilityJSONMap = {[key: string]: BayesianStateProbabilityJSON};


export default class BayesianStateProbability implements Parsable<BayesianStateProbabilityJSONMap, BayesianStateProbabilityJSON>, Clonable<BayesianStateProbabilityJSON, BayesianStateProbability> {
  protected expression: Expression;
  protected states: Outcome[];

  constructor(expression: Expression = new Expression(), states: Outcome[] = []) {
    this.expression = expression;
    this.states = states;
  }

  getDefaultJSON(): BayesianStateProbabilityJSON {
    return  {
      expression: new Expression().toJSON(),
      states: []
    };
  }

  toJSON(): BayesianStateProbabilityJSON {
    return {
      expression: this.expression.toJSON(),
      states: this.states.map((state: Outcome) => state.toJSON()),
    };
  }

  clone(json?: BayesianStateProbabilityJSON): BayesianStateProbability {
    if (json) {
      return BayesianStateProbability.build(json);
    }
    const states = this.states.map((state: Outcome) => state.clone());
    return new BayesianStateProbability(this.expression.clone(), states);
  }

  static build(json: BayesianStateProbabilityJSON): BayesianStateProbability {
    const states = json.states?.map((stateJSON: OutcomeJSON) => Outcome.build(stateJSON));
    return new BayesianStateProbability(new Expression(json.expression), states);
  }

}
