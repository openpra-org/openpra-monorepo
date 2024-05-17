import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { TypedModel } from "./templateSchema/typed-model.schema";
import { MetaTypedModel } from "./meta-typed-model.schema";

@Schema({ versionKey: false })
export class InternalEvents extends TypedModel {
  // @Prop({ required: false })
  // initiating_events: number[];
  //     @Prop({ required: false })
  //     event_trees: number[];
  //     @Prop({ required: false })
  //     event_sequence_diagrams: number[];
  // @Prop({ required: false })
  // functional_events: number[];
  //     @Prop({ required: false })
  //     bayesian_networks: number[];
  //
  //     @Prop({ required: false })
  //     event_trees: number[];
  //
  //     @Prop({ required: false })
  //     fault_trees: number[];
  //
}

export type InternalEventsDocument = InternalEvents & Document;
export const InternalEventsSchema = SchemaFactory.createForClass(InternalEvents);

export class InternalEventsMetadata extends MetaTypedModel {}
