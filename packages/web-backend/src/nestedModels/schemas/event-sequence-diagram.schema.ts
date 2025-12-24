import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

/**
 * Nested model representing an Event Sequence Diagram technical element.
 */
@Schema({ versionKey: false })
export class EventSequenceDiagram extends NestedModel {}

/** Mongoose document type for EventSequenceDiagram. */
export type EventSequenceDiagramDocument = EventSequenceDiagram & Document;
/** Mongoose schema for EventSequenceDiagram. */
export const EventSequenceDiagramSchema =
  SchemaFactory.createForClass(EventSequenceDiagram);

// @Schema({ _id: false, versionKey: false })
// class Outcome {
//     @Prop({ required: false })
//     name: string;

//     @Prop({ required: false })
//     reference_type: string;

//     @Prop({ required: false })
//     tree_id: number;

//     @Prop({ required: false })
//     path: string;

//     @Prop({ required: false })
//     make_instance: boolean;

//     @Prop({ required: false })
//     _proxy: string;
// }

// const OutcomeSchema = SchemaFactory.createForClass(Outcome);

// @Schema({ _id: false, versionKey: false })
// class Formula {
//     @Prop({ required: false })
//     _proxy: string;

//     @Prop({ type: OutcomeSchema, required: false })
//     outcome: Outcome;

//     @Prop({ required: false })
//     expr: string;

//     @Prop({ type: [{ type: OutcomeSchema }], required: false })
//     formulas: Outcome[];

//     @Prop({ required: false })
//     min_value: number;
// }

// @Schema({ _id: false, versionKey: false })
// class Expression {
//     @Prop({ required: false })
//     _proxy: string;

//     @Prop({ required: false })
//     value: number;

//     @Prop({ required: false })
//     user_expression: string;

//     @Prop({ required: false })
//     test_interval: number;

//     @Prop({ required: false })
//     failure_rate: number;

//     @Prop({ required: false })
//     mean: number;

//     @Prop({ required: false })
//     std: number;

//     @Prop({ required: false })
//     median: number;

//     @Prop({ required: false })
//     error_factor: number;

//     @Prop({ required: false })
//     p5: number;

//     @Prop({ required: false })
//     p95: number;

//     @Prop({ required: false })
//     _params: string[];

//     @Prop({ required: false })
//     shape: number;

//     @Prop({ required: false })
//     scale: number;

//     @Prop({ required: false })
//     normal_mean: number;

//     @Prop({ required: false })
//     normal_std: number;

//     @Prop({ required: false })
//     normal_median: number;

//     @Prop({ required: false })
//     normal_error_factor: number;

//     @Prop({ required: false })
//     normal_p5: number;

//     @Prop({ required: false })
//     normal_p95: number;

//     @Prop({ required: false })
//     normal_params: string;

//     @Prop({ required: false })
//     log_normal_mean: number;

//     @Prop({ required: false })
//     log_normal_std: number;

//     @Prop({ required: false })
//     log_normal_median: number;

//     @Prop({ required: false })
//     log_normal_error_factor: number;

//     @Prop({ required: false })
//     log_normal_p5: number;

//     @Prop({ required: false })
//     log_normal_p95: number;

//     @Prop({ required: false })
//     log_normal_params: string;

//     @Prop({ required: false })
//     exponential_test_interval: number;

//     @Prop({ required: false })
//     weibull_test_interval: number;

//     @Prop({ required: false })
//     parts_fit_test_interval: number;

//     @Prop({ required: false })
//     distribution_time_dependence: string;

//     @Prop({ required: false })
//     max: number;

//     @Prop({ required: false })
//     min: number;

//     @Prop({ type: OutcomeSchema, required: false })
//     state_ref: Outcome;

//     @Prop({ required: false })
//     uncertain: boolean;

//     @Prop({ required: false })
//     part_id: number;

//     @Prop({ type: [{ type: mongoose.Schema.Types.Mixed }], required: false })
//     formulas: Expression[];

//     @Prop({ required: false })
//     expr: string;

//     @Prop({ required: false })
//     time_to_failure: number[];

//     @Prop({ required: false })
//     estimated_reliability: number[];
// }

// const ExpressionSchema = SchemaFactory.createForClass(Expression);

// @Schema({ _id: false, versionKey: false })
// class Position {
//     @Prop({ required: false })
//     x: number;

//     @Prop({ required: false })
//     y: number;

//     @Prop({ required: false })
//     width: number;

//     @Prop({ required: false })
//     height: number;
// }

// const PositionSchema = SchemaFactory.createForClass(Position);

// @Schema({ _id: false, versionKey: false })
// class Label {
//     @Prop({ required: false })
//     name: string;

//     @Prop({ required: false })
//     description: string;

//     @Prop({ required: false })
//     frequency: string;
// }

// const LabelSchema = SchemaFactory.createForClass(Label);

// @Schema({ _id: false, versionKey: false })
// class Instruction {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     formula: Formula | Outcome;

//     @Prop({ type: ExpressionSchema, required: false })
//     expression: Expression;

//     @Prop({ required: false })
//     _proxy: string;
// }

// const InstructionSchema = SchemaFactory.createForClass(Instruction);

// @Schema({ _id: false, versionKey: false })
// class Path {
//     @Prop({ type: OutcomeSchema, required: false })
//     outcome: Outcome;

//     @Prop({ type: [{ type: InstructionSchema }], required: false })
//     instructions: Instruction[];
// }

// const PathSchema = SchemaFactory.createForClass(Path);

// @Schema({ _id: false, versionKey: false })
// class Paths {
//     @Prop({ type: PathSchema, required: false })
//     failure: Path;

//     @Prop({ type: PathSchema, required: false })
//     success: Path;
// }

// const PathsSchema = SchemaFactory.createForClass(Paths);

// @Schema({ _id: false, versionKey: false })
// class Branch {
//     @Prop({ required: false })
//     functional_event: string;

//     @Prop({ type: PathsSchema, required: false })
//     paths: Paths;

//     @Prop({ required: false })
//     _proxy: string;
// }

// @Schema({ _id: false, versionKey: false })
// class Positions {
//     @Prop({ type: PositionSchema, required: false })
//     position: Position;
// }

// const PositionsSchema = SchemaFactory.createForClass(Positions);

// @Schema({ _id: false, versionKey: false })
// class HclTree_Vertex {
//     @Prop({ type: PositionsSchema, required: false })
//     style: Positions;

//     @Prop({ required: false })
//     role: string;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;
// }

// @Schema({ _id: false, versionKey: false })
// class Initial_State_Vertex {
//     @Prop({ type: OutcomeSchema, required: false })
//     outcome: Outcome;

//     @Prop({ type: PositionsSchema, required: false })
//     style: Positions;

//     @Prop({ required: false })
//     role: string;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;
// }

// const InitialStateVertexSchema = SchemaFactory.createForClass(Initial_State_Vertex);

// @Schema({ strict: false, _id: false, versionKey: false })
// class Branches {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: Branch;
// }

// const BranchesSchema = SchemaFactory.createForClass(Branches);

// @Schema({ strict: false, _id: false, versionKey: false })
// class Functional_Events {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: HclTree_Vertex;
// }

// const FunctionalEventsSchema = SchemaFactory.createForClass(Functional_Events);

// @Schema({ strict: false, _id: false, versionKey: false })
// class Sequences {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: HclTree_Vertex;
// }

// const SequencesSchema = SchemaFactory.createForClass(Sequences);

// @Schema({ _id: false, versionKey: false })
// class EventSequenceDiagramData {
//     @Prop({ type: BranchesSchema, required: false })
//     branches: Branches;

//     @Prop({ type: FunctionalEventsSchema, required: false })
//     functional_events: Functional_Events;

//     @Prop({ type: InitialStateVertexSchema, required: false })
//     initial_state: Initial_State_Vertex;

//     @Prop({ type: SequencesSchema, required: false })
//     sequences: Sequences;

//     @Prop({ required: false })
//     name: string;

//     @Prop({ required: false })
//     model_tree_id: number;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;
// }

// const EventSequenceDiagramDataSchema = SchemaFactory.createForClass(EventSequenceDiagramData);

// @Schema({ _id: false, versionKey: false })
// class Model {
//     @Prop({ required: false })
//     id: number;

//     @Prop({ required: false })
//     type: string;

//     @Prop({ required: false })
//     model_tag: string;
// }

// @Schema({
//     toJSON: {
//         transform: function(doc, ret) {
//             delete ret._id;
//             delete ret.__v;
//             delete ret.tree_name;
//             delete ret.model_id;
//         }
//     }
// })
// export class EventSequenceDiagram {
//     tree_name: string;
//     // TODO:: add Label instead of name, description
//     model_id: number;
//     id: number;
//     title: string;
//     creator: number;
//     description:string;
//     model: Model;
//     tree_type:string;
//     valid: boolean;

//     @Prop({ type: EventSequenceDiagramDataSchema, required: false })
//     tree_data: EventSequenceDiagramData;
//     // TODO:: rename this to data
// }

// export type EventSequenceDiagramDocument  = EventSequenceDiagram & Document;
// export const EventSequenceDiagramSchema = SchemaFactory.createForClass(EventSequenceDiagram);
