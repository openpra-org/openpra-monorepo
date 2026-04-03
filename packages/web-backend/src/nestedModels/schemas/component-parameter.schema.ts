import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class ComponentParameter {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ required: true })
  dataAnalysisId: number;

  @Prop()
  grouping?: string;

  @Prop({ required: true })
  componentType: string;

  @Prop({ required: true })
  componentFailureMode: string;

  @Prop()
  description?: string;

  @Prop()
  dataSource?: string;

  @Prop()
  failures?: number;

  @Prop()
  units?: string;

  @Prop()
  dhUnit?: string;

  @Prop()
  dhValue?: number;

  @Prop()
  componentCount?: number;

  @Prop()
  distribution?: string;

  @Prop()
  analysisType?: string;

  @Prop()
  fth?: number;

  @Prop()
  median?: number;

  @Prop()
  nfth?: number;

  @Prop()
  alpha?: number;

  @Prop()
  beta?: number;

  @Prop()
  mean?: number;

  @Prop()
  errorFactor?: number;

  @Prop()
  dateRange?: string;

  @Prop()
  effectiveDate?: string;
}

export type ComponentParameterDocument = ComponentParameter & Document;

export const ComponentParameterSchema = SchemaFactory.createForClass(ComponentParameter);
