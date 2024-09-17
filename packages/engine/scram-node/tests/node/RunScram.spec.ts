import { ScramAddonType } from "shared-types/src/openpra-mef/util/scram-addon-type";
import {
  InvalidCombination1,
  InvalidCombination2,
  InvalidLimits1,
  InvalidLimits2,
  InvalidLimits3,
  InvalidLimits4,
  InvalidLimits5,
  InvalidLimits6,
  InvalidLimits7,
  InvalidLimits8,
  InvalidLimits9,
} from "../../../../microservice/job-broker/tests/input/quantification/invalid-request";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const scramAddon: ScramAddonType = require("../../build/Release/scram-node.node") as ScramAddonType;

// TODO: migrate tests from `microservice-job-broker`
test("stub", () => {
  expect(true).toBeTruthy();
});

describe("scram-cpp tests", () => {
  it("should throw an error when the request body contains mutually exclusive keys (bdd and zbdd)", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidCombination1);
    }).toThrow();
  });

  it("should throw an error when the request body contains mutually exclusive keys (rare-event and mcub)", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidCombination2);
    }).toThrow();
  });
});

describe("scram-node-wrapper tests", () => {
  it("should throw an error when the request body contains invalid limit-order", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits1);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid cut-off", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits2);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid num-trials", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits3);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid num-quantiles", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits4);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid num-bins", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits5);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid seed", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits6);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid mission-time", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits7);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid time-step", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits8);
    }).toThrow();
  });

  it("should throw an error when the request body contains invalid verbosity", () => {
    expect(() => {
      scramAddon.RunScramCli(InvalidLimits9);
    }).toThrow();
  });
});
