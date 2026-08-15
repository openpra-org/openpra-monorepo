#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [path-to-bncore]" >&2
  exit 2
fi

bncore_source_dir="${1:-${BNCORE_SOURCE_DIR:-}}"
if [[ -z "${bncore_source_dir}" ]]; then
  echo "provide the bncore source directory as the first argument or BNCORE_SOURCE_DIR" >&2
  exit 2
fi
if [[ ! -f "${bncore_source_dir}/include/bncore/graph/graph.hpp" ]]; then
  echo "not a bncore source tree: ${bncore_source_dir}" >&2
  exit 2
fi

crate_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/tensorbayes-equivalence.XXXXXX")"
trap 'rm -rf "${build_dir}"' EXIT
oracle="${build_dir}/bncore_oracle"

"${CXX:-c++}" -std=c++20 -O2 -pthread \
  -I"${bncore_source_dir}/include" \
  "${crate_dir}/verification/cpp_oracle.cpp" \
  "${bncore_source_dir}/src/graph.cpp" \
  "${bncore_source_dir}/src/dense_tensor.cpp" \
  "${bncore_source_dir}/src/factor.cpp" \
  "${bncore_source_dir}/src/junction_tree.cpp" \
  "${bncore_source_dir}/src/compiler.cpp" \
  "${bncore_source_dir}/src/workspace.cpp" \
  "${bncore_source_dir}/src/engine.cpp" \
  -o "${oracle}"

TENSORBAYES_BNCORE_ORACLE="${oracle}" \
  cargo test --manifest-path "${crate_dir}/Cargo.toml" \
  --test cpp_equivalence -- --ignored --nocapture
