import typia from "typia";

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
