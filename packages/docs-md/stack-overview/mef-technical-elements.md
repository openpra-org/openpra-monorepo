# MEF Technical Elements

An overview of the Model Exchange Format (MEF) technical elements used across OpenPRA, with links into the generated schema docs.

MEF technical elements provide a typed vocabulary for PRA models: components, events, success criteria, analyses, and integration surfaces. The source of truth is the JSON Schemas in `mef-schema/src/openpra-mef`.

## Namespaces

These namespaces organize the domain:

- technical_elements.core — Core types, patterns, and metadata
- technical_elements.plant_operating_states_analysis — Plant Operating States Analysis
- technical_elements.data_analysis — Data Analysis
- technical_elements.initiating_event_analysis — Initiating Event Analysis
- technical_elements.systems_analysis — Systems Analysis (incl. temporal modeling)
- technical_elements.risk_integration — Risk Integration
- technical_elements.event_sequence_analysis — Event Sequence Analysis
- technical_elements.success_criteria_development — Success Criteria Development
- technical_elements.event_sequence_quantification — Event Sequence Quantification
- technical_elements.mechanistic_source_term — Mechanistic Source Term
- technical_elements.radiological_consequence_analysis — Radiological Consequence Analysis
- technical_elements.integration — Integration interfaces for external tools and formats

## Schema Docs

- Technical elements index: ../api/mef/openpra-mef/index.html

If you need the broader type library used by services and UI, see:

- MEF Types (aggregated TypeDoc): ../api/ts/mef-types/README.html
- MEF Schema typings (TypeDoc): ../api/ts/mef-schema/README.html

## Notes

- These schemas are the canonical definitions. TypeScript typings are derived from them in the `mef-schema` package and surfaced via `shared-types`.
- Links above are relative to support the GitHub Pages base path.
