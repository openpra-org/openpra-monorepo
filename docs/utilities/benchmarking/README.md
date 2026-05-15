# Benchmarking Tool

Runs a set of fault tree solvers against a collection of OpenPSA XML models, measures execution time for each solver/algorithm combination, compares probability and minimal cut set (MCS) results, and produces a single self-contained HTML report.

## Solvers

| Solver | Algorithms |
|--------|-----------|
| SCRAM | BDD (exact), ZBDD + REA, ZBDD + MCUB |
| XFTA | BDD, BDT (REA/MCUB/PUB), ZBDD (REA/MCUB/PUB) |
| PRAXIS | BDD, ZBDD + REA, ZBDD + MCUB |
| FTREX | BDD, ZBDD + REA, ZBDD + MCUB |
| ZEBRA | ZTDD BDD, ZTDD REA, ZTDD MCUB |
| SAPHSOLVE | MOCUS + MCUB |

Models with `<not>` or `<xor>` gates are skipped by solvers that do not support them (XFTA, FTREX, ZEBRA).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) — required on all platforms
- The RAPTOR repository cloned locally

## Build the Docker Image

Run from the **repository root**:

**Linux / macOS**
```bash
docker build -f deploy/tools/benchmarking/Dockerfile -t raptor-benchmark:latest .
```

**Windows (PowerShell)**
```powershell
docker build -f deploy/tools/benchmarking/Dockerfile -t raptor-benchmark:latest .
```

This builds all solvers (SCRAM, PRAXIS, SAPHSOLVE cross-compiled for Windows, FTREX via Wine, ZEBRA via Wine, XFTA) into a single image. Build takes several minutes on first run.

## Run the Benchmark

The benchmark script runs inside the container. You mount three paths:

| Mount | Container path | Purpose |
|-------|---------------|---------|
| Directory of OpenPSA XML models | `/data` (read-only) | Input models |
| Directory for output files | `/benchmark/results` | CSVs, logs, HTML report |
| `run_benchmark.sh` script | `/benchmark/scripts/run_benchmark.sh` (read-only) | Benchmark orchestration |

**Linux / macOS**
```bash
docker run --rm \
  -v "/path/to/xml/models:/data:ro" \
  -v "/path/to/results/output:/benchmark/results" \
  -v "$(pwd)/deploy/tools/benchmarking/scripts/run_benchmark.sh:/benchmark/scripts/run_benchmark.sh:ro" \
  raptor-benchmark:latest \
  bash /benchmark/scripts/run_benchmark.sh
```

**Windows (PowerShell)**
```powershell
docker run --rm `
  -v "C:\path\to\xml\models:/data:ro" `
  -v "C:\path\to\results\output:/benchmark/results" `
  -v "${PWD}\deploy\tools\benchmarking\scripts\run_benchmark.sh:/benchmark/scripts/run_benchmark.sh:ro" `
  raptor-benchmark:latest `
  bash /benchmark/scripts/run_benchmark.sh
```

### Example: Aralia Dataset

The Aralia dataset (43 models) is included in the repository under `fixtures/aralia/`.

**Linux / macOS**
```bash
docker run --rm \
  -v "$(pwd)/fixtures/aralia:/data:ro" \
  -v "$(pwd)/fixtures/benchmark_aralia/results:/benchmark/results" \
  -v "$(pwd)/deploy/tools/benchmarking/scripts/run_benchmark.sh:/benchmark/scripts/run_benchmark.sh:ro" \
  raptor-benchmark:latest \
  bash /benchmark/scripts/run_benchmark.sh
```

**Windows (PowerShell)**
```powershell
docker run --rm `
  -v "${PWD}\fixtures\aralia:/data:ro" `
  -v "${PWD}\fixtures\benchmark_aralia\results:/benchmark/results" `
  -v "${PWD}\deploy\tools\benchmarking\scripts\run_benchmark.sh:/benchmark/scripts/run_benchmark.sh:ro" `
  raptor-benchmark:latest `
  bash /benchmark/scripts/run_benchmark.sh
```

The output directory is created automatically if it does not exist.

## What the Benchmark Produces

After completion, the results directory contains:

```
results/
  benchmark_report_<dataset>_<date>.html   ← interactive report (open in browser)
  exp1_bdd_scram_xfta_*.csv               ← per-experiment comparison CSVs
  exp2_zbdd_rea_scram_xfta_*.csv
  ...
  scram_bdd_output/                        ← raw solver output files
  xfta_bdd_output/
  ftrex_bdd_output/
  ...
```

Comparison experiments:

| Experiment | Solvers compared | Metric |
|-----------|-----------------|--------|
| 1 | SCRAM BDD vs XFTA BDD | Probability |
| 2 | SCRAM ZBDD REA vs XFTA ZBDD REA | Probability + MCS count |
| 3 | SCRAM ZBDD MCUB vs XFTA ZBDD MCUB | Probability + MCS count |
| 4 | SCRAM BDD vs PRAXIS BDD | Probability |
| 5 | SCRAM ZBDD REA vs PRAXIS ZBDD REA | Probability + MCS count |
| 6 | SCRAM ZBDD MCUB vs PRAXIS ZBDD MCUB | Probability + MCS count |
| 7a–7c | SCRAM vs ZEBRA ZTDD | Probability |
| 8 | SCRAM ZBDD MCUB vs SAPHSOLVE MOCUS+MCUB | Probability + MCS count |
| 9a | SCRAM BDD vs FTREX BDD | Probability |
| 9b | SCRAM ZBDD REA vs FTREX ZBDD REA | Probability + MCS count |
| 9c | SCRAM ZBDD MCUB vs FTREX ZBDD MCUB | Probability + MCS count |

## View the Report

Open the generated HTML file directly in any modern browser — no server required.

**Linux / macOS**
```bash
open fixtures/benchmark_aralia/results/benchmark_report_aralia_<date>.html
```

**Windows (PowerShell)**
```powershell
Start-Process "fixtures\benchmark_aralia\results\benchmark_report_aralia_<date>.html"
```

Or double-click the file in your file manager.

The report has a sidebar listing all models. Click a model name to view:
- A table of top event probability and MCS count for each solver/algorithm
- An interactive bar chart of execution times across all algorithms

SCRAM BDD is the probability reference (marked `†`); SCRAM ZBDD REA is the MCS reference (marked `‡`). Reference rows are highlighted in the table.
