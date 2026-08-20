use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::Result;
use std::collections::{BTreeMap, HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RunParams {
    pub t: usize,
    pub b: usize,
    pub p: usize,
    pub omega: usize,
    pub seed: u64,
}

impl RunParams {
    pub const DEFAULT_OMEGA: usize = 64;

    pub fn new(t: usize, b: usize, p: usize, omega: usize, seed: u64) -> Self {
        Self { t, b, p, omega, seed }
    }

    pub fn trials_per_iteration(&self) -> usize {
        self.b * self.p * self.omega
    }

    pub fn total_trials_covered(&self) -> usize {
        self.t * self.trials_per_iteration()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NumTrialsLayout {
    pub params: RunParams,
    pub padded_trials_per_iteration: usize,
    pub valid_lanes_last_word: u32,
}

pub fn choose_run_params_for_num_trials(num_trials: usize, seed: u64) -> Result<NumTrialsLayout> {
    if num_trials == 0 {
        return Err(crate::error::PraxisError::Settings(
            "Number of trials must be greater than 0".to_string(),
        ));
    }

    let omega = RunParams::DEFAULT_OMEGA;
    let b = 1usize;
    let p = num_trials.div_ceil(omega);
    let padded = b * p * omega;
    let valid_lanes_last_word = (num_trials % omega) as u32;

    Ok(NumTrialsLayout {
        params: RunParams::new(1, b, p, omega, seed),
        padded_trials_per_iteration: padded,
        valid_lanes_last_word,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LayerPlan {
    pub depth: usize,
    pub basic_events: Vec<NodeIndex>,
    pub constants: Vec<NodeIndex>,
    pub gates_by_connective: BTreeMap<ConnectiveRank, Vec<NodeIndex>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GateInput {
    pub index: NodeIndex,
    pub is_negated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GateDescriptor {
    pub connective: Connective,
    pub operands: Vec<GateInput>,
    pub min_number: Option<usize>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ConnectiveRank(pub u8);

impl ConnectiveRank {
    pub fn of(connective: Connective) -> Self {
        let rank = match connective {
            Connective::And => 10,
            Connective::Or => 20,
            Connective::Xor => 30,
            Connective::Iff => 35,
            Connective::AtLeast => 40,
            Connective::Nand => 50,
            Connective::Nor => 60,
            Connective::Not => 70,
            Connective::Null => 80,
        };
        Self(rank)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DpMcPlan {
    pub params: RunParams,
    pub root: NodeIndex,
    pub depths: HashMap<NodeIndex, usize>,
    pub layers: Vec<LayerPlan>,
    pub gates: HashMap<NodeIndex, GateDescriptor>,
}

impl DpMcPlan {
    pub fn from_pdag(pdag: &Pdag, params: RunParams) -> Result<Self> {
        let root = pdag.root().ok_or_else(|| {
            crate::error::PraxisError::Logic("PDAG has no root; cannot build DPMC plan".to_string())
        })?;

        let reachable = collect_reachable_abs_nodes(pdag, root);
        let depths = compute_depths(pdag, &reachable);

        let mut gates: HashMap<NodeIndex, GateDescriptor> = HashMap::new();
        for &node in &reachable {
            if let Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) = pdag.get_node(node)
            {
                let ops = operands
                    .iter()
                    .map(|&op| GateInput {
                        index: op.abs(),
                        is_negated: op < 0,
                    })
                    .collect();

                gates.insert(
                    node.abs(),
                    GateDescriptor {
                        connective: *connective,
                        operands: ops,
                        min_number: *min_number,
                    },
                );
            }
        }

        let max_depth = depths.values().copied().max().unwrap_or(0);
        let mut layers = Vec::with_capacity(max_depth + 1);

        for depth in 0..=max_depth {
            let mut basic_events = Vec::new();
            let mut constants = Vec::new();
            let mut gates_by_connective: BTreeMap<ConnectiveRank, Vec<NodeIndex>> = BTreeMap::new();

            for &node in &reachable {
                if depths.get(&node).copied().unwrap_or(0) != depth {
                    continue;
                }

                match pdag.get_node(node) {
                    Some(PdagNode::BasicEvent { .. }) => basic_events.push(node),
                    Some(PdagNode::Constant { .. }) => constants.push(node),
                    Some(PdagNode::Gate { connective, .. }) => {
                        let rank = ConnectiveRank::of(*connective);
                        gates_by_connective.entry(rank).or_default().push(node);
                    }
                    None => {}
                }
            }

            sort_nodes_deterministically(pdag, &mut basic_events);
            sort_nodes_deterministically(pdag, &mut constants);
            for nodes in gates_by_connective.values_mut() {
                sort_nodes_deterministically(pdag, nodes);
            }

            layers.push(LayerPlan {
                depth,
                basic_events,
                constants,
                gates_by_connective,
            });
        }

        Ok(Self {
            params,
            root,
            depths,
            layers,
            gates,
        })
    }
}

fn collect_reachable_abs_nodes(pdag: &Pdag, root: NodeIndex) -> Vec<NodeIndex> {
    let root = root.abs();
    let mut stack = vec![root];
    let mut visited: HashSet<NodeIndex> = HashSet::new();

    while let Some(node) = stack.pop() {
        if !visited.insert(node) {
            continue;
        }

        if let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(node) {
            for &op in operands {
                stack.push(op.abs());
            }
        }
    }

    let mut out: Vec<NodeIndex> = visited.into_iter().collect();
    out.sort_unstable();
    out
}

fn compute_depths(pdag: &Pdag, nodes: &[NodeIndex]) -> HashMap<NodeIndex, usize> {
    let node_set: HashSet<NodeIndex> = nodes.iter().copied().collect();
    let mut memo: HashMap<NodeIndex, usize> = HashMap::new();

    for &node in nodes {
        let _ = compute_depth(pdag, node, &node_set, &mut memo);
    }

    memo
}

fn compute_depth(
    pdag: &Pdag,
    node: NodeIndex,
    node_set: &HashSet<NodeIndex>,
    memo: &mut HashMap<NodeIndex, usize>,
) -> usize {
    let node = node.abs();

    if let Some(&d) = memo.get(&node) {
        return d;
    }

    let depth = match pdag.get_node(node) {
        Some(PdagNode::BasicEvent { .. }) | Some(PdagNode::Constant { .. }) => 0,
        Some(PdagNode::Gate { operands, .. }) => {
            let mut max_child = 0usize;
            for &op in operands {
                let child = op.abs();
                if !node_set.contains(&child) {
                    continue;
                }
                max_child = max_child.max(compute_depth(pdag, child, node_set, memo));
            }
            max_child + 1
        }
        None => 0,
    };

    memo.insert(node, depth);
    depth
}

fn sort_nodes_deterministically(pdag: &Pdag, nodes: &mut [NodeIndex]) {
    nodes.sort_unstable_by(|a, b| {
        let ka = node_sort_key(pdag, *a);
        let kb = node_sort_key(pdag, *b);
        ka.cmp(&kb)
    });
}

fn node_sort_key(pdag: &Pdag, node: NodeIndex) -> (u8, String, NodeIndex) {
    match pdag.get_node(node) {
        Some(PdagNode::BasicEvent { id, index }) => (0, id.clone(), *index),
        Some(PdagNode::Constant { index, .. }) => (1, String::new(), *index),
        Some(PdagNode::Gate { id, index, .. }) => (2, id.clone(), *index),
        None => (3, String::new(), node.abs()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn choose_run_params_covers_num_trials_with_padding() {
        let cases: &[(usize, usize, u32)] = &[
            (1, 64, 1),
            (63, 64, 63),
            (64, 64, 0),
            (65, 128, 1),
            (127, 128, 63),
            (128, 128, 0),
        ];

        for &(num_trials, padded_trials, valid_lanes_last_word) in cases {
            let chosen = choose_run_params_for_num_trials(num_trials, 123).unwrap();
            assert_eq!(chosen.params.omega, 64);
            assert_eq!(chosen.params.t, 1);
            assert_eq!(chosen.params.b, 1);
            assert_eq!(chosen.padded_trials_per_iteration, padded_trials);
            assert_eq!(chosen.valid_lanes_last_word, valid_lanes_last_word);
            assert!(chosen.padded_trials_per_iteration >= num_trials);
            assert!(chosen
                .padded_trials_per_iteration
                .is_multiple_of(chosen.params.omega));
        }
    }

    #[test]
    fn choose_run_params_rejects_zero_trials() {
        let err = choose_run_params_for_num_trials(0, 0).unwrap_err();
        let msg = format!("{err}");
        assert!(msg.to_lowercase().contains("trials"));
    }

    #[test]
    fn plan_layers_are_correct_and_deterministic() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        let g1 = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();

        let root = pdag
            .add_gate("Root".to_string(), Connective::Or, vec![g1, e2], None)
            .unwrap();

        pdag.set_root(root).unwrap();

        let params = RunParams::new(1, 1, 1, 64, 123);

        let plan1 = DpMcPlan::from_pdag(&pdag, params).unwrap();
        let plan2 = DpMcPlan::from_pdag(&pdag, params).unwrap();

        assert_eq!(plan1, plan2, "plan should be deterministic");
        assert_eq!(plan1.depths.get(&e1.abs()).copied(), Some(0));
        assert_eq!(plan1.depths.get(&e2.abs()).copied(), Some(0));
        assert_eq!(plan1.depths.get(&g1.abs()).copied(), Some(1));
        assert_eq!(plan1.depths.get(&root.abs()).copied(), Some(2));

        assert_eq!(plan1.layers.len(), 3);

        let g1_desc = plan1.gates.get(&g1.abs()).expect("g1 gate descriptor");
        assert_eq!(g1_desc.connective, Connective::And);
        assert_eq!(
            g1_desc.operands,
            vec![
                GateInput {
                    index: e1.abs(),
                    is_negated: false
                },
                GateInput {
                    index: e2.abs(),
                    is_negated: false
                },
            ]
        );

        let root_desc = plan1.gates.get(&root.abs()).expect("root gate descriptor");
        assert_eq!(root_desc.connective, Connective::Or);
        assert_eq!(
            root_desc.operands,
            vec![
                GateInput {
                    index: g1.abs(),
                    is_negated: false
                },
                GateInput {
                    index: e2.abs(),
                    is_negated: false
                },
            ]
        );

        let layer0 = &plan1.layers[0];
        assert_eq!(layer0.depth, 0);
        assert_eq!(layer0.basic_events.len(), 2);
        assert_eq!(layer0.basic_events, vec![e1, e2]);
        assert!(layer0.gates_by_connective.is_empty());

        let layer1 = &plan1.layers[1];
        assert_eq!(layer1.depth, 1);
        let and_rank = ConnectiveRank::of(Connective::And);
        assert_eq!(
            layer1.gates_by_connective.get(&and_rank).cloned(),
            Some(vec![g1])
        );

        let layer2 = &plan1.layers[2];
        assert_eq!(layer2.depth, 2);
        let or_rank = ConnectiveRank::of(Connective::Or);
        assert_eq!(
            layer2.gates_by_connective.get(&or_rank).cloned(),
            Some(vec![root])
        );
    }

    #[test]
    fn plan_respects_complemented_edges_for_reachability() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        let root = pdag
            .add_gate("Root".to_string(), Connective::And, vec![e1, -e2], None)
            .unwrap();
        pdag.set_root(root).unwrap();

        let plan = DpMcPlan::from_pdag(&pdag, RunParams::new(1, 1, 1, 64, 0)).unwrap();

        assert!(plan.depths.contains_key(&e1.abs()));
        assert!(plan.depths.contains_key(&e2.abs()));
        assert!(plan.depths.contains_key(&root.abs()));

        let root_desc = plan.gates.get(&root.abs()).expect("root gate descriptor");
        assert_eq!(root_desc.connective, Connective::And);
        assert_eq!(
            root_desc.operands,
            vec![
                GateInput {
                    index: e1.abs(),
                    is_negated: false
                },
                GateInput {
                    index: e2.abs(),
                    is_negated: true
                },
            ]
        );

        let e1_state = true;
        let e2_state = true;
        let eval = e1_state && !e2_state;
        assert!(!eval);
    }
}
