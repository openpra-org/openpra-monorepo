import Outcome, { OutcomeJSON } from "./Outcome";
import { ProxyTypes } from "./ProxyTypes";
import GateTypes from "./GateTypes";

export interface FormulaJSON {
  _proxy: ProxyTypes;
  outcome?: OutcomeJSON;
  expr?: GateTypes;
  formulas?: OutcomeJSON[];
  min_value?: number;
}

export default class Formula {
  private proxy: ProxyTypes;
  private outcome?: Outcome;
  private expr?: GateTypes;
  private outcomes?: Outcome[];

  private minValue?: number;
  private minValueSet: boolean;

  /**
   * Parse object based on its proxyTypes.
   * Expect the proxyTypes type to be either
   * {@link ProxyTypes#EVENT_REFERENCE} or
   * {@link ProxyTypes#LOGICAL_EXPRESSION}.
   *
   * @param {Object<String, *>} obj - Dictionary object to parse.
   *  Expect the format from {@link Formula#toJSON}.
   * @throws Will throw an error if the proxyTypes are not valid.
   */
  constructor(
    obj: FormulaJSON | OutcomeJSON = { _proxy: ProxyTypes.EVENT_REFERENCE },
  ) {
    this.proxy = obj._proxy || ProxyTypes.EVENT_REFERENCE;
    switch (this.proxy) {
      case ProxyTypes.EVENT_REFERENCE:
        this.outcome = Outcome.build(obj);
        break;
      case ProxyTypes.LOGICAL_EXPRESSION:
        // @ts-expect-error
        const formulas = obj.formulas || [];
        // @ts-expect-error
        this.expr = obj.expr;
        // @ts-expect-error
        this.outcomes = formulas.map((formula) => Outcome.build(formula));

        this.minValueSet = "min_value" in obj;
        // @ts-expect-error
        this.minValue = this.minValueSet ? obj.min_value : 0;
        break;
      default:
        throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }
  }

  /**
   * @return {FormulaJSON|OutcomeJSON} - dictionary object that describes this
   * @throws Will throws an error if the proxyTypes is not valid.
   */
  toJSON(): FormulaJSON | OutcomeJSON {
    switch (this.proxy) {
      case ProxyTypes.EVENT_REFERENCE:
        return this.outcome.toJSON();
      case ProxyTypes.LOGICAL_EXPRESSION:
        const json = {
          formulas: this.outcomes.map((outcome) => outcome.toJSON()),
          expr: this.expr,
          _proxy: this.proxy,
        };
        if (this.minValueSet) {
          // @ts-expect-error
          json.min_value = Number(this.minValue);
        }
        return json;
      default:
        throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }
  }

  /**
   * @returns {GateTypes}
   * @throws Will throws an error if the proxyTypes type is not {@link ProxyTypes#LOGICAL_EXPRESSION}
   */
  getExpression(): GateTypes {
    if (this.proxy !== ProxyTypes.LOGICAL_EXPRESSION) {
      throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }
    return this.expr;
  }

  /**
   * @param {ProxyTypes} expr
   * @throws Will throws an error if the proxyTypes type is not {@link ProxyTypes#LOGICAL_EXPRESSION}
   */
  setExpression(expr: GateTypes) {
    if (this.proxy !== ProxyTypes.LOGICAL_EXPRESSION) {
      throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }
    this.expr = expr;
  }

  /**
   * @return {Outcome}
   * @throws Will throws an error if the proxyTypes type is not {@link ProxyTypes#EVENT_REFERENCE}
   */
  getOutcome(): Outcome {
    if (this.proxy !== ProxyTypes.EVENT_REFERENCE) {
      throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }

    return this.outcome;
  }

  /**
   * @param {Outcome} outcome
   * @throws Will throws an error if the proxyTypes type is not {@link proxyTypes#EVENT_REFERENCE}
   */
  setOutcome(outcome: Outcome) {
    if (this.proxy !== ProxyTypes.EVENT_REFERENCE) {
      throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }
    this.outcome = outcome;
  }

  /**
   * @return {Outcome[]}
   * @throws Will throws an error if the proxyTypes type is not {@link ProxyTypes#LOGICAL_EXPRESSION}
   */
  getOutcomes(): Outcome[] {
    if (this.proxy !== ProxyTypes.LOGICAL_EXPRESSION) {
      throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }
    return this.outcomes;
  }

  /**
   * @param {Outcome[]} formulas
   * @throws Will throws an error if the proxyTypes type is not {@link ProxyTypes#LOGICAL_EXPRESSION}
   */
  setOutcomes(formulas: Outcome[]) {
    if (this.proxy !== ProxyTypes.LOGICAL_EXPRESSION) {
      throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }
    this.outcomes = formulas;
  }

  /**
   * @return {ProxyTypes}
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

  getMinValue(): number {
    return this.minValueSet ? this.minValue : null;
  }

  setMinValue(value: number): void {
    this.minValueSet = true;
    this.minValue = value;
  }

  /**
   * Inverts this formula.
   * This is useful when converting failure path to
   * success path or vice versa
   * @see {@link FunctionalEventSelectionDialog#handleSave}
   * @return {Formula} - inverted formula
   */
  inverse(): Formula {
    if (
      this.proxy !== ProxyTypes.EVENT_REFERENCE &&
      this.proxy !== ProxyTypes.LOGICAL_EXPRESSION
    ) {
      throw new Error(`Formula proxy "${this.proxy}" is not supported`);
    }

    // failure to success
    if (this.proxy === ProxyTypes.EVENT_REFERENCE) {
      return new Formula({
        formulas: [this.outcome.toJSON()],
        expr: GateTypes.NOT,
        _proxy: ProxyTypes.LOGICAL_EXPRESSION,
      });
    }
    // success to failure
    else {
      return new Formula(this.outcomes[0].toJSON());
    }
  }

  clone(): Formula {
    return new Formula(this.toJSON());
  }

  toString(): string {
    switch (this.proxy) {
      case ProxyTypes.EVENT_REFERENCE:
        //TODO:: FIX
        return "";
      //return FaultTreeTransferGateVertexValue.getSubLabelString(this);
      default:
        return this.proxy;
    }
  }
}
