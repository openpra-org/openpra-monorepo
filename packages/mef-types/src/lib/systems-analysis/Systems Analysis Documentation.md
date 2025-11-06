# Systems Analysis Schema Validation Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Schema Overview](#schema-overview)
3. [Regulatory Requirements Coverage](#Regulatory-requirements-coverage)
   1. [SY-C1](#sy-c1)
      1. [SY-C1.a](#sy-c1a)
      2. [SY-C1.b](#sy-c1b)
      3. [SY-C1.c](#sy-c1c)
      4. [SY-C1.d](#sy-c1d)
      5. [SY-C1.e](#sy-c1e)
      6. [SY-C1.f](#sy-c1f)
      7. [SY-C1.g](#sy-c1g)
      8. [SY-C1.h](#sy-c1h)
      9. [SY-C1.i](#sy-c1i)
      10. [SY-C1.j](#sy-c1j)
      11. [SY-C1.k](#sy-c1k)
      12. [SY-C1.l](#sy-c1l)
      13. [SY-C1.m](#sy-c1m)
      14. [SY-C1.n](#sy-c1n)
      15. [SY-C1.o](#sy-c1o)
      16. [SY-C1.p](#sy-c1p)
      17. [SY-C1.q](#sy-c1q)
      18. [SY-C1.r](#sy-c1r)
      19. [SY-C1.s](#sy-c1s)
      20. [SY-C1.t](#sy-c1t)
      21. [SY-C1.u](#sy-c1u)
   2. [SY-C2](#sy-c2)
   3. [SY-C3](#sy-c3)
4. [Data Analysis Integration](#data-analysis-integration)
5. [Template Management](#template-management)
6. [Safety Function Mapping](#safety-function-mapping)
7. [Environmental Considerations](#environmental-considerations)
8. [Implementation Examples](#implementation-examples)
   1. [EBR-II Passive Safety Features Example](#ebr-ii-passive-safety-features-example)
   2. [EBR-II Shutdown Cooling System Example](#ebr-ii-shutdown-cooling-system-example)
9. [Requirements Coverage Summary](#requirements-coverage-summary)
10. [Core Definitions](#core-definitions)
11. [Conclusion](#conclusion)

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

### SY-C1

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

#### SY-C1a

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
    "SYS-PCS":
      "The primary cooling system circulates liquid sodium through the reactor core and intermediate heat exchanger to remove heat under normal and emergency operations. During normal operation, it transfers heat to the secondary system. During emergency conditions, it provides decay heat removal via natural circulation.",
  },
};
```

#### SY-C1b

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
    "Excluding secondary sodium system boundary",
  ],
};
```

#### SY-C1c

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
      description: "Piping and Instrumentation Diagram for EBR-II Shutdown Cooling System",
    },
  },
};
```

#### SY-C1d

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
      notes: "Calculation confirms pump can operate at up to 550°C sodium temperature",
    },
  ],
};
```

#### SY-C1e

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
      "Natural circulation capability confirmed during test in 1969",
    ],
  },
};
```

#### SY-C1f

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

**Note:** The `SuccessCriteriaId` type is imported from the shared patterns module (`shared-patterns.ts`) to maintain consistency across the codebase and avoid duplicate type definitions.

**Example:**

```typescript
const processDoc: ProcessDocumentation = {
  successCriteriaDocumentation: {
    "SYS-SCS": {
      criteria:
        "At least one natural circulation path available with sufficient heat removal capacity to maintain primary sodium below 550°C",
      relationshipToEventSequences:
        "Required for all sequences involving loss of forced circulation in accident sequences AS-LOFC-001 through AS-LOFC-015",
    },
  },
};

// Example for support system success criteria
const supportSystemCriteria: SupportSystemSuccessCriteria = {
  id: "SSSC-001",
  systemReference: "SYS-CCW",
  successCriteria: "At least one CCW pump and heat exchanger train providing minimum flow of 5000 gpm",
  criteriaType: "realistic",
  supportedSystems: ["SYS-RHR", "SYS-CSS"],
};
```

#### SY-C1g

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
      description:
        "Operator verifies damper alignment for passive air cooling within 2 hours of loss of forced circulation",
    },
  ],
};
```

#### SY-C1h

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
      "Procedure MT-SCS-09: Annual thermal performance testing of passive cooling capability",
    ],
  },
};
```

#### SY-C1i

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
      description: "Primary Cooling System Dependencies Matrix",
    },
  ],
};
```

#### SY-C1j

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
      components: ["Primary Pump P-1", "Primary Pump P-2"],
    },
  ],
};
```

#### SY-C1k

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
      "Air dampers fail in the open position",
    ],
  },
};
```

#### SY-C1l

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
      componentGroup: "HeatExchangers",
    },
  },
  justificationForExclusionOfComponents: ["Small instrument lines excluded due to minimal impact on system function"],
};
```

#### SY-C1m

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
    description:
      "Super-component approach applied to group functionally similar components for quantification efficiency",
    systems: ["SYS-PCS", "SYS-SCS"],
  },
};
```

#### SY-C1n

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
      resolution:
        "Support system dependency loop between PCS and electrical systems resolved using phased mission approach",
    },
  ],
};
```

#### SY-C1o

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
      contribution: 0.65,
    },
  ],
};
```

#### SY-C1p

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
  insights: "System performance is moderately sensitive to heat transfer coefficient, but maintains adequate margin",
};
```

#### SY-C1q

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
    otherSources: ["NUREG-CR-1234", "ANL-EBR-II-67-01"],
  },
};
```

#### SY-C1r

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
      cutsetReference: "CUTSET-SCS-001",
    },
  },
};
```

#### SY-C1s

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
    FT: "Failure to",
    SCS: "Shutdown Cooling System",
    HX: "Heat Exchanger",
    P: "Pump",
    V: "Valve",
  },
};
```

#### SY-C1t

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
  failureModes: ["Software Error", "Hardware Failure", "Sensor Input Failure"],
};
```

#### SY-C1u

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
  uncertaintyEvaluation: "Key uncertainties include flow resistance factors and heat transfer coefficients",
};
```

### SY-C2

The schema includes the `ModelUncertaintyDocumentation` interface that extends `BaseModelUncertaintyDocumentation` to address SY-C2 requirements:

```typescript
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  systemSpecificUncertainties?: Record<
    SystemReference,
    {
      uncertainties: string[];
      impact: string;
    }
  >;

  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableSystems?: SystemReference[];
  }[];
}
```

### SY-C3

The schema leverages the base `PreOperationalAssumption` interface type which is imported from the core documentation module:

```typescript
import {
  // ... other imports
  BasePreOperationalAssumptionsDocumentation,
  PreOperationalAssumption,
} from "../core/documentation";
```

## Data Analysis Integration

The Systems Analysis module now integrates directly with the Data Analysis module to avoid duplication and ensure consistency across the PRA model. This integration focuses on aligning the probability models, parameter definitions, and basic event representations between the two modules.

### Cross-Module References

The Systems Analysis module includes several cross-references to the Data Analysis module:

1. **Basic Event Integration**

   ```typescript
   export interface SystemBasicEvent extends BasicEvent {
     // Other properties...

     // Probability model from data analysis module
     probabilityModel?: ProbabilityModel;

     // Reference to a ComponentBasicEvent in the data-analysis module
     dataAnalysisBasicEventRef?: string;
   }
   ```

2. **CCF Group Integration**

   ```typescript
   export interface CommonCauseFailureGroup extends Unique, Named {
     // Other properties...

     // Reference to CCF parameter in data analysis module
     dataAnalysisCCFParameterRef?: string;

     // Probability model from data analysis module
     probabilityModel?: ProbabilityModel;
   }
   ```

3. **Module-Level Integration**
   ```typescript
   export interface SystemsAnalysis extends TechnicalElement<TechnicalElementTypes.SYSTEMS_ANALYSIS> {
     // Other properties...

     // Reference to associated Data Analysis module
     dataAnalysisReference?: string;

     // Parameters with references to data analysis
     parameters?: Record<
       string,
       {
         // Other properties...
         dataAnalysisParameterRef?: string;
       }
     >;
   }
   ```

### Benefits of Integration

This integration provides several benefits:

1. **Reduced Duplication**: Complex probability models and uncertainty characterizations are defined once in the Data Analysis module and referenced in Systems Analysis.

2. **Improved Consistency**: Changes to parameters or basic events in the Data Analysis module are automatically reflected in Systems Analysis.

3. **Clearer Separation of Concerns**:
   - Data Analysis module focuses on parameter estimation, uncertainty characterization, and data collection
   - Systems Analysis module focuses on system modeling, dependencies, and logic structures

4. **Streamlined Quantification**: The quantification adapter can access the most up-to-date and detailed parameter information from the Data Analysis module.

### Example Usage

```typescript
// Example of a System Basic Event referencing Data Analysis
const systemBasicEvent: SystemBasicEvent = {
  id: "BE-PCS-PUMP-FTR",
  name: "Primary Cooling Pump Fails to Run",
  componentReference: "PCS-PUMP-001",
  failureMode: "FAILURE_TO_RUN",

  // Reference to data analysis module for detailed probability information
  dataAnalysisBasicEventRef: "DA-BE-PCS-PUMP-FTR-001",

  // ProbabilityModel imported from Data Analysis
  probabilityModel: {
    distribution: DistributionType.LOGNORMAL,
    parameters: {
      mean: 1.0e-4,
      errorFactor: 3.0,
    },
    source: "estimated",
  },
};
```

## Template Management

The schema includes comprehensive support for managing component templates and their instances:

```typescript
export interface TemplateInstanceRegistry extends Unique {
  /** Registry of instances organized by template */
  instancesByTemplate: Record<string, string[]>;

  /** Current version of each template */
  templateVersions: Record<string, string>;

  /** History of changes to templates */
  changeHistory: TemplateChangeRecord[];

  /** Configuration for propagating changes */
  propagationConfig: TemplatePropagationConfig;
}

export interface TemplateChangeRecord {
  /** Reference to the template that was changed */
  templateReference: string;

  /** Version of the template after the change */
  version: string;

  /** Timestamp when the change was made */
  timestamp: string;

  /** Description of changes made to the template */
  changes: string[];

  /** Indicates if changes have been propagated to instances */
  changesPropagated: boolean;

  /** Instances to exclude from change propagation */
  excludedInstances?: string[];
}
```

This structure enables:

- Tracking of template versions and changes
- Management of template instances
- Controlled propagation of template changes
- Exclusion of specific instances from updates

## Safety Function Mapping

The schema includes dedicated support for mapping systems to safety functions:

```typescript
export interface SystemToSafetyFunctionMapping extends Unique {
  /** Reference to the system */
  systemReference: SystemReference;

  /** Safety functions this system supports */
  safetyFunctions: string[];

  /** Event sequences where this system is credited */
  eventSequences: string[];
}
```

This enables clear documentation of:

- Which safety functions each system supports
- Event sequences where systems are credited
- Traceability between systems and safety functions

## Environmental Considerations

The schema includes comprehensive support for environmental considerations:

```typescript
export interface EnvironmentalDesignBasisConsideration extends Unique {
  /** Reference to the system */
  systemReference: SystemReference;

  /** Components that may operate beyond environmental design basis */
  components: string[];

  /** Event sequences where this may occur */
  eventSequences: string[];

  /** Environmental conditions beyond design basis */
  environmentalConditions: string;
}
```

This structure enables documentation of:

- Components operating beyond design basis
- Associated event sequences
- Specific environmental conditions
- Impact on system performance

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
    "Thermal expansion of structures",
  ],
  uncertaintyAnalysis: "Monte Carlo simulation of reactivity feedback mechanisms",
  uncertaintyEvaluation:
    "Comprehensive evaluation of uncertainties in thermal expansion coefficients and flow resistance",
};
```

The schema's `ProcessDocumentation` interface would then enable documentation of these passive safety features:

```typescript
// Example documentation of passive systems
const processDocumentation: ProcessDocumentation = {
  // Other documentation properties...
  passiveSystemsDocumentation: {
    "SYS-CORE": {
      description:
        "EBR-II's core incorporates passive safety features that rely on natural properties rather than active mitigation",
      uncertaintyEvaluation:
        "Uncertainties in natural circulation and reactivity feedback were evaluated through thermal-hydraulic analysis and reactor physics calculations",
    },
  },
};
```

### EBR-II Shutdown Cooling System Example

The Shutdown Cooling System can be documented using the `SystemDefinition` interface:

```typescript
// Example instantiation for EBR-II Shutdown Cooling System
const shutdownCoolingSystem: SystemDefinition = {
  id: "SYS-SCS-001",
  name: "EBR-II Shutdown Cooling System",
  description:
    "Passive system designed to remove decay heat from the primary sodium when the secondary system is inoperable",
  boundaries: ["Primary sodium boundary", "NaK natural circulation loop", "Air-cooled heat exchangers"],
  successCriteria: "Maintain primary sodium temperature below 500°C during shutdown conditions",
  missionTime: "72 hours",
  modeledComponentsAndFailures: {
    "NaK-HX-001": {
      failureModes: ["FAILURE_TO_TRANSFER_HEAT", "EXTERNAL_LEAKAGE"],
      justificationForInclusion: "Critical for passive heat removal capability",
    },
    "AIR-DAMPER-001": {
      failureModes: ["FAILURE_TO_OPEN", "FAILURE_TO_REMAIN_OPEN"],
      justificationForInclusion: "Required for establishing natural draft air flow",
    },
  },
  testAndMaintenance: ["Monthly verification of damper operability", "Quarterly thermal performance test"],
  modelAssumptions: [
    "Natural circulation is adequate to remove decay heat",
    "No operator actions required for 24 hours",
  ],
};
```

## Requirements Coverage Summary

The following table provides a condensed summary of how the schema enables compliance with Regulatory requirements:

| Requirement    | Schema Implementation                                                                                                | Compliance  |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- |
| **SY-C1**      | `ProcessDocumentation` interface with 21 specialized properties corresponding to each sub-requirement                | ✅ Complete |
| **SY-C2**      | `ModelUncertaintyDocumentation` interface with `systemSpecificUncertainties` and `reasonableAlternatives` properties | ✅ Complete |
| **SY-C3**      | Base documentation imports including `PreOperationalAssumption`                                                      | ✅ Complete |
| **SY-B7/B8**   | `SupportSystemSuccessCriteria` interface for documenting conservative vs. realistic criteria                         | ✅ Complete |
| **SY-B11/B12** | `InitiationActuationSystem` interface for modeling initiation and actuation systems                                  | ✅ Complete |
| **SY-B14**     | `EnvironmentalDesignBasisConsideration` interface for identifying SSCs that may operate beyond design basis          | ✅ Complete |

### SY-C1 Documentation Structure

The schema implements all 21 sub-requirements of SY-C1 through a systematic property mapping in the `ProcessDocumentation` interface. Rather than listing each individually, the table below groups these by documentation category:

| Documentation Category | SY-C1 Requirements    | Interface Properties                                                                                                                                                                                                                           |
| ---------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System Definition      | (a)(b)(c)(f)          | `systemFunctionDocumentation`, `systemBoundaryDocumentation`, `systemSchematicReferences`, `successCriteriaDocumentation`                                                                                                                      |
| Operational Aspects    | (d)(e)(g)(h)          | `equipmentOperabilityDocumentation`, `operationalHistoryDocumentation`, `humanActionsDocumentation`, `testMaintenanceProceduresDocumentation`                                                                                                  |
| Model Structure        | (i)(j)(k)(l)(m)(n)(s) | `dependencySearchDocumentation`, `spatialInformationDocumentation`, `modelingAssumptionsDocumentation`, `componentsFailureModesDocumentation`, `modularizationDocumentation`, `logicLoopResolutionsDocumentation`, `nomenclatureDocumentation` |
| Analysis Results       | (o)(p)(q)(r)          | `evaluationResultsDocumentation`, `sensitivityStudiesDocumentation`, `informationSourcesDocumentation`, `basicEventsDocumentation`                                                                                                             |
| Special Systems        | (t)(u)                | `digitalICDocumentation`, `passiveSystemsDocumentation`                                                                                                                                                                                        |

## Core Definitions

The schema includes several core definitions that are fundamental to systems analysis:

### Component States

Components can be in various states during operation:

```typescript
export type ComponentState =
  | "operational" // Normal operation
  | "degraded" // Operating but with reduced capability
  | "failed" // Complete loss of function
  | "recovering" // Being restored to service
  | "maintenance"; // Under planned maintenance
```

This enables modeling of:

- Normal operation conditions
- Degraded operation states
- Complete failure states
- Recovery processes
- Maintenance periods

### Plant Operating States

The schema includes support for referencing plant operating states:

```typescript
/**
 * Reference to a plant operating state
 * Format: POS-[NAME] (e.g., POS-FULL-POWER)
 */
export type PlantOperatingStateReference = string & tags.Pattern<"^POS-[A-Z0-9_-]+$">;

/**
 * Simple reference to plant operating states for a system
 */
export interface PlantOperatingStatesReference {
  /** List of plant operating states where this system is required */
  states: PlantOperatingStateReference[];

  /** Optional description of how the system's requirements vary across states */
  stateSpecificRequirements?: Record<PlantOperatingStateReference, string>;
}
```

This enables:

- Standardized referencing of plant operating states
- Documentation of system requirements across different operating states
- Implementation of SY-B14 requirements
- Clear traceability between systems and their operating state requirements

### Dependency Types

The schema defines various types of system dependencies:

```typescript
export enum DependencyType {
  /** Functional dependency (e.g., power, control, cooling) */
  FUNCTIONAL = "FUNCTIONAL",

  /** Spatial dependency (e.g., shared location) */
  SPATIAL = "SPATIAL",

  /** Environmental dependency (e.g., temperature, radiation) */
  ENVIRONMENTAL = "ENVIRONMENTAL",

  /** Human dependency (e.g., shared operator actions) */
  HUMAN = "HUMAN",

  /** Other dependencies not covered by the above */
  OTHER = "OTHER",
}
```

This enables comprehensive modeling of:

- Functional dependencies between systems
- Spatial dependencies in shared locations
- Environmental dependencies affecting multiple systems
- Human dependencies in shared operations
- Other types of dependencies not covered by the standard categories

### Common Cause Failure Modeling

The schema provides comprehensive support for modeling Common Cause Failures (CCF) through the enhanced `CommonCauseFailureGroup` interface:

```typescript
export interface CommonCauseFailureGroup extends Unique, Named {
  /** Description of the common cause failure group */
  description: string;

  /** Components affected by this CCF group */
  affectedComponents: string[];

  /** Systems affected by this CCF group */
  affectedSystems: SystemReference[];

  /** The common cause model used */
  modelType: "BETA_FACTOR" | "MGL" | "ALPHA_FACTOR" | "PHI_FACTOR" | string;

  /** Parameters of the CCF model */
  modelParameters?: Record<string, number>;

  /** Model-specific parameters based on the modelType */
  modelSpecificParameters?: {
    /** Beta factor model parameters */
    betaFactorParameters?: {
      beta: number;
      totalFailureProbability: number;
    };

    /** Multiple Greek Letter (MGL) model parameters */
    mglParameters?: {
      beta: number;
      gamma?: number;
      delta?: number;
      additionalFactors?: Record<string, number>;
      totalFailureProbability: number;
    };

    /** Alpha factor model parameters */
    alphaFactorParameters?: {
      alphaFactors: Record<string, number>;
      totalFailureProbability: number;
    };

    /** Phi factor model parameters */
    phiFactorParameters?: {
      phiFactors: Record<string, number>;
      totalFailureProbability: number;
    };
  };

  /** Defense mechanisms in place to prevent or mitigate CCF */
  defenseMechanisms?: string[];

  /** Shared cause factors that contribute to CCF potential */
  sharedCauseFactors?: {
    hardwareDesign?: boolean;
    manufacturer?: boolean;
    maintenance?: boolean;
    installation?: boolean;
    environment?: boolean;
    otherFactors?: string[];
  };

  /** Justification for why this CCF is or is not risk-significant */
  riskSignificanceJustification?: string;

  /** Supporting data sources for CCF parameters */
  dataSources?: {
    reference: string;
    description: string;
    dataType: "plant-specific" | "generic" | "expert-judgment";
  }[];

  /** Mapping to guide how this CCF group should be quantified */
  quantificationMapping?: {
    openPsaMapping?: {
      modelType: "beta-factor" | "MGL" | "alpha-factor" | "phi-factor";
      factorMappings?: Record<string, string>;
    };
  };
}
```

This enhanced interface supports:

- Four standard CCF models with specific parameter structures:
  - Beta Factor Model: Simple model with a single beta parameter
  - Multiple Greek Letter (MGL) Model: Hierarchical model with beta, gamma, delta parameters
  - Alpha Factor Model: Event-based parametric model with alpha factors by multiplicity
  - Phi Factor Model: Direct parameter specification model

- Documentation of defense mechanisms and shared cause factors
- Traceability of data sources and their types
- Mapping to quantification engine formats
- Implementation of SY-B4 requirements for CCF analysis

The integration with the quantification adapter enables seamless conversion between OpenPRA's internal CCF representation and external quantification engine formats, supporting consistent modeling and analysis of common cause failures across the PRA process.

### Repair Modeling

The schema includes comprehensive support for repair modeling:

```typescript
export interface SystemBasicEvent extends BasicEvent {
  /** Whether repair is modeled for this basic event */
  repairModeled?: boolean;

  /** Justification for modeling repair */
  repairJustification?: string;

  /** Mean time to repair, if repair is modeled */
  meanTimeToRepair?: number;
}
```

This enables:

- Explicit modeling of repair processes
- Documentation of repair modeling justification
- Quantification of repair times
- Implementation of SY-A31 requirements

### Resource Depletion

The schema includes detailed support for modeling resource depletion:

```typescript
export interface DepletionModel extends Unique {
  /** Type of resource being depleted */
  resourceType: "fuel" | "coolant" | "battery" | "other";

  /** Description of the resource */
  description?: string;

  /** Initial quantity available */
  initialQuantity: number;

  /** Rate at which the resource is consumed */
  consumptionRate: number;

  /** Units of measurement for consumption rate */
  units: string;

  /** Component or system using this resource */
  associatedSystem?: SystemReference;

  /** Whether depletion leads to immediate failure or degraded operation */
  depletionFailureMode?: string;

  /** Time required for resource recovery */
  recoveryTime?: number;
}
```

This enables modeling of:

- Various types of consumable resources
- Resource consumption rates
- System dependencies on resources
- Failure modes due to resource depletion
- Resource recovery processes

## Conclusion

The TypeScript schema for Systems Analysis has been validated against the "Supporting Requirements for Regulatory Compliance." The schema provides comprehensive interfaces and data structures that enable documentation of Systems Analysis in accordance with these requirements.

The schema provides comprehensive support for SY-C1 through SY-C3 requirements, with dedicated interfaces for process documentation, model uncertainty documentation, and pre-operational assumptions documentation, demonstrated through EBR-II specific examples.
