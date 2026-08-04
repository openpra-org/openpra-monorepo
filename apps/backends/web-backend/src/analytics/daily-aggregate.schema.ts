import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type DailyAggregateDocument = HydratedDocument<DailyAggregate>;

@Schema({ timestamps: true, collection: "usage_daily_aggregates" })
export class DailyAggregate {
  @Prop({ type: String, required: true, index: true })
  date!: string;

  @Prop({ type: String, required: true, index: true })
  metric!: string;

  @Prop({ type: String, default: "", index: true })
  dimension!: string;

  @Prop({ type: String, default: "", index: true })
  reactorType!: string;

  @Prop({ type: Number, default: 0 })
  count!: number;

  @Prop({ type: Number, default: 0 })
  activeMs!: number;

  @Prop({ type: Number, default: 0 })
  idleMs!: number;
}

export const DailyAggregateSchema = SchemaFactory.createForClass(DailyAggregate);
DailyAggregateSchema.index(
  { date: 1, metric: 1, dimension: 1, reactorType: 1 },
  { unique: true },
);

