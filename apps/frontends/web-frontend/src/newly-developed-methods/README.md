# Canonical method editor source

This directory contains the reusable frontend implementations for method editors. It is a source-code boundary, not a project-level model library or a routable application area.

- Workbook screens own navigation, persistence, permissions, save state, and analysis requests.
- Editors receive workbook-owned models and resolved references through their public component contracts.
- Editors return controlled domain operations to their workbook host; they do not call project-model or workbook persistence APIs directly.
- FT data is authored by SY, ET data by ES, and BN/HCL data by ESQ. Other workbook surfaces reuse the same canonical components.
- Do not add standalone model-library pages, project-model routes, or `/method-models` API clients here or elsewhere in the frontend.

The `NewlyDevelopedMethod` MEF technical-element records are separate methodology documentation. They are not editor model storage and are intentionally unaffected by this boundary.
