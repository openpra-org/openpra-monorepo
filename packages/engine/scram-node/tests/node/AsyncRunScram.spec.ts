import fs from "node:fs";
import { AsyncScramAddonType } from "shared-types/src/openpra-mef/util/scram-addon-type";
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
const scramAddon: AsyncScramAddonType = require("../../build/Release/scram-node.node") as AsyncScramAddonType;

// Create a temporary xml file for storing a model from the aralia folder
const model = fs.readFileSync("./packages/microservice/job-broker/tests/input/aralia/xml/chinese.xml");
if (!fs.existsSync("/tmp/model1.xml")) {
  fs.writeFileSync("/tmp/model1.xml", model);
}

// TODO: migrate tests from `microservice-job-broker`
test("stub", () => {
  expect(true).toBeTruthy();
});

describe("asynchronous scram-node-wrapper tests", () => {
  it("should throw an error when the request body contains invalid limit-order", async () => {
    InvalidLimits1.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits1, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  // Repeat the above pattern for each test case
  it("should throw an error when the request body contains invalid cut-off", async () => {
    InvalidLimits2.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits2, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid num-trials", async () => {
    InvalidLimits3.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits3, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid num-quantiles", async () => {
    InvalidLimits4.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits4, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid num-bins", async () => {
    InvalidLimits5.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits5, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid seed", async () => {
    InvalidLimits6.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits6, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid mission-time", async () => {
    InvalidLimits7.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits7, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error when the request body contains invalid time-step", async () => {
    InvalidLimits8.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidLimits8, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error if any approximation is used while evaluating the prime implicants", async () => {
    InvalidCombination3.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidCombination3, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error if prime implicants are being evaluated without BDD algorithm", async () => {
    InvalidCombination4.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidCombination4, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });

  it("should throw an error if safety integrity levels are being evaluated without providing time step", async () => {
    InvalidCombination5.models = ["/tmp/model1.xml"];
    await expect(
      new Promise<void>((resolve, reject) => {
        scramAddon.RunScramCli(InvalidCombination5, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    ).rejects.toThrow();
  });
});
