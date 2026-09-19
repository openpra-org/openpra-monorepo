//! Resource reporting at the addon boundary; inference code is unchanged.
use praxis::{hcl::HclUncertaintySettings, Result};
use serde_json::{json, Value};
use tensorbayes::{BayesianGraph, CompileHeuristic, CompiledJunctionTree};

pub(crate) fn no_clique() -> Value {
    json!({"scope": "CLIQUE_MEMORY_PREFLIGHT", "largestTable": null})
}

pub(crate) fn sample_batch(settings: Option<&HclUncertaintySettings>, executing: bool) -> usize {
    // The existing HCL_MH port evaluates sample slices of at most 256.
    if executing {
        settings.map_or(1, |settings| settings.sample_count.min(256))
    } else {
        1
    }
}

pub(crate) fn network(graph: BayesianGraph, batch_size: usize) -> Result<Value> {
    // Call the original compiler. Compilation produces scopes and statistics,
    // without allocating the dense tables used by InferenceWorkspace::calibrate.
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill)?;
    let mut largest = None;
    for clique in tree.cliques() {
        let entries = clique.scope().iter().try_fold(1usize, |entries, &node| {
            Ok::<_, tensorbayes::Error>(entries * tree.graph().variable(node)?.cardinality())
        })?;
        if largest
            .as_ref()
            .is_none_or(|(_, current)| entries > *current)
        {
            largest = Some((clique, entries));
        }
    }
    let Some((clique, entries)) = largest else {
        return Ok(no_clique());
    };
    // Decimal strings preserve exact counts beyond JavaScript's integer range.
    let bytes = entries as u128 * batch_size as u128 * size_of::<f64>() as u128;
    Ok(json!({
        "scope": "CLIQUE_MEMORY_PREFLIGHT",
        "largestTable": {
            "cliqueId": clique.id(),
            "nodeIds": clique.scope().iter().map(|&node|
                tree.graph().variable(node).map(|variable| variable.name())
            ).collect::<std::result::Result<Vec<_>, _>>()?,
            "scalarEntries": entries.to_string(),
            "batchSize": batch_size,
            "bytes": bytes.to_string()
        }
    }))
}
