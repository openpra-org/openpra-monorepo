import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class BayesianNetwork extends NestedModel {}

export type BayesianNetworkDocument = BayesianNetwork & Document;
export const BayesianNetworkSchema = SchemaFactory.createForClass(BayesianNetwork);

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
// class BayesianStateProbability {
//     @Prop({ type: ExpressionSchema, required: false })
//     expression: Expression;

//     @Prop({ type: [{ type: OutcomeSchema }], required: false })
//     states: Outcome[];
// }

// const BayesianStateProbabilitySchema = SchemaFactory.createForClass(BayesianStateProbability);

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
// class BayesianNodeState {
//     @Prop({ type: [{ type: BayesianStateProbabilitySchema }], required: false })
//     probabilities: BayesianStateProbability[];

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;
// }

// @Schema({ _id: false, versionKey: false })
// class Positions {
//     @Prop({ type: PositionSchema, required: false })
//     position: Position;
// }

// const PositionsSchema = SchemaFactory.createForClass(Positions);

// @Schema({ strict: false, _id: false, versionKey: false })
// class BayesianNode {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     states: Record<string, BayesianNodeState>;

//     @Prop({ type: [{ type: OutcomeSchema }], required: false })
//     dependencies: Outcome[];

//     @Prop({ type: PositionsSchema, required: false })
//     style: Positions;

//     @Prop({ required: false })
//     role: string;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;
// }

// @Schema({ strict: false, _id: false, versionKey: false })
// class Bayesian_Nodes {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: BayesianNode;
// }

// const BayesianNodesSchema = SchemaFactory.createForClass(Bayesian_Nodes);

// @Schema({ _id: false, versionKey: false })
// class BayesianNetworksData {
//     @Prop({ type: BayesianNodesSchema, required: false })
//     bayesian_nodes: Bayesian_Nodes;

//     @Prop({ required: false })
//     name: string;

//     @Prop({ required: false })
//     model_tree_id: number;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;
// }

// const BayesianNetworksDataSchema = SchemaFactory.createForClass(BayesianNetworksData);

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
// export class BayesianNetworks {
//     tree_name: string;
//     model_id: number;
//     // TODO:: add Label instead of name, description
//     id: number;
//     title: string;
//     creator: number;
//     description:string;
//     model: Model;
//     tree_type:string;
//     valid: boolean;

//     @Prop({ type: BayesianNetworksDataSchema, required: false })
//     tree_data: BayesianNetworksData;
//     // TODO:: rename this to data
// }

// export type BayesianNetworksDocument  = BayesianNetworks & Document;
// export const BayesianNetworksSchema = SchemaFactory.createForClass(BayesianNetworks);
