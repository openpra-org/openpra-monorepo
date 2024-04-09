import {
  FailureModel,
  HouseEventFailureModel,
  SystemState,
} from "./FailureModel";

export enum LogicType {
  BASIC_EVENT = "BE",
  HOUSE_EVENT = "HE",
  LOGIC_GATE = "GT",
  AND_GATE = "AND",
  OR_GATE = "OR",
  FAULT_TREE = "FT",
}

export type Event = {
  description: string;
  name: string;
  logic_type: LogicType;
  failure_model?: FailureModel | HouseEventFailureModel;
};

export type BasicEvent = Event & {
  logic_type: LogicType.BASIC_EVENT;
};

export type HouseEvent = Event & {
  logic_type: LogicType.HOUSE_EVENT;
  failure_model: HouseEventFailureModel;
};

export type Gate = {
  logic_type: LogicType.OR_GATE | LogicType.AND_GATE;
  inputs: Event[];
} & Event;

export type FaultTree = Gate;

export const MainShockFaultTree: FaultTree = {
  logic_type: LogicType.AND_GATE,
  description: "FAILURE OF [ssc_description] DUE TO PGA BIN [PGA_bin] g",
  name: "[ssc_name]-MS-[PGA_bin_num]-GT",
  inputs: [
    {
      description: "Fragility Event for PGA BIN [PGA_bin]",
      name: "[ssc_name]-MS-[PGA_bin_num]-BE",
      logic_type: LogicType.BASIC_EVENT,
    },
    {
      description: "House Event for MAINSHOCK PGA BIN [PGA_bin]",
      name: "HE-MS-[PGA_bin_num]-BE",
      logic_type: LogicType.HOUSE_EVENT,
      failure_model: {
        state: SystemState.FAILED,
      },
    },
  ],
};
