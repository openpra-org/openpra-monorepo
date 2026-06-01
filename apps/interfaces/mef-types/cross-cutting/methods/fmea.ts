import { MethodBase } from "./master-logic-diagram";

export interface FmeaSystem {
  id: string;
  name: string;
  function: string;
  boundaries: string[];
}

export interface FmeaFailureMode {
  id: string;
  componentId: string;
  mode: string;
  causes: string[];
  localEffects: string[];
  systemEffects: string[];
  detection: string[];
  safeguards: string[];
  severity: number;
  probability?: number;
  derivedInitiatorIds: string[];
}

export interface FailureModesEffectAnalysis extends MethodBase {
  methodKind: "FMEA";
  systems: FmeaSystem[];
  componentIds: string[];
  failureModes: FmeaFailureMode[];
}
