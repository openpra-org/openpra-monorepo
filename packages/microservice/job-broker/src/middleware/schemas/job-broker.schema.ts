import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema()
class QuantifiedRequest {
  @Prop({ required: false })
  bdd?: boolean;

  @Prop({ required: false })
  zbdd?: boolean;

  @Prop({ required: false })
  mocus?: boolean;

  @Prop({ required: false })
  "prime-implicants"?: boolean;

  @Prop({ required: false })
  probability?: boolean;

  @Prop({ required: false })
  importance?: boolean;

  @Prop({ required: false })
  uncertainty?: boolean;

  @Prop({ required: false })
  ccf?: boolean;

  @Prop({ required: false })
  sil?: boolean;

  @Prop({ required: false })
  "rare-event"?: boolean;

  @Prop({ required: false })
  mcub?: boolean;

  @Prop({ required: false })
  "limit-order"?: number;

  @Prop({ required: false })
  "cut-off"?: number;

  @Prop({ required: false })
  "mission-time"?: number;

  @Prop({ required: false })
  "time-step"?: number;

  @Prop({ required: false })
  "num-trials"?: number;

  @Prop({ required: false })
  "num-quantiles"?: number;

  @Prop({ required: false })
  "num-bins"?: number;

  @Prop({ required: false })
  seed?: number;

  @Prop({ required: false })
  "no-indent"?: boolean;

  @Prop({ required: false })
  verbosity?: number;

  @Prop({ required: false })
  "no-report"?: boolean;

  @Prop({ required: false })
  output?: string;

  @Prop({ required: true })
  models!: string[];
}

@Schema()
export class QuantifyJobBrokerRequest {
  @Prop({ required: false })
  configuration?: QuantifiedRequest;
}

export const QuantifyJobBrokerSchema = SchemaFactory.createForClass(QuantifyJobBrokerRequest);
export type QuantifyJobBrokerDocument = QuantifyJobBrokerRequest & Document;

@Schema()
export class ExecutedTask {
  // The name of the executable that was run.
  @Prop({ required: false })
  executable?: string;

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

@Schema()
export class ExecuteJobBrokerTask {
  // The executed task associated with this result.
  @Prop({ required: false })
  task?: ExecutedTask;
}

export const ExecuteJobBrokerSchema = SchemaFactory.createForClass(ExecuteJobBrokerTask);
export type ExecuteJobBrokerDocument = ExecuteJobBrokerTask & Document;
