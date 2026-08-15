#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct HclBridgeStats {
    pub quantifications: u64,
    pub bdd_context_cache_hits: u64,
    pub bdd_context_cache_misses: u64,
    pub bn_query_cache_hits: u64,
    pub bn_query_cache_misses: u64,
}
