/**
 * Represents a valid request body for executing a command-line interface (CLI) program.
 * This object contains various configuration options and parameters.
 *
 * Properties:
 * - `executable`: The name or path of the executable to run.
 * - `arguments`: An array of arguments to pass to the executable.
 * - `env_vars`: An array of environment variables to set for the executable.
 * - `stdin`: Standard input data to be provided to the executable.
 * - `tty`: Boolean flag to enable or disable TTY (teletypewriter) mode.
 */
export const ValidRequestBody = {
  executable: "scram-cli",
  arguments: ["--bdd", "--probability", "--mcub", "input1.xml"],
  env_vars: ["DEBUG=true"],
  stdin: "Some input data for the program",
  tty: true,
};
