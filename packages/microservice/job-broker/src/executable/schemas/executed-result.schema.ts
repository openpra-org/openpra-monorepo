import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

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
@Schema()
export class ExecutedTask {
  @Prop({ required: true })
  executable!: string;

  @Prop({ required: false })
  arguments?: string[];

  @Prop({ required: false })
  env_vars?: string[];

  @Prop({ required: false })
  stdin?: string;

  @Prop({ required: false })
  tty?: boolean;
}

export const ExecutedTaskSchema = SchemaFactory.createForClass(ExecutedTask);

@Schema()
export class ExecutedResult {
  @Prop({ required: true })
  task!: ExecutedTask;

  @Prop({ required: true })
  exit_code!: number;

  @Prop({ required: false, default: "" })
  stderr?: string;

  @Prop({ required: false, default: "" })
  stdout?: string;
}

export const ExecutedResultSchema = SchemaFactory.createForClass(ExecutedResult);
