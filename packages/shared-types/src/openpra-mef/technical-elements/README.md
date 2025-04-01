# PRA Technical Elements Documentation

OpenPRA technical schema is based on the latest standards for Advanced Non-Light Water Reactor Nuclear Power Plants. This directory provides the formal definitions, examples, and documentation of the OpenPRA schema, enabling its use in both OpenPRA applications and other related applications in the nuclear domain.

To download the JSON Schema for technical elements, visit `/schema-download.html` when running the documentation server. The schema can be used to validate your PRA data structures and ensure compliance with the OpenPRA technical elements specification.

## Table of Contents
- [Understanding TypeScript Types and Interfaces](#understanding-typescript-types-and-interfaces)
  - [Namespace](#namespace)
  - [Interface](#interface)
  - [Properties](#properties)
  - [Variable](#variable)
  - [Type Alias](#type-alias)
  - [Enumeration](#enumeration)
  - [Function](#function)
- [Running the Documentation](#running-the-documentation)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Serving Documentation](#serving-documentation)
- [Schema Generation](#schema-generation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
  - [Reporting Issues](#reporting-issues)
  - [Making Changes](#making-changes)
  - [Ensuring New Files are Documented](#ensuring-new-files-are-documented)
  - [Schema Update Guidelines](#schema-update-guidelines)
- [Versioning](#versioning)
  - [Version Numbers](#version-numbers)
  - [Version Management](#version-management)
  - [Breaking Changes](#breaking-changes)
  - [Non-Breaking Changes](#non-breaking-changes)
  - [Version Update Process](#version-update-process)
- [Versioning Hierarchy](#versioning-hierarchy)
  - [Package Version](#1-package-version-packagejson)
  - [Schema Version](#2-schema-version-coreversionts)
  - [Technical Element Version](#3-technical-element-version-versioninfoversion)
  - [Version Relationships](#version-relationships)
  - [Example Version States](#example-version-states)

## Understanding TypeScript Types and Interfaces

The documentation uses several TypeScript concepts to define and organize the PRA technical elements:

### Namespace
A way to logically group related code elements. These namespaces reflect the PRA Elements in the standard.
```typescript
namespace EventSequenceAnalysis {
    // Contains all event sequence related types
}
```

### Interface
A contract that defines the structure of an object, specifying what properties and methods it must have.
```typescript
interface EventSequence {
    sequenceId: string;
    description: string;
    initiatingEventId: string;
    // ... other properties
}
```

### Properties
Individual fields within an interface or type that define what data can be stored.
```typescript
interface DesignInformation {
    sourceId: string;  // A property of type string
}
```

### Variable
A named storage location for data that can hold values of specific types.
```typescript
const EventSequenceAnalysisSchema = typia.json.application<[EventSequenceAnalysis]>();
// Stores the JSON validation schema for event sequences
```

### Type Alias
A name given to a specific type or combination of types, making complex types more readable and reusable.
```typescript
interface EndState {
    name: "Controlled Release";
    category: string;
    releaseType: string;
    classification: string;
}
```

### Enumeration
A set of named constants that represent distinct values.
```typescript
enum PreventionMitigationLevel {
    FULL = "FULL",
    PARTIAL = "PARTIAL",
    NONE = "NONE"
}
```
### Function
A reusable block of code that performs a specific task, can accept parameters and return values.
```typescript
function validateTemporalPhase(phase: TemporalPhase): boolean {
    // Validates the timing and sequence of component states
    return true;
}
```

Each of these concepts is used throughout the documentation to create a type-safe representation of PRA technical elements.

## Running the Documentation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation
```bash
# Install dependencies
npm install
# Install Typedoc for documentation generation
npm install typedoc --save-dev

```

### Serving Documentation
```bash
# Generate and serve documentation
npm run docs   # Generates documentation
npm run serve  # Serves documentation at http://localhost:8080
```

The documentation will be available at `http://localhost:8080`.

## Schema Generation

The package includes a schema generation feature that allows you to generate JSON Schema definitions for various technical elements.

### Running Schema Generation

To generate schemas for specific elements, use the following command:

```bash
npm run generate-schema:element -- <element-name>
```

For example:
```bash
npm run generate-schema:element -- event-sequence-analysis
```

If you're in the root folder (`openpra-monorepo`), you can run the command with the `--project` flag to specify the package:

```bash
npm run generate-schema:element -- --project=shared-types event-sequence-analysis
```

This will generate JSON Schema definitions for the specified element, which can be used for validation and documentation purposes.

## Troubleshooting

### Common Issues

1. **404 Errors**: If you see 404 errors for module pages, try:
   - Clearing the docs directory: `rm -rf docs`
   - Regenerating documentation: `npm run docs`

2. **TypeDoc Warnings**: Some warnings about undefined types are expected and won't affect the documentation generation.

3. **Port Conflict Resolution**: If you encounter a port conflict while serving documentation, you can specify a different port using the `--port` option with `npm run serve`. For example, to serve on port 8081 instead of the default 8080:
```bash
npm run serve -- --port 8081
```


### Reset Environment
If you encounter any issues with the documentation generation or serving:

1. Clean the environment:
```bash
# Remove generated documentation
rm -rf docs

# Remove dependencies and lock file
rm -rf node_modules
rm -f package-lock.json

# Reinstall dependencies
npm install
```

2. Regenerate documentation:
```bash
npm run docs
npm run serve
```


## Contributing

### Reporting Issues
1. Visit our [GitHub Issues](https://github.com/OpenPRA/OpenPRA/issues)
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - TypeScript/TypeDoc version information

### Making Changes
1. Fork the repository
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Test locally:
   ```bash
   npm run docs
   npm run serve
   ```
5. Commit your changes:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Create a Pull Request:
   - Provide clear description of changes
   - Reference any related issues
   - Include before/after documentation examples if applicable

### Ensuring New Files are Documented
1. **File Visibility**
   - Ensure your TypeScript file has proper export statements
   - Add an `index.ts` in the directory if not present:
     ```typescript
     export * from './risk-integration/risk-integration';
     ```
   - Check that the file is included in `tsconfig.json`'s `include` paths

2. **Documentation Comments**
   - Add TSDoc comments to all exports using `/** */` syntax
   - Include a brief description for each interface, type, and function
   - Example:
     ```typescript
     /** 
      * Represents the risk integration configuration
      * @interface RiskIntegration
      */
     export interface RiskIntegration {
       // ... properties
     }
     ```

3. **Verify Documentation**
   - After adding new files, run:
     ```bash
     npm run docs
     ```
   - Check the generated documentation to confirm your new content appears
   - If missing, verify the export paths and TSDoc comments

### Schema Update Guidelines
1. Follow TypeScript best practices
2. Maintain backward compatibility when possible
3. Document all interfaces and types thoroughly
4. Include examples in JSDoc comments
5. Test documentation generation locally before submitting

### Versioning

The OpenPRA Technical Elements package follows semantic versioning (MAJOR.MINOR.PATCH) to ensure clear communication of changes and maintain compatibility.

#### Version Numbers
- **MAJOR** version (X.0.0): Breaking schema changes
- **MINOR** version (0.X.0): New features or non-breaking schema extensions
- **PATCH** version (0.0.X): Documentation updates and bug fixes

#### Version Management
The package provides several npm scripts for version management:

```bash
# For bug fixes and documentation updates
npm run version:patch

# For new features or non-breaking changes
npm run version:minor

# For breaking schema changes
npm run version:major

# To verify version consistency
npm run version:check
```

#### Breaking Changes
A breaking change is defined as any change that:
1. Removes or renames existing fields
2. Changes the type of existing fields
3. Modifies validation rules in a way that invalidates previously valid data

#### Non-Breaking Changes
Non-breaking changes include:
1. Adding new optional fields
2. Adding new validation rules that don't invalidate existing data
3. Documentation improvements
4. Bug fixes that don't change the schema

#### Version Update Process
When making changes that require a version update:
1. Update the version using the appropriate npm script
2. Add a new section in CHANGELOG.md
3. Update documentation if needed
4. Tag the release in git
5. Update any dependent packages

For detailed version history and guidelines, see [CHANGELOG.md](./CHANGELOG.md).

## Versioning Hierarchy

The technical elements package uses a three-level versioning hierarchy to manage changes at different scopes:

### 1. Package Version (package.json)
- Current version: 0.1.0
- Represents the version of the entire technical elements package
- Changes when:
  - Package structure is modified
  - Shared types are updated
  - Core functionality changes
  - Breaking changes are introduced to any technical element
- Managed through npm version control
- Tracked in CHANGELOG.md

### 2. Schema Version (core/version.ts)
- Current version: 0.1.0 (matches package version)
- Defined in `SCHEMA_VERSION` constant
- Represents the version of the type system/schema
- Used to ensure type compatibility across the codebase
- Must be compatible with the package version
- Changes when:
  - Core interfaces are modified
  - Type validation rules change
  - Breaking changes to shared types

### 3. Technical Element Version (versionInfo.version)
- Each technical element maintains its own version
- Independent of package and schema versions
- Tracked in the element's metadata
- Example structure:
  ```typescript
  {
    metadata: {
      versionInfo: {
        version: "1.0.0",        // Technical element version
        schemaVersion: "0.1.0",  // Must match SCHEMA_VERSION
        lastUpdated: "2024-03-30",
        deprecatedFields: []
      }
    }
  }
  ```
- Changes when:
  - Element-specific interfaces change
  - Element behavior is modified
  - Element-specific validation rules update

### Version Relationships
- Technical elements can evolve independently (different versions)
- All elements must be compatible with the current schema version
- Package version changes trigger schema version updates
- Version validation ensures:
  - All versions follow semantic versioning (MAJOR.MINOR.PATCH)
  - Technical elements use a compatible schema version
  - Version history is properly tracked

### Example Version States
```typescript
// Package version (package.json)
"version": "0.1.0"

// Schema version (core/version.ts)
SCHEMA_VERSION = "0.1.0"

// Individual technical elements can have different versions
systemsAnalysis.metadata.versionInfo.version = "2.1.0"
eventSequenceAnalysis.metadata.versionInfo.version = "1.3.0"
// Both must have schemaVersion = "0.1.0"
```

For version update guidelines and procedures, see the [Versioning](#versioning) section above.