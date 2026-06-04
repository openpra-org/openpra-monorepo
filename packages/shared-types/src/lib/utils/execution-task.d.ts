/**
 * Description of an external executable task to run via message queue.
 */
export interface ExecutionTask {
  _id?: string;
  executable: "scram-cli" | "saphsolve" | "ftrex" | "xfta" | "xfta2" | "dpc" | "acube" | "qrecover";
  arguments?: string[];
  env_vars?: string[];
  stdin?: string;
  tty?: boolean;
}
