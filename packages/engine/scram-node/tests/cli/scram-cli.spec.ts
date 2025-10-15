import { exec } from "child_process";
import * as path from "path";
import * as glob from "glob";

/**
 * Executes a shell command and returns a promise that resolves with the command's exit code.
 *
 * @param cmd - The command to execute.
 * @returns A promise that resolves to the exit code of the command.
 *
 * @example
 * ```typescript
 * execPromise("echo Hello World").then(code => {
 *   console.log(`Exit code: ${code}`);
 * });
 * ```
 */
const execPromise = (cmd: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (stdout) {
        //console.log(stdout);
      }
      if (stderr) {
        //console.error(stderr);
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

/**
 * Creates and registers a suite of tests for each file matching a glob pattern within a specified directory.
 * Each test executes a command using the matched file and checks the exit code against an expected value.
 *
 * @param testSuite - The name of the test suite.
 * @param baseDir - The base directory where the glob pattern will be applied.
 * @param pattern - The glob pattern used to find files.
 * @param expectedExitCode - The expected exit code for the command execution.
 *
 * @example
 * ```typescript
 * const rootDir = __dirname;
 * createTestsForFiles("Example Test Suite", rootDir, "examples/*.txt", 0);
 * ```
 */
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

const rootDir = __dirname; // Assuming __dirname is the root directory for Jest

createTestsForFiles("Invalid CCFs", rootDir, "../fixtures/fta/ccf/invalid/*.xml", 1);
createTestsForFiles("CCFs", rootDir, "../fixtures/fta/ccf/valid/*.xml", 0);

createTestsForFiles("Core Fixtures", rootDir, "../fixtures/core/*.xml", 0);
createTestsForFiles("Invalid Model Tests", rootDir, "../fixtures/model/invalid/*.xml", 1);
createTestsForFiles("Model Tests", rootDir, "../fixtures/model/valid/*.xml", 0);
