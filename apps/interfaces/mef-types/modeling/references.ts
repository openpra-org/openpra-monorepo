import type { WorkbookEntityAddress, WorkbookModelEntityAddress } from "./shared";

type WorkbookCrossReferenceType =
  | "FAULT_TREE_TOP_EVENT"
  | "FAULT_TREE_BASIC_EVENT"
  | "EVENT_TREE_FUNCTIONAL_EVENT"
  | "BAYESIAN_NETWORK_NODE"
  | "HCL_BINDING"
  | "WORKBOOK_PARAMETER"
  | "HUMAN_FAILURE_EVENT"
  | "EVENT_SEQUENCE_FAMILY"
  | "EVENT_SEQUENCE_FAMILY_QUANTIFICATION"
  | "RADIOLOGICAL_CONSEQUENCE_RESULT"
  | "INTEGRATED_RISK_RESULT";

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

interface HumanFailureEventReference extends WorkbookEntityAddress {
  referenceType: "HUMAN_FAILURE_EVENT";
  quantificationId: string;
}

interface EventSequenceFamilyWorkbookReference extends WorkbookEntityAddress {
  referenceType: "EVENT_SEQUENCE_FAMILY";
}

interface EventSequenceFamilyQuantificationReference extends WorkbookEntityAddress {
  referenceType: "EVENT_SEQUENCE_FAMILY_QUANTIFICATION";
}

interface RadiologicalConsequenceResultReference extends WorkbookEntityAddress {
  referenceType: "RADIOLOGICAL_CONSEQUENCE_RESULT";
}

interface IntegratedRiskResultReference extends WorkbookEntityAddress {
  referenceType: "INTEGRATED_RISK_RESULT";
}

type WorkbookCrossReference =
  | FaultTreeTopEventReference
  | FaultTreeBasicEventCatalogueReference
  | EventTreeFunctionalEventReference
  | BayesianNetworkNodeReference
  | HclBindingReference
  | WorkbookParameterReference
  | HumanFailureEventReference
  | EventSequenceFamilyWorkbookReference
  | EventSequenceFamilyQuantificationReference
  | RadiologicalConsequenceResultReference
  | IntegratedRiskResultReference;

export type {
  WorkbookCrossReferenceType,
  FaultTreeTopEventReference,
  FaultTreeBasicEventCatalogueReference,
  EventTreeFunctionalEventReference,
  BayesianNetworkNodeReference,
  HclBindingReference,
  WorkbookParameterReference,
  HumanFailureEventReference,
  EventSequenceFamilyWorkbookReference,
  EventSequenceFamilyQuantificationReference,
  RadiologicalConsequenceResultReference,
  IntegratedRiskResultReference,
  WorkbookCrossReference,
};
