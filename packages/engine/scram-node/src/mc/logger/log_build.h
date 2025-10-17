#pragma once

#include "mc/logger/csv.h"
#include "version.h"

#include <string>
#include <vector>

namespace scram::log::build {

inline auto csv_pairs() {
    using pair_t = std::pair<std::string, std::string>;
    std::vector<pair_t> kv;
#ifdef SCRAM_BUILD_TYPE
    kv.emplace_back("build_type", csv_string(SCRAM_BUILD_TYPE));
#else
#ifdef NDEBUG
    kv.emplace_back("build_type", "release");
#else
    kv.emplace_back("build_type", "debug");
#endif
#endif
#ifdef SCRAM_VERSION
    kv.emplace_back("version", SCRAM_VERSION);
#endif
#ifdef SCRAM_GIT_REVISION
    kv.emplace_back("git_revision", SCRAM_GIT_REVISION);
#endif
    kv.emplace_back("optimize_native", csv_string(SCRAM_OPTIMIZE_NATIVE));
    kv.emplace_back("malloc_type", csv_string(SCRAM_MALLOC_TYPE));
    return kv;
}

} // namespace scram::log::build
