import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class MasterLogicDiagram extends NestedModel {}

export type MasterLogicDiagramDocument = MasterLogicDiagram & Document;
export const MasterLogicDiagramSchema = SchemaFactory.createForClass(MasterLogicDiagram);
