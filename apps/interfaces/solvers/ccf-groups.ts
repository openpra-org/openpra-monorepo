import { BasicEventId } from "./boolean-logic";

export enum CcfModelType {
  BETA_FACTOR = "BETA_FACTOR",
  MGL = "MGL",
  ALPHA_FACTOR = "ALPHA_FACTOR",
  PHI_FACTOR = "PHI_FACTOR",
}

export interface BetaFactorModel {
  modelType: CcfModelType.BETA_FACTOR;
  beta: number;
  totalFailureProbability: number;
}

export interface MglModel {
  modelType: CcfModelType.MGL;
  beta: number;
  gamma?: number;
  delta?: number;
  additionalFactors?: Record<string, number>;
  totalFailureProbability: number;
}

export interface AlphaFactorModel {
  modelType: CcfModelType.ALPHA_FACTOR;
  alphaFactors: Record<string, number>;
  totalFailureProbability: number;
}

export interface PhiFactorModel {
  modelType: CcfModelType.PHI_FACTOR;
  phiFactors: Record<string, number>;
  totalFailureProbability: number;
}

export type CcfParameterModel = BetaFactorModel | MglModel | AlphaFactorModel | PhiFactorModel;

export interface CcfGroup {
  id: number;
  name?: string;
  memberBasicEventIds: BasicEventId[];
  model: CcfParameterModel;
  dataAnalysisCCFParameterRef?: string;
}

export interface CcfGroupTable {
  id: number;
  booleanModelRef: number;
  groups: CcfGroup[];
}
