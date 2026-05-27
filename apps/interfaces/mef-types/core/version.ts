export const SCHEMA_VERSION = "0.1.0";

export interface VersionInfo {
  version: string;
  lastUpdated: string;
  schemaVersion: string;
  deprecatedFields?: string[];
  deprecatedInterfaces?: string[];
}
