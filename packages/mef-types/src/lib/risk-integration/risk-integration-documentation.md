# Documentation Demonstrating Regulatory Compliance in the Risk Integration Schema

## Table of Contents

1. [Introduction](#introduction)
2. [Documentation Coverage Analysis](#documentation-coverage-analysis)
3. [HLR-RI-D](#hlr-ri-d)
   - [RI-D1](#ri-d1)
     - [RI-D1.a](#ri-d1a)
     - [RI-D1.b](#ri-d1b)
     - [RI-D1.c](#ri-d1c)
     - [RI-D1.d](#ri-d1d)
     - [RI-D1.e](#ri-d1e)
     - [RI-D1.f](#ri-d1f)
     - [RI-D1.g](#ri-d1g)
     - [RI-D1.h](#ri-d1h)
   - [RI-D2](#ri-d2)
4. [Schema Implementation](#schema-implementation)
   - [Core Definitions](#core-definitions)
   - [Documentation Interfaces](#documentation-interfaces)
   - [Traceability Implementation](#traceability-implementation)
   - [Validation Rules](#validation-rules)
   - [Feedback Mechanisms](#feedback-mechanisms)
   - [Integration Descriptions](#integration-descriptions)
5. [Usage Example: Simplified EBR-II Based Analysis](#usage-example-simplified-ebr-ii-based-analysis)
6. [Conclusion](#conclusion)

## Introduction

This document analyzes how the provided TypeScript schema for Risk Integration satisfies the Supporting Requirements as specified in the regulatory guidance. The schema is designed to support Probabilistic Risk Assessments (PRA) and provides comprehensive structures to ensure that the documentation of Risk Integration provides traceability of the work.

The primary objective is to demonstrate that the schema's design enables the creation of documentation that fully complies with requirements, ensuring that all aspects of risk integration work are traceable, comprehensible, and supportive of regulatory compliance.

## Documentation Coverage Analysis

### Schema Overview

The TypeScript schema includes dedicated interfaces for documenting the Risk Integration process. The primary interfaces that address regulatory requirements are:

- `RiskIntegrationDocumentation`: Encompasses the entire RI-D1 requirement for documenting the Risk Integration process
- `RiskIntegrationAssumption`: Addresses the RI-D2 requirement for documenting sources of model uncertainty and related assumptions
- `ModelUncertaintySource`: Provides detailed structure for documenting uncertainty sources
- `RiskUncertaintyAnalysis`: Supports documentation of uncertainty analyses
- `SignificantRiskContributors`: Enables documentation of risk-significant contributors

## Regulatory Requirements Coverage

### Process Documentation

"DOCUMENT the process used in the Risk Integration, specifying what is used as input, the applied methods, and the results"

The table below maps each sub-requirement of RI-D1 to the corresponding schema elements:

| Requirement | Schema Element                                                                       | Coverage |
| ----------- | ------------------------------------------------------------------------------------ | -------- |
| RI-D1(a)    | `RiskIntegrationDocumentation.processDescription`                                    | Full     |
| RI-D1(b)    | `RiskIntegrationDocumentation.riskSignificanceCriteriaDescription`                   | Full     |
| RI-D1(c)    | `RiskIntegrationDocumentation.calculationMethodsDescription`                         | Full     |
| RI-D1(d)    | `RiskIntegrationDocumentation.uncertaintyAnalysisDescription`                        | Full     |
| RI-D1(e)    | `RiskIntegrationDocumentation.keyAssumptionsDescription`                             | Full     |
| RI-D1(f)    | `RiskIntegrationDocumentation.limitationsDescription`                                | Full     |
| RI-D1(g)    | `RiskIntegrationDocumentation.riskInsights`                                          | Full     |
| RI-D1(h)    | `SignificantRiskContributors` interface and various `significantContributors` fields | Full     |

#### RI-D1(a)

```typescript
/**
 * Description of the process used in the Risk Integration analysis [156, RI-D1(a)].
 * Includes what is used as input, the applied methods, and the results.
 */
processDescription: string;
```

Example implementation:

```typescript
processDescription: 'The risk integration process for this NLWR PRA incorporates event sequence families from Event Sequence Quantification and release categories from Mechanistic Source Term Analysis. A Monte Carlo simulation approach with 10,000 trials was used to propagate uncertainties in both frequency and consequence measures. Results are presented as point estimates, mean values, and complementary cumulative distribution functions (CCDFs).';
```

#### RI-D1(b)

```typescript
/**
 * Description of the risk significance criteria used [156, RI-D1(b)].
 * Includes both absolute and relative criteria.
 */
riskSignificanceCriteriaDescription: string;
```

Additionally, the `RiskSignificanceCriteria` interface provides detailed structure for defining these criteria:

```typescript
export interface RiskSignificanceCriteria extends Unique, Named {
  description?: string;
  criteriaType: RiskSignificanceCriteriaType | string;
  metricType: RiskMetricType | string;
  absoluteThresholds?: {
    /* threshold definitions */
  };
  relativeThresholds?: {
    /* threshold definitions */
  };
  justification: string;
  // Additional fields...
}
```

#### RI-D1(c)

```typescript
/**
 * Description of the methods used to calculate the overall risk [156, RI-D1(c)].
 * Includes approaches for calculating integrated risk metrics.
 */
calculationMethodsDescription: string;
```

The `IntegratedRiskResults` interface further supports this documentation with fields like:

```typescript
calculationApproach: {
    pointEstimateApproach?: boolean;
    meanValueApproach?: boolean;
    frequencyConsequencePlots?: boolean;
    exceedanceFrequencyCurves?: boolean;
    alternativeApproach?: string;
    justification: string;
};
```

#### RI-D1(d)

```typescript
/**
 * Description of the uncertainty analysis performed [156, RI-D1(d)].
 * Includes characterization and quantification of uncertainties.
 */
uncertaintyAnalysisDescription: string;
```

The comprehensive `RiskUncertaintyAnalysis` interface further supports this documentation:

```typescript
export interface RiskUncertaintyAnalysis extends Unique, Named {
  description?: string;
  metric: RiskMetricType | string;
  propagationMethod: string;
  parameterUncertainty?: {
    /* uncertainty details */
  };
  keyUncertaintySources?: ModelUncertaintySource[];
  relatedAssumptions?: Assumption[];
  // Additional fields...
}
```

#### RI-D1(e)

```typescript
/**
 * Description of the key assumptions made in the Risk Integration [156, RI-D1(e)].
 * Includes sources of model uncertainty and related assumptions.
 */
keyAssumptionsDescription: string;
```

The `RiskIntegrationAssumption` interface provides a detailed structure for these assumptions:

```typescript
export interface RiskIntegrationAssumption extends Unique {
  description: string;
  originatingElement: TechnicalElementTypes;
  basis: string;
  impact: string;
  alternatives?: string[];
  // Additional fields...
}
```

#### RI-D1(f)

```typescript
/**
 * Description of the limitations of the Risk Integration analysis [156, RI-D1(f)].
 * Includes limitations due to the lack of as-built, as-operated details.
 */
limitationsDescription: string;
```

Example implementation:

```typescript
limitationsDescription: 'This analysis is limited by the availability of operational data since the facility is not yet built. The PRA relied on design information and engineering judgment to establish failure rates and human error probabilities. These limitations will be addressed during the operational phase through data collection and model updates.';
```

#### RI-D1(g)

```typescript
/**
 * Risk insights derived from the Risk Integration analysis [156, RI-D1(g)].
 * Includes insights about significant contributors to risk.
 */
riskInsights?: string[];
```

Example implementation:

```typescript
riskInsights: [
  'Passive cooling systems demonstrate high reliability but are sensitive to specific common cause failure mechanisms',
  'Loss of heat sink scenarios dominate the risk profile due to the extended mission time requirements',
  'Human errors during maintenance activities represent significant contributors to overall plant risk',
];
```

#### RI-D1(h)

```typescript
export interface SignificantRiskContributors extends Unique {
  metricType: RiskMetricType | string;
  description?: string;
  significantEventSequences?: RiskContributor[];
  significantSystems?: RiskContributor[];
  significantComponents?: RiskContributor[];
  significantBasicEvents?: RiskContributor[];
  // Additional fields...
}
```

The interface supports documentation of various contributor types as required by RI-D1(h).

### RI-D2

```typescript
export interface ModelUncertaintySource extends Unique, Named {
  description: string;
  originatingElement: TechnicalElementTypes;
  impactScope: TechnicalElementTypes[];
  affectedMetrics: (RiskMetricType | string)[];
  impactAssessment: string;
  characterizationMethod?: string;
  alternatives?: {
    description: string;
    potentialImpact: string;
  }[];
  // Additional fields...
}

export interface RiskIntegrationAssumption extends Unique {
  description: string;
  originatingElement: TechnicalElementTypes;
  basis: string;
  impact: string;
  alternatives?: string[];
  // Additional fields...
}
```

## Schema Implementation

### Core Definitions

The schema includes several core definitions that form the foundation of risk integration:

#### Risk Metric Interface

```typescript
export interface RiskMetric extends Unique, Named {
  /** Type of risk metric */
  metricType: RiskMetricType | string;

  /** Description of the risk metric */
  description?: string;

  /** Point estimate value of the risk metric */
  value: number;

  /** Units for the metric (e.g., "per reactor year") */
  units: FrequencyUnit | string;

  /** Uncertainty associated with the risk metric value */
  uncertainty?: Uncertainty;

  /** Applicable acceptance criteria (if any) */
  acceptanceCriteria?: {
    limit: number;
    basis: string;
    complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'INDETERMINATE';
  };
}
```

This interface provides:

- Definition of risk metrics with values and units
- Support for uncertainty characterization
- Compliance tracking against acceptance criteria

#### Risk Contributor Interface

```typescript
export interface RiskContributor extends Unique, Named {
  /** Type of contributor (e.g., "event-sequence", "component") */
  contributorType: string;

  /** Original technical element where this contributor is defined */
  sourceElement: TechnicalElementTypes;

  /** Reference ID to the original entity in its technical element */
  sourceId: string;

  /** Importance metrics for this contributor */
  importanceMetrics?: {
    /** Fussell-Vesely importance measure */
    fussellVesely?: number;

    /** Risk Achievement Worth */
    raw?: number;

    /** Risk Reduction Worth */
    rrw?: number;

    /** Birnbaum importance measure */
    birnbaum?: number;

    /** Other importance measures */
    [key: string]: number | undefined;
  };

  /** Estimated contribution to total risk */
  riskContribution?: number;

  /** Importance level of this contributor */
  importanceLevel?: ImportanceLevel;

  /** Additional contextual information about this contributor */
  context?: string;

  /** Risk insights derived from this contributor */
  insights?: string[];
}
```

This interface enables:

- Identification of risk contributors across technical elements
- Tracking of importance metrics
- Documentation of risk contributions and insights

#### Reference Types

The schema includes several reference types for maintaining traceability:

```typescript
/** Reference to a Risk Significance Criteria */
export type RiskSignificanceCriteriaReference = string & tags.Pattern<'^RSC-[A-Za-z0-9_-]+$'>;

/** Reference to an Integrated Risk Result */
export type IntegratedRiskResultReference = string & tags.Pattern<'^IRR-[A-Za-z0-9_-]+$'>;

/** Reference to a significant risk contributor analysis */
export type SignificantContributorReference = string & tags.Pattern<'^SRC-[A-Za-z0-9_-]+$'>;

/** Reference to a risk integration method */
export type RiskIntegrationMethodReference = string & tags.Pattern<'^RIM-[A-Za-z0-9_-]+$'>;
```

These reference types ensure:

- Unique identification of entities across the PRA
- Consistent reference format
- Traceability between different technical elements

### Documentation Interfaces

The schema implements several key interfaces that support documentation requirements:

| Interface                      | RI-D Requirements Addressed |
| ------------------------------ | --------------------------- |
| `RiskIntegrationDocumentation` | RI-D1(a) through RI-D1(g)   |
| `SignificantRiskContributors`  | RI-D1(h)                    |
| `ModelUncertaintySource`       | RI-D2                       |
| `RiskIntegrationAssumption`    | RI-D2                       |
| `RiskUncertaintyAnalysis`      | RI-D1(d), RI-D2             |

### Traceability Implementation

The schema implements traceability through several mechanisms:

1. **Cross-references**: The schema uses reference types (e.g., `EventSequenceReference`, `ReleaseCategoryReference`) to link between technical elements.

2. **Explicit Traceability Fields**:

   ```typescript
   additionalMetadata?: {
       // ...
       traceability?: string;
       eventSequenceAnalysisReferences?: { /* ... */ }[];
       mechanisticSourceTermReferences?: { /* ... */ }[];
   };
   ```

3. **Feedback Mechanisms**: The schema includes fields for documenting feedback to other technical elements:

   ```typescript
   eventSequenceAnalysisFeedback?: { /* ... */ };
   mechanisticSourceTermFeedback?: { /* ... */ };
   ```

4. **Validation Rules**: The schema includes validation rules to ensure documentation completeness:
   ```typescript
   validationRules?: RiskIntegrationValidationRules;
   ```

## Validation Rules

The schema includes comprehensive validation rules through the `RiskIntegrationValidationRules` interface:

```typescript
export interface RiskIntegrationValidationRules {
  riskSignificanceCriteriaRules: {
    description: string;
    validationMethod: string;
    requiredElements: string[];
  };

  integratedRiskResultsRules: {
    description: string;
    validationMethod: string;
    requiredAnalysisElements: string[];
  };

  uncertaintyAnalysisRules: {
    description: string;
    requiredUncertaintyElements: string[];
    characterizationCriteria: string[];
  };

  significantContributorRules: {
    description: string;
    requiredContributorTypes: string[];
    documentationRequirements: string[];
  };

  documentationRules: {
    description: string;
    documentationCriteria: string[];
    requiredDocumentation: string[];
  };
}
```

This structure enables:

- Validation of risk significance criteria
- Validation of integrated risk results
- Validation of uncertainty analyses
- Validation of significant contributor identification
- Validation of documentation completeness

## Feedback Mechanisms

The schema includes dedicated feedback mechanisms for both event sequence and mechanistic source term analyses:

```typescript
eventSequenceAnalysisFeedback?: {
    analysisId: string;
    releaseCategoryMappingFeedback?: {
        originalMappingId: string;
        updatedFrequency?: number;
        updatedFrequencyUnit?: FrequencyUnit;
        insights?: string[];
        recommendations?: string[];
    }[];
    eventSequenceFamilyFeedback?: {
        familyId: EventSequenceFamilyReference;
        riskSignificance?: ImportanceLevel;
        insights?: string[];
        recommendations?: string[];
    }[];
    generalFeedback?: string;
};

mechanisticSourceTermFeedback?: {
    analysisId: string;
    releaseCategoryFeedback?: {
        releaseCategoryId: ReleaseCategoryReference;
        riskSignificance?: ImportanceLevel;
        insights?: string[];
        recommendations?: string[];
    }[];
    sourceTermDefinitionFeedback?: {
        sourceTermDefinitionId: SourceTermDefinitionReference;
        riskSignificance?: ImportanceLevel;
        insights?: string[];
        recommendations?: string[];
        keyUncertainties?: string[];
    }[];
    mappingFeedback?: {
        originalMappingId: string;
        riskSignificance?: ImportanceLevel;
        insights?: string[];
        recommendations?: string[];
    }[];
    generalFeedback?: string;
};
```

This enables:

- Feedback on release category mappings
- Feedback on event sequence families
- Feedback on release categories
- Feedback on source term definitions
- Feedback on mapping consistency

## Integration Descriptions

The schema includes detailed integration descriptions for both event sequence and mechanistic source term analyses:

```typescript
eventSequenceIntegrationDescription?: {
    integrationProcessDescription: string;
    mappingApproach: string;
    frequencyDerivationApproach: string;
    integrationChallenges?: string[];
    inconsistencyResolution?: string;
    feedbackProvided?: string;
};

mechanisticSourceTermIntegrationDescription?: {
    integrationProcessDescription: string;
    releaseCategoryIntegrationApproach: string;
    sourceTermUtilizationApproach: string;
    uncertaintyPropagationApproach?: string;
    integrationChallenges?: string[];
    inconsistencyResolution?: string;
    feedbackProvided?: string;
    sourceTermInsights?: string[];
};
```

This enables documentation of:

- Integration processes
- Mapping approaches
- Frequency derivation methods
- Uncertainty propagation
- Integration challenges
- Inconsistency resolution
- Feedback mechanisms
- Key insights

## Usage Example: Simplified EBR-II Based Analysis

While not modeling EBR-II specifically, we can reference aspects of its design to illustrate how the schema supports documentation requirements.

Consider a simplified risk integration documentation for a sodium-cooled fast reactor similar to EBR-II:

```typescript
// Example documentation for a sodium-cooled fast reactor
const riskIntegrationDoc: RiskIntegrationDocumentation = {
  uuid: 'ri-doc-1',
  processDescription:
    "This risk integration analysis focuses on the sodium-cooled fast reactor design, incorporating passive safety features similar to those demonstrated in EBR-II's 1986 loss-of-flow tests. The analysis integrates event sequences from internal events, seismic events, and internal flooding with mechanistic source term evaluations.",

  riskSignificanceCriteriaDescription:
    'Risk significance criteria include both absolute thresholds based on regulatory limits and relative thresholds identifying components that contribute more than 5% to overall risk metrics.',

  calculationMethodsDescription:
    'Risk metrics were calculated using both point estimates and mean values from Monte Carlo simulations. Frequency-consequence plots were developed to visualize the risk profile across the spectrum of potential consequences.',

  uncertaintyAnalysisDescription:
    'Uncertainties were characterized through parameter distributions for component failure rates and propagated using 10,000 Monte Carlo trials. Model uncertainties, particularly in sodium fire progression and aerosol behavior, were addressed through sensitivity studies.',

  keyAssumptionsDescription:
    'Key assumptions include passive reactor shutdown capability under loss-of-flow conditions, similar to that demonstrated in EBR-II tests, and assumptions regarding sodium fire progression rates derived from experimental data.',

  limitationsDescription:
    'This analysis is limited by the availability of sodium-cooled reactor operational experience in commercial settings. While EBR-II and other experimental reactors provide valuable insights, scaling effects introduce uncertainties when applied to commercial-scale designs.',

  riskInsights: [
    'Passive safety features provide significant risk reduction for loss-of-flow scenarios',
    'Sodium leaks and fires represent the dominant contributor to offsite release risk',
    'Secondary heat removal system reliability is a key factor in long-term cooling capability',
  ],
};
```

This example demonstrates how the schema supports comprehensive documentation of the risk integration process while referencing relevant aspects of EBR-II's design and operational experience.
