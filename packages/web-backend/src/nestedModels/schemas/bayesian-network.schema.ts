import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";
@Schema({ versionKey: false })
export class BayesianNetwork extends NestedModel {}
export type BayesianNetworkDocument = BayesianNetwork & Document;
export const BayesianNetworkSchema = SchemaFactory.createForClass(BayesianNetwork);
