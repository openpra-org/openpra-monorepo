import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema()
export class QuantifiedRequest {
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
export class QuantifiedReport {
  @Prop({ required: false })
  configuration?: QuantifiedRequest;

  @Prop({ required: true })
  results!: string[];
}

export const QuantifiedReportSchema = SchemaFactory.createForClass(QuantifiedReport);
