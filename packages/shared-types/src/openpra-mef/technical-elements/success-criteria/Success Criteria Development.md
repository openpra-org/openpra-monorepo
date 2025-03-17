# Success Criteria Development Schema Compliance Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Schema Overview](#schema-overview)
3. [HLR-SC-C Compliance Map](#hlr-sc-c-compliance-map)
4. [SC-C1 Requirements Coverage](#sc-c1-requirements-coverage)
   - [End State Definitions (SC-C1a)](#end-state-definitions-sc-c1a)
   - [Calculations (SC-C1b)](#calculations-sc-c1b)
   - [Computer Codes (SC-C1c)](#computer-codes-sc-c1c)
   - [Calculation Limitations (SC-C1d)](#calculation-limitations-sc-c1d)
   - [Expert Judgment (SC-C1e)](#expert-judgment-sc-c1e)
   - [Mitigating Systems Criteria (SC-C1f)](#mitigating-systems-criteria-sc-c1f)
   - [Human Action Timing (SC-C1g)](#human-action-timing-sc-c1g)
   - [Grouped Events Criteria (SC-C1h)](#grouped-events-criteria-sc-c1h)
   - [Digital Systems Criteria (SC-C1i)](#digital-systems-criteria-sc-c1i)
   - [Passive Safety Criteria (SC-C1j)](#passive-safety-criteria-sc-c1j)
   - [Shared Systems Criteria (SC-C1k)](#shared-systems-criteria-sc-c1k)
5. [SC-C2 Requirements Coverage](#sc-c2-requirements-coverage)
6. [SC-C3 Requirements Coverage](#sc-c3-requirements-coverage)
7. [Cross-Referenced Requirements](#cross-referenced-requirements)
8. [EBR-II Specific Considerations](#ebr-ii-specific-considerations)
9. [Conclusion](#conclusion)

## Introduction

This document demonstrates how the TypeScript schema for Success Criteria Development satisfies the Supporting Regulatory Requirements. The schema provides a comprehensive structure to document the process, model uncertainties, and assumptions related to success criteria development, ensuring traceability of work as required by Regulatory Requirements.

## Schema Overview

The Success Criteria Development schema is implemented as a TypeScript interface that extends the `TechnicalElement` type. The schema provides structured documentation capabilities through the following key components:

```typescript
export interface SuccessCriteriaDevelopment extends TechnicalElement<TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT> {
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

| Requirement | Description | Schema Element |
|-------------|-------------|----------------|
| HLR-SC-C | The documentation of the Success Criteria Development shall provide traceability of the work. | `documentation.traceabilityDocumentation` |
| SC-C1 | DOCUMENT the process used in the Success Criteria Development | `documentation.processDocumentation` |
| SC-C2 | DOCUMENT the sources of model uncertainty | `documentation.modelUncertaintyDocumentation` |
| SC-C3 | DOCUMENT assumptions and limitations due to lack of as-built, as-operated details | `documentation.preOperationalAssumptionsDocumentation` |

## SC-C1 Requirements Coverage

SC-C1 requires documenting the process used in the Success Criteria Development, specifying inputs, methods, and results. The `ProcessDocumentation` interface provides fields for each sub-requirement:

```typescript
export interface ProcessDocumentation extends BaseProcessDocumentation {
    endStateDefinitions?: { /* ... */ }[]; // SC-C1(a)
    calculationsUsed?: { /* ... */ }[];    // SC-C1(b)
    computerCodesUsed?: { /* ... */ }[];   // SC-C1(c)
    calculationLimitations?: { /* ... */ }[]; // SC-C1(d)
    expertJudgmentUse?: { /* ... */ }[];   // SC-C1(e)
    mitigatingSystemsCriteria?: { /* ... */ }[]; // SC-C1(f)
    humanActionTimingBasis?: { /* ... */ }[]; // SC-C1(g)
    groupedEventsCriteria?: { /* ... */ }[]; // SC-C1(h)
    digitalSystemsCriteria?: { /* ... */ }[]; // SC-C1(i)
    passiveSafetyCriteria?: { /* ... */ }[]; // SC-C1(j)
    sharedSystemsCriteria?: { /* ... */ }[]; // SC-C1(k)
}
```

### End State Definitions (SC-C1a)

The schema includes structure for documenting end states:

```typescript
endStateDefinitions?: {
    endStateId: string;
    definition: string;
    eventSequences: string[];
    parameters: Record<string, string>;
    parameterBasis: string;
}[];
```

This structure allows documenting end states, including plant operating states, event sequences, and parameters such as peak fuel temperature.

### Calculations (SC-C1b)

The schema provides for documenting calculations used to establish success criteria:

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

### Computer Codes (SC-C1c)

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

This allows documentation of codes used for establishing plant-specific success criteria.

### Calculation Limitations (SC-C1d)

Limitations of calculations and codes are documented using:

```typescript
calculationLimitations?: {
    limitationId: string;
    description: string;
    affectedItems: string[];
    mitigation?: string;
    impact: string;
}[];
```

This includes potential conservatisms or limitations that could challenge the applicability of computer models.

### Expert Judgment (SC-C1e)

Expert judgment documentation is supported via:

```typescript
expertJudgmentUse?: {
    judgmentId: string;
    topic: string;
    rationale: string;
    impactedCriteria: string[];
}[];
```

This captures the uses of expert judgment within the PRA and rationale for such uses.

### Mitigating Systems Criteria (SC-C1f)

Success criteria for mitigating systems are documented with:

```typescript
mitigatingSystemsCriteria?: {
    systemId: string;
    successCriteria: string;
    technicalBasis: string;
    applicableInitiatingEvents: string[];
}[];
```

This allows documenting technical bases for mitigating systems for each initiating event group.

### Human Action Timing (SC-C1g)

The basis for human action timing is documented through:

```typescript
humanActionTimingBasis?: {
    actionId: string;
    timeAvailable: string;
    basis: string;
    supportingAnalyses: string[];
}[];
```

This captures the basis for establishing time available for human actions.

### Grouped Events Criteria (SC-C1h)

Processes for grouped events are documented via:

```typescript
groupedEventsCriteria?: {
    groupId: string;
    groupedEvents: string[];
    process: string;
    groupingBasis: string;
    limitations?: string;
}[];
```

This allows documenting how success criteria for grouped initiating events are defined.

### Digital Systems Criteria (SC-C1i)

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

This captures the technical basis for digital instrumentation and control systems.

### Passive Safety Criteria (SC-C1j)

Success criteria for passive safety functions are documented with:

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

This allows documenting uncertainties in passive safety function criteria and how they were addressed.

### Shared Systems Criteria (SC-C1k)

Criteria for shared systems are documented through:

```typescript
sharedSystemsCriteria?: {
    systemId: string;
    sharedByReactors: string[];
    criteria: string;
    commonInitiatingEvents: string[];
    technicalBasis: string;
}[];
```

This captures how shared systems between reactors are handled in success criteria.

## SC-C2 Requirements Coverage

SC-C2 requires documenting sources of model uncertainty and reasonable alternatives. The schema provides dedicated structures for this:

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

This structure enables documenting model uncertainties specific to success criteria and reasonable alternatives as required by SC-C2, including references to SC-A10 and SC-B9.

## SC-C3 Requirements Coverage

SC-C3 requires documenting assumptions and limitations due to lack of as-built, as-operated details. The schema addresses this with:

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

This structure enables documenting pre-operational assumptions specific to success criteria, including plans to resolve them when the plant is built and operational.

## Cross-Referenced Requirements

The schema also addresses cross-referenced requirements:

- **SC-A10** (reasonable alternatives for significant assumptions) is addressed via `SuccessCriteriaSensitivityStudy` and `ModelUncertaintyDocumentation.reasonableAlternatives`
- **SC-B9** (model uncertainty sources) is addressed via `modelUncertainties` and `ModelUncertaintyDocumentation`
- **SC-A11/SC-B10** (pre-operational assumptions) is addressed via `preOperationalAssumptions` and `PreOperationalAssumptionsDocumentation`

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

## Conclusion

The Success Criteria Development TypeScript schema fully satisfies the Supporting Requirements for Regulatory Compliance. The schema provides structured elements for documenting:
- The process used in success criteria development (SC-C1)
- Sources of model uncertainty and reasonable alternatives (SC-C2)
- Assumptions and limitations due to lack of as-built, as-operated details (SC-C3)

Each sub-requirement of SC-C1 has corresponding dedicated schema structures, ensuring comprehensive documentation. The schema is also well-suited for documenting EBR-II specific success criteria, including its unique features like the Reactor Shutdown System, passive safety features, and natural circulation capabilities.