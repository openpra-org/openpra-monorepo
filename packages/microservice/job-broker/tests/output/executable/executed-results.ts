import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";

/**
 * Represents a collection of executed results.
 * Each result contains a task object, exit code, standard error, and standard output.
 *
 * Properties:
 * - `task`: An object containing the details of the executed task.
 * - `exit_code`: The exit code returned by the executed task.
 * - `stderr`: The standard error output from the executed task.
 * - `stdout`: The standard output from the executed task.
 */
export const ExecutedResults: ExecutionResult[] = [
  {
    task: {
      executable: "scram-cli",
      arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
      env_vars: ["DEBUG=true"],
      stdin: "",
      tty: true,
    },
    exit_code: 0,
    stderr: "",
    stdout: "SCRAM quantification successful",
  },
  {
    task: {
      executable: "scram-cli",
      arguments: ["--bdd", "--probability", "--mcub", "input2.xml"],
      env_vars: ["DEBUG=false"],
      stdin: "",
      tty: false,
    },
    exit_code: 1,
    stderr: "Error in the input file",
    stdout: "",
  },
];

export const ExecutedResult1: ExecutionResult = {
  task: {
    executable: "scram-cli",
    arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
    env_vars: ["DEBUG=true"],
    stdin: "",
    tty: true,
  },
  exit_code: 0,
  stderr: "",
  stdout: "SCRAM quantification successful",
};
