import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type {
  FaultTreeBasicEventCatalogue,
  MethodModelSchemaVersion,
} from "interfaces-shared-types/newly-developed-methods";

type FaultTreeBasicEventCatalogueRecordDocument =
  HydratedDocument<FaultTreeBasicEventCatalogueRecord>;

@Schema({ collection: "fault_tree_basic_event_catalogues", id: false, versionKey: false })
class FaultTreeBasicEventCatalogueRecord {
  @Prop({ type: String, required: true, unique: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true })
  schemaVersion!: MethodModelSchemaVersion;

  @Prop({ type: Number, required: true })
  revision!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;

  @Prop({ type: Object, required: true })
  catalogue!: FaultTreeBasicEventCatalogue;
}

const FaultTreeBasicEventCatalogueRecordSchema = SchemaFactory.createForClass(
  FaultTreeBasicEventCatalogueRecord,
);

export { FaultTreeBasicEventCatalogueRecord, FaultTreeBasicEventCatalogueRecordSchema };
export type { FaultTreeBasicEventCatalogueRecordDocument };
