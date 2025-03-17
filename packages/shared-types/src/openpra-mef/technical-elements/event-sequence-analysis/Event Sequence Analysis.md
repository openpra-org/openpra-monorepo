# Event Sequence Analysis Documentation:

## Table of Contents
1. [Introduction](#introduction)
2. [Schema Overview](#schema-overview)
3. [Compliance with Regulatory Requirements](#compliance-with-regulatory-requirements)
   1. [ES-D1: Process Documentation](#es-d1-process-documentation)
   2. [ES-D2: Model Uncertainty Documentation](#es-d2-model-uncertainty-documentation)
   3. [ES-D3: Pre-operational Assumptions Documentation](#es-d3-pre-operational-assumptions-documentation)
4. [Schema Implementation Examples](#schema-implementation-examples)
5. [Traceability Demonstration](#traceability-demonstration)
6. [Summary](#summary)
7. [References](#references)

## Introduction

This document demonstrates that the Event Sequence Analysis schema satisfies the Regulatory Requirements from the Probabilistic Risk Assessment (PRA) standard. The schema provides a comprehensive data model that enables documentation of Event Sequence Analyses with full traceability as required by the standard.

The documentation uses the Experimental Breeder Reactor II (EBR-II) as a reference example where appropriate, but focuses primarily on demonstrating schema compliance rather than a complete reactor model.

## Schema Overview

The Event Sequence Analysis schema defines a structured approach for documenting the analysis of event sequences in nuclear power plants. It captures:

- Event sequences and their progression
- Dependencies between systems and operator actions
- Phenomenological impacts
- Success criteria
- End states and release categories
- Uncertainties and assumptions
- Documentation requirements

The schema is implemented as a TypeScript interface with comprehensive typing to ensure data integrity and validation.

## Compliance with Regulatory Requirements

"The documentation of the Event Sequence Analysis shall provide traceability of the work."

The schema directly supports this requirement through its comprehensive documentation structures. The following sections demonstrate how each supporting requirement (SR) is satisfied.

### ES-D1: Process Documentation

ES-D1 requires documenting the process used in the Event Sequence Analysis, specifying inputs, methods, and results. The table below maps each sub-requirement to specific schema elements:

| ES-D1 Sub-requirement | Schema Element | Implementation Approach |
|---------------------|---------------|------------------------|
| (a) Linkage between plant operating states, initiating events, and event sequences | `ProcessDocumentation.posInitiatorSequenceLinkage` | Explicit mapping structure with IDs and descriptions |
| (b) Success criteria established for each modeled initiating event | `ProcessDocumentation.successCriteriaBases` | Captures criteria, basis, required capacities, and components |
| (c) Deterministic analyses performed | `ProcessDocumentation.deterministicAnalyses` | Documents analyses, purposes, and applications |
| (d) Description of event sequences or groups | `ProcessDocumentation.eventSequenceDescriptions` | Defines timing, procedural guidance, environmental impacts, etc. |
| (e) Technical basis for treatment of radionuclide barriers | `ProcessDocumentation.barrierTreatmentBasis` | Captures credited capabilities and end state assignment basis |
| (f) Evaluation of failure modes and degradation | `ProcessDocumentation.failureModeEvaluation` | Documents modes, mechanisms, loading conditions, and assessments |
| (g) Definition of end states, families, and categories | `ProcessDocumentation.endStateAndFamilyDefinitions` | Provides definitions and categorizations |
| (h) Operator actions in event trees | `ProcessDocumentation.operatorActionsRepresentation` | Links to HRA with timing and dependencies |
| (i) Interface with release categories | `ProcessDocumentation.releaseInterfaceDescription` | Describes mapping and source term assignment |
| (j) Use of single top event fault tree | `ProcessDocumentation.singleTopEventApproach` | Documents satisfaction of requirements |
| (k) Mitigating systems challenged by initiators | `ProcessDocumentation.mitigatingSystemChallenges` | Maps initiating events to system impacts |
| (l) Dependence of mitigating systems | `ProcessDocumentation.mitigatingSystemDependencies` | Captures system and human action dependencies |

#### Code Example: ProcessDocumentation Interface

```typescript
export interface ProcessDocumentation extends BaseProcessDocumentation {
    // (a) Linkage between plant operating states, initiating events, and event sequences
    posInitiatorSequenceLinkage?: {
        plantOperatingStateId: string;
        initiatingEventId: string;
        eventSequenceIds: EventSequenceReference[];
        description?: string;
    }[];
    
    // (b) Success criteria established for each modeled initiating event
    successCriteriaBases?: {
        initiatingEventId: string;
        successCriteriaId: SuccessCriteriaId;
        basis: string;
        systemCapacitiesRequired: string;
        requiredComponents: string;
    }[];
    
    // Additional elements for (c) through (l) are similarly structured
    // ...
}
```

#### Sample Implementation for EBR-II (Partial)

```typescript
const ebrIIProcessDocumentation: ProcessDocumentation = {
    // (a) Linkage example
    posInitiatorSequenceLinkage: [
        {
            plantOperatingStateId: "POS-POWER-100",
            initiatingEventId: "IE-LOHS-01",
            eventSequenceIds: ["ES-001", "ES-002", "ES-003"],
            description: "Loss of heat sink sequences during full power operation"
        }
    ],
    
    // (b) Success criteria example
    successCriteriaBases: [
        {
            initiatingEventId: "IE-LOHS-01",
            successCriteriaId: "SC-SHR-001",
            basis: "Thermal-hydraulic analysis TR-EBR-TH-001",
            systemCapacitiesRequired: "One primary pump operating at 50% capacity",
            requiredComponents: "Pump P-1A or P-1B with associated power supply"
        }
    ],
    
    // Additional implementation examples would follow for each required element
}
```

### ES-D2: Model Uncertainty Documentation

ES-D2 requires documenting sources of model uncertainty, related assumptions, and reasonable alternatives. The schema provides the `ModelUncertaintyDocumentation` interface:

#### Code Example: ModelUncertaintyDocumentation Interface

```typescript
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
    // Event sequence specific uncertainty impacts
    eventSequenceSpecificUncertainties?: {
        eventSequenceId: EventSequenceReference;
        uncertainties: string[];
        sequenceImpact: string;
    }[];
}
```

The `BaseModelUncertaintyDocumentation` class would extend this with general uncertainty documentation requirements. The schema includes cross-references to the underlying requirements (ES-A14, ES-B9, ES-C10) as specified in ES-D2.

#### Sample Implementation for EBR-II (Partial)

```typescript
const ebrIIModelUncertaintyDoc: ModelUncertaintyDocumentation = {
    sources: [
        {
            id: "MU-001", 
            description: "Sodium void reactivity uncertainty",
            impact: "Affects sequence timing and potential for fuel damage"
        }
    ],
    eventSequenceSpecificUncertainties: [
        {
            eventSequenceId: "ES-001",
            uncertainties: ["Sodium boiling onset timing", "Reactivity feedback coefficient uncertainty"],
            sequenceImpact: "May affect timing for operator action window by ±5 minutes"
        }
    ],
    alternatives: [
        {
            uncertaintyId: "MU-001",
            alternativeModels: ["Conservative bounding approach", "Best-estimate with uncertainty analysis"],
            selectedApproach: "Best-estimate with uncertainty analysis",
            justification: "Provides more realistic timing estimates while accounting for uncertainty"
        }
    ]
};
```

### ES-D3: Pre-operational Assumptions Documentation

ES-D3 requires documenting assumptions and limitations due to lack of as-built, as-operated details. The schema provides:

#### Code Example: PreOperationalAssumptionsDocumentation Interface

```typescript
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
    // Event sequence specific assumptions
    eventSequenceSpecificAssumptions?: {
        eventSequenceId: EventSequenceReference;
        assumptions: string[];
        modelingImpact: string;
    }[];
}
```

This interface captures sequence-specific assumptions with references to the underlying requirements (ES-A15, ES-B10, ES-C11) as specified in ES-D3.

#### Sample Implementation for EBR-II (Partial)

```typescript
const ebrIIPreOpAssumptionsDoc: PreOperationalAssumptionsDocumentation = {
    assumptions: [
        {
            id: "PA-001",
            description: "Control procedure response times based on simulator data",
            impact: "May affect timing of operator actions in sequences"
        }
    ],
    eventSequenceSpecificAssumptions: [
        {
            eventSequenceId: "ES-002",
            assumptions: [
                "Assumed valve alignment based on preliminary design",
                "Assumed operator response time based on similar plant experience"
            ],
            modelingImpact: "Conservative estimates used pending final procedure development"
        }
    ],
    addressingPlan: "Assumptions will be validated during procedure validation exercises and updated accordingly"
};
```

## Schema Implementation Examples

This section provides compact implementation examples showing how the schema can be used to document event sequences for the EBR-II reactor.

### Event Sequence Example

```typescript
const lossOfHeatSinkSequence: EventSequence = {
    id: "ES-001",
    name: "Loss of Heat Sink - Natural Circulation Success",
    description: "Loss of heat sink with successful transition to natural circulation cooling",
    initiatingEventId: "IE-LOHS-01",
    plantOperatingStateId: "POS-POWER-100",
    systemResponses: {
        "SYS-SHR": "SUCCESS",
        "SYS-PPS": "SUCCESS",
        "SYS-AUX": "FAILURE"
    },
    operatorActions: ["HRA-001", "HRA-002"],
    timing: [
        {
            id: "TM-001",
            event: "Loss of Primary Pumps",
            timeAfterInitiator: 0,
        },
        {
            id: "TM-002",
            event: "Reactor Trip",
            timeAfterInitiator: 0.05,
            timeWindow: {
                startTime: 0,
                endTime: 0.1,
                description: "Automatic trip via PPS"
            }
        }
    ],
    endState: EndState.SUCCESSFUL_MITIGATION,
    successCriteriaIds: ["SC-SHR-001"]
};
```

### Dependency Example

```typescript
const naturalCircDependency: Dependency = {
    id: "DEP-001",
    dependentElement: "SYS-SHR",
    dependedUponElement: "SYS-PPS",
    dependencyType: DependencyType.FUNCTIONAL,
    description: "Natural circulation cooling depends on successful reactor trip reducing power",
    basis: "Thermal-hydraulic analysis TR-EBR-TH-001"
};
```

### Event Sequence Family Example

```typescript
const lohsFamily: EventSequenceFamily = {
    id: "ESF-001",
    name: "Loss of Heat Sink Sequences",
    description: "All sequences initiated by loss of heat sink events",
    groupingCriteriaId: "GC-001",
    representativeInitiatingEventId: "IE-LOHS-01",
    representativePlantOperatingStateId: "POS-POWER-100",
    representativePlantResponse: "Reactor trip followed by transition to natural circulation cooling",
    memberSequenceIds: ["ES-001", "ES-002", "ES-003"],
    endState: EndState.SUCCESSFUL_MITIGATION
};
```

## Traceability Demonstration

The following diagram illustrates how the schema enables traceability throughout the Event Sequence Analysis process:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Plant Operating│     │   Initiating    │     │Success Criteria │
│     States      │◄────┤     Events      │────►│                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐             │
         └─────────────►│Event Sequences  │◄────────────┘
                        └────────┬────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
         ┌────────▼────────┐         ┌─────────▼─────────┐
         │  Dependencies   │         │Phenomenological    │
         │                 │         │Impacts             │
         └────────┬────────┘         └─────────┬─────────┘
                  │                            │
                  │         ┌──────────────────┘
                  │         │
         ┌────────▼─────────▼──────┐    ┌─────────────────┐
         │ Event Sequence Families │────►Release Categories│
         └───────────┬─────────────┘    └─────────────────┘
                     │
                     ▼
           ┌─────────────────┐
           │  Documentation  │
           └─────────────────┘
```

This traceability is implemented in the schema through explicit ID references between entities, ensuring that all elements can be traced from initiating events through to release categories and documentation.

## Summary

The following table summarizes how the Event Sequence Analysis schema satisfies each of the ES-D supporting requirements:

| Requirement | Description | Schema Coverage | Status |
|-------------|-------------|-----------------|--------|
| ES-D1(a) | Linkage between plant operating states, initiating events, and event sequences | `ProcessDocumentation.posInitiatorSequenceLinkage` | ✓ Compliant |
| ES-D1(b) | Success criteria established for each modeled initiating event | `ProcessDocumentation.successCriteriaBases` | ✓ Compliant |
| ES-D1(c) | Deterministic analyses performed | `ProcessDocumentation.deterministicAnalyses` | ✓ Compliant |
| ES-D1(d) | Description of event sequences or groups | `ProcessDocumentation.eventSequenceDescriptions` | ✓ Compliant |
| ES-D1(e) | Technical basis for treatment of radionuclide barriers | `ProcessDocumentation.barrierTreatmentBasis` | ✓ Compliant |
| ES-D1(f) | Evaluation of failure modes and degradation | `ProcessDocumentation.failureModeEvaluation` | ✓ Compliant |
| ES-D1(g) | Definition of end states, families, and categories | `ProcessDocumentation.endStateAndFamilyDefinitions` | ✓ Compliant |
| ES-D1(h) | Operator actions in event trees | `ProcessDocumentation.operatorActionsRepresentation` | ✓ Compliant |
| ES-D1(i) | Interface with release categories | `ProcessDocumentation.releaseInterfaceDescription` | ✓ Compliant |
| ES-D1(j) | Use of single top event fault tree | `ProcessDocumentation.singleTopEventApproach` | ✓ Compliant |
| ES-D1(k) | Mitigating systems challenged by initiators | `ProcessDocumentation.mitigatingSystemChallenges` | ✓ Compliant |
| ES-D1(l) | Dependence of mitigating systems | `ProcessDocumentation.mitigatingSystemDependencies` | ✓ Compliant |
| ES-D1(m) | Methodology details | `ProcessDocumentation.methodologyDetails` | ✓ Compliant |
| ES-D1(n) | Methodology review | `PeerReviewDocumentation.methodologyReview` | ✓ Compliant |
| ES-D2 | Documentation of model uncertainty | `ModelUncertaintyDocumentation` | ✓ Compliant |
| ES-D3 | Documentation of pre-operational assumptions | `PreOperationalAssumptionsDocumentation` | ✓ Compliant |

## References

1. Regulatory Guide 1.247, "Acceptability of Probabilistic Risk Assessment Results for Advanced Non-Light Water Reactor Risk-Informed Activities"
2. EBR-II Documentation (Argonne National Laboratory)