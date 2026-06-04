import { exec } from "child_process";
import * as path from "path";
import * as glob from "glob";
const execPromise = (cmd: string): Promise<number> => {
  return new Promise((resolve, _reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (stdout) {
      }
      if (stderr) {
      }
      if (typeof error?.code === "number") {
        resolve(error.code);
      } else {
        resolve(0);
      }
    });
  });
};
describe("SCRAM Command Line Tests", () => {
  test("empty call", async () => {
    const exitCode = await execPromise("scram-cli");
    expect(exitCode).toBe(1);
  });
  test("info help calls", async () => {
    const exitCode = await execPromise("scram-cli --help");
    expect(exitCode).toBe(0);
  });
  test("info version calls", async () => {
    const exitCode = await execPromise("scram-cli --version");
    expect(exitCode).toBe(0);
  });
});
const createTestsForFiles = (testSuite: string, baseDir: string, pattern: string, expectedExitCode: number): void => {
  const fullPath = path.resolve(baseDir, pattern);
  describe(`${testSuite} pattern: ${pattern}`, () => {
    glob.sync(fullPath).forEach((file) => {
      test(`Testing ${file}`, async () => {
        const exitCode = await execPromise(`scram-cli ${file}`);
        expect(exitCode).toBe(expectedExitCode);
      });
    });
  });
};
const rootDir = __dirname;
createTestsForFiles("Invalid CCFs", rootDir, "../fixtures/fta/ccf/invalid/*.xml", 1);
createTestsForFiles("CCFs", rootDir, "../fixtures/fta/ccf/valid/*.xml", 0);
createTestsForFiles("Core Fixtures", rootDir, "../fixtures/core/*.xml", 0);
createTestsForFiles("Invalid Model Tests", rootDir, "../fixtures/model/invalid/*.xml", 1);
createTestsForFiles("Model Tests", rootDir, "../fixtures/model/valid/*.xml", 0);
