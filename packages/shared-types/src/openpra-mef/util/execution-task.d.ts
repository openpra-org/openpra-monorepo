import typia, { tags } from "typia";

export enum ExecutableTypes {
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

export interface ExecutionResult {
  task: ExecutionTask;
  /**
   * exit code associated with the process performing this execution task.
   *
   * Always between 0 and 255.
   */
  exit_code: number & tags.ExclusiveMinimum<0> & tags.Maximum<255>;
  stderr: string;
  stdout: string;
}
export const ExecutionResultSchema = typia.json.application<[ExecutionResult], "3.0">();
