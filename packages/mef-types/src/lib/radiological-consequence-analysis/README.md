# Radiological Consequence Analysis Technical Element Module

## Overview

The Radiological Consequence (RC) technical element quantifies off‑site consequences from postulated releases, using site/meteorology, atmospheric transport and dispersion, dosimetry models, and consequence metrics. It aligns with RG 1.247 expectations across RCRE (release category to consequence), RCAD (atmospheric dispersion), RCDO (dosimetry), RCQ (consequence quantification), RCPA (protective actions/site data), and RCME (meteorology), with structured documentation, uncertainty characterization, and risk‑integration hooks.

RC consumes release categories and source terms from Mechanistic Source Term (MS) and returns consequence metrics mapped for Risk Integration.

## Purpose

- Translate release categories and source terms into consequence metrics for individuals and populations
- Document models/codes, limitations, and uncertainty treatment; perform sensitivity analyses
- Account for meteorology, terrain, plume rise, wake/terrain/deposition effects, and protective actions
- Provide traceable, auditable inputs to Risk Integration with explicit metric mapping

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 Radiological Consequence Analysis (RC)                       │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Release→Consequence (RCRE)   │  │ Atmospheric Dispersion (RCAD)       │  │
│  │ - ReleaseCategoryToConseq    │  │ - AtmosphericDispersionAnalysis     │  │
│  │ - BoundingSite               │  │ - Plume Rise / Wake / Terrain       │  │
│  │ - Inputs & Characteristics   │  │ - Deposition & Model Limits         │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Dosimetry (RCDO)             │  │ Consequence Quantification (RCQ)    │  │
│  │ - DosimetryAnalysis          │  │ - ConsequenceQuantificationAnalysis │  │
│  │ - Pathways / DCFs / Uncert.  │  │ - Metrics, Codes, Results          │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Protective Actions (RCPA)    │  │ Meteorology (RCME)                  │  │
│  │ - ProtectiveActionAnalysis   │  │ - MeteorologicalDataAnalysis        │  │
│  │ - Evac/Shelter/Relocation    │  │ - Data Sets, Distributions         │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Documentation & Risk Hooks   │  │ Integration                         │  │
│  │ - RadiologicalConsequenceDoc │  │ - riskIntegrationInfo / Description │  │
│  │ - Model Uncertainty/Peer Rev │  │ - Mapping to Risk Metrics           │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- Release category to consequence linkage with bounding site context and inputs
- Atmospheric dispersion with plume rise, building wake, terrain, and deposition considerations
- Dosimetry pathways, DCF sources and uncertainties, shielding/occupancy factors
- Consequence quantification with selected metrics, codes, model limitations, and uncertainty notes
- Meteorology ingestion and treatment of distributions and temporal change
- Protective action parameters for evacuation/shelter/relocation and timing effects
- Risk integration mapping from consequence metrics to risk metrics; feedback fields
- Documentation bundle with process, assumptions, sensitivity studies, and peer review

## Core Components

- `RadiologicalConsequenceAnalysis`: Root aggregate (RC technical element)
- RCRE: `ReleaseCategoryToConsequenceAnalysis`, `BoundingSite`, inputs and characteristics
- RCAD: `AtmosphericDispersionAnalysis` (plume rise, wake, terrain, deposition, limits)
- RCDO: `DosimetryAnalysis` (pathways, DCF sources, uncertainties, shielding/occupancy)
- RCQ: `ConsequenceQuantificationAnalysis` (metrics, codes, results, uncertainty, risk mapping)
- RCME: `MeteorologicalDataAnalysis` (datasets, parameter distributions, temporal resolution)
- RCPA: `ProtectiveActionAnalysis` (parameters affecting consequences and timing)
- Documentation & risk: `RadiologicalConsequenceDocumentation`, `riskIntegrationInfo`, `riskIntegrationDescription`

## Integration with Other Technical Elements

| Element                       | Interaction                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Mechanistic Source Term       | Consumes `ReleaseCategoryReference` and `SourceTermDefinitionReference` for consequence calculations |
| Event Sequence Quantification | Uses sequence families via MS mapping; risk significance may be echoed in results                    |
| Risk Integration              | Consumes consequence metrics; uses `riskMetricMapping` and `riskIntegrationInfo`; provides feedback  |
| Data Analysis                 | Supports distributions for DCFs, meteorology parameters, and uncertainty propagation                 |

## Best Practices

- Clearly state consequence metrics and maintain a mapping to risk metrics with any transformations
- Document plume rise, building wake, terrain, and deposition approaches with justifications and limits
- Capture DCF sources and uncertainties; include shielding and occupancy realism consistent with application
- Treat meteorology with sufficient temporal resolution and frequency distribution handling
- Record protective action timing assumptions and sensitivity; show impact on early/latent health metrics
- Provide uncertainty/sensitivity documentation and peer review findings with dispositions

## Regulatory Compliance Alignment (RG 1.247)

| Expectation / Requirement                         | Schema Support                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| RCRE‑A/B (scope and bounding)                     | `BoundingSite`, inputs/characteristics, selection/bounding justification                               |
| RCAD‑A/C/F (dispersion, phenomena, documentation) | `AtmosphericDispersionAnalysis` fields for model choice, plume rise, wake, terrain, deposition, limits |
| RCDO‑A/B/C (dosimetry)                            | `DosimetryAnalysis` pathways, DCF sources, uncertainties, shielding/occupancy                          |
| RCQ‑A/D (metrics/codes/results/uncertainty/docs)  | `ConsequenceQuantificationAnalysis` with metrics, codes, model limits, uncertainty, references         |
| RCPA‑A (protective actions/site data)             | `ProtectiveActionAnalysis`                                                                             |
| RCME‑A/B (meteorology data and treatment)         | `MeteorologicalDataAnalysis`                                                                           |
| Documentation & Peer Review                       | `RadiologicalConsequenceDocumentation` with assumptions, sensitivity, peer review                      |
| Risk Integration Mapping & Feedback               | `riskMetricMapping`, `riskIntegrationInfo`, `riskIntegrationDescription`                               |

## Usage Workflow

1. Gather MS release categories and source terms; define bounding site and inputs (RCRE)
2. Configure atmospheric dispersion model and options (plume rise, wake, terrain, deposition) with limits (RCAD)
3. Specify dosimetry pathways, DCF sources, uncertainties, and shielding/occupancy (RCDO)
4. Select consequence metrics and codes; quantify results by event sequence family, with uncertainty notes (RCQ)
5. Incorporate protective action parameters and site data (RCPA)
6. Document meteorology datasets and distributions; set temporal resolution and handling (RCME)
7. Map consequence metrics to risk metrics; capture documentation, sensitivity, and peer review
8. Provide `riskIntegrationInfo` and accept feedback for iterative improvement

## Example

See the inline examples in `radiological-consequence-analysis.ts` for meteorology and consequence quantification usage. These illustrate selected metrics, codes, model limitations, event sequence family consequences, and uncertainty characterization aligned with RCQ/RCME.

## Additional Resources

- Source: `./radiological-consequence-analysis.ts`
- Regulatory documentation: `./Radiological Consequence Analysis Documentation.md`
- Related: `../mechanistic-source-term/README.md`, `../event-sequence-quantification/README.md`

## Glossary (Selected)

- Consequence Metric: Quantified impact measure (health, dose, economic) used for risk mapping
- Plume Rise: Vertical momentum/thermal effects increasing effective release height
- Building Wake: Flow perturbations behind structures affecting near‑field dispersion
- DCF: Dose Conversion Factor; converts intake/exposure into dose

---

This README summarizes the Radiological Consequence Analysis technical element and its RG 1.247 alignment, providing consistent interfaces and integration points within the OpenPRA MEF.
