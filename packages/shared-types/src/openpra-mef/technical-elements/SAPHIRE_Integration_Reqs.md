# SAPHIRE Integration Recommendations

## Overview
This document outlines recommendations for integrating SAPHIRE compatibility into the OpenPRA schema. The goal is to maintain OpenPRA's modern and comprehensive approach while ensuring seamless compatibility with SAPHIRE's data structures and requirements.

## Schema Analysis

### OpenPRA Schema (Main Schema)
- **Structure**: Uses a definitions-based approach with specialized types and interfaces
- **Strengths**:
  - Comprehensive type system
  - Strong documentation and traceability
  - Support for various analysis types
  - Robust metadata handling
  - UUID-based identification
- **Areas for Enhancement**:
  - SAPHIRE-specific data structures
  - Visual representation support
  - Phase and model management

### SAPHIRE Schema (Related Schema)
- **Structure**: Flat document with top-level properties
- **Key Features**:
  - Traditional PRA elements
  - Basic events, fault trees, event trees
  - Color coding and visual support
  - Phase and model type management
  - Special events handling

## Required Enhancements

### 1. Model Types Management
- **Current Gap**: OpenPRA lacks explicit support for different model types
- **Context**: Model types in SAPHIRE allow differentiation between various analysis scenarios (e.g., random failures, seismic events, fire events). This is crucial for:
  - Integrated model solving across different risk scenarios
  - Scenario-specific quantification methods
  - Color-coded visualization and organization
  - Maintaining separate cut sets for different analysis types
- **Required Features**:
  ```json
  {
    "modelTypes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "num": "integer",
          "name": "string",
          "suffix": "string",
          "color": "integer",
          "description": "string"
        }
      }
    }
  }
  ```
- **SAPHIRE Annotation**: "Required for SAPHIRE model type differentiation (MTD format)"

### 2. Phase Model Support
- **Current Gap**: Missing phase definition structure
- **Context**: Phases in SAPHIRE represent different temporal or operational stages in an analysis, enabling:
  - Time-dependent risk assessment
  - Stage-specific success criteria
  - Different system configurations per phase
  - Sequential dependency modeling
- **Required Features**:
  ```json
  {
    "phases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "num": "integer",
          "name": "string",
          "order": "integer",
          "suffix": "string",
          "color": "integer"
        }
      }
    }
  }
  ```
- **SAPHIRE Annotation**: "Required for SAPHIRE phase handling (PHD format)"

### 3. Special Events Support
- **Current Gap**: No standardized special events handling
- **Context**: Special events in SAPHIRE serve specific logical and analytical purposes:
  - TRUE event (probability = 1.0): Used for guaranteed occurrence scenarios
  - FALSE event (probability = 0.0): Used for impossible scenarios
  - PASS event: Used for logic flow control and value passing
  - INIT event: Used as placeholders for initiating events
  These events are fundamental to proper fault tree and event tree logic modeling
- **Required Features**:
  - TRUE event (probability = 1.0)
  - FALSE event (probability = 0.0)
  - PASS event
  - INIT event
- **SAPHIRE Annotation**: "Required for SAPHIRE special event compatibility"

### 4. Basic Event Enhancements
- **Current Gap**: Missing SAPHIRE-specific attributes
- **Context**: SAPHIRE's basic events contain rich metadata and templating capabilities that support:
  - Standardized component modeling
  - Consistent failure mode representation
  - Systematic event categorization
  - Efficient bulk updates through templates
  - Detailed component tracking and documentation
- **Required Features**:
  - Template support with comprehensive flags:
    ```json
    "templateUseFlags": {
      "componentId": "boolean",
      "system": "boolean",
      "train": "boolean",
      "type": "boolean",
      "failureMode": "boolean",
      "location": "boolean",
      "eventType": "boolean",
      "description": "boolean",
      "models": "boolean",
      "phases": "boolean",
      "notes": "boolean",
      "references": "boolean",
      "categories": "boolean[]"
    }
    ```
  - Alternate descriptions (BEDA format)
  - Component ID and train identifiers
  - System and location identifiers
  - Failure mode specifications
- **SAPHIRE Annotation**: "Required for SAPHIRE basic event compatibility (BED format)"

### 5. Project Attributes Support
- **Current Gap**: Missing SAPHIRE-specific project attributes
- **Context**: Project attributes in SAPHIRE provide essential metadata and analysis parameters that:
  - Define global analysis settings (e.g., mission time)
  - Document project context and history
  - Support configuration management
  - Enable project identification and tracking
  - Facilitate multi-project analysis and comparison
- **Required Features**:
  ```json
  {
    "project": {
      "missionTime": "number",
      "newSum": "string",
      "company": "string",
      "location": "string",
      "type": "string",
      "design": "string",
      "vendor": "string",
      "architectEngineer": "string",
      "operationDate": "string (YYYY/MM/DD)",
      "qualificationDate": "string (YYYY/MM/DD)",
      "alternateName": "string",
      "analystInfo": "string"
    }
  }
  ```
- **SAPHIRE Annotation**: "Required for SAPHIRE project compatibility (FAA format)"

## Implementation Strategy

### 1. Schema Updates
1. Add new `SaphireCompatibility` interface
2. Enhance existing types with SAPHIRE fields
3. Add validation rules
4. Include format requirements
5. Add project attributes support
6. Implement template flag system
7. Add date format validation

### 2. Required Annotations
Add clear annotations for:
- SAPHIRE compatibility requirements
- Field format specifications
- Validation rules
- Export/import requirements

### 3. Validation Layer
Implement validation for:
- Required SAPHIRE fields
- Data format compatibility
- Special events handling
- Cross-references integrity

### 4. Migration Support
Provide:
- Data migration tools
- Format conversion utilities
- Validation scripts
- Documentation for migration process

## Best Practices

### 1. Schema Evolution
- Maintain backward compatibility
- Use optional fields for SAPHIRE-specific data
- Document all SAPHIRE requirements
- Version schema changes

### 2. Data Validation
- Validate SAPHIRE-specific formats
- Check for required fields
- Verify color codes and suffixes
- Ensure phase ordering integrity
- Validate date formats (YYYY/MM/DD)
- Verify mission time is non-negative
- Check template flag consistency
- Validate new sum format pattern

### 3. Documentation
- Document SAPHIRE compatibility requirements
- Provide migration guides
- Include validation rules
- Add example implementations

### 4. Format Requirements
- Date formats must follow YYYY/MM/DD pattern
- Color codes must be within 0-16777215 range
- New sum format must match pattern ^[-E]+$
- Phase numbers must be unique
- Model type numbers must be unique
- Template flags must be boolean
- Mission time must be non-negative

## Implementation Priorities

1. **High Priority**:
   - Add `SaphireCompatibility` interface
   - Implement basic event enhancements with template system
   - Add phase model support
   - Add project attributes support

2. **Medium Priority**:
   - Add model types management
   - Implement special events support
   - Add validation layer

3. **Low Priority**:
   - Add color coding support
   - Implement visual attributes
   - Add optional SAPHIRE-specific fields

## Next Steps

1. Review and approve schema updates
2. Implement high-priority changes
3. Create validation tools
4. Test with sample data
5. Document changes and requirements
6. Create migration guides

## Maintenance Considerations

1. **Version Control**:
   - Track schema versions
   - Document changes
   - Maintain compatibility matrix

2. **Testing**:
   - Create test cases
   - Validate conversions
   - Check data integrity

3. **Documentation**:
   - Update technical documentation
   - Provide migration guides
   - Include example implementations

## Conclusion

The proposed enhancements will ensure OpenPRA maintains its modern architecture while providing seamless SAPHIRE compatibility. The implementation strategy focuses on maintainability, clarity, and long-term sustainability.
