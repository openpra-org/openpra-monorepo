import type { WorkbookEntityAddress, WorkbookModelEntityAddress } from "./shared";

type WorkbookCrossReferenceType =
  | "FAULT_TREE_TOP_EVENT"
  | "FAULT_TREE_BASIC_EVENT"
  | "EVENT_TREE_FUNCTIONAL_EVENT"
  | "BAYESIAN_NETWORK_NODE"
  | "HCL_BINDING"
  | "WORKBOOK_PARAMETER";

interface FaultTreeTopEventReference extends WorkbookModelEntityAddress {
  referenceType: "FAULT_TREE_TOP_EVENT";
}

interface FaultTreeBasicEventCatalogueReference extends WorkbookEntityAddress {
  referenceType: "FAULT_TREE_BASIC_EVENT";
}

interface EventTreeFunctionalEventReference extends WorkbookModelEntityAddress {
  referenceType: "EVENT_TREE_FUNCTIONAL_EVENT";
}

interface BayesianNetworkNodeReference extends WorkbookModelEntityAddress {
  referenceType: "BAYESIAN_NETWORK_NODE";
}

interface HclBindingReference extends WorkbookModelEntityAddress {
  referenceType: "HCL_BINDING";
}

interface WorkbookParameterReference extends WorkbookEntityAddress {
  referenceType: "WORKBOOK_PARAMETER";
}

type WorkbookCrossReference =
  | FaultTreeTopEventReference
  | FaultTreeBasicEventCatalogueReference
  | EventTreeFunctionalEventReference
  | BayesianNetworkNodeReference
  | HclBindingReference
  | WorkbookParameterReference;

export type {
  WorkbookCrossReferenceType,
  FaultTreeTopEventReference,
  FaultTreeBasicEventCatalogueReference,
  EventTreeFunctionalEventReference,
  BayesianNetworkNodeReference,
  HclBindingReference,
  WorkbookParameterReference,
  WorkbookCrossReference,
};
