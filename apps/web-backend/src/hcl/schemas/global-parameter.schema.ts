import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class GlobalParameter {
    @Prop({ unique: false })
    user_id: number;
    
    @Prop({ unique: false })
    model_id: number;

    @Prop({ unique: true })
    pk: number;

    @Prop()
    parameter_name: string;

    @Prop({ required: false })
    parameter_type: string;

    @Prop()
    double_value: number;

    @Prop({ required: false })
    string_value: string;
}

export type GlobalParameterDocument = GlobalParameter & Document;
export const GlobalParameterSchema = SchemaFactory.createForClass(GlobalParameter);