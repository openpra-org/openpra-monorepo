# Hazard scenario generation: source map

`hazard_sweep.rs::generate_hazard_sweep_scenarios` ports
`resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/hazard_sweep.py:335–370`.
The HCL_MH MIT notice is retained in `uncertainty/LICENSES.txt` and the addon's
`THIRD_PARTY_NOTICES.txt`.

The port preserves:

- Supplied dimension and state order, with the last dimension varying fastest.
- Exclusions that match all assignments in an exclusion row; separate rows are alternatives.
- Sequential `hz_0001` numbering after exclusions.
- State labels, evidence, hazard assignments and ordered hazard dimensions.
- The optional limit applied after excluding and appending a scenario.
- Empty-dimension and fully excluded results.

`HazardSweepSpec::validate` provides the source loader's structural checks for
typed inputs: unique dimensions/nodes/states, valid exclusions and a positive
optional limit. The application sends resolved node/state IDs; it does not port
the YAML loader or its token aliases. The generator itself preserves the source
function's behavior for an empty exclusion (exclude everything); the UI omits
empty exclusion rows, as the source loader does.

## Application boundary

The addon handles `HYBRID_CAUSAL_LOGIC` requests with
`operation: "GENERATE_SCENARIOS"`. It checks node/state membership against the
referenced BN snapshot without compiling a BDD or junction tree. `validate`
checks the request without enumerating combinations.

The SY and ESQ `hcl-configurations/:modelId/generate-scenarios` routes authorize
the workbook and sources, check revisions, and call the existing native worker.
ESQ also supports a referenced SY dependency configuration. The backend maps
source scenario IDs to display codes, assigns workbook UUIDs, and bounds display
names to the existing 200-character field. Evidence and generation order are
unchanged.

The UI stages generated/uploaded rows and their grid settings. It sends them as
`batchInput` alongside selected scenario IDs. The backend validates and uses
these rows without updating workbook settings. Each immutable run records its
scenario, merged effective evidence and applicable hazard-grid settings. Requests
without `batchInput` continue to use saved scenarios. A supplied `batchInput`
does not inherit an omitted saved grid.

Generated grids retain every selected generator dimension, including dimensions
with only one chosen state. They use the existing annual scale and normalization
controls. Existing probability, uncertainty and convolution algorithms are
unchanged.

## Verification

`tests/fixtures/hcl_mh_hazard_sweep.py` extracts and executes the original Python
function. The adjacent JSON fixture records its file hash, inputs and outputs.
Run `python apps/solvers/praxis/tests/fixtures/hcl_mh_hazard_sweep.py --check` from
the repository root to compare the fixture directly with the local source.

The addon's `test/hcl-hazard-sweep-source.spec.mjs` compares the Rust result with
every source fixture and tests invalid dimensions, exclusions, limits and BN
references. Normal addon tests require neither Python nor the local HCL_MH tree.
