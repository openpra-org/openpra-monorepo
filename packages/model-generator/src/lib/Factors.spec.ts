import { Factors } from "./Factors";

describe("Factors", () => {
  let factors: Factors;

  beforeEach(() => {
    factors = new Factors();
  });

  test("setMinMaxProb should set min and max probabilities", () => {
    factors.setMinMaxProb(0.1, 0.9);
    expect(factors.minProb).toBe(0.1);
    expect(factors.maxProb).toBe(0.9);
  });

  test("setCommonEventFactors should set common event factors", () => {
    factors.setCommonEventFactors(0.1, 0.2, 2, 3);
    expect(factors.commonB).toBe(0.1);
    expect(factors.commonG).toBe(0.2);
    expect(factors.parentsB).toBe(2);
    expect(factors.parentsG).toBe(3);
  });

  test("setNumFactors should set number factors", () => {
    factors.setNumFactors(3, 100, 10, 5);
    expect(factors.numArgs).toBe(3);
    expect(factors.numBasic).toBe(100);
    expect(factors.numHouse).toBe(10);
    expect(factors.numCcf).toBe(5);
  });

  test("setGateWeights should set gate weights", () => {
    factors.setGateWeights([0.1, 0.2, 0.3, 0.4]);
    expect(factors.getGateWeights()).toEqual([0.1, 0.2, 0.3, 0.4, 0]);
  });

  test("getRandomOperator should return a random operator", () => {
    factors.setGateWeights([0.1, 0.2, 0.3, 0.4]);
    const operator = factors.getRandomOperator();
    expect(["and", "or", "atleast", "not", "xor"]).toContain(operator);
  });

  test("getPercentGate should return the percentage of gates", () => {
    factors.setGateWeights([0.1, 0.2, 0.3, 0.4]);
    factors.setNumFactors(3, 100, 10, 5);
    factors.calculate();
    const percentGate = factors.getPercentGate();
    expect(percentGate).toBeCloseTo(0.33);
  });

  test("getNumGate should return the number of gates", () => {
    factors.setGateWeights([0.1, 0.2, 0.3, 0.4]);
    factors.setNumFactors(3, 100, 10, 5);
    factors.calculate();
    const numGate = factors.getNumGate();
    expect(numGate).toBeGreaterThanOrEqual(50);
  });

  test("getNumCommonBasic should return the number of common basic events", () => {
    factors.setGateWeights([0.1, 0.2, 0.3, 0.4]);
    factors.setNumFactors(3, 100, 10, 5);
    factors.setCommonEventFactors(0.1, 0.2, 2, 3);
    factors.calculate();
    const numCommonBasic = factors.getNumCommonBasic(factors.getNumGate());
    expect(numCommonBasic).toBeGreaterThanOrEqual(0);
  });

  test("getNumCommonGate should return the number of common gates", () => {
    factors.setGateWeights([0.1, 0.2, 0.3, 0.4]);
    factors.setNumFactors(3, 100, 10, 5);
    factors.setCommonEventFactors(0.1, 0.2, 2, 3);
    factors.calculate();
    const numCommonGate = factors.getNumCommonGate(factors.getNumGate());
    expect(numCommonGate).toBeGreaterThanOrEqual(0);
  });
});
