# Result presentation: source map

Tasks 37–38 change application presentation and export. Task 39 also transports existing diagnostics and captures them during ET execution. Probability algorithms, ordering, caching policy, uncertainty sampling and hazard formulas are unchanged.

| Behavior | Reference | Application implementation |
| --- | --- | --- |
| Preserve small BN probabilities with significant digits | `resources/HCL_MH/utils/ft_gui_builder_pkg/bn/panel.py`, `_append_query_result_row`, uses `.12g` | `shared/resultPresentation.tsx`, `formatResultNumber`; JavaScript chooses exponent spelling, and the full returned number is available on hover |
| Display returned HCL probability and summary statistics | `resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/panel.py`, `_row_to_table_values` | `hybrid-causal-logic/hclResults.tsx`; existing compact scientific formatting remains, with raw value tooltips for FT/sequence results and UQ |
| Export raw numeric columns, separate from display formatting | `resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/reports.py`, `_write_csv` and `write_run_artifacts` | `shared/resultCsv.ts`, `shared/probabilityResultExport.ts`, `bayesian-network/bayesianNetworkResults.tsx` |
| Preserve probability/UQ fields received from the addon | `apps/backends/web-backend/src/newly-developed-methods/shared/workbook-analysis-runs.service.ts`, `publicResult` | Existing mapping retained; serializers select the returned fields without recomputing probabilities, statistics or aggregates |

## Application adaptations

- BN results identify node and state, with a probability column rather than two-decimal percentages. Missing labels fall back to returned IDs.
- UQ displays all seven returned statistics, sample count and seed. Sequence probability and annual-frequency summaries retain their separate units.
- Returned validation issues and scenario failures remain visible. Failed/skipped rows do not acquire fabricated zero probabilities.
- Pagination renders 25, 50 or 100 items at a time. It changes the visible slice only; the complete run remains available for export. It is an application control, not a source solver algorithm.
- Reusable React components replace duplicate result rendering and centralize pagination and CSV download. Result-name helpers are separate from UI components.
- The existing no-variation notice now compares the relevant returned values exactly. In uncertainty mode it compares summary statistics. It is suppressed when a scenario did not succeed.

## CSV conventions

CSV preserves numeric values using JavaScript's round-trip numeric string conversion. It includes all rows, regardless of the current page. The file has a UTF-8 BOM, CRLF record separators, quoted fields and escaped quotes. Potential spreadsheet-formula labels are prefixed with an apostrophe; numeric values are not altered.

BN rows contain node/state identifiers and labels, evidence, probability, scenario identity where applicable, run metadata and validation issues. Ordinary FT rows contain the returned top-event probability. HCL FT rows also contain any returned UQ summary. ET rows separate conditional probability and annual frequency, and include returned end-state aggregates. UQ columns are `sample_count`, `seed`, `mean`, `standard_deviation`, `minimum`, `percentile_05`, `median`, `percentile_95` and `maximum`.

Hazard exports preserve the returned weights, conditional probabilities, contributions and integrated sequence/end-state values. They do not calculate additional totals. Blank values mean absent results, including skipped conditional probabilities. Ordinary FT/ET exports also mark whether the displayed run is stale. Diagnostic counters and retired cut-set/importance outputs are outside these probability/UQ exports.

CSV field names, browser downloads, labels, pagination and the general BN/FT/ET presentation are application adaptations permitted by the source-alignment rule. Task 38 also displays these returned end-state and hazard values on screen.

## Verification

Regression tests compare returned numbers with exported records, cover all seven statistics, distinguish probability from annual frequency, verify failed/skipped rows, preserve case-sensitive identities and validate paging/reset behavior. A browser download from the last page of a 63-sequence run is checked with Python's CSV reader: it contains all 63 sequences, both quantities and the returned end-state row, with unchanged values.

## Task 38: end states and hazard results

| Behavior | Source | Application implementation |
| --- | --- | --- |
| Sequence probability, annual frequency and end-state frequency | Existing source-aligned PRAXIS addon `event_tree.rs`, `execute_hcl_event_tree_result`, lines 541–596 | `hclEventTreeResults.tsx` displays returned sequence values and `endStateAggregates` |
| End-state UQ | Same addon, lines 547–596: sum aligned samples by terminal end-state ID, then summarize | All seven returned end-state statistics are displayed with `/yr`; the frontend never adds sequence percentiles or standard deviations |
| Point hazard contributions and integrated results | `HCL_MH/utils/ft_gui_builder_pkg/hcl/hazard_convolution.py`, `aggregate_hazard_convolution_results`, lines 455–477 and 537–559; existing addon `event_tree.rs`, lines 748–837 | `hclHazardResults.tsx` displays raw/normalized/applied weights, bin sequence contributions, and integrated sequence/end-state probability and annual frequency |
| Hazard-grid UQ restriction | `hazard_convolution.py`, `ensure_hazard_convolution_supported`, line 44; source alignment completed in task 23 | Hazard integration remains probability-only; ordinary manual/scenario UQ remains available |

The end-state selector filters the returned rows; it does not start a calculation or change the model. It resets for new runs. Selected frequencies come from returned aggregates. The explicitly labelled **All outcomes** display sums those aggregates, including safe outcomes; it is not a release-frequency calculation. No combined end-state BDD is created.

End-state names come from the workbook's explicit `endStateIds`, or, for legacy generated IDs, from a returned sequence's saved terminal destination. Transferred sequences retain each tree's identity and use the final destination's label. IDs stay visible alongside names. Missing or ambiguous names fall back to IDs; missing sequence destinations remain inspectable under All outcomes and are not guessed when filtering.

Scenario annual frequencies use the initiating-event frequency. Hazard contributions use the grid's annual scale. The UI displays each separately and never applies weights or annualization again. Missing selected-state rows and missing UQ are shown as absent, not as zero. Skipped zero-weight bins and failures retain their statuses.

The selector, labels, pagination and component layout are application adaptations. CSV remains a complete export even when an outcome or page is selected. `hclResultMetrics.tsx` centralizes the existing metric/UQ rendering; common ET and hazard views replace duplicate sequence rendering and ambiguous aggregate headlines.

Task 38 tests cover returned end-state statistics, selected outcomes, ordinary probability and UQ batches, transfer labels, missing values, pagination/reset, raw and normalized hazard presentation, and complete CSV export after filtering. Solver, addon, backend and shared result contracts are unchanged.


## Task 39: BDD, junction-tree and cache diagnostics

| Behavior | Source | Application implementation |
| --- | --- | --- |
| Actual basic-event order, BDD nodes/variables, bridge counters and junction-tree structure | Original main `hcl/api.rs`, `quantify_hcl`, lines 66–90; snapshot under `outputs/hcl-implementation-audit/main-snapshot/apps/solvers/praxis/src/hcl` | Existing FT fields displayed by `hclDiagnostics.tsx`; ET captures the same statistics from its existing sequence BDD and point quantifier in `analysis/event_tree_quantification.rs` |
| BDD node and variable counts | PRAXIS `algorithms/bdd_engine.rs`, `node_count` and `variable_count` | Node count excludes the two terminals and may include intermediate allocated nodes. Display preserves the source count, not a newly computed reachable-node count |
| Cache hits and misses | Main/current `hcl/quantify.rs`, `quantify`, `evaluate`, `query_event_probability`, `set_base_evidence` and `clear_caches` | ET reuses the FT analysis layer's `bridge_delta` to report each evidence row separately. Evidence changes clear the caches; counters exclude UQ and hazard-weight queries |
| Junction-tree structure | `apps/solvers/tensorbayes/src/compiler.rs`, `compile`; treewidth uses `max_clique_size.saturating_sub(1)` | Display cliques, largest clique, treewidth and table entries from the base BN compilation |
| Batch compilation counts | Existing PRAXIS `hcl/analysis/mod.rs` and `analysis/event_tree_quantification.rs`; existing addon `compilationReuse` payload | Backend validates and saves the counts with each successful result and returns them once per batch. Both workspace adapters retain them. Labels state that they cover the entire batch and exclude UQ sample-chunk compilations |
| Diagnostics presentation precedent | `resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/panel.py`, `_populate_diagnostics_text` and its performance display | Disclosure panels and labels are application adaptations. The displayed counter definitions come from PRAXIS/main; HCL_MH's other metrics and algorithms are not substituted |

An unconditional ET sequence that bypasses BDD construction returns `bdd: null` and `bridge: null`; its shared base BN statistics can still be present. An ordinary independent sequence has BDD diagnostics but no HCL bridge or BN statistics. Historical ET records without the new field remain readable and show **not recorded**, rather than fabricated zero counts. Old batch records may also lack compilation counts.

The actual variable order is displayed without sorting, including explicit CLI/API overrides. Long orders use the existing 25/50/100-item pagination. No GUI ordering control is added. Diagnostic content is rendered only when its disclosure opens. The same views cover manual and scenario probability/UQ results; UQ views explicitly retain the point-pass scope.

Shared Rust serializers replace duplicate FT/ET field mapping; shared React panels replace duplicate rendering. Existing probability/UQ CSV exports are unchanged. Tests verify native counts against individual evidence runs, point/UQ separation, explicit order, unconditional bypass, schema validation, API/database round trips, both workspace adapters, historical records and pagination. Eight executions against the old and rebuilt addons preserve every prior output field exactly; only ET diagnostics are added.
