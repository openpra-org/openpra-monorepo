import ReferenceTypes from "../ReferenceTypes";
import { OutcomeJSON } from "../Outcome";
import { HCLTreeMxGraphJSON } from "./HCLTreeMxGraphJSON";
import { BasicEventVertexJSON } from "./BasicEventVertexJSON";
import { HouseEventVertexJSON } from "./HouseEventVertexJSON";
import { GateVertexJSON } from "./GateVertexJSON";

export interface FaultTreeMxGraphJSON extends HCLTreeMxGraphJSON {
  [ReferenceTypes.BASIC_EVENTS]: Record<string, BasicEventVertexJSON>;
  [ReferenceTypes.HOUSE_EVENTS]: Record<string, HouseEventVertexJSON>;
  [ReferenceTypes.GATES]: Record<string, GateVertexJSON>;
  components: Record<string, any>;
  top_node: OutcomeJSON;
}
