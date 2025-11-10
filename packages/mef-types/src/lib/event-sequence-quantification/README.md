# Event Sequence Quantification Technical Element Module

## Overview

The Event Sequence Quantification (ESQ) technical element produces defensible frequency estimates for event sequences and sequence families, treating dependencies, truncation, logical challenges, uncertainty, and importance measures in alignment with RG 1.247. It serves as the bridge between modeled event sequences and downstream risk integration, mechanistic source term, and consequence evaluations by providing traceable, uncertainty-aware, and application-ready results.

It complements Event Sequence Analysis by focusing on the quantification workflow, convergence demonstrations, dependency treatment (functional, physical, human, phenomenological, and common cause), recovery actions, mutually exclusive events, circular logic resolution, and barrier treatment.

## Purpose

- Quantify individual event sequences and grouped sequence families with uncertainty characterization
- Demonstrate truncation convergence and document method/code verification/validation
- Treat dependencies and recovery actions consistently with upstream technical elements
- Identify risk-significant contributors via importance measures (FV, RAW, RRW, Birnbaum)
- Provide barrier treatment information and mappings needed by source term and consequence modules
- Produce structured documentation and traceability to support regulatory reviews (HLR-ESQ-A...F)

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Event Sequence Quantification                          │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  Families             │  │  Results              │  │  Methods           │  │
│  │                      │  │                      │  │                    │  │
│  │ - EventSequenceFamily│  │ - FrequencyEstimate  │  │ - Approach         │  │
│  │   Quantification     │  │ - CutSet Usage/Summary│ │ - Computer Codes   │  │
│  │ - Representative     │  │ - Confidence Intv.   │  │ - Truncation/Conv. │  │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │ Dependencies & Logic  │ │ Uncertainty & Import.│ │ Documentation       │  │
│  │                      │ │                      │ │                    │  │
│  │ - DependencyRepresentation            │ - EventQuantUncertainty   │ │
│  │ - System Success Treatment            │ - ImportanceAnalysis      │ │
│  │ - Circular Logic & Mut. Exclusive     │ - Sensitivity             │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                           │
│  │ Barriers & Survivab. │  │ Integration Hooks    │                           │
│  │ - RadionuclideBarrier│  │ - RiskIntegrationInfo│                           │
│  │ - EquipmentSurviv.   │  │ - MST References     │                           │
│  └──────────────────────┘  └──────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- Sequence and family frequency estimates with uncertainty distributions and confidence intervals
- Convergence/truncation documentation and stability checks across thresholds
- Explicit handling of circular logic, mutually exclusive events, flag events, and modeled successes
- Comprehensive dependency treatment (functional, physical/spatial, human, CCF, phenomenological)
- Recovery action modeling and post-initiator HFE dependency handling
- Barrier treatment and equipment survivability hooks to support source term integration
- Importance analysis (FV, RAW, RRW, Birnbaum) and risk-significance identification
- Review and comparison documentation to similar plants where applicable

## Core Components

- `EventSequenceQuantification`: Root aggregate for ESQ results, methods, dependencies, uncertainty, and documentation
- `EventSequenceFamilyQuantification`: Grouping, representative selection basis, member tracking
- `EventSequenceFrequencyEstimate`: Mean frequency, distribution, intervals, cut sets, truncation criteria
- `ConvergenceAnalysis`: Truncation progression, percent change, selection basis, convergence demonstration
- `DependencyRepresentation`: Functional/physical/human/phenomenological/CCF handling and examples
- `SystemSuccessTreatment`, `CircularLogic`, `MutuallyExclusiveEvents`, `FlagEvent`
- `EventQuantUncertaintyAnalysis`: Parameter distributions, correlations, state‑of‑knowledge correlation handling
- `ImportanceAnalysis`: Scope, metrics, significance thresholds, drivers
- `RadionuclideBarrierTreatment`, `EquipmentSurvivabilityAssessment`
- Documentation bundle: `EventSequenceQuantificationDocumentation` (F1), `...UncertaintyDocumentation` (F3), `...LimitationsDocumentation` (F4), `...PreOperationalDocumentation` (F5), `...PeerReviewDocumentation`

## Integration with Other Technical Elements

| Element                 | Interaction                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| Event Sequence Analysis | Consumes sequence/family definitions and states; returns quantified results |
| Systems Analysis        | Uses fault tree top events/cut sets; dependency and success modeling basis  |
| Human Reliability       | Post-initiator HFE probabilities and dependency treatment                   |
| Data Analysis           | Supplies distributions/parameters for basic events and correlations         |
| Mechanistic Source Term | Uses barrier treatment, barrier states, and sequence/family frequencies     |
| Risk Integration        | Consumes risk-significant sequences/families and importance measures        |
| Plant Operating States  | Context for applicability and plant response representation                 |

## Best Practices

- Convergence: Demonstrate stability using ≥3 truncation levels; document percentage changes and basis for final value
- Dependencies: Capture examples and basis per dependency type; align with HRA dependency assessments and CCF model selections
- Logical Challenges: Resolve circular logic with clearly stated method and impacts; eliminate or justify mutually exclusive combinations
- Recovery Actions: Model timing/availability realistically; document basis and dependencies
- Uncertainty: Propagate key parameter uncertainties; treat state‑of‑knowledge correlation or provide justification
- Importance: Report multiple metrics (FV, RAW, RRW) and maintain a transparent significance cutoff and rationale
- Traceability: Maintain references for cut sets, parameter sources, and documentation artifacts used in quantification

## Regulatory Compliance Alignment (RG 1.247)

| Expectation / Requirement                   | Schema Support                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| HLR‑ESQ‑A (Quantification Objectives)       | `EventSequenceFrequencyEstimate`, `quantificationResults`, `eventSequenceFamilies`                  |
| HLR‑ESQ‑B (Methods & Truncation)            | `QuantificationApproach`, `ConvergenceAnalysis`, `computerCodes` (V&V refs)                         |
| HLR‑ESQ‑C (Dependencies & Integration)      | `DependencyRepresentation`, `ModelIntegration`, `SystemSuccessTreatment`                            |
| HLR‑ESQ‑D (Review, Importance, Results Use) | `ImportanceAnalysis`, `QuantificationReviewProcess`, results summaries                              |
| HLR‑ESQ‑E (Uncertainty)                     | `EventQuantUncertaintyAnalysis` with SOK correlation fields                                         |
| HLR‑ESQ‑F (Documentation)                   | `EventSequenceQuantificationDocumentation` and F3/F4/F5/peer review interfaces                      |
| ESQ‑B1 (Approach, code V&V)                 | `quantificationMethods.approach`, `computerCodes.verificationDocumentation/validationDocumentation` |
| ESQ‑B3/B4 (Truncation & Convergence)        | `ConvergenceAnalysis` progression and selection basis                                               |
| ESQ‑B5 (Circular logic)                     | `logicalChallenges.circularLogic` with resolution and impact                                        |
| ESQ‑B6 (System successes)                   | `logicalChallenges.systemSuccessTreatment`                                                          |
| ESQ‑B7/B8 (Mutually exclusive)              | `logicalChallenges.mutuallyExclusiveEvents` with treatment/justification                            |
| ESQ‑C1/C2 (HFE dependencies)                | `DependencyRepresentation.humanFailureEventDependencies` and `postInitiatorHFEDependencies`         |
| ESQ‑C5 (Barrier treatment)                  | `RadionuclideBarrierTreatment` and barrier failure probabilities                                    |
| ESQ‑C8 (Equipment survivability)            | `EquipmentSurvivabilityAssessment`                                                                  |
| ESQ‑A2 (Model integration)                  | `ModelIntegration`                                                                                  |
| ESQ‑A3 (Barrier probabilities/capabilities) | `RadionuclideBarrierTreatment.barrierFailureProbabilities/capabilityEvaluation`                     |
| ESQ‑A5 (State‑of‑knowledge correlation)     | `EventQuantUncertaintyAnalysis.stateOfKnowledgeCorrelation`                                         |
| ESQ‑A7 (Recovery actions)                   | `quantificationMethods.recoveryActionTreatment` and `postInitiatorHFEHandling`                      |

## Usage Workflow

1. Import or generate event sequences/families from Event Sequence Analysis
2. Configure quantification approach, codes, and truncation progression; verify code V&V references
3. Quantify sequences/families; capture cut set usage, truncation criteria, and convergence demonstration
4. Treat dependencies (HFE, CCF, phenomenological) and resolve circular logic/mutually exclusive events
5. Propagate parameter uncertainties; address SOK correlation; perform sensitivity studies
6. Compute importance measures and identify risk-significant contributors
7. Populate documentation (F1/F3/F4/F5), review findings, and peer review metadata
8. Provide barrier treatment and survivability mappings for source term; expose `riskIntegrationInfo`

## Example

See `example-event-sequence-quantification.ts` for a complete, EBR‑II‑styled example demonstrating families, results, truncation convergence, dependency treatment, uncertainty propagation, and importance analysis.

## Additional Resources

- Source: `./event-sequence-quantification.ts`
- Regulatory documentation: `./Event Sequence Quantification.md`
- References/types for downstream consumers: `./references.ts`
- Related: `../event-sequence-analysis/README.md`, `../systems-analysis/README.md`, `../shared-types` where applicable

## Glossary (Selected)

- Convergence/Truncation: Process and threshold selection to ensure stable frequency estimates
- State‑of‑Knowledge Correlation: Correlation stemming from shared epistemic uncertainty across parameters
- Importance Measures: Metrics (Fussell‑Vesely, RAW, RRW, Birnbaum) to identify contributors and leverage points
- Mutually Exclusive Events: Combinations that cannot occur together; must be removed or consistently treated
- Circular Logic: Feedback/looping in logic resolved by explicit methods (e.g., split fractions, transfer gates)

---

This README summarizes the Event Sequence Quantification technical element and how the schema supports RG 1.247 expectations, providing a consistent, integration‑ready interface within the OpenPRA MEF.
