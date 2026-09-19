use praxis::analysis::event_tree_quantification::EventTreeSequenceDiagnostics;
use praxis::hcl::{HclBridgeStats, HclJunctionTreeStats};
use serde_json::{json, Value};

// Preserve main HCL's counters and compiled structure statistics at the transport boundary.
pub(crate) fn bridge_stats_json(stats: &HclBridgeStats) -> Value {
    json!({
        "quantifications": stats.quantifications,
        "bddContextCacheHits": stats.bdd_context_cache_hits,
        "bddContextCacheMisses": stats.bdd_context_cache_misses,
        "bnQueryCacheHits": stats.bn_query_cache_hits,
        "bnQueryCacheMisses": stats.bn_query_cache_misses
    })
}

pub(crate) fn junction_tree_stats_json(stats: &HclJunctionTreeStats) -> Value {
    json!({
        "numCliques": stats.num_cliques,
        "maxCliqueSize": stats.max_clique_size,
        "treewidth": stats.treewidth,
        "totalTableEntries": stats.total_table_entries
    })
}

pub(crate) fn sequence_diagnostics_json(stats: &EventTreeSequenceDiagnostics) -> Value {
    json!({
        "bdd": stats.bdd.as_ref().map(|bdd| json!({
            "nodes": bdd.nodes,
            "variables": bdd.variables,
            "variableOrder": bdd.variable_order
        })),
        "bridge": stats.bridge.as_ref().map(bridge_stats_json),
        "junctionTree": stats.junction_tree.as_ref().map(junction_tree_stats_json)
    })
}
