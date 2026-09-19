import type { RcSourceTerm } from "./source-term";
export type RcTransportFile = NonNullable<RcSourceTerm["originalFile"]>;
export interface RcDepositionData {
  velocities: number[];
  groups: { id: number; name: string; fractions: number[]; wet?: boolean; dry?: boolean }[];
}
export interface RcDispersionReference {
  sigmaYA: number[]; sigmaYB: number[]; sigmaZA: number[]; sigmaZB: number[];
  sidewaysScale: number; verticalScale: number;
}
export interface RcDecayParent {
  index: number; nuclide: string; energy: string; halfLife: string; ground: boolean;
  dataset: string; daughter: string; levelCount: number;
}
export interface RcDecayLevel { nuclide: string; energy: string; halfLife: string; metastable: boolean; betaFeeding: string }
export interface RcDecayDetail { parent: RcDecayParent; original: string; normalization: string[]; levels: RcDecayLevel[]; offset: number }
export interface RcTransportSettings {
  groupVelocities: { groupId: number; name: string; velocity: number; basis: "openrc_default" | "noble_gas" | "analyst" }[];
  decayMode: "parent" | "ingrowth";
}
export interface RcTransportCategory {
  categoryId: string;
  settings?: RcTransportSettings;
  savedForSourceRevision?: number;
  deposition?: { file: RcTransportFile; data: RcDepositionData };
}
export interface RcTransportInputs {
  revision: number;
  categories: RcTransportCategory[];
  dispersionReference?: { file: RcTransportFile; data: RcDispersionReference };
  decayFiles: { file: RcTransportFile; parents: RcDecayParent[] }[];
}
export interface RcLinkedDeposition { sourceRevision: number; file?: RcTransportFile; data?: RcDepositionData; issue?: string }
