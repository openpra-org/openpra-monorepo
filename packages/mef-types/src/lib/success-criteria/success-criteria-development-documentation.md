# Documentation Documentation Demonstrating Regulatory Compliance in the Success Criteria Development Schema

## Table of Contents

1. [Introduction](#introduction)
2. [Schema Overview](#schema-overview)
3. [HLR-SC-C](#hlr-sc-c)
4. [SC-C1](#sc-c1)
   1. [SC-C1.a](#sc-c1a)
   2. [SC-C1.b](#sc-c1b)
   3. [SC-C1.c](#sc-c1c)
   4. [SC-C1.d](#sc-c1d)
   5. [SC-C1.e](#sc-c1e)
   6. [SC-C1.f](#sc-c1f)
   7. [SC-C1.g](#sc-c1g)
   8. [SC-C1.h](#sc-c1h)
   9. [SC-C1.i](#sc-c1i)
   10. [SC-C1.j](#sc-c1j)
   11. [SC-C1.k](#sc-c1k)
5. [SC-C2](#sc-c2)
6. [SC-C3](#sc-c3)
7. [Cross-Referenced Requirements](#cross-referenced-requirements)
8. [EBR-II Specific Considerations](#ebr-ii-specific-considerations)
9. [Mission Times](#mission-times)
10. [Digital Systems and Passive Safety](#digital-systems-and-passive-safety)
11. [Shared Systems](#shared-systems)
12. [Configuration Control and Traceability](#configuration-control-and-traceability)
13. [Conclusion](#conclusion)

## Introduction

This document demonstrates how the TypeScript schema for Success Criteria Development satisfies the Supporting Regulatory Requirements. The schema provides a comprehensive structure to document the process, model uncertainties, and assumptions related to success criteria development, ensuring traceability of work as required by Regulatory Requirements.

The schema uses `EndState` and `EventSequenceReference` types from the event sequence analysis module to maintain proper type safety and avoid circular dependencies.

## Schema Overview

The Success Criteria Development schema is implemented as a TypeScript interface that extends the `TechnicalElement` type. The schema provides structured documentation capabilities through the following key components:

```typescript
import { EndState, EventSequenceReference } from '../event-sequence-analysis/event-sequence-analysis';

export interface SuccessCriteriaDevelopment
  extends TechnicalElement<TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT> {
  // ... other fields
  documentation?: {
    processDocumentation?: ProcessDocumentation;
    modelUncertaintyDocumentation?: ModelUncertaintyDocumentation;
    preOperationalAssumptionsDocumentation?: PreOperationalAssumptionsDocumentation;
    peerReviewDocumentation?: PeerReviewDocumentation;
    traceabilityDocumentation?: BaseTraceabilityDocumentation;
  };
  // ... more fields
}
```

The documentation structure directly addresses the requirements in Regulatory, providing fields for documenting the process, model uncertainties, and assumptions.

## Regulatory Compliance Map

The following table maps the Regulatory requirements to their corresponding schema elements:

| Requirement | Schema Element                                         |
| ----------- | ------------------------------------------------------ |
| HLR-SC-C    | `documentation.traceabilityDocumentation`              |
| SC-C1       | `documentation.processDocumentation`                   |
| SC-C2       | `documentation.modelUncertaintyDocumentation`          |
| SC-C3       | `documentation.preOperationalAssumptionsDocumentation` |

## SC-C1 Requirements Coverage

The `ProcessDocumentation` interface provides fields for each sub-requirement:

```typescript
export interface ProcessDocumentation extends BaseProcessDocumentation {
  endStateDefinitions?: {
    /* ... */
  }[]; // SC-C1(a)
  calculationsUsed?: {
    /* ... */
  }[]; // SC-C1(b)
  computerCodesUsed?: {
    /* ... */
  }[]; // SC-C1(c)
  calculationLimitations?: {
    /* ... */
  }[]; // SC-C1(d)
  expertJudgmentUse?: {
    /* ... */
  }[]; // SC-C1(e)
  mitigatingSystemsCriteria?: {
    /* ... */
  }[]; // SC-C1(f)
  humanActionTimingBasis?: {
    /* ... */
  }[]; // SC-C1(g)
  groupedEventsCriteria?: {
    /* ... */
  }[]; // SC-C1(h)
  digitalSystemsCriteria?: {
    /* ... */
  }[]; // SC-C1(i)
  passiveSafetyCriteria?: {
    /* ... */
  }[]; // SC-C1(j)
  sharedSystemsCriteria?: {
    /* ... */
  }[]; // SC-C1(k)
}
```

### SC-C1a

```typescript
endStateDefinitions?: {
    endStateId: EndState;
    definition: string;
    eventSequences: EventSequenceReference[];
    parameters: Record<string, string>;
    parameterBasis: string;
}[];
```

This structure allows documenting end states, including plant operating states, event sequences, and parameters such as peak fuel temperature. The `EndState` type ensures consistent end state identification across the analysis.

### SC-C1b

```typescript
calculationsUsed?: {
    calculationId: string;
    description: string;
    calculationType: "GENERIC" | "PLANT_SPECIFIC";
    references: string[];
    establishedCriteria: string[];
}[];
```

This includes both generic and plant-specific calculations, and evaluations of radionuclide transport barrier capability.

### SC-C1c

Computer codes documentation is supported through:

```typescript
computerCodesUsed?: {
    codeId: string;
    nameAndVersion: string;
    description: string;
    validationReferences: string[];
    establishedCriteria: string[];
}[];
```

### SC-C1d

```typescript
calculationLimitations?: {
    limitationId: string;
    description: string;
    affectedItems: string[];
    mitigation?: string;
    impact: string;
}[];
```

### SC-C1e

Expert judgment documentation is supported via:

```typescript
expertJudgmentUse?: {
    judgmentId: string;
    topic: string;
    rationale: string;
    impactedCriteria: string[];
}[];
```

### SC-C1f

```typescript
mitigatingSystemsCriteria?: {
    systemId: string;
    successCriteria: string;
    technicalBasis: string;
    applicableInitiatingEvents: string[];
}[];
```

### SC-C1g

```typescript
humanActionTimingBasis?: {
    actionId: string;
    timeAvailable: string;
    basis: string;
    supportingAnalyses: string[];
}[];
```

### SC-C1h

```typescript
groupedEventsCriteria?: {
    groupId: string;
    groupedEvents: string[];
    process: string;
    groupingBasis: string;
    limitations?: string;
}[];
```

### SC-C1i

Digital I&C systems' success criteria are documented using:

```typescript
digitalSystemsCriteria?: {
    systemId: string;
    criteria: string;
    technicalBasis: string;
    failureModes: string[];
    supportingAnalyses: string[];
}[];
```

### SC-C1j

```typescript
passiveSafetyCriteria?: {
    functionId: string;
    description: string;
    criteria: string;
    technicalBasis: string;
    uncertainties: string;
    uncertaintyTreatment: string;
}[];
```

### SC-C1k

```typescript
sharedSystemsCriteria?: {
    systemId: string;
    sharedByReactors: string[];
    criteria: string;
    commonInitiatingEvents: string[];
    technicalBasis: string;
}[];
```

## SC-C2 Requirements Coverage

```typescript
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  successCriteriaSpecificUncertainties?: {
    successCriteriaId: SuccessCriteriaId;
    uncertainties: string[];
    impact: string;
  }[];

  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableElements?: string[];
  }[];
}
```

This structure satisfies SC-C2, including references to SC-A10 and SC-B9.

## SC-C3 Requirements Coverage

```typescript
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
  successCriteriaSpecificAssumptions?: {
    successCriteriaId: SuccessCriteriaId;
    assumptions: string[];
    impact: string;
    resolutionPlans?: string;
  }[];
}
```

## Cross-Referenced Requirements

The schema also addresses cross-referenced requirements:

- **SC-A10** is addressed via `SuccessCriteriaSensitivityStudy` and `ModelUncertaintyDocumentation.reasonableAlternatives`
- **SC-B9** is addressed via `modelUncertainties` and `ModelUncertaintyDocumentation`
- **SC-A11/SC-B10** is addressed via `preOperationalAssumptions` and `PreOperationalAssumptionsDocumentation`

## EBR-II Specific Considerations

The schema is well-suited for documenting EBR-II specific success criteria:

### Reactor Shutdown System (RSS)

The schema can document RSS success criteria using:

```typescript
// For system-level criteria
systemSuccessCriteria: {
    "RSS-001": {
        systemId: "RSS",
        description: "Reactor Shutdown System success criteria",
        requiredCapacities: [
            {
                parameter: "Scram response time",
                value: "< 0.5 seconds",
                basis: "EBR-II safety analysis"
            }
        ],
        analysisReferences: ["EBR-II-Analysis-001"]
    }
}
```

### Passive Safety Features

EBR-II's passive safety features can be documented using the `passiveSafetyCriteria` structure:

```typescript
// Example entry in processDocumentation.passiveSafetyCriteria
{
    functionId: "NegReactivityFeedback",
    description: "Inherent negative reactivity feedback during transients",
    criteria: "Net negative reactivity coefficient during unprotected LOF events",
    technicalBasis: "EBR-II demonstrated tests showing inherent shutdown capability",
    uncertainties: "Variations in core loading patterns affecting feedback magnitude",
    uncertaintyTreatment: "Conservative bounds established through sensitivity studies"
}
```

### Natural Circulation

Natural circulation criteria can be documented using:

```typescript
// Example entry in processDocumentation.passiveSafetyCriteria
{
    functionId: "NatCirculation",
    description: "Natural circulation for decay heat removal",
    criteria: "Establishment of stable natural circulation within 300 seconds of pump trip",
    technicalBasis: "EBR-II whole plant tests showing natural circulation capability",
    uncertainties: "Initial power level effects on natural circulation establishment",
    uncertaintyTreatment: "Analysis covering range of initial conditions"
}
```

## Mission Times

The schema includes mission time definitions for both event sequences and components:

```typescript
export interface MissionTimeDefinition extends Unique {
  eventSequenceReference: EventSequenceReference;
  missionTimeHours: number & tags.Minimum<0>;
  basis: string;
  analysisReferences: string[];
  isRiskSignificant?: boolean;
}

export interface ComponentMissionTimeDefinition extends Unique {
  componentId: ComponentReference;
  missionTimeHours: number & tags.Minimum<0>;
  eventSequenceReference: EventSequenceReference;
  shorterMissionTimeJustification?: string;
  analysisReferences: string[];
}
```

These interfaces ensure proper traceability between components, event sequences, and their respective mission times.

## Digital Systems and Passive Safety

The schema includes dedicated support for digital systems and passive safety through enhanced interfaces:

1. Enhanced `ProcessDocumentation` with digital systems criteria:

```typescript
export interface ProcessDocumentation extends BaseProcessDocumentation {
  // ... existing fields ...

  /**
   * Documentation of success criteria for digital systems
   * @implements SC-C1(i)
   */
  digitalSystemsCriteria?: {
    /** Digital system identifier */
    systemId: string;

    /** Success criteria */
    criteria: string;

    /** Technical basis */
    technicalBasis: string;

    /** Failure modes considered */
    failureModes: string[];

    /** References to supporting analyses */
    supportingAnalyses: string[];
  }[];

  /**
   * Documentation of passive safety function criteria
   * @implements SC-C1(j)
   */
  passiveSafetyCriteria?: {
    /** Passive safety function identifier */
    functionId: string;

    /** Description of the function */
    description: string;

    /** Success criteria */
    criteria: string;

    /** Technical basis */
    technicalBasis: string;

    /** Uncertainties in these criteria */
    uncertainties: string;

    /** How uncertainties were addressed */
    uncertaintyTreatment: string;
  }[];
}
```

## Shared Systems

The schema includes comprehensive support for shared systems through several interfaces:

1. Enhanced `ProcessDocumentation` with shared systems criteria:

```typescript
export interface ProcessDocumentation extends BaseProcessDocumentation {
  // ... existing fields ...

  /**
   * Documentation of shared systems criteria
   * @implements SC-C1(k)
   */
  sharedSystemsCriteria?: {
    /** Shared system identifier */
    systemId: string;

    /** Reactors sharing this system */
    sharedByReactors: string[];

    /** Success criteria */
    criteria: string;

    /** Common initiating events considered */
    commonInitiatingEvents: string[];

    /** Technical basis */
    technicalBasis: string;
  }[];
}
```

2. `SharedResourceDefinition` interface:

```typescript
export interface SharedResourceDefinition extends Unique, Named {
  /** Description of the shared resource */
  description: string;

  /** Systems that share this resource */
  sharedBySystems: string[];

  /** Reactors or units that share this resource */
  sharedByReactors: string[];

  /** Resource capacity allocation strategy */
  allocationStrategy: string;

  /** Impact on success criteria */
  successCriteriaImpact: string;

  /** References to supporting analyses */
  analysisReferences: string[];
}
```

3. Enhanced `SuccessCriteriaDevelopment` with shared resources:

```typescript
export interface SuccessCriteriaDevelopment
  extends TechnicalElement<TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT> {
  // ... existing fields ...

  /**
   * Shared resource definitions between reactors
   * @implements SC-A7
   */
  sharedResources?: Record<string, SharedResourceDefinition>;

  /**
   * Consistency verifications
   * @implements SC-A7
   * @implements SC-A9
   */
  consistencyVerifications?: Record<string, ConsistencyVerification>;
}
```

These enhancements provide comprehensive support for:

- Mission time definitions for event sequences and components
- Digital systems success criteria and failure modes
- Passive safety function criteria and uncertainty treatment
- Shared systems criteria and resource allocation
- Consistency verification across different aspects of the analysis

## Configuration Control and Traceability

The schema includes dedicated structures for configuration control and traceability:

```typescript
export interface BaseTraceabilityDocumentation extends Unique {
  // ... existing fields ...

  /**
   * Configuration control records
   * @implements SC-A12
   */
  configurationControlRecords?: Record<string, ConfigurationControlRecord>;
}
```

This structure enables documenting configuration control records as required by SC-A12.

## Conclusion

The Success Criteria Development TypeScript schema fully satisfies the Supporting Requirements for Regulatory Compliance. The schema provides structured elements for documenting SC-C1 to SC-C3.

Each sub-requirement of SC-C1 has corresponding dedicated schema structures, ensuring comprehensive documentation. The schema is also well-suited for documenting EBR-II specific success criteria, including its unique features like the Reactor Shutdown System, passive safety features, and natural circulation capabilities.

The schema uses standardized patterns for cross-referencing other technical elements:

```typescript
// Standardized reference patterns
type SuccessCriteriaId = string & tags.Pattern<typeof IdPatterns.SUCCESS_CRITERIA_ID>; // Imported from shared-patterns
type PlantOperatingStateId = string & tags.Pattern<typeof IdPatterns.STATE>;
type SystemId = string & tags.Pattern<typeof IdPatterns.SYSTEM_ID>;
```
