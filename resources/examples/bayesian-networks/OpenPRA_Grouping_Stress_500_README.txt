OpenPRA grouping stress example

500 nodes | 1,147 connections | 96 groups | 4 nesting levels
353 binary nodes, 117 three-state nodes, 30 four-state nodes.
9,171 CPT entries; at most 3 parents per node. All rows sum to 1.

START
1. Create an editable BN network.
2. File icon > Import XDSL > OpenPRA_Grouping_Stress_500.xdsl.
3. Select View > Submodels immediately after import.

Positions are designed for individual group views. In All nodes, nodes from
different groups initially overlap; use Auto arrange to spread the full graph.
This changes saved positions, so reimport the example to reset its layout.

EXPLORE
Root shows 8 groups plus 4 ungrouped site variables:
External hazards, Electrical supply, Water supply, Cooling systems,
Protection and control, Human response, Recovery resources, Mission outcomes.

Try Electrical supply > Offsite AC > Train A > Detailed response chain.
Use Back, Home and Scope to navigate. Each level contains direct nodes,
child groups or both. Root contains 64 aggregate arrows, with counts up to 17.
Some arrows point both ways between groups: different underlying nodes create
those directions. The underlying Bayesian network remains acyclic.

TEST
- Zoom, drag groups, inspect dense crossing arrows and multi-digit counts.
- Open nodes and inspect mixed-state CPTs and parents outside the current group.
- Create, rename, nest, reparent and remove groups; check Undo/Redo.
- Move nodes between groups and Root; export and reimport XDSL.

VALIDATION
OpenPRA importer and validator: passed; CPT round trip: exact match.
Original HCL_MH parser and group renderer: exact match for all 500 node CPTs
and all 97 scopes, including visible entities and aggregate edge counts.
Browser navigation through all 4 levels and node inspection: passed.

This is synthetic test data, not a real plant model. Probabilities are generated
solely to provide valid, non-uniform CPTs for testing grouping and editing.
