# Documentation Demonstrating Regulatory Compliance in the Initiating Event Analysis Schema

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Schema Structure Supporting Documentation Requirements](#2-schema-structure-supporting-documentation-requirements)
- [3. Mapping of Schema Components to IE-D Requirements](#3-mapping-of-schema-components-to-ie-d-requirements)
  - [3.1 IE-D1 Requirements and Compliance](#31-ie-d1-requirements-and-compliance)
    - [3.1.1 IE-D1.a](#311-ie-d1a)
    - [3.1.2 IE-D1.b](#312-ie-d1b)
    - [3.1.3 IE-D1.c](#313-ie-d1c)
    - [3.1.4 IE-D1.d](#314-ie-d1d)
    - [3.1.5 IE-D1.e](#315-ie-d1e)
    - [3.1.6 IE-D1.f](#316-ie-d1f)
    - [3.1.7 IE-D1.g](#317-ie-d1g)
    - [3.1.8 IE-D1.h](#318-ie-d1h)
    - [3.1.9 IE-D1.i](#319-ie-d1i)
    - [3.1.10 IE-D1.j](#3110-ie-d1j)
    - [3.1.11 IE-D1.k](#3111-ie-d1k)
    - [3.1.12 IE-D1.l](#3112-ie-d1l)
  - [3.2 IE-D2 Compliance](#32-ie-d2-compliance)
  - [3.3 IE-D3 Compliance](#33-ie-d3-compliance)
- [4. Documentation Capabilities and Data Structure](#4-documentation-capabilities-and-data-structure)
- [5. Schema Validation for Documentation Requirements](#5-schema-validation-for-documentation-requirements)
- [6. Conclusion](#6-conclusion)

## 1. Introduction

The provided TypeScript schema implements comprehensive support for documenting Initiating Event Analysis in accordance with Regulatory standards, specifically addressing the Regulatory requirements. This document demonstrates how the schema satisfies all documentation requirements through its data structures, validation rules, and interfaces.

## 2. Schema Structure Supporting Documentation Requirements

The schema includes dedicated interfaces specifically designed to fulfill Regulatory requirements:

```typescript
// Primary documentation interfaces in the schema
export interface InitiatingEventDocumentation { ... }
export interface PreOperationalAssumptions { ... }
export interface PeerReviewDocumentation { ... }
export interface HazardAnalysis { ... }
```

The schema uses standardized patterns for cross-referencing other technical elements:

```typescript
// Standardized reference patterns
type SuccessCriteriaId = string & tags.Pattern<typeof IdPatterns.SUCCESS_CRITERIA_ID>; // Imported from shared-patterns
type PlantOperatingStateId = string & tags.Pattern<typeof IdPatterns.STATE>;
type SystemId = string & tags.Pattern<typeof IdPatterns.SYSTEM_ID>;
```

These interfaces are integrated into the main `InitiatingEventsAnalysis` interface:

```typescript
export interface InitiatingEventsAnalysis extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
  // Other properties...

  /**
   * Documentation of the Initiating Event Analysis process.
   */
  documentation?: InitiatingEventDocumentation;

  /**
   * Pre-operational assumptions and limitations
   * @remarks **IE-D3**: For PRAs performed during the pre-operational stage, DOCUMENT assumptions and limitations...
   */
  pre_operational_assumptions?: PreOperationalAssumptions[];

  /**
   * Peer review documentation
   * @remarks **HLR-IE-D**
   */
  peer_review?: PeerReviewDocumentation;
}
```

## 3. Mapping of Schema Components to IE-D Requirements

### 3.1 IE-D1 Requirements and Compliance

The schema provides comprehensive support for IE-D1 requirements through the `InitiatingEventDocumentation` interface, ensuring traceability of the entire Initiating Event Analysis process:

```typescript
export interface InitiatingEventDocumentation {
  processDescription: string;
  inputSources: string[];
  appliedMethods: string[];
  resultsSummary: string;
  // IE-D1 specific fields...
}
```

#### 3.1.1 IE-D1.a

The schema documents functional categories and specific initiating events through:

```typescript
functionalCategories: string[];
```

The categorization is further supported by the `InitiatingEventCategory` enum:

```typescript
export enum InitiatingEventCategory {
  TRANSIENT = "TRANSIENT",
  RCB_BREACH = "RCB_BREACH",
  INTERFACING_SYSTEMS_RCB_BREACH = "INTERFACING_SYSTEMS_RCB_BREACH",
  SPECIAL = "SPECIAL",
  INTERNAL_HAZARD = "INTERNAL_HAZARD",
  EXTERNAL_HAZARD = "EXTERNAL_HAZARD",
  HUMAN_FAILURE = "HUMAN_FAILURE",
}
```

Each initiator is mapped to a category in the `ExtendedInitiatingEvent` interface:

```typescript
export interface ExtendedInitiatingEvent extends InitiatingEvent {
  category: InitiatingEventCategory | string;
  // Other fields...
}
```

#### 3.1.2 IE-D1.b

The schema captures the systematic search for plant-unique initiators through:

```typescript
plantUniqueInitiatorsSearch: string;
```

This is complemented by identification methods that systematically evaluate systems:

```typescript
export interface MasterLogicDiagram extends IdentificationMethodBase {
  systems_components: Record<string, SystemComponent>;
  failure_modes: Record<
    string,
    {
      id: string;
      name: string;
      description: string;
      component_id: string;
    }
  >;
  // Other fields...
}
```

#### 3.1.3 IE-D1.c

The schema documents the approach for identifying state-specific initiators through:

```typescript
stateSpecificInitiatorsSearch: string;
```

Each initiator is linked to applicable plant operating states:

```typescript
export interface InitiatorDefinition extends ExtendedInitiatingEvent {
  operating_states: OperatingState[];
  // Other fields...
}
```

The schema also provides cross-referencing to plant operating states:

```typescript
export interface InitiatingEventsAnalysis {
  applicable_plant_operating_states: PlantOperatingStateReference[];
  // Other fields...
}
```

#### 3.1.4 IE-D1.d

The schema documents the systematic search for RCB failures through:

```typescript
rcbFailureSearch: string;
```

RCB failures are categorized and associated with specific impact mechanisms:

```typescript
export interface InitiatorDefinition {
  barrier_impacts: Record<
    string,
    {
      barrier: string;
      state: BarrierStatus;
      timing: string;
      mechanism: string;
    }
  >;
  // Other fields...
}
```

#### 3.1.5 IE-D1.e

The schema documents the approach for assessing completeness through:

```typescript
completenessAssessment: string;
```

Completeness is further enforced through validation functions:

```typescript
validateCompleteness: (analysis: InitiatingEventsAnalysis): string[] => {
  const errors: string[] = [];
  // Check if all categories from IE-A5 are represented
  const categories = new Set(Object.values(analysis.initiators).map((ie) => ie.category));
  const requiredCategories = [
    InitiatingEventCategory.TRANSIENT,
    InitiatingEventCategory.RCB_BREACH,
    InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH,
  ];

  for (const requiredCategory of requiredCategories) {
    if (!categories.has(requiredCategory)) {
      errors.push(`Required initiating event category ${requiredCategory} is not represented`);
    }
  }
  return errors;
};
```

#### 3.1.6 IE-D1.f

The schema documents the basis for screening out initiating events through:

```typescript
screeningBasis: string;
```

Screening criteria are captured in a dedicated interface:

```typescript
export interface ScreeningCriteria {
  frequency_criterion: number;
  damage_frequency_criterion: number;
  basis: string;
  screened_out_events: {
    event_id: string;
    reason: string;
    justification: string;
  }[];
}
```

Individual initiating events also contain screening information:

```typescript
export interface ExtendedInitiatingEvent {
  screeningStatus?: ScreeningStatus;
  screeningBasis?: string;
  // Other fields...
}
```

#### 3.1.7 IE-D1.g

The schema documents the basis for grouping initiating events through:

```typescript
groupingBasis: string;
```

The grouping logic is captured in the `InitiatingEventGroup` interface:

```typescript
export interface InitiatingEventGroup extends Unique, Named {
  description: string;
  member_ids: string[];
  grouping_basis: string;
  bounding_initiator_id: string;
  shared_mitigation_requirements: string[];
  challenged_safety_functions: SafetyFunctionReference[];
  applicable_operating_states: PlantOperatingStateReference[];
  quantification?: FrequencyQuantification;
  risk_importance?: ImportanceLevel;
}
```

Events reference their group through:

```typescript
export interface ExtendedInitiatingEvent {
  group?: string;
  groupId?: string;
  // Other fields...
}
```

#### 3.1.8 IE-D1.h

The schema documents justification for dismissing observed events through:

```typescript
dismissalJustification: string;
```

Plant-specific experience is tracked in each initiating event:

```typescript
export interface ExtendedInitiatingEvent {
  plantExperience?: string[];
  // Other fields...
}
```

#### 3.1.9 IE-D1.i

The schema documents the derivation of initiating event frequencies through:

```typescript
frequencyDerivation: string;
```

Frequency data and calculations are captured in specialized interfaces:

```typescript
export interface InitiatingEventQuantification {
  event_id: string;
  quantification: FrequencyQuantification;
  data_exclusion_justification?: string;
  other_reactor_data_justification?: string;
  fault_tree_details?: {
    model_id: string;
    top_event: string;
    modifications: string[];
  };
  sensitivityStudies?: SensitivityStudy[];
}
```

#### 3.1.10 IE-D1.j

The schema documents the approach to quantification through:

```typescript
quantificationApproach: string;
```

The approach includes consideration of operating states and supporting analyses:

```typescript
export interface InitiatorDefinition {
  supportingAnalyses?: {
    analysisType: string;
    analysisId: string;
    description?: string;
  }[];
  // Other fields...
}
```

#### 3.1.11 IE-D1.k

The schema documents justification for excluding data through:

```typescript
dataExclusionJustification: string;
```

This is complemented by specific justification in the quantification details:

```typescript
export interface InitiatingEventQuantification {
  data_exclusion_justification?: string;
  // Other fields...
}
```

#### 3.1.12 IE-D1.l

The schema documents justification for applying data from other reactor types through:

```typescript
otherDataApplicationJustification: string;
```

This is complemented by specific justification in the quantification details:

```typescript
export interface InitiatingEventQuantification {
  other_reactor_data_justification?: string;
  // Other fields...
}
```

### 3.2 IE-D2 Compliance

```typescript
// Within InitiatingEventsAnalysis
metadata: {
    // Other metadata...
    assumptions: Assumption[];  // Documents key assumptions
    limitations: string[];      // Documents limitations
}

// Within ExtendedInitiatingEvent
uncertainty?: Uncertainty;  // Documents uncertainty for each event

// Within the insights section
insights: {
    key_assumptions: string[];       // Documents key assumptions
    sensitivity_studies: Record<string, SensitivityStudy>;  // Documents sensitivity analyses
    uncertainty_drivers: string[];   // Documents key uncertainties
}
```

### 3.3 IE-D3 Compliance

The schema explicitly addresses pre-operational documentation through a dedicated interface:

```typescript
export interface PreOperationalAssumptions {
  statement: string; // The assumption statement
  impact: string; // Impact on the analysis
  treatmentApproach: string; // How assumption is addressed
  validationPlan?: string; // Plans for validation once built
}
```

This interface directly maps to IE-D3 requirements and references both IE-A18 and IE-B6 as noted in the standard.

## 4. Documentation Capabilities and Data Structure

The schema provides comprehensive traceability through nested data structures:

1. **Top-level documentation**:
   - Process documentation in `InitiatingEventDocumentation`
   - Pre-operational documentation in `PreOperationalAssumptions`
   - Peer review documentation in `PeerReviewDocumentation`

2. **Event-level documentation**:
   - Per-event documentation in `ExtendedInitiatingEvent.description`
   - Screening basis in `ExtendedInitiatingEvent.screeningBasis`
   - Plant experience in `ExtendedInitiatingEvent.plantExperience`
   - Supporting analyses in `ExtendedInitiatingEvent.supportingAnalyses`

3. **Method-level documentation**:
   - Documentation of identification methods (MLD, HBFT, FMEA)
   - Documentation of quantification methods
   - Documentation of hazard analysis methods

4. **Group-level documentation**:
   - Group descriptions and basis in `InitiatingEventGroup`
   - Shared mitigation requirements
   - Challenged safety functions
   - Applicable operating states

Example usage pattern for documentation:

```typescript
const analysis: InitiatingEventsAnalysis = {
  "technical-element-type": TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
  "technical-element-code": "IE",
  // Core elements...

  // IE-D1 Documentation
  documentation: {
    processDescription: "Systematic process following RA-S-1.4-2021",
    inputSources: ["System designs", "FSAR", "Industry OE"],
    // Additional IE-D1 fields...
  },

  // IE-D3 Documentation
  pre_operational_assumptions: [
    {
      statement: "Assumed 4 RCPs based on current design",
      impact: "Affects LOCA frequency calculations",
      treatmentApproach: "Used parametric study to assess sensitivity",
      validationPlan: "Validate when final RCP design is confirmed",
    },
    // Additional pre-operational assumptions...
  ],

  // Peer Review Documentation
  peer_review: {
    reviewDate: "2024-03-15",
    reviewTeam: ["John Doe", "Jane Smith"],
    findings: [
      {
        id: "FIND-001",
        description: "Need to clarify basis for screening criteria",
        significance: "MEDIUM",
        associatedRequirements: ["IE-D1.f"],
        status: "OPEN",
        resolutionPlan: "Update screening criteria documentation",
      },
    ],
    scope: "Full review of initiating event analysis",
    methodology: "Independent technical review",
    reportReference: "PR-2024-001",
  },
};
```

## 5. Schema Validation for Documentation Requirements

The schema includes validation functions to ensure documentation completeness:

```typescript
export const validateInitiatingEventsAnalysis = {
  // Other validation functions...

  validateScreening: (analysis: InitiatingEventsAnalysis): string[] => {
    const errors: string[] = [];
    // Check if all screened out events have proper documentation
    for (const screenedEvent of analysis.screening_criteria.screened_out_events) {
      if (!screenedEvent.justification) {
        errors.push(`Screened out event ${screenedEvent.event_id} has no justification`);
      }
      // Additional validation...
    }
    return errors;
  },

  validateCompleteness: (analysis: InitiatingEventsAnalysis): string[] => {
    // Validation ensuring all required categories are documented
    // ...
  },

  validatePeerReview: (analysis: InitiatingEventsAnalysis): string[] => {
    const errors: string[] = [];
    if (analysis.peer_review) {
      // Validate peer review documentation completeness
      if (!analysis.peer_review.findings.length) {
        errors.push("Peer review must include at least one finding");
      }
      // Additional validation...
    }
    return errors;
  },
};
```

Additionally, the Typia validation ensures type compliance:

```typescript
import typia from "typia";
export const InitiatingEventsAnalysisSchema = typia.json.schemas<[InitiatingEventsAnalysis]>();
```

## 6. Conclusion

The updated schema provides comprehensive support for documenting Initiating Event Analysis in accordance with Regulatory requirements. The enhanced documentation capabilities, including peer review documentation and expanded validation, ensure that all aspects of the analysis are properly documented and traceable. The schema's modular design allows for future extensions while maintaining backward compatibility.
