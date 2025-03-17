# Mechanistic Source Term Analysis Schema Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Coverage of Regulatory Requirements](#coverage-of-regulatory-requirements)
3. [MS-E1: Process Documentation Coverage](#ms-e1-process-documentation-coverage)
   - [E1(a): Radioactive Material Source Characterization](#e1a-radioactive-material-source-characterization)
   - [E1(b): Release Category Definition](#e1b-release-category-definition)
   - [E1(c): Event Sequence Assignment](#e1c-event-sequence-assignment)
   - [E1(d): Radionuclide Transport Phenomena](#e1d-radionuclide-transport-phenomena)
   - [E1(e): Models and Computer Programs](#e1e-models-and-computer-programs)
   - [E1(f): Uncertainty and Sensitivity Analyses](#e1f-uncertainty-and-sensitivity-analyses)
   - [E1(g): Surrogate Risk Metrics](#e1g-surrogate-risk-metrics)
4. [MS-E2: Source Term Definition Parameters](#ms-e2-source-term-definition-parameters)
   - [E2(a): Reactors and Initial Inventories](#e2a-reactors-and-initial-inventories)
   - [E2(b): Radionuclide Release Quantities](#e2b-radionuclide-release-quantities)
   - [E2(c): Physical and Chemical Form](#e2c-physical-and-chemical-form)
   - [E2(d): Release Timing](#e2d-release-timing)
   - [E2(e): Warning Time for Evacuation](#e2e-warning-time-for-evacuation)
   - [E2(f): Energy of Release](#e2f-energy-of-release)
   - [E2(g): Elevation of Release](#e2g-elevation-of-release)
5. [MS-E3: Model and Parameter Uncertainty](#ms-e3-model-and-parameter-uncertainty)
6. [MS-E4: Pre-operational Assumptions](#ms-e4-pre-operational-assumptions)
7. [Implementation Example for EBR-II](#implementation-examples-for-ebr-ii)
8. [Conclusion](#conclusion)

## Introduction

This document demonstrates how the Mechanistic Source Term Analysis TypeScript schema provides comprehensive coverage of the Supporting Requirements for Regulatory Compliance. The schema has been designed to ensure that all documentation requirements for traceability are satisfied through appropriate interfaces, types, and data structures.

## Coverage of HLR-MS-E Requirements

The following table provides a summary of the schema's coverage of Regulatory requirements:

| Requirement | Description | Schema Interface(s) | Coverage |
|-------------|-------------|---------------------|----------|
| MS-E1 | Process documentation | `MechanisticSourceTermProcessDocumentation` | Complete |
| MS-E1(a) | Radioactive material sources | `RadioactiveSource` | Complete |
| MS-E1(b) | Release category definitions | `ReleaseCategoryBasis` | Complete |
| MS-E1(c) | Event sequence assignments | `EventSequenceToReleaseCategoryMapping` | Complete |
| MS-E1(d) | Transport phenomena | `TransportPhenomena` | Complete |
| MS-E1(e) | Models and programs | `SourceTermModel` | Complete |
| MS-E1(f) | Uncertainty and sensitivity | `MechanisticSourceTermSensitivityStudy` | Complete |
| MS-E1(g) | Surrogate risk metrics | Documented in `processDocumentation` | Complete |
| MS-E2 | Source term parameters | `SourceTermDefinition` | Complete |
| MS-E2(a) | Reactors involved | `SourceTermDefinition.involvedReactors` | Complete |
| MS-E2(b) | Radionuclide quantities | `RadionuclideReleaseQuantity` | Complete |
| MS-E2(c) | Physical/chemical form | `ReleaseForm` enum | Complete |
| MS-E2(d) | Release timing | `ReleasePhase` | Complete |
| MS-E2(e) | Warning time | `SourceTermDefinition.warningTimeForEvacuation` | Complete |
| MS-E2(f) | Energy of release | `SourceTermDefinition.releaseEnergy` | Complete |
| MS-E2(g) | Release elevation | `SourceTermDefinition.releaseElevation` | Complete |
| MS-E3 | Model uncertainty | `MechanisticSourceTermModelUncertaintyDocumentation` | Complete |
| MS-E4 | Pre-operational assumptions | `MechanisticSourceTermPreOperationalAssumptionsDocumentation` | Complete |

## MS-E1: Process Documentation Coverage

The schema's main interface for process documentation is `MechanisticSourceTermProcessDocumentation`, which extends `BaseProcessDocumentation`:

```typescript
export interface MechanisticSourceTermProcessDocumentation extends BaseProcessDocumentation {
  /** Documentation of radioactive source characterization */
  radioactiveSourceCharacterizations?: Record<string, {
    source: RadioactiveSource["uuid"];
    description: string;
    inventoryBasis: string;
  }>;
  /** Technical basis for the adequacy of release category definitions */
  releaseCategoryBasis?: Record<ReleaseCategoryReference, string>;
  /** Assignment of event sequences to release categories */
  eventSequenceToReleaseCategoryMapping?: Record<EventSequenceReference, {
    releaseCategoryReference: ReleaseCategoryReference;
    justification: string;
  }>;
  /** Relevant radionuclide transport phenomena for each release category */
  transportPhenomenaDocumentation?: Record<ReleaseCategoryReference, {
    phenomena: string[];
    description: string;
  }>;
  /** Models and computer programs used to develop source terms */
  sourceTermModelsDocumentation?: Record<string, {
    modelName: string;
    purpose: string;
    keyFeatures: string[];
  }>;
  /** Uncertainty and sensitivity analyses for each source term */
  uncertaintyAndSensitivityAnalysesDocumentation?: Record<SourceTermDefinitionReference, {
    analysisDescription: string;
    keyFindings: string[];
  }>;
  /** Surrogate risk metrics associated with intermediate states */
  surrogateRiskMetricsDocumentation?: Record<string, {
    metricDefinition: string;
    relationshipToReleaseCategories: string;
  }>;
  /** Quantitative source term parameter values and uncertainties */
  sourceTermParametersDocumentation?: Record<SourceTermDefinitionReference, {
    parameterValues: string;
    uncertaintyAssessment: string;
  }>;
}
```

This interface provides structured fields for documenting all the elements required by MS-E1. Let's examine each requirement in detail:

### E1(a): Radioactive Material Source Characterization

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

This interface provides comprehensive fields for characterizing radioactive sources and their inventories, satisfying MS-E1(a).

### E1(b): Release Category Definition

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

This interface addresses MS-E1(b) by providing fields for documenting the technical basis and regulatory alignment of release category definitions.

### E1(c): Event Sequence Assignment

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
}
```

This interface satisfies MS-E1(c) by providing fields to document the assignment of event sequences to release categories with appropriate justification.

### E1(d): Radionuclide Transport Phenomena

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
  // Additional fields omitted for brevity
}
```

Additionally, the `transportPhenomenaDocumentation` field in `MechanisticSourceTermProcessDocumentation` provides a clear mapping of transport phenomena to release categories, satisfying MS-E1(d).

### E1(e): Models and Computer Programs

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

This interface, along with the `sourceTermModelsDocumentation` field in `MechanisticSourceTermProcessDocumentation`, satisfies MS-E1(e) by providing comprehensive fields for documenting models and computer programs.

### E1(f): Uncertainty and Sensitivity Analyses

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
  // Additional fields omitted for brevity
}
```

The `uncertaintyAndSensitivityAnalysesDocumentation` field in `MechanisticSourceTermProcessDocumentation` further supports the documentation of these analyses, satisfying MS-E1(f).

### E1(g): Surrogate Risk Metrics

The schema includes a dedicated field in `MechanisticSourceTermProcessDocumentation` for documenting surrogate risk metrics:

```typescript
/** Surrogate risk metrics associated with intermediate states */
surrogateRiskMetricsDocumentation?: Record<string, {
  metricDefinition: string;
  relationshipToReleaseCategories: string;
}>;
```

This field satisfies MS-E1(g) by providing a structure for documenting surrogate risk metrics and their relationship to release categories.

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
  // Additional fields omitted for brevity
}
```

This interface directly addresses MS-E2 by providing fields for all required parameters. Let's examine each in detail:

### E2(a): Reactors and Initial Inventories

The `involvedReactors` field in `SourceTermDefinition` captures the number of reactors involved:

```typescript
/** Number of reactors or sources involved in this release scenario */
involvedReactors?: number;
```

Initial inventories are captured in the `RadioactiveSource` interface through the `totalInventory` field, satisfying MS-E2(a).

### E2(b): Radionuclide Release Quantities

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

### E2(c): Physical and Chemical Form

The schema includes an enum for release forms and a field in `SourceTermDefinition` to capture the form for each radionuclide:

```typescript
export enum ReleaseForm {
  /** Elemental gaseous form */
  ELEMENTAL = "ELEMENTAL",
  /** Aerosol particles suspended in air */
  AEROSOL = "AEROSOL",
  /** Dust particles */
  DUST = "DUST",
  /** Other forms not covered by the standard categories */
  OTHER = "OTHER"
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

### E2(d): Release Timing

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

These structures satisfy MS-E2(d) by providing comprehensive fields for documenting release timing.

### E2(e): Warning Time for Evacuation

The `SourceTermDefinition` interface includes a field for warning time:

```typescript
/** Warning time available for evacuation */
warningTimeForEvacuation?: string;
```

This field satisfies MS-E2(e).

### E2(f): Energy of Release

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

## MS-E3: Model and Parameter Uncertainty

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
  // Additional fields omitted for brevity
}
```

This interface explicitly references the requirements from MS-B6 and MS-C6:

```typescript
/** 
 * Explicit link to Regulatory uncertainty requirements
 */
uncertaintyRequirementsLink?: {
  /** Reference to specific Regulatory requirements addressed */
  hlrMsDRequirements: string[];
  /** Description of how the uncertainty analysis supports these requirements */
  supportDescription: string;
};
```

These structures satisfy MS-E3 by providing comprehensive fields for documenting model and parameter uncertainty, related assumptions, and reasonable alternatives.

## MS-E4: Pre-operational Assumptions

The schema includes a dedicated interface for documenting pre-operational assumptions:

```typescript
export interface MechanisticSourceTermPreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
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

This interface satisfies MS-E4 by providing structured fields for documenting assumptions and limitations due to the lack of as-built, as-operated details, with references to MS-B7 and MS-C7.

## Implementation Example for EBR-II

To demonstrate the application of the schema for a sodium-cooled fast reactor like EBR-II, here is one example:

### Sodium Coolant as a Transport Barrier

```typescript
const sodiumCoolantBarrier: RadionuclideTransportBarrier = {
  uuid: "rtb-002",
  name: "Primary Sodium Coolant",
  description: "Liquid sodium coolant in the primary loop that provides retention of certain radionuclides",
  barrierType: "Chemical",
  effectiveness: "High for cesium and iodine due to chemical retention, moderate for noble gases",
  failureConditions: ["Sodium fire", "Sodium-water reaction"],
  affectedRadionuclides: ["Cs-137", "I-131", "Sr-90"],
  physicalChemicalConditions: {
    temperature: "371-482°C during normal operation",
    pressure: "Near atmospheric in the pool-type design",
    chemicalEnvironment: "Highly reducing environment, low oxygen content (<5 ppm)",
    impactOnTransport: "Chemical affinity for cesium and iodine significantly reduces release fractions"
  },
  transportMechanisms: [
    {
      mechanismType: TransportPhenomenonType.CHEMICAL_INTERACTION,
      description: "Dissolution and chemical bonding of radionuclides in sodium",
      significance: ImportanceLevel.HIGH
    }
  ]
};
```
## Conclusion

The Mechanistic Source Term Analysis TypeScript schema provides comprehensive coverage Supporting Requirements for non LWR reactor standards. The schema includes dedicated interfaces for:

1. Documenting the process used in the Mechanistic Source Term Analysis (MS-E1)
2. Capturing quantitative values and uncertainties for source term parameters (MS-E2)
3. Documenting model and parameter uncertainties (MS-E3)
4. Documenting pre-operational assumptions and limitations (MS-E4)

Each interface includes fields that directly map to the specific sub-requirements, ensuring complete traceability of the work. The examples provided for a sodium-cooled fast reactor like EBR-II demonstrate the schema's applicability to specific reactor types with unique source term characteristics.