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

### JSINP-002 — Sequence logic is an encoded integer list, not a readable structure
Each `sequencelist[].logiclist` entry is one integer encoding a functional event's state, and nothing in the file spells out the encoding. A functional event that a sequence never interacts with is simply absent from its logiclist, which is how SAPHIRE represents a bypassed system.
_Seen in: `fixtures/mhtgr/CRW.JSInp`, `fixtures/mhtgr/XFR-SGTF-M-*.JSInp`_

- **Status**: Resolved
- **Solution**: Bit 31 (`0x80000000`) set means the system succeeded; clearing it and subtracting `0x40000` gives the fault tree id from `sysgatelist`. So `262448` is "system 304 failed" and `2147746105` is "system 313 succeeded". Absence from the list means bypassed, and the reader must contribute nothing at all for it (not a TRUE, not a FALSE).

### JSINP-003 — Gate ids are fault-tree-scoped, not model-global
The same `gateid` appears in several fault trees with completely different logic, so a converter keyed on the raw id silently merges unrelated gates. In `CRW.JSInp`, 643 of 1,109 gate ids are reused across trees.
_Seen in: `fixtures/mhtgr/CRW.JSInp`_

- **Status**: Resolved
- **Solution**: Namespace every gate as `FT<ftid>-G<gateid>` when reading. Basic event ids, by contrast, *are* global and must not be namespaced.

### JSINP-004 — Each fault tree has a placeholder event that is not a basic event
Every fault tree carries an `evid` pointing at an eventlist entry that shares the system's name and holds its solved top probability. Treating it as an ordinary basic event injects a phantom leaf and double-counts the system.
_Seen in: all MHTGR models_

- **Status**: Resolved
- **Solution**: Map any `eventinput` referencing a fault tree's `evid` to that tree's top gate instead of to a basic event. Keep the placeholder out of the node table entirely. Its stored value is still useful as ground truth: PRAXIS's BDD reproduced it (e.g. `HTS-FAIL-1MOD-MT` 0.253262 vs SAPHIRE's stored 0.2533), which is a free check that the conversion is faithful.

### JSINP-005 — A fault tree can have no logic at all
`SG_RELIEF` (FT303) is exported with `numgates: 1`, a gate list holding a single **empty JSON object** `{}`, and a top gate id that is never defined. It is a system modeled as one event rather than a tree, and its placeholder holds the probability (0.05). It is not unused: it appears in 28 sequence entries and sits inside SAPHSOLVE's own cut sets, so the system must survive the conversion even though the tree must not.
_Seen in: `fixtures/mhtgr/XFR-SGTF-M-FW(XTRIP).JSInp`, `XFR-SGTF-M-FWST.JSInp`_

- **Status**: Resolved
- **Solution**: Emit **no fault tree at all** for such a system. Its functional event links straight to its placeholder event, so the fork carries `<collect-formula><basic-event name="SG_RELIEF"/></collect-formula>` and the success path wraps that in `<not>`. Fabricating a one-gate pass-through tree was tried first and rejected: it invents a fault tree that does not exist. This required teaching PRAXIS's event tree parser to accept a basic-event reference in `collect-formula` (it previously accepted only gates), which is `FunctionalEvent::basic_event_id`. A black-boxed system (JSINP-011) reuses exactly the same path, so "system with no tree" is one mechanism rather than two.

### JSINP-006 — Distinct sequences can share a byte-identical logiclist
Four sequence pairs (1002/1003, 1005/1006, 1009/1010, 1012/1013) have different `seqid`s and identical logic. SAPHIRE's event tree splits them on a functional event that carries no fault tree, and the logiclist only records fault-tree-bearing branches, so the split is invisible in the file.
_Seen in: `fixtures/mhtgr/XFR-SGTF-M-FW(XTRIP).JSInp`_

- **Status**: Resolved
- **Solution**: A fork tree cannot terminate two sequences at one node, so the writer emits a synthetic `FE-SPLIT-<n>` fork whose paths carry **no** `collect-formula`. Both end states survive with identical formulas, which matches SAPHSOLVE (it reports 21,949 cut sets for both 1002 and 1003). Merging the duplicates instead would lose the seqid mapping needed for comparison.

### JSINP-007 — Truncation is applied to frequency, not probability
`ettruncval` is compared against a sequence cut set's **frequency** (probability x initiating-event frequency), not its probability. With an IE frequency of 0.1, a declared `1e-6` is really a `1e-5` probability floor, and comparing a solver run at `1e-6` probability against SAPHSOLVE produces a large phantom disagreement.
_Seen in: `fixtures/mhtgr/CRW.JSInp` (IE frequency 0.1)_

- **Status**: Resolved
- **Solution**: For code-to-code work, the solver cut-off must be `ettruncval / IE_frequency`, or the solver must truncate on frequency directly. PRAXIS gained `--cut-off-basis frequency` for this; with it, CRW reproduced SAPHSOLVE's 55,698 cut sets exactly, against 146,355 under the naive probability reading. The `valcutsets` values in the JSCut are the giveaway: they are frequencies.

### JSINP-008 — The success-branch convention is decided by an undocumented flag
How SAPHSOLVE treats a succeeded system depends on the `W` flag (`sysgatelist[].gatet` and the placeholder's `processf`). With `W`, the complement is a valued literal worth `1 - P(top)`; without it, the complement contributes no value and success is handled by delete-term.
_Seen in: `CRW.JSInp` (W present on 4 systems, placeholders pre-solved with `calctype: "S"`) vs. the three `XFR-SGTF-M-*` models (no W anywhere, placeholders unsolved `calctype: "1"` defaults)_

- **Status**: Resolved
- **Solution**: Check `gatet`/`processf` before choosing a convention. W-flagged models reproduce with PRAXIS's exact treatment; unflagged models reproduce with `--delete-term`. This single flag explains why CRW reported *zero* cut sets for a sequence whose succeeded system is certain (its `1 - P` factor is 0), while the XFR models report thousands for the analogous sequence. Proved by running each model on the *wrong* convention: `--delete-term` on CRW breaks exactly one sequence (137 gives 32 products against SAPHSOLVE's 0, because delete-term removes the 3 cut sets shared with the succeeded system but applies no `1 - P` factor), and the exact treatment on the XFR models breaks every sequence whose succeeded system is certain.

### JSINP-009 — `value` is already a resolved probability for every calctype
`calctype` names the failure model (1 = mean probability, 3 = lambda x mission time, 5/7 = lambda/tau, C = library, N = initiating-event frequency, and so on), which suggests the reader must evaluate each model. It does not: SAPHIRE resolves every model to a point value before export.
_Seen in: all MHTGR models_

- **Status**: Resolved
- **Solution**: Use the `value` field directly as the probability regardless of `calctype`, and take the `calctype: "N"` event flagged `initf: "I"` as the initiating-event frequency. Confirmed by an independent Monte Carlo over the raw gate lists, which matched the resulting model on every sequence.

### JSINP-010 — Complemented inputs exist and are easy to miss
The gate schema allows `compeventinput` and `compgateinput` (complemented basic events and gates), so a JSINP fault tree can be non-coherent. Only a handful of gates use them, so a converter that ignores the keys silently produces a *different* model rather than failing.
_Seen in: `fixtures/mhtgr/CRW.JSInp` (4 gates), the XFR models (2-5 gates each)_

- **Status**: Resolved
- **Solution**: Synthesize a `Not` gate per complemented input and add it as an operand.

### JSINP-011 — SAPHSOLVE can black-box a fault tree that is fully present in the file
For `FTO-DPB` (FT304) and `CR3-G7-A-PRESS-DPB2` (FT313), SAPHSOLVE emits the system's placeholder event as a single literal instead of expanding its logic — even though both trees are complete and sound (90 and 580 reachable gates, no undefined references, no transfers). Every field was compared against `ISOLATE-DELAY-FW-DPB` (FT502), which it *does* expand: `gatet`, `processf`, `corrgate`, `defflag`, `gateflag`, `compflag`, `bddsuccess`, `gatepos` are all identical.
_Seen in: `fixtures/mhtgr/XFR-SGTF-M-FW(XTRIP).JSInp`, `XFR-SGTF-M-FWST.JSInp`_

- **Status**: Resolved by an explicit option; the *trigger* remains underivable from the file
- **Solution**: `convert.py --black-box "FTO-DPB,CR3-G7-A-PRESS-DPB2"` skips those trees' gate lists, so each system's top becomes a pass-through of its placeholder event (reusing the JSINP-005 path). With it, both models reproduce SAPHSOLVE on every sequence. Two hypotheses were tested and refuted. *Not* "the tree was never solved": SAPHIRE holds 18 cut sets for FTO-DPB, and PRAXIS reproduces all 18 exactly from the converted tree. *Not* "the system is certain": `G1-3` is equally certain (probability 1.0) and SAPHSOLVE expands it into 28,732 cut sets. So SAPHSOLVE has the cut sets available and declines to use them at sequence level, for a reason held outside the export. The remaining lead, for the next model that needs it: check what the event tree column is linked to in SAPHIRE (a system, or a basic event). A black-boxed system also solves far faster, since delete-term no longer has to build that system's full cut set family when it succeeds.

### JSINP-012 — The exported tree can carry more logic than the SAPHIRE fault tree
PRAXIS finds 31 cut sets for the converted `FTO-DPB` against SAPHIRE's 18. The 18 match exactly; the 13 extras are built from a disjoint set of events (`OA-C-SG-ISOLATE-10` and `PPIS-*` CCFs) that appear in none of SAPHIRE's, and they come from a gate the exported tree shares with `ISOLATE-DELAY-FW-DPB`.
_Seen in: `fixtures/mhtgr/XFR-SGTF-M-FW(XTRIP).JSInp` — FT304 and FT502 both contain gate 1080_

- **Status**: Resolved (informational)
- **Solution**: The export appears to contain the event-tree-linked variant of the tree, with the isolation logic grafted on, rather than the standalone fault tree an analyst sees in SAPHIRE. Harmless in practice here: the extra cut sets sit around 1e-10, far below any working cut-off, so they never reach a result. Worth knowing when a converted tree's cut set count exceeds what SAPHIRE displays.

---

## SAPHSOLVE output (.JSCut)

### JSCUT-001 — Cut set event ids are offset, not eventlist ids
Every id under `cutsetlist[].event` / `.compevent` is the eventlist id plus `0x2040000`, so a naive lookup finds nothing.
_Seen in: all MHTGR JSCut files_

- **Status**: Resolved
- **Solution**: Decode as `raw - 0x2040000`. Verified against the input eventlist on every model.

### JSCUT-002 — Zero and unity are written as marker cut sets, not empty lists
A sequence with no cut sets is written with `numcutsets: 1` and a single cut set containing `<FALSE>`, and a sequence whose logic reduces to TRUE is written as a single cut set containing `<PASS>`. Compared naively, both look like a one-cut-set disagreement against a solver that reports zero and one-empty-product respectively.
_Seen in: `CRW-output.JSCut` (seq 135, `<FALSE>`), `XFR-SGTF-M-ISO.JSCut` (seq 317, `<PASS>`)_

- **Status**: Resolved
- **Solution**: When comparing, drop any cut set containing `<FALSE>` (it means "none") and strip `<TRUE>`/`<PASS>` from the literals (they mean "unity"), which turns the `<PASS>` set into the empty product.

### JSCUT-003 — A succeeded system appears as one complement literal
Under the W convention, success is not expanded into basic events: the cut set carries a `compevent` referencing the system's placeholder, valued `1 - P(top)`. Sequence 138 of CRW is a single cut set `{~HTS-FAIL-1MOD-MT}` worth `0.1 x (1 - 0.2533) = 0.07467`, which is exactly its reported `valcutsets`.
_Seen in: `fixtures/mhtgr/CRW-output.JSCut`_

- **Status**: Resolved (informational)
- **Solution**: This is the arithmetic behind JSINP-008 and confirms the `1 - P(top)` model. A solver that expands success logic structurally will report the same *value* but a different *representation* of the same cut set.

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

### OPENPSA-004 — An event tree must be rebuilt as a fork tree from flat sequence paths
JSINP gives a flat list of sequences, but OpenPSA XML needs a nested fork tree, and the two do not map one-to-one: after the same prefix, different sequences may name *different* functional events next, because each has bypassed the ones it does not list.
_Seen in: all MHTGR models — up to 3 distinct branch directions at a single node_

- **Status**: Resolved
- **Solution**: Group the sequences by their next `(functional event, state)`, fork on the first one, and nest every remaining direction under that fork's unused state via a path that carries **no** `collect-formula`. A formula-less path is the representation of "bypassed": it contributes nothing to the sequence logic while still giving the tree somewhere to put the branch. Nesting recursively handles any fan-out; an earlier version hard-coded two directions and failed on three.

### OPENPSA-005 — Fault tree gate references must be qualified with the tree name
A `collect-formula` referencing `<gate name="G1"/>` does not link the functional event to its fault tree; the reader keys on the part before the first dot to find the tree.
_Seen in: praxis `io/event_tree_parser.rs`_

- **Status**: Resolved
- **Solution**: Emit `<gate name="FTNAME.GATENAME"/>`. Wrap it in `<not>` for a success path; leave it bare for a failure path.

### OPENPSA-006 — SCRAM's schema rejects XML that PRAXIS accepts
Running the converted models through SCRAM for an independent cross-check needed three fixes that PRAXIS does not require: names must be valid NCNames (four MHTGR events start with a digit, one contains `&`), `define-initiating-event` may not carry a `<float>` child, and single-operand `and`/`or` bodies are rejected (202 of them in one model).
_Seen in: `fixtures/mhtgr/CRW.xml` → SCRAM_

- **Status**: Resolved (a separate `-scram` variant, not the canonical output)
- **Solution**: Sanitize names, strip the IE expression, and collapse single-operand connectives to a pass-through. Worth the trouble: SCRAM independently reproduced PRAXIS's 146,355-product inventory set-for-set, which settled a disputed count.

---

## S2ML (.sbe)

### S2ML-001 — Verifier regex strips `%` prefix and splits at `/` in names
`_extract_refs` used `_IDENT_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_\-]*")` which requires an alpha start — `%TMSIV` matched as `TMSIV` (losing the prefix) and `G-EHU-LOOP/LOCADXI0...` matched as `G-EHU-LOOP` (truncated at `/`). Every undefined-name error the verifier reported for ENT was a false positive.

- **Status**: Resolved
- **Solution**: Replaced regex scan with token splitting: `re.split(r'[\s,()]+', formula)`, then filter empty strings, keywords, and digit-only tokens. Preserves full name including `%` and `/`.

---

## Event Tree Quantification (verifying a conversion against SAPHSOLVE)

Issues found in PRAXIS while checking converted models against their JSCut results. Listed here because each one is a trap for anyone comparing a converted event tree against SAPHIRE numbers.

### PRAXIS-001 — Truncated BDD-to-ZBDD conversion never terminated
`--cut-off` on an event tree hung indefinitely (over an hour on an 8-sequence model that the exact BDD solves in seconds). The conversion cached on `(node, budget, accumulated probability)`, and since almost every path reaches a node with a distinct accumulated probability, the cache never hit and the recursion degenerated into enumerating every path of the BDD.
_Seen in: `fixtures/mhtgr/CRW.xml`, and the same defect on the fault tree pipeline_

- **Status**: Resolved
- **Solution**: Memoize each BDD node's maximum path probability and prune a subtree when `accumulated x bound < cut-off`; re-key the cache on `(node, budget)` alone, storing the probability it was computed at and reusing conservatively; finish with one exact prune pass. The 60-plus-minute hang became 86 seconds.

### PRAXIS-002 — A sequence reported cut sets after reporting probability zero
A sequence made impossible by a succeeded system (its complement has probability 0) printed `<probability>0</probability>` and then listed 32 cut sets. The cut-set projection drops the complemented systems structurally, so their weight never reaches the truncation test, which scores positive literals only.
_Seen in: `CRW.xml` sequence 137_

- **Status**: Resolved
- **Solution**: A product's true weight is `P(product AND sequence)`, bounded by both `P(product)` and `P(sequence)`. So when `scale x P(sequence) < cut-off`, no product can reach the cut-off and the list is empty. The sequence still reports its exact probability; only the meaningless product list goes. Exact, not an approximation.

### PRAXIS-003 — A sequence whose logic reduces to TRUE reported no cut sets
Such a sequence has exactly one cut set, the empty (unity) product, but it was reported with an empty list while its own order distribution said one product of order zero.
_Seen in: `XFR-SGTF-M-ISO.xml` sequence 317, which SAPHSOLVE writes as a single `<PASS>` cut set_

- **Status**: Resolved
- **Solution**: Emit one empty cut set for an unconditional sequence.

### PRAXIS-004 — Delete-term was missing from the event tree path
SAPHIRE deletes any cut set that would also fail a succeeded system; PRAXIS offered only the exact treatment (which zeroes such sequences when the succeeded system is certain) and a unity treatment (which deletes nothing). The existing `--algorithm zbdd-delterm` engine is not a substitute: it is fault-tree-only, and it constant-folds probability-1.0 events out of cut sets, which SAPHIRE keeps as literals.
_Seen in: `XFR-SGTF-M-FWST.xml` — 6 sequences where PRAXIS kept 170 extra products, 170 of 170 of which fail the succeeded system G1-3, while all 9 that SAPHSOLVE kept do not_

- **Status**: Resolved
- **Solution**: New `--delete-term` flag adding the *operation* to the existing NNF ZBDD path, reusing the `nonsuperset` primitive that subsumption already uses. A succeeded system contributes no formula and its root is recorded; the sequence and its succeeded systems are built into one BDD manager under one variable order (set operations only compose across a shared variable indexing); each succeeded system's cut sets are then subtracted. Truncating the deleting families at the same cut-off is exact, since a cut set covered by a product is a subset of it and therefore at least as probable.

### PRAXIS-005 — XML entity references were never unescaped, corrupting names
The MEF reader took attribute bytes raw, so an event named `MSSMVFTOVLV1&2&3FTOCCF` (written correctly in XML as `&amp;`) was read as the literal `MSSMVFTOVLV1&amp;2&amp;3FTOCCF` and then written back double-escaped. One report contained 861,694 occurrences of `&amp;amp;`. The logic still solved, because the mangled name was used consistently, but every name-based comparison against another tool silently failed.
_Seen in: `fixtures/mhtgr/XFR-SGTF-M-*` — SAPHIRE CCF names embed `&`_

- **Status**: Resolved
- **Solution**: Use quick-xml's `unescape_value()` at every attribute read in `io/parser.rs` and `io/event_tree_parser.rs` (fault tree, gate, basic event, parameter, CCF group, CCF member, and operand names). Fixing this is what allowed PRAXIS's fault tree cut sets to be matched against SAPHIRE's own.

### PRAXIS-006 — Cut set counts differ by convention, so compare on a matched convention
The same sequence yields 146,355 products (exact), 55,698 (SAPHIRE's W convention at the right cut-off), or 100 (delete-term with constant folding). None of these are wrong; they count different objects.
_Seen in: `CRW.xml` sequence 136_

- **Status**: Resolved (methodological)
- **Solution**: Before comparing counts, match three things: the cut-off basis (JSINP-007), the success convention (JSINP-008), and whether probability-1.0 events are folded. Probabilities are the safer comparison: they agreed across all conventions and tools throughout.

---

## Format Gate Support Matrix

| Gate type | OpenPSA XML | S2ML / SBE | FTAP | JSINP |
|-----------|:-----------:|:----------:|:----:|:-----:|
| AND       | ✓ | ✓ | ✓ | ✓ |
| OR        | ✓ | ✓ | ✓ | ✓ |
| NOT       | ✓ | ✓ | ✓* | ✓* |
| ATLEAST   | ✓ | ✓ | ✗ | ✓ |
| XOR       | ✓ | ✗ | ✗ | ✗ |
| NAND      | ✓ | ✗ | ✗ | ✗ |
| NOR       | ✓ | ✗ | ✗ | ✗ |

\* NOT allowed only as a negated literal (direct child of AND/OR), not as a standalone gate. In JSINP this is `compeventinput` / `compgateinput` (JSINP-010).

Beyond gates, JSINP also carries an event tree: initiating event, systems, and sequences (JSINP-002). OpenPSA XML represents it as `define-event-tree` (OPENPSA-004). The other formats are fault-tree only.

---

## Dataset Notes

### fixtures/ent/ENT.ftp
91k-line SAPHIRE model. Truncation limit: `1E-12`. Contains 265 ATLEAST gates and multi-line gate definitions.
All blockers resolved (FTAP-001, FTAP-002, JSINP-001, OPENPSA-001, OPENPSA-002, S2ML-001).
Feasible targets: OpenPSA XML, S2ML/SBE. Not feasible: FTAP output (no ATLEAST support), JSINP (no ATLEAST support).

### fixtures/mhtgr/*.JSInp — SAPHIRE event trees with SAPHSOLVE results
Event tree models exported from SAPHIRE, each paired with the `.JSCut` produced by SAPHSOLVE, used for code-to-code verification of the JSINP → PBF → OpenPSA XML → PRAXIS route.

| Model | Systems | Sequences | Declared cut-off | IE frequency | Cut sets in JSCut |
|---|---|---|---|---|---|
| `CRW` | 7 | 8 | `1e-6` (frequency) | 0.1 | 55,698 |
| `XFR-SGTF-M-ISO` | 5 | 5 | `1e-6` (frequency) | 1.0 | 36,809 |
| `XFR-SGTF-M-FW(XTRIP)` | 9 | 30 | `1e-6` (frequency) | 1.0 | 305,489 |
| `XFR-SGTF-M-FWST` | 9 | 43 | `1e-6` (frequency) | 1.0 | 580,505 |

`CRW` is the W-flagged family: succeeded systems carry `gatet: "W"` with pre-solved `calctype: "S"` placeholders, so it reproduces under PRAXIS's exact treatment (JSINP-008). The three `XFR-SGTF-M-*` models carry no W flags and reproduce under `--delete-term`.

**All four models reproduce SAPHSOLVE on every sequence, cut set for cut set.**

```
# ISO — 5/5 sequences, 36,809 cut sets
python convert.py XFR-SGTF-M-ISO.JSInp XFR-SGTF-M-ISO.xml
praxis-cli XFR-SGTF-M-ISO.xml --algorithm zbdd --cut-off 1e-6 --cut-off-basis frequency --delete-term

# FW(XTRIP) — 30/30 sequences, 305,489 cut sets.  FWST — 43/43 sequences, 580,505 cut sets
python convert.py <model>.JSInp <model>.xml --black-box "FTO-DPB,CR3-G7-A-PRESS-DPB2"
praxis-cli <model>.xml --algorithm zbdd --cut-off 1e-6 --cut-off-basis frequency --delete-term

# CRW (W-flagged) — 8/8 sequences, 55,698 cut sets; exact treatment, no --delete-term
praxis-cli CRW.xml --algorithm zbdd --cut-off 1e-6 --cut-off-basis frequency
```

A caution about what these numbers mean. In the `XFR-SGTF-M-*` models, **172 of the 229 CCF events sit at probability 1.0 with no CCF failure model attached**, which makes five of the nine systems certain to fail. The agreement with SAPHSOLVE is therefore agreement on unpopulated common-cause data. It validates the pipeline end to end; it does not validate the model.
