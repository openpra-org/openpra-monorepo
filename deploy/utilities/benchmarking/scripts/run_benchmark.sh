#!/bin/bash
set -e

MODEL=${MODEL_NAME:-aralia}
CURRENT_DATE=$(date +"%Y-%m-%d")
SOLVER_TIMEOUT=${SOLVER_TIMEOUT:-300}

# =============================================================================
# Directory layout
#
# XFTA runs  (7 algorithms):
#   1. BDD
#   2. BDT  REA  (rare-event approximation)
#   3. BDT  MCUB (mincut upper bound)
#   4. BDT  PUB  (pivotal upper bound)      [XFTA-only, no SCRAM equivalent]
#   5. ZBDD REA
#   6. ZBDD MCUB
#   7. ZBDD PUB                             [XFTA-only, no SCRAM equivalent]
#
# SCRAM runs (3 algorithms):
#   1. BDD             (exact, --bdd)
#   2. ZBDD + REA      (--zbdd --rare-event --cut-off 1e-12)
#   3. ZBDD + MCUB     (--zbdd --mcub      --cut-off 1e-12)
#
# PRAXIS runs (3 algorithms — runs all models including NOT/XOR):
#   1. BDD             (exact, --algorithm bdd)
#   2. ZBDD + REA      (--algorithm zbdd --approximation rare-event --cut-off 1e-12)
#   3. ZBDD + MCUB     (--algorithm zbdd --approximation mcub      --cut-off 1e-12)
#
# SAPHSOLVE runs (1 algorithm, Windows-only DLL — conversion runs in Docker):
#   XML → JSInp conversion (Python, Linux-safe)
#   MOCUS + MCUB           (SolverSaphire.dll, Windows-only — skipped in Docker)
#
# Comparisons (10, paired by equivalent algorithm):
#   Exp 1: SCRAM BDD       vs XFTA BDD       — probability only
#   Exp 2: SCRAM ZBDD REA  vs XFTA ZBDD REA  — probability + MCS count
#   Exp 3: SCRAM ZBDD MCUB vs XFTA ZBDD MCUB — probability + MCS count
#   Exp 4: SCRAM BDD       vs PRAXIS BDD      — probability only
#   Exp 5: SCRAM ZBDD REA  vs PRAXIS ZBDD REA — probability + MCS count
#   Exp 6: SCRAM ZBDD MCUB vs PRAXIS ZBDD MCUB— probability + MCS count
#   Exp 7a-c: SCRAM vs ZEBRA ZTDD             — probability (MCS informational)
#   Exp 8: SCRAM ZBDD MCUB vs SAPHSOLVE MOCUS+MCUB — prob + MCS (Windows-only)
# =============================================================================
RESULTS_DIR="/benchmark/results"
SBE_DIR="/benchmark/sbe"

# XFTA script directories
XFTA_SCRIPTS_BDD="$RESULTS_DIR/xfta_scripts/bdd"
XFTA_SCRIPTS_BDT_REA="$RESULTS_DIR/xfta_scripts/bdt_rea"
XFTA_SCRIPTS_BDT_MCUB="$RESULTS_DIR/xfta_scripts/bdt_mcub"
XFTA_SCRIPTS_BDT_PUB="$RESULTS_DIR/xfta_scripts/bdt_pub"
XFTA_SCRIPTS_ZBDD_REA="$RESULTS_DIR/xfta_scripts/zbdd_rea"
XFTA_SCRIPTS_ZBDD_MCUB="$RESULTS_DIR/xfta_scripts/zbdd_mcub"
XFTA_SCRIPTS_ZBDD_PUB="$RESULTS_DIR/xfta_scripts/zbdd_pub"

# SCRAM output directories (one per SCRAM run)
SCRAM_OUT_BDD="$RESULTS_DIR/scram_bdd_output"
SCRAM_OUT_ZBDD_REA="$RESULTS_DIR/scram_zbdd_rea_output"
SCRAM_OUT_ZBDD_MCUB="$RESULTS_DIR/scram_zbdd_mcub_output"

# XFTA output directories (one per XFTA algorithm)
XFTA_OUT_BDD="$RESULTS_DIR/xfta_bdd_output"
XFTA_OUT_BDT_REA="$RESULTS_DIR/xfta_bdt_rea_output"
XFTA_OUT_BDT_MCUB="$RESULTS_DIR/xfta_bdt_mcub_output"
XFTA_OUT_BDT_PUB="$RESULTS_DIR/xfta_bdt_pub_output"
XFTA_OUT_ZBDD_REA="$RESULTS_DIR/xfta_zbdd_rea_output"
XFTA_OUT_ZBDD_MCUB="$RESULTS_DIR/xfta_zbdd_mcub_output"
XFTA_OUT_ZBDD_PUB="$RESULTS_DIR/xfta_zbdd_pub_output"

# FTREX output directories
FTREX_OUT_BDD="$RESULTS_DIR/ftrex_bdd_output"
FTREX_OUT_ZBDD="$RESULTS_DIR/ftrex_zbdd_output"

# PRAXIS output directories (one per algorithm)
PRAXIS_OUT_BDD="$RESULTS_DIR/praxis_bdd_output"
PRAXIS_OUT_ZBDD_REA="$RESULTS_DIR/praxis_zbdd_rea_output"
PRAXIS_OUT_ZBDD_MCUB="$RESULTS_DIR/praxis_zbdd_mcub_output"

# ZEBRA output directories
ZEBRA_OUT_BDD="$RESULTS_DIR/zebra_ztdd_bdd_output"
ZEBRA_OUT_MCS="$RESULTS_DIR/zebra_ztdd_mcs_output"

# SAPHSOLVE directories
SAPHSOLVE_OUT="/benchmark/results/saphsolve_output"
JSINP_DIR="/benchmark/jsinp"

mkdir -p "$RESULTS_DIR" "$SBE_DIR" "/benchmark/ftp" "$JSINP_DIR" \
    "$XFTA_SCRIPTS_BDD" "$XFTA_SCRIPTS_BDT_REA" "$XFTA_SCRIPTS_BDT_MCUB" "$XFTA_SCRIPTS_BDT_PUB" \
    "$XFTA_SCRIPTS_ZBDD_REA" "$XFTA_SCRIPTS_ZBDD_MCUB" "$XFTA_SCRIPTS_ZBDD_PUB" \
    "$SCRAM_OUT_BDD" "$SCRAM_OUT_ZBDD_REA" "$SCRAM_OUT_ZBDD_MCUB" \
    "$XFTA_OUT_BDD" \
    "$XFTA_OUT_BDT_REA" "$XFTA_OUT_BDT_MCUB" "$XFTA_OUT_BDT_PUB" \
    "$XFTA_OUT_ZBDD_REA" "$XFTA_OUT_ZBDD_MCUB" "$XFTA_OUT_ZBDD_PUB" \
    "$FTREX_OUT_BDD" "$FTREX_OUT_ZBDD" \
    "$PRAXIS_OUT_BDD" "$PRAXIS_OUT_ZBDD_REA" "$PRAXIS_OUT_ZBDD_MCUB" \
    "$ZEBRA_OUT_BDD" "$ZEBRA_OUT_MCS" \
    "$SAPHSOLVE_OUT"

# =============================================================================
# Step 1: Validate OpenPSA XML files against SCRAM's RELAX NG schema
# =============================================================================
echo ""
echo "=== Step 1: Validating OpenPSA XML files ==="
python3 /build/pracciolini/src/openpsa_verifier.py \
    -d /data \
    -r /build/scram/share/input.rng || echo "WARNING: Some XML files failed schema validation — continuing."

# =============================================================================
# Step 2: Convert OpenPSA XML → S2ML+SBE and generate all 7 XFTA script sets
#
#   Models with <not> or <xor> gates are skipped — XFTA cannot evaluate them.
#
#   ZBDD scripts share a common structure:
#     build BDD  (required as input to ZBDD-from-BDD)
#     set option minimum-probability 1e-12
#     build ZBDD-from-BDD
#     compute probability source-handle=ZBDD quantification-method=<method>
#     print minimal-cutsets source-handle=ZBDD
#
#   BDT scripts share a common structure:
#     set option minimum-probability 1e-12
#     build BDT
#     compute probability source-handle=BDT quantification-method=<method>
#     print minimal-cutsets source-handle=BDT
# =============================================================================
echo ""
echo "=== Step 2: Converting OpenPSA XML to S2ML+SBE and generating XFTA scripts ==="

SKIPPED_MODELS=()
CONVERTED_MODELS=()

for openpsa_file in $(find /data -name '*.xml' -type f | sort); do
    base=$(basename "$openpsa_file" .xml)
    sbe_file="$SBE_DIR/$base.sbe"

    if python3 /build/pracciolini/src/convert.py \
            "$openpsa_file" "$sbe_file" 2>/tmp/conv_err.txt; then

        top_event=$(python3 /build/pracciolini/src/convert.py \
            --top-event "$openpsa_file" 2>/dev/null)

        # ── FTAP Conversion ─────────────────────────────────────────────────
        ftp_file="/benchmark/ftp/$base.ftp"
        if python3 /build/pracciolini/src/convert.py \
                "$openpsa_file" "$ftp_file" 2>/dev/null; then
            echo "$top_event" > "/benchmark/ftp/$base.top"
        fi

        # ── 1. XFTA BDD (exact probability, no MCS, no cutoff) ───────────────
        cat > "$XFTA_SCRIPTS_BDD/$base.xfta" << XFTA_BDD
load model "$sbe_file";
build target-model;
build BDD $top_event;
compute probability $top_event output="$XFTA_OUT_BDD/${base}_prob.tsv";
XFTA_BDD

        # ── 2. XFTA BDT REA ──────────────────────────────────────────────────
        cat > "$XFTA_SCRIPTS_BDT_REA/$base.xfta" << XFTA_BDT_REA
load model "$sbe_file";
build target-model;
set option minimum-probability 1e-12;
build BDT $top_event;
compute probability $top_event source-handle=BDT quantification-method=rare-event-approximation output="$XFTA_OUT_BDT_REA/${base}_prob.tsv";
print minimal-cutsets $top_event source-handle=BDT output="$XFTA_OUT_BDT_REA/${base}_mcs.tsv";
XFTA_BDT_REA

        # ── 3. XFTA BDT MCUB ─────────────────────────────────────────────────
        cat > "$XFTA_SCRIPTS_BDT_MCUB/$base.xfta" << XFTA_BDT_MCUB
load model "$sbe_file";
build target-model;
set option minimum-probability 1e-12;
build BDT $top_event;
compute probability $top_event source-handle=BDT quantification-method=mincut-upper-bound output="$XFTA_OUT_BDT_MCUB/${base}_prob.tsv";
print minimal-cutsets $top_event source-handle=BDT output="$XFTA_OUT_BDT_MCUB/${base}_mcs.tsv";
XFTA_BDT_MCUB

        # ── 4. XFTA BDT PUB (default quantification in BDT) ─────────────────
        cat > "$XFTA_SCRIPTS_BDT_PUB/$base.xfta" << XFTA_BDT_PUB
load model "$sbe_file";
build target-model;
set option minimum-probability 1e-12;
build BDT $top_event;
compute probability $top_event source-handle=BDT quantification-method=pivotal-upper-bound output="$XFTA_OUT_BDT_PUB/${base}_prob.tsv";
print minimal-cutsets $top_event source-handle=BDT output="$XFTA_OUT_BDT_PUB/${base}_mcs.tsv";
XFTA_BDT_PUB

        # ── 5. XFTA ZBDD REA ─────────────────────────────────────────────────
        cat > "$XFTA_SCRIPTS_ZBDD_REA/$base.xfta" << XFTA_ZBDD_REA
load model "$sbe_file";
build target-model;
build BDD $top_event;
set option minimum-probability 1e-12;
build ZBDD-from-BDD $top_event;
compute probability $top_event source-handle=ZBDD quantification-method=rare-event-approximation output="$XFTA_OUT_ZBDD_REA/${base}_prob.tsv";
print minimal-cutsets $top_event source-handle=ZBDD output="$XFTA_OUT_ZBDD_REA/${base}_mcs.tsv";
XFTA_ZBDD_REA

        # ── 6. XFTA ZBDD MCUB ────────────────────────────────────────────────
        cat > "$XFTA_SCRIPTS_ZBDD_MCUB/$base.xfta" << XFTA_ZBDD_MCUB
load model "$sbe_file";
build target-model;
build BDD $top_event;
set option minimum-probability 1e-12;
build ZBDD-from-BDD $top_event;
compute probability $top_event source-handle=ZBDD quantification-method=mincut-upper-bound output="$XFTA_OUT_ZBDD_MCUB/${base}_prob.tsv";
print minimal-cutsets $top_event source-handle=ZBDD output="$XFTA_OUT_ZBDD_MCUB/${base}_mcs.tsv";
XFTA_ZBDD_MCUB

        # ── 7. XFTA ZBDD PUB ─────────────────────────────────────────────────
        cat > "$XFTA_SCRIPTS_ZBDD_PUB/$base.xfta" << XFTA_ZBDD_PUB
load model "$sbe_file";
build target-model;
build BDD $top_event;
set option minimum-probability 1e-12;
build ZBDD-from-BDD $top_event;
compute probability $top_event source-handle=ZBDD quantification-method=pivotal-upper-bound output="$XFTA_OUT_ZBDD_PUB/${base}_prob.tsv";
print minimal-cutsets $top_event source-handle=ZBDD output="$XFTA_OUT_ZBDD_PUB/${base}_mcs.tsv";
XFTA_ZBDD_PUB

        echo "  Converted: $base  (top event: $top_event)"
        CONVERTED_MODELS+=("$base")
    else
        reason=$(cat /tmp/conv_err.txt | tail -1)
        echo "  SKIPPED:   $base  ($reason)"
        SKIPPED_MODELS+=("$base")
    fi
done

echo ""
echo "Converted: ${#CONVERTED_MODELS[@]} models"
echo "Skipped:   ${#SKIPPED_MODELS[@]} models (incompatible gates: NOT/XOR)"
if [ ${#SKIPPED_MODELS[@]} -gt 0 ]; then
    echo "  Skipped list: ${SKIPPED_MODELS[*]}"
fi

# =============================================================================
# Step 3: Validate S2ML+SBE files
# =============================================================================
echo ""
echo "=== Step 3: Validating S2ML+SBE files ==="
python3 /build/pracciolini/src/s2ml_verifier.py -d "$SBE_DIR"

# ── Shared helpers ────────────────────────────────────────────────────────────
OPENPSA_FILES=$(find /data -name '*.xml' -type f | sort | tr '\n' ',' | sed 's/,$//')
if [ -z "$OPENPSA_FILES" ]; then
    echo "ERROR: No OpenPSA files found in /data"
    exit 1
fi

scripts_list() { find "$1" -name '*.xfta' -type f | sort | tr '\n' ',' | sed 's/,$//'; }

N_ALL=$(( ${#CONVERTED_MODELS[@]} + ${#SKIPPED_MODELS[@]} ))
N_COMPAT=${#CONVERTED_MODELS[@]}

run_xfta() {
    # run_xfta <label> <scripts_dir> <json_out> <md_out>
    local label="$1" scripts_dir="$2" json_out="$3" md_out="$4"
    local scripts
    scripts=$(scripts_list "$scripts_dir")
    if [ -z "$scripts" ]; then
        echo "WARNING: No scripts in $scripts_dir — skipping."
        return
    fi
    echo ""
    echo "--- $label ($N_COMPAT compatible models) ---"
    hyperfine \
        --warmup 0 --runs 1 --ignore-failure \
        --export-markdown "$md_out" \
        --export-json    "$json_out" \
        --parameter-list script "$scripts" \
        "timeout $SOLVER_TIMEOUT xftar {script}"
    echo "$label complete."
}

# =============================================================================
# SCRAM BENCHMARKS
# =============================================================================
echo ""
echo "###################################################################"
echo "  SCRAM BENCHMARKS"
echo "###################################################################"

# ── SCRAM BDD ─────────────────────────────────────────────────────────────────
echo ""
echo "--- SCRAM BDD ($N_ALL models) ---"
hyperfine \
    --warmup 0 --runs 1 --ignore-failure \
    --export-markdown "$RESULTS_DIR/scram_bdd_${MODEL}_${CURRENT_DATE}_summary.md" \
    --export-json    "$RESULTS_DIR/scram_bdd_${MODEL}_${CURRENT_DATE}_results.json" \
    --parameter-list file "$OPENPSA_FILES" \
    "timeout $SOLVER_TIMEOUT scram --bdd {file} \
        --output $SCRAM_OUT_BDD/\$(basename {file} .xml).xml"
echo "SCRAM BDD complete."

# ── SCRAM ZBDD REA ────────────────────────────────────────────────────────────
echo ""
echo "--- SCRAM ZBDD REA ($N_ALL models) ---"
hyperfine \
    --warmup 0 --runs 1 --ignore-failure \
    --export-markdown "$RESULTS_DIR/scram_zbdd_rea_${MODEL}_${CURRENT_DATE}_summary.md" \
    --export-json    "$RESULTS_DIR/scram_zbdd_rea_${MODEL}_${CURRENT_DATE}_results.json" \
    --parameter-list file "$OPENPSA_FILES" \
    "timeout $SOLVER_TIMEOUT scram --zbdd --rare-event --cut-off 1e-12 {file} \
        --output $SCRAM_OUT_ZBDD_REA/\$(basename {file} .xml).xml"
echo "SCRAM ZBDD REA complete."

# ── SCRAM ZBDD MCUB ───────────────────────────────────────────────────────────
echo ""
echo "--- SCRAM ZBDD MCUB ($N_ALL models) ---"
hyperfine \
    --warmup 0 --runs 1 --ignore-failure \
    --export-markdown "$RESULTS_DIR/scram_zbdd_mcub_${MODEL}_${CURRENT_DATE}_summary.md" \
    --export-json    "$RESULTS_DIR/scram_zbdd_mcub_${MODEL}_${CURRENT_DATE}_results.json" \
    --parameter-list file "$OPENPSA_FILES" \
    "timeout $SOLVER_TIMEOUT scram --zbdd --mcub --cut-off 1e-12 {file} \
        --output $SCRAM_OUT_ZBDD_MCUB/\$(basename {file} .xml).xml"
echo "SCRAM ZBDD MCUB complete."

# =============================================================================
# XFTA BENCHMARKS  (all 7 algorithms)
# =============================================================================
echo ""
echo "###################################################################"
echo "  XFTA BENCHMARKS"
echo "###################################################################"

run_xfta "XFTA BDD" \
    "$XFTA_SCRIPTS_BDD" \
    "$RESULTS_DIR/xfta_bdd_${MODEL}_${CURRENT_DATE}_results.json" \
    "$RESULTS_DIR/xfta_bdd_${MODEL}_${CURRENT_DATE}_summary.md"

run_xfta "XFTA BDT REA" \
    "$XFTA_SCRIPTS_BDT_REA" \
    "$RESULTS_DIR/xfta_bdt_rea_${MODEL}_${CURRENT_DATE}_results.json" \
    "$RESULTS_DIR/xfta_bdt_rea_${MODEL}_${CURRENT_DATE}_summary.md"

run_xfta "XFTA BDT MCUB" \
    "$XFTA_SCRIPTS_BDT_MCUB" \
    "$RESULTS_DIR/xfta_bdt_mcub_${MODEL}_${CURRENT_DATE}_results.json" \
    "$RESULTS_DIR/xfta_bdt_mcub_${MODEL}_${CURRENT_DATE}_summary.md"

run_xfta "XFTA BDT PUB" \
    "$XFTA_SCRIPTS_BDT_PUB" \
    "$RESULTS_DIR/xfta_bdt_pub_${MODEL}_${CURRENT_DATE}_results.json" \
    "$RESULTS_DIR/xfta_bdt_pub_${MODEL}_${CURRENT_DATE}_summary.md"

run_xfta "XFTA ZBDD REA" \
    "$XFTA_SCRIPTS_ZBDD_REA" \
    "$RESULTS_DIR/xfta_zbdd_rea_${MODEL}_${CURRENT_DATE}_results.json" \
    "$RESULTS_DIR/xfta_zbdd_rea_${MODEL}_${CURRENT_DATE}_summary.md"

run_xfta "XFTA ZBDD MCUB" \
    "$XFTA_SCRIPTS_ZBDD_MCUB" \
    "$RESULTS_DIR/xfta_zbdd_mcub_${MODEL}_${CURRENT_DATE}_results.json" \
    "$RESULTS_DIR/xfta_zbdd_mcub_${MODEL}_${CURRENT_DATE}_summary.md"

run_xfta "XFTA ZBDD PUB" \
    "$XFTA_SCRIPTS_ZBDD_PUB" \
    "$RESULTS_DIR/xfta_zbdd_pub_${MODEL}_${CURRENT_DATE}_results.json" \
    "$RESULTS_DIR/xfta_zbdd_pub_${MODEL}_${CURRENT_DATE}_summary.md"

# =============================================================================
# FTREX BENCHMARKS
# =============================================================================
echo ""
echo "###################################################################"
echo "  FTREX BENCHMARKS"
echo "###################################################################"

FTP_FILES=$(find /benchmark/ftp -name '*.ftp' -type f | sort | tr '\n' ',' | sed 's/,$//')

if [ -n "$FTP_FILES" ]; then
    # ── FTREX BDD (Exact) ──────────────────────────────────────────────────────
    echo ""
    echo "--- FTREX BDD ($N_COMPAT models) ---"
    hyperfine \
        --warmup 0 --runs 1 --ignore-failure \
        --export-markdown "$RESULTS_DIR/ftrex_bdd_${MODEL}_${CURRENT_DATE}_summary.md" \
        --export-json    "$RESULTS_DIR/ftrex_bdd_${MODEL}_${CURRENT_DATE}_results.json" \
        --parameter-list file "$FTP_FILES" \
        "timeout $SOLVER_TIMEOUT run_ftrex {file} $FTREX_OUT_BDD/\$(basename {file} .ftp).raw 0.0 /BDD=1"
    echo "FTREX BDD complete."

    # ── FTREX ZBDD (MCS) ───────────────────────────────────────────────────────
    echo ""
    echo "--- FTREX ZBDD REA/MCUB ($N_COMPAT models) ---"
    hyperfine \
        --warmup 0 --runs 1 --ignore-failure \
        --export-markdown "$RESULTS_DIR/ftrex_zbdd_${MODEL}_${CURRENT_DATE}_summary.md" \
        --export-json    "$RESULTS_DIR/ftrex_zbdd_${MODEL}_${CURRENT_DATE}_results.json" \
        --parameter-list file "$FTP_FILES" \
        "timeout $SOLVER_TIMEOUT run_ftrex {file} $FTREX_OUT_ZBDD/\$(basename {file} .ftp).raw 1e-12 /BDD=0"
    echo "FTREX ZBDD complete."
else
    echo "WARNING: No FTAP files found — skipping FTREX benchmarks."
fi

# =============================================================================
# PRAXIS BENCHMARKS
# =============================================================================
echo ""
echo "###################################################################"
echo "  PRAXIS BENCHMARKS"
echo "###################################################################"

# ── PRAXIS BDD ────────────────────────────────────────────────────────────────
echo ""
echo "--- PRAXIS BDD ($N_ALL models) ---"
hyperfine \
    --warmup 0 --runs 1 --ignore-failure \
    --export-markdown "$RESULTS_DIR/praxis_bdd_${MODEL}_${CURRENT_DATE}_summary.md" \
    --export-json    "$RESULTS_DIR/praxis_bdd_${MODEL}_${CURRENT_DATE}_results.json" \
    --parameter-list file "$OPENPSA_FILES" \
    "timeout $SOLVER_TIMEOUT praxis-cli --algorithm bdd \
        --output $PRAXIS_OUT_BDD/\$(basename {file} .xml).xml {file}"
echo "PRAXIS BDD complete."

# ── PRAXIS ZBDD REA ───────────────────────────────────────────────────────────
echo ""
echo "--- PRAXIS ZBDD REA ($N_ALL models) ---"
hyperfine \
    --warmup 0 --runs 1 --ignore-failure \
    --export-markdown "$RESULTS_DIR/praxis_zbdd_rea_${MODEL}_${CURRENT_DATE}_summary.md" \
    --export-json    "$RESULTS_DIR/praxis_zbdd_rea_${MODEL}_${CURRENT_DATE}_results.json" \
    --parameter-list file "$OPENPSA_FILES" \
    "timeout $SOLVER_TIMEOUT praxis-cli --algorithm zbdd --approximation rare-event \
        --cut-off 1e-12 --analysis cutsets-and-probability \
        --output $PRAXIS_OUT_ZBDD_REA/\$(basename {file} .xml).xml {file}"
echo "PRAXIS ZBDD REA complete."

# ── PRAXIS ZBDD MCUB ──────────────────────────────────────────────────────────
echo ""
echo "--- PRAXIS ZBDD MCUB ($N_ALL models) ---"
hyperfine \
    --warmup 0 --runs 1 --ignore-failure \
    --export-markdown "$RESULTS_DIR/praxis_zbdd_mcub_${MODEL}_${CURRENT_DATE}_summary.md" \
    --export-json    "$RESULTS_DIR/praxis_zbdd_mcub_${MODEL}_${CURRENT_DATE}_results.json" \
    --parameter-list file "$OPENPSA_FILES" \
    "timeout $SOLVER_TIMEOUT praxis-cli --algorithm zbdd --approximation mcub \
        --cut-off 1e-12 --analysis cutsets-and-probability \
        --output $PRAXIS_OUT_ZBDD_MCUB/\$(basename {file} .xml).xml {file}"
echo "PRAXIS ZBDD MCUB complete."

# =============================================================================
# ZEBRA BENCHMARKS
# =============================================================================
echo ""
echo "###################################################################"
echo "  ZEBRA BENCHMARKS"
echo "###################################################################"

if [ -n "$FTP_FILES" ]; then
    echo ""
    echo "--- ZEBRA: activating license ---"
    (cd /opt/zebra && wine /opt/zebra/ZEBRA.exe /SERIAL=F26EC9597630EE17 2>&1 | tail -3) || true

    # ── ZEBRA ZTDD BDD probability (/ZTDD=0) ──────────────────────────────────
    echo ""
    echo "--- ZEBRA ZTDD BDD ($N_COMPAT models) ---"
    hyperfine \
        --warmup 0 --runs 1 --ignore-failure \
        --export-markdown "$RESULTS_DIR/zebra_ztdd_bdd_${MODEL}_${CURRENT_DATE}_summary.md" \
        --export-json    "$RESULTS_DIR/zebra_ztdd_bdd_${MODEL}_${CURRENT_DATE}_results.json" \
        --parameter-list file "$FTP_FILES" \
        "timeout $SOLVER_TIMEOUT run_zebra {file} $ZEBRA_OUT_BDD 0"
    echo "ZEBRA ZTDD BDD complete."

    # ── ZEBRA ZTDD expanded MCS + probability (/ZTDD=2) ───────────────────────
    echo ""
    echo "--- ZEBRA ZTDD MCS ($N_COMPAT models) ---"
    hyperfine \
        --warmup 0 --runs 1 --ignore-failure \
        --export-markdown "$RESULTS_DIR/zebra_ztdd_mcs_${MODEL}_${CURRENT_DATE}_summary.md" \
        --export-json    "$RESULTS_DIR/zebra_ztdd_mcs_${MODEL}_${CURRENT_DATE}_results.json" \
        --parameter-list file "$FTP_FILES" \
        "timeout $SOLVER_TIMEOUT run_zebra {file} $ZEBRA_OUT_MCS 2"
    echo "ZEBRA ZTDD MCS complete."
else
    echo "WARNING: No FTAP files found — skipping ZEBRA benchmarks."
fi

# =============================================================================
# SAPHSOLVE BENCHMARKS
# =============================================================================
echo ""
echo "###################################################################"
echo "  SAPHSOLVE BENCHMARKS"
echo "###################################################################"

# ── XML → JSInp conversion (runs in Docker, pure Python) ─────────────────────
echo ""
echo "--- SAPHSOLVE: XML → JSInp conversion ---"
SAPHSOLVE_CONVERTED=()
SAPHSOLVE_SKIPPED=()

for openpsa_file in $(find /data -name '*.xml' -type f | sort); do
    base=$(basename "$openpsa_file" .xml)
    jsinp_file="$JSINP_DIR/$base.JSInp"
    if python3 /build/pracciolini/src/convert.py \
            "$openpsa_file" "$jsinp_file" --cutoff 1e-12 2>/dev/null; then
        echo "  Converted: $base"
        SAPHSOLVE_CONVERTED+=("$base")
    else
        echo "  SKIPPED:   $base  (unsupported gates or parse error)"
        SAPHSOLVE_SKIPPED+=("$base")
    fi
done

echo ""
echo "SAPHSOLVE converted: ${#SAPHSOLVE_CONVERTED[@]} models"
echo "SAPHSOLVE skipped:   ${#SAPHSOLVE_SKIPPED[@]} models"

# ── SAPHSOLVE solve step (Windows-only — skipped when DLL absent) ─────────────
JSINP_FILES=$(find "$JSINP_DIR" -name '*.JSInp' -type f | sort | tr '\n' ',' | sed 's/,$//')

if command -v saphsolve-cli &>/dev/null && [ -n "$JSINP_FILES" ]; then
    echo ""
    echo "--- SAPHSOLVE MOCUS+MCUB (${#SAPHSOLVE_CONVERTED[@]} models) ---"
    hyperfine \
        --warmup 0 --runs 1 --ignore-failure \
        --export-markdown "$RESULTS_DIR/saphsolve_${MODEL}_${CURRENT_DATE}_summary.md" \
        --export-json    "$RESULTS_DIR/saphsolve_${MODEL}_${CURRENT_DATE}_results.json" \
        --parameter-list file "$JSINP_FILES" \
        "timeout $SOLVER_TIMEOUT saphsolve-cli {file} \
            $SAPHSOLVE_OUT/\$(basename {file} .JSInp).JSCut"
    echo "SAPHSOLVE complete."
else
    echo ""
    echo "WARNING: saphsolve-cli not available or no JSInp files — skipping SAPHSOLVE solve step."
fi

# =============================================================================
# PLOTTING
# =============================================================================
echo ""
echo "###################################################################"
echo "  PLOTTING"
echo "###################################################################"
echo ""
echo "--- Generating interactive HTML report ---"
REPORT_PATH="$RESULTS_DIR/benchmark_report_${MODEL}_${CURRENT_DATE}.html"
python3 /build/pracciolini/src/plot_benchmark_results.py \
    --dataset "$MODEL" "$RESULTS_DIR" "/data" \
    --output  "$REPORT_PATH"

# =============================================================================
# Done
# =============================================================================
echo ""
echo "###################################################################"
echo "  All benchmarks and comparisons completed!"
echo "###################################################################"
echo ""
echo "Timing results  (JSON + Markdown) in $RESULTS_DIR/:"
echo "  scram_bdd_*           scram_zbdd_rea_*         scram_zbdd_mcub_*"
echo "  xfta_bdd_*            ftrex_bdd_*              ftrex_zbdd_*"
echo "  xfta_bdt_rea_*        xfta_bdt_mcub_*          xfta_bdt_pub_*"
echo "  xfta_zbdd_rea_*       xfta_zbdd_mcub_*         xfta_zbdd_pub_*"
echo "  praxis_bdd_*          praxis_zbdd_rea_*         praxis_zbdd_mcub_*"
echo "  zebra_ztdd_bdd_*      zebra_ztdd_mcs_*"
echo "  saphsolve_*           (Windows-only; skipped in Docker)"
echo ""
echo "Interactive HTML report:"
echo "  benchmark_report_*                — results table + timing charts, open in any browser"
