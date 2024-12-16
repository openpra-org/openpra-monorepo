import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

/**
 * Schema definition for a quantification request.
 *
 * This class represents the various options and parameters that can be specified for a quantification request,
 * including algorithms, approximations, expected risk measures (probability / importance measure / uncertainty etc.),
 * and other settings relevant to the quantification process.
 */

@Schema()
export class QuantificationJobRequest {
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

/**
 * Schema definition for a quantified report.
 *
 * This class captures the results of a quantification process, including the configuration used for the
 * quantification and the results of the quantification.
 */
@Schema()
export class QuantificationJobReport {
  @Prop({ required: false, default: "pending" })
  status?: string;

  @Prop({ required: false, default: "quantification" })
  jobType?: string;

  @Prop({ required: false })
  configuration?: QuantificationJobRequest;

  @Prop({ required: false })
  results?: string[];
}

export const QuantificationJobSchema = SchemaFactory.createForClass(QuantificationJobReport);
