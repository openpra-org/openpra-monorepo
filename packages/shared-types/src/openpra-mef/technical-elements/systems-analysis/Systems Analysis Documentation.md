# Systems Analysis Schema Validation Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Schema Overview](#schema-overview)
3. [Regulatory Requirements Coverage](#Regulatory-requirements-coverage)
   1. [SY-C1: Process Documentation](#sy-c1-process-documentation)
      1. [(a) System Function and Operation](#a-system-function-and-operation)
      2. [(b) System Model Boundary](#b-system-model-boundary)
      3. [(c) System Schematic](#c-system-schematic)
      4. [(d) Equipment Operability](#d-equipment-operability)
      5. [(e) Operational History](#e-operational-history)
      6. [(f) Success Criteria](#f-success-criteria)
      7. [(g) Human Actions](#g-human-actions)
      8. [(h) Test and Maintenance](#h-test-and-maintenance)
      9. [(i) System Dependencies](#i-system-dependencies)
      10. [(j) Component Spatial Information](#j-component-spatial-information)
      11. [(k) Modeling Assumptions](#k-modeling-assumptions)
      12. [(l) Components and Failure Modes](#l-components-and-failure-modes)
      13. [(m) Modularization Process](#m-modularization-process)
      14. [(n) Logic Loop Resolution](#n-logic-loop-resolution)
      15. [(o) Evaluation Results](#o-evaluation-results)
      16. [(p) Sensitivity Studies](#p-sensitivity-studies)
      17. [(q) Information Sources](#q-information-sources)
      18. [(r) Basic Events Traceability](#r-basic-events-traceability)
      19. [(s) Nomenclature](#s-nomenclature)
      20. [(t) Digital I&C Systems](#t-digital-ic-systems)
      21. [(u) Passive Systems](#u-passive-systems)
   2. [SY-C2: Model Uncertainty Documentation](#sy-c2-model-uncertainty-documentation)
   3. [SY-C3: Pre-Operational Assumptions Documentation](#sy-c3-pre-operational-assumptions-documentation)
4. [Implementation Examples](#implementation-examples)
   1. [EBR-II Passive Safety Features Example](#ebr-ii-passive-safety-features-example)
   2. [EBR-II Shutdown Cooling System Example](#ebr-ii-shutdown-cooling-system-example)
5. [Requirements Coverage Summary](#requirements-coverage-summary)
6. [Conclusion](#conclusion)

## Introduction

This document validates that the TypeScript schema for Systems Analysis is compliant with the "Supporting Requirements" as defined in the standard. The schema provides interfaces and data structures that enable comprehensive documentation of Systems Analysis according to these requirements.

The primary objective of Regulatory guidance is to ensure that the documentation of Systems Analysis provides traceability of the work. The TypeScript schema implements this through structured interfaces that capture all required information.

## Schema Overview

The Systems Analysis TypeScript schema implements a comprehensive set of interfaces and types that enable documentation of system models, dependencies, uncertainties, and assumptions as required by Regulators. Key modules in the schema include:

- Core definitions and enumerations
- System modeling and failure modes
- Fault tree analysis
- Dependencies and common cause analysis
- Engineering analysis and validation
- Documentation and traceability

The schema provides dedicated interfaces for meeting Regulatory requirements, including `ProcessDocumentation`, `ModelUncertaintyDocumentation`, and other interfaces that inherit from base documentation classes.

Additionally, the schema includes minimal interfaces for specific system aspects:
- `SupportSystemSuccessCriteria`: For documenting success criteria of support systems
- `EnvironmentalDesignBasisConsideration`: For identifying components that may operate beyond design basis
- `InitiationActuationSystem`: For modeling system initiation and actuation

The schema provides dedicated interfaces for meeting Regulatory requirements, including `ProcessDocumentation`, `ModelUncertaintyDocumentation`, and other interfaces that inherit from base documentation classes.

## Regulatory Requirements Coverage

This section demonstrates how the schema enables compliance with each of the supporting requirements for Regulatory Compliance.

### SY-C1: Process Documentation

The schema provides the `ProcessDocumentation` interface that extends `BaseProcessDocumentation` with systems-specific documentation requirements:

```typescript
export interface ProcessDocumentation extends BaseProcessDocumentation {
  systemFunctionDocumentation?: Record<SystemReference, string>;
  systemBoundaryDocumentation?: Record<SystemReference, string>;
  // Additional properties addressing SY-C1 requirements
  // ...
}
```

The following sections demonstrate how each SY-C1 sub-requirement is covered by the schema with concise examples.

#### (a) System Function and Operation

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
systemFunctionDocumentation?: Record<SystemReference, string>;

// Also in SystemDefinition interface
description?: string;
```

**Example:**
```typescript
// Example for EBR-II primary cooling system
const processDoc: ProcessDocumentation = {
  systemFunctionDocumentation: {
    "SYS-PCS": "The primary cooling system circulates liquid sodium through the reactor core and intermediate heat exchanger to remove heat under normal and emergency operations. During normal operation, it transfers heat to the secondary system. During emergency conditions, it provides decay heat removal via natural circulation."
  }
};
```

#### (b) System Model Boundary

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
systemBoundaryDocumentation?: Record<SystemReference, string>;

// Also in SystemDefinition interface
boundaries: string[];
```

**Example:**
```typescript
const systemDef: SystemDefinition = {
  id: "SYS-PCS-001",
  name: "Primary Cooling System",
  boundaries: [
    "From reactor vessel inlet plenum to outlet plenum",
    "Primary sodium pumps",
    "Intermediate heat exchangers",
    "All associated piping within containment",
    "Excluding secondary sodium system boundary"
  ]
};
```

#### (c) System Schematic

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
systemSchematicReferences?: Record<SystemReference, {
  reference: string;
  description: string;
}>;

// Also in SystemDefinition interface
schematic?: {
  reference: string;
  description?: string;
};
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  systemSchematicReferences: {
    "SYS-SCS": {
      reference: "Drawing EBR-II-SCS-P001",
      description: "Piping and Instrumentation Diagram for EBR-II Shutdown Cooling System"
    }
  }
};
```

#### (d) Equipment Operability

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
equipmentOperabilityDocumentation?: Record<string, {
  system: SystemReference;
  component: string;
  considerations: string;
  calculationReferences?: string[];
}>;

// Also in SystemDefinition interface
operabilityConsiderations?: {
  component: string;
  calculationRef?: string;
  notes?: string;
}[];
```

**Example:**
```typescript
const systemDef: SystemDefinition = {
  // Other properties...
  operabilityConsiderations: [
    {
      component: "Primary Sodium Pump P-1",
      calculationRef: "CALC-EBR-PCS-007",
      notes: "Calculation confirms pump can operate at up to 550°C sodium temperature"
    }
  ]
};
```

#### (e) Operational History

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
operationalHistoryDocumentation?: Record<SystemReference, string[]>;

// Also in SystemDefinition interface
operationalHistory?: string[];
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  operationalHistoryDocumentation: {
    "SYS-SCS": [
      "Actuated during 1971 loss of power event; performed as designed",
      "Three instances of minor NaK leakage identified in operational history",
      "Natural circulation capability confirmed during test in 1969"
    ]
  }
};
```

#### (f) Success Criteria

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
successCriteriaDocumentation?: Record<SystemReference, {
  criteria: string;
  relationshipToEventSequences: string;
}>;

// Also in SystemDefinition interface
successCriteria: string | SystemSuccessCriterion | SuccessCriteriaId;

// Also in SupportSystemSuccessCriteria interface
export interface SupportSystemSuccessCriteria extends Unique {
  systemReference: SystemReference;
  successCriteria: string;
  criteriaType: "conservative" | "realistic";
  supportedSystems: SystemReference[];
}
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  successCriteriaDocumentation: {
    "SYS-SCS": {
      criteria: "At least one natural circulation path available with sufficient heat removal capacity to maintain primary sodium below 550°C",
      relationshipToEventSequences: "Required for all sequences involving loss of forced circulation in accident sequences AS-LOFC-001 through AS-LOFC-015"
    }
  }
};

// Example for support system success criteria
const supportSystemCriteria: SupportSystemSuccessCriteria = {
  id: "SSSC-001",
  systemReference: "SYS-CCW",
  successCriteria: "At least one CCW pump and heat exchanger train providing minimum flow of 5000 gpm",
  criteriaType: "realistic",
  supportedSystems: ["SYS-RHR", "SYS-CSS"]
};
```

#### (g) Human Actions

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
humanActionsDocumentation?: Record<HumanActionReference, {
  system: SystemReference;
  description: string;
}>;

// Also in SystemDefinition interface
humanActionsForOperation?: {
  actionRef: HumanActionReference;
  description: string;
}[];
```

**Example:**
```typescript
const systemDef: SystemDefinition = {
  // Other properties...
  humanActionsForOperation: [
    {
      actionRef: "HRA-023",
      description: "Operator verifies damper alignment for passive air cooling within 2 hours of loss of forced circulation"
    }
  ]
};
```

#### (h) Test and Maintenance

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
testMaintenanceProceduresDocumentation?: Record<SystemReference, string[]>;

// Also in SystemDefinition interface
testMaintenanceProcedures?: string[];
testAndMaintenance?: string[];
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  testMaintenanceProceduresDocumentation: {
    "SYS-SCS": [
      "Procedure OP-SCS-04: Monthly verification of NaK expansion tank level",
      "Procedure MT-SCS-09: Annual thermal performance testing of passive cooling capability"
    ]
  }
};
```

#### (i) System Dependencies

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
dependencySearchDocumentation?: {
  methodology: string;
  dependencyTableReferences: string[];
};

// Also in dedicated interfaces
export interface SystemDependency extends Unique {
  dependentSystem: SystemReference;
  supportingSystem: SystemReference;
  type: DependencyType | string;
  // Other properties...
}

export interface DependencySearchMethodology extends Unique, Named {
  description: string;
  reference: string;
  dependencyTables?: {
    tableId: string;
    description: string;
    reference?: string;
  }[];
  // Other properties...
}
```

**Example:**
```typescript
const dependencySearch: DependencySearchMethodology = {
  id: "DSM-001",
  name: "EBR-II Systems Dependency Analysis",
  description: "Systematic approach to identify functional, spatial, and human dependencies",
  reference: "Report EBR-II-SDA-001",
  dependencyTables: [
    {
      tableId: "DEP-PCS-001",
      description: "Primary Cooling System Dependencies Matrix"
    }
  ]
};
```

#### (j) Component Spatial Information

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
spatialInformationDocumentation?: Record<string, {
  location: string;
  systems: SystemReference[];
  components: string[];
  hazards: string[];
}>;

// Also in SystemDefinition interface
spatialInformation?: {
  location: string;
  hazards?: string[];
  components?: string[];
}[];
```

**Example:**
```typescript
const systemDef: SystemDefinition = {
  // Other properties...
  spatialInformation: [
    {
      location: "Reactor Building Room RB-104",
      hazards: ["Sodium fire", "High radiation"],
      components: ["Primary Pump P-1", "Primary Pump P-2"]
    }
  ]
};
```

#### (k) Modeling Assumptions

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
modelingAssumptionsDocumentation?: Record<SystemReference, string[]>;

// Also in SystemDefinition interface
modelAssumptions?: string[];
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  modelingAssumptionsDocumentation: {
    "SYS-SCS": [
      "Natural circulation initiates automatically upon loss of forced flow",
      "Heat removal capacity is sufficient for decay heat levels 1 hour after shutdown",
      "Air dampers fail in the open position"
    ]
  }
};
```

#### (l) Components and Failure Modes

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
componentsFailureModesDocumentation?: Record<SystemReference, {
  includedComponents: string[];
  excludedComponents: string[];
  justificationForExclusion: string;
  includedFailureModes: string[];
  excludedFailureModes: string[];
  justificationForFailureModeExclusion: string;
}>;

// Also in SystemDefinition interface
modeledComponentsAndFailures: Record<
  string,
  {
    failureModes: string[];
    justificationForInclusion?: string;
    componentGroup?: string;
  }
>;
justificationForExclusionOfComponents?: string[];
justificationForExclusionOfFailureModes?: string[];
```

**Example:**
```typescript
const systemDef: SystemDefinition = {
  // Other properties...
  modeledComponentsAndFailures: {
    "NaK-HX-001": {
      failureModes: ["FAILURE_TO_TRANSFER_HEAT", "EXTERNAL_LEAKAGE"],
      justificationForInclusion: "Critical for passive heat removal capability",
      componentGroup: "HeatExchangers"
    }
  },
  justificationForExclusionOfComponents: [
    "Small instrument lines excluded due to minimal impact on system function"
  ]
};
```

#### (m) Modularization Process

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
modularizationDocumentation?: {
  description: string;
  systems: SystemReference[];
};
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  modularizationDocumentation: {
    description: "Super-component approach applied to group functionally similar components for quantification efficiency",
    systems: ["SYS-PCS", "SYS-SCS"]
  }
};
```

#### (n) Logic Loop Resolution

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
logicLoopResolutionsDocumentation?: Record<string, {
  system: SystemReference;
  loopDescription: string;
  resolution: string;
}>;

// Also in SystemLogicModel interface
logicLoopResolutions?: {
  loopId: string;
  resolution: string;
}[];
```

**Example:**
```typescript
const sysLogicModel: SystemLogicModel = {
  id: "SLM-PCS-001",
  systemReference: "SYS-PCS",
  description: "Primary Cooling System Fault Tree",
  modelRepresentation: "See attached fault tree file FT-PCS-001",
  basicEvents: [],
  logicLoopResolutions: [
    {
      loopId: "LOOP-PCS-001",
      resolution: "Support system dependency loop between PCS and electrical systems resolved using phased mission approach"
    }
  ]
};
```

#### (o) Evaluation Results

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
evaluationResultsDocumentation?: Record<SystemReference, {
  topEventProbability: number;
  otherResults: Record<string, string>;
}>;

// Also in SystemModelEvaluation interface
export interface SystemModelEvaluation extends Unique {
  system: SystemReference;
  topEventProbability?: number;
  quantitativeResults?: Record<string, number>;
  qualitativeInsights?: string[];
  dominantContributors?: {
    contributor: string;
    contribution: number;
  }[];
}
```

**Example:**
```typescript
const sysEvaluation: SystemModelEvaluation = {
  id: "EVAL-SCS-001",
  system: "SYS-SCS",
  topEventProbability: 2.3e-4,
  dominantContributors: [
    {
      contributor: "NaK-HX-001 Failure to Transfer Heat",
      contribution: 0.65
    }
  ]
};
```

#### (p) Sensitivity Studies

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
sensitivityStudiesDocumentation?: Record<SystemReference, {
  studyDescription: string;
  results: string;
}[]>;

// Also in dedicated interface
export interface SystemSensitivityStudy extends SensitivityStudy {
  system: SystemReference;
  parameterChanged: string;
  impactOnSystem: string;
  insights?: string;
}
```

**Example:**
```typescript
const sensitivityStudy: SystemSensitivityStudy = {
  id: "SENS-SCS-001",
  name: "SCS Heat Removal Capacity Sensitivity",
  system: "SYS-SCS",
  parameterChanged: "NaK-to-Air Heat Transfer Coefficient",
  impactOnSystem: "Increasing heat transfer coefficient by 20% decreases peak temperature by 15°C",
  insights: "System performance is moderately sensitive to heat transfer coefficient, but maintains adequate margin"
};
```

#### (q) Information Sources

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
informationSourcesDocumentation?: {
  drawings: string[];
  procedures: string[];
  interviews: string[];
  otherSources: string[];
};
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  informationSourcesDocumentation: {
    drawings: ["Drawing EBR-II-PCS-P001", "Drawing EBR-II-SCS-P001"],
    procedures: ["OP-SCS-04", "MT-SCS-09"],
    interviews: ["Interview with J. Smith, EBR-II Operations, 2023-06-15"],
    otherSources: ["NUREG-CR-1234", "ANL-EBR-II-67-01"]
  }
};
```

#### (r) Basic Events Traceability

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
basicEventsDocumentation?: Record<string, {
  system: SystemReference;
  description: string;
  moduleReference?: string;
  cutsetReference?: string;
}>;

// Also in FaultTree interface
export interface FaultTree extends Unique, Named {
  systemReference: SystemReference;
  nodes: Record<string, FaultTreeNode>;
  minimalCutSets?: string[][];
  // Other properties...
}
```

**Example:**
```typescript
const processDoc: ProcessDocumentation = {
  basicEventsDocumentation: {
    "BE-SCS-HX-001": {
      system: "SYS-SCS",
      description: "NaK-to-Air Heat Exchanger HX-001 Fails to Transfer Heat",
      moduleReference: "MOD-HX-001",
      cutsetReference: "CUTSET-SCS-001"
    }
  }
};
```

#### (s) Nomenclature

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
nomenclatureDocumentation?: Record<string, string>;

// Also in SystemLogicModel interface
nomenclature?: Record<string, string>;
```

**Example:**
```typescript
const sysLogicModel: SystemLogicModel = {
  // Other properties...
  nomenclature: {
    "FT": "Failure to",
    "SCS": "Shutdown Cooling System",
    "HX": "Heat Exchanger",
    "P": "Pump",
    "V": "Valve"
  }
};
```

#### (t) Digital I&C Systems

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
digitalICDocumentation?: Record<SystemReference, {
  description: string;
  modelingApproach: string;
  specialConsiderations?: string;
}>;

// Also in dedicated interface
export interface DigitalInstrumentationAndControl extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  methodology: string;
  assumptions?: string[];
  failureModes?: string[];
  specialConsiderations?: string[];
}
```

**Example:**
```typescript
const digitalIC: DigitalInstrumentationAndControl = {
  id: "DIC-001",
  name: "EBR-II Temperature Monitoring System",
  systemReference: "SYS-TMS",
  description: "Digital system for monitoring and recording reactor and primary system temperatures",
  methodology: "Software-inclusive fault tree with common cause failure modeling",
  failureModes: ["Software Error", "Hardware Failure", "Sensor Input Failure"]
};
```

#### (u) Passive Systems

**Schema Coverage:**
```typescript
// ProcessDocumentation interface
passiveSystemsDocumentation?: Record<SystemReference, {
  description: string;
  uncertaintyEvaluation: string;
}>;

// Also in dedicated interface
export interface PassiveSystemsTreatment extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  performanceAnalysisRef?: string;
  uncertaintyAnalysis?: string;
  relevantPhysicalPhenomena?: string[];
  uncertaintyEvaluation?: string;
}
```

**Example:**
```typescript
const passiveSys: PassiveSystemsTreatment = {
  id: "PST-001",
  name: "EBR-II Natural Circulation Cooling",
  systemReference: "SYS-SCS",
  description: "Passive cooling capability via natural circulation following loss of forced circulation",
  relevantPhysicalPhenomena: ["Thermal expansion", "Buoyancy-driven flow", "Natural convection heat transfer"],
  uncertaintyAnalysis: "Monte Carlo simulation of thermal-hydraulic parameters",
  uncertaintyEvaluation: "Key uncertainties include flow resistance factors and heat transfer coefficients"
};
```

### SY-C2: Model Uncertainty Documentation

The schema includes the `ModelUncertaintyDocumentation` interface that extends `BaseModelUncertaintyDocumentation` to address SY-C2 requirements:

```typescript
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  systemSpecificUncertainties?: Record<SystemReference, {
    uncertainties: string[];
    impact: string;
  }>;
  
  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableSystems?: SystemReference[];
  }[];
}
```

This interface explicitly addresses the requirements of SY-C2 to document sources of model uncertainty, related assumptions, and reasonable alternatives associated with Systems Analysis.

### SY-C3: Pre-Operational Assumptions Documentation

The schema leverages the base `PreOperationalAssumption` interface type which is imported from the core documentation module:

```typescript
import { 
    // ... other imports
    BasePreOperationalAssumptionsDocumentation,
    PreOperationalAssumption
} from "../core/documentation";
```

This enables documentation of assumptions and limitations for pre-operational PRAs, including the assumption that systems are free of design and construction errors or defects, as required by SY-C3.

## Implementation Examples

This section provides simplified examples of how the schema enables documentation of EBR-II systems.

### EBR-II Passive Safety Features Example

The schema enables documentation of EBR-II's passive safety features through the `PassiveSystemsTreatment` interface:

```typescript
// Example instantiation for EBR-II passive safety features
const passiveSafetyFeatures: PassiveSystemsTreatment = {
  id: "PSF-EBR-II-001",
  name: "EBR-II Passive Reactivity Feedback",
  systemReference: "SYS-CORE",
  description: "Natural properties that enhance reactor safety through relatively benign responses to accidents",
  relevantPhysicalPhenomena: [
    "Negative temperature coefficient of reactivity",
    "Natural circulation cooling",
    "Thermal expansion of structures"
  ],
  uncertaintyAnalysis: "Monte Carlo simulation of reactivity feedback mechanisms",
  uncertaintyEvaluation: "Comprehensive evaluation of uncertainties in thermal expansion coefficients and flow resistance"
};
```

The schema's `ProcessDocumentation` interface would then enable documentation of these passive safety features:

```typescript
// Example documentation of passive systems
const processDocumentation: ProcessDocumentation = {
  // Other documentation properties...
  passiveSystemsDocumentation: {
    "SYS-CORE": {
      description: "EBR-II's core incorporates passive safety features that rely on natural properties rather than active mitigation",
      uncertaintyEvaluation: "Uncertainties in natural circulation and reactivity feedback were evaluated through thermal-hydraulic analysis and reactor physics calculations"
    }
  }
};
```

### EBR-II Shutdown Cooling System Example

The Shutdown Cooling System can be documented using the `SystemDefinition` interface:

```typescript
// Example instantiation for EBR-II Shutdown Cooling System
const shutdownCoolingSystem: SystemDefinition = {
  id: "SYS-SCS-001",
  name: "EBR-II Shutdown Cooling System",
  description: "Passive system designed to remove decay heat from the primary sodium when the secondary system is inoperable",
  boundaries: [
    "Primary sodium boundary",
    "NaK natural circulation loop",
    "Air-cooled heat exchangers"
  ],
  successCriteria: "Maintain primary sodium temperature below 500°C during shutdown conditions",
  missionTime: "72 hours",
  modeledComponentsAndFailures: {
    "NaK-HX-001": {
      failureModes: ["FAILURE_TO_TRANSFER_HEAT", "EXTERNAL_LEAKAGE"],
      justificationForInclusion: "Critical for passive heat removal capability"
    },
    "AIR-DAMPER-001": {
      failureModes: ["FAILURE_TO_OPEN", "FAILURE_TO_REMAIN_OPEN"],
      justificationForInclusion: "Required for establishing natural draft air flow"
    }
  },
  testAndMaintenance: [
    "Monthly verification of damper operability",
    "Quarterly thermal performance test"
  ],
  modelAssumptions: [
    "Natural circulation is adequate to remove decay heat",
    "No operator actions required for 24 hours"
  ]
};
```

## Requirements Coverage Summary

The following table provides a condensed summary of how the schema enables compliance with Regulatory requirements:

| Requirement | Schema Implementation | Compliance |
|-------------|----------------------|------------|
| **SY-C1** | `ProcessDocumentation` interface with 21 specialized properties corresponding to each sub-requirement | ✅ Complete |
| **SY-C2** | `ModelUncertaintyDocumentation` interface with `systemSpecificUncertainties` and `reasonableAlternatives` properties | ✅ Complete |
| **SY-C3** | Base documentation imports including `PreOperationalAssumption` | ✅ Complete |
| **SY-B7/B8** | `SupportSystemSuccessCriteria` interface for documenting conservative vs. realistic criteria | ✅ Complete |
| **SY-B11/B12** | `InitiationActuationSystem` interface for modeling initiation and actuation systems | ✅ Complete |
| **SY-B14** | `EnvironmentalDesignBasisConsideration` interface for identifying SSCs that may operate beyond design basis | ✅ Complete |

### SY-C1 Documentation Structure

The schema implements all 21 sub-requirements of SY-C1 through a systematic property mapping in the `ProcessDocumentation` interface. Rather than listing each individually, the table below groups these by documentation category:

| Documentation Category | SY-C1 Requirements | Interface Properties |
|------------------------|-------------------|---------------------|
| System Definition | (a)(b)(c)(f) | `systemFunctionDocumentation`, `systemBoundaryDocumentation`, `systemSchematicReferences`, `successCriteriaDocumentation` |
| Operational Aspects | (d)(e)(g)(h) | `equipmentOperabilityDocumentation`, `operationalHistoryDocumentation`, `humanActionsDocumentation`, `testMaintenanceProceduresDocumentation` |
| Model Structure | (i)(j)(k)(l)(m)(n)(s) | `dependencySearchDocumentation`, `spatialInformationDocumentation`, `modelingAssumptionsDocumentation`, `componentsFailureModesDocumentation`, `modularizationDocumentation`, `logicLoopResolutionsDocumentation`, `nomenclatureDocumentation` |
| Analysis Results | (o)(p)(q)(r) | `evaluationResultsDocumentation`, `sensitivityStudiesDocumentation`, `informationSourcesDocumentation`, `basicEventsDocumentation` |
| Special Systems | (t)(u) | `digitalICDocumentation`, `passiveSystemsDocumentation` |

## Conclusion

The TypeScript schema for Systems Analysis has been validated against the "Supporting Requirements for Regulatory Compliance." The schema provides comprehensive interfaces and data structures that enable documentation of Systems Analysis in accordance with these requirements. Key findings include:

1. The `ProcessDocumentation` interface provides dedicated properties for each of the SY-C1 sub-requirements (a) through (u).

2. Model uncertainty documentation is facilitated through the `ModelUncertaintyDocumentation` interface, which addresses SY-C2 requirements.

3. Pre-operational assumptions documentation is supported through integration with the base documentation module, satisfying SY-C3.

4. Examples demonstrating EBR-II's passive safety features and shutdown cooling system show how the schema can be applied to specific reactor designs.