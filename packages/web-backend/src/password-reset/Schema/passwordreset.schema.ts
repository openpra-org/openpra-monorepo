import { Prop, SchemaFactory, Schema } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema()
export class PasswordReset{
    @Prop({required: true})
    email: string

    @Prop({required: true})
    token : string

    @Prop({required: true, expires: 0})
    expirationTime: Date
}

export type PasswordResetDocument = PasswordReset & Document;
export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);