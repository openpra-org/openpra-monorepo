export interface CatalogueEntry {
  gid: string;
  name: string;
  src: string;
  applic: boolean;
  maps: string;
  rationale: string;
}

export interface CatalogueModel {
  entries: CatalogueEntry[];
}

export type CatalogueFilter = "all" | "applic" | "na";
