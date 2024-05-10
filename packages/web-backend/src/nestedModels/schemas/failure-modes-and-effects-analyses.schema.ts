import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

const generateDefaultColumns = () => {
  const columnNames = [
    "Subsystem",
    "Major Components",
    "Functions",
    "Failure Modes",
    "Cause",
    "Failure Effects",
    "Preventative Measures",
    "Postulated Resulting Initiating Events",
  ];

  return columnNames.map((name) => ({
    id: crypto.randomUUID(),
    name: name,
    type: "string",
    dropdownOptions: [],
  }));
};
@Schema({ versionKey: false })
export class FailureModesAndEffectsAnalyses extends NestedModel {
  @Prop({ default: generateDefaultColumns })
  columns: {
    id: string;
    name: string;
    type: string;
    dropdownOptions: {
      number: number;
      description: string;
    }[];
  }[];

  @Prop()
  rows: {
    id: number;
    row_data: Map<string, string>;
  }[];
}

export type FailureModesAndEffectsAnalysesDocument =
  FailureModesAndEffectsAnalyses & Document;
export const FailureModesAndEffectsAnalysesSchema =
  SchemaFactory.createForClass(FailureModesAndEffectsAnalyses);
