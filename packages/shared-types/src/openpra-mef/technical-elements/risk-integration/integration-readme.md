# Risk Integration Module: Integration Documentation

## Overview

The Risk Integration module serves as a downstream technical element in the OpenPRA framework, synthesizing inputs from multiple upstream technical elements to calculate overall risk metrics and identify significant contributors. This document provides a comprehensive guide to how Risk Integration interfaces with other modules.

## Integration Architecture

Risk Integration follows a hierarchical dependency structure:
1. **Core events and shared patterns** (most upstream)
2. **Technical elements** like Event Sequence Analysis, Mechanistic Source Term Analysis (midstream)
3. **Risk Integration** (downstream, depends on all other technical elements)

### Integration Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Data Analysis  │     │ Success Criteria │     │ Systems Analysis│
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Event Sequence  │────▶│  Mechanistic    │     │ Initiating Event│
│    Analysis     │◀────│  Source Term    │     │    Analysis     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         └───────────────┬───────────────┬───────────────┘
                         │               │
                         ▼               │
               ┌─────────────────┐       │
               │Risk Integration │◀──────┘
               └─────────────────┘
```

## Cross-Module Reference Pattern

Risk Integration uses a consistent pattern for referencing entities from other modules:

1. **String-based identifiers** with TypeScript pattern validation
2. **Reference types** defined for each entity type (e.g., `EventSequenceReference`)
3. **Bidirectional traceability** through explicit reference fields

## Module-Specific Integrations

### 1. Event Sequence Analysis Integration

#### Data Flow: Event Sequence Analysis → Risk Integration
- Event sequence families and their frequencies
- Event sequence to release category mappings

#### Interface: `EventSequenceToReleaseCategory`
```typescript
export interface EventSequenceToReleaseCategory extends Unique {
    eventSequenceId: EventSequenceReference | EventSequenceFamilyReference;
    releaseCategoryId: ReleaseCategoryReference;
    // Additional fields...
    originalMappingId?: string;
    consistentWithEventSequenceAnalysis?: boolean;
}
```

#### Feedback: Risk Integration → Event Sequence Analysis
Risk Integration provides feedback through the `eventSequenceAnalysisFeedback` field:
- Updated frequency information
- Risk significance assessments
- Insights and recommendations

#### Integration Workflow
1. Event Sequence Analysis defines event sequences and their frequencies
2. Risk Integration imports these sequences via references
3. Risk Integration calculates risk metrics and identifies significant contributors
4. Risk Integration provides feedback to Event Sequence Analysis for refinement

### 2. Mechanistic Source Term Analysis Integration

#### Data Flow: Mechanistic Source Term → Risk Integration
- Release categories and their characteristics
- Source term definitions
- Event sequence to release category mappings

#### Interface: `EventSequenceToReleaseCategory` (shared with Event Sequence Analysis)
This interface bridges both Event Sequence Analysis and Mechanistic Source Term Analysis.

#### Feedback: Risk Integration → Mechanistic Source Term
Risk Integration provides feedback through the `mechanisticSourceTermFeedback` field:
- Risk significance of release categories
- Insights on source term definitions
- Recommendations for mapping improvements

#### Integration Workflow
1. Mechanistic Source Term defines release categories and source terms
2. Risk Integration incorporates these into risk calculations
3. Risk Integration identifies significant contributors
4. Risk Integration provides feedback on release category definitions

### 3. Systems Analysis Integration

#### Data Flow: Systems Analysis → Risk Integration
- System definitions and their characteristics
- System dependencies and failure modes

#### References: `SystemReference`
Used to link systems identified in Systems Analysis to risk contributors.

#### Integration Workflow
1. Systems Analysis defines systems and their characteristics
2. Risk Integration identifies significant system contributors
3. Risk Integration calculates importance measures for systems
4. Risk Integration provides insights on risk-significant systems

### 4. Data Analysis Integration

#### Data Flow: Data Analysis → Risk Integration
- Uncertainty models and distributions
- Parameter data and sources

#### Imported Types
- `Uncertainty`
- `DataSource`
- `Assumption`
- `DistributionType`

#### Integration Workflow
1. Data Analysis provides uncertainty models and distributions
2. Risk Integration uses these for uncertainty characterization
3. Risk Integration propagates uncertainties through risk calculations
4. Risk Integration identifies key sources of uncertainty

### 5. Initiating Event Analysis Integration

#### Data Flow: Initiating Event Analysis → Risk Integration
- Plant operating states
- Initiating event frequencies

#### References: `PlantOperatingStateReference`
Used to link plant operating states to risk contributors.

#### Integration Workflow
1. Initiating Event Analysis defines plant operating states
2. Risk Integration incorporates these into risk calculations
3. Risk Integration identifies significant plant operating states
4. Risk Integration provides insights on risk-significant operating states

### 6. Success Criteria Development Integration

#### Data Flow: Success Criteria → Risk Integration
- Success criteria definitions

#### References: `SuccessCriteriaId`
Used to link success criteria to risk evaluations.

#### Integration Workflow
1. Success Criteria Development defines success criteria
2. Risk Integration incorporates these into risk significance evaluations
3. Risk Integration ensures consistent application of success criteria

## Common Integration Challenges

1. **Consistency Across Modules**: Ensuring consistent application of risk significance criteria across all analyses, plant operating states, and hazard groups.

2. **Uncertainty Propagation**: Properly propagating uncertainties from upstream modules through risk calculations.

3. **Traceability**: Maintaining bidirectional traceability between Risk Integration and other modules.

4. **Feedback Implementation**: Ensuring that feedback from Risk Integration is properly incorporated into upstream modules.

## Best Practices

1. **Reference Management**: Always use the defined reference types when linking to entities from other modules.

2. **Feedback Documentation**: Document all feedback provided to upstream modules, including the basis for recommendations.

3. **Consistency Checks**: Implement validation rules to ensure consistency between Risk Integration and other modules.

4. **Version Tracking**: Track versions of upstream analyses used in Risk Integration through the `additionalMetadata` field.

## Versioning and Compatibility

As the Risk Integration module evolves, interfaces may change. To maintain compatibility:

1. **Interface Stability**: Core integration interfaces like `EventSequenceToReleaseCategory` should remain stable.

2. **Optional Fields**: New fields should be added as optional to maintain backward compatibility.

3. **Version Tracking**: Track versions of upstream analyses used in Risk Integration through the `additionalMetadata` field.

## Future Enhancements and Recommended Refactors

To further improve the integration architecture with minimal changes, the following enhancements and refactors are recommended:

### 1. Enhanced Integration Documentation

While this readme provides a comprehensive overview, the code itself should be enhanced with:

- **@integration JSDoc Tag**: Add a custom `@integration` JSDoc tag to document integration points directly in the code:
  ```typescript
  /**
   * @integration EventSequenceAnalysis
   * Imports event sequence families and their frequencies.
   * Provides feedback on risk significance.
   */
  ```

- **Module-Level Integration Comments**: Add standardized integration documentation at the top of each module file:
  ```typescript
  /**
   * @module risk_integration
   * @integration_pattern
   * This module integrates with:
   * - Event Sequence Analysis: Imports event sequences, provides feedback
   * - Mechanistic Source Term: Imports release categories, provides feedback
   * - ...
   */
  ```

### 2. Standardized Feedback Mechanisms

Enhance feedback to upstream modules by defining a consistent base feedback interface:

```typescript
/** Base interface for all feedback to upstream modules */
export interface ModuleFeedback {
  /** ID of the analysis receiving feedback */
  analysisId: string;
  
  /** Version of the analysis when feedback was generated */
  analysisVersion?: string;
  
  /** Timestamp when feedback was generated */
  feedbackTimestamp: string;
  
  /** General feedback applicable to the entire module */
  generalFeedback?: string;
}

/** Feedback specific to Event Sequence Analysis */
export interface EventSequenceAnalysisFeedback extends ModuleFeedback {
  // Event sequence specific feedback fields
}
```

This provides more structured feedback mechanisms and ensures all feedback includes standard fields for traceability.

### 3. Interface Versioning

Implement simple interface versioning by adding version fields to key integration interfaces:

```typescript
export interface EventSequenceToReleaseCategory extends Unique {
  /** Interface version for compatibility tracking */
  interfaceVersion?: string;
  
  // Existing fields...
}
```

Document compatibility requirements in JSDoc:

```typescript
/**
 * @compatibility
 * - v1.0: Initial version
 * - v1.1: Added sourceTermDefinitionReference field (optional)
 * - v2.0: Changed frequency from string to number (breaking)
 */
```

### 4. Centralized Reference Type Registry

Create a shared reference type pattern library in a dedicated file:

```typescript
// reference-types.ts
export type ReferencePattern = {
  EVENT_SEQUENCE: string & tags.Pattern<"^ES-[A-Za-z0-9_-]+$">;
  RELEASE_CATEGORY: string & tags.Pattern<"^RC-[A-Za-z0-9_-]+$">;
  // Other reference patterns...
}
```

Gradually migrate existing reference types to use this library:

```typescript
import { ReferencePattern } from "../core/reference-types";

export type EventSequenceReference = ReferencePattern["EVENT_SEQUENCE"];
```

This centralized registry will improve consistency and maintainability of reference types across the codebase.

### 5. Integration Testing

Develop comprehensive tests for module interactions to ensure:

- Proper data flow between modules
- Correct handling of references
- Appropriate propagation of uncertainties
- Effective feedback mechanisms

These tests should verify both the technical correctness of the integration and the business logic of the risk integration process.

## Conclusion

The Risk Integration module serves as the synthesis point for the entire PRA framework, bringing together inputs from multiple technical elements to provide a comprehensive view of risk. By following the patterns and practices outlined in this document, developers can ensure proper integration between Risk Integration and other modules.
