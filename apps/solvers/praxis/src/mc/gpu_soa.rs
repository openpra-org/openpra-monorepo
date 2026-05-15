use crate::algorithms::pdag::Connective;
use crate::mc::plan::{ConnectiveRank, DpMcPlan, GateDescriptor};
use crate::Result;
use std::collections::{BTreeMap, HashMap};

/// Device buffer layout for bitpacked node words.
///
/// Words are stored as `(B, P, node)` contiguous:
/// `idx = (b * p_count + p) * num_nodes + node`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NodeWordsLayout {
    pub num_nodes: u32,
    pub b_count: u32,
    pub p_count: u32,
}

impl NodeWordsLayout {
    #[inline]
    pub fn total_words(&self) -> usize {
        (self.num_nodes as usize) * (self.b_count as usize) * (self.p_count as usize)
    }

    #[inline]
    pub fn index(&self, b: u32, p: u32, node: u32) -> usize {
        ((b * self.p_count + p) * self.num_nodes + node) as usize
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GateGroupSoa {
    pub connective: Connective,
    pub out_nodes: Vec<u32>,
    pub operand_offsets: Vec<u32>,
    pub operand_indices: Vec<u32>,
    pub operand_negated: Vec<u32>,
    pub min_numbers: Option<Vec<u32>>, // only for AtLeast
}

impl GateGroupSoa {
    pub fn num_gates(&self) -> usize {
        self.out_nodes.len()
    }

    pub fn validate(&self, layout: NodeWordsLayout) -> Result<()> {
        if self.operand_offsets.len() != self.num_gates() + 1 {
            return Err(crate::error::PraxisError::Logic(format!(
                "operand_offsets must be num_gates+1 (got {} vs {})",
                self.operand_offsets.len(),
                self.num_gates() + 1
            )));
        }
        if self.operand_indices.len() != self.operand_negated.len() {
            return Err(crate::error::PraxisError::Logic(
                "operand_indices/operand_negated length mismatch".to_string(),
            ));
        }
        if self.operand_offsets.first().copied().unwrap_or(0) != 0 {
            return Err(crate::error::PraxisError::Logic(
                "operand_offsets[0] must be 0".to_string(),
            ));
        }
        let last = *self.operand_offsets.last().unwrap_or(&0) as usize;
        if last != self.operand_indices.len() {
            return Err(crate::error::PraxisError::Logic(format!(
                "operand_offsets[last]={last} != operand_indices.len()={}",
                self.operand_indices.len()
            )));
        }

        for w in self.operand_offsets.windows(2) {
            if w[1] < w[0] {
                return Err(crate::error::PraxisError::Logic(
                    "operand_offsets must be non-decreasing".to_string(),
                ));
            }
        }

        for &n in &self.out_nodes {
            if n >= layout.num_nodes {
                return Err(crate::error::PraxisError::Logic(format!(
                    "out_node index out of range: {n} >= {}",
                    layout.num_nodes
                )));
            }
        }
        for &i in &self.operand_indices {
            if i >= layout.num_nodes {
                return Err(crate::error::PraxisError::Logic(format!(
                    "operand index out of range: {i} >= {}",
                    layout.num_nodes
                )));
            }
        }

        if self.connective == Connective::AtLeast {
            let mins = self.min_numbers.as_ref().ok_or_else(|| {
                crate::error::PraxisError::Logic("AtLeast group requires min_numbers".to_string())
            })?;
            if mins.len() != self.num_gates() {
                return Err(crate::error::PraxisError::Logic(
                    "min_numbers must be per-gate".to_string(),
                ));
            }
        } else if self.min_numbers.is_some() {
            return Err(crate::error::PraxisError::Logic(
                "min_numbers must be None for non-AtLeast groups".to_string(),
            ));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LayerSoa {
    pub depth: usize,
    pub basic_events: Vec<i32>,
    pub constants: Vec<i32>,
    pub gate_groups: BTreeMap<ConnectiveRank, GateGroupSoa>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GpuSoaPlan {
    pub layout: NodeWordsLayout,
    pub layers: Vec<LayerSoa>,

    /// Deterministic event list used by the bitpacked sampler.
    ///
    /// This is the concatenation of all `basic_events` in layer order (depth asc).
    pub event_nodes: Vec<i32>,

    /// Reverse mapping: node index -> event ordinal.
    pub node_to_event: HashMap<i32, u32>,
}

impl GpuSoaPlan {
    pub fn from_plan(plan: &DpMcPlan) -> Result<Self> {
        let max_node = plan.depths.keys().map(|n| n.abs()).max().unwrap_or(0);

        let b_count = plan.params.b as u32;
        let p_count = plan.params.p as u32;

        let layout = NodeWordsLayout {
            num_nodes: (max_node as u32) + 1,
            b_count,
            p_count,
        };

        let mut layers: Vec<LayerSoa> = Vec::with_capacity(plan.layers.len());
        let mut event_nodes: Vec<i32> = Vec::new();

        for layer in &plan.layers {
            let mut gate_groups: BTreeMap<ConnectiveRank, GateGroupSoa> = BTreeMap::new();

            for (rank, gates) in &layer.gates_by_connective {
                if gates.is_empty() {
                    continue;
                }

                let connective = plan
                    .gates
                    .get(&gates[0].abs())
                    .map(|d| d.connective)
                    .unwrap_or(Connective::Null);

                let mut out_nodes: Vec<u32> = Vec::with_capacity(gates.len());
                let mut operand_offsets: Vec<u32> = Vec::with_capacity(gates.len() + 1);
                let mut operand_indices: Vec<u32> = Vec::new();
                let mut operand_negated: Vec<u32> = Vec::new();
                let mut min_numbers: Option<Vec<u32>> = if connective == Connective::AtLeast {
                    Some(Vec::with_capacity(gates.len()))
                } else {
                    None
                };

                operand_offsets.push(0);

                for &gate_node in gates {
                    let gate_node_abs = gate_node.abs();
                    let desc = plan.gates.get(&gate_node_abs).ok_or_else(|| {
                        crate::error::PraxisError::Logic(format!(
                            "missing gate descriptor for node {gate_node_abs}"
                        ))
                    })?;

                    if desc.connective != connective {
                        return Err(crate::error::PraxisError::Logic(
                            "gates_by_connective group contained mixed connectives".to_string(),
                        ));
                    }

                    out_nodes.push(gate_node_abs as u32);

                    append_operands(desc, &mut operand_indices, &mut operand_negated);
                    operand_offsets.push(operand_indices.len() as u32);

                    if connective == Connective::AtLeast {
                        let k = desc.min_number.ok_or_else(|| {
                            crate::error::PraxisError::Logic(
                                "AtLeast requires min_number".to_string(),
                            )
                        })? as u32;
                        min_numbers.as_mut().unwrap().push(k);
                    }
                }

                gate_groups.insert(
                    *rank,
                    GateGroupSoa {
                        connective,
                        out_nodes,
                        operand_offsets,
                        operand_indices,
                        operand_negated,
                        min_numbers,
                    },
                );
            }

            // Deterministic sampler order: basic events in layer order.
            event_nodes.extend(layer.basic_events.iter().map(|n| n.abs()));

            layers.push(LayerSoa {
                depth: layer.depth,
                basic_events: layer.basic_events.iter().map(|n| n.abs()).collect(),
                constants: layer.constants.iter().map(|n| n.abs()).collect(),
                gate_groups,
            });
        }

        let mut node_to_event = HashMap::with_capacity(event_nodes.len());
        for (i, &n) in event_nodes.iter().enumerate() {
            node_to_event.insert(n, i as u32);
        }

        let out = Self {
            layout,
            layers,
            event_nodes,
            node_to_event,
        };

        out.validate()?;
        Ok(out)
    }

    pub fn validate(&self) -> Result<()> {
        for layer in &self.layers {
            // Within a layer, gate groups are intended to be independent and thus
            // safe to reorder/submit concurrently (they must write disjoint outputs).
            let mut seen_out_nodes: std::collections::HashSet<u32> =
                std::collections::HashSet::new();
            for group in layer.gate_groups.values() {
                group.validate(self.layout)?;

                for &out_node in &group.out_nodes {
                    if !seen_out_nodes.insert(out_node) {
                        return Err(crate::error::PraxisError::Logic(format!(
                            "duplicate gate out_node {out_node} within layer depth {}",
                            layer.depth
                        )));
                    }
                }
            }
        }
        Ok(())
    }
}

fn append_operands(desc: &GateDescriptor, indices: &mut Vec<u32>, negated: &mut Vec<u32>) {
    indices.reserve(desc.operands.len());
    negated.reserve(desc.operands.len());

    for op in &desc.operands {
        indices.push(op.index.unsigned_abs());
        negated.push(if op.is_negated { 1u32 } else { 0u32 });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::pdag::Pdag;
    #[cfg(feature = "cuda")]
    use crate::mc::bitpack::Bitpack;
    #[cfg(feature = "cuda")]
    use crate::mc::packed_gate::eval_gate_word;
    use crate::mc::plan::RunParams;

    #[test]
    fn soa_offsets_are_well_formed_and_deterministic() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let e3 = pdag.add_basic_event("E3".to_string());

        // g1 = AND(e1, !e2)
        let g1 = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, -e2], None)
            .unwrap();

        // g2 = AtLeast(2 of [g1, e2, e3])
        let g2 = pdag
            .add_gate(
                "G2".to_string(),
                Connective::AtLeast,
                vec![g1, e2, e3],
                Some(2),
            )
            .unwrap();

        pdag.set_root(g2).unwrap();

        let params = RunParams::new(1, 2, 1, 64, 123);
        let plan = DpMcPlan::from_pdag(&pdag, params).unwrap();

        let soa1 = GpuSoaPlan::from_plan(&plan).unwrap();
        let soa2 = GpuSoaPlan::from_plan(&plan).unwrap();
        assert_eq!(soa1, soa2);

        // basic sanity
        assert!(soa1.layout.num_nodes > 0);
        assert_eq!(soa1.layout.b_count, 2);
        assert_eq!(soa1.layout.p_count, 1);

        // must include all basic events in deterministic order
        assert_eq!(soa1.event_nodes, vec![e1.abs(), e2.abs(), e3.abs()]);

        // validate already ran inside builder
        soa1.validate().unwrap();

        // Ensure AtLeast group has min_numbers.
        let atleast_rank = ConnectiveRank::of(Connective::AtLeast);
        let mut found = false;
        for layer in &soa1.layers {
            if let Some(g) = layer.gate_groups.get(&atleast_rank) {
                found = true;
                assert_eq!(g.min_numbers.as_ref().unwrap().len(), g.num_gates());
            }
        }
        assert!(found);
    }

    #[cfg(all(test, feature = "cuda"))]
    #[test]
    fn cuda_smoke_soa_gate_group_matches_cpu_packed_reference() {
        use crate::mc::kernel::eval_gates_packed_gpu;
        use cubecl::prelude::Runtime;
        use cubecl_cuda::CudaRuntime;

        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let e3 = pdag.add_basic_event("E3".to_string());

        // g1 = OR(e1, e2)
        let g1 = pdag
            .add_gate("G1".to_string(), Connective::Or, vec![e1, e2], None)
            .unwrap();
        // g2 = AtLeast(2 of [g1, e2, !e3])
        let g2 = pdag
            .add_gate(
                "G2".to_string(),
                Connective::AtLeast,
                vec![g1, e2, -e3],
                Some(2),
            )
            .unwrap();

        pdag.set_root(g2).unwrap();

        let params = RunParams::new(1, 1, 1, 64, 123);
        let plan = DpMcPlan::from_pdag(&pdag, params).unwrap();
        let soa = GpuSoaPlan::from_plan(&plan).unwrap();

        // Prepare node words for a single (b=0,p=0).
        let layout = soa.layout;
        let mut node_words: Vec<Bitpack> = vec![0u64; layout.total_words()];
        let b = 0u32;
        let p = 0u32;

        // Deterministic input bit patterns.
        node_words[layout.index(b, p, e1.unsigned_abs())] = 0xFFFF_0000_FFFF_0000u64;
        node_words[layout.index(b, p, e2.unsigned_abs())] = 0x0F0F_0F0F_0F0F_0F0Fu64;
        node_words[layout.index(b, p, e3.unsigned_abs())] = 0xAAAA_AAAA_AAAA_AAAAu64;

        // Run layers in order, per connective group.
        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        for layer in &soa.layers {
            for group in layer.gate_groups.values() {
                let op_code = match group.connective {
                    Connective::And => 0u32,
                    Connective::Or => 1u32,
                    Connective::Xor => 2u32,
                    Connective::Nand => 3u32,
                    Connective::Nor => 4u32,
                    Connective::Iff => 5u32,
                    Connective::AtLeast => 6u32,
                    Connective::Not | Connective::Null => continue,
                };

                eval_gates_packed_gpu::<CudaRuntime>(
                    &client,
                    op_code,
                    &group.operand_offsets,
                    &group.operand_indices,
                    &group.operand_negated,
                    &group.out_nodes,
                    group.min_numbers.as_deref(),
                    layout.num_nodes,
                    layout.b_count,
                    layout.p_count,
                    &mut node_words,
                );
            }
        }

        // CPU packed reference for the two gates.
        let mut node_words_cpu = vec![0u64; layout.num_nodes as usize];
        node_words_cpu[e1.unsigned_abs() as usize] = 0xFFFF_0000_FFFF_0000u64;
        node_words_cpu[e2.unsigned_abs() as usize] = 0x0F0F_0F0F_0F0F_0F0Fu64;
        node_words_cpu[e3.unsigned_abs() as usize] = 0xAAAA_AAAA_AAAA_AAAAu64;

        for node in [g1.abs(), g2.abs()] {
            let desc = plan.gates.get(&node).unwrap();
            let w = eval_gate_word(desc, &node_words_cpu);
            node_words_cpu[node as usize] = w;
        }

        assert_eq!(
            node_words[layout.index(0, 0, g2.unsigned_abs())],
            node_words_cpu[g2.unsigned_abs() as usize]
        );
    }
}
