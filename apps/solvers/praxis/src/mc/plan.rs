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
        Self {
            t,
            b,
            p,
            omega,
            seed,
        }
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
    if u32::try_from(p).is_err() {
        return Err(crate::error::PraxisError::Settings(format!(
            "Number of trials must be at most {}",
            u32::MAX as usize * omega
        )));
    }
    let padded = b * p * omega;
    let valid_lanes_last_word = (num_trials % omega) as u32;

    Ok(NumTrialsLayout {
        params: RunParams::new(1, b, p, omega, seed),
        padded_trials_per_iteration: padded,
        valid_lanes_last_word,
    })
}

/// A stretch of bit packs that fits one GPU dispatch. `p_start` keeps each word's place in
/// the layout, so its random stream does not depend on how a run is split.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BitpackWindow {
    pub p_start: u32,
    pub p_count: u32,
    pub valid_lanes_last_word: u32,
}

/// Walks `p_total` bit packs in windows of at most `max_p_count`. Only the window that ends
/// the layout carries its partial last word.
pub fn bitpack_windows(
    p_total: u32,
    max_p_count: u32,
    valid_lanes_last_word: u32,
) -> impl Iterator<Item = BitpackWindow> {
    (0..p_total)
        .step_by(max_p_count as usize)
        .map(move |p_start| {
            let p_count = max_p_count.min(p_total - p_start);
            BitpackWindow {
                p_start,
                p_count,
                valid_lanes_last_word: if p_start + p_count == p_total {
                    valid_lanes_last_word
                } else {
                    0
                },
            }
        })
}

/// Bit packs in one GPU dispatch. Long dispatches run slower on large models and can fill a
/// small card, while below about a thousand bit packs launching the kernels costs more.
const MAX_BITPACKS_PER_DISPATCH: u64 = 2048;

/// The bit packs one GPU dispatch covers. Kernels stack eight bit packs in a cube, so the
/// workgroup limit of the adapter applies, and each half of the word buffer has to bind whole.
pub fn max_bitpacks_per_dispatch(
    max_cubes_per_dimension: u32,
    max_buffer_bytes: u64,
    b_count: u32,
    words_per_bitpack: u32,
) -> u32 {
    let by_cubes = u64::from(max_cubes_per_dimension) * 8;
    let bytes_per_bitpack = u64::from(b_count) * u64::from(words_per_bitpack) * 4;
    let by_buffer = max_buffer_bytes / bytes_per_bitpack.max(1);
    by_cubes.min(by_buffer).clamp(1, MAX_BITPACKS_PER_DISPATCH) as u32
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
    fn choose_run_params_stops_where_the_bitpack_counter_ends() {
        let most = u32::MAX as usize * 64;
        assert!(choose_run_params_for_num_trials(most, 0).is_ok());
        assert!(choose_run_params_for_num_trials(most + 1, 0).is_err());
    }

    #[test]
    fn windows_cover_every_bitpack_once_in_order() {
        for (p_total, max_p_count) in [(1, 1), (7, 3), (9, 3), (10, 1), (5, 8), (524_281, 524_280)]
        {
            let mut next = 0;
            for window in bitpack_windows(p_total, max_p_count, 0) {
                assert_eq!(window.p_start, next);
                assert!((1..=max_p_count).contains(&window.p_count));
                next += window.p_count;
            }
            assert_eq!(next, p_total);
        }
    }

    #[test]
    fn only_the_last_window_masks_lanes() {
        let lanes: Vec<u32> = bitpack_windows(10, 4, 17)
            .map(|window| window.valid_lanes_last_word)
            .collect();
        assert_eq!(lanes, [0, 0, 17]);
    }

    #[test]
    fn a_run_that_fits_stays_in_one_window() {
        let windows: Vec<_> = bitpack_windows(16, 16, 5).collect();
        assert_eq!(
            windows,
            [BitpackWindow {
                p_start: 0,
                p_count: 16,
                valid_lanes_last_word: 5
            }]
        );
    }

    #[test]
    fn dispatches_stay_short_on_any_adapter() {
        assert_eq!(
            max_bitpacks_per_dispatch(u32::MAX, u64::MAX, 1, 1) as u64,
            MAX_BITPACKS_PER_DISPATCH
        );
    }

    #[test]
    fn dispatches_respect_the_workgroup_limit_of_the_adapter() {
        assert_eq!(max_bitpacks_per_dispatch(100, u64::MAX, 1, 100), 800);
    }

    #[test]
    fn dispatches_respect_the_buffer_limit_of_the_adapter() {
        let two_gib = 2u64 << 30;
        assert_eq!(
            max_bitpacks_per_dispatch(65_535, two_gib, 1, 1_000_000),
            536
        );
        assert_eq!(
            max_bitpacks_per_dispatch(65_535, two_gib, 4, 1_000_000),
            134
        );
    }

    #[test]
    fn dispatches_always_cover_at_least_one_bitpack() {
        assert_eq!(max_bitpacks_per_dispatch(65_535, 1, 1, 100), 1);
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
