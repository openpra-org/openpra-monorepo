# Event Sequence Quantification Schema Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Schema Overview](#schema-overview)
3. [ESQ-F1: Documentation of Event Sequence Quantification Process](#esq-f1-documentation-of-event-sequence-quantification-process)
   - [3.1 Core Process Documentation](#31-core-process-documentation)
   - [3.2 Quantification Method Documentation](#32-quantification-method-documentation)
   - [3.3 Model Integration Documentation](#33-model-integration-documentation)
   - [3.4 Dependency Treatment Documentation](#34-dependency-treatment-documentation)
   - [3.5 Results and Risk Insights Documentation](#35-results-and-risk-insights-documentation)
   - [3.6 Special Topics Documentation](#36-special-topics-documentation)
4. [ESQ-F2: Documentation of Risk-Significant Contributors](#esq-f2-documentation-of-risk-significant-contributors)
5. [ESQ-F3: Documentation of Model Uncertainty and Assumptions](#esq-f3-documentation-of-model-uncertainty-and-assumptions)
6. [ESQ-F4: Documentation of Quantification Limitations](#esq-f4-documentation-of-quantification-limitations)
7. [ESQ-F5: Documentation of Pre-Operational Assumptions](#esq-f5-documentation-of-pre-operational-assumptions)
8. [Summary of ESQ-F Requirements Coverage](#summary-of-esq-f-requirements-coverage)
9. [References](#references)

## Introduction

This document demonstrates how the TypeScript schema for Event Sequence Quantification (ESQ) satisfies the supporting requirements the latest non LWR standards. The schema enables comprehensive documentation of the ESQ process, including inputs, methods, results, uncertainties, and limitations, providing the traceability required by the standard.

The schema has been designed to support sodium-cooled fast reactors similar to EBR-II, with special attention to specific characteristics like metal fuel, sodium coolant, and passive safety systems while maintaining general applicability to a wide range of reactor designs.

## Schema Overview

The TypeScript schema encapsulates the Event Sequence Quantification technical element through a comprehensive set of interfaces that address all aspects of the ESQ process. The main interface, `EventSequenceQuantification`, integrates multiple sub-interfaces to cover documentation requirements:

```typescript
export interface EventSequenceQuantification extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION> {
  // Core metadata
  metadata: { /* ... */ };
  
  // Technical content
  eventSequenceFamilies: Record<string, EventSequenceFamilyQuantification>;
  quantificationResults: Record<string, EventSequenceFrequencyEstimate>;
  quantificationMethods: { /* ... */ };
  modelIntegration: ModelIntegration;
  dependencyTreatment: DependencyRepresentation;
  logicalChallenges: { /* ... */ };
  uncertaintyAnalysis: EventQuantUncertaintyAnalysis;
  importanceAnalysis: Record<string, ImportanceAnalysis>;
  
  // Documentation interfaces that satisfy ESQ-F requirements
  documentation: EventSequenceQuantificationDocumentation;
  uncertaintyDocumentation: EventSequenceQuantificationUncertaintyDocumentation;
  limitationsDocumentation: EventSequenceQuantificationLimitationsDocumentation;
  preOperationalDocumentation?: EventSequenceQuantificationPreOperationalDocumentation;
  peerReviewDocumentation?: EventSequenceQuantificationPeerReviewDocumentation;
}
```

The schema implements all ESQ-F requirements through dedicated documentation interfaces that ensure complete and structured documentation. Let's examine how each requirement is satisfied.

## ESQ-F1: Documentation of Event Sequence Quantification Process

ESQ-F1 requires documenting the process used in the Event Sequence Quantification, specifying inputs, applied methods, and results. The schema implements this through the `EventSequenceQuantificationDocumentation` interface:

```typescript
export interface EventSequenceQuantificationDocumentation extends BaseProcessDocumentation {
  processDescription: string;
  inputs: string[];
  appliedMethods: string[];
  resultsSummary: string;
  // Additional fields for specific documentation requirements
  // ...
}
```

This interface extends `BaseProcessDocumentation` and adds specific fields to address all sub-requirements of ESQ-F1. Let's examine these by category:

### 3.1 Core Process Documentation

| ESQ-F1 Sub-Requirement | Schema Implementation | Example for EBR-II |
|------------------------|----------------------|-------------------|
| (a) records of the process/results when adding nonrecovery terms as part of the final quantification | `nonRecoveryTermsProcess` | "Recovery of passive cooling in EBR-II was modeled using explicit operator actions with timing from thermal-hydraulic simulations" |
| (i) the basis for any parameter estimates not documented elsewhere in the PRA | `parameterEstimatesNotDocumented` | "EBR-II metal fuel failure probabilities were derived from IFR metallic fuel test data, adjusted for burnup" |
| (b) a general description of the quantification process | `processDescription` | "Event trees were quantified using fault tree linking methodology with special consideration for passive safety systems in EBR-II" |

Implementation example:

```typescript
// Example implementation for EBR-II
const documentation: EventSequenceQuantificationDocumentation = {
  processDescription: "Event trees were developed for EBR-II loss of flow scenarios and quantified using fault tree linking methodology with special consideration for passive safety systems",
  inputs: ["EBR-II system reliability data", "Metallic fuel failure modes analysis", "Sodium coolant thermal-hydraulic models"],
  appliedMethods: ["Fault Tree Linking", "Monte Carlo uncertainty propagation"],
  nonRecoveryTermsProcess: "Recovery of passive cooling was modeled using explicit operator actions with timing based on thermal-hydraulic simulations",
  // Other fields...
};
```

### 3.2 Quantification Method Documentation

| ESQ-F1 Sub-Requirement | Schema Implementation | Example for EBR-II |
|------------------------|----------------------|-------------------|
| (d) the process and results for establishing the truncation screening values for final Event Sequence Quantification demonstrating that convergence toward a stable result has been achieved | `truncationProcess` | "Truncation analysis for EBR-II loss of flow sequences was performed at 1E-12, 1E-11, 1E-10, 1E-9, and 1E-8 to demonstrate convergence" |
| (k) the treatment of the uncertainty and sensitivity analysis | `uncertaintyAnalysis` (in parent interface) | "Parameter uncertainties for sodium pump failure rates were propagated using Latin Hypercube sampling with 10,000 samples" |

Implementation example:

```typescript
// Example implementation for EBR-II
const quantificationMethods = {
  approach: QuantificationApproach.FAULT_TREE_LINKING,
  truncation: {
    truncationMethod: TruncationMethod.ABSOLUTE_FREQUENCY,
    finalTruncationValue: 1.0e-10,
    truncationProgression: [1.0e-8, 1.0e-9, 1.0e-10, 1.0e-11, 1.0e-12],
    frequencyAtTruncation: {
      "1.0e-8": 2.3e-6,
      "1.0e-9": 2.5e-6,
      "1.0e-10": 2.51e-6,
      "1.0e-11": 2.511e-6,
      "1.0e-12": 2.511e-6
    },
    percentageChangeAtTruncation: {
      "1.0e-9": 8.7,
      "1.0e-10": 0.4,
      "1.0e-11": 0.04,
      "1.0e-12": 0.0
    },
    basisForSelection: "Final truncation value of 1.0e-10 selected based on <0.5% change in results",
    convergenceDemonstration: "Results converged at 1.0e-10 with <0.5% change in sequence frequencies"
  }
};
```

### 3.3 Model Integration Documentation

| ESQ-F1 Sub-Requirement | Schema Implementation | Example for EBR-II |
|------------------------|----------------------|-------------------|
| (c) details of the cutset review process | `cutsetReviewProcess` | "Cutsets for EBR-II unprotected loss of flow sequences were reviewed to verify correct modeling of passive heat removal" |
| (l) the basis for any equipment or human actions considered in the development of the Event Sequence Quantification to resolve the release category assignment and identification of the radionuclide source term | `radionuclideCategoryAssignment` | "Sodium fire modeling assumptions for containment bypass scenarios were documented to support source term evaluation" |

Implementation example:

```typescript
const modelIntegration: ModelIntegration = {
  integrationMethod: "Linked Event Trees with Fault Trees for EBR-II LOFA scenarios",
  softwareTools: ["SAPHIRE", "MELCOR"],
  integrationSteps: [
    "Link initiating events to event trees",
    "Map sodium pump failure modes to system fault trees",
    "Integrate passive safety responses into event sequences"
  ],
  integrationVerification: "Verified through manual checks of selected sequences with special attention to passive cooling systems"
};

documentation.cutsetReviewProcess = "Cutsets for EBR-II unprotected loss of flow sequences were reviewed to verify correct modeling of passive heat removal systems including natural circulation in primary sodium";
```

### 3.4 Dependency Treatment Documentation

| ESQ-F1 Sub-Requirement | Schema Implementation | Example for EBR-II |
|------------------------|----------------------|-------------------|
| (n) the approach to ensuring that the use of plant damage states or intermediate end states does not prematurely truncate potentially risk-significant event sequence families that represent dependencies | `intermediateStatesApproach` | "Intermediate states for EBR-II were modeled to ensure sodium-water reaction sequences were not prematurely truncated" |
| (h) the approach to the treatment of dependencies across functional, physical, or human actions that are the key factors in causing the events to not be risk-significant | `dependenciesTreatment` | "Dependencies between primary and secondary sodium pump failures were explicitly modeled" |

Implementation example:

```typescript
const dependencyTreatment: DependencyRepresentation = {
  dependenciesByType: {
    "FUNCTIONAL": {
      treatmentDescription: "Explicit modeling of functional dependencies in EBR-II systems",
      modelingMethod: "Shared basic events and explicit logic gates",
      examples: ["Dependency between electrical power and sodium pumps"]
    },
    "PHYSICAL": {
      treatmentDescription: "Physical dependencies modeled through environmental factors",
      modelingMethod: "Conditional probabilities based on room environments",
      examples: ["Sodium fire effects on adjacent equipment"]
    },
    "HUMAN": {
      treatmentDescription: "Operator action dependencies modeled through HRA dependency analysis",
      modelingMethod: "THERP dependency factors",
      examples: ["Dependency between diagnosis of loss of flow and subsequent actions"]
    }
  },
  // Other fields...
};

documentation.dependenciesTreatment = "Dependencies in EBR-II were modeled through explicit functional relationships, environmental factors for physical dependencies, and HRA dependency analysis for operator actions";
```

### 3.5 Results and Risk Insights Documentation

| ESQ-F1 Sub-Requirement | Schema Implementation | Example for EBR-II |
|------------------------|----------------------|-------------------|
| (e) the total of each plant- or design-specific event sequence family frequency and contributions from the different event groups | `familyFrequencies` | "Total ULOF frequency for EBR-II: 2.3E-6/yr, with contributions from electrical system failures (40%), pump failures (35%), and operator errors (25%)" |
| (f) risk insights associated with the aggregation and disaggregation of contributions from different plant operating states, hazard groups, and sources of radioactive material within the scope of the Event Sequence Quantification | `riskInsights` | "Metal fuel damage in EBR-II is dominated by unprotected loss of flow scenarios during full power operation" |

Implementation example:

```typescript
documentation.familyFrequencies = {
  "ULOF": "2.3E-6/yr",
  "ULOHS": "1.5E-6/yr",
  "UTOP": "8.7E-7/yr"
};

documentation.riskInsights = [
  "Metal fuel damage in EBR-II is dominated by unprotected loss of flow scenarios during full power operation",
  "Passive safety features significantly reduce the contribution from protected loss of flow events",
  "Human error contribution is minimal due to extended time available for operator actions"
];
```

### 3.6 Special Topics Documentation

| ESQ-F1 Sub-Requirement | Schema Implementation | Example for EBR-II |
|------------------------|----------------------|-------------------|
| (g) the event sequences and their contributing cutsets | `eventSequencesAndBinning` | "Summary of dominant cutsets for EBR-II unprotected loss of flow sequences, including CCF of primary pumps combined with failure of reactor protection system" |
| (j) the radionuclide transport barrier failure modes and barrier challenges | `radionuclideBarrierTreatment` | "Documentation of metallic fuel cladding failure modes under ULOF conditions, including eutectic formation with cladding" |
| (m) the treatment of mutually exclusive events eliminated from the resulting cutsets and their justification | `mutuallyExclusiveEventsTreatment` | "Mutually exclusive events in EBR-II PRA including concurrent failure modes of active and passive cooling systems" |
| (p) sufficient evidence to show that the method and approach used in the Event Sequence Quantification will yield the correct results | `quantificationVerification` | "Verification of EBR-II sequence frequencies through comparison with IFR safety analysis results" |

Implementation example:

```typescript
documentation.eventSequencesAndBinning = "Summary of dominant cutsets for EBR-II unprotected loss of flow sequences, including CCF of primary pumps combined with failure of reactor protection system";

documentation.radionuclideBarrierTreatment = "Metallic fuel cladding failure modes under ULOF conditions were modeled with specific attention to eutectic formation between fuel and cladding at elevated temperatures";

documentation.mutuallyExclusiveEventsTreatment = "Mutually exclusive events in EBR-II PRA were identified and eliminated, including concurrent active pump failure and natural circulation failure modes";
```

## ESQ-F2: Documentation of Risk-Significant Contributors

ESQ-F2 requires documenting risk-significant contributors to the frequencies of risk-significant event sequence families. The schema implements this through both dedicated fields in `EventSequenceQuantificationDocumentation` and the `ImportanceAnalysis` interface:

```typescript
export interface ImportanceAnalysis {
  analysisType: "FUSSELL_VESELY" | "RISK_REDUCTION_WORTH" | "RISK_ACHIEVEMENT_WORTH" | "BIRNBAUM" | "OTHER";
  scope: "OVERALL" | "PER_SEQUENCE" | "PER_FAMILY";
  // Importance results for different element types
  basicEventImportance?: Record<string, number>;
  initiatingEventImportance?: Record<string, number>;
  humanFailureEventImportance?: Record<string, number>;
  // Risk-significant elements
  significantBasicEvents?: string[];
  significantInitiatingEvents?: string[];
  significantHumanFailureEvents?: string[];
  // Other fields...
}
```

Implementation example for EBR-II:

```typescript
const importanceAnalysisFV: ImportanceAnalysis = {
  analysisType: "FUSSELL_VESELY",
  scope: "OVERALL",
  basicEventImportance: {
    "BE-PRIM-PUMP-CCF": 0.32,
    "BE-RPS-FAILURE": 0.28,
    "BE-DC-POWER-LOSS": 0.15
  },
  initiatingEventImportance: {
    "IE-LOFA": 0.45,
    "IE-LOHS": 0.30,
    "IE-TOP": 0.25
  },
  humanFailureEventImportance: {
    "HFE-RECOVER-POWER": 0.12,
    "HFE-MANUAL-SCRAM": 0.08
  },
  significanceCutoff: 0.05,
  significantBasicEvents: ["BE-PRIM-PUMP-CCF", "BE-RPS-FAILURE", "BE-DC-POWER-LOSS"],
  significantInitiatingEvents: ["IE-LOFA", "IE-LOHS"]
};

// Documentation field for risk-significant contributors
documentation.riskSignificanceDrivers = "EBR-II risk is primarily driven by common cause failure of primary sodium pumps (F-V=0.32) and reactor protection system failures (F-V=0.28) during unprotected loss of flow accidents";
```

## ESQ-F3: Documentation of Model Uncertainty and Assumptions

ESQ-F3 requires documenting sources of model uncertainty, related assumptions, and reasonable alternatives. The schema implements this through the `EventSequenceQuantificationUncertaintyDocumentation` interface:

```typescript
export interface EventSequenceQuantificationUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  modelUncertaintySources: {
    sourceId: string;
    description: string;
    impact: string;
    relatedAssumptions: string[];
    alternativeApproaches: string[];
    treatmentApproach: string;
  }[];
  keyAssumptions: Assumption[];
  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    // Other fields...
  }[];
}
```

Implementation example for EBR-II:

```typescript
const uncertaintyDocumentation: EventSequenceQuantificationUncertaintyDocumentation = {
  modelUncertaintySources: [
    {
      sourceId: "MU-METAL-FUEL",
      description: "Uncertainty in metal fuel failure thresholds during unprotected transients",
      impact: "Significant impact on source term magnitude and timing",
      relatedAssumptions: ["Metal fuel failure occurs at 1000°C based on IFR test data"],
      alternativeApproaches: ["Use of mechanistic fuel behavior models with temperature-dependent failure probabilities"],
      treatmentApproach: "Sensitivity analysis with varying failure thresholds"
    },
    {
      sourceId: "MU-NATURAL-CIRC",
      description: "Uncertainty in natural circulation effectiveness in primary sodium system",
      impact: "Moderate impact on sequence timing and success criteria",
      relatedAssumptions: ["Natural circulation provides sufficient cooling to prevent fuel damage"],
      alternativeApproaches: ["Detailed thermal-hydraulic modeling with uncertainty propagation"],
      treatmentApproach: "Conservative success criteria with sensitivity studies"
    }
  ],
  keyAssumptions: [
    {
      id: "A-001",
      description: "Metal fuel failure occurs at 1000°C based on IFR test data",
      basis: "EBR-II and IFR experimental data",
      impact: "Determines timing and extent of radionuclide release"
    },
    {
      id: "A-002",
      description: "Natural circulation in primary sodium system is sufficient to prevent fuel damage",
      basis: "EBR-II shutdown heat removal tests",
      impact: "Critical for passive safety credit in loss of flow sequences"
    }
  ],
  reasonableAlternatives: [
    {
      alternative: "Use of mechanistic fuel behavior models with temperature-dependent failure probabilities",
      reasonNotSelected: "Insufficient validation data for full mechanistic model implementation",
      applicableElements: ["Fuel Damage Criteria", "Source Term Evaluation"],
      potentialImpact: "Could reduce conservatism in metal fuel damage estimates"
    }
  ]
};
```

## ESQ-F4: Documentation of Quantification Limitations

ESQ-F4 requires documenting limitations in the quantification process that would impact applications. The schema implements this through the `EventSequenceQuantificationLimitationsDocumentation` interface:

```typescript
export interface EventSequenceQuantificationLimitationsDocumentation {
  quantificationLimitations: {
    limitationId: string;
    description: string;
    applicationImpact: string;
    potentialWorkarounds?: string;
  }[];
  validationLimitations?: string[];
  dataLimitations?: string[];
  modelIntegrationLimitations?: string[];
  otherLimitations?: string[];
}
```

Implementation example for EBR-II:

```typescript
const limitationsDocumentation: EventSequenceQuantificationLimitationsDocumentation = {
  quantificationLimitations: [
    {
      limitationId: "LIM-SODIUM-FIRE",
      description: "Limited validation of sodium fire and aerosol models for containment response analysis",
      applicationImpact: "May impact source term estimates for sodium fire scenarios",
      potentialWorkarounds: "Use of conservative bounding approaches for sodium fire consequences"
    },
    {
      limitationId: "LIM-METAL-FUEL-DATA",
      description: "Limited operational experience with metal fuel under severe accident conditions",
      applicationImpact: "Introduces uncertainty in fuel failure thresholds and release fractions",
      potentialWorkarounds: "Reliance on experimental data and conservative treatment of uncertainties"
    }
  ],
  validationLimitations: [
    "Limited operational experience with passive safety features under actual accident conditions",
    "Validation of natural circulation models based primarily on scaled experiments"
  ],
  dataLimitations: [
    "Limited component reliability data specific to sodium systems",
    "Limited data on common cause failures in liquid metal systems"
  ],
  modelIntegrationLimitations: [
    "Simplified treatment of thermal-hydraulic phenomena in probabilistic model",
    "Limited coupling between neutronics and thermal-hydraulics in transient analysis"
  ]
};
```

## ESQ-F5: Documentation of Pre-Operational Assumptions

ESQ-F5 requires documenting assumptions and limitations due to the lack of as-built, as-operated details for PRAs conducted in the pre-operational stage. The schema implements this through the `EventSequenceQuantificationPreOperationalDocumentation` interface:

```typescript
export interface EventSequenceQuantificationPreOperationalDocumentation extends BasePreOperationalAssumptionsDocumentation {
  preOperationalAssumptions: {
    assumptionId: string;
    description: string;
    impact: string;
    validationApproach: string;
    validationTiming: string;
  }[];
  preOperationalLimitations: {
    limitationId: string;
    description: string;
    impact: string;
    resolutionApproach: string;
  }[];
}
```

Implementation example (note: EBR-II is a historical reactor, but we'll use it as if it were in pre-operational stage for this example):

```typescript
const preOperationalDocumentation: EventSequenceQuantificationPreOperationalDocumentation = {
  preOperationalAssumptions: [
    {
      assumptionId: "PRE-OP-001",
      description: "Sodium pump reliability based on design specifications and limited testing",
      impact: "May not reflect actual operational reliability after extended operation",
      validationApproach: "Collect and analyze plant-specific pump failure data during operation",
      validationTiming: "After first two years of operation"
    },
    {
      assumptionId: "PRE-OP-002",
      description: "Operator response times based on simulator exercises and training protocols",
      impact: "May not reflect actual response times during real events",
      validationApproach: "Analyze operator performance during operational transients and drills",
      validationTiming: "Continuous validation during operational phase"
    }
  ],
  preOperationalLimitations: [
    {
      limitationId: "PRE-OP-LIM-001",
      description: "Limited operational experience with metal fuel under varying burnup conditions",
      impact: "Uncertainty in fuel performance parameters across operational cycle",
      resolutionApproach: "Implement fuel monitoring program and update models with operational data"
    },
    {
      limitationId: "PRE-OP-LIM-002",
      description: "Limited validation of natural circulation performance with as-built geometry",
      impact: "Uncertainty in passive cooling capability under accident conditions",
      resolutionApproach: "Perform natural circulation testing during commissioning and startup"
    }
  ]
};
```

## Summary of ESQ-F Requirements Coverage

The following table summarizes how the TypeScript schema satisfies each of the ESQ-F supporting requirements:

| Requirement | Implementation in Schema | Coverage Assessment |
|------------|--------------------------|---------------------|
| **ESQ-F1**: Document the process used in the Event Sequence Quantification | `EventSequenceQuantificationDocumentation` | Complete - All 16 sub-items (a-p) are addressed through specific fields |
| **ESQ-F2**: Document risk-significant contributors | `ImportanceAnalysis` and related fields in `documentation` | Complete - Supports documentation of all contributor types (states, events, failures) |
| **ESQ-F3**: Document sources of model uncertainty, assumptions, and alternatives | `EventSequenceQuantificationUncertaintyDocumentation` | Complete - Structured approach to document sources, impacts, assumptions, and alternatives |
| **ESQ-F4**: Document limitations in the quantification process | `EventSequenceQuantificationLimitationsDocumentation` | Complete - Comprehensive coverage of different limitation types and their impacts |
| **ESQ-F5**: Document pre-operational assumptions and limitations | `EventSequenceQuantificationPreOperationalDocumentation` | Complete - Structured approach for pre-operational assumptions and limitations |

Detailed coverage of ESQ-F1 sub-requirements:

| ESQ-F1 Sub-Requirement Category | Schema Implementation | Coverage |
|--------------------------------|----------------------|----------|
| Core Process Documentation (a, b, i) | `processDescription`, `nonRecoveryTermsProcess`, `parameterEstimatesNotDocumented` | Complete |
| Quantification Method Documentation (d, k) | `truncationProcess`, `uncertaintyAnalysis` | Complete |
| Model Integration Documentation (c, l) | `cutsetReviewProcess`, `radionuclideCategoryAssignment` | Complete |
| Dependency Treatment Documentation (h, n) | `dependenciesTreatment`, `intermediateStatesApproach` | Complete |
| Results and Risk Insights Documentation (e, f) | `familyFrequencies`, `riskInsights` | Complete |
| Special Topics Documentation (g, j, m, o, p) | `eventSequencesAndBinning`, `radionuclideBarrierTreatment`, `mutuallyExclusiveEventsTreatment`, `asymmetriesInModeling`, `quantificationVerification` | Complete |

## References
1. U.S. NRC Regulatory Guide 1.247, "Acceptability of Probabilistic Risk Assessment Results for Non-Light Water Reactor Risk-Informed Activities"
2. ANL/RAS-73-39, "EBR-II System Design Descriptions - Vol. II: Primary System"
3. NUREG/CR-6042, "Perspectives on Reactor Safety"
4. ANL-ART-3, "Experimental Breeder Reactor - II (EBR-II) Level 1 Probabilistic Risk Assessment"