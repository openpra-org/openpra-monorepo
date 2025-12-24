# Documentation Demonstrating Regulatory Compliance in the Mechanistic Source Term Analysis Schema

## Table of Contents

1. [Introduction](#introduction)
2. [Coverage of Regulatory Requirements](#coverage-of-regulatory-requirements)
3. [MS-E1](#ms-e1)
   - [E1(a)](#e1a)
   - [E1(b)](#e1b)
   - [E1(c)](#e1c)
   - [E1(d)](#e1d)
   - [E1(e)](#e1e)
   - [E1(f)](#e1f)
   - [E1(g)](#e1g)
4. [MS-E2](#ms-e2)
   - [E2(a)](#e2a)
   - [E2(b)](#e2b)
   - [E2(c)](#e2c)
   - [E2(d)](#e2d)
   - [E2(e)](#e2e)
   - [E2(f)](#e2f)
   - [E2(g)](#e2g)
5. [MS-E3](#ms-e3)
6. [MS-E4](#ms-e4)
7. [Risk Integration](#risk-integration)
8. [Implementation Example for EBR-II](#implementation-examples-for-ebr-ii)
9. [Conclusion](#conclusion)

## Introduction

This document demonstrates how the Mechanistic Source Term Analysis TypeScript schema provides comprehensive coverage of the Supporting Requirements for Regulatory Compliance. The schema has been designed to ensure that all documentation requirements for traceability are satisfied through appropriate interfaces, types, and data structures.

## Coverage of HLR-MS-E Requirements

The following table provides a summary of the schema's coverage of Regulatory requirements:

| Requirement | Schema Interface(s)                                           | Coverage |
| ----------- | ------------------------------------------------------------- | -------- |
| MS-E1       | `MechanisticSourceTermProcessDocumentation`                   | Complete |
| MS-E1(a)    | `RadioactiveSource`                                           | Complete |
| MS-E1(b)    | `ReleaseCategoryBasis`                                        | Complete |
| MS-E1(c)    | `EventSequenceToReleaseCategoryMapping`                       | Complete |
| MS-E1(d)    | `TransportPhenomena`                                          | Complete |
| MS-E1(e)    | `SourceTermModel`                                             | Complete |
| MS-E1(f)    | `MechanisticSourceTermSensitivityStudy`                       | Complete |
| MS-E1(g)    | Documented in `processDocumentation`                          | Complete |
| MS-E2       | `SourceTermDefinition`                                        | Complete |
| MS-E2(a)    | `SourceTermDefinition.involvedReactors`                       | Complete |
| MS-E2(b)    | `RadionuclideReleaseQuantity`                                 | Complete |
| MS-E2(c)    | `ReleaseForm` enum                                            | Complete |
| MS-E2(d)    | `ReleasePhase`                                                | Complete |
| MS-E2(e)    | `SourceTermDefinition.warningTimeForEvacuation`               | Complete |
| MS-E2(f)    | `SourceTermDefinition.releaseEnergy`                          | Complete |
| MS-E2(g)    | `SourceTermDefinition.releaseElevation`                       | Complete |
| MS-E3       | `MechanisticSourceTermModelUncertaintyDocumentation`          | Complete |
| MS-E4       | `MechanisticSourceTermPreOperationalAssumptionsDocumentation` | Complete |

## MS-E1

The schema's main interface for process documentation is `MechanisticSourceTermProcessDocumentation`, which extends `BaseProcessDocumentation`:

```typescript
export interface MechanisticSourceTermProcessDocumentation extends BaseProcessDocumentation {
  /** Documentation of radioactive source characterization */
  radioactiveSourceCharacterizations?: Record<
    string,
    {
      source: RadioactiveSource['uuid'];
      description: string;
      inventoryBasis: string;
    }
  >;
  /** Technical basis for the adequacy of release category definitions */
  releaseCategoryBasis?: Record<ReleaseCategoryReference, string>;
  /** Assignment of event sequences to release categories */
  eventSequenceToReleaseCategoryMapping?: Record<
    EventSequenceReference,
    {
      releaseCategoryReference: ReleaseCategoryReference;
      justification: string;
    }
  >;
  /** Relevant radionuclide transport phenomena for each release category */
  transportPhenomenaDocumentation?: Record<
    ReleaseCategoryReference,
    {
      phenomena: string[];
      description: string;
    }
  >;
  /** Models and computer programs used to develop source terms */
  sourceTermModelsDocumentation?: Record<
    string,
    {
      modelName: string;
      purpose: string;
      keyFeatures: string[];
    }
  >;
  /** Uncertainty and sensitivity analyses for each source term */
  uncertaintyAndSensitivityAnalysesDocumentation?: Record<
    SourceTermDefinitionReference,
    {
      analysisDescription: string;
      keyFindings: string[];
    }
  >;
  /** Surrogate risk metrics associated with intermediate states */
  surrogateRiskMetricsDocumentation?: Record<
    string,
    {
      metricDefinition: string;
      relationshipToReleaseCategories: string;
    }
  >;
  /** Quantitative source term parameter values and uncertainties */
  sourceTermParametersDocumentation?: Record<
    SourceTermDefinitionReference,
    {
      parameterValues: string;
      uncertaintyAssessment: string;
    }
  >;
  /** Documentation of the integration with risk integration */
  riskIntegrationDocumentation?: {
    supportDescription: string;
    releaseCategoryUsage: string;
    sourceTermUsage: string;
    uncertaintyPropagation?: string;
    integrationChallenges?: string[];
    feedbackIncorporation?: string;
    keyInsights?: string[];
  };
}
```

This interface provides structured fields for documenting all the elements required by MS-E1. Let's examine each requirement in detail:

### E1(a)

The schema captures radioactive material source characterization through the `RadioactiveSource` interface:

```typescript
export interface RadioactiveSource extends Unique, Named {
  /** Detailed description of the radioactive material source */
  description: string;
  /** List of significant radionuclides in this source */
  radionuclides: Radionuclide[];
  /** Total inventory of radionuclides in this source */
  totalInventory: Record<Radionuclide, { quantity: number; unit: string }>;
  /** Source of the inventory data */
  inventoryDataSource?: string;
  /** Basis for the selection of included radionuclides */
  radionuclideSelectionBasis?: string;
  /** Uncertainty in the inventory values */
  inventoryUncertainty?: {
    description: string;
    distributionType?: DistributionType;
    parameters?: Record<string, number>;
  };
}
```

### E1(b)

The schema provides the `ReleaseCategoryBasis` interface specifically for documenting the technical basis for release category definitions:

```typescript
export interface ReleaseCategoryBasis extends Unique {
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  /** Technical basis for the definition of the release category */
  technicalBasis: string;
  /** References to supporting analyses or documents */
  supportingReferences?: string[];
  /** Description of how this release category aligns with regulatory expectations */
  regulatoryAlignment?: string;
}
```

### E1(c)

The schema includes the `EventSequenceToReleaseCategoryMapping` interface for documenting the assignment of event sequences to release categories:

```typescript
export interface EventSequenceToReleaseCategoryMapping extends Unique {
  /** Reference to the event sequence */
  eventSequenceReference: EventSequenceReference;
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  /** Justification for assigning this event sequence to this release category */
  assignmentJustification: string;
  /** Technical basis for the assignment */
  technicalBasis?: string;
  /** Frequency information for this mapping */
  frequencyInformation?: {
    mean?: number;
    unit?: string;
    uncertainty?: {
      distributionType?: DistributionType;
      parameters?: Record<string, number>;
    };
  };
  /** Risk integration related fields */
  processedByRiskIntegration?: boolean;
  riskIntegrationMappingId?: string;
  riskSignificance?: ImportanceLevel;
  riskIntegrationInsights?: string[];
}
```

### E1(d)

The `TransportPhenomena` interface documents the relevant radionuclide transport phenomena for each release category:

```typescript
export interface TransportPhenomena extends Unique {
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  /** Description of the relevant transport phenomena */
  phenomena: string[];
  /** Type classification of each phenomenon */
  phenomenaTypes?: TransportPhenomenonType[];
  /** Models and computer programs used to analyze these phenomena */
  modelsUsed: string[];
  /** Barriers that affect these transport phenomena */
  relatedBarriers?: string[];
  /** Transport mechanisms involved in these phenomena */
  relatedMechanisms?: string[];
  /** Assessment of specific MS-B5 phenomena for inclusion */
  msB5Assessment?: {
    assessedPhenomena: {
      phenomenonType: TransportPhenomenonType;
      included: boolean;
      justification?: string;
    }[];
    assessmentJustification?: string;
  };
  /** Justification that the treatment of phenomena is sufficient */
  consequenceQuantificationSupport?: {
    description: string;
    adequacyJustification: string;
  };
}
```

### E1(e)

The schema defines the `SourceTermModel` interface for documenting models and computer programs used in analysis:

```typescript
export interface SourceTermModel extends Unique, Named {
  /** Version of the model or program */
  version: string;
  /** Technical basis and documentation for the model */
  technicalBasis: string;
  /** Status of verification and validation */
  validationStatus: string;
  /** Key assumptions in the model */
  keyAssumptions?: string[];
  /** Known limitations of the model */
  knownLimitations?: string[];
  /** References to documentation or benchmarks */
  references?: string[];
  /** Areas where the model is applicable */
  applicableAreas?: string[];
}
```

### E1(f)

The schema includes interfaces for documenting uncertainty and sensitivity analyses:

```typescript
export interface MechanisticSourceTermSensitivityStudy extends SensitivityStudy {
  /** Reference to the source term or release category being analyzed */
  sourceTermReference?: SourceTermDefinitionReference;
  releaseCategoryReference?: ReleaseCategoryReference;
  /** Parameter changed in the sensitivity study */
  parameterChanged: string;
  /** Impact on the source term */
  impactOnSourceTerm: string;
  /** Whether this parameter is considered a key driver of uncertainty */
  isKeyDriver: boolean;
  /** Recommendations based on the sensitivity study */
  recommendations?: string;
  /** Evaluation of the impact of key sources of uncertainty */
  keyUncertaintyImpactEvaluation?: {
    description: string;
    significance: ImportanceLevel;
  };
  /** Documentation of sensitivity analysis results */
  documentationOfResults?: string;
}
```

### E1(g)

The schema includes a dedicated field in `MechanisticSourceTermProcessDocumentation` for documenting surrogate risk metrics:

```typescript
/** Surrogate risk metrics associated with intermediate states */
surrogateRiskMetricsDocumentation?: Record<string, {
  metricDefinition: string;
  relationshipToReleaseCategories: string;
}>;
```

## MS-E2: Source Term Definition Parameters

The schema's primary interface for documenting source term parameters is `SourceTermDefinition`:

```typescript
export interface SourceTermDefinition extends Unique {
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  /** Number of reactors or sources involved in this release scenario */
  involvedReactors?: number;
  /** Quantity of radionuclides released by species in each time phase */
  radionuclideReleases: {
    phase: ReleasePhase;
    quantities: RadionuclideReleaseQuantity[];
  }[];
  /** Physical and chemical form of the release for each species */
  releaseForm: Record<Radionuclide, ReleaseForm | string>;
  /** Source term release timing including multiphase releases */
  releaseTiming: ReleasePhase[];
  /** Warning time available for evacuation */
  warningTimeForEvacuation?: string;
  /** Energy content of the release */
  releaseEnergy?: { quantity: number; unit: string };
  /** Elevation of the release point */
  releaseElevation?: { quantity: number; unit: string };
  /** Reference to the source term model used for calculation */
  sourceTermModelReference?: string;
  /** Aerosol and particle size distribution, if applicable */
  particleSizeDistribution?: {
    description: string;
    sizeRanges: { min: number; max: number; unit: string; fraction: number }[];
  };
}
```

### E2(a)

The `involvedReactors` field in `SourceTermDefinition` captures the number of reactors involved:

```typescript
/** Number of reactors or sources involved in this release scenario */
involvedReactors?: number;
```

Initial inventories are captured in the `RadioactiveSource` interface through the `totalInventory` field, satisfying MS-E2(a).

### E2(b)

The schema defines detailed structures for capturing radionuclide release quantities:

```typescript
export interface RadionuclideReleaseQuantity {
  /** Radionuclide isotope */
  radionuclide: Radionuclide;
  /** Quantity released (can be a value or a fraction of inventory) */
  quantity: number;
  /** Unit of quantity (e.g., "Bq", "Ci", or "fraction") */
  unit: string;
  /** Uncertainty in the release quantity, if known */
  uncertainty?: RadionuclideReleaseUncertainty;
}
```

The `radionuclideReleases` field in `SourceTermDefinition` uses this interface to capture quantities by phase, satisfying MS-E2(b).

### E2(c)

The schema includes an enum for release forms and a field in `SourceTermDefinition` to capture the form for each radionuclide:

```typescript
export enum ReleaseForm {
  /** Elemental gaseous form */
  ELEMENTAL = 'ELEMENTAL',
  /** Aerosol particles suspended in air */
  AEROSOL = 'AEROSOL',
  /** Dust particles */
  DUST = 'DUST',
  /** Other forms not covered by the standard categories */
  OTHER = 'OTHER',
}

// In SourceTermDefinition:
/** Physical and chemical form of the release for each species */
releaseForm: Record<Radionuclide, ReleaseForm | string>;
```

Additionally, `SourceTermDefinition` includes a field for particle size distribution:

```typescript
/** Aerosol and particle size distribution, if applicable */
particleSizeDistribution?: {
  description: string;
  sizeRanges: { min: number; max: number; unit: string; fraction: number }[];
};
```

These fields together satisfy MS-E2(c).

### E2(d)

The schema defines a `ReleasePhase` interface and includes fields in `SourceTermDefinition` to capture release timing:

```typescript
export interface ReleasePhase extends Unique {
  /** Name of the release phase */
  name: string;
  /** Description of the release phase */
  description?: string;
  /** Start time of the phase (e.g., in seconds after the initiating event) */
  startTime: number;
  /** End time of the phase */
  endTime: number;
  /** Unit of time measurement */
  timeUnit?: string;
}

// In SourceTermDefinition:
/** Source term release timing including multiphase releases */
releaseTiming: ReleasePhase[];
```

### E2(e)

The `SourceTermDefinition` interface includes a field for warning time:

```typescript
/** Warning time available for evacuation */
warningTimeForEvacuation?: string;
```

This field satisfies MS-E2(e).

### E2(f)

The `SourceTermDefinition` interface includes a field for release energy:

```typescript
/** Energy content of the release */
releaseEnergy?: { quantity: number; unit: string };
```

This field satisfies MS-E2(f).

### E2(g): Elevation of Release

The `SourceTermDefinition` interface includes a field for release elevation:

```typescript
/** Elevation of the release point */
releaseElevation?: { quantity: number; unit: string };
```

This field satisfies MS-E2(g).

## MS-E3

The schema includes a comprehensive interface for documenting model and parameter uncertainty:

```typescript
export interface MechanisticSourceTermModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  /** Sources of uncertainty specific to transport phenomena modeling */
  transportPhenomenaUncertainties?: {
    phenomenon: string;
    uncertaintySource: string;
    impact: string;
    treatmentApproach: string;
  }[];
  /** Sources of uncertainty in source term characterization */
  sourceTermCharacterizationUncertainties?: {
    aspect: string;
    uncertaintySource: string;
    impact: string;
    treatmentApproach: string;
  }[];
  /** Reasonable alternatives for transport phenomena modeling */
  transportPhenomenaAlternatives?: {
    phenomenon: string;
    modelingApproach: string;
    alternativeApproach: string;
    reasonNotSelected: string;
  }[];
  /** Reasonable alternatives for source term definition */
  sourceTermDefinitionAlternatives?: {
    aspect: string;
    selectedApproach: string;
    alternativeApproach: string;
    reasonNotSelected: string;
  }[];
  /** Pre-operational assumptions specific to source terms */
  preOperationalAssumptions?: {
    assumption: string;
    relatedArea: string;
    impact: string;
    resolutionApproach: string;
  }[];
  /** Explicit link to HLR-MS-D uncertainty requirements */
  uncertaintyRequirementsLink?: {
    hlrMsDRequirements: string[];
    supportDescription: string;
  };
}
```

## MS-E4

The schema includes a dedicated interface for documenting pre-operational assumptions:

```typescript
export interface MechanisticSourceTermPreOperationalAssumptionsDocumentation
  extends BasePreOperationalAssumptionsDocumentation {
  /** Assumptions specific to radionuclide transport barriers */
  transportBarrierAssumptions?: {
    barrier: string;
    assumption: string;
    impact: string;
    designInformationNeeded: string;
  }[];
  /** Assumptions specific to release timing */
  releaseTimingAssumptions?: {
    releaseCategory: ReleaseCategoryReference;
    assumption: string;
    impact: string;
    operationalInformationNeeded: string;
  }[];
  /** Limitations on transport phenomena modeling */
  transportPhenomenaLimitations?: {
    phenomenon: string;
    limitation: string;
    workaround: string;
    informationNeeded: string;
  }[];
}
```

## Risk Integration

The schema includes comprehensive support for risk integration through several interfaces and fields:

1. In `MechanisticSourceTermAnalysis`:

```typescript
/** Risk integration feedback received for this analysis */
riskIntegrationFeedback?: {
  analysisId: string;
  feedbackDate?: string;
  releaseCategoryFeedback?: Record<ReleaseCategoryReference, {
    riskSignificance?: ImportanceLevel;
    insights?: string[];
    recommendations?: string[];
    status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
  }>;
  sourceTermDefinitionFeedback?: Record<SourceTermDefinitionReference, {
    riskSignificance?: ImportanceLevel;
    insights?: string[];
    recommendations?: string[];
    keyUncertainties?: string[];
    status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
  }>;
  generalFeedback?: string;
  response?: {
    description: string;
    changes?: string[];
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  };
};

/** Documentation of the integration with risk integration */
riskIntegrationDescription?: {
  supportDescription: string;
  releaseCategoryUsage: string;
  sourceTermUsage: string;
  uncertaintyPropagation?: string;
  integrationChallenges?: string[];
  feedbackIncorporation?: string;
};
```

2. In `EventSequenceToReleaseCategoryMapping`:

```typescript
/** Risk integration related fields */
processedByRiskIntegration?: boolean;
riskIntegrationMappingId?: string;
riskSignificance?: ImportanceLevel;
riskIntegrationInsights?: string[];
```

3. In `MechanisticSourceTermProcessDocumentation`:

```typescript
/** Documentation of the integration with risk integration */
riskIntegrationDocumentation?: {
  supportDescription: string;
  releaseCategoryUsage: string;
  sourceTermUsage: string;
  uncertaintyPropagation?: string;
  integrationChallenges?: string[];
  feedbackIncorporation?: string;
  keyInsights?: string[];
};
```

These interfaces provide comprehensive support for:

- Tracking feedback from risk integration
- Documenting how the analysis supports risk integration
- Managing the status of feedback incorporation
- Capturing key insights and recommendations
- Maintaining traceability between technical elements

## Implementation Example for EBR-II

To demonstrate the application of the schema for a sodium-cooled fast reactor like EBR-II, here is one example:

### Sodium Coolant as a Transport Barrier

```typescript
const sodiumCoolantBarrier: RadionuclideTransportBarrier = {
  uuid: 'rtb-002',
  name: 'Primary Sodium Coolant',
  description: 'Liquid sodium coolant in the primary loop that provides retention of certain radionuclides',
  barrierType: 'Chemical',
  effectiveness: 'High for cesium and iodine due to chemical retention, moderate for noble gases',
  failureConditions: ['Sodium fire', 'Sodium-water reaction'],
  affectedRadionuclides: ['Cs-137', 'I-131', 'Sr-90'],
  physicalChemicalConditions: {
    temperature: '371-482°C during normal operation',
    pressure: 'Near atmospheric in the pool-type design',
    chemicalEnvironment: 'Highly reducing environment, low oxygen content (<5 ppm)',
    impactOnTransport: 'Chemical affinity for cesium and iodine significantly reduces release fractions',
  },
  transportMechanisms: [
    {
      mechanismType: TransportPhenomenonType.CHEMICAL_INTERACTION,
      description: 'Dissolution and chemical bonding of radionuclides in sodium',
      significance: ImportanceLevel.HIGH,
    },
  ],
};
```

## Conclusion

The Mechanistic Source Term Analysis TypeScript schema provides comprehensive coverage Supporting Requirements for non LWR reactor standards. The schema includes dedicated interfaces for all requirements MS-E1 to MS-E4 along with supporting risk intregration.

Each interface includes fields that directly map to the specific sub-requirements, ensuring complete traceability of the work. The examples provided for a sodium-cooled fast reactor like EBR-II demonstrate the schema's applicability to specific reactor types with unique source term characteristics.
