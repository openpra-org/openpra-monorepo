import { Prop, Schema } from "@nestjs/mongoose";
import mongoose from "mongoose";


@Schema({ minimize: false, _id: false, versionKey: false })
export default class Preferences {
  @Prop({ required: false })
  theme?: string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  nodeIdsVisible?: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  outlineVisible?: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  node_value_visible?: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  nodeDescriptionEnabled?: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required:false })
  pageBreaksVisible?: boolean | string;

  @Prop({ type: QuantificationConfigurationsSchema, required: false })
  quantificationConfigurations?: QuantificationConfigurations;
}
