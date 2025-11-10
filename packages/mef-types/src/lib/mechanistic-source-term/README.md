# Mechanistic Source Term Analysis Technical Element Module

## Overview

The Mechanistic Source Term (MS) technical element characterizes radiological releases resulting from PRA event sequences. It defines release categories, characterizes radioactive sources and inventories, models transport barriers and phenomena, quantifies source terms by radionuclide and phase, and documents uncertainties and assumptions in alignment with RG 1.247 (HLR‑MS‑A through HLR‑MS‑E).

MS consumes event sequence/family and barrier state context from Event Sequence Quantification (ESQ) and provides structured outputs for Radiological Consequence and Risk Integration.

## Purpose

- Define defensible release categories and map PRA sequences to them with justification
- Characterize sources (e.g., reactor core, spent fuel) and radionuclide inventories
- Model transport barriers and phenomena and quantify time‑phased releases by species and form
- Provide uncertainty and sensitivity analyses and document model uncertainty and pre‑operational assumptions
- Supply inputs and traceability to consequence modeling and risk integration, including risk feedback hooks

## Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Mechanistic Source Term (MS)                             │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Release Categories & Mapping │  │ Source Characterization             │  │
│  │ - ReleaseCategory            │  │ - RadioactiveSource                 │  │
│  │ - ReleaseCategoryBasis       │  │ - Inventories & Uncertainty         │  │
│  │ - EventSequence→Release Map  │  └──────────────────────────────────────┘  │
│  └──────────────────────────────┘                                             │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Transport & Barriers         │  │ Source Term Definition               │  │
│  │ - RadionuclideTransportBarrier│ │ - SourceTermDefinition (phases,     │  │
│  │ - TransportMechanism         │  │   quantities, forms, timing)        │  │
│  │ - TransportPhenomena (MS‑B5) │  │ - SourceTermModel (V&V)             │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Uncertainty & Sensitivity    │  │ Documentation & Integration         │  │
│  │ - MST Uncertainty Analysis   │  │ - ProcessDocumentation (MS‑E1)      │  │
│  │ - MST Sensitivity Study      │  │ - ModelUncertainty (MS‑E3/MS‑C6)    │  │
│  │                              │  │ - Pre‑Operational (MS‑E4)           │  │
│  │                              │  │ - Risk Integration Feedback/Hooks   │  │
│  └──────────────────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- Release category definition, basis, timing/magnitude classification, and bounding sequence selection
- Event sequence/family to release category mapping with frequency hooks and risk integration trace
- Transport barrier assessment with barrier status linkage from ESQ and MS‑B4 physical/chemical condition capture
- Transport phenomena capture with MS‑B5 inclusion assessment and consequence support justification (MS‑C4)
- Source term definition by radionuclide and phase (forms, timing, energy/elevation, particle size)
- V&V aware source term model references for code basis and applicability
- Comprehensive uncertainty and sensitivity structures plus model‑uncertainty documentation and alternatives
- Pre‑operational assumptions and limitations, with validation timing and resolution approach

## Core Components

- `MechanisticSourceTermAnalysis`: Root aggregate and API schema
- Release categorization: `ReleaseCategory`, `ReleaseCategoryBasis`, `EventSequenceToReleaseCategoryMapping`
- Transport and barriers: `RadionuclideTransportBarrier`, `TransportMechanism`, `TransportPhenomena`
- Source term: `SourceTermDefinition`, `SourceTermModel`, `ReleasePhase`, `RadionuclideReleaseQuantity`, `ReleaseForm`
- Uncertainty & sensitivity: `MechanisticSourceTermUncertaintyAnalysis`, `MechanisticSourceTermSensitivityStudy`
- Documentation: `MechanisticSourceTermProcessDocumentation`, `MechanisticSourceTermModelUncertaintyDocumentation`, `MechanisticSourceTermPreOperationalAssumptionsDocumentation`

## Integration with Other Technical Elements

| Element                       | Interaction                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Event Sequence Quantification | Consumes sequence/family IDs and barrier states (`BarrierStatus`); provides mapping and uses frequencies |
| Radiological Consequence      | Consumes `SourceTermDefinition` (species, timing, form, energy/elevation, particle size)                 |
| Risk Integration              | Consumes sequence→release mappings and, optionally, summarized frequency info; provides feedback fields  |
| Systems & HRA                 | Indirectly via ESQ (barrier states, sequence context)                                                    |
| Data Analysis                 | Supports distributions for release fractions and parameter uncertainties                                 |

## Best Practices

- Release Categories: Define early with technical basis and maintain mapping trace to sequences/families
- Barriers: Reuse ESQ barrier states; document MS‑B4 physical/chemical conditions and transport mechanisms per barrier
- Phenomena: Record MS‑B5 inclusion with justification; tie to consequence needs (MS‑C4)
- Source Terms: Provide phased, species‑resolved releases with consistent units; capture forms and timing clearly
- V&V: Reference code/model basis and validation status for traceability and applicability
- Uncertainty: Quantify key parameter/phenomena uncertainties; document state‑of‑knowledge and reasonable alternatives
- Pre‑Op: Capture assumptions and required as‑built/operational information; plan validation timing

## Regulatory Compliance Alignment (RG 1.247)

| Expectation / Requirement                    | Schema Support                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| HLR‑MS‑A/B/C (Foundations, transport, calc.) | Release categories, barrier and phenomena structures, source term definitions, models               |
| HLR‑MS‑D (Uncertainty & sensitivity)         | `MechanisticSourceTermUncertaintyAnalysis`, `MechanisticSourceTermSensitivityStudy`                 |
| HLR‑MS‑E (Documentation & traceability)      | `MechanisticSourceTermProcessDocumentation`, model uncertainty docs, pre‑operational assumptions    |
| MS‑E1(a–g)                                   | Sources, category basis, seq→category mapping, phenomena, models, sensitivity, process completeness |
| MS‑E2(a–g)                                   | Involved units, quantities, form, timing, warning time, energy, elevation                           |
| MS‑E3                                        | Model uncertainty documentation with alternatives and treatments                                    |
| MS‑E4                                        | Pre‑operational assumptions and limitations documentation                                           |
| MS‑B4/B5/C4                                  | Barrier conditions/mechanisms, phenomena inclusion, consequence support justification               |

## Usage Workflow

1. Define release categories and provide technical bases
2. Map event sequences/families (from ESQ) to release categories with justification; optionally include frequency hooks
3. Characterize sources and inventories; identify key radionuclides and uncertainties
4. Assess barriers and phenomena for each category; document MS‑B4 conditions and MS‑B5 inclusion
5. Define source terms: phased, species‑resolved quantities, forms, timing, energy/elevation, particle sizes
6. Reference models/codes with V&V status and applicability; record assumptions/limitations
7. Perform uncertainty and sensitivity analyses; document model uncertainty and reasonable alternatives
8. Capture pre‑operational assumptions and plan validations; integrate risk feedback when available

## Example

See `example` content within `MechanisticSourceTermAnalysisSchema` usage in `mechanistic-source-term.ts` and cross‑references from ESQ to barrier status. These snippets illustrate category/mapping setup, phased releases, model references, and uncertainty entries aligned to MS‑E1/E2.

## Additional Resources

- Source: `./mechanistic-source-term.ts`
- Regulatory documentation: `./Mechanistic Source Term Documentation.md`
- Related: `../event-sequence-quantification/README.md`, `../event-sequence-analysis/README.md`

## Glossary (Selected)

- Release Category: Grouping of sequences by release timing/magnitude characteristics
- Source Term: Quantified radionuclide release by species, form, and time phases
- Transport Phenomena: Physical/chemical mechanisms governing release and movement
- Barrier Status: Operational state of barriers credited in sequences; provided by ESQ

---

This README summarizes the Mechanistic Source Term technical element and its RG 1.247 alignment, providing consistent interfaces and integration points within the OpenPRA MEF.
