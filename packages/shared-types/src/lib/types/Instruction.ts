import ProxyTypes from "./ProxyTypes";
import Expression, { ExpressionJSON } from "./Expression";
import Formula, { FormulaJSON } from "./Formula";
import { OutcomeJSON } from "./Outcome";

interface InstructionJSON {
  formula?: FormulaJSON | OutcomeJSON;
  expression?: ExpressionJSON;
  _proxy: ProxyTypes;
}

class Instruction {
  private formula?: Formula;
  private expression?: Expression;
  private proxy: ProxyTypes;

  /**
   * Parse object based on its proxyTypes.
   * Expect the proxyTypes type to be either
   * {@link ProxyTypes.COLLECT_EXPRESSION}
   * or {@link ProxyTypes.COLLECT_FORMULA}
   *
   * @param {Object<String, *>} obj - Dictionary object to parse.
   *  Expect the format from {@link Instruction.toJSON}.
   * @throw Will throws an error if obj does not have valid
   *  _proxy field.
   */
  constructor(obj: InstructionJSON = { _proxy: ProxyTypes.COLLECT_EXPRESSION }) {
    this.proxy = obj._proxy || ProxyTypes.COLLECT_EXPRESSION;
    switch (this.proxy) {
      case ProxyTypes.COLLECT_FORMULA:
        // @ts-expect-error
        this.formula = new Formula(obj.formula);
        break;
      case ProxyTypes.COLLECT_EXPRESSION:
        this.expression = new Expression(obj.expression);
        break;
      default:
        throw new Error(`Instruction of proxy "${this.proxy}" is not registerd`);
    }
  }

  /**
   * Parse object into JSON format based on its proxyTypes
   * @return {Object<String, *>} - dictionary that represents this object
   * @throw Will throws an error if obj does not have valid
   *  _proxy field.
   */
  toJSON(): InstructionJSON {
    switch (this.proxy) {
      case ProxyTypes.COLLECT_FORMULA:
        return {
          formula: this.formula.toJSON(),
          _proxy: this.proxy,
        };
      case ProxyTypes.COLLECT_EXPRESSION:
        if (this.expression.getProxy() === ProxyTypes.LOGICAL_EXPRESSION) {
          return {
            formula: this.expression.toJSON(),
            _proxy: this.proxy,
          };
        } else {
          return {
            expression: this.expression.toJSON(),
            _proxy: this.proxy,
          };
        }
      default:
        throw new Error(`Instruction of proxy "${this.proxy}" is not registerd`);
    }
  }

  /**
   * @return {Formula}
   */
  getFormula(): Formula {
    return this.formula;
  }

  /**
   * @param {Formula} formula
   */
  setFormula(formula: Formula) {
    this.formula = formula;
  }

  /**
   * @return {Expression}
   */
  getExpression(): Expression {
    return this.expression;
  }

  /**
   * @param {Expression} expression
   */
  setExpression(expression: Expression) {
    this.expression = expression;
  }

  /**
   * @return {String}
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
   * Return inverted version of this instruction.
   * This is useful when converting failure path instructions
   * to success path instructions.
   * @see {@link FunctionalEventSelectionDialog#handleSave}
   * @return {Instruction} - inverted instruction
   * @throw Will throws an error if the proxyTypes is not valid
   */
  inverse(): Instruction {
    switch (this.proxy) {
      case ProxyTypes.COLLECT_FORMULA:
        return new Instruction({
          formula: this.formula.inverse().toJSON(),
          _proxy: this.proxy,
        });
      case ProxyTypes.COLLECT_EXPRESSION:
        return new Instruction({
          expression: this.expression.inverse().toJSON(),
          _proxy: this.proxy,
        });
      default:
        throw new Error(`Instruction of proxy "${this.proxy}" is not registered`);
    }
  }

  clone(): Instruction {
    return new Instruction(this.toJSON());
  }
}

export default Instruction;
export { Instruction, InstructionJSON };
