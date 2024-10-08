/**
 * Mongoose schema definitions for quantified requests and reports.
 *
 * These schemas define the structure of quantified requests and reports, specifying the data
 * types and required fields for storing quantification-related data in MongoDB. The `QuantifiedRequest`
 * schema outlines the options and parameters for a quantification request, while the `QuantifiedReport`
 * schema outlines the results of a quantification process along with its configurations.
 */

// Importing decorators from @nestjs/mongoose to define Mongoose schemas.
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

/**
 * Schema definition for a quantification request.
 *
 * This class represents the various options and parameters that can be specified for a quantification request,
 * including algorithms, approximations, expected risk measures (probability / importance measure / uncertainty etc.),
 * and other settings relevant to the quantification process.
 */

@Schema()
export class QuantifiedRequest {
  @Prop({ required: false })
  bdd?: boolean;

  @Prop({ required: false })
  zbdd?: boolean;

  @Prop({ required: false })
  mocus?: boolean;

  @Prop({ required: false })
  primeImplicants?: boolean;

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
  rareEvent?: boolean;

  @Prop({ required: false })
  mcub?: boolean;

  @Prop({ required: false })
  limitOrder?: number;

  @Prop({ required: false })
  cutOff?: number;

  @Prop({ required: false })
  missionTime?: number;

  @Prop({ required: false })
  timeStep?: number;

  @Prop({ required: false })
  numTrials?: number;

  @Prop({ required: false })
  numQuantiles?: number;

  @Prop({ required: false })
  numBins?: number;

  @Prop({ required: false })
  seed?: number;

  @Prop({ required: false })
  noIndent?: boolean;

  @Prop({ required: false })
  verbosity?: number;

  @Prop({ required: false })
  noReport?: boolean;

  @Prop({ required: false })
  output?: string;

  @Prop({ required: true })
  models!: string[];
}

/**
 * Schema definition for a quantified report.
 *
 * This class captures the results of a quantification process, including the configuration used for the
 * quantification and the results of the quantification. It allows for the storage and retrieval of quantification
 * results and their associated configurations.
 */
@Schema()
export class QuantifiedReport {
  @Prop({ required: false })
  configuration?: QuantifiedRequest;

  @Prop({ required: true })
  results!: string[];
}

// Generate a Mongoose schema for the QuantifiedReport class.
export const QuantifiedReportSchema = SchemaFactory.createForClass(QuantifiedReport);
