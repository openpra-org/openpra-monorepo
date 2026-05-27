export interface Unique {
  uuid: string;
}
export interface Named {
  name: string;
  description?: string;
}
export interface Versioned {
  version: string;
  lastUpdated: string;
}
