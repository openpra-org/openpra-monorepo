# Changelog

All notable changes to the OpenPRA Technical Elements package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-03-30

### Added
- Initial release of OpenPRA Technical Elements package
- Core technical element interfaces and types
- Support for all major PRA technical elements:
  - Plant Operating States Analysis
  - Initiating Event Analysis
  - Event Sequence Analysis
  - Success Criteria Development
  - Systems Analysis
  - Human Reliability Analysis
  - Data Analysis
  - Event Sequence Quantification
  - Mechanistic Source Term Analysis
  - Radiological Consequence Analysis
  - Risk Integration
  - Hazard-specific PRAs (Internal Flood, Fire, Seismic, etc.)

### Changed
- None (initial release)

### Deprecated
- None (initial release)

### Removed
- None (initial release)

### Fixed
- None (initial release)

### Security
- None (initial release)

## Version Update Guidelines

### Semantic Versioning Rules
- **MAJOR** version (X.0.0) for breaking schema changes
- **MINOR** version (0.X.0) for new features or non-breaking schema extensions
- **PATCH** version (0.0.X) for documentation updates and bug fixes

### Breaking Changes
A breaking change is defined as any change that:
1. Removes or renames existing fields
2. Changes the type of existing fields
3. Modifies the validation rules in a way that invalidates previously valid data

### Non-Breaking Changes
Non-breaking changes include:
1. Adding new optional fields
2. Adding new validation rules that don't invalidate existing data
3. Documentation improvements
4. Bug fixes that don't change the schema

### Version Update Process
1. Update the version in package.json
2. Add a new section in this CHANGELOG.md
3. Update documentation if needed
4. Tag the release in git
5. Update any dependent packages 