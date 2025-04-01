# Documentation of Schema Support for HLR-DA-E Requirements

## Table of Contents
1. [Introduction](#introduction)
2. [Overview of HLR-DA-E Requirements](#overview-of-hlr-da-e-requirements)
3. [Schema Support for DA-E1](#schema-support-for-da-e1)
   - [System and Component Boundaries (DA-E1.a)](#system-and-component-boundaries-da-e1a)
   - [Basic Event Probability Models (DA-E1.b)](#basic-event-probability-models-da-e1b)
   - [Generic Parameter Sources (DA-E1.c)](#generic-parameter-sources-da-e1c)
   - [Plant-Specific Data Sources (DA-E1.d)](#plant-specific-data-sources-da-e1d)
   - [Time Periods for Data Collection (DA-E1.e)](#time-periods-for-data-collection-da-e1e)
   - [Data Exclusion Justification (DA-E1.f)](#data-exclusion-justification-da-e1f)
   - [CCF Probability Basis (DA-E1.g)](#ccf-probability-basis-da-e1g)
   - [Bayesian Prior Rationales (DA-E1.h)](#bayesian-prior-rationales-da-e1h)
   - [Parameter Estimates with Uncertainty (DA-E1.i)](#parameter-estimates-with-uncertainty-da-e1i)
   - [Operating State Data Justification (DA-E1.j)](#operating-state-data-justification-da-e1j)
   - [Generic Parameter Rationales (DA-E1.k)](#generic-parameter-rationales-da-e1k)
4. [Schema Support for DA-E2](#schema-support-for-da-e2)
5. [Schema Support for DA-E3](#schema-support-for-da-e3)
6. [Implementation Examples](#implementation-examples)
7. [Technical Elements Dependencies](#technical-elements-dependencies)
8. [Requirements Coverage Matrix](#requirements-coverage-matrix)
9. [Conclusion](#conclusion)

## Introduction

This document demonstrates how the provided TypeScript schema satisfies the documentation requirements specified in the regulatory guidance. The schema has been designed to ensure complete traceability of the data analysis work, as mandated by the standard. The implementation provides interfaces and data structures that directly map to each requirement in the DA-E category, enabling comprehensive documentation of the data analysis process.

The schema leverages a modular design with base interfaces defined in the core/documentation.ts file. These base interfaces are then extended by technical element-specific interfaces, promoting code reuse and ensuring consistency across different technical elements. This approach aligns with software engineering best practices for maintainability and scalability.

## Overview of Regulatory Requirements

DA-E requires adequate documentation of data analysis processes.

This high-level requirement is supported by three specific requirements from DA-E1 to DA-E3. 

The schema provides dedicated interfaces to satisfy each of these requirements.

## Schema Support for DA-E1

The schema implements DA-E1 primarily through the `DataAnalysisDocumentation` interface, which contains fields that directly map to each sub-requirement of DA-E1.

### System and Component Boundaries (DA-E1.a)

**Implementation**: The schema provides the `systemComponentBoundaries` property in the `DataAnalysisDocumentation` interface:

```typescript
systemComponentBoundaries: {
    /** System ID - references SystemDefinition */
    systemId: string;
    
    /** Component ID - references a component within SystemDefinition.modeledComponentsAndFailures */
    componentId?: string;
    
    /** Boundary description */
    boundaryDescription: string;
    
    /** Boundaries array - directly maps to SystemDefinition.boundaries */
    boundaries: string[];
    
    /** Reference documents */
    references?: string[];
}[];
```

Additionally, the schema provides dedicated interfaces for detailed boundary documentation:

```typescript
export interface ComponentBoundary extends Unique, Named {
    systemId: string;
    componentId?: ComponentReference;
    description: string;
    includedItems: string[];
    excludedItems?: string[];
    boundaryBasis: string;
    referenceDocuments?: string[];
}
```

This implementation ensures proper linkage to the Systems Analysis technical element through references to the `SystemDefinition` and components within it.

### Basic Event Probability Models (DA-E1.b)

**Implementation**: The schema provides the `basicEventProbabilityModels` property:

```typescript
basicEventProbabilityModels: {
    /** Basic event ID */
    basicEventId: string;
    /** Probability model used */
    model: string;
    /** Justification for model selection */
    justification?: string;
}[];
```

This is supported by the `DistributionType` enum and the `probability_model` field in the `DataAnalysisParameter` interface.

```typescript
export enum DistributionType {
    EXPONENTIAL = "exponential",
    BINOMIAL = "binomial",
    NORMAL = "normal",
    LOGNORMAL = "lognormal",
    WEIBULL = "weibull",
    POISSON = "poisson",
    UNIFORM = "uniform",
    BETA = "beta",
    GAMMA = "gamma",
    POINT_ESTIMATE = "point_estimate"
}
```

### Generic Parameter Sources (DA-E1.c)

**Implementation**: The schema provides the `genericParameterSources` property:

```typescript
genericParameterSources: {
    /** Parameter ID */
    parameterId: string;
    /** Data source */
    source: string;
    /** Reference */
    reference?: string;
}[];
```

This is complemented by the `DataSource` interface that provides a comprehensive structure for documenting data sources.

```typescript
export interface DataSource {
    source: string;
    context?: string;
    notes?: string;
    documentationReferences?: string[];
    sourceType?: "GENERIC_INDUSTRY" | "PLANT_SPECIFIC" | "EXPERT_JUDGMENT";
    timePeriod?: {
        startDate: string;
        endDate: string;
    };
    applicabilityAssessment?: string;
}
```

### Plant-Specific Data Sources (DA-E1.d)

**Implementation**: The schema provides the `plantSpecificDataSources` property:

```typescript
plantSpecificDataSources: {
    /** Parameter ID */
    parameterId: string;
    /** Data source */
    source: string;
    /** Operating state(s) */
    operatingState?: string;
    /** Time period */
    timePeriod?: string;
}[];
```

### Time Periods for Data Collection (DA-E1.e)

**Implementation**: The schema provides the `dataCollectionPeriods` property:

```typescript
dataCollectionPeriods: {
    /** Parameter ID */
    parameterId: string;
    /** Start date */
    startDate: string;
    /** End date */
    endDate: string;
    /** Justification for censoring */
    censoringJustification?: string;
}[];
```

### Data Exclusion Justification (DA-E1.f)

**Implementation**: The schema provides the `dataExclusionJustifications` property:

```typescript
dataExclusionJustifications: {
    /** Parameter ID */
    parameterId: string;
    /** Excluded data description */
    excludedData: string;
    /** Justification for exclusion */
    justification: string;
}[];
```

### CCF Probability Basis (DA-E1.g)

**Implementation**: The schema provides the `ccfProbabilityBasis` property:

```typescript
ccfProbabilityBasis: {
    /** CCF parameter ID */
    ccfParameterId: string;
    /** Estimation method */
    estimationMethod: string;
    /** Justification for data mapping */
    mappingJustification?: string;
}[];
```

### Bayesian Prior Rationales (DA-E1.h)

**Implementation**: The schema provides the `bayesianPriorRationales` property:

```typescript
bayesianPriorRationales: {
    /** Parameter ID */
    parameterId: string;
    /** Prior distribution */
    priorDistribution: string;
    /** Rationale */
    rationale: string;
}[];
```

This is supported by the `BayesianUpdate` interface that provides detailed structure for Bayesian update documentation.

```typescript
export interface BayesianUpdate {
    performed: boolean;
    method: string;
    convergence_criteria?: number;
    prior?: {
        distribution: DistributionType;
        parameters: Record<string, number>;
        source?: string;
    };
    posterior?: {
        distribution: DistributionType;
        parameters: Record<string, number>;
    };
    validation?: {
        method: string;
        results: string;
        issues?: string[];
    };
}
```

### Parameter Estimates with Uncertainty (DA-E1.i)

**Implementation**: The schema provides the `parameterEstimates` property:

```typescript
parameterEstimates: {
    /** Parameter ID */
    parameterId: string;
    /** Estimate value */
    estimate: number;
    /** Uncertainty characterization */
    uncertaintyCharacterization: string;
}[];
```

This is supported by the comprehensive `Uncertainty` interface that provides a detailed structure for uncertainty documentation.

```typescript
export interface Uncertainty {
    distribution: DistributionType;
    parameters: Record<string, number>;
    model_uncertainty_sources?: string[];
    riskImplications?: {
        affectedMetrics: string[];
        significanceLevel: "high" | "medium" | "low";
        propagationNotes?: string;
    };
    correlations?: {
        parameterId: string;
        correlationType: "common_cause" | "environmental" | "operational" | "other";
        correlationFactor: number;
        description?: string;
    }[];
    sensitivityStudies?: SensitivityStudy[];
}
```

### Operating State Data Justification (DA-E1.j)

**Implementation**: The schema provides the `operatingStateDataJustifications` property:

```typescript
operatingStateDataJustifications: {
    /** Parameter ID */
    parameterId: string;
    /** Operating state - references a plant operating state using a standardized reference pattern */
    operatingState: PlantOperatingStateReference;
    /** Justification */
    justification: string;
}[];
```

The schema uses a standardized reference pattern for plant operating states through the `PlantOperatingStateReference` type:

```typescript
/**
 * Type representing a reference to a plant operating state
 * @group Core Definition and Enums
 */
export type PlantOperatingStateReference = string & tags.Pattern<"^POS-[A-Z0-9_-]+$">;
```

This reference type ensures consistent identification of plant operating states across the codebase while avoiding direct dependencies on the plant operating states module.

### Generic Parameter Rationales (DA-E1.k)

**Implementation**: The schema provides the `genericParameterRationales` property:

```typescript
genericParameterRationales: {
    /** Parameter ID */
    parameterId: string;
    /** Operating state(s) - references plant operating states using standardized reference pattern */
    operatingStates: PlantOperatingStateReference[];
    /** Rationale */
    rationale: string;
}[];
```

## Schema Support for DA-E2

**Implementation**: The schema provides a dedicated `ModelUncertaintyDocumentation` interface:

```typescript
export interface ModelUncertaintyDocumentation extends Unique, Named {
    /** Sources of model uncertainty */
    uncertaintySources: {
        source: string;
        impact: string;
        applicableParameters?: string[];
    }[];
    
    /** Related assumptions */
    relatedAssumptions: {
        assumption: string;
        basis: string;
        applicableParameters?: string[];
    }[];
    
    /** Reasonable alternatives considered */
    reasonableAlternatives: {
        alternative: string;
        reasonNotSelected: string;
        applicableParameters?: string[];
    }[];
    
    /** Reference to requirement */
    requirementReference: string;
}
```

This interface is included in the `documentation` property of the main `DataAnalysis` interface, ensuring that model uncertainty documentation is an integral part of the overall data analysis documentation.

## Schema Support for DA-E3

**Implementation**: The schema provides a dedicated `PreOperationalAssumptionsDocumentation` interface:

```typescript
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
    /**
     * Reference to DA-A6
     * @implements DA-E3: See DA-A6
     */
    relatedRequirement: string;
    
    /**
     * Reference to DA-N-5 (Note)
     * @implements DA-E3: See Note DA-N-5
     */
    relatedNote: string;
}
```

The `BasePreOperationalAssumptionsDocumentation` interface that it extends contains:

```typescript
export interface BasePreOperationalAssumptionsDocumentation extends Unique, Named {
    /** Assumptions due to lack of as-built, as-operated details */
    assumptions: PreOperationalAssumption[];
    
    /** References to supporting documentation */
    supportingDocumentationReferences?: string[];
    
    /** Plant construction or operational phase when assumption can be validated */
    validationPhase?: string;
}
```

With `PreOperationalAssumption` being defined as:

```typescript
export interface PreOperationalAssumption extends BaseAssumption {
    /** Unique identifier for the assumption within its context */
    assumptionId: string;
    
    /** Design information needed to resolve the assumption */
    requiredDesignInformation?: BaseDesignInformation[];
    
    /** Specific resolution plan for addressing this assumption */
    resolutionPlan?: string;
    
    /** Current status - required for pre-operational assumptions */
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    
    /** Limitations imposed by this assumption - required for pre-operational assumptions */
    limitations: string[];
}
```

This interface is included in the `documentation` property of the main `DataAnalysis` interface, ensuring that pre-operational assumptions documentation is an integral part of the overall data analysis documentation.

## Implementation Examples

This section provides simplified examples of how the schema would be implemented to document data analysis according to the Regulatory requirements.

### Example: Documenting System and Component Boundaries

```typescript
// Example implementation of system component boundaries documentation
const boundaries: DataAnalysisDocumentation['systemComponentBoundaries'] = [
  {
    systemId: "SYS-RCS-001",
    boundaryDescription: "Reactor Coolant System pump boundary includes the pump, motor, seals, and associated control circuitry",
    boundaries: ["Primary coolant loop", "Pump systems", "Seal systems"],
    references: ["Drawing RCS-PID-001", "Design Spec DS-RCS-PUMP-001"]
  },
  {
    systemId: "SYS-EDG-001",
    componentId: "COMP-EDG-001",
    boundaryDescription: "Emergency Diesel Generator includes the engine, generator, starting system, and local control panel",
    boundaries: ["Starting system", "Air intake", "Fuel system", "Control system"],
    references: ["Drawing EDG-PID-001", "Maintenance Procedure MP-EDG-START-001"]
  }
];
```

### Example: Documenting Data Collection Periods

```typescript
// Example implementation of data collection periods documentation
const dataCollectionPeriods: DataAnalysisDocumentation['dataCollectionPeriods'] = [
  {
    parameterId: "PARAM-EDG-FR-001",
    startDate: "2018-01-01",
    endDate: "2023-12-31",
    censoringJustification: "Excluded data prior to 2018 due to major design modification to the starting system"
  },
  {
    parameterId: "PARAM-PUMP-FS-001",
    startDate: "2015-01-01",
    endDate: "2023-12-31",
    censoringJustification: null
  }
];
```

### Example: Documenting Operating State Data Justification

```typescript
// Example implementation of operating state data justification
const operatingStateJustifications: DataAnalysisDocumentation['operatingStateDataJustifications'] = [
  {
    parameterId: "PARAM-EDG-FR-001",
    operatingState: "POS-FULL-POWER-100",
    justification: "Data collected during full power operation provides the most representative conditions for EDG failure rate estimation"
  },
  {
    parameterId: "PARAM-PUMP-FS-001",
    operatingState: "POS-STARTUP-200",
    justification: "Startup conditions are critical for pump failure rate assessment due to thermal stresses"
  }
];
```

### Example: Documenting Generic Parameter Rationales

```typescript
// Example implementation of generic parameter rationales
const genericParameterRationales: DataAnalysisDocumentation['genericParameterRationales'] = [
  {
    parameterId: "PARAM-VALVE-FR-001",
    operatingStates: ["POS-FULL-POWER-100", "POS-PARTIAL-POWER-150"],
    rationale: "Generic industry data is applicable across full and partial power conditions due to similar operating characteristics"
  }
];
```

## Technical Elements Dependencies

The Data Analysis technical element has dependencies with other technical elements in the OpenPRA framework. Below is a diagram illustrating these relationships:

```
┌────────────────────────┐     ┌───────────────────────────┐
│       Core Module      │     │    Systems Analysis       │
│                        │<────┤                           │
│ - Base interfaces      │     │ - System definitions      │
│ - Shared types         │     │ - Component definitions   │
│ - Reference patterns   │     │ - Boundaries              │
└────────────────────────┘     └───────────────────────────┘
          ▲                                 ▲
          │                                 │
          │                  ┌──────────────┘
┌─────────┴────────────┐     │  ┌─────────────────────────┐
│    Data Analysis     │◄────┼──┤  Plant Operating States │
│                      │     │  │                         │
│ - Parameters         │─────┘  │ - Operating state defs  │
│ - Estimation         │◄───────┤ - State transitions     │
│ - Documentation      │        │ - Success criteria      │
└──────────┬───────────┘        └───────────────────────────┘
           │                                ▲
           │                                │
           ▼                                │
┌──────────────────────┐     ┌─────────────┴─────────────┐
│  Event Sequence      │     │  Initiating Event         │
│  Quantification      │◄────┤  Analysis                 │
│                      │     │                           │
│ - Quantification     │     │ - Event definitions       │
│ - Uncertainty        │     │ - Frequencies             │
└──────────────────────┘     └───────────────────────────┘
```

### Key Dependency Relationships:

1. **Core Module**:
   - Provides base interfaces (`Unique`, `Named`, etc.)
   - Defines shared patterns and types used across all technical elements
   - Data Analysis extends base documentation interfaces from core

2. **Systems Analysis**:
   - Provides `SystemDefinition` referenced by Data Analysis parameters
   - Component boundaries and failure modes are referenced
   - Data Analysis parameters are associated with system components
   - **Bidirectional dependency**: Systems Analysis models use parameter estimates from Data Analysis

3. **Plant Operating States**:
   - Operating states referenced through `PlantOperatingStateReference` pattern
   - Data parameters can be specific to particular plant operating states
   - Operating state transitions can be informed by data analysis

4. **Initiating Event Analysis**:
   - Uses data analysis parameters for event frequencies
   - Data analysis provides uncertainty information for events

5. **Event Sequence Quantification**:
   - Uses data analysis parameters for basic event probabilities
   - Incorporates uncertainty from data analysis into sequence quantification

The Data Analysis module is a fundamental technical element that provides critical inputs to many other modules in the PRA framework. It ensures that all parameters used in the model have proper technical justification and documented uncertainty.

## Requirements Coverage Matrix

The following table provides a comprehensive mapping between the DA-E requirements and the schema implementation:

| Requirement | Schema Implementation | Completeness |
|-------------|----------------------|--------------|
| DA-E1 | `DataAnalysisDocumentation` interface | Complete |
| DA-E1.a | `systemComponentBoundaries` property, `ComponentBoundary` interface | Complete |
| DA-E1.b | `basicEventProbabilityModels` property, `DistributionType` enum | Complete |
| DA-E1.c | `genericParameterSources` property, `DataSource` interface | Complete |
| DA-E1.d | `plantSpecificDataSources` property | Complete |
| DA-E1.e | `dataCollectionPeriods` property | Complete |
| DA-E1.f | `dataExclusionJustifications` property | Complete |
| DA-E1.g | `ccfProbabilityBasis` property | Complete |
| DA-E1.h | `bayesianPriorRationales` property, `BayesianUpdate` interface | Complete |
| DA-E1.i | `parameterEstimates` property, `Uncertainty` interface | Complete |
| DA-E1.j | `operatingStateDataJustifications` property | Complete |
| DA-E1.k | `genericParameterRationales` property | Complete |
| DA-E2 | `ModelUncertaintyDocumentation` interface | Complete |
| DA-E3 | `PreOperationalAssumptionsDocumentation` interface, `BasePreOperationalAssumptionsDocumentation` interface, `PreOperationalAssumption` interface | Complete |

## Conclusion

This document has provided a comprehensive overview of the schema support for the HLR-DA-E requirements. The schema implementation provides interfaces and data structures that directly map to each requirement in the DA-E category, enabling comprehensive documentation of the data analysis process. The implementation ensures complete traceability of the data analysis work, as mandated by the standard.

The Data Analysis technical element is a critical component of the overall PRA framework, providing the foundation for parameter estimation, uncertainty quantification, and technical justification of model inputs. Through well-designed interfaces and proper integration with other technical elements, the schema ensures that regulatory requirements are met while promoting maintainable, scalable code.