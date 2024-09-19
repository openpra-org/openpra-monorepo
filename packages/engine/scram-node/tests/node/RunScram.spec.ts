import fs from "node:fs";
import { ScramAddonType } from "shared-types/src/openpra-mef/util/scram-addon-type";
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
} from "../../../../microservice/job-broker/tests/input/quantification/invalid-request";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const scramAddon: ScramAddonType = require("../../build/Release/scram-node.node") as ScramAddonType;

// Create a temporary xml file for storing a model from the aralia folder
const model = fs.readFileSync("./packages/microservice/job-broker/tests/input/aralia/xml/chinese.xml");
if (!fs.existsSync("/tmp/model1.xml")) {
  fs.writeFileSync("/tmp/model1.xml", model);
}

// TODO: migrate tests from `microservice-job-broker`
test("stub", () => {
  expect(true).toBeTruthy();
});

describe("synchronous scram-node-wrapper tests", () => {
  it("should throw an error when the request body contains invalid limit-order", () => {
    InvalidLimits1.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits1);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid cut-off", () => {
    InvalidLimits2.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits2);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid num-trials", () => {
    InvalidLimits3.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits3);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid num-quantiles", () => {
    InvalidLimits4.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits4);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid num-bins", () => {
    InvalidLimits5.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits5);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid seed", () => {
    InvalidLimits6.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits6);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid mission-time", () => {
    InvalidLimits7.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits7);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid time-step", () => {
    InvalidLimits8.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits8);
    }).toThrow();
  });

  it("should throw an error if any approximation is used while evaluating the prime implicants", () => {
    InvalidCombination3.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidCombination3);
    }).toThrow();
  });

  it("should throw an error if prime implicants are being evaluated without BDD algorithm", () => {
    InvalidCombination4.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidCombination4);
    }).toThrow();
  });

  it("should throw an error if safety integrity levels are being evaluated without providing time step", () => {
    InvalidCombination5.models = ["/tmp/model1.xml"];
    expect(() => {
      scramAddon.RunScramCli(InvalidCombination5);
    }).toThrow();
  });
});
