# Plant Operating States Analysis Technical Element Module

## Overview

The Plant Operating States Analysis (POS) technical element defines, documents, and validates the discrete operating states and transitions of a non-light-water reactor (NLWR) consistent with Regulatory Guide (RG) 1.247 expectations. It provides the structural basis for mapping initiating events, safety functions, success criteria, and risk-significant contributors across the full plant operating cycle. POS delineation is foundational: all other PRA technical elements (initiating events, success criteria, systems, data, event sequence analysis, source term, consequence analysis, and risk integration) depend on accurate, mutually exclusive, and collectively exhaustive plant operating states.

## Purpose

The primary purposes of the POS technical element are:

1. Define discrete plant operating states with clear time/condition boundaries (mutually exclusive & collectively exhaustive)
2. Capture state-specific plant conditions affecting event sequence delineation and success criteria (decay heat, RCS configuration, inventory, pressure, temperature, barrier status)
3. Document transitions, evolution characteristics, and potential risk modifiers (fragility changes, barrier effectiveness shifts, pathway modifications)
4. Provide validated duration, frequency, and occurrence data for each POS (supports event sequence quantification & risk integration)
5. Support grouping & subsuming logic (with justification, conservatism, and sensitivity validation) where POS aggregation is acceptable
6. Ensure traceability of assumptions, model accuracy, and configuration control for plant representation across the operating cycle
7. Integrate importance and risk significance information at the POS level to guide application-specific decision-making

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      Plant Operating States Analysis                         │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────────┐  ┌──────────────────┐  │
│  │  Core Definitions    │  │  Evolutions & Transitions│  │ POS Instances   │  │
│  │                     │  │                         │  │                  │  │
│  │ - OperatingState    │  │ - PlantEvolution         │  │ - PlantOperatingState │
│  │ - BarrierStatus     │  │ - TransitionEvent        │  │ - RadioactiveSource   │
│  │ - ModuleState       │  │ - TimeVaryingCondition   │  │ - SafetyFunction      │  │
│  └─────────────────────┘  └─────────────────────────┘  └──────────────────┘  │
│                                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │  Grouping & Aggregation │  │  Frequency & Duration│  │ Validation & Acc │  │
│  │                         │  │                     │  │                  │  │
│  │ - PlantOperatingStatesGroup│ - OperatingStatesFrequencyDuration │ - POSValidationRules │ │
│  │ - SubsumedPOS           │  │ - Transition stability data │ - PlantRepresentationAccuracy │ │
│  └─────────────────────────┘  └─────────────────────┘  └──────────────────┘  │
│                                                                              │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐   │
│  │  Risk & Importance   │  │ Documentation & Config│  │ Integration Hooks │   │
│  │                      │  │                      │  │                   │   │
│  │ - OperatingStateRisk │  │ - PlantOperatingStatesDocumentation │ - successCriteriaIds │ │
│  │ - importanceMeasures │  │ - Assumptions & References │ - initiatingEvents      │ │
│  └──────────────────────┘  └─────────────────────┘  └────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Explicit Boundaries**: Each `PlantOperatingState` includes a `timeBoundary` with starting/ending conditions (supports POS-A/B requirements for mutual exclusivity & completeness).
- **Rich State Characterization**: Captures RCS parameters, decay heat removal systems, barrier statuses, instrumentation, initiating events, safety functions, and time-varying conditions.
- **Evolution Modeling**: `PlantEvolution` aggregates POSs within operational phases and documents changes in barrier effectiveness, SSC fragilities, and propagation pathways.
- **Transition Risk**: `TransitionEvent` structures frequency, duration, risks, required actions, and mitigating measures.
- **Grouping & Subsumption**: `PlantOperatingStatesGroup` and `SubsumedPOS` allow consolidation with documented justification, limiting characteristics, and optional sensitivity study reference.
- **Frequency & Duration Support**: `OperatingStatesFrequencyDuration` accumulates outage, maintenance, and operational history for POS duration and entry calculations.
- **Risk Significance & Importance**: Embeds POS-level risk characterizations and component importance measures (Fussell-Vesely, RAW, RRW) to support application criteria.
- **Validation Rules**: `POSValidationRules` enforce mutual exclusivity, collective exhaustivity, grouping defensibility, and operational cycle coverage.
- **Configuration Control & Accuracy**: Plant representation accuracy fields document confidence areas, limitations, and improvement plans for PRA model fidelity.

## Core Components

- `OperatingState` / `PlantOperatingState`: Discrete operating conditions with boundary, characterization, and risk metadata.
- `PlantEvolution`: Higher-level aggregation representing operational phases and transition conditions.
- `TransitionEvent`: Formal representation of movement between POSs with temporal and risk factors.
- `TimeVaryingCondition`: Captures intra-POS parameter evolution relevant to success criteria and source term evaluation.
- `PlantOperatingStatesGroup` / `SubsumedPOS`: Aggregation and consolidation mechanics with justification and conservatism controls.
- `OperatingStatesFrequencyDuration`: Empirical basis for duration, frequency, and number of entries calculations.
- `POSValidationRules`: Declarative validation expectations for exclusivity, completeness, grouping integrity, documentation sufficiency.
- `PlantOperatingStatesDocumentation`: Narrative, process description, and regulatory mapping container.
- `OperatingStateRisk` & `importanceMeasures`: Risk impact articulation for decision support and regulatory comparators.

## Integration with Other Technical Elements

- **Data Analysis**: Uses state-specific operating conditions to select/justify time periods, plant-specific data applicability, and parameter grouping assumptions.
- **Initiating Event Analysis**: POS definitions constrain applicable initiating events and their frequency modifiers.
- **Event Sequence Analysis**: Event sequence delineation depends on POS boundary definitions and available safety functions.
- **Success Criteria**: POS-specific plant conditions drive success criteria references (`successCriteriaIds`).
- **Systems Analysis**: System/SSC availability and fragility considerations vary across POSs and transitions.
- **Mechanistic Source Term & Radiological Consequence Analysis**: Radionuclide barrier status and time-varying conditions feed source term pathway modeling.
- **Risk Integration**: POS duration and risk significance contribute to integrated risk metric aggregation.

## Best Practices

### POS Definition

1. **Granularity Balance**: Define POSs fine enough to capture distinct risk-relevant condition changes, but avoid unnecessary fragmentation.
2. **Boundary Explicitness**: Use concrete plant conditions (e.g., "Begin rod withdrawal" / "Achieve criticality") for `startingCondition`/`endingCondition`.
3. **Parameter Coverage**: Include decay heat, pressure, temperature, inventory, barrier configurations, instrumentation, and safety function availability.
4. **Mutual Exclusivity Checks**: Maintain automated validation with `POSValidationRules` to prevent temporal overlap.

### Transition Modeling

1. **Capture Risk Modifiers**: Document barrier effectiveness changes, fragility shifts, and propagation pathway modifications during transitions.
2. **Frequency Justification**: Base transition frequency estimates on historical operational data or planned procedures.
3. **Mitigation & Actions**: Enumerate required human and equipment actions with associated procedure references.

### Grouping & Subsumption

1. **Conservatism Assurance**: Use the most limiting POS parameters when aggregating states.
2. **Sensitivity Support**: For grouped/subsumed POSs, perform sensitivity studies or bounding analyses to confirm no masking of risk-significant contributors.
3. **Transparent Justification**: Provide clear grouping and subsumption rationales in `groupingJustification` / `SubsumedPOS.justification`.

### Documentation & Traceability

1. **Identification Process Narrative**: Record selection criteria (e.g., decay heat thresholds, barrier status shifts) in `identificationProcessDetails`.
2. **Assumptions Register**: Centralize analysis assumptions per POS and per evolution for peer review clarity.
3. **Versioning**: Track schema version and plant configuration snapshot using `VersionInfo` integration.
4. **Risk Significance Recording**: Populate `OperatingStateRisk` with frequency-consequence contextualization for integration with application criteria.

### Integration Hooks

1. **Success Criteria Mapping**: Maintain consistent `successCriteriaIds` references so POS updates propagate to requirements analyses.
2. **Initiating Event Alignment**: Ensure `initiatingEvents` only include events permissible under documented plant conditions.
3. **Time-Varying Condition Management**: Use `TimeVaryingCondition` to surface intra-POS windows critical to source term modeling and human reliability context.

## Regulatory Compliance Alignment (RG 1.247)

This module maps to key POS-related expectations from RG 1.247:

| RG 1.247 Expectation                                                                                 | Schema Support                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POS definitions include all important conditions (decay heat, RCS config, barriers, instrumentation) | `PlantOperatingState` fields: `rcsParameters`, `decayHeatRemoval`, `radionuclideTransportBarrier`, `availableInstrumentation`, `timeVaryingConditions` |
| Mutual exclusivity & collective exhaustivity of POSs                                                 | `timeBoundary` + `POSValidationRules`                                                                                                                  |
| Duration & frequency determination for each POS                                                      | `OperatingStatesFrequencyDuration` with outage/maintenance/history records                                                                             |
| Transition consideration (risk modifiers, barrier changes)                                           | `PlantEvolution.evolutionConsiderations`, `TransitionEvent`, `hazardBarrierEffectivenessChanges`                                                       |
| Grouping/subsuming with justification & conservatism                                                 | `PlantOperatingStatesGroup`, `SubsumedPOS`                                                                                                             |
| Documentation of identification process & assumptions                                                | `PlantOperatingStatesDocumentation.identificationProcessDetails`, `assumptions`                                                                        |
| Plant representation accuracy tracking                                                               | `plantRepresentationAccuracy` embedded in POS                                                                                                          |
| Risk significance & importance measures                                                              | `riskSignificance`, `importanceMeasures`                                                                                                               |
| Integration with success criteria & initiating events                                                | `successCriteriaIds`, `initiatingEvents`                                                                                                               |

## Usage

Typical workflow:

1. Define plant evolutions and transitions (`PlantEvolution`, `TransitionEvent`).
2. Enumerate operating states with boundaries and characteristics (`PlantOperatingState`).
3. Populate frequency/duration records (`OperatingStatesFrequencyDuration`).
4. Apply validation rules (`POSValidationRules`).
5. Optionally group/subsume POSs with justification (`PlantOperatingStatesGroup`, `SubsumedPOS`).
6. Attach risk and importance measures for significant contributors.
7. Reference success criteria and initiating events.
8. Maintain documentation updates through `PlantOperatingStatesDocumentation`.

## Additional Resources

- [Plant Operating States Analysis Documentation](./plant-operating-states-analysis-documentation.md)
- [plant-operating-states-analysis.ts](./plant-operating-states-analysis.ts)
- Data Analysis linkage: See [Data Analysis Documentation](../data-analysis/data-analysis-documentation.md) for operating state data justification references.

## Future Enhancements (Optional)

- Automated overlap detection tooling (temporal and parameter-space conflicts)
- Visualization of operating cycle timeline and transition density
- Cross-element trace matrix generator (POS ↔ success criteria ↔ initiating events ↔ systems)

## Glossary (Selected)

- **POS**: Plant Operating State
- **RCS**: Reactor Coolant System
- **SSC**: Structures, Systems, and Components
- **RAW/RRW**: Risk Achievement/Reduction Worth
- **Fussell-Vesely**: Importance measure indicating fractional contribution to risk

---

This README provides a regulatory-aligned, integration-focused summary of the Plant Operating States Analysis technical element consistent with the style used for the Data Analysis module.
