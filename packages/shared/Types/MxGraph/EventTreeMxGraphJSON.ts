import { HCLTreeMxGraphJSON } from "./HCLTreeMxGraphJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import ReferenceTypes from "../ReferenceTypes";
import { ProxyTypes } from "../ProxyTypes";
import { InitVertexJSON } from "./InitVertex";
import { PathJSON } from "../Path";

export default interface EventTreeMxGraphJSON extends HCLTreeMxGraphJSON {
  [ReferenceTypes.BRANCHES]: {[index: string]: { outcome: BranchJSON }};
  [ReferenceTypes.FUNCTIONAL_EVENTS]: {[index: string]: HCLTreeVertexJSON };
  [ReferenceTypes.INITIAL_STATE]: InitVertexJSON;
  [ReferenceTypes.SEQUENCES]: {[index: string]: HCLTreeVertexJSON };
}

interface BranchJSON {
  [ReferenceTypes.FUNCTIONAL_EVENT]: string;
  [ReferenceTypes.PATHS]: {
    failure: PathJSON;
    success: PathJSON;
  };
  _proxy: ProxyTypes;
}
