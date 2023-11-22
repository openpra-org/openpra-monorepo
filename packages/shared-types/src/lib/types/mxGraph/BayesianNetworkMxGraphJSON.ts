import ReferenceTypes from "../ReferenceTypes";
import { HCLTreeMxGraphJSON } from "./HCLTreeMxGraphJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import { BayesianNodeVertexValueJSON } from "./BayesianNodeVertexJSON";

export interface BayesianNetworkMxGraphJSON extends HCLTreeMxGraphJSON {
  [ReferenceTypes.BAYESIAN_NODES]: Record<string, BayesianNodeJSON>;
}

export interface BayesianNodeJSON
  extends BayesianNodeVertexValueJSON,
    HCLTreeVertexJSON {}
