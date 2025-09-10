import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  minimize: false,
})
export class ResetToken {
  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ type: Date, default: Date.now, expires: 60 * 15 })
  createdAt: Date;
}

export type ResetTokenDocument = ResetToken & Document;
export const ResetTokenSchema = SchemaFactory.createForClass(ResetToken);
