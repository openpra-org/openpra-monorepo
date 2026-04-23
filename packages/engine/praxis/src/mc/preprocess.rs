//! MC-minimal preprocessing for PDAGs.
//!
//! This is intentionally much lighter than `algorithms::preprocessor` and is scoped
//! specifically for Monte Carlo execution:
//! - Remove `NULL` (pass-through) gates by bypassing them.
//! - Eliminate explicit `NOT` gates by converting them into complemented edges.
//!
//! The PDAG data structure does not currently support deleting nodes; instead,
//! this pass rewrites parent operand lists (and the root) so that `NULL`/`NOT`
//! nodes become unreachable from the root.

use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::Result;

pub fn preprocess_for_mc(pdag: &mut Pdag) -> Result<()> {
    // Iteratively rewrite until no more bypassable NULL/NOT nodes exist.
    // (A single pass is typically enough, but iteration is cheap and safer.)
    let mut max_iters = 32;
    while max_iters > 0 {
        max_iters -= 1;
        let mut changed = false;

        let indices: Vec<NodeIndex> = pdag.nodes().keys().copied().collect();

        for idx in indices {
            let idx = idx.abs();
            let Some(node) = pdag.get_node(idx).cloned() else {
                continue;
            };

            match node {
                PdagNode::Gate {
                    connective: Connective::Null,
                    operands,
                    ..
                } => {
                    if operands.len() == 1 {
                        bypass_gate(pdag, idx, operands[0])?;
                        changed = true;
                    }
                }
                PdagNode::Gate {
                    connective: Connective::Not,
                    operands,
                    ..
                } => {
                    if operands.len() == 1 {
                        // NOT(x) becomes complemented edge to x.
                        bypass_gate(pdag, idx, -operands[0])?;
                        changed = true;
                    }
                }
                _ => {}
            }
        }

        if !changed {
            break;
        }
    }

    Ok(())
}

fn bypass_gate(pdag: &mut Pdag, gate_index: NodeIndex, replacement: NodeIndex) -> Result<()> {
    let gate_index = gate_index.abs();

    // Rewrite all parents to reference `replacement` instead of this gate.
    let parent_list: Vec<NodeIndex> = pdag
        .parents()
        .get(&gate_index)
        .map(|set| set.iter().copied().collect())
        .unwrap_or_default();

    for parent in parent_list {
        let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(parent).cloned() else {
            continue;
        };

        let new_operands: Vec<NodeIndex> = operands
            .into_iter()
            .map(|op| {
                if op.abs() == gate_index {
                    if op < 0 {
                        -replacement
                    } else {
                        replacement
                    }
                } else {
                    op
                }
            })
            .collect();

        pdag.update_gate_operands(parent, new_operands)?;
    }

    // Rewrite root if it points to this gate.
    if let Some(root) = pdag.root() {
        if root.abs() == gate_index {
            let new_root = if root < 0 { -replacement } else { replacement };
            pdag.set_root(new_root)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mc::plan::{ConnectiveRank, DpMcPlan, RunParams};

    fn eval_pdag_root(pdag: &Pdag, plan: &DpMcPlan, leaf: &[(NodeIndex, bool)]) -> bool {
        let max_idx = pdag
            .nodes()
            .keys()
            .map(|i| i.unsigned_abs() as usize)
            .max()
            .unwrap_or(0);
        let mut states: Vec<Option<bool>> = vec![None; max_idx + 1];

        for &(idx, v) in leaf {
            states[idx.unsigned_abs() as usize] = Some(v);
        }

        for layer in &plan.layers {
            for gates in layer.gates_by_connective.values() {
                for &g in gates {
                    let g = g.abs();
                    let PdagNode::Gate {
                        connective,
                        operands,
                        min_number,
                        index,
                        ..
                    } = pdag.get_node(g).unwrap().clone()
                    else {
                        continue;
                    };

                    let mut ops = Vec::with_capacity(operands.len());
                    for op in operands {
                        let mut v = states[op.unsigned_abs() as usize].unwrap();
                        if op < 0 {
                            v = !v;
                        }
                        ops.push(v);
                    }

                    let out = match connective {
                        Connective::And => ops.iter().all(|&x| x),
                        Connective::Or => ops.iter().any(|&x| x),
                        Connective::Not => !ops[0],
                        Connective::Null => ops[0],
                        Connective::Xor => ops.iter().filter(|&&x| x).count() % 2 == 1,
                        Connective::Nand => !ops.iter().all(|&x| x),
                        Connective::Nor => !ops.iter().any(|&x| x),
                        Connective::Iff => {
                            let true_count = ops.iter().filter(|&&x| x).count();
                            true_count == 0 || true_count == ops.len()
                        }
                        Connective::AtLeast => {
                            let k = min_number.unwrap_or(0);
                            ops.iter().filter(|&&x| x).count() >= k
                        }
                    };

                    states[index as usize] = Some(out);
                }
            }
        }

        let mut out = states[plan.root.unsigned_abs() as usize].unwrap();
        if plan.root < 0 {
            out = !out;
        }
        out
    }

    #[test]
    fn preprocess_removes_not_and_null_from_reachable_plan() {
        // Root = OR(NULL(NOT(E1)), E2)  =>  (!E1) OR E2
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        let not_e1 = pdag
            .add_gate("N1".to_string(), Connective::Not, vec![e1], None)
            .unwrap();
        let null_not_e1 = pdag
            .add_gate("U1".to_string(), Connective::Null, vec![not_e1], None)
            .unwrap();

        let root = pdag
            .add_gate(
                "ROOT".to_string(),
                Connective::Or,
                vec![null_not_e1, e2],
                None,
            )
            .unwrap();
        pdag.set_root(root).unwrap();

        // Baseline plan should include NOT/NULL.
        let plan_before = DpMcPlan::from_pdag(&pdag, RunParams::new(1, 1, 1, 64, 0)).unwrap();
        let has_not_before = plan_before.layers.iter().any(|l| {
            l.gates_by_connective
                .contains_key(&ConnectiveRank::of(Connective::Not))
        });
        let has_null_before = plan_before.layers.iter().any(|l| {
            l.gates_by_connective
                .contains_key(&ConnectiveRank::of(Connective::Null))
        });
        assert!(has_not_before);
        assert!(has_null_before);

        preprocess_for_mc(&mut pdag).unwrap();
        let plan_after = DpMcPlan::from_pdag(&pdag, RunParams::new(1, 1, 1, 64, 0)).unwrap();

        for layer in &plan_after.layers {
            for nodes in layer.gates_by_connective.values() {
                for &node in nodes {
                    let PdagNode::Gate { connective, .. } = pdag.get_node(node).unwrap() else {
                        continue;
                    };
                    assert!(!matches!(connective, Connective::Not | Connective::Null));
                }
            }
        }

        // Semantics preserved for all 4 combinations.
        let combos = [(false, false), (false, true), (true, false), (true, true)];
        for (v1, v2) in combos {
            let before = eval_pdag_root(&pdag, &plan_after, &[(e1, v1), (e2, v2)]);
            let expected = (!v1) || v2;
            assert_eq!(before, expected);
        }
    }
}
