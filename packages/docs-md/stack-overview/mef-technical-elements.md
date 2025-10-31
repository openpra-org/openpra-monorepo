# MEF Technical Elements

An overview of the Model Exchange Format (MEF) technical elements used across OpenPRA, with links into the generated API docs.

MEF technical elements provide a typed vocabulary for PRA models: components, events, success criteria, analyses, and integration surfaces. They live in the `mef-types` package under the `openpra-mef/technical-elements` submodule and are exported via TypeScript namespaces.

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

## API Docs

- Package index: ../api/ts/mef-technical-elements/README.html

If you need the broader type library used by services and UI, see:

- MEF Types (aggregated): ../api/ts/mef-types/README.html
- MEF Schema typings: ../api/ts/mef-schema/README.html

## Notes

- These APIs are types-only; no runtime is shipped. JSON schemas derived from these types are generated in the `mef-schema` package.
- Links above are relative to support the GitHub Pages base path.
