# Event Sequence Analysis Documentation:

## Table of Contents
1. [Introduction](#introduction)
2. [Schema Overview](#schema-overview)
   1. [Event Trees and Event Sequences Relationship](#event-trees-and-event-sequences-relationship)
3. [Compliance with Regulatory Requirements](#compliance-with-regulatory-requirements)
   1. [ES-D1](#es-d1)
   2. [ES-D2](#es-d2)
   3. [ES-D3](#es-d3)
4. [Schema Implementation Examples](#schema-implementation-examples)
   1. [Event Sequence Example](#event-sequence-example)
   2. [Event Tree Example with Connected Event Sequence](#event-tree-example-with-connected-event-sequence)
   3. [Dependency Example](#dependency-example)
   4. [Event Sequence Family Example](#event-sequence-family-example)
5. [Traceability Demonstration](#traceability-demonstration)
6. [Summary](#summary)
7. [References](#references)

## Introduction

This document demonstrates that the Event Sequence Analysis schema satisfies the regulatory requirements applicable to this technical element. The schema provides a comprehensive data model that enables documentation of Event Sequence Analyses with full traceability as required by standards.

The documentation uses the Experimental Breeder Reactor II (EBR-II) as a reference example where appropriate, but focuses primarily on demonstrating schema compliance rather than a complete reactor model.

The schema leverages a modular design with base interfaces defined in the core/documentation.ts file. These base interfaces are extended by technical element-specific interfaces, promoting code reuse and ensuring consistency across different technical elements.

The schema uses `PlantOperatingStateReference` from the initiating event analysis module to reference plant operating states, avoiding circular dependencies while maintaining type safety and validation.

## Schema Overview

The Event Sequence Analysis schema defines a structured approach for documenting the analysis of event sequences in nuclear power plants. It captures:

- Event sequences and their progression
- Dependencies between systems and operator actions
- Phenomenological impacts
- Success criteria
- End states and release categories
- Uncertainties and assumptions
- Documentation requirements
- Event trees and their relationship to event sequences

The schema is implemented as a TypeScript interface with comprehensive typing to ensure data integrity and validation.

### Event Trees and Event Sequences Relationship

The schema includes a robust implementation of event trees that aligns with ANS standards requirements. Event trees are a graphical method to model the chronological progression of events following an initiating event, and they provide the structure to delineate event sequences.

The relationship between event trees and event sequences is bidirectional:

1. **Event Tree Structure**: The `EventTree` interface provides a complete representation of an event tree with functional events (branch points), branches (decision nodes), and sequences (paths). This structure implements several ANS requirements including ES-A6, ES-A7, ES-A8, ES-A10, and ES-A13.

2. **Event Sequence Mapping**: Each `EventSequence` connects to event trees through the `eventTreeId` and `eventTreeSequenceId` properties, establishing traceability between these complementary representations. The `functionalEventStates` property in an event sequence mirrors the states of functional events from the corresponding path in the event tree.

3. **Bidirectional Traceability**: This design ensures that event sequences can be traced to their graphical representation in event trees and vice versa, supporting documentation requirements (HLR-ES-D, ES-D1).

4. **Consistency Validation**: The schema includes validation functions to ensure consistency between event trees and event sequences, checking that they share the same initiating events, end states, and functional event states.

#### Code Example: Event Tree Structure

```typescript
const loopEventTree: EventTree = {
    name: "LOOP-ET",
    label: "Loss of Offsite Power Event Tree",
    initiatingEventId: "IE-LOOP",
    plantOperatingStateId: "POS-POWER-100",
    functionalEvents: {
        "FE-EDG": {
            name: "FE-EDG",
            label: "Emergency Diesel Generators",
            systemReference: "SYS-EDG",
            order: 1
        },
        "FE-HPCI": {
            name: "FE-HPCI",
            label: "High Pressure Cooling Injection",
            systemReference: "SYS-HPCI",
            order: 2
        }
    },
    branches: {
        // Branch definitions...
    },
    sequences: {
        "SEQ-1": {
            name: "SEQ-1",
            endState: "SUCCESSFUL_MITIGATION",
            eventSequenceId: "ES-LOOP-1",
            functionalEventStates: {
                "FE-EDG": "SUCCESS",
                "FE-HPCI": "SUCCESS"
            }
        }
    },
    initialState: {
        branchId: "BR-INIT"
    }
};
```

## Compliance with Regulatory Requirements

The schema directly supports this requirement through its comprehensive documentation structures. The following sections demonstrate how each supporting requirement (SR) is satisfied.

### ES-D1

| Schema Element | Implementation Approach |
|---------------|------------------------|
| (a) `ProcessDocumentation.posInitiatorSequenceLinkage` | Explicit mapping structure with IDs and descriptions |
| (b) `ProcessDocumentation.successCriteriaBases` | Captures criteria, basis, required capacities, and components |
| (c) `ProcessDocumentation.deterministicAnalyses` | Documents analyses, purposes, and applications |
| (d) `ProcessDocumentation.eventSequenceDescriptions` | Defines timing, procedural guidance, environmental impacts, etc. |
| (e) `ProcessDocumentation.barrierTreatmentBasis` | Captures credited capabilities and end state assignment basis |
| (f) `ProcessDocumentation.failureModeEvaluation` | Documents modes, mechanisms, loading conditions, and assessments |
| (g) `ProcessDocumentation.endStateAndFamilyDefinitions` | Provides definitions and categorizations |
| (h) `ProcessDocumentation.operatorActionsRepresentation` | Links to HRA with timing and dependencies |
| (i) `ProcessDocumentation.releaseInterfaceDescription` | Describes mapping and source term assignment |
| (j) `ProcessDocumentation.singleTopEventApproach` | Documents satisfaction of requirements |
| (k) `ProcessDocumentation.mitigatingSystemChallenges` | Maps initiating events to system impacts |
| (l) `ProcessDocumentation.mitigatingSystemDependencies` | Captures system and human action dependencies |
| (m) `ProcessDocumentation.methodologyDetails` | Captures additional details about the process |
| (n) `PeerReviewDocumentation.methodologyReview` | Captures peer review details |

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

### ES-D2

ES-D2 requires recording sources of model uncertainty, related assumptions, and alternatives considered. The schema provides the `ModelUncertaintyDocumentation` interface:

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

### ES-D3

ES-D3 requires recording assumptions made due to incomplete as-built or as-operated details. The schema provides:

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
    eventTreeId: "ET-LOHS-01",             // Reference to the event tree modeling this sequence
    eventTreeSequenceId: "LOHS-SEQ-1",     // Reference to the specific path in the event tree
    functionalEventStates: {               // Mirroring functional event states from the event tree
        "FE-RPS": "SUCCESS",               // Reactor Protection System success
        "FE-NC": "SUCCESS"                 // Natural Circulation success
    },
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

### Event Tree Example with Connected Event Sequence

```typescript
const lossOfHeatSinkEventTree: EventTree = {
    name: "ET-LOHS-01",
    label: "Loss of Heat Sink Event Tree",
    description: "Models possible sequences following a loss of heat sink initiating event",
    initiatingEventId: "IE-LOHS-01",
    plantOperatingStateId: "POS-POWER-100",
    
    // Functional events (branch points in the tree)
    functionalEvents: {
        "FE-RPS": {
            name: "FE-RPS",
            label: "Reactor Protection System",
            description: "Automatic reactor trip",
            systemReference: "SYS-PPS",
            order: 1
        },
        "FE-NC": {
            name: "FE-NC",
            label: "Natural Circulation",
            description: "Transition to natural circulation cooling",
            systemReference: "SYS-SHR",
            order: 2
        }
    },
    
    // Sequences (paths through the tree)
    sequences: {
        "LOHS-SEQ-1": {
            name: "LOHS-SEQ-1",
            label: "Successful Mitigation",
            endState: EndState.SUCCESSFUL_MITIGATION,
            eventSequenceId: "ES-001",  // Reference to the related event sequence
            functionalEventStates: {
                "FE-RPS": "SUCCESS",
                "FE-NC": "SUCCESS"
            }
        },
        "LOHS-SEQ-2": {
            name: "LOHS-SEQ-2",
            label: "Release Sequence",
            endState: EndState.RADIONUCLIDE_RELEASE,
            eventSequenceId: "ES-002",
            functionalEventStates: {
                "FE-RPS": "SUCCESS",
                "FE-NC": "FAILURE"
            }
        }
    },
    
    // Structure of the tree (branches and paths)
    branches: {
        "BR-INIT": {
            name: "BR-INIT",
            label: "Initiating Event",
            functionalEventId: "FE-RPS",
            paths: [
                {
                    state: "SUCCESS",
                    target: "BR-NC",
                    targetType: "BRANCH"
                },
                {
                    state: "FAILURE",
                    target: "LOHS-SEQ-3",
                    targetType: "SEQUENCE"
                }
            ]
        },
        "BR-NC": {
            name: "BR-NC",
            label: "Natural Circulation",
            functionalEventId: "FE-NC",
            paths: [
                {
                    state: "SUCCESS",
                    target: "LOHS-SEQ-1",
                    targetType: "SEQUENCE"
                },
                {
                    state: "FAILURE",
                    target: "LOHS-SEQ-2",
                    targetType: "SEQUENCE"
                }
            ]
        }
    },
    
    // Starting point of the tree
    initialState: {
        branchId: "BR-INIT"
    },
    
    // Mission time for this analysis
    missionTime: 24,
    missionTimeUnits: "hours"
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

Note: Plant Operating States are referenced through Initiating Events using `PlantOperatingStateReference`, avoiding circular dependencies while maintaining traceability.

## Summary

The following table summarizes how the Event Sequence Analysis schema satisfies each of the ES-D supporting requirements:

| Requirement | Schema Coverage | Status |
|-------------|-----------------|--------|
| ES-D1(a) | `ProcessDocumentation.posInitiatorSequenceLinkage` | ✓ Compliant |
| ES-D1(b) | `ProcessDocumentation.successCriteriaBases` | ✓ Compliant |
| ES-D1(c) | `ProcessDocumentation.deterministicAnalyses` | ✓ Compliant |
| ES-D1(d) | `ProcessDocumentation.eventSequenceDescriptions` | ✓ Compliant |
| ES-D1(e) | `ProcessDocumentation.barrierTreatmentBasis` | ✓ Compliant |
| ES-D1(f) | `ProcessDocumentation.failureModeEvaluation` | ✓ Compliant |
| ES-D1(g) | `ProcessDocumentation.endStateAndFamilyDefinitions` | ✓ Compliant |
| ES-D1(h) | `ProcessDocumentation.operatorActionsRepresentation` | ✓ Compliant |
| ES-D1(i) | `ProcessDocumentation.releaseInterfaceDescription` | ✓ Compliant |
| ES-D1(j) | `ProcessDocumentation.singleTopEventApproach` | ✓ Compliant |
| ES-D1(k) | `ProcessDocumentation.mitigatingSystemChallenges` | ✓ Compliant |
| ES-D1(l) | `ProcessDocumentation.mitigatingSystemDependencies` | ✓ Compliant |
| ES-D1(m) | `ProcessDocumentation.methodologyDetails` | ✓ Compliant |
| ES-D1(n) | `PeerReviewDocumentation.methodologyReview` | ✓ Compliant |
| ES-D2 | `ModelUncertaintyDocumentation` | ✓ Compliant |
| ES-D3 | `PreOperationalAssumptionsDocumentation` | ✓ Compliant |

## References

1. Regulatory Guide 1.247
2. EBR-II Documentation (Argonne National Laboratory)