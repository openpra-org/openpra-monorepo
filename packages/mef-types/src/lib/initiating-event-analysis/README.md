# Initiating Event Analysis Technical Element Module

## Overview

The Initiating Event (IE) Analysis technical element defines, classifies, groups, and documents initiating events for the NLWR PRA consistent with RG 1.247 expectations. Initiating events perturb steady-state operation, challenge plant control and safety systems, and may lead to plant damage states and source terms. This element provides traceability from identification methods to categorization, grouping, frequency derivation, uncertainty characterization, screening decisions, and linkage to plant operating states, safety functions, and success criteria.

## Purpose

1. Systematically identify the universe of plausible initiating events (internal, external, transients, barrier failures, human-induced)
2. Classify events into consensus categories supporting completeness and coverage (per IE-A5 / RG taxonomy)
3. Establish and document screening bases and grouping logic (bounding / shared mitigation)
4. Derive and justify event frequencies with uncertainty, data provenance, exclusions, and surrogate use
5. Associate initiating events with applicable Plant Operating States (POS) and challenged safety functions
6. Capture risk importance (importance measures, qualitative insights) for prioritization
7. Provide documentation structures enabling peer review, configuration control, and regulatory transparency

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Initiating Event Analysis                             │
│                                                                              │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ Identification      │  │ Event Definitions    │  │ Grouping & Screening │  │
│  │                    │  │                      │  │                      │  │
│  │ - MasterLogicDiagram│ │ - ExtendedInitiatingEvent│ - InitiatingEventGroup│ │
│  │ - HazardBasedFT     │ │ - InitiatorDefinition │  │ - ScreeningCriteria   │ │
│  │ - FMEA / Structured │ │ - SupportingAnalyses  │  │ - ScreeningStatus     │ │
│  └────────────────────┘  └──────────────────────┘  └──────────────────────┘  │
│                                                                              │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ POS & Functions     │ │ Frequency & Uncertainty│ │ Documentation & Peer │ │
│  │                     │ │                       │ │ Review               │ │
│  │ - PlantOperatingStateRef│ - FrequencyQuantification │ - InitiatingEventDocumentation │ │
│  │ - SafetyFunctionRef │ │ - Uncertainty models   │ │ - PreOperationalAssumptions    │ │
│  │ - SuccessCriteriaIds│ │ - BayesianUpdate       │ │ - PeerReviewDocumentation       │ │
│  └────────────────────┘  └──────────────────────┘  └──────────────────────┘  │
│                                                                              │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ Importance & Risk   │ │ Validation & Completeness│ Configuration & Version│ │
│  │ - ImportanceLevel   │ │ - validateCompleteness  │ │ - VersionInfo / metadata │ │
│  │ - SensitivityStudy  │ │ - validateScreening     │ │ - Assumptions / Limitations│ │
│  │ - Risk insights     │ │ - Peer review findings  │ │ - Traceability structures  │ │
│  └────────────────────┘  └──────────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Systematic Identification**: Multiple method interfaces (MLD, HBFT, FMEA) capture search breadth, assumptions, and outputs.
- **Comprehensive Categorization**: `InitiatingEventCategory` ensures coverage of transient, barrier breach, internal/external hazard, human failure, and special classes.
- **State Mapping**: Direct linkage to POS via `applicableStates` and success criteria via `successCriteriaIds`.
- **Grouping Mechanics**: `InitiatingEventGroup` consolidates similar mitigation / challenge profiles with bounding initiator tracking.
- **Screening Discipline**: Central `ScreeningCriteria` plus per-event `screeningBasis` and `screeningStatus` with justification.
- **Frequency Derivation**: Structured `InitiatingEventQuantification` supports parameterized models, data exclusion rationale, and fault tree references.
- **Uncertainty Modeling**: Integration of `Uncertainty`, importance measures, and sensitivity studies for decision robustness.
- **Peer Review & Pre-Operational Support**: Dedicated interfaces for assumptions, limitations, and evolving design context (IE-D3 alignment).
- **Automated Validation**: Helper validators enforce category completeness, screening documentation, and peer review sufficiency.

## Core Components

- `ExtendedInitiatingEvent`: Augments base initiating event with category, applicability, uncertainty, grouping, screening, and importance metadata.
- `InitiatorDefinition`: Detailed initiator representation with supporting analyses and state/safety function mapping.
- `InitiatingEventGroup`: Group configuration (members, bounding initiator, challenged functions, shared mitigation).
- `ScreeningCriteria`: Global screening basis (frequency, damage frequency thresholds, justification, screened events list).
- `InitiatingEventQuantification`: Event frequency derivation, supporting models, exclusions, external data use, sensitivity studies.
- `InitiatingEventDocumentation`: High-level process narrative, input sources, methods, results summary.
- `PreOperationalAssumptions`: Design maturity placeholders with validation plans.
- `PeerReviewDocumentation`: Findings, resolutions, methodology scope, report traceability.
- `FrequencyQuantification` / `BayesianUpdate` / `Uncertainty`: Data analysis integration.

## Integration with Other Technical Elements

- **Plant Operating States**: Determines applicability (`applicableStates`) and conditional frequency modifiers.
- **Data Analysis**: Supplies parameter estimates, uncertainty distributions, and Bayesian updates for frequency modeling.
- **Systems Analysis**: Failure mode definitions (e.g., interface system breaches) feed initiator logic and grouping.
- **Success Criteria**: Initiators challenge specific functions; success criteria IDs referenced for linkage to mitigation requirements.
- **Event Sequence Analysis**: Initiating event spectrum drives sequence construction and branching logic.
- **Risk Integration**: Importance measures and frequency outputs feed overall risk metrics aggregation.

## Best Practices

### Identification

1. **Multi-Method Triangulation**: Apply at least two identification methods (e.g., MLD + FMEA) to reduce omission risk.
2. **Explicit Scope Boundaries**: Document excluded systems/components and justify scope boundaries in process narrative.
3. **Barrier Failure Enumeration**: Systematically list RCB and interfacing system breach mechanisms; trace each to plant conditions.

### Grouping & Screening

1. **Bounding Case Confirmation**: For each group, record the bounding initiator basis (frequency × consequence potential).
2. **Screening Justification Rigor**: Tie screening to explicit criteria (thresholds, physical impossibility, conservatism) and sensitivity evidence.
3. **Avoid Over-Aggregation**: Split groups where mitigation or success criteria diverge materially.

### Frequency & Uncertainty

1. **Transparent Data Lineage**: For each frequency, cite data source(s), exclusions, and transformations.
2. **Model Diversity**: Use alternative models (e.g., empirical vs. Bayesian) in sensitivity studies for high-impact events.
3. **Parameter Correlation Awareness**: Identify shared cause correlations affecting multiple initiators.

### Documentation & Review

1. **Living Assumptions Log**: Update `PreOperationalAssumptions` as design matures; retire or convert to validated basis.
2. **Peer Review Closure Tracking**: Maintain status to CLOSED/OPEN with resolution evidence for each finding.
3. **Completeness Audits**: Periodically run `validateCompleteness` after model changes (e.g., added POS or system redesign).

## Regulatory Compliance Alignment (RG 1.247 / IE-D Requirements)

| Requirement Focus                                            | Schema Support                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Identification completeness across required categories       | `InitiatingEventCategory`, `validateCompleteness`                                                                |
| Systematic search methods & documentation                    | `MasterLogicDiagram`, `HazardBasedFaultTree`, FMEA interfaces, `InitiatingEventDocumentation.processDescription` |
| Plant operating state applicability                          | `applicableStates`, `PlantOperatingStateReference`                                                               |
| Screening basis & justification                              | `ScreeningCriteria`, `ExtendedInitiatingEvent.screeningBasis`, `screeningStatus`                                 |
| Grouping with bounding initiator & mitigation commonality    | `InitiatingEventGroup.bounding_initiator_id`, `grouping_basis`                                                   |
| Frequency derivation with uncertainty & exclusions           | `InitiatingEventQuantification`, `Uncertainty`, `data_exclusion_justification`                                   |
| Use of external / other reactor data justification           | `other_reactor_data_justification` field                                                                         |
| Documentation of assumptions & limitations (pre-operational) | `PreOperationalAssumptions`, `assumptions`, `limitations`                                                        |
| Peer review traceability                                     | `PeerReviewDocumentation.findings`, `reportReference`                                                            |
| Linkage to success criteria & safety functions               | `SuccessCriteriaId`, challenged functions in groups                                                              |

## Usage Workflow

1. Enumerate systems, boundaries, and initial hazard set.
2. Apply identification methods (MLD, hazard-based FT, FMEA) and consolidate candidate initiators.
3. Categorize initiators; map to POS, safety functions, and success criteria.
4. Define screening criteria and apply—document basis per event.
5. Group initiators with shared mitigation; select bounding cases.
6. Quantify frequencies with uncertainty; perform sensitivity and importance analyses.
7. Populate documentation: process, assumptions, peer review, external data use.
8. Run validation helpers (completeness, screening, peer review checks).
9. Integrate outputs into event sequence and risk integration elements.

## Additional Resources

- [Initiating Event Analysis Detailed Documentation](./initiating-event-analysis-documentation.md)
- Schema Types: `initiating-event-analysis.ts`
- Plant Operating State Linkage: [Plant Operating States Analysis Documentation](../plant-operating-states-analysis/plant-operating-states-analysis-documentation.md)
- Data Foundations: [Data Analysis Documentation](../data-analysis/data-analysis-documentation.md)

## Future Enhancements

- Automated hazard-to-initiator trace matrix generation
- Dynamic completeness diagnostic (category coverage heatmap)
- Correlated parameter Monte Carlo engine for joint initiator frequency scenarios
- Visualization of initiator grouping and screening decisions

## Glossary

- **Initiating Event (IE)**: A perturbation that challenges plant safety/control systems.
- **POS**: Plant Operating State.
- **Bounding Initiator**: Representative event in a group providing conservative or limiting risk characterization.
- **Screening Criteria**: Defined thresholds or rationale eliminating negligible contributors.
- **Importance Measures**: Metrics (e.g., FV, RAW) ranking contributors to aggregate risk.

---

This README summarizes the Initiating Event Analysis technical element in alignment with RG 1.247 and mirrors the concise, structured style used for other MEF technical element READMEs.
