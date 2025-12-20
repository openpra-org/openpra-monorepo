import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseGraph } from './base-graph.schema';

/**
 * Graph persistence model for Event Sequence Diagram (ESD) diagrams.
 * Extends BaseGraph and references the associated ESD id.
 */
@Schema({ versionKey: false })
export class EventSequenceDiagramGraph extends BaseGraph {
  @Prop({ type: String, unique: true, required: true })
  eventSequenceId: string;
}
/**
 * Mongoose document type for EventSequenceDiagramGraph.
 */
export type EventSequenceDiagramGraphDocument = EventSequenceDiagramGraph &
  Document;
/**
 * Mongoose schema for EventSequenceDiagramGraph.
 */
export const EventSequenceDiagramGraphSchema = SchemaFactory.createForClass(
  EventSequenceDiagramGraph,
);
