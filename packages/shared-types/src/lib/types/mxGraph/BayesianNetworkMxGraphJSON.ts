import { HCLTreeMxGraphJSON } from "./HCLTreeMxGraphJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import ReferenceTypes from "../ReferenceTypes";
import { BayesianNodeVertexValueJSON } from "./BayesianNodeVertexJSON";

export interface BayesianNetworkMxGraphJSON extends HCLTreeMxGraphJSON {
  [ReferenceTypes.BAYESIAN_NODES]: {[key: string]: BayesianNodeJSON };
}

export interface BayesianNodeJSON extends BayesianNodeVertexValueJSON, HCLTreeVertexJSON {

}
