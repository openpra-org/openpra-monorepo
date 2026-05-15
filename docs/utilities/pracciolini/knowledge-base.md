# Pracciolini Knowledge Base

Issues encountered during parsing, verification, or format conversion.
Grouped by format. Each entry: 2-sentence problem summary, status, solution.

---

## FTAP (.ftp)

### FTAP-001 — Multi-line gate definitions drop continuation children
Children that overflow onto the next line (indented with leading whitespace) are silently discarded; the gate is built with only the children from the first line.
_Seen in: `fixtures/ent/ENT.ftp`_

- **Status**: Resolved
- **Solution**: Track `last_gate_name` during GATES-section parsing. When a line has no valid operator at position [1] (not `+`, `*`, or an integer), treat all its tokens as additional children appended to the last parsed gate. Pre-processing with a blind merge was attempted first but broke IMPORT parsing because IMPORT entries also start with leading whitespace.

### FTAP-002 — ATLEAST gates misparsed as AND
When the operator column is an integer (`2`, `3`, …) denoting k-of-n, the reader treats it as AND and discards the threshold entirely.
_Seen in: `fixtures/ent/ENT.ftp` — 265 occurrences_

- **Status**: Resolved
- **Solution**: Try `int(op_char)` before the `+`/`*` branch. On success, store the integer as the op and build `AtleastExpr(k=int(op), args=child_exprs)` instead of `AndExpr`.

### FTAP-003 — Writer emitted `Fault tree` header, crashing FTREX
The writer prefixed output with `Fault tree`, which FTREX tried to parse as an integer gate count and crashed.
Removed the header; files now start directly with gate rows.

- **Status**: Resolved
- **Solution**: Removed the `Fault tree` header line from the writer. Files start directly with gate rows. If a future FTAP consumer requires the header, add it back via a `dialect` parameter.

---

## JSINP (.jsinp)

### JSINP-001 — ATLEAST gates have no conversion path
JSINP does support k-of-n gates via `"gatetype": "k/n"` (e.g., `"3/4"`), but the writer was incorrectly treating `AtleastExpr` as unsupported and rejecting it.

- **Status**: Resolved
- **Solution**: Removed `AtleastExpr` from the unsupported-gate check. In `_visit`, added an `AtleastExpr` branch that sets `gatetype = f"{expr.k}/{len(expr.args)}"` and iterates children normally. Also updated `_collect_refs` to recurse into `AtleastExpr.args`.

---

## OpenPSA XML (.xml)

### OPENPSA-001 — ENT names contain characters invalid in XML NCName and SCRAM Identifier
ENT names like `PRA_TOP~1`, `%TMSIV`, `WXV--503SXI2` are invalid for two reasons: `%` and `~` are not NCName characters, and SCRAM's schema defines `Identifier` as `[^\-.]+(-[^\-.]+)*` which additionally forbids dots and consecutive hyphens (`--`).
_Seen in: `fixtures/ent/ENT.ftp` → `fixtures/ent/ENT.xml`_

- **Status**: Resolved
- **Solution**: `_to_ncname()` in `openpsa_xml.py` targets SCRAM's `Identifier` pattern directly. It splits on runs of hyphens (`-+`), encodes non-`[a-zA-Z0-9_]` characters in each segment as `xHH` (hex ordinal), then rejoins segments with single `-`. This collapses `--` to `-`, encodes `%`/`~`/`/`/`.` without collisions, and ensures the first character is a letter or `_`. Results: `%TMSIV` → `x25TMSIV`, `PRA_TOP~1` → `PRA_TOPx7E1`, `WXV--503SXI2` → `WXV-503SXI2`. Replacing with `_` was attempted first but caused collisions (`%L` and `/L` both mapped to `_L`).

### OPENPSA-002 — Writer emits `<atleast k="...">` but SCRAM schema requires `min`
The `_expr_to_elem()` writer set `el.set("k", str(expr.k))` on `<atleast>` elements, but SCRAM's RELAX NG schema declares the threshold attribute as `min`, not `k`. The reader already handled both (`elem.get("k", elem.get("min", "2"))`), so round-trips within Pracciolini worked, but SCRAM rejected the output.

- **Status**: Resolved
- **Solution**: Changed writer to `el.set("min", str(expr.k))`.

### OPENPSA-003 — Aralia models contain passthrough gates that add depth without logic
16 of the 43 Aralia OpenPSA XML benchmark models contained `define-gate` elements that wrapped a single child (a `basic-event` or another `gate`) with no logic operator — effectively transparent wiring nodes that unnecessarily increased tree depth and caused some solvers to mishandle them.
_Seen in: `fixtures/aralia/das9207.xml`, `nus9601.xml`, `edfpa14o/p/q/r.xml`, `edfpa15o/p/q/r.xml`, `edf9201/02/04/06.xml`, `edfpa14b.xml`, `edfpa15b.xml`_

- **Status**: Resolved
- **Solution**: Eliminated passthrough gates by inlining the single child directly into the parent gate's operand list and removing the now-redundant `define-gate` wrapper. Applied to all 16 affected models. Net result: ~700 lines removed across the dataset with no change in logical semantics.

---

## S2ML (.sbe)

### S2ML-001 — Verifier regex strips `%` prefix and splits at `/` in names
`_extract_refs` used `_IDENT_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_\-]*")` which requires an alpha start — `%TMSIV` matched as `TMSIV` (losing the prefix) and `G-EHU-LOOP/LOCADXI0...` matched as `G-EHU-LOOP` (truncated at `/`). Every undefined-name error the verifier reported for ENT was a false positive.

- **Status**: Resolved
- **Solution**: Replaced regex scan with token splitting: `re.split(r'[\s,()]+', formula)`, then filter empty strings, keywords, and digit-only tokens. Preserves full name including `%` and `/`.

---

## Format Gate Support Matrix

| Gate type | OpenPSA XML | S2ML / SBE | FTAP | JSINP |
|-----------|:-----------:|:----------:|:----:|:-----:|
| AND       | ✓ | ✓ | ✓ | ✓ |
| OR        | ✓ | ✓ | ✓ | ✓ |
| NOT       | ✓ | ✓ | ✓* | ✗ |
| ATLEAST   | ✓ | ✓ | ✗ | ✗ |
| XOR       | ✓ | ✗ | ✗ | ✗ |
| NAND      | ✓ | ✗ | ✗ | ✗ |
| NOR       | ✓ | ✗ | ✗ | ✗ |

\* NOT allowed only as a negated literal (direct child of AND/OR), not as a standalone gate.

---

## Dataset Notes

### fixtures/ent/ENT.ftp
91k-line SAPHIRE model. Truncation limit: `1E-12`. Contains 265 ATLEAST gates and multi-line gate definitions.
All blockers resolved (FTAP-001, FTAP-002, JSINP-001, OPENPSA-001, OPENPSA-002, S2ML-001).
Feasible targets: OpenPSA XML, S2ML/SBE. Not feasible: FTAP output (no ATLEAST support), JSINP (no ATLEAST support).
