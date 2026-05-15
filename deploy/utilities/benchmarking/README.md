# Benchmarking Tool

Compares fault tree solvers on the ARALIA dataset across ten experiments:

| Experiment | Solver A | Solver B | Comparison |
|---|---|---|---|
| 1 | SCRAM BDD | XFTA BDD | Probability only |
| 2 | SCRAM ZBDD + REA | XFTA ZBDD + REA | Probability + MCS count |
| 3 | SCRAM ZBDD + MCUB | XFTA ZBDD + MCUB | Probability + MCS count |
| 4 | SCRAM BDD | PRAXIS BDD | Probability only |
| 5 | SCRAM ZBDD + REA | PRAXIS ZBDD + REA | Probability + MCS count |
| 6 | SCRAM ZBDD + MCUB | PRAXIS ZBDD + MCUB | Probability + MCS count |
| 7a | SCRAM BDD | ZEBRA ZTDD BDD | Probability only |
| 7b | SCRAM ZBDD + REA | ZEBRA ZTDD P_SUM | Probability (MCS count informational) |
| 7c | SCRAM ZBDD + MCUB | ZEBRA ZTDD P_MCUB | Probability (MCS count informational) |
| 8 | SCRAM ZBDD + MCUB | SAPHSOLVE MOCUS+MCUB | Probability + MCS count (Windows-only) |

XFTA also runs BDT (REA/MCUB/PUB) and ZBDD PUB for standalone timing — no SCRAM equivalent.

Cutoff: **1e-12** for all MCS runs. Timeout: **5 min** per model.

> **Note on ZEBRA MCS counts:** ZEBRA's ZTDD algorithm factorizes the cut set space differently from BDD/ZBDD-based solvers. Even in expanded-MCS mode (`/ZTDD=2`), ZEBRA may produce fewer cut sets than SCRAM (e.g., 224 vs 392 for `chinese.xml`). This is an algorithmic difference, not an error. MCS counts from ZEBRA are reported as informational in Experiments 7b and 7c.

---

## Solvers

| Solver | Algorithm | Input | Notes |
|---|---|---|---|
| SCRAM | BDD, ZBDD | OpenPSA XML | Built from source in Docker |
| XFTA | BDD, BDT, ZBDD | S2ML/SBE | Pre-built Linux binary (`xftar`); skips NOT/XOR models |
| FTREX | BDD, ZBDD | FTAP (`.ftp`) | Windows binary, run via Wine; skips NOT/XOR models |
| PRAXIS | BDD, ZBDD | OpenPSA XML | Built from source in Docker; handles NOT/XOR natively |
| ZEBRA | ZTDD | FTAP (`.ftp`) | Windows binary, run via Wine; requires VC++ 2013 DLLs bundled |
| SAPHSOLVE | MOCUS+MCUB | JSInp (JSON) | **Windows-only** (`SolverSaphire.dll`); conversion runs in Docker, solve step skipped |

---

## Requirements

- Docker
- ARALIA dataset at `fixtures/models/aralia-fault-tree-dataset/data/openpsa`
- XFTA Linux binary at `apps/solvers/xfta/xftar`

---

## Run

From the repo root:

```bash
MSYS_NO_PATHCONV=1 docker compose \
  -f deploy/tools/benchmarking/docker-compose.yml up --build
```

Override the input dataset:

```bash
BENCHMARK_INPUT_DIR=/absolute/path/to/models \
MSYS_NO_PATHCONV=1 docker compose \
  -f deploy/tools/benchmarking/docker-compose.yml up --build
```

> **Windows / Git Bash:** `MSYS_NO_PATHCONV=1` is required to prevent path conversion.

---

## Results

All output is written to `fixtures/results/`.

### Timing (hyperfine JSON + Markdown)

| File pattern | Solver | Run |
|---|---|---|
| `scram_bdd_*` | SCRAM | BDD |
| `scram_zbdd_rea_*` | SCRAM | ZBDD + REA |
| `scram_zbdd_mcub_*` | SCRAM | ZBDD + MCUB |
| `xfta_bdd_*` | XFTA | BDD |
| `xfta_bdt_rea/mcub/pub_*` | XFTA | BDT (3 approximations) |
| `xfta_zbdd_rea/mcub/pub_*` | XFTA | ZBDD (3 approximations) |
| `ftrex_bdd_*` | FTREX | BDD |
| `ftrex_zbdd_*` | FTREX | ZBDD |
| `praxis_bdd_*` | PRAXIS | BDD |
| `praxis_zbdd_rea_*` | PRAXIS | ZBDD + REA |
| `praxis_zbdd_mcub_*` | PRAXIS | ZBDD + MCUB |
| `zebra_ztdd_bdd_*` | ZEBRA | ZTDD `/ZTDD=0` (BDD probability) |
| `zebra_ztdd_mcs_*` | ZEBRA | ZTDD `/ZTDD=2` (expanded MCS) |
| `saphsolve_*` | SAPHSOLVE | MOCUS+MCUB (**Windows-only**; absent in Docker runs) |

### Comparisons (CSV)

| File | Experiment |
|---|---|
| `exp1_bdd_comparison_*.csv` | SCRAM BDD vs XFTA BDD — probability |
| `exp2_zbdd_rea_comparison_*.csv` | SCRAM ZBDD REA vs XFTA ZBDD REA — probability + MCS |
| `exp3_zbdd_mcub_comparison_*.csv` | SCRAM ZBDD MCUB vs XFTA ZBDD MCUB — probability + MCS |
| `exp4_bdd_scram_praxis_*.csv` | SCRAM BDD vs PRAXIS BDD — probability |
| `exp5_zbdd_rea_scram_praxis_*.csv` | SCRAM ZBDD REA vs PRAXIS ZBDD REA — probability + MCS |
| `exp6_zbdd_mcub_scram_praxis_*.csv` | SCRAM ZBDD MCUB vs PRAXIS ZBDD MCUB — probability + MCS |
| `exp7a_bdd_scram_zebra_*.csv` | SCRAM BDD vs ZEBRA ZTDD BDD — probability |
| `exp7b_zbdd_rea_scram_zebra_*.csv` | SCRAM ZBDD REA vs ZEBRA ZTDD P_SUM — probability + MCS (info) |
| `exp7c_zbdd_mcub_scram_zebra_*.csv` | SCRAM ZBDD MCUB vs ZEBRA ZTDD P_MCUB — probability + MCS (info) |
| `exp8_zbdd_mcub_scram_saphsolve_*.csv` | SCRAM ZBDD MCUB vs SAPHSOLVE MOCUS+MCUB — probability + MCS (**Windows-only**) |

### Interactive HTML Report

`benchmark_report_<dataset>_<date>.html` — open in any browser; fully self-contained (no internet required).

Contains four interactive charts:

| Chart | Description |
|---|---|
| Timing Distribution | Box plot: wall-clock time per solver × algorithm; hover points to identify models |
| Timing Heatmap | log₁₀(time) per model × solver; Plasma colorscale; white gaps = solver skipped model |
| Comparison Status | Green ✓ / Red ✗ / Grey — grid per model × experiment; hover for probability and MCS details |
| Experiment Summary | Stacked bar: OK / MISMATCH / missing count per experiment |

### Solver-incompatible models

Models containing `<not>` or `<xor>` gates are skipped for XFTA and FTREX/ZEBRA (FTAP-based):
`cea9601`, `das9601`, `das9701`.

PRAXIS handles these natively and runs on all models.
