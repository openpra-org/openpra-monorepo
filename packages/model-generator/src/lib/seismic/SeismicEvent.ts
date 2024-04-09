import { SeismicInput } from "./SeismicInput";
import { FaultTree, LogicType, MainShockFaultTree } from "./Event";
import { Component } from "./Component";

class SeismicFaultTreeBuilder {
  private _template: typeof MainShockFaultTree | undefined;
  private _input: SeismicInput | undefined;

  constructor(
    input?: SeismicInput,
    mainshockTemplate?: typeof MainShockFaultTree,
  ) {
    this._input = input;
    this._template = mainshockTemplate;
  }

  public setTemplate(value: typeof MainShockFaultTree): this {
    this._template = value;
    return this;
  }

  public setInput(value: SeismicInput): this {
    this._input = value;
    return this;
  }

  public build(ssc: Component): FaultTree {
    if (!this._template || !this._input) {
      throw new Error();
    }

    const tree: FaultTree = {
      logic_type: this._template.logic_type,
      name: "d",
    };

    return tree;
  }

  private parseFields(ssc: Component): Partial<Component> {
    return {
      name: ssc.name,
    };
  }
}

export { SeismicFaultTreeBuilder };

// export type MainShockFaultTree = FaultTree & {
//   logic_type: LogicType.AND_GATE;
//   description: "FAILURE OF [ssc_description] DUE TO PGA BIN [PGA_bin] g";
//   name: "[ssc_name]-MS-[PGA_bin_num]-GT";
//   inputs: [
//     {
//       description: "Fragility Event for PGA BIN [PGA_bin]";
//       name: "[ssc_name]-MS-[PGA_bin_num]-BE";
//       logic_type: LogicType.BASIC_EVENT;
//     },
//     {
//       description: "House Event for MAINSHOCK PGA BIN [PGA_bin]";
//       name: "HE-MS-[PGA_bin_num]-BE";
//       logic_type: LogicType.HOUSE_EVENT;
//       failure_model: {
//         state: SystemState.FAILED;
//       };
//     },
//   ];
// };
