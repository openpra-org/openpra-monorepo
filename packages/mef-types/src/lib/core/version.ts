/**
 * Version-related constants and types for OpenPRA Technical Elements
 */

/**
 * Current schema version for all technical elements
 * @remarks
 * This version should match the package version in package.json
 */
export const SCHEMA_VERSION = "0.1.0";

/**
 * Version information for a technical element
 */
export interface VersionInfo {
  /** Semantic version of the element */
  version: string;
  /** Date when the element was last updated */
  lastUpdated: string;
  /** Schema version this element follows */
  schemaVersion: string;
  /** Fields that have been deprecated */
  deprecatedFields?: string[];
  /** Interfaces that have been deprecated */
  deprecatedInterfaces?: string[];
}

/**
 * Version validation rules
 */
export const VERSION_RULES = {
  /** Regular expression for semantic versioning */
  SEMVER_REGEX: /^\d+\.\d+\.\d+$/,
  /** Date format for lastUpdated field */
  DATE_FORMAT: /^\d{4}-\d{2}-\d{2}$/,
  /** Minimum schema version required */
  MIN_SCHEMA_VERSION: "0.1.0",
} as const;

/**
 * Version update guidelines
 */
export const VERSION_GUIDELINES = {
  /** Breaking changes require major version bump */
  BREAKING_CHANGES: ["Removing or renaming fields", "Changing field types", "Modifying validation rules"],
  /** Non-breaking changes require minor version bump */
  NON_BREAKING_CHANGES: ["Adding optional fields", "Adding new validation rules", "Documentation improvements"],
  /** Patch updates for bug fixes */
  PATCH_UPDATES: ["Fixing validation bugs", "Correcting documentation", "Minor improvements"],
} as const;

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

  // Validate the version info
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
