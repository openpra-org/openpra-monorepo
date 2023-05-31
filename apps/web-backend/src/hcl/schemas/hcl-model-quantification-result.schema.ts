import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ _id: false, versionKey: false })
class Constructor {
    @Prop({ required: false })
    tree_id: number;

    @Prop({ required: false })
    replace_transfer_gates_with_basic_events: boolean;
}

@Schema({ _id: false, versionKey: false })
class Sampling {
    @Prop({ required: false })
    method: string;

    @Prop({ required: false })
    number_of_samples: number;

    @Prop({ required: false })
    confidence_interval: number;
}

const SamplingSchema = SchemaFactory.createForClass(Sampling);

@Schema({ _id: false, versionKey: false })
class Importance {
    @Prop({ required: false })
    events: string;

    @Prop({ required: false })
    measures: string[];
}

const ImportanceSchema = SchemaFactory.createForClass(Importance);

@Schema({ minimize: false, _id: false, versionKey: false })
class Quantify {
    @Prop()
    type: string;

    @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
    mission_test_interval: number | null;

    @Prop()
    user_defined_max_cutset: number;

    @Prop()
    targets: string;

    @Prop({ type: SamplingSchema, required: false })
    sampling: Sampling;

    @Prop({ type: ImportanceSchema, required: false })
    importance: Importance;
}

const QuantifySchema = SchemaFactory.createForClass(Quantify);

@Schema({ _id: false, versionKey: false })
class Engine {
    @Prop()
    BBNSolver: number;

    @Prop()
    OrderingRule: number;

    @Prop()
    BDDConstructor: number;
}

const EngineSchema = SchemaFactory.createForClass(Engine);

@Schema({ strict: false, _id: false, versionKey: false })
class Configuration {
    @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
    index: Constructor;

    @Prop({ type: QuantifySchema })
    quantify: Quantify;

    @Prop({ type: EngineSchema })
    engine: Engine;
}

@Schema()
class ResultData {}

const ResultDataSchema = SchemaFactory.createForClass(ResultData);

@Schema({
    strict: false,
    timestamps: {
        createdAt: 'date_created',
        updatedAt: false
    },
    toJSON: {
        transform: function(doc, ret) {
            delete ret._id;
        }
    },
    versionKey: false
})
export class HclModelQuantificationResult {
    @Prop({ required: false })
    id: number;

    @Prop()
    creator: number;

    @Prop()
    model: number;

    @Prop()
    model_title: string;

    @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
    configuration: Configuration;

    @Prop({ type: ResultDataSchema, required: false })
    result_data: ResultData;
}

export type HclModelQuantificationResultDocument = HclModelQuantificationResult & Document;
export const HclModelQuantificationResultSchema = SchemaFactory.createForClass(HclModelQuantificationResult);