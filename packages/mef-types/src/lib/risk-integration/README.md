# Risk Integration Technical Element Module

## Overview

The Risk Integration (RI) technical element aggregates PRA outputs into plant‑level risk metrics and insights. It consumes sequence/family frequencies and importance from Event Sequence Quantification (ESQ) and consequence metrics from Radiological Consequence Analysis (RC), applies risk significance criteria, performs screening/aggregation, and produces integrated risk metrics with uncertainty and feedback. It aligns with RG 1.247 expectations (HLR‑RI‑A…D) for establishing criteria, calculating overall risk, identifying significant contributors, and documenting/feedback.

## Purpose

- Define and apply risk significance criteria to PRA elements (sequences, families, basics, systems, HFEs)
- Compute integrated risk metrics (e.g., CDF, LERF, application‑specific metrics) with uncertainty
- Identify significant contributors and screening dispositions with clear basis
- Provide feedback to upstream elements (ESQ, RC, systems/HRA via proxies) for model improvements
- Document methods, assumptions, thresholds, and acceptance criteria mapping

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            Risk Integration                                   │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Criteria & Screening         │  │ Inputs (via Proxies)                 │  │
│  │ - RiskSignificanceCriteria   │  │ - ESQ: RiskSignificantEventSequence  │  │
│  │ - RiskSignificanceEvaluation │  │ - RC : RiskSignificantConsequence    │  │
│  │ - ScreeningStatus/Criteria   │  │ - Mappings (Seq→Release Category)    │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Integration & Metrics        │  │ Contributors & Insights              │  │
│  │ - IntegratedRiskResults      │  │ - RiskContributor (importance, RAW)  │  │
│  │ - RiskMetric (value, unc.)   │  │ - SignificantContributor analyses    │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Documentation & Feedback     │  │ Dependency Hygiene                   │  │
│  │ - Process/peer review hooks  │  │ - Use ESQ/RC re‑exports; refs only   │  │
│  │ - Feedback to ESQ/RC         │  │ - String refs for upstream entities  │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- Risk significance criteria with absolute/relative thresholds and intended applications
- Evaluation records per element with basis and insights
- Integrated risk metrics with units and uncertainty; optional acceptance criteria mapping
- Clean inputs via ESQ and RC proxy types (no direct upstream dependencies)
- Significant contributor identification with FV/RAW/RRW/Birnbaum and screening status
- Feedback channels to ESQ/RC capturing insights and recommended changes

## Core Components

- `RiskSignificanceCriteria`, `RiskSignificanceEvaluation`
- `IntegratedRiskResults`, `RiskMetric`
- `RiskContributor` and significant contributor references
- Proxied input types: `RiskSignificantEventSequence` (ESQ) and `RiskSignificantConsequence` (RC)
- Mapping references: `EventSequenceReference`, `EventSequenceFamilyReference`, `ReleaseCategoryReference`, `SourceTermDefinitionReference`

## Integration with Other Technical Elements

| Element                       | Interaction                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| Event Sequence Quantification | Provides sequence/family frequencies, importance, and risk‑significant lists via proxy types |
| Radiological Consequence      | Provides consequence metrics and risk‑significant consequences via proxy types               |
| Mechanistic Source Term       | Referenced indirectly via RC (release categories, source term IDs)                           |
| Systems/HRA/Data              | Reflected indirectly through ESQ inputs (cut sets, HFEs, parameters)                         |

## Best Practices

- Use ESQ/RC re‑exports only; avoid direct upstream imports to preserve hierarchy
- Keep criteria explicit (metric, thresholds, justification, intended applications)
- Report both absolute and relative bases where applicable; state minimum reporting level
- Maintain clear screening status with rationale and traceability
- Surface actionable feedback to ESQ/RC when screening or metrics indicate modeling opportunities

## Regulatory Alignment (RG 1.247)

| Expectation / Requirement                  | Schema Support                                                        |
| ------------------------------------------ | --------------------------------------------------------------------- |
| HLR‑RI‑A (Criteria definition/application) | `RiskSignificanceCriteria`, `RiskSignificanceEvaluation`              |
| HLR‑RI‑B (Overall risk calculation)        | `IntegratedRiskResults`, `RiskMetric` with units/uncertainty          |
| HLR‑RI‑C (Identification of contributors)  | `RiskContributor`, importance metrics, screening status               |
| HLR‑RI‑D (Documentation/feedback)          | Documentation hooks in main interface and feedback channels to ESQ/RC |

## Usage Workflow

1. Define `RiskSignificanceCriteria` for target metrics (CDF, LERF, application‑specific)
2. Ingest ESQ and RC proxy inputs (risk‑significant sequences/consequences, mappings)
3. Aggregate to integrated metrics; compute uncertainty and compare to acceptance criteria
4. Apply criteria and produce `RiskSignificanceEvaluation` records; set screening statuses
5. Identify `RiskContributor`s and capture importance and insights
6. Provide feedback objects back to ESQ/RC; document process, assumptions, and peer review

## Example

See inline examples in `risk-integration.ts` for criteria, evaluations, and integrated metrics. Use ESQ/RCA proxy types for inputs (e.g., `RiskSignificantEventSequence`).

## Additional Resources

- Source: [risk-integration.ts](./risk-integration.ts)
- Regulatory documentation: [Risk Integration Documentation](./Risk%20Integration%20Documentation.md)
- Integration patterns: [integration-readme.md](./integration-readme.md)

## Glossary (Selected)

- Risk Metric: Quantified plant risk measure (e.g., CDF) with units/uncertainty
- Risk Significance: Determination of contributors exceeding criteria thresholds
- Screening: Dispositioning contributors (retain/group/truncate) with basis

---

This README summarizes the Risk Integration technical element and its RG 1.247 alignment, providing consistent interfaces and integration points within the OpenPRA MEF.
