import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ExampleWorkbookKind = "POS" | "IE" | "ES" | "SC" | "SY" | "HRA" | "DA" | "ESQ" | "MS" | "RC" | "RI" | "FL" | "F" | "S" | "HS" | "W" | "XF" | "CONFIGURATION_CONTROL" | "NEWLY_DEVELOPED_METHOD";

export type ExampleWorkbookDocument = HydratedDocument<ExampleWorkbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "example_workbooks" })
export class ExampleWorkbook {
  @Prop({ type: String, required: true, unique: true, index: true })
  slug!: string;

  @Prop({ type: String, required: true, index: true })
  kind!: ExampleWorkbookKind;

  @Prop({ type: Object, required: true })
  mef!: unknown;
}

export const ExampleWorkbookSchema = SchemaFactory.createForClass(ExampleWorkbook);
