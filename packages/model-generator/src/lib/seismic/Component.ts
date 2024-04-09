import { LogicType } from "./Event";
import { FailureModel } from "./FailureModel";

export type Component = {
  room_id: string;
  failure_model: FailureModel;
  description: string;
  name: string;
  logic_type: LogicType;
};
