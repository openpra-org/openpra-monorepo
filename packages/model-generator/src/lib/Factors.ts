/**
 * @remarks This file contains the Factors class which is used to manage and calculate various factors related to a
 * fault tree. The Factors class provides methods to set and get various factors such as the number of basic events,
 * house events, ccf groups, etc. It also provides methods to calculate derived factors and to sample gate operators and
 * the number of arguments for a given gate type.
 */

import { Gate } from "./Gate";
import { FactorError } from "./FactorError";

/**
 * @public Factors
 * @remarks This class is used to manage and calculate various factors related to a fault tree. The Factors class
 * provides methods to set and get various factors such as the number of basic events, house events, ccf groups, etc. It
 * also provides methods to calculate derived factors and to sample gate operators and the number of arguments for a
 * given gate type.
 */
export class Factors {
  // Constant configurations
  private static readonly operators = ["and", "or", "atleast", "not", "xor"]; // the order matters

  // Probabilistic factors
  minProb = 0;
  maxProb = 1;

  // Configurable graph factors
  numBasic = 0;
  numHouse = 0;
  numCcf = 0;
  commonB = 0;
  commonG = 0;
  numArgs = 0;
  parentsB = 0;
  parentsG = 0;
  ccfModel = 0;
  ccfSize = 0;

  private weightsG: number[] = []; // should not be set directly

  // Calculated factors
  private normWeights: number[] = []; // normalized weights
  private cumDist: number[] = []; // CDF from the weights of the gate types
  private maxArgs = 0; // the upper bound for the number of arguments
  private ratio = 0; // basic events to gates ratio per gate
  private percentBasic = 0; // % of basic events in gate arguments
  private percentGate = 0; // % of gates in gate arguments

  /**
   * @remarks Calculates the maximum number of arguments for sampling. This method is used to calculate the maximum
   * number of arguments for sampling. The result may have a fractional part that must be adjusted in sampling
   * accordingly.
   *
   * @param numArgs - The average number of arguments for gates.
   * @param weights - Normalized weights for gate types.
   * @returns The upper bound for sampling in symmetric distributions.
   */
  private static calculateMaxArgs(numArgs: number, weights: number[]): number {
    // Min numbers for AND, OR, K/N, NOT, XOR types.
    const minArgs = [2, 2, 3, 1, 2];
    // Note that max and min numbers are the same for NOT and XOR.
    const constArgs = minArgs.slice(3);
    const constWeights = weights.slice(3);
    const constContrib = constArgs.map((x, i) => x * constWeights[i]);

    // AND, OR, K/N gate types can have the varying number of args.
    const varArgs = minArgs.slice(0, 3);
    const varWeights = weights.slice(0, 3);
    const varContrib = varArgs.map((x, i) => x * varWeights[i]);

    // AND, OR, K/N gate types can have the varying number of arguments.
    // Since the distribution is symmetric, the average is (max + min) / 2.
    return (
      (2 * numArgs - varContrib.reduce((a, b) => a + b, 0) - 2 * constContrib.reduce((a, b) => a + b, 0)) /
      varWeights.reduce((a, b) => a + b, 0)
    );
  }

  /**
   * @remarks Sets the probability boundaries for basic events. This method is used to set the minimum and maximum
   * probabilities for basic events.
   *
   * @param minValue - The lower inclusive boundary.
   * @param maxValue - The upper inclusive boundary.
   * @throws FactorError Invalid values or setup.
   */
  setMinMaxProb(minValue: number, maxValue: number): void {
    if (minValue < 0 || minValue > 1) {
      throw new FactorError("Min probability must be in [0, 1] range.");
    }
    if (maxValue < 0 || maxValue > 1) {
      throw new FactorError("Max probability must be in [0, 1] range.");
    }
    if (minValue > maxValue) {
      throw new FactorError("Min probability > Max probability.");
    }
    this.minProb = minValue;
    this.maxProb = maxValue;
  }

  /**
   * @remarks Sets the factors for the number of common events. This method is used to set the factors for the number of
   * common basic events and common gates per gate, and the average number of parents for common basic events and common
   * gates.
   *
   * @param commonB - The percentage of common basic events per gate.
   * @param commonG - The percentage of common gates per gate.
   * @param parentsB - The average number of parents for common basic events.
   * @param parentsG - The average number of parents for common gates.
   * @throws FactorError Invalid values or setup.
   */
  setCommonEventFactors(commonB: number, commonG: number, parentsB: number, parentsG: number): void {
    const maxCommon = 0.9; // a practical limit (not a formal constraint)
    if (commonB <= 0 || commonB > maxCommon) {
      throw new FactorError(`common_b not in (0, ${String(maxCommon)}].`);
    }
    if (commonG <= 0 || commonG > maxCommon) {
      throw new FactorError(`common_g not in (0, ${String(maxCommon)}]..`);
    }
    const maxParent = 100; // also a practical limit
    if (parentsB < 2 || parentsB > maxParent) {
      throw new FactorError(`parents_b not in [2, ${String(maxParent)}].`);
    }
    if (parentsG < 2 || parentsG > maxParent) {
      throw new FactorError(`parents_g not in [2, ${String(maxParent)}].`);
    }
    this.commonB = commonB;
    this.commonG = commonG;
    this.parentsB = parentsB;
    this.parentsG = parentsG;
  }

  /**
   * @remarks Sets the size factors. This method is used to set the size factors such as the average number of arguments
   * for gates, the number of basic events, house events, ccf groups, etc.
   *
   * @param numArgs - The average number of arguments for gates.
   * @param numBasic - The number of basic events.
   * @param numHouse - The number of house events.
   * @param numCcf - The number of ccf groups.
   * @param ccfModel - Model used to solve CCF, MGL or alpha-factor
   * @param ccfSize - Size of the CCF group
   * @throws FactorError Invalid values or setup.
   */
  setNumFactors(numArgs: number, numBasic: number, numHouse = 0, numCcf = 0, ccfModel = 0, ccfSize = 0): void {
    if (numArgs < 2) {
      throw new FactorError("avg. # of gate arguments can't be less than 2.");
    }
    if (numBasic < 1) {
      throw new FactorError("# of basic events must be more than 0.");
    }
    if (numHouse < 0) {
      throw new FactorError("# of house events can't be negative.");
    }
    if (numCcf < 0) {
      throw new FactorError("# of CCF groups can't be negative.");
    }
    if (numHouse >= numBasic) {
      throw new FactorError("Too many house events.");
    }
    if (numCcf > numBasic / numArgs) {
      throw new FactorError("Too many CCF groups.");
    }
    this.numArgs = numArgs;
    this.numBasic = numBasic;
    this.numHouse = numHouse;
    this.numCcf = numCcf;
    this.ccfModel = ccfModel;
    this.ccfSize = ccfSize;
  }

  /**
   * @remarks Calculates any derived factors from the setup. This method is used to calculate any derived factors from
   * the setup. This function must be called after all public factors are initialized.
   */
  calculate(): void {
    this.maxArgs = Factors.calculateMaxArgs(this.numArgs, this.normWeights);
    const gFactor = 1 - this.commonG + (this.parentsG === 0 ? 0 : this.commonG / this.parentsG);
    this.ratio = this.numArgs * gFactor - 1;
    this.percentBasic = this.ratio / (1 + this.ratio);
    this.percentGate = 1 / (1 + this.ratio);
  }

  /**
   * @remarks Provides weights for gate types. This method is used to get the weights for gate types.
   *
   * @returns Expected to return weights from the arguments.
   */
  getGateWeights(): number[] {
    if (this.weightsG.length === 0) {
      throw new Error("weightsG is not set");
    }
    return this.weightsG;
  }

  /**
   * @remarks Updates gate type weights. This method is used to update the weights for gate types. The weights must have
   * the same order as in OPERATORS list. If weights for some operators are missing, they are assumed to be 0.
   *
   * @param weights - Weights of gate types.
   * @throws FactorError Invalid weight values or setup.
   */
  setGateWeights(weights: number[]): void {
    if (weights.length === 0) {
      throw new FactorError("No weights are provided");
    }
    if (weights.some((i) => i < 0)) {
      throw new FactorError("Weights cannot be negative");
    }
    if (weights.length > Factors.operators.length) {
      throw new FactorError("Too many weights are provided");
    }
    if (weights.reduce((a, b) => a + b, 0) === 0) {
      throw new FactorError("At least one non-zero weight is needed");
    }
    if (weights.length > 3 && weights.slice(0, 3).reduce((a, b) => a + b, 0) === 0) {
      throw new FactorError("Cannot work with only XOR or NOT gates");
    }

    this.weightsG = weights.slice();
    for (let i = 0; i < Factors.operators.length - weights.length; i++) {
      this.weightsG.push(0); // padding for missing weights
    }
    this.normWeights = this.weightsG.map((x) => x / this.weightsG.reduce((a, b) => a + b, 0));
    this.cumDist = this.normWeights.slice();
    this.cumDist.unshift(0);
    for (let i = 1; i < this.cumDist.length; i++) {
      this.cumDist[i] += this.cumDist[i - 1];
    }
  }

  /**
   * @remarks Samples the gate operator. This method is used to sample a gate operator randomly.
   *
   * @returns A randomly chosen gate operator.
   */
  getRandomOperator(): string {
    const rNum = Math.random();
    let binNum = 1;
    while (this.cumDist[binNum] <= rNum) {
      binNum += 1;
    }
    return Factors.operators[binNum - 1];
  }

  /**
   * @remarks Randomly selects the number of arguments for the given gate type. This method is used to randomly select
   * the number of arguments for a given gate type. This function has a side effect. It sets k_num for the K/N type of
   * gates depending on the number of arguments.
   *
   * @param gate - The parent gate for arguments.
   * @returns Random number of arguments.
   */
  getNumArgs(gate: Gate): number {
    if (gate.operator === "not") {
      return 1;
    }
    if (gate.operator === "xor") {
      return 2;
    }

    let maxArgs = Math.floor(this.maxArgs);
    // Dealing with the fractional part.
    if (Math.random() < this.maxArgs - maxArgs) {
      maxArgs += 1;
    }

    if (gate.operator === "atleast") {
      if (maxArgs < 3) {
        maxArgs = 3;
      }
      const numArgs = Math.floor(Math.random() * (maxArgs - 3 + 1)) + 3;
      gate.kNum = Math.floor(Math.random() * (numArgs - 2 + 1)) + 2;
      return numArgs;
    }
    return Math.floor(Math.random() * (maxArgs - 2 + 1)) + 2;
  }

  /**
   * @remarks Returns the percentage of gates that should be in arguments. This method is used to get the percentage of
   * gates that should be in arguments.
   *
   * @returns The percentage of gates that should be in arguments.
   */
  getPercentGate(): number {
    return this.percentGate;
  }

  /**
   * @remarks Approximates the number of gates in the resulting fault tree. This method is used to approximate the
   * number of gates in the resulting fault tree. This is an estimate of the number of gates needed to initialize the
   * fault tree with the given number of basic events and fault tree properties.
   *
   * @returns The number of gates needed for the given basic events.
   */
  getNumGate(): number {
    const bFactor = 1 - this.commonB + (this.parentsB === 0 ? 0 : this.commonB / this.parentsB);
    return Math.floor(this.numBasic / (this.percentBasic * this.numArgs * bFactor));
  }

  /**
   * @remarks Estimates the number of common basic events. This method is used to estimate the number of common basic
   * events. These common basic events must be chosen from the total number of basic events in order to ensure the
   * correct average number of parents.
   *
   * @param numGate - The total number of gates in the future fault tree
   * @returns The estimated number of common basic events.
   */
  getNumCommonBasic(numGate: number): number {
    return Math.floor((this.commonB * this.percentBasic * this.numArgs * numGate) / this.parentsB);
  }

  /**
   * @remarks Estimates the number of common gates. This method is used to estimate the number of common gates. These
   * common gates must be chosen from the total number of gates in order to ensure the correct average number of parents.
   *
   * @param numGate - The total number of gates in the future fault tree
   * @returns The estimated number of common gates.
   */
  getNumCommonGate(numGate: number): number {
    return Math.floor((this.commonG * this.percentGate * this.numArgs * numGate) / this.parentsG);
  }
}
