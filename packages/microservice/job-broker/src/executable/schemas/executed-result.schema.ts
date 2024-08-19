import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

/**
 * Enum representing the different types of binary executables / PRA solvers that can be run.
 */
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

// TODO: executable can only be of type ExecutableTypes

/**
 * Schema representing an executed task result.
 * This schema defines the structure of the task that has been executed,
 * including the executable name, its arguments, environment variables,
 * standard input, and whether it should run in a TTY.
 */
@Schema()
export class ExecutedTask {
  // The name of the executable that was run.
  @Prop({ required: true })
  executable!: string;

  // Arguments to be passed to the executable.
  @Prop({ required: false })
  arguments?: string[];

  // Environment variables for the executable.
  @Prop({ required: false })
  env_vars?: string[];

  // Standard input for the executable.
  @Prop({ required: false })
  stdin?: string;

  // Optional flag indicating if the executable should run in a TTY.
  @Prop({ required: false })
  tty?: boolean;
}

// Create a Mongoose schema for the ExecutedTask class.
export const ExecutedTaskSchema = SchemaFactory.createForClass(ExecutedTask);

/**
 * Schema representing the result of an executed task.
 * This schema defines the structure of the result, including the executed
 * task, the exit code, and any standard error or output generated during execution.
 */
@Schema()
export class ExecutedResult {
  // The executed task associated with this result.
  @Prop({ required: true })
  task!: ExecutedTask;

  // The exit code returned by the executable.
  @Prop({ required: true })
  exit_code!: number;

  // Standard error output from the executable.
  @Prop({ required: false, default: "" })
  stderr?: string;

  // Standard output from the executable.
  @Prop({ required: false, default: "" })
  stdout?: string;
}

// Create a Mongoose schema for the ExecutedResult class.
export const ExecutedResultSchema = SchemaFactory.createForClass(ExecutedResult);
