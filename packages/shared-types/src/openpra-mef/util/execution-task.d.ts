import typia from "typia";

export interface ExecutionTask {
  executable: "scram-cli" | "saphsolve" | "ftrex" | "xfta" | "xfta2" | "dpc" | "acube" | "qrecover";
  arguments?: string[];
  env_vars?: string[];
  stdin?: string;
  tty?: boolean;
}
export const ExecutionTaskSchema = typia.json.application<[ExecutionTask], "3.0">();
