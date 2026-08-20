use std::collections::{HashMap, HashSet};

use crate::algorithms::bdd_engine::{Bdd, BddRef};

enum Child<'a> {
    Constant(f64),
    Direct(&'a [f64]),
    Complement(&'a [f64]),
}

impl Child<'_> {
    fn at(&self, k: usize) -> f64 {
        match self {
            Child::Constant(value) => *value,
            Child::Direct(slice) => slice[k],
            Child::Complement(slice) => 1.0 - slice[k],
        }
    }
}

fn resolve<'a>(reference: BddRef, memo: &'a HashMap<i32, Vec<f64>>) -> Child<'a> {
    if reference.is_true() {
        return Child::Constant(1.0);
    }
    if reference.is_false() {
        return Child::Constant(0.0);
    }
    let base = memo[&reference.regular().raw()].as_slice();
    if reference.is_complement() {
        Child::Complement(base)
    } else {
        Child::Direct(base)
    }
}

pub fn probability_vectored(bdd: &Bdd, root: BddRef, columns: &[Vec<f64>], n: usize) -> Vec<f64> {
    if root.is_true() {
        return vec![1.0; n];
    }
    if root.is_false() {
        return vec![0.0; n];
    }

    let mut order: Vec<BddRef> = Vec::new();
    let mut visited: HashSet<i32> = HashSet::new();
    let mut stack: Vec<(BddRef, bool)> = vec![(root.regular(), false)];
    while let Some((node_ref, expanded)) = stack.pop() {
        if expanded {
            order.push(node_ref);
            continue;
        }
        if !visited.insert(node_ref.raw()) {
            continue;
        }
        stack.push((node_ref, true));
        let node = bdd.node(node_ref);
        if !node.high.is_terminal() {
            stack.push((node.high.regular(), false));
        }
        if !node.low.is_terminal() {
            stack.push((node.low.regular(), false));
        }
    }

    let mut memo: HashMap<i32, Vec<f64>> = HashMap::with_capacity(order.len());
    for node_ref in &order {
        let node = bdd.node(*node_ref);
        let column = &columns[node.var];
        let probability: Vec<f64> = {
            let high = resolve(node.high, &memo);
            let low = resolve(node.low, &memo);
            (0..n)
                .map(|k| column[k] * high.at(k) + (1.0 - column[k]) * low.at(k))
                .collect()
        };
        memo.insert(node_ref.raw(), probability);
    }

    let root_child = resolve(root, &memo);
    (0..n).map(|k| root_child.at(k)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::bdd_engine::Bdd;
    use crate::algorithms::pdag::Pdag;
    use crate::analysis::width::compute_dfs_metadata_pdag;
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    fn and_tree() -> FaultTree {
        let mut ft = FaultTree::new("FT", "top").unwrap();
        let mut gate = Gate::new("top".to_string(), Formula::And).unwrap();
        gate.add_operand("A".to_string());
        gate.add_operand("B".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("A".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("B".to_string(), 0.2).unwrap())
            .unwrap();
        ft
    }

    fn build(ft: &FaultTree) -> (Bdd, BddRef) {
        let pdag = Pdag::from_fault_tree(ft).unwrap();
        let meta = compute_dfs_metadata_pdag(&pdag).unwrap();
        let var_probs = pdag.level_var_probs(ft, &meta.var_of).unwrap();
        Bdd::from_pdag_with_order_and_probs(&pdag, &meta.var_of, var_probs).unwrap()
    }

    #[test]
    fn vectored_matches_scalar_with_nominal_columns() {
        let ft = and_tree();
        let (bdd, root) = build(&ft);
        let scalar = bdd.probability(root);

        let columns: Vec<Vec<f64>> = bdd.var_probs().iter().map(|&p| vec![p; 3]).collect();
        let vectored = probability_vectored(&bdd, root, &columns, 3);

        assert_eq!(vectored.len(), 3);
        for value in &vectored {
            assert!((value - scalar).abs() < 1e-12);
        }
    }

    #[test]
    fn vectored_handles_distinct_lanes() {
        let ft = and_tree();
        let (bdd, root) = build(&ft);
        assert_eq!(bdd.var_probs().len(), 2);

        let columns = vec![vec![0.1, 0.5, 1.0], vec![0.2, 0.5, 1.0]];
        let result = probability_vectored(&bdd, root, &columns, 3);

        assert!((result[0] - 0.02).abs() < 1e-12);
        assert!((result[1] - 0.25).abs() < 1e-12);
        assert!((result[2] - 1.0).abs() < 1e-12);
    }

    #[test]
    fn vectored_terminal_roots() {
        let ft = and_tree();
        let (bdd, _) = build(&ft);
        let columns: Vec<Vec<f64>> = bdd.var_probs().iter().map(|&p| vec![p; 4]).collect();
        assert_eq!(
            probability_vectored(&bdd, crate::algorithms::bdd_engine::BDD_TRUE, &columns, 4),
            vec![1.0; 4]
        );
        assert_eq!(
            probability_vectored(&bdd, crate::algorithms::bdd_engine::BDD_FALSE, &columns, 4),
            vec![0.0; 4]
        );
    }
}
