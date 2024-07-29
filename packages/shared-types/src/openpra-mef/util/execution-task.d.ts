import typia, { tags } from "typia";

// TODO: Remove TYPE, PWD, LS
export enum ExecutableTypes {
  LS = "ls",
  PWD = "pwd",
  TYPE = "type",
  SCRAM_CLI = "scram-cli",
  SAPHSOLVE_CLI = "saphsolve",
  FTREX_CLI = "ftrex",
  XFTA = "xfta",
  XFTA2 = "xfta2",
  DPC = "dpc",
  ACUBE = "acube",
  QRECOVER = "qrecover",
}
export const ExecutableTypesSchema = typia.json.application<[ExecutableTypes], "3.0">();

export interface ExecutionTask {
  executable: ExecutableTypes;
  arguments?: string[];
  env_vars?: string[];
  stdin?: string;
  tty?: boolean;
}
export const ExecutionTaskSchema = typia.json.application<[ExecutionTask], "3.0">();

// TODO: Change the range of the exit codes
export interface ExecutionResult {
  task: ExecutionTask;
  /**
   * exit code associated with the process performing this execution task.
   *
   * Always between 0 and 255.
   */
  exit_code: number & tags.Minimum<-1> & tags.Maximum<1>;
  stderr: string;
  stdout: string;
}
export const ExecutionResultSchema = typia.json.application<[ExecutionResult], "3.0">();
