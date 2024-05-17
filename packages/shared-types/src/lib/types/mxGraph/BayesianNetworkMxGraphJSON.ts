import ReferenceTypes from "../ReferenceTypes";
import { HCLTreeMxGraphJSON } from "./HCLTreeMxGraphJSON";
import { HCLTreeVertexJSON } from "./HCLTreeVertexJSON";
import { BayesianNodeVertexValueJSON } from "./BayesianNodeVertexJSON";

export type BayesianNetworkMxGraphJSON = {
  [ReferenceTypes.BAYESIAN_NODES]: Record<string, BayesianNodeJSON>;
} & HCLTreeMxGraphJSON;

export type BayesianNodeJSON = {} & BayesianNodeVertexValueJSON & HCLTreeVertexJSON;
