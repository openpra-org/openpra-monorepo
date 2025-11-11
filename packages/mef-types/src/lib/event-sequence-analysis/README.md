# Event Sequence Analysis Technical Element Module

## Overview

The Event Sequence Analysis technical element provides structured representations for constructing, analyzing, grouping, quantifying, and integrating event sequences in a non-light-water reactor (NLWR) probabilistic risk assessment (PRA). It aligns with the expectations in RG 1.247 for modeling initiating event progression, success/failure of safety functions and systems, branching logic, grouping, uncertainty characterization, and traceability to success criteria and risk integration.

It bridges Initiating Event Analysis, Success Criteria, Systems, Human Reliability, Plant Operating States, Mechanistic Source Term, and Radiological Consequence elements—producing the event sequence families and quantified results that feed Risk Integration.

## Purpose

1. Represent plant response logic from initiating events through functional and system outcomes
2. Provide formal event trees and sequence structures with validation hooks
3. Capture intermediate and end states, transfers across trees, and multi-tree progression
4. Group raw sequences into families for significance screening and uncertainty treatment
5. Attach success criteria, importance measures, and screening dispositions
6. Enable mapping from sequences/families to release categories or consequence groupings
7. Preserve traceability to initiating events, plant operating states, systems, and data assumptions
8. Supply structured inputs for risk integration metrics and uncertainty aggregation

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Event Sequence Analysis                               │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  Foundations          │  │  Event Trees          │  │  Event Sequences   │  │
│  │                      │  │                      │  │                    │  │
│  │ - FunctionalEvent    │  │ - EventTree          │  │ - EventSequence    │  │
│  │ - SequenceStateType  │  │ - EventTreeBranch    │  │ - IntermediateState│  │
│  │ - EndStateCategory   │  │ - EventTreeSequence  │  │ - EndState         │  │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  Grouping & Families  │  │  Quantification       │  │  Integration Hooks │  │
│  │                      │  │                      │  │                    │  │
│  │ - EventSequenceFamily│  │ - SequenceQuantData  │  │ - Sequence→Release │  │
│  │ - Family Criteria    │  │ - ImportanceMeasures │  │   Category Mapping │  │
│  │ - Screening Status   │  │ - Uncertainty Fields │  │ - Risk Flags       │  │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │ Validation & Control  │ │ Documentation         │ │ Cross-Element Links │ │
│  │                      │ │                      │ │                      │ │
│  │ - EventSequenceValidationRules           │ - Assumptions            │ │
│  │ - validateEventTree.{structure,content,transfers}  │ - Design Info    │ │
│  │ - ScreeningCriteria & Significance Flags │ - Success Criteria Map   │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Event Tree Modeling**: `EventTree`, `EventTreeBranch`, and `EventTreeSequence` represent functional progression with branching logic and functional events.
- **Sequence Construction**: `EventSequence` captures ordered states, intermediate transfers, success criteria references, and end states.
- **End State Categorization**: Support for categorizing final outcomes (e.g., core damage surrogate, barrier breach states, release category precursors) feeding source term analysis.
- **Family Grouping**: `EventSequenceFamily` allows aggregation of similar sequences; supports importance, common attributes, and uncertainty treatment.
- **Quantification Data**: Frequency/probability fields, importance measures (Fussell-Vesely, RAW, RRW), truncation thresholds, and convergence metadata.
- **Uncertainty Representation**: Distribution-enabled frequency/conditional probability fields plus qualitative uncertainty notes per sequence/family.
- **Release Mapping**: Structured mapping from sequences/families to release categories or consequence groupings used in radiological consequence and risk integration modules.
- **Validation Utilities**: `validateEventTree` functions check structure, linking, transfers, and functional event ordering, reducing modeling defects.
- **Screening & Significance**: Screening criteria, significance flags, and rationale fields enable defensible exclusion or aggregation consistent with RG 1.247.
- **Traceability**: References to initiating events, plant operating states, success criteria, systems, and human actions for audit trail completeness.

## Core Components

- `EventSequenceAnalysis`: Root aggregate encompassing sequences, families, trees, mappings, and documentation metadata.
- `EventTree` / `EventTreeBranch` / `EventTreeSequence`: Hierarchical logic representation of functional progressions.
- `EventSequence`: Detailed sequence with states, timing, success criteria, quantification results, importance data, and uncertainty notes.
- `EventSequenceFamily`: Grouping container with characteristic definition and representative parameters.
- `EventSequenceValidationRules`: Declarative constraints for structural, content, and transfer integrity.
- `EventTreePath` & transfer constructs: Cross-tree or intra-tree progression semantics.
- `SequenceQuantData` (probability/frequency/importance) and risk flags for integration.
- Release category mapping interfaces bridging to consequence and risk integration elements.

## Integration with Other Technical Elements

| Element                   | Interaction                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Plant Operating States    | Sequences reference POS-specific initiating event applicability and success criteria contexts                 |
| Initiating Event Analysis | Each event tree and sequence anchors to an initiating event ID and maintains consistency checks               |
| Success Criteria          | Sequence stages and end states embed success criteria references driving system performance needs             |
| Systems Analysis          | Sequence logic implicitly evaluates system availability/failure outcomes referenced through functional events |
| Data Analysis             | Parameter sources (failure probabilities, human action reliabilities) feed conditional branch quantification  |
| Mechanistic Source Term   | End state categorization and barrier status feed release category assignment                                  |
| Radiological Consequence  | Release categories mapped from sequences supply input sets for dispersion/ consequence modeling               |
| Risk Integration          | Quantified sequence/family results and importance measures flow into aggregated risk metrics                  |

## Best Practices

### Event Tree Design

1. **Single Purpose Trees**: Keep initiating event scope focused; avoid overloading branches with unrelated phenomena.
2. **Functional Clarity**: Name branches by function outcome (e.g., "RCIC SUCCESS", "HPCI FAIL") not by ambiguous states.
3. **Ordering Discipline**: Order functional events chronologically or logically; document basis for ordering.
4. **Transfer Control**: Minimize cross-tree transfers; when needed, document rationale and ensure target existence via validation.

### Sequence Construction

1. **State Granularity**: Model only risk-significant functional branching; avoid excessive micro-states that add no insight.
2. **End State Categorization**: Align end states early with source term and consequence taxonomy to prevent rework.
3. **Success Criteria Mapping**: Keep `successCriteriaIds` synchronized with evolving success criteria models.
4. **Intermediate Transfers**: Use transfer fields sparingly; prefer explicit branching unless transfer semantics increase clarity.

### Grouping & Families

1. **Similarity Basis**: Group sequences with comparable initiating event, functional outcomes, and consequence-relevant attributes.
2. **Bounding Parameters**: Use most limiting member parameters when forming a representative family model.
3. **Sensitivity Verification**: Perform sensitivity runs to confirm grouping doesn’t mask dominant contributors.
4. **Transparent Justification**: Ensure `groupingJustification` captures functional, probabilistic, and consequence factors.

### Quantification & Uncertainty

1. **Consistent Truncation**: Document truncation thresholds and verify stability vs. lower thresholds.
2. **Importance Measures**: Capture multiple measures (FV, RAW, RRW) for cross-check in application contexts.
3. **Parameter Traceability**: Link each conditional probability to its data or model source (human reliability, system failure data, etc.).
4. **Uncertainty Notes**: Record key model uncertainties and alternative modeling assumptions for later risk importance re-evaluation.

### Validation & Configuration Control

1. **Automate Checks**: Run `validateEventTree` structure and content validation after each tree modification.
2. **No Orphan Entities**: Ensure every sequence-family link and tree reference resolves; treat unresolved references as build failures.
3. **Transfer Integrity**: Validate all transfer targets exist before committing changes.
4. **Version & Trace**: Maintain version metadata aligning with overall PRA configuration control.

## Regulatory Compliance Alignment (RG 1.247)

| RG 1.247 Expectation                                        | Schema Support                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Clear delineation of event sequences from initiating events | `EventTree` + `EventSequence` linking via initiatingEventId                       |
| Consistent functional progression and branching logic       | `EventTreeBranch` ordering + validation utilities                                 |
| Grouping / family formation with justification              | `EventSequenceFamily` (characteristics, justification, representative attributes) |
| Importance & risk-significance identification               | Importance measures fields & `isRiskSignificant` flags                            |
| Mapping to consequence / release categories                 | Sequence→Release category mapping interfaces                                      |
| Treatment of uncertainty and truncation rationale           | Quantitative fields + uncertainty notes & truncation metadata                     |
| Documentation of success criteria application               | `successCriteriaIds` and mapping sections                                         |
| Traceability & configuration control                        | Validation rules + structured references + version info in parent element         |

## Usage Workflow

1. Define initiating event scope and construct initial `EventTree` objects.
2. Populate branches and functional events with logical ordering.
3. Generate raw `EventSequence` objects from tree paths or modeling outputs.
4. Assign end states and map to preliminary release categories.
5. Group sequences into `EventSequenceFamily` objects with bounding characteristics.
6. Quantify sequence/family frequencies, conditional probabilities, and importance measures.
7. Record uncertainties, truncation thresholds, and sensitivity findings.
8. Validate structure/transfers and resolve any errors.
9. Export mapping artifacts to risk integration and consequence modules.

## Additional Resources

- [Event Sequence Analysis Source](./event-sequence-analysis.ts)
- Example: [Event Tree Example](./event-tree-example.ts)
- Detailed documentation: [Event Sequence Analysis Documentation](./event-sequence-analysis-documentation.md)
- POS Interaction: See `../plant-operating-states-analysis/README.md`
- Initiating Events: See `../initiating-event-analysis/README.md`
- Success Criteria Integration: (future module reference)

## Future Enhancements

- Automated generation of sequences from event tree traversal with pruning heuristics
- Graph-based visualization of branching and transfer topology
- Statistical stability checker for truncation threshold convergence
- Cross-module trace matrix: Sequence → Release Category → Risk Metric

## Glossary (Selected)

- **Event Tree**: Logical branching model representing progression after an initiating event.
- **Event Sequence**: Ordered realization of branch outcomes from an event tree (or across trees via transfers).
- **Sequence Family**: Grouping of similar sequences for significance and uncertainty management.
- **Truncation Threshold**: Probability/frequency cut-off below which sequences are not explicitly retained.
- **Importance Measures**: Metrics (Fussell-Vesely, RAW, RRW) indicating contribution or leverage to overall risk metrics.

---

This README provides a regulatory-aligned, integration-focused summary of the Event Sequence Analysis technical element consistent with other MEF technical element documentation.
