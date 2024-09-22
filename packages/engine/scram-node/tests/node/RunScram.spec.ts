import fs from "node:fs";
import { ScramAddonType } from "shared-types/src/openpra-mef/util/scram-addon-type";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import {
  InvalidLimits1,
  InvalidLimits2,
  InvalidLimits3,
  InvalidLimits4,
  InvalidLimits5,
  InvalidLimits6,
  InvalidLimits7,
  InvalidLimits8,
  InvalidCombination3,
  InvalidCombination4,
  InvalidCombination5,
} from "microservice-job-broker/tests/input/quantification/invalid-request";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const scramAddon: ScramAddonType = require("../../build/Release/scram-node.node") as ScramAddonType;

/**
 * Synchronous scram-node-addon tests:
 * 1. Invalid limit-order in request body
 * 2. Invalid cut-off in request body
 * 3. Invalid num-trials in request body
 * 4. Invalid num-quantiles in request body
 * 5. Invalid num-bins in request body
 * 6. Invalid seed in request body
 * 7. Invalid mission-time in request body
 * 8. Invalid time-step in request body
 * 9. Approximation used while evaluating prime implicants
 * 10. Prime implicants evaluated without BDD algorithm
 * 11. Safety integrity levels evaluated without providing time step
 * TODO: Include testing for all the exceptions thrown from scram.cc file.
 *
 * All tests expect the RunScramCli() method to throw an error when given invalid input.
 */

/*
 * Create a temporary xml file for storing a model from the aralia folder.
 * If generic strings are passed in the "models" array, then the error will be
 * thrown for invalid input files, not for the invalid key types. So we want to
 * pass valid input files so that we can test invalid key inputs.
 */
const model = fs.readFileSync("./packages/microservice/job-broker/tests/input/aralia/xml/chinese.xml");
if (!fs.existsSync("/tmp/model1.xml")) {
  fs.writeFileSync("/tmp/model1.xml", model);
}

/**
 * Helper function to test invalid inputs for scramAddon.RunScramCli
 * @param invalidInput - The invalid input to test
 * @returns A function that runs RunScramCli with the invalid input
 */
const testInvalidInput = (invalidInput: QuantifyRequest): (() => void) => {
  invalidInput.models = ["/tmp/model1.xml"];
  return () => {
    scramAddon.RunScramCli(invalidInput);
  };
};

describe("synchronous scram-node-wrapper tests", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  it("should throw an error when the request body contains invalid limit-order", () => {
    expect(testInvalidInput(InvalidLimits1)).toThrow();
  });

  it("should throw an error when the request body contains invalid cut-off", () => {
    expect(testInvalidInput(InvalidLimits2)).toThrow();
  });

  it("should throw an error when the request body contains invalid num-trials", () => {
    expect(testInvalidInput(InvalidLimits3)).toThrow();
  });

  it("should throw an error when the request body contains invalid num-quantiles", () => {
    expect(testInvalidInput(InvalidLimits4)).toThrow();
  });

  it("should throw an error when the request body contains invalid num-bins", () => {
    expect(testInvalidInput(InvalidLimits5)).toThrow();
  });

  it("should throw an error when the request body contains invalid seed", () => {
    expect(testInvalidInput(InvalidLimits6)).toThrow();
  });

  it("should throw an error when the request body contains invalid mission-time", () => {
    expect(testInvalidInput(InvalidLimits7)).toThrow();
  });

  it("should throw an error when the request body contains invalid time-step", () => {
    expect(testInvalidInput(InvalidLimits8)).toThrow();
  });

  it("should throw an error if any approximation is used while evaluating the prime implicants", () => {
    expect(testInvalidInput(InvalidCombination3)).toThrow();
  });

  it("should throw an error if prime implicants are being evaluated without BDD algorithm", () => {
    expect(testInvalidInput(InvalidCombination4)).toThrow();
  });

  it("should throw an error if safety integrity levels are being evaluated without providing time step", () => {
    expect(testInvalidInput(InvalidCombination5)).toThrow();
  });
});
