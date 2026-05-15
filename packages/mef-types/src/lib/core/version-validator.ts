import { VersionInfo, VERSION_RULES } from "./version";
export function validateVersionInfo(versionInfo: VersionInfo): boolean {
  if (!VERSION_RULES.SEMVER_REGEX.test(versionInfo.version)) {
    throw new Error(`Invalid version format: ${versionInfo.version}. Must follow semantic versioning (X.Y.Z)`);
  }
  if (!VERSION_RULES.DATE_FORMAT.test(versionInfo.lastUpdated)) {
    throw new Error(`Invalid date format: ${versionInfo.lastUpdated}. Must be YYYY-MM-DD`);
  }
  if (!VERSION_RULES.SEMVER_REGEX.test(versionInfo.schemaVersion)) {
    throw new Error(
      `Invalid schema version format: ${versionInfo.schemaVersion}. Must follow semantic versioning (X.Y.Z)`,
    );
  }
  if (versionInfo.schemaVersion < VERSION_RULES.MIN_SCHEMA_VERSION) {
    throw new Error(
      `Schema version ${versionInfo.schemaVersion} is below minimum required version ${VERSION_RULES.MIN_SCHEMA_VERSION}`,
    );
  }
  if (versionInfo.deprecatedFields) {
    versionInfo.deprecatedFields.forEach((field) => {
      if (typeof field !== "string") {
        throw new Error("Deprecated fields must be strings");
      }
    });
  }
  if (versionInfo.deprecatedInterfaces) {
    versionInfo.deprecatedInterfaces.forEach((interfaceName) => {
      if (typeof interfaceName !== "string") {
        throw new Error("Deprecated interfaces must be strings");
      }
    });
  }
  return true;
}
export function createVersionInfo(version: string, schemaVersion: string): VersionInfo {
  const versionInfo: VersionInfo = {
    version,
    lastUpdated: new Date().toISOString().split("T")[0],
    schemaVersion,
    deprecatedFields: [],
    deprecatedInterfaces: [],
  };
  validateVersionInfo(versionInfo);
  return versionInfo;
}
