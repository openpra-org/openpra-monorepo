# Grouping demo

1. Open an editable Bayesian network. Use the **File** icon → **Import XDSL** and choose `grouping-demo.xdsl`.
2. Select **View → Submodels**. Root shows Power supply, Pumps and Heat removal. Pumps contains Pump A, Pump B and the nested Controls group.
3. Click a group to open it. Use **Back**, **Home** or **Scope** to navigate. Nodes use the normal editor and CPT inspector.
4. Open **Manage groups**. Enter a name, optionally choose a parent, check existing nodes, then click **Create group**.
5. Choose an existing group to rename, move, change members or remove it. You can also select a node and change its inspector’s **Group** field.
6. **Undo/Redo** covers group edits. Save the workbook or export XDSL to keep them. Removing a group keeps its nodes and nested groups.

This five-node example is synthetic. Its groups and CPTs are compatible with HCL_MH’s XDSL reader. Grouping changes presentation only.

## Large grouping example

`OpenPRA_Grouping_Stress_500.xdsl` contains 500 nodes, 1,147 connections, 96 groups and four nesting levels. Import it using the File icon, then select **View → Submodels**. Positions are local to each group; use **Auto arrange** for the All nodes view.

See `OpenPRA_Grouping_Stress_500_README.txt` for test steps. `generate-grouping-stress.py` reproduces the synthetic input with seed 20260917. Validation found no model errors, preserved every CPT through XDSL export/import, and matched HCL_MH’s parser and group renderer for all 97 scopes.
