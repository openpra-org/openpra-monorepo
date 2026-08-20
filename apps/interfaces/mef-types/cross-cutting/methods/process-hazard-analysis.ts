import { MethodBase } from "./master-logic-diagram";

export interface PhaReconciliationItem {
  id: string;
  topic: string;
  fmeaCoverage: string;
  hazopCoverage: string;
  resolution: string;
  derivedInitiatorIds: string[];
}

export interface ProcessHazardAnalysis extends MethodBase {
  methodKind: "PROCESS_HAZARD_ANALYSIS";
  scope: string;
  reconciledFmeaIds: string[];
  reconciledHazopIds: string[];
  reconciliationItems: PhaReconciliationItem[];
  directInitiatorIds: string[];
}
