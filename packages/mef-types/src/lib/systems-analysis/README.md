# Systems Analysis Technical Element Module

## Overview

The Systems Analysis technical element models plant systems, functions, dependencies, failure modes, common-cause failures, and logic structures to support PRA applications. It aligns to RG 1.247 expectations for plant representation, system modeling, documentation, uncertainty treatment, and configuration control. This module provides structured types for system definitions, logic models, evaluations, and documentation mapped to the SY-C1 through SY-C3 supporting requirements.

## Purpose

1. Define system functions, boundaries, and configurations with traceable documentation
2. Model failures, dependencies, and environmental/spatial/human couplings impacting availability
3. Represent fault trees and related logic artifacts with validation, loops resolution, and cutsets
4. Capture evaluations, dominant contributors, and importance insights
5. Document process, uncertainties, alternatives, and pre-operational assumptions for peer review
6. Integrate with Data Analysis parameters, Success Criteria, Initiating Events, Event Sequences, and Plant Operating States

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                             Systems Analysis                                 │
│                                                                              │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌───────────────────┐ │
│  │  System Definition    │  │ Logic & Dependencies  │  │ Documentation     │ │
│  │                      │  │                       │  │                   │ │
│  │ - SystemDefinition   │  │ - SystemLogicModel    │  │ - ProcessDocumentation │
│  │ - Boundaries/Functions│ │ - FaultTree           │  │ - ModelUncertainty     │
│  │ - Env/Spatial Info   │  │ - SystemDependency    │  │ - PreOp Assumptions    │
│  └──────────────────────┘  └───────────────────────┘  └───────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌───────────────────┐ │
│  │  Evaluation & Results │  │ CCF & Special Topics  │  │ Integration Hooks │ │
│  │                      │  │                       │  │                   │ │
│  │ - SystemModelEvaluation│ │ - CommonCauseFailure │  │ - SuccessCriteria  │ │
│  │ - DominantContributors │ │ - Digital I&C        │  │ - DataAnalysis Ref │ │
│  │ - Sensitivity Studies  │ │ - Passive Systems    │  │ - POS/Sequences    │ │
│  └──────────────────────┘  └───────────────────────┘  └───────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- System definitions with functions, boundaries, schematics, and operability considerations
- Logic modeling (fault trees), nomenclature, and loop resolution documentation
- Rich dependency modeling (functional, spatial, environmental, human)
- CCF support with multiple standard models (beta, MGL, alpha, phi) and defense documentation
- Evaluation artifacts (top event probabilities, dominant contributors, sensitivity studies)
- Environmental design basis considerations and resource depletion models
- Tight integration with Data Analysis (parameter reuse), Success Criteria, POS, IE, and Event Sequences

## Core Components

- `SystemDefinition`: System description, boundaries, success criteria linkage, modeled components/failure modes, schematics, test/maintenance
- `SystemLogicModel` & `FaultTree`: Logic representation with nodes, minimal cut sets, and loop resolutions
- `SystemDependency` & `DependencySearchMethodology`: Identification and documentation of system couplings
- `CommonCauseFailureGroup`: CCF modeling with model-specific parameter blocks and defense/causal factors
- `SystemModelEvaluation`: Results, dominant contributors, and insights
- `SystemSensitivityStudy`: Structured sensitivity documentation
- `EnvironmentalDesignBasisConsideration`: SSCs potentially operating beyond design basis
- `TemplateInstanceRegistry` & change records: Template versioning and instance propagation
- Data integration fields: references to Data Analysis parameters and CCF data

See the schema source: [`systems-analysis.ts`](./systems-analysis.ts).

## Integration with Other Technical Elements

| Element                   | Interaction                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| Data Analysis             | Reuse of probability models, parameters, and CCF data via references             |
| Success Criteria          | System capacities and performance requirements trace to criteria and sequences   |
| Plant Operating States    | System requirements vary by POS; references document state-specific expectations |
| Initiating Event Analysis | System credit and actuation dependencies per initiating event                    |
| Event Sequence Analysis   | System availability contributes to sequence branching and end states             |
| Human Reliability         | System-required actions inform HRA contexts and PSFs                             |
| Risk Integration          | System evaluations and importance inform application comparisons                 |

## Best Practices

### Definition & Documentation

1. Maintain clear, versioned system function and boundary descriptions with references
2. Keep schematics and nomenclature synchronized with modeling artifacts
3. Record operability considerations and environmental constraints alongside modeling assumptions

### Modeling & Dependencies

1. Use explicit dependency search methodologies and retain tables as references
2. Resolve logic loops explicitly; document rationale and approach
3. Prefer reusable templates for repeated subsystem patterns; track changes and propagation

### Quantification & CCF

1. Choose CCF models appropriate to available data; document parameters and defenses
2. Report dominant contributors and top-event probabilities with truncation context
3. Perform sensitivity on key parameters and dependencies; record insights

### Integration & Traceability

1. Link system parameters and basic events to Data Analysis to avoid duplication
2. Keep success criteria references current and consistent with sequence models
3. Maintain POS-specific requirements and human action mappings

## Regulatory Compliance Alignment (RG 1.247)

| RG 1.247 Expectation                                                  | Schema Support                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Plant representation fidelity and configuration control               | Version info, operability considerations, documentation structures                                |
| Comprehensive system modeling (functions, failures, dependencies)     | `SystemDefinition`, `SystemLogicModel`, `FaultTree`, `SystemDependency`                           |
| CCF modeling and documentation                                        | `CommonCauseFailureGroup` with model-specific blocks and defenses                                 |
| Documentation of process, uncertainties, alternatives                 | `ProcessDocumentation`, `ModelUncertaintyDocumentation`, `PreOperationalAssumptionsDocumentation` |
| Special topics: digital I&C, passive systems, environmental beyond DB | Dedicated interfaces and documentation fields                                                     |
| Traceability to data, criteria, POS, IE, and sequences                | Cross-module references and IDs                                                                   |

## Usage Workflow

1. Define system with functions, boundaries, and schematics
2. Build logic model/fault tree; identify dependencies and resolve loops
3. Populate CCF groups and data references
4. Quantify, record top event and contributors; run sensitivity studies
5. Complete documentation and uncertainty/assumption registers
6. Link to criteria, POS, IE, and sequences; keep data references synchronized

## Additional Resources

- Detailed documentation: [Systems Analysis Documentation](./systems-analysis-documentation.md)
- Schema source: [systems-analysis.ts](./systems-analysis.ts)
- Related READMEs: POS, Initiating Event, Event Sequence, Success Criteria

## Glossary (Selected)

- **Fault Tree**: Logical model of system failure
- **CCF**: Common Cause Failure
- **Top Event**: System failure outcome of interest
- **POS**: Plant Operating State

---

This README provides a regulatory-aligned summary of the Systems Analysis technical element, consistent with the style used across MEF modules.
