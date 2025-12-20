# Risk Integration Module: Integration Documentation

## Overview

The Risk Integration module serves as a downstream technical element in the OpenPRA framework, synthesizing inputs from multiple upstream technical elements to calculate overall risk metrics and identify significant contributors. This document provides a comprehensive guide to how Risk Integration interfaces with other modules.

## Integration Architecture

Risk Integration follows a hierarchical dependency structure:

1. **Core events and shared patterns** (most upstream)
2. **Technical elements** like Event Sequence Quantification (ESQ) and Radiological Consequence Analysis (RCA) (midstream)
3. **Risk Integration** (downstream, depends primarily on ESQ and RCA)

### Key Dependency Principles

1. **Clean Dependency Hierarchy**: Risk Integration primarily depends on Event Sequence Quantification (ESQ) and Radiological Consequence Analysis (RCA), which serve as proxy layers for upstream elements.

2. **Proxied Dependencies**: ESQ and RCA re-export necessary types from upstream modules, ensuring Risk Integration doesn't directly depend on those modules.

3. **Reference-Based Integration**: References are used to maintain loose coupling between modules.

4. **Bidirectional Feedback**: Structured feedback interfaces provide insights back to upstream modules.

## Dependency Structure Improvements

The Risk Integration module has been refactored to use a cleaner dependency structure:

### 1. Index-Based Import Pattern

An `index.ts` file has been added to the Risk Integration module to provide a clean entry point for imports:

```typescript
// Export all types from the main module
export * from './risk-integration';

// Define commonly used type groupings for easier imports
export {
  // Key interfaces for risk significance
  RiskSignificanceCriteria,
  RiskSignificanceEvaluation,

  // Other interface exports...
} from './risk-integration';
```

### 2. Dependency Proxying

Risk Integration now depends primarily on:

- **Event Sequence Quantification** for sequence frequencies and importance metrics
- **Radiological Consequence Analysis** for consequence metrics and uncertainty analysis

These modules re-export necessary types from their upstream modules, maintaining a clean dependency hierarchy:

```typescript
// In risk-integration.ts
import { EventSequenceReference, RiskSignificantEventSequence } from '../event-sequence-quantification';

import { ReleaseCategoryReference, RiskSignificantConsequence } from '../radiological-consequence-analysis';
```

### 3. Reference-Based Integration

String-based reference types are used throughout the codebase to maintain loose coupling:

```typescript
export type EventSequenceReference = string & tags.Pattern<'^ES-[A-Za-z0-9_-]+$'>;
export type ReleaseCategoryReference = string & tags.Pattern<'^RC-[A-Za-z0-9_-]+$'>;
```

### 4. Enhanced Documentation

Code-level documentation has been enhanced to provide clear guidance on dependency structure:

```typescript
/**
 * @dependency_structure
 * This module follows a hierarchical dependency structure:
 * 1. Core events and shared patterns - Most upstream
 * 2. Technical elements like ESQ and RCA - Midstream
 * 3. Risk Integration - Downstream, depends primarily on ESQ and RCA
 *
 * IMPORTANT: Risk Integration should primarily depend on:
 * - Event Sequence Quantification (ESQ)
 * - Radiological Consequence Analysis (RCA)
 */
```

## Cross-Module Reference Pattern

Risk Integration uses a consistent pattern for referencing entities from other modules:

1. **String-based identifiers** with TypeScript pattern validation
2. **Reference types** defined for each entity type (e.g., `EventSequenceReference`)
3. **Bidirectional traceability** through explicit reference fields

## Module-Specific Integrations

### 1. Event Sequence Quantification Integration

#### Data Flow: Event Sequence Quantification → Risk Integration

- Risk-significant event sequences and their frequencies
- Event sequence references for mapping to release categories

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

#### Primary Input Interface

```typescript
export interface RiskSignificantEventSequence {
  id: EventSequenceReference;
  name: string;
  frequency: Frequency;
  riskSignificance: ImportanceLevel;
  // Additional fields...
}
```

#### Feedback: Risk Integration → Event Sequence Quantification

Risk Integration provides feedback through the `eventSequenceAnalysisFeedback` field:

- Updated frequency information
- Risk significance assessments
- Insights and recommendations

#### Integration Workflow

1. Event Sequence Quantification identifies risk-significant sequences
2. Risk Integration imports these sequences via the `eventSequenceQuantificationInputs` field
3. Risk Integration calculates risk metrics and identifies significant contributors
4. Risk Integration provides feedback to Event Sequence Quantification for refinement

### 2. Radiological Consequence Analysis Integration

#### Data Flow: Radiological Consequence Analysis → Risk Integration

- Risk-significant consequences
- Release category references
- Source term references

#### Primary Input Interface

```typescript
export interface RiskSignificantConsequence {
  id: string;
  releaseCategoryId: ReleaseCategoryReference;
  consequenceMetric: string;
  value: number;
  riskSignificance: ImportanceLevel;
  // Additional fields...
}
```

#### Feedback: Risk Integration → Radiological Consequence Analysis

Risk Integration provides feedback through the `radiologicalConsequenceAnalysisFeedback` field:

- Risk significance of release categories
- Insights on source term definitions
- Recommendations for mapping improvements

#### Integration Workflow

1. Radiological Consequence Analysis identifies risk-significant consequences
2. Risk Integration incorporates these into risk calculations via the `radiologicalConsequenceInputs` field
3. Risk Integration identifies significant contributors
4. Risk Integration provides feedback on release category definitions

### 3. Systems Analysis Integration

#### Data Flow: Systems Analysis → Risk Integration (via ESQ)

- System definitions and their characteristics
- System dependencies and failure modes

#### References: `SystemReference`

Used to link systems identified in Systems Analysis to risk contributors.

#### Integration Workflow

1. Systems Analysis defines systems and their characteristics
2. ESQ incorporates system information in importance measures
3. Risk Integration receives system information via ESQ
4. Risk Integration calculates importance measures for systems
5. Risk Integration provides insights on risk-significant systems

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

## Common Integration Challenges

1. **Consistency Across Modules**: Ensuring consistent application of risk significance criteria across all analyses, plant operating states, and hazard groups.

2. **Uncertainty Propagation**: Properly propagating uncertainties from upstream modules through risk calculations.

3. **Traceability**: Maintaining bidirectional traceability between Risk Integration and other modules.

4. **Feedback Implementation**: Ensuring that feedback from Risk Integration is properly incorporated into upstream modules.

## Best Practices

1. **Use the Index File**: Always import from the `risk-integration` directory, not the implementation file:

   ```typescript
   // ✅ GOOD
   import { RiskIntegration } from '../technical-elements/risk-integration';

   // ❌ BAD
   import { RiskIntegration } from '../technical-elements/risk-integration/risk-integration';
   ```

2. **Import Proxied Types**: Always import types from ESQ and RCA, not directly from upstream modules:

   ```typescript
   // ✅ GOOD
   import { EventSequenceReference } from '../event-sequence-quantification';

   // ❌ BAD
   import { EventSequenceReference } from '../event-sequence-analysis';
   ```

3. **Use Reference Types**: Use reference types when referring to entities from other modules:

   ```typescript
   // ✅ GOOD
   const mapping = {
     eventSequenceId: 'ES-LOCA-001', // EventSequenceReference
     releaseCategoryId: 'RC-SMALL-001', // ReleaseCategoryReference
   };

   // ❌ BAD
   const mapping = {
     eventSequence: eventSequence, // Direct object reference
     releaseCategory: releaseCategory, // Direct object reference
   };
   ```

4. **Document Feedback Mechanisms**: Document all feedback provided to upstream modules, including the basis for recommendations.

5. **Implement Validation Rules**: Ensure consistency between Risk Integration and other modules.

6. **Track Versions**: Track versions of upstream analyses used in Risk Integration through the `additionalMetadata` field.

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
  EVENT_SEQUENCE: string & tags.Pattern<'^ES-[A-Za-z0-9_-]+$'>;
  RELEASE_CATEGORY: string & tags.Pattern<'^RC-[A-Za-z0-9_-]+$'>;
  // Other reference patterns...
};
```

Gradually migrate existing reference types to use this library:

```typescript
import { ReferencePattern } from '../core/reference-patterns';

export type EventSequenceReference = ReferencePattern['EVENT_SEQUENCE'];
```

This centralized registry will improve consistency and maintainability of reference types across the codebase.

### 5. Integration Testing

Develop comprehensive tests for module interactions to ensure:

- Proper data flow between modules
- Correct handling of references
- Appropriate propagation of uncertainties
- Effective feedback mechanisms

These tests should verify both the technical correctness of the integration and the business logic of the risk integration process.

## Code Examples

The following examples demonstrate how to use the Risk Integration module while maintaining the clean dependency structure.

### Proper Import Patterns

#### Basic Imports

```typescript
// Import the entire module (preferred for most cases)
import * as RiskIntegration from '../technical-elements/risk-integration';

// Create a new risk integration instance
const riskIntegration: RiskIntegration.RiskIntegration = {
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  elementType: TechnicalElementTypes.RISK_INTEGRATION,
  name: 'Plant Risk Integration Analysis',
  // ...other fields
};
```

#### Selective Imports

```typescript
// Import specific types needed for your implementation
import {
  RiskSignificanceCriteria,
  IntegratedRiskResults,
  EventSequenceToReleaseCategory,
} from '../technical-elements/risk-integration';

// Create a risk significance criteria
const criteria: RiskSignificanceCriteria = {
  uuid: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Core Damage Frequency Significance',
  criteriaType: 'HYBRID',
  metricType: 'CDF',
  // ...other fields
};
```

### Practical Integration Examples

#### Event Sequence Quantification Integration Example

```typescript
// ❌ BAD: Importing directly from upstream module
import { EventSequence } from '../technical-elements/event-sequence-analysis';

// ✅ GOOD: Import from ESQ which re-exports necessary types
import {
  EventSequenceReference,
  RiskSignificantEventSequence,
} from '../technical-elements/event-sequence-quantification';

// Use the re-exported types in Risk Integration
const sequenceMapping: EventSequenceToReleaseCategory = {
  uuid: '123e4567-e89b-12d3-a456-426614174002',
  eventSequenceId: 'ESF-LOCA-001', // EventSequenceReference
  releaseCategoryId: 'RC-SMALL-001',
  mappingBasis: 'Based on thermal-hydraulic analysis of LOCA scenarios',
  frequency: 1.2e-6,
  frequencyUnit: 'PER_REACTOR_YEAR',
};
```

#### Feedback Implementation Example

```typescript
// Providing feedback to Event Sequence Quantification
const feedback = {
  eventSequenceAnalysisFeedback: {
    analysisId: 'ESA-2023-001',
    eventSequenceFamilyFeedback: [
      {
        familyId: 'ESF-LOCA-001',
        riskSignificance: 'HIGH',
        insights: [
          'This sequence family contributes 15% of total core damage frequency',
          'Dominant cut sets involve operator failures during recirculation',
        ],
        recommendations: ['Consider more detailed modeling of operator actions during recirculation'],
      },
    ],
  },
};
```

### Anti-Patterns to Avoid

#### ❌ Direct Import from Upstream Elements

```typescript
// AVOID: Importing directly from upstream modules
import { EventSequence } from '../technical-elements/event-sequence-analysis';
import { SourceTerm } from '../technical-elements/mechanistic-source-term';
```

#### ❌ Bypassing Proxy Types

```typescript
// AVOID: Using types from upstream modules directly
const mapping = {
  eventSequence: eventSequence, // Direct reference to EventSequence object
  releaseCategory: releaseCategory, // Direct reference to ReleaseCategory object
};
```

#### ❌ Circular Dependencies

```typescript
// AVOID: Creating circular dependencies
// In risk-integration.ts
import { EventSequenceQuantification } from '../event-sequence-quantification';

// In event-sequence-quantification.ts
import { RiskIntegration } from '../risk-integration';
```

## Conclusion

The Risk Integration module serves as the synthesis point for the entire PRA framework, bringing together inputs from multiple technical elements to provide a comprehensive view of risk. By following the patterns and practices outlined in this document, developers can ensure proper integration between Risk Integration and other modules, while maintaining a clean dependency hierarchy.

### Complete Example: Creating an Integrated Risk Assessment

Below is a comprehensive example showing how to create a complete integrated risk assessment while maintaining proper dependency structure:

```typescript
import * as RiskIntegration from '../technical-elements/risk-integration';
import { TechnicalElementTypes } from '../technical-elements/technical-element';
import { RiskMetricType, ImportanceLevel } from '../technical-elements/core/shared-patterns';
import { FrequencyUnit } from '../technical-elements/core/events';
import { DistributionType } from '../technical-elements/data-analysis';

// Import proxied types from ESQ and RCA
import {
  EventSequenceReference,
  RiskSignificantEventSequence,
} from '../technical-elements/event-sequence-quantification';

import {
  ReleaseCategoryReference,
  RiskSignificantConsequence,
} from '../technical-elements/radiological-consequence-analysis';

// Create a complete Risk Integration instance
const plantRiskIntegration: RiskIntegration.RiskIntegration = {
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  elementType: TechnicalElementTypes.RISK_INTEGRATION,
  name: 'Plant Risk Integration Analysis',
  version: '1.0',

  // Define risk significance criteria
  riskSignificanceCriteria: [
    {
      uuid: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Core Damage Frequency Significance',
      criteriaType: 'HYBRID',
      metricType: RiskMetricType.CDF,
      absoluteThresholds: {
        eventSequence: 1.0e-7,
        basic: 1.0e-8,
        component: 1.0e-7,
      },
      relativeThresholds: {
        eventSequence: 0.01,
        basic: 0.005,
        component: 0.01,
      },
      justification: 'Based on regulatory guidance and industry practice',
    },
  ],

  // Define event sequence to release category mappings
  eventSequenceToReleaseCategoryMappings: [
    {
      uuid: '123e4567-e89b-12d3-a456-426614174002',
      eventSequenceId: 'ESF-LOCA-001',
      releaseCategoryId: 'RC-SMALL-001',
      mappingBasis: 'Based on thermal-hydraulic analysis of LOCA scenarios',
      frequency: 1.2e-6,
      frequencyUnit: FrequencyUnit.PER_REACTOR_YEAR,
    },
  ],

  // Define integrated risk results
  integratedRiskResults: {
    uuid: '123e4567-e89b-12d3-a456-426614174003',
    name: 'Integrated Plant Risk Results',
    metrics: [
      {
        uuid: '123e4567-e89b-12d3-a456-426614174004',
        name: 'Total Core Damage Frequency',
        metricType: RiskMetricType.CDF,
        value: 2.5e-6,
        units: FrequencyUnit.PER_REACTOR_YEAR,
        uncertainty: {
          distribution: DistributionType.LOGNORMAL,
          parameters: {
            mean: 2.5e-6,
            errorFactor: 3,
          },
        },
      },
    ],
    calculationApproach: {
      meanValueApproach: true,
      frequencyConsequencePlots: true,
      justification: 'Mean values provide best estimate of expected risk',
    },
    hazardGroupContributions: {
      INTERNAL_EVENTS: 1.5e-6,
      SEISMIC: 7.5e-7,
      INTERNAL_FLOOD: 2.5e-7,
    },
  },

  // Define significant contributors
  significantContributors: {
    uuid: '123e4567-e89b-12d3-a456-426614174005',
    metricType: RiskMetricType.CDF,
    significantEventSequences: [
      {
        uuid: '123e4567-e89b-12d3-a456-426614174006',
        name: 'Station Blackout (SBO)',
        contributorType: 'event-sequence',
        sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS,
        sourceId: 'ES-SBO-001',
        importanceMetrics: {
          fussellVesely: 0.15,
          raw: 12.5,
        },
        riskContribution: 3.75e-7,
        importanceLevel: ImportanceLevel.HIGH,
      },
    ],
    insights: ['Station blackout events represent 15% of the total core damage frequency'],
  },

  // Define integration methods
  integrationMethods: [
    {
      uuid: '123e4567-e89b-12d3-a456-426614174007',
      name: 'MinMaxCut Importance Analysis',
      version: '2.3.1',
      description: 'Method for calculating importance measures for minimal cut sets',
      applicability: 'Suitable for Boolean logic models with well-defined minimal cut sets',
      limitations: ['Assumes independence between basic events', 'May not be suitable for highly non-linear models'],
      justification: 'Industry standard approach with well-documented validation history',
    },
  ],

  // Define uncertainty analyses
  uncertaintyAnalyses: [
    {
      uuid: '123e4567-e89b-12d3-a456-426614174008',
      name: 'Complete Plant CDF Uncertainty Analysis',
      description: 'Comprehensive uncertainty analysis for the integrated CDF',
      metric: RiskMetricType.CDF,
      propagationMethod: 'Monte Carlo sampling with 10,000 trials',
      parameterUncertainty: {
        distribution: DistributionType.LOGNORMAL,
        parameters: {
          mean: 2.5e-6,
          '5th_percentile': 8.3e-7,
          '50th_percentile': 2.1e-6,
          '95th_percentile': 7.2e-6,
        },
      },
    },
  ],

  // Define documentation
  documentation: {
    uuid: '123e4567-e89b-12d3-a456-426614174009',
    processDescription:
      'This risk integration process synthesizes results from event sequence quantification and radiological consequence analysis to calculate overall plant risk metrics and identify significant contributors.',
    riskSignificanceCriteriaDescription:
      'Risk significance criteria are based on both absolute threshold values and relative contribution to the total risk.',
    calculationMethodsDescription:
      'Risk metrics are calculated using mean value approaches and complemented with uncertainty analysis via Monte Carlo simulation.',
    uncertaintyAnalysisDescription:
      'Uncertainties from both parameter data and modeling approaches are propagated through the analysis using Monte Carlo simulation.',
    keyAssumptionsDescription:
      'Key assumptions include independence of certain failure modes and conservatism in source term characterization.',
    limitationsDescription:
      'This analysis is limited by the level of detail in external hazards modeling and simplified treatment of recovery actions.',
  },

  // Define primary inputs from Event Sequence Quantification
  eventSequenceQuantificationInputs: {
    analysisReferences: [
      {
        analysisId: 'ESQ-2023-001',
        version: '1.0',
        date: '2023-06-15',
        usageDescription: 'Used for sequence frequencies and importance measures',
      },
    ],
    riskSignificantSequences: [
      // Risk-significant sequences would be listed here
    ],
  },

  // Define primary inputs from Radiological Consequence Analysis
  radiologicalConsequenceInputs: {
    analysisReferences: [
      {
        analysisId: 'RCA-2023-001',
        version: '1.0',
        date: '2023-07-20',
        usageDescription: 'Used for consequence metrics and uncertainty analysis',
      },
    ],
    riskSignificantConsequences: [
      // Risk-significant consequences would be listed here
    ],
  },
};
```

This example illustrates how to create a complete Risk Integration instance with all required fields, while maintaining the proper dependency structure through proxied types. Note how all references to entities from other modules use string-based reference types rather than direct object references.
