import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class FaultTree extends NestedModel {}

export type FaultTreeDocument = FaultTree & Document;
export const FaultTreeSchema = SchemaFactory.createForClass(FaultTree);

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
//     nog_normal_params: string;

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
// class Style {
//     @Prop({ type: PositionSchema, required: false })
//     position: Position;
// }

// const StyleSchema = SchemaFactory.createForClass(Style);

// @Schema({ _id: false, versionKey: false })
// class Constant {
//     @Prop({ required: false })
//     value: boolean;
// }

// const ConstantSchema = SchemaFactory.createForClass(Constant);

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
// class Basic_Event_Properties {
//     @Prop({ type: ExpressionSchema, required: false })
//     expression: Expression;

//     @Prop({ required: false })
//     source_type: string;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;

//     @Prop({ type: StyleSchema, required: false })
//     style: Style;

//     @Prop({ required: false })
//     role: string;
// }

// @Schema({ _id: false, versionKey: false })
// class House_Event_Properties {
//     @Prop({ type: ConstantSchema, required: false })
//     constant: Constant;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;

//     @Prop({ type: StyleSchema, required: false })
//     style: Style;

//     @Prop({ required: false })
//     role: string;
// }

// @Schema({ _id: false, versionKey: false })
// class Gate_Properties {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     formula: Formula | Outcome;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;

//     @Prop({ type: StyleSchema, required: false })
//     style: Style;

//     @Prop({ required: false })
//     role: string;
// }

// @Schema({ strict: false, _id: false, versionKey: false })
// class Component_Properties {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     component_property: object;
// }

// @Schema({ strict: false, _id: false, versionKey: false })
// class Basic_Event {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: Basic_Event_Properties;
// }

// const BasicEventSchema = SchemaFactory.createForClass(Basic_Event);

// @Schema({ strict: false, _id: false, versionKey: false })
// class House_Event {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: House_Event_Properties;
// }

// const HouseEventSchema = SchemaFactory.createForClass(House_Event);

// @Schema({ strict: false, _id: false, versionKey: false })
// class Gate {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: Gate_Properties;
// }

// const GateSchema = SchemaFactory.createForClass(Gate);

// @Schema({ strict: false, _id: false, versionKey: false })
// class Component {
//     @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
//     index: Component_Properties;
// }

// const ComponentSchema = SchemaFactory.createForClass(Component);

// @Schema({ _id: false, versionKey: false })
// class Top_Node {
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

// const TopNodeSchema = SchemaFactory.createForClass(Top_Node);

// @Schema({ strict: false, minimize: false, _id: false, versionKey: false })
// class FaultTreeData {
//     @Prop({ type: BasicEventSchema, required: false })
//     basic_events: Basic_Event;

//     @Prop({ type: HouseEventSchema, required: false })
//     house_events: House_Event;

//     @Prop({ type: GateSchema, required: false })
//     gates: Gate;

//     @Prop({ type: ComponentSchema, required: false })
//     components: Component;

//     @Prop({ type: TopNodeSchema, required: false })
//     top_node: Top_Node;

//     @Prop({ required: false })
//     name: string;

//     @Prop({ required: false })
//     model_tree_id: string;

//     @Prop({ type: LabelSchema, required: false })
//     label: Label;
// }

// const FaultTreeDataSchema = SchemaFactory.createForClass(FaultTreeData);

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
// export class FaultTree {
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

//     @Prop({ type: FaultTreeDataSchema, required: false })
//     tree_data: FaultTreeData;
//     // TODO:: rename this to data
// }

// export type FaultTreeDocument  = FaultTree & Document;
// export const FaultTreeSchema = SchemaFactory.createForClass(FaultTree);
