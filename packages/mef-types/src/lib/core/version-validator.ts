import { VersionInfo, VERSION_RULES } from "./version";

/**
 * Validates version information for a technical element
 * @param versionInfo The version information to validate
 * @returns true if valid, throws error if invalid
 */
export function validateVersionInfo(versionInfo: VersionInfo): boolean {
  // Check semantic version format
  if (!VERSION_RULES.SEMVER_REGEX.test(versionInfo.version)) {
    throw new Error(`Invalid version format: ${versionInfo.version}. Must follow semantic versioning (X.Y.Z)`);
  }

  // Check date format
  if (!VERSION_RULES.DATE_FORMAT.test(versionInfo.lastUpdated)) {
    throw new Error(`Invalid date format: ${versionInfo.lastUpdated}. Must be YYYY-MM-DD`);
  }

  // Check schema version
  if (!VERSION_RULES.SEMVER_REGEX.test(versionInfo.schemaVersion)) {
    throw new Error(
      `Invalid schema version format: ${versionInfo.schemaVersion}. Must follow semantic versioning (X.Y.Z)`,
    );
  }

  // Check if schema version meets minimum requirement
  if (versionInfo.schemaVersion < VERSION_RULES.MIN_SCHEMA_VERSION) {
    throw new Error(
      `Schema version ${versionInfo.schemaVersion} is below minimum required version ${VERSION_RULES.MIN_SCHEMA_VERSION}`,
    );
  }

  // Validate deprecated fields if present
  if (versionInfo.deprecatedFields) {
    versionInfo.deprecatedFields.forEach((field) => {
      if (typeof field !== "string") {
        throw new Error("Deprecated fields must be strings");
      }
    });
  }

  // Validate deprecated interfaces if present
  if (versionInfo.deprecatedInterfaces) {
    versionInfo.deprecatedInterfaces.forEach((interfaceName) => {
      if (typeof interfaceName !== "string") {
        throw new Error("Deprecated interfaces must be strings");
      }
    });
  }

  return true;
}

/**
 * Creates a new version info object with current date
 * @param version The semantic version
 * @param schemaVersion The schema version
 * @returns A new VersionInfo object
 */
export function createVersionInfo(version: string, schemaVersion: string): VersionInfo {
  const versionInfo: VersionInfo = {
    version,
    lastUpdated: new Date().toISOString().split("T")[0], // Format as YYYY-MM-DD
    schemaVersion,
    deprecatedFields: [],
    deprecatedInterfaces: [],
  };

  validateVersionInfo(versionInfo);
  return versionInfo;
}
