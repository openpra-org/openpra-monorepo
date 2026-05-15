## PRAXIS (PRA eXecution and Insight System)

PRAXIS is a command line tool for Probabilistic Risk Assessment (PRA). This repository contains Rust based implementations of PDAG based algorithms, taking inspiration from techniques introduced by PRA practitioners over the years.

## OpenPRA MEF Documentation

- NAPI usage guide: `src/openpra_mef/NAPI_USAGE_GUIDE.md`
- Troubleshooting (validation + cross-reference errors): `src/openpra_mef/TROUBLESHOOTING.md`
- Compatibility changelog: `src/openpra_mef/CHANGELOG.md`
- Operational readiness standards: `src/openpra_mef/OPERATIONS.md`
- OpenPSA XML converter mapping + diagnostics: `src/openpra_mef/openpsa_xml_converter/MAPPING_SPEC_AND_DIAGNOSTICS_CATALOG.md`
- OpenPSA XML strict/compatible placeholder policy: `src/openpra_mef/openpsa_xml_converter/STRICT_COMPATIBLE_PLACEHOLDER_POLICY.md`
- OpenPSA XML conversion runbook: `src/openpra_mef/openpsa_xml_converter/OPERATIONS_RUNBOOK.md`
- OpenPSA XML release gate: `src/openpra_mef/openpsa_xml_converter/RELEASE_GATE.md`

## Installation

### Prerequisites

- Rust 1.70+ (install from [rustup.rs](https://rustup.rs))
- For GPU acceleration: CUDA Toolkit 11.0+

### From Source

```bash
# Clone repository
git clone https://github.com/rasheeqqua/praxis.git
cd praxis

# Build (CPU-only)
cargo build --release

# Build with GPU support
cargo build --release --features gpu

# CUDA (NVIDIA)
cargo build --release --features cuda

# Install to system
cargo install --path .

# Run tests
cargo test --lib --tests
``` 

### Code Quality

```bash
# Format code
cargo fmt

# Lint
cargo clippy -- -D warnings

# Check without building
cargo check
```

### MHTGR Export + CUDA Exact Parity

Exports the 7 MHTGR OpenPSA XML models to OpenPRA MEF JSON (contract form), then runs CUDA Monte Carlo parity (XML vs JSON) with exact matching (no tolerance).

```bash
# Linux/macOS/Git Bash
bash scripts/mhtgr_export_and_cuda_parity.sh

# Optional
bash scripts/mhtgr_export_and_cuda_parity.sh --xml-dir tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML --out-dir tmp/mhtgr_openpra_json
```

```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/mhtgr_export_and_cuda_parity.ps1

# Optional
powershell -ExecutionPolicy Bypass -File scripts/mhtgr_export_and_cuda_parity.ps1 -XmlDir tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML -OutDir tmp/mhtgr_openpra_json
```

### M1 S9 Release Gate

Run the complete M1 release gate (strict diagnostics path, parity, and NAPI checks):

```bash
# Linux/macOS
bash scripts/s9_release_gate.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/s9_release_gate.ps1
```

### Milestone Promotion Gate (Required)

Promotion to the next milestone requires a dedicated gate pass focused on converted real-model parity plus the full S9 gate:

```bash
# Linux/macOS
bash scripts/milestone_promotion_gate.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/milestone_promotion_gate.ps1
```

Policy enforcement:

- Do not merge/publish milestone promotion PRs when any promotion-gate test fails.
- Configure branch protection so `Milestone Promotion Gate / milestone-promotion-gate` is a required status check.
- Treat both "Converted real-model suite (promotion blocker)" and "Full S9 gate (promotion blocker)" as hard blockers for promotion.

### Milestone Rollback Strategy (M1-M8)

If a promoted milestone regresses `main`/`master`, rollback is executed in two stages:

1. **Immediate stabilization**
	 - Revert the promotion commit/PR merge commit (`git revert <sha>`), push, and re-run `scripts/s9_release_gate.sh` (or `scripts/s9_release_gate.ps1`).
2. **Targeted remediation branch**
	 - Create a fix branch from the rollback commit, repair root cause, and re-promote only after gate passes.

Per-milestone rollback targets:

- **M1 (Schema scan + mapping matrix)**
	- Rollback trigger: schema/mapping drift breaks validation/parsing.
	- Rollback action: revert mapping/schema-scan commits; keep prior validated mapping set.

- **M2 (OpenPRA JSON model + ref resolver)**
	- Rollback trigger: resolver errors, placeholder policy regressions, ID/ref breakage.
	- Rollback action: revert resolver/model commits; restore previous resolver behavior and diagnostics contract.

- **M3 (JSON parser + validator)**
	- Rollback trigger: JSON inputs previously accepted now fail or mis-parse.
	- Rollback action: revert parser/validator changes; keep XML path fully available as fallback.

- **M4 (DA/SA/IEA/ESA mappers)**
	- Rollback trigger: engine-input mapping breaks event-tree/fault-tree reconstruction.
	- Rollback action: revert mapper layer commits; preserve last known-good mapping bridge.

- **M5 (ESQ + RI placeholder)**
	- Rollback trigger: quantified-output envelope incompatibility or RI placeholder contract drift.
	- Rollback action: revert ESQ/RI output changes; restore previous ESQ payload and placeholder provenance shape.

- **M6 (NAPI-RS API + error contract)**
	- Rollback trigger: addon build/runtime failures, endpoint contract incompatibility.
	- Rollback action: revert NAPI contract/binding commits; pin to previous addon contract and rerun NAPI Rust + JS tests.

- **M7 (Real-model conversion + parity tests)**
	- Rollback trigger: parity regression against converted real-model fixtures.
	- Rollback action: revert conversion/parity commits; preserve prior passing fixture baselines.

- **M8 (Hardening + docs + release prep)**
	- Rollback trigger: release-gate script/workflow instability or release docs causing operational mismatch.
	- Rollback action: revert gate/doc hardening commits; restore last passing gate workflow/scripts.

Operational policy for all rollbacks:

- Do not stack new feature work on a broken milestone; stabilize first.
- Use revert commits (not force-push history rewrites) on shared branches.
- Require full S9 gate pass before re-promotion.
