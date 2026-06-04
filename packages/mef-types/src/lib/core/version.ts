export const SCHEMA_VERSION = "0.1.0";
export interface VersionInfo {
  version: string;
  lastUpdated: string;
  schemaVersion: string;
  deprecatedFields?: string[];
  deprecatedInterfaces?: string[];
}
export const VERSION_RULES = {
  SEMVER_REGEX: /^\d+\.\d+\.\d+$/,
  DATE_FORMAT: /^\d{4}-\d{2}-\d{2}$/,
  MIN_SCHEMA_VERSION: "0.1.0",
} as const;
export const VERSION_GUIDELINES = {
  BREAKING_CHANGES: ["Removing or renaming fields", "Changing field types", "Modifying validation rules"],
  NON_BREAKING_CHANGES: ["Adding optional fields", "Adding new validation rules", "Documentation improvements"],
  PATCH_UPDATES: ["Fixing validation bugs", "Correcting documentation", "Minor improvements"],
} as const;
export function createVersionInfo(version: string, schemaVersion: string): VersionInfo {
  const versionInfo: VersionInfo = {
    version,
    lastUpdated: new Date().toISOString().split("T")[0],
    schemaVersion,
    deprecatedFields: [],
    deprecatedInterfaces: [],
  };
  if (!VERSION_RULES.SEMVER_REGEX.test(version)) {
    throw new Error(`Invalid version format: ${version}. Must follow semantic versioning (X.Y.Z)`);
  }
  if (!VERSION_RULES.SEMVER_REGEX.test(schemaVersion)) {
    throw new Error(`Invalid schema version format: ${schemaVersion}. Must follow semantic versioning (X.Y.Z)`);
  }
  if (schemaVersion < VERSION_RULES.MIN_SCHEMA_VERSION) {
    throw new Error(
      `Schema version ${schemaVersion} is below minimum required version ${VERSION_RULES.MIN_SCHEMA_VERSION}`,
    );
  }
  return versionInfo;
}
