//! The single BDD construction entry point.
//!
//! Every analytic consumer (top-event probability, ZBDD cut sets, prime
//! implicants, importance, uncertainty, event-tree sequence formulas) builds its
//! diagram through [`build_bdd`]. This replaces the hand-copied
//! `from_fault_tree -> dfs_metadata -> level_var_probs -> from_pdag_with_order_and_probs`
//! sequence that used to appear at a dozen call sites.

use std::collections::HashMap;
use std::time::Duration;

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::pdag::{NodeIndex, Pdag};
use crate::algorithms::reorder::{best_order, ReorderMethod};
use crate::algorithms::simplify;
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef};
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::core::fault_tree::FaultTree;
use crate::Result;

/// Optional transforms applied before the BDD is built. All default off: the BDD
/// consumes every connective natively and folds constants and pass-through gates
/// itself, so none of these change the resulting diagram. They exist for callers
/// that want a smaller intermediate PDAG (house-event models) or a reordered
/// diagram.
#[derive(Debug, Clone, Copy)]
pub struct BuildOptions {
    /// Fold constant and house-event leaves through the gate logic.
    pub fold_constants: bool,
    /// Splice out NULL pass-through gates and NOT gates.
    pub splice_null_gates: bool,
    /// Reorder the variables with the given method before building.
    pub reorder: Option<ReorderMethod>,
    /// Time budget for reordering.
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

/// The PDAG and its BDD, plus the variable order used to build it. The order and
/// PDAG are needed by the cut-set and prime-implicant consumers to map BDD
/// positions back to event identifiers.
pub struct BddBuild {
    pub pdag: Pdag,
    pub var_of: HashMap<NodeIndex, usize>,
    pub order: Vec<NodeIndex>,
    pub bdd: Bdd,
    pub root: BddRef,
}

/// Build the PDAG and BDD for `fault_tree` under `opts`.
pub fn build_bdd(fault_tree: &FaultTree, opts: BuildOptions) -> Result<BddBuild> {
    let mut pdag = Pdag::from_fault_tree(fault_tree)?;
    if opts.fold_constants {
        simplify::fold_constants(&mut pdag)?;
    }
    if opts.splice_null_gates {
        simplify::splice_null_and_not(&mut pdag)?;
    }

    let order = if let Some(method) = opts.reorder {
        best_order(&pdag, method, opts.reorder_budget)
    } else {
        compute_dfs_metadata_pdag(&pdag)?.variable_order
    };

    let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
    for (pos, &idx) in order.iter().enumerate() {
        var_of.insert(idx.abs(), pos);
    }

    let var_probs = pdag.level_var_probs(fault_tree, &var_of)?;
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(&pdag, &var_of, var_probs)?;

    Ok(BddBuild {
        pdag,
        var_of,
        order,
        bdd,
        root,
    })
}

/// Order an already-rooted PDAG (a single sequence formula sharing a common
/// event-tree PDAG) and build its BDD, taking per-variable probabilities from
/// `event_probs` keyed by event id. This is the tail that the event-tree
/// sequence builders share, distinct from [`build_bdd`] only in that the PDAG is
/// supplied pre-built with its root already set and probabilities come from a map
/// rather than a fault tree. Returns the DFS variable order, the BDD, and its
/// root.
pub fn build_sequence_bdd(
    pdag: &Pdag,
    event_probs: &HashMap<String, f64>,
) -> Result<(Vec<NodeIndex>, Bdd, BddRef)> {
    let meta = compute_dfs_metadata_pdag(pdag)?;
    let var_probs = pdag.level_var_probs_from_map(event_probs, &meta.var_of);
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(pdag, &meta.var_of, var_probs)?;
    Ok((meta.variable_order, bdd, root))
}

/// Enumerate the cut sets of a ZBDD into sorted lists of basic-event identifiers,
/// mapping each diagram position back through the variable order and PDAG. This
/// is the single enumeration both the command-line and the contract paths use to
/// turn a ZBDD into named cut sets.
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
