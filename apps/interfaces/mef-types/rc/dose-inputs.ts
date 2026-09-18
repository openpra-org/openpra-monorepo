import type { RcSourceTerm } from "./source-term";
export type RcDosePathway = "inhalation" | "cloudshine" | "groundshine";
export type RcDoseFile = NonNullable<RcSourceTerm["originalFile"]>;
export interface RcDoseSettings { integrationSeconds: number; basis: "imported" | "analyst" }
export interface RcExposureData { integrationSeconds: number; blocks: { index: number; records: Record<string, number> }[] }
export interface RcDoseCategory { categoryId: string; settings?: RcDoseSettings; savedForSourceRevision?: number; exposure?: { file: RcDoseFile; data: RcExposureData } }
export interface RcDoseLibrary { kind: RcDosePathway; file: RcDoseFile; nuclides: string[]; recordCount: number }
export interface RcDoseInputs { revision: number; categories: RcDoseCategory[]; libraries: RcDoseLibrary[] }
export interface RcDoseRecord {
  index: number; name: string; value: string; values: string[]; raw: string;
  inhalation?: { ageDays: number; amadMicrometres: number; absorption: string; form: string; f1: string; components: number; let: "L" | "H"; highLet?: { raw: string; values: string[] } };
}
export interface RcDoseFilePage { text: string; offset: number; total: number }
