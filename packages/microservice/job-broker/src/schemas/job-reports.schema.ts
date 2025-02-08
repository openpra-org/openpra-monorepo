import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

@Schema()
export class QuantificationJobReport extends Document {
  @Prop({ 
    required: true, 
    enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
    default: 'pending'
  })
  status!: JobStatus;
}

@Schema()
export class ExecutableJobReport extends Document {
  @Prop({ 
    required: true, 
    enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
    default: 'pending'
  })
  status!: JobStatus;
}

export const QuantificationJobReportSchema = SchemaFactory.createForClass(QuantificationJobReport);
export const ExecutableJobReportSchema = SchemaFactory.createForClass(ExecutableJobReport); 