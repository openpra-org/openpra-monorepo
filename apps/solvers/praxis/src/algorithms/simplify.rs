//! Optional, function-preserving PDAG simplifications.
//!
//! These are standalone rewrites that any engine path may apply when it wants a
//! smaller or connective-restricted graph. They are not a mandatory stage: the
//! BDD, ZBDD and Monte Carlo kernels all consume the raw connective set, so
//! these are applied only where they actually help (the Monte Carlo kernel,
//! which has no NULL/NOT cases, and the optional house-event simplification of
//! the analytic build).

use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::Result;

/// Rewire every parent of `gate_index` (and the root, if it is that gate) so the
/// reference points at `replacement` instead, preserving edge sign.
fn bypass_gate(pdag: &mut Pdag, gate_index: NodeIndex, replacement: NodeIndex) -> Result<()> {
    let gate_index = gate_index.abs();

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

    if let Some(root) = pdag.root() {
        if root.abs() == gate_index {
            let new_root = if root < 0 { -replacement } else { replacement };
            pdag.set_root(new_root)?;
        }
    }

    Ok(())
}

/// Splice out single-operand NULL (pass-through) gates and fold NOT gates into a
/// complemented edge to their operand, iterating to a fixed point. After this
/// the reachable graph contains no NULL or NOT gates. Function-preserving.
///
/// This is the single null/not simplification in the codebase. The Monte Carlo
/// kernel relies on it to keep its bitwise gate evaluator free of NULL/NOT
/// cases, and the analytic build may apply it as part of the optional
/// house-event simplification.
pub fn splice_null_and_not(pdag: &mut Pdag) -> Result<()> {
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
                } if operands.len() == 1 => {
                    bypass_gate(pdag, idx, operands[0])?;
                    changed = true;
                }
                PdagNode::Gate {
                    connective: Connective::Not,
                    operands,
                    ..
                } if operands.len() == 1 => {
                    bypass_gate(pdag, idx, -operands[0])?;
                    changed = true;
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

fn const_value_of(pdag: &Pdag, op: NodeIndex) -> Option<bool> {
    match pdag.get_node(op) {
        Some(PdagNode::Constant { value, .. }) => Some(if op < 0 { !*value } else { *value }),
        _ => None,
    }
}

fn make_constant(pdag: &mut Pdag, index: NodeIndex, value: bool) -> Result<()> {
    let cidx = pdag.add_constant(value);
    let parent_list: Vec<NodeIndex> = pdag
        .parents()
        .get(&index.abs())
        .map(|set| set.iter().copied().collect())
        .unwrap_or_default();
    for parent in parent_list {
        if let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(parent).cloned() {
            let new_operands: Vec<NodeIndex> = operands
                .iter()
                .map(|&op| {
                    if op == index {
                        cidx
                    } else if op == -index {
                        -cidx
                    } else {
                        op
                    }
                })
                .collect();
            pdag.update_gate_operands(parent, new_operands)?;
        }
    }
    if let Some(root) = pdag.root() {
        if root.abs() == index.abs() {
            let signed = if root < 0 { -cidx } else { cidx };
            pdag.set_root(signed)?;
        }
    }
    pdag.remove_node(index)?;
    Ok(())
}

fn collapse_gate(
    pdag: &mut Pdag,
    index: NodeIndex,
    connective: Connective,
    kept: Vec<NodeIndex>,
    empty_value: bool,
) -> Result<()> {
    if kept.is_empty() {
        make_constant(pdag, index, empty_value)?;
    } else if kept.len() == 1 {
        pdag.update_gate_connective(index, Connective::Null)?;
        pdag.update_gate_operands(index, kept)?;
    } else {
        pdag.update_gate_connective(index, connective)?;
        pdag.update_gate_operands(index, kept)?;
    }
    Ok(())
}

fn fold_constants_once(pdag: &mut Pdag) -> Result<bool> {
    let mut changed = false;
    let indices: Vec<NodeIndex> = pdag.nodes().keys().copied().collect();
    for index in indices {
        let (conn, ops) = match pdag.get_node(index) {
            Some(PdagNode::Gate {
                connective,
                operands,
                ..
            }) => (*connective, operands.clone()),
            _ => continue,
        };
        match conn {
            Connective::And => {
                if ops
                    .iter()
                    .any(|&op| const_value_of(pdag, op) == Some(false))
                {
                    make_constant(pdag, index, false)?;
                    changed = true;
                    continue;
                }
                let kept: Vec<NodeIndex> = ops
                    .iter()
                    .copied()
                    .filter(|&op| const_value_of(pdag, op) != Some(true))
                    .collect();
                if kept.len() != ops.len() {
                    collapse_gate(pdag, index, Connective::And, kept, true)?;
                    changed = true;
                }
            }
            Connective::Or => {
                if ops.iter().any(|&op| const_value_of(pdag, op) == Some(true)) {
                    make_constant(pdag, index, true)?;
                    changed = true;
                    continue;
                }
                let kept: Vec<NodeIndex> = ops
                    .iter()
                    .copied()
                    .filter(|&op| const_value_of(pdag, op) != Some(false))
                    .collect();
                if kept.len() != ops.len() {
                    collapse_gate(pdag, index, Connective::Or, kept, false)?;
                    changed = true;
                }
            }
            Connective::Null => {
                if let Some(&op) = ops.first() {
                    if let Some(v) = const_value_of(pdag, op) {
                        make_constant(pdag, index, v)?;
                        changed = true;
                    }
                }
            }
            _ => {}
        }
    }
    Ok(changed)
}

/// Fold constant and house-event leaves through AND/OR/NULL gate logic to a
/// fixed point, function-preserving. AND with a false child becomes false, OR
/// with a true child becomes true, true/false children drop out of AND/OR, and a
/// NULL over a constant becomes that constant. Optional, for models that carry
/// house events or constants; the BDD folds these natively so it is never
/// required for correctness.
pub fn fold_constants(pdag: &mut Pdag) -> Result<()> {
    while fold_constants_once(pdag)? {}
    Ok(())
}

/// Result-preserving constant propagation. Pushes the literal operands of every
/// AND gate down into its sibling operands (cofactoring), deleting logically dead
/// terms such as `A AND NOT A` before any diagram is built. It never folds P=1 or
/// P=0 events away, so cut-set literals are preserved. Identical rebuilt gates are
/// shared and a node cap bounds expansion on a shared graph; if the cap is hit the
/// root is left untouched.
pub fn propagate_constants(pdag: &mut Pdag) -> Result<()> {
    let Some(root) = pdag.root() else {
        return Ok(());
    };
    let cap = pdag.node_count() * 6 + 4096;
    let mut cf = Cofactorer {
        true_const: pdag.add_constant(true),
        false_const: pdag.add_constant(false),
        memo: std::collections::HashMap::new(),
        gate_memo: std::collections::HashMap::new(),
        next_id: 0,
        created: 0,
        cap,
        aborted: false,
    };
    let env: std::collections::BTreeSet<NodeIndex> = std::collections::BTreeSet::new();
    let new_root = cf.go(pdag, root, &env)?;
    if !cf.aborted {
        pdag.set_root(new_root)?;
    }
    Ok(())
}

struct Cofactorer {
    true_const: NodeIndex,
    false_const: NodeIndex,
    memo: std::collections::HashMap<(NodeIndex, Vec<NodeIndex>), NodeIndex>,
    gate_memo: std::collections::HashMap<(Connective, Option<usize>, Vec<NodeIndex>), NodeIndex>,
    next_id: usize,
    created: usize,
    cap: usize,
    aborted: bool,
}

impl Cofactorer {
    fn k(&self, value: bool) -> NodeIndex {
        if value {
            self.true_const
        } else {
            self.false_const
        }
    }

    fn cval(&self, pdag: &Pdag, node: NodeIndex) -> Option<bool> {
        match pdag.get_node(node) {
            Some(PdagNode::Constant { value, .. }) => Some(if node < 0 { !*value } else { *value }),
            _ => None,
        }
    }

    fn neg(&self, pdag: &Pdag, node: NodeIndex) -> NodeIndex {
        match self.cval(pdag, node) {
            Some(v) => self.k(!v),
            None => -node,
        }
    }

    fn gate(
        &mut self,
        pdag: &mut Pdag,
        conn: Connective,
        ops: Vec<NodeIndex>,
        min: Option<usize>,
    ) -> Result<NodeIndex> {
        let mut sorted = ops.clone();
        sorted.sort();
        let key = (conn, min, sorted);
        if let Some(&g) = self.gate_memo.get(&key) {
            return Ok(g);
        }
        self.next_id += 1;
        self.created += 1;
        let g = pdag.add_gate(format!("__cf{}", self.next_id), conn, ops, min)?;
        self.gate_memo.insert(key, g);
        Ok(g)
    }

    fn go(
        &mut self,
        pdag: &mut Pdag,
        node: NodeIndex,
        env: &std::collections::BTreeSet<NodeIndex>,
    ) -> Result<NodeIndex> {
        if self.created > self.cap {
            self.aborted = true;
            return Ok(node);
        }
        let base = node.abs();
        let neg = node < 0;
        if env.contains(&base) {
            return Ok(self.k(!neg));
        }
        if env.contains(&-base) {
            return Ok(self.k(neg));
        }
        let key = (base, env.iter().copied().collect::<Vec<_>>());
        if let Some(&m) = self.memo.get(&key) {
            return Ok(if neg { self.neg(pdag, m) } else { m });
        }
        let cloned = pdag.get_node(base).cloned();
        let result = match cloned {
            Some(PdagNode::BasicEvent { .. }) => base,
            Some(PdagNode::Constant { .. }) => base,
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => self.gate_node(pdag, base, connective, operands, min_number, env)?,
            None => self.k(false),
        };
        self.memo.insert(key, result);
        Ok(if neg { self.neg(pdag, result) } else { result })
    }

    fn gate_node(
        &mut self,
        pdag: &mut Pdag,
        base: NodeIndex,
        conn: Connective,
        operands: Vec<NodeIndex>,
        min: Option<usize>,
        env: &std::collections::BTreeSet<NodeIndex>,
    ) -> Result<NodeIndex> {
        match conn {
            Connective::And | Connective::Nand => {
                let mut sub = env.clone();
                for &op in &operands {
                    if matches!(pdag.get_node(op), Some(PdagNode::BasicEvent { .. })) {
                        sub.insert(op);
                    }
                }
                let value = if sub.iter().any(|&lit| sub.contains(&-lit)) {
                    self.k(false)
                } else {
                    let mut kept: Vec<NodeIndex> = Vec::new();
                    let mut seen: std::collections::HashSet<NodeIndex> =
                        std::collections::HashSet::new();
                    let mut dead = false;
                    let mut changed = false;
                    for &op in &operands {
                        let is_lit = matches!(pdag.get_node(op), Some(PdagNode::BasicEvent { .. }));
                        let c = if is_lit {
                            if env.contains(&op) {
                                changed = true;
                                self.k(true)
                            } else if env.contains(&-op) {
                                changed = true;
                                self.k(false)
                            } else {
                                op
                            }
                        } else {
                            let cc = self.go(pdag, op, &sub)?;
                            if cc != op {
                                changed = true;
                            }
                            cc
                        };
                        match self.cval(pdag, c) {
                            Some(false) => {
                                dead = true;
                                break;
                            }
                            Some(true) => {
                                changed = true;
                            }
                            None => {
                                if seen.contains(&self.neg(pdag, c)) {
                                    dead = true;
                                    break;
                                }
                                if seen.insert(c) {
                                    kept.push(c);
                                } else {
                                    changed = true;
                                }
                            }
                        }
                    }
                    if dead {
                        self.k(false)
                    } else if !changed {
                        base
                    } else if kept.is_empty() {
                        self.k(true)
                    } else if kept.len() == 1 {
                        kept[0]
                    } else {
                        self.gate(pdag, Connective::And, kept, None)?
                    }
                };
                Ok(if conn == Connective::Nand {
                    if value == base {
                        base
                    } else {
                        self.neg(pdag, value)
                    }
                } else {
                    value
                })
            }
            Connective::Or | Connective::Nor => {
                let mut kept: Vec<NodeIndex> = Vec::new();
                let mut seen: std::collections::HashSet<NodeIndex> =
                    std::collections::HashSet::new();
                let mut alive = false;
                let mut changed = false;
                for &op in &operands {
                    let c = self.go(pdag, op, env)?;
                    if c != op {
                        changed = true;
                    }
                    match self.cval(pdag, c) {
                        Some(true) => {
                            alive = true;
                            break;
                        }
                        Some(false) => {
                            changed = true;
                        }
                        None => {
                            if seen.contains(&self.neg(pdag, c)) {
                                alive = true;
                                break;
                            }
                            if seen.insert(c) {
                                kept.push(c);
                            } else {
                                changed = true;
                            }
                        }
                    }
                }
                let value = if alive {
                    self.k(true)
                } else if !changed {
                    base
                } else if kept.is_empty() {
                    self.k(false)
                } else if kept.len() == 1 {
                    kept[0]
                } else {
                    self.gate(pdag, Connective::Or, kept, None)?
                };
                Ok(if conn == Connective::Nor {
                    if value == base {
                        base
                    } else {
                        self.neg(pdag, value)
                    }
                } else {
                    value
                })
            }
            Connective::Not => {
                if let Some(&op0) = operands.first() {
                    let c = self.go(pdag, op0, env)?;
                    if c == op0 {
                        Ok(base)
                    } else {
                        Ok(self.neg(pdag, c))
                    }
                } else {
                    Ok(base)
                }
            }
            Connective::Null => {
                if let Some(&op) = operands.first() {
                    let c = self.go(pdag, op, env)?;
                    if c == op {
                        Ok(base)
                    } else {
                        Ok(c)
                    }
                } else {
                    Ok(self.k(false))
                }
            }
            Connective::AtLeast => {
                let mut t = 0usize;
                let mut kept: Vec<NodeIndex> = Vec::new();
                let mut changed = false;
                for &op in &operands {
                    let c = self.go(pdag, op, env)?;
                    if c != op {
                        changed = true;
                    }
                    match self.cval(pdag, c) {
                        Some(true) => t += 1,
                        Some(false) => {}
                        None => kept.push(c),
                    }
                }
                let need = min.unwrap_or(1).saturating_sub(t);
                if need == 0 {
                    Ok(self.k(true))
                } else if kept.len() < need {
                    Ok(self.k(false))
                } else if !changed {
                    Ok(base)
                } else if need == 1 {
                    if kept.len() == 1 {
                        Ok(kept[0])
                    } else {
                        self.gate(pdag, Connective::Or, kept, None)
                    }
                } else if need == kept.len() {
                    self.gate(pdag, Connective::And, kept, None)
                } else {
                    self.gate(pdag, Connective::AtLeast, kept, Some(need))
                }
            }
            Connective::Xor | Connective::Iff => {
                let mut new_ops = Vec::with_capacity(operands.len());
                let mut changed = false;
                for &op in &operands {
                    let c = self.go(pdag, op, env)?;
                    if c != op {
                        changed = true;
                    }
                    new_ops.push(c);
                }
                if !changed {
                    Ok(base)
                } else {
                    self.gate(pdag, conn, new_ops, min)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::bdd_engine::Bdd;

    #[test]
    fn splice_removes_null_and_not_and_preserves_function() {
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

        let original = pdag.clone();
        splice_null_and_not(&mut pdag).unwrap();

        // No NULL or NOT gates remain in the graph reachable from the root.
        let mut seen = std::collections::HashSet::new();
        let mut stack = vec![pdag.root().unwrap().abs()];
        while let Some(idx) = stack.pop() {
            if !seen.insert(idx) {
                continue;
            }
            if let Some(PdagNode::Gate {
                connective,
                operands,
                ..
            }) = pdag.get_node(idx)
            {
                assert!(!matches!(connective, Connective::Null | Connective::Not));
                for &op in operands {
                    stack.push(op.abs());
                }
            }
        }
        // Function unchanged: (!E1) | E2.
        assert!(Bdd::equivalent(&original, &pdag).unwrap());
    }

    #[test]
    fn fold_constants_simplifies_and_preserves_function() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let true_const = pdag.add_constant(true);
        let false_const = pdag.add_constant(false);
        let or = pdag
            .add_gate(
                "G_or".to_string(),
                Connective::Or,
                vec![e1, false_const],
                None,
            )
            .unwrap();
        let root = pdag
            .add_gate(
                "G_and".to_string(),
                Connective::And,
                vec![or, true_const],
                None,
            )
            .unwrap();
        pdag.set_root(root).unwrap();

        let original = pdag.clone();
        fold_constants(&mut pdag).unwrap();

        // No Constant leaves remain reachable from the root.
        let mut seen = std::collections::HashSet::new();
        let mut stack = vec![pdag.root().unwrap().abs()];
        while let Some(idx) = stack.pop() {
            if !seen.insert(idx) {
                continue;
            }
            match pdag.get_node(idx) {
                Some(PdagNode::Constant { .. }) => panic!("constant survived folding"),
                Some(PdagNode::Gate { operands, .. }) => {
                    for &op in operands {
                        stack.push(op.abs());
                    }
                }
                _ => {}
            }
        }
        // Function unchanged: AND(OR(E1, false), true) == E1.
        assert!(Bdd::equivalent(&original, &pdag).unwrap());
    }
}
