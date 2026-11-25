import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";
import type {
  RcConsequenceRunFailure,
  RcConsequenceRunNote,
  RcConsequenceRunProgress,
  RcConsequenceRunReceptorKind,
  RcConsequenceRunResult,
  RcConsequenceRunStatus,
} from "interfaces-mef-types/rc/consequence-runs";
import type { RcMetricStatistics } from "interfaces-mef-types/rc/metrics";
import type { RcWeatherTrial } from "interfaces-mef-types/rc/weather";
import { modelPayloadSchema } from "../storage/model-payload-schema";

interface RcConsequenceRunJob {
  jobId: string;
  distanceIndex: number;
  part: number;
}

interface RcConsequenceRunInput {
  metFileText: string;
  configTexts: string[];
}

interface RcConsequenceRunOutput {
  console: string;
  resultsText: string;
  engineVersion: string | null;
}

interface RcConsequenceRunDoses {
  dosesSv: number[];
  dispersion: (number | null)[];
}

type RcConsequenceRunDocument = HydratedDocument<RcConsequenceRunRecord>;

@Schema({ collection: "rc_consequence_runs", id: false, versionKey: false, minimize: false })
class RcConsequenceRunRecord {
  @Prop({ type: String, required: true, unique: true, index: true })
  id!: string;

  @Prop({ type: String, required: true, immutable: true, index: true })
  workbookId!: string;

  @Prop({ type: Number, required: true, immutable: true })
  sequence!: number;

  @Prop({ type: String, required: true, immutable: true })
  categoryId!: string;

  @Prop({ type: String, required: true, immutable: true })
  snapshotId!: string;

  @Prop({ type: String, required: true, immutable: true })
  snapshotLabel!: string;

  @Prop({ type: String, required: true, immutable: true })
  metricId!: string;

  @Prop({ type: String, required: true, immutable: true })
  metricName!: string;

  @Prop({ type: String, required: true, immutable: true })
  unit!: string;

  @Prop({ type: String, required: true, immutable: true, enum: ["EAB_MAXIMUM", "DISTANCE_PROFILE"] })
  receptorKind!: RcConsequenceRunReceptorKind;

  @Prop({ type: Number, required: true, immutable: true })
  windowSeconds!: number;

  @Prop({ type: Object, required: true, immutable: true })
  statistics!: RcMetricStatistics;

  @Prop({ type: [Number], required: true, immutable: true })
  distancesMetres!: number[];

  @Prop({ type: Number, required: true, immutable: true })
  heightMetres!: number;

  @Prop({ type: Number, required: true, immutable: true })
  trialCount!: number;

  @Prop({ type: [Object], required: true, immutable: true })
  jobs!: RcConsequenceRunJob[];

  @Prop({ type: [Object], required: true, immutable: true })
  notes!: RcConsequenceRunNote[];

  @Prop({ type: String, required: true, enum: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"], index: true })
  status!: RcConsequenceRunStatus;

  @Prop({ type: String, required: true, immutable: true })
  requestedBy!: string;

  @Prop({ type: Date, required: true, immutable: true })
  requestedAt!: Date;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  trackedAt!: Date | null;

  @Prop({ type: String, default: null })
  engineVersion!: string | null;

  @Prop({ type: Object, default: null })
  failure!: RcConsequenceRunFailure | null;

  @Prop({ type: Object, default: null })
  progress!: RcConsequenceRunProgress | null;

  @Prop({ type: Object, default: null })
  result!: RcConsequenceRunResult | null;

  @Prop({ type: [Object], required: true })
  trials!: RcWeatherTrial[];

  @Prop({ type: Object, required: true })
  input!: RcConsequenceRunInput;

  @Prop({ type: [Object], default: [] })
  output!: RcConsequenceRunOutput[];

  @Prop({ type: [Object], default: [] })
  doses!: RcConsequenceRunDoses[];
}

const RcConsequenceRunSchema = SchemaFactory.createForClass(RcConsequenceRunRecord);

modelPayloadSchema(RcConsequenceRunSchema, {
  trials: () => [],
  input: () => ({ metFileText: "", configTexts: [] }),
  output: () => [],
  doses: () => [],
});

RcConsequenceRunSchema.index({ workbookId: 1, sequence: 1 }, { unique: true });

export { RcConsequenceRunRecord, RcConsequenceRunSchema };
export type { RcConsequenceRunDocument, RcConsequenceRunDoses, RcConsequenceRunInput, RcConsequenceRunJob, RcConsequenceRunOutput };
