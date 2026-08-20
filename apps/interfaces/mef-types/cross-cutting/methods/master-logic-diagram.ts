import { Unique, Named } from "../../core/meta";

export type MethodKind =
  | "MASTER_LOGIC_DIAGRAM"
  | "HEAT_BALANCE_FAULT_TREE"
  | "FMEA"
  | "HAZARD_OPERABILITY_STUDY"
  | "PROCESS_HAZARD_ANALYSIS"
  | "OPERATING_EXPERIENCE_REVIEW"
  | "GENERIC_INITIATOR_CATALOGUE";

export interface MethodBase extends Unique, Named {
  methodKind: MethodKind;
  newlyDevelopedMethodId?: string;
  analyst: string;
  supportingDocuments: string[];
}

export interface MasterLogicDiagramNode {
  id: string;
  description: string;
  parentId?: string;
  challengedSafetyFunctionId?: string;
  affectedBarrierId?: string;
  derivedInitiatorIds: string[];
}

export interface MasterLogicDiagram extends MethodBase {
  methodKind: "MASTER_LOGIC_DIAGRAM";
  radioactiveSourceIds: string[];
  plantOperatingStateIds: string[];
  radionuclideBarrierIds: string[];
  safetyFunctionIds: string[];
  systemIds: string[];
  nodes: MasterLogicDiagramNode[];
  identifiedInitiatorIds: string[];
}
