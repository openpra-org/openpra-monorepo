# Success Criteria Development Technical Element Module

## Overview

The Success Criteria Development (SC) technical element defines the minimum requirements that must be met by functions, systems, components, and human actions to prevent or mitigate a release for each modeled initiating event and event sequence. It aligns with RG 1.247’s objective for the success criteria PRA element: to determine the minimum requirements for each function (and ultimately the systems/components performing those functions) under the plant conditions represented in each sequence and plant operating state (POS).

This module provides structured types to document success criteria at multiple levels (overall/event-sequence-family, system, component, human actions), their technical bases, and the process documentation, uncertainties, and pre-operational assumptions required for traceability and peer review.

## Purpose

1. Establish success requirements consistent with initiating event response and POS conditions
2. Trace success criteria to engineering analyses (thermal-hydraulic, structural, neutronics, radiation transport)
3. Capture system capacities, component performance requirements, and human action timing/feasibility
4. Document the process, model uncertainties, limitations, codes, and expert judgments used
5. Differentiate capability categories (e.g., realistic criteria for risk-significant sequences)
6. Provide structured inputs to Systems, HRA, Event Sequence Quantification, MST/RC, and Risk Integration

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Success Criteria Development                           │
│                                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐ │
│  │  Criteria Levels     │  │ Technical Bases & Docs   │  │ Integration Hooks│ │
│  │                     │  │                          │  │                  │ │
│  │ - OverallSuccess... │  │ - ProcessDocumentation   │  │ - POS references │ │
│  │ - SystemSuccess...  │  │ - ModelUncertaintyDoc    │  │ - IE references  │ │
│  │ - ComponentSuccess..│  │ - PreOperationalAssumps  │  │ - Sequence refs  │ │
│  │ - HumanActionSuccess│  │ - PeerReview & Trace     │  │ - SuccessCriteriaIds │
│  └─────────────────────┘  └──────────────────────────┘  └──────────────────┘ │
│                                                                              │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  Analysis Types      │  │  Quant & Importance  │  │  Config & Version  │  │
│  │ - TH, Structural     │  │ - CC category flags  │  │ - VersionInfo      │  │
│  │ - Neutronic, RadTrans│  │ - Significance flags │  │ - Traceability     │  │
│  └─────────────────────┘  └──────────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- Multiple levels of criteria: overall (sequence/family), system, component, and human action
- Engineering basis references and analysis-type classification (TH, structural, neutronic, radiation transport)
- System capacity and component performance requirements with basis
- Sequence, initiating event, and POS references for contextual applicability
- Capability category support (e.g., realistic criteria for risk-significant sequences)
- Process documentation (calculations, codes, limitations, expert judgment, grouped events treatment, digital, passive, shared systems)
- Model uncertainty and pre-operational assumption documentation
- Peer review and traceability structures

## Core Components

- `OverallSuccessCriteriaDefinition`: Overall criteria for an event sequence or family with key safety functions and end-state parameters
- `SystemSuccessCriteriaDefinition`: Required capacities and dependencies per system with analysis references
- `ComponentSuccessCriteriaDefinition`: Component performance requirements and system linkage
- `HumanActionSuccessCriteriaDefinition`: Action description, timing basis, feasibility, and dependencies
- `SuccessCriterion` base types for consistent naming, descriptions, and references
- Documentation types: `ProcessDocumentation`, `ModelUncertaintyDocumentation`, `PreOperationalAssumptionsDocumentation`, `PeerReviewDocumentation`, and `BaseTraceabilityDocumentation`
- `AnalysisType` enum: TH/STRUCTURAL/NEUTRONIC/RADIATION_TRANSPORT/OTHER

See the schema source for full definitions: [`success-criteria-development.ts`](./success-criteria-development.ts).

## Integration with Other Technical Elements

| Element                      | Interaction                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Plant Operating States       | Criteria reference POS conditions (decay heat, RCS config, barriers) to establish feasibility and minima |
| Initiating Event Analysis    | Criteria scope ties to specific initiating events and sequence families                                  |
| Event Sequence Analysis      | Overall/system/component criteria referenced by sequences; end-state parameters aligned                  |
| Systems Analysis             | Required capacities/performance inform system models and availability assumptions                        |
| Data Analysis                | Parameter sources (e.g., pump curves, valve performance, success thresholds) trace to data/analyses      |
| Human Reliability Analysis   | Human action criteria provide timing and context for HRA quantification                                  |
| Mechanistic Source Term / RC | Barrier protection criteria link to release category assumptions                                         |
| Risk Integration             | Criteria realism and significance flags inform capability categories and acceptance comparisons          |

## Best Practices

### Criteria Development

1. Align criteria with the most limiting POS and sequence conditions; record basis and conservatism
2. Use analysis-type tagging and cite calculations/codes with versions and limitations
3. Maintain direct references to sequences, initiating events, and POSs for traceability

### System & Component Requirements

1. Quantify required capacities/performance with clear units and acceptance bands
2. Capture inter-system dependencies and functional success pathways
3. Keep criteria synchronized with system/failure modeling and success criteria IDs

### Human Actions

1. Document timing windows, cues, procedures, and feasibility constraints
2. Coordinate with HRA for dependency and performance shaping factors
3. Validate consistency with POS instrumentation availability and access

### Documentation & Reviews

1. Populate process documentation (SC-C1 a–k): end-state definitions, calculations, codes, limitations, expert judgment, mitigating systems, human action timing basis, grouped events, digital systems, passive safety, shared systems
2. Record model uncertainties (SC-C2) and pre-operational assumptions (SC-C3)
3. Track peer review findings and traceability with versioned references

## Regulatory Compliance Alignment (RG 1.247)

| RG 1.247 Expectation                                                      | Schema Support                                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Determine minimum requirements per function/system/component              | `Overall/System/ComponentSuccessCriteriaDefinition` with capacities and performance             |
| Realistic criteria for risk-significant sequences (capability categories) | `usesRealisticCriteria`, `isRiskSignificant` flags                                              |
| Engineering basis, calculations, and codes documented                     | `ProcessDocumentation` (SC-C1 b–d)                                                              |
| Treatment of expert judgment                                              | `ProcessDocumentation.expertJudgmentUse` (SC-C1 e)                                              |
| Human action timing basis                                                 | `ProcessDocumentation.humanActionTimingBasis` (SC-C1 g); `HumanActionSuccessCriteriaDefinition` |
| Grouped events treatment and bounding                                     | `ProcessDocumentation.groupedEventsCriteria` (SC-C1 h)                                          |
| Digital and passive safety considerations                                 | `ProcessDocumentation.digitalSystemsCriteria`, `passiveSafetyCriteria` (SC-C1 i–j)              |
| Shared systems treatment                                                  | `ProcessDocumentation.sharedSystemsCriteria` (SC-C1 k)                                          |
| Model uncertainty and pre-operational assumptions                         | `ModelUncertaintyDocumentation` (SC-C2), `PreOperationalAssumptionsDocumentation` (SC-C3)       |
| Traceability and peer review                                              | `BaseTraceabilityDocumentation`, `PeerReviewDocumentation`                                      |

## Usage Workflow

1. Define overall criteria per event sequence/family with key safety functions and end-state parameters
2. Derive system capacities and component performance requirements from analyses; link references
3. Specify human action success criteria and timing basis
4. Complete process documentation (SC-C1 a–k), uncertainty (SC-C2), and pre-op assumptions (SC-C3)
5. Link criteria to sequences, initiating events, and POSs; update success criteria IDs in referencing modules
6. Review and iterate with Systems, HRA, and Event Sequence teams; update documentation and traceability

## Additional Resources

- Detailed documentation: [Success Criteria Development Documentation](./success-criteria-development-documentation.md)
- Schema source: [success-criteria-development.ts](./success-criteria-development.ts)
- Related: Event Sequence [README](../event-sequence-analysis/README.md), POS [README](../plant-operating-states-analysis/README.md)

## Glossary (Selected)

- **Success Criteria**: Minimum requirements for preventing or mitigating a release in a sequence context
- **Capability Category**: Quality level expectations (e.g., realism for risk-significant sequences)
- **TH/Neutronic/Structural/Rad-Transport**: Major analysis types used to derive criteria

---

This README provides a regulatory-aligned summary of the Success Criteria Development technical element consistent with the style used across MEF modules.
