import fs from "node:fs";
import { AsyncScramAddonType } from "shared-types/src/openpra-mef/util/scram-addon-type";
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
const scramAddon: AsyncScramAddonType = require("../../build/Release/scram-node.node") as AsyncScramAddonType;

/**
 * Asynchronous scram-node-addon tests:
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
 * The tests use a Promise-based approach to handle the asynchronous nature of the RunScramCli function.
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
 * @returns A promise that rejects with an error
 */
const testInvalidInput = async (invalidInput: QuantifyRequest): Promise<void> => {
  invalidInput.models = ["/tmp/model1.xml"];
  return new Promise<void>((resolve, reject) => {
    scramAddon.RunScramCli(invalidInput, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

describe("asynchronous scram-node-wrapper tests", () => {
  it("should throw an error when the request body contains invalid limit-order", async () => {
    await expect(testInvalidInput(InvalidLimits1)).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid cut-off", async () => {
    await expect(testInvalidInput(InvalidLimits2)).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid num-trials", async () => {
    await expect(testInvalidInput(InvalidLimits3)).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid num-quantiles", async () => {
    await expect(testInvalidInput(InvalidLimits4)).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid num-bins", async () => {
    await expect(testInvalidInput(InvalidLimits5)).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid seed", async () => {
    await expect(testInvalidInput(InvalidLimits6)).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid mission-time", async () => {
    await expect(testInvalidInput(InvalidLimits7)).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid time-step", async () => {
    await expect(testInvalidInput(InvalidLimits8)).rejects.toThrow();
  });

  it("should throw an error if any approximation is used while evaluating the prime implicants", async () => {
    await expect(testInvalidInput(InvalidCombination3)).rejects.toThrow();
  });

  it("should throw an error if prime implicants are being evaluated without BDD algorithm", async () => {
    await expect(testInvalidInput(InvalidCombination4)).rejects.toThrow();
  });

  it("should throw an error if safety integrity levels are being evaluated without providing time step", async () => {
    await expect(testInvalidInput(InvalidCombination5)).rejects.toThrow();
  });
});
