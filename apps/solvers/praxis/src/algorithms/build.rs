use std::collections::HashMap;
use std::time::{Duration, Instant};

use tracing::info;

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::pdag::{NodeIndex, Pdag};
use crate::algorithms::reorder::{best_order, ReorderMethod};
use crate::algorithms::simplify;
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef};
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::core::fault_tree::FaultTree;
use crate::Result;

#[derive(Debug, Clone, Copy)]
pub struct BuildOptions {

    pub fold_constants: bool,

    pub splice_null_gates: bool,

    pub reorder: Option<ReorderMethod>,

    pub reorder_budget: Duration,
}

impl Default for BuildOptions {
    fn default() -> Self {
        BuildOptions {
            fold_constants: false,
            splice_null_gates: false,
            reorder: None,
            reorder_budget: Duration::from_secs(10),
        }
    }
}

pub struct BddBuild {
    pub pdag: Pdag,
    pub var_of: HashMap<NodeIndex, usize>,
    pub order: Vec<NodeIndex>,
    pub bdd: Bdd,
    pub root: BddRef,
}

pub fn build_bdd(fault_tree: &FaultTree, opts: BuildOptions) -> Result<BddBuild> {
    let started = Instant::now();
    let mut pdag = Pdag::from_fault_tree(fault_tree)?;
    info!(pdag_nodes = pdag.node_count(), "build_bdd: PDAG built");
    if opts.fold_constants {
        simplify::fold_constants(&mut pdag)?;
    }
    if opts.splice_null_gates {
        simplify::splice_null_and_not(&mut pdag)?;
    }

    let ordering = Instant::now();
    let order = if let Some(method) = opts.reorder {
        best_order(&pdag, method, opts.reorder_budget)
    } else {
        compute_dfs_metadata_pdag(&pdag)?.variable_order
    };
    info!(
        method = ?opts.reorder,
        variables = order.len(),
        elapsed_s = ordering.elapsed().as_secs_f64(),
        "build_bdd: variable order ready"
    );

    let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
    for (pos, &idx) in order.iter().enumerate() {
        var_of.insert(idx.abs(), pos);
    }

    let var_probs = pdag.level_var_probs(fault_tree, &var_of)?;
    let constructing = Instant::now();
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(&pdag, &var_of, var_probs)?;
    info!(
        bdd_nodes = bdd.node_count(),
        construct_s = constructing.elapsed().as_secs_f64(),
        total_s = started.elapsed().as_secs_f64(),
        "build_bdd: BDD constructed"
    );

    Ok(BddBuild {
        pdag,
        var_of,
        order,
        bdd,
        root,
    })
}

pub fn build_sequence_bdd(
    pdag: &Pdag,
    event_probs: &HashMap<String, f64>,
) -> Result<(Vec<NodeIndex>, Bdd, BddRef)> {
    let meta = compute_dfs_metadata_pdag(pdag)?;
    let var_probs = pdag.level_var_probs_from_map(event_probs, &meta.var_of);
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(pdag, &meta.var_of, var_probs)?;
    Ok((meta.variable_order, bdd, root))
}

pub fn enumerate_event_names(
    zbdd: &ZbddEngine,
    root: ZbddRef,
    pdag: &Pdag,
    order: &[NodeIndex],
) -> Vec<Vec<String>> {
    zbdd.enumerate(root)
        .iter()
        .map(|set| {
            let mut events: Vec<String> = set
                .iter()
                .filter_map(|&pos| {
                    order
                        .get(pos)
                        .and_then(|&idx| pdag.get_node(idx))
                        .and_then(|node| node.id().map(|id| id.to_string()))
                })
                .collect();
            events.sort();
            events
        })
        .collect()
}
