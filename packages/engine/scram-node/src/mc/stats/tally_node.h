#pragma once

#include <memory>
#include <unordered_map>
#include <utility>
#include <ranges>

#include "pdag.h"  // forward declaration of core::Node lives here
#include "tally.h" // tally definition

namespace scram::core {
class Node; // forward declaration (full type in pdag.h)
} // namespace scram::core

namespace scram::mc::stats {

using mef_type = mef::Gate; //std::variant<mef::Gate, mef::InitiatingEvent>;

enum convergence : std::int8_t {
    unknown       = -2,
    not_tracked   = -1,
    not_converged =  0,
    converged     =  1,
};

/// A convenience aggregate that couples a Monte-Carlo tally with the PDAG
/// node it describes.  This lets a single map keyed on the PDAG node index
/// expose *both* statistical information and the underlying graph structure
/// without having to maintain multiple parallel containers.
struct TallyNode {
    convergence status;                      ///< State of convergence
    tally tally_stats;                       ///< Monte-Carlo statistics
    std::shared_ptr<core::Node> node;        ///< Owning/shared pointer to the PDAG node
};

// ---------------------------------------------------------------------------
//  Range-based projection helpers (C++20 views)
// ---------------------------------------------------------------------------
//  All helpers return *views* (no allocations, O(1) adapters) that yield
//  references into the underlying container, so you can freely mutate the
//  objects you obtain.  They are intentionally free functions so you can use
//  ADL or explicit qualification:   for (auto &t : scram::mc::stats::tallies(map)) { … }
// ---------------------------------------------------------------------------

/// View of (index, tally) pairs.
/// The result can be used in a structured binding loop:
///     for (auto [idx, t] : tally_view(monitored)) { t.reset(); }
template <class MonitoredMap>
inline auto tally_view(MonitoredMap &monitored) {
    using pair_ref = std::pair<const int &, tally &>;
    return monitored | std::views::transform([](auto &kv) -> pair_ref {
        return {kv.first, kv.second.tally_stats};
    });
}

/// View of (index, node) pairs – references mutate the shared_ptr itself.
template <class MonitoredMap>
inline auto node_view(MonitoredMap &monitored) {
    using node_ref = std::shared_ptr<scram::core::Node> &;
    using pair_ref = std::pair<const int &, node_ref>;
    return monitored | std::views::transform([](auto &kv) -> pair_ref {
        return {kv.first, kv.second.node};
    });
}

/// View of tally values only.
template <class MonitoredMap>
inline auto tallies(MonitoredMap &monitored) {
    return monitored | std::views::values |
           std::views::transform([](auto &tn) -> tally & { return tn.tally_stats; });
}

/// View of node shared_ptrs only.
template <class MonitoredMap>
inline auto nodes(MonitoredMap &monitored) {
    return monitored | std::views::values |
           std::views::transform([](auto &tn) -> std::shared_ptr<scram::core::Node> & { return tn.node; });
}

} // namespace scram::mc::stats 