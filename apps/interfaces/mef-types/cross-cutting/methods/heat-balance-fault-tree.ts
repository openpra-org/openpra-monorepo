import { MethodBase } from "./master-logic-diagram";

export interface HeatBalanceInterface {
  id: string;
  name: string;
  parameters: string[];
  normalRanges: [number, number][];
}

export interface HeatBalanceImbalance {
  id: string;
  description: string;
  threshold: number;
  consequences: string[];
}

export interface HeatBalanceCause {
  id: string;
  description: string;
  probability?: number;
}

export interface HeatBalanceFaultTree extends MethodBase {
  methodKind: "HEAT_BALANCE_FAULT_TREE";
  plantOperatingStateIds: string[];
  systemIds: string[];
  interfaces: HeatBalanceInterface[];
  imbalances: HeatBalanceImbalance[];
  causes: HeatBalanceCause[];
  identifiedInitiatorIds: string[];
}
