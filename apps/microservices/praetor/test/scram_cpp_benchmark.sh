#!/usr/bin/env bash
set -euo pipefail

# Always work from the directory where this script resides so that relative paths (models/, results/) resolve correctly.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

OUTPUT_DIR="results/1E-12"
mkdir -p "${OUTPUT_DIR}"

MODEL_DIR="../fixtures/models"
MODELS=(
  "ATRS"
  "CRW"
  "LOHTL"
  "LOOP"
  "PCL"
  "SGTL-M"
  "SGTL-S"
)

run_case() {
  local model_name="$1"
  local output_suffix="$2"
  shift 2
  local output_file="${OUTPUT_DIR}/${model_name}_${output_suffix}.xml"
  local model_path="${MODEL_DIR}/${model_name}.xml"
  echo "Running scram-cli for ${model_name} (${output_suffix})"
  scram-cli "$@" --cut-off 1e-12 -o "${output_file}" "${model_path}"
}

# MOCUS + MCUB
for model in "${MODELS[@]}"; do
  run_case "${model}" "mocus_mcub" --mocus --mcub --probability
done

# MOCUS + Rare-Event
for model in "${MODELS[@]}"; do
  run_case "${model}" "mocus_rare-event" --mocus --rare-event --probability
done

# BDD + Prime Implicants
for model in "${MODELS[@]}"; do
  run_case "${model}" "bdd_prime-implicants" --bdd --probability --prime-implicants
done

# ZBDD + MCUB
for model in "${MODELS[@]}"; do
  run_case "${model}" "zbdd_mcub" --zbdd --mcub --probability
done

# ZBDD + Rare-Event
for model in "${MODELS[@]}"; do
  run_case "${model}" "zbdd_rare-event" --zbdd --rare-event --probability
done

# Monte Carlo Probability Only
for model in "${MODELS[@]}"; do
  run_case "${model}" "monte-carlo" --pdag --monte-carlo --probability --num-trials 1000000
done

# BDD Probability Only
for model in "${MODELS[@]}"; do
  run_case "${model}" "bdd" --bdd --probability
done

echo "All scram-cli benchmark runs completed. Results are in ${OUTPUT_DIR}"