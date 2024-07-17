import ReferenceTypes from "../ReferenceTypes";
import { ProxyTypes } from "../ProxyTypes";
import { PathJSON } from "../Path";
import { HCLTreeMxGraphJSON } from "./HCLTreeMxGraphJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import { InitVertexJSON } from "./InitVertex";

type EventTreeMxGraphJSON = {
  [ReferenceTypes.BRANCHES]: Record<string, { outcome: BranchJSON }>;
  [ReferenceTypes.FUNCTIONAL_EVENTS]: Record<string, HCLTreeVertexJSON>;
  [ReferenceTypes.INITIAL_STATE]: InitVertexJSON;
  [ReferenceTypes.SEQUENCES]: Record<string, HCLTreeVertexJSON>;
} & HCLTreeMxGraphJSON;
export default EventTreeMxGraphJSON;

type BranchJSON = {
  [ReferenceTypes.FUNCTIONAL_EVENT]: string;
  [ReferenceTypes.PATHS]: {
    failure: PathJSON;
    success: PathJSON;
  };
  _proxy: ProxyTypes;
};