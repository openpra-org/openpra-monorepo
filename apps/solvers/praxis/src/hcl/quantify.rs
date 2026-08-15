use std::collections::HashMap;

use tensorbayes::{CompiledJunctionTree, ExecutionEngine, NodeId};

use crate::algorithms::bdd_engine::{Bdd, BddRef, BDD_FALSE, BDD_NULL, BDD_TRUE};
use crate::hcl::{HclBaseEvidence, HclBridgeStats, HclEventBinding, HclEventBindings};
use crate::{PraxisError, Result};

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct EvidenceContext {
    /// Per BN node, the currently allowed state set. `None` means unrestricted.
    allowed: Vec<Option<Vec<bool>>>,
    cardinalities: Vec<usize>,
}

impl EvidenceContext {
    fn from_base(tree: &CompiledJunctionTree, base_evidence: &HclBaseEvidence) -> Result<Self> {
        if base_evidence.states().len() != tree.graph().num_variables() {
            return Err(PraxisError::Hcl(format!(
                "base evidence width {} does not match BN width {}",
                base_evidence.states().len(),
                tree.graph().num_variables()
            )));
        }
        let mut allowed = vec![None; tree.graph().num_variables()];
        let cardinalities = tree
            .graph()
            .variables()
            .iter()
            .map(|variable| variable.cardinality())
            .collect();
        for variable in tree.graph().variables() {
            let state = base_evidence.states()[variable.id().index()];
            if state < -1 || state >= variable.cardinality() as i32 {
                return Err(PraxisError::Hcl(format!(
                    "base evidence state {state} is invalid for BN node {}",
                    variable.id()
                )));
            }
            if state >= 0 {
                let mut mask = vec![false; variable.cardinality()];
                mask[state as usize] = true;
                allowed[variable.id().index()] = Some(mask);
            }
        }
        Ok(Self {
            allowed,
            cardinalities,
        })
    }

    fn extend(&self, binding: &HclEventBinding, event_occurs: bool) -> Option<Self> {
        let node_index = binding.bn_node().index();
        let cardinality = self.cardinalities[node_index];
        let mut branch_mask = vec![!event_occurs; cardinality];
        for state in binding.true_states() {
            branch_mask[state.index()] = event_occurs;
        }

        let mut extended = self.clone();
        if let Some(existing) = &self.allowed[node_index] {
            for (allowed, &was_allowed) in branch_mask.iter_mut().zip(existing) {
                *allowed &= was_allowed;
            }
        }
        if !branch_mask.iter().any(|&allowed| allowed) {
            return None;
        }
        extended.allowed[node_index] = Some(branch_mask);
        Some(extended)
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BddContextKey {
    node: BddRef,
    context: EvidenceContext,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BnQueryKey {
    bdd_variable: usize,
    context: EvidenceContext,
}

/// Evaluates a PRAXIS BDD whose selected Boolean variables are bound to a BN.
///
/// Unbound variables retain the independent probabilities stored in the BDD.
/// Bound variables are evaluated using exact conditional marginals from
/// TensorBayes under the accumulated BDD path context.
pub struct HclQuantifier<'a> {
    bdd: &'a Bdd,
    engine: ExecutionEngine,
    bindings: HclEventBindings,
    base_evidence: HclBaseEvidence,
    initial_context: EvidenceContext,
    bdd_context_cache: HashMap<BddContextKey, f64>,
    bn_query_cache: HashMap<BnQueryKey, f64>,
    stats: HclBridgeStats,
}

impl<'a> HclQuantifier<'a> {
    pub fn new(
        bdd: &'a Bdd,
        tree: CompiledJunctionTree,
        bindings: HclEventBindings,
        base_evidence: HclBaseEvidence,
    ) -> Result<Self> {
        validate_bindings(bdd, &tree, &bindings)?;
        let initial_context = EvidenceContext::from_base(&tree, &base_evidence)?;
        // Build once here so malformed evidence is rejected before traversal.
        base_evidence.to_batch()?;
        Ok(Self {
            bdd,
            engine: ExecutionEngine::new(tree),
            bindings,
            base_evidence,
            initial_context,
            bdd_context_cache: HashMap::new(),
            bn_query_cache: HashMap::new(),
            stats: HclBridgeStats::default(),
        })
    }

    pub fn quantify(&mut self, root: BddRef) -> Result<f64> {
        if root == BDD_NULL {
            return Err(PraxisError::Hcl(
                "cannot quantify the null BDD reference".to_string(),
            ));
        }
        self.stats.quantifications += 1;
        let context = self.initial_context.clone();
        self.recurse(root, &context)
    }

    pub fn set_base_evidence(&mut self, base_evidence: HclBaseEvidence) -> Result<()> {
        let initial_context =
            EvidenceContext::from_base(self.engine.junction_tree(), &base_evidence)?;
        base_evidence.to_batch()?;
        self.base_evidence = base_evidence;
        self.initial_context = initial_context;
        self.clear_caches();
        Ok(())
    }

    pub fn base_evidence(&self) -> &HclBaseEvidence {
        &self.base_evidence
    }

    pub fn bindings(&self) -> &HclEventBindings {
        &self.bindings
    }

    pub fn stats(&self) -> HclBridgeStats {
        self.stats
    }

    pub fn clear_caches(&mut self) {
        self.bdd_context_cache.clear();
        self.bn_query_cache.clear();
        self.engine.invalidate_workspace_cache();
    }

    fn recurse(&mut self, reference: BddRef, context: &EvidenceContext) -> Result<f64> {
        if reference == BDD_TRUE {
            return Ok(1.0);
        }
        if reference == BDD_FALSE {
            return Ok(0.0);
        }
        if reference.is_complement() {
            return Ok(1.0 - self.recurse(reference.regular(), context)?);
        }

        let key = BddContextKey {
            node: reference,
            context: context.clone(),
        };
        if let Some(&probability) = self.bdd_context_cache.get(&key) {
            self.stats.bdd_context_cache_hits += 1;
            return Ok(probability);
        }
        self.stats.bdd_context_cache_misses += 1;

        let node = *self.bdd.node(reference);
        let probability = if let Some(binding) = self.bindings.get(node.var).cloned() {
            let event_probability = self.conditional_event_probability(&binding, context)?;
            let high = if event_probability == 0.0 {
                0.0
            } else if let Some(high_context) = context.extend(&binding, true) {
                self.recurse(node.high, &high_context)?
            } else {
                0.0
            };
            let low = if event_probability == 1.0 {
                0.0
            } else if let Some(low_context) = context.extend(&binding, false) {
                self.recurse(node.low, &low_context)?
            } else {
                0.0
            };
            event_probability * high + (1.0 - event_probability) * low
        } else {
            let event_probability =
                self.bdd.var_probs().get(node.var).copied().ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "unbound BDD variable {} has no independent probability",
                        node.var
                    ))
                })?;
            if !(0.0..=1.0).contains(&event_probability) || !event_probability.is_finite() {
                return Err(PraxisError::Hcl(format!(
                    "unbound BDD variable {} has invalid probability {event_probability}",
                    node.var
                )));
            }
            let high = self.recurse(node.high, context)?;
            let low = self.recurse(node.low, context)?;
            event_probability * high + (1.0 - event_probability) * low
        };

        self.bdd_context_cache.insert(key, probability);
        Ok(probability)
    }

    fn conditional_event_probability(
        &mut self,
        binding: &HclEventBinding,
        context: &EvidenceContext,
    ) -> Result<f64> {
        let key = BnQueryKey {
            bdd_variable: binding.bdd_variable(),
            context: context.clone(),
        };
        if let Some(&probability) = self.bn_query_cache.get(&key) {
            self.stats.bn_query_cache_hits += 1;
            return Ok(probability);
        }
        self.stats.bn_query_cache_misses += 1;

        self.engine.clear_soft_evidence();
        for (node_index, allowed) in context.allowed.iter().enumerate() {
            let Some(allowed) = allowed else {
                continue;
            };
            let node = NodeId::new(u32::try_from(node_index).map_err(|_| {
                PraxisError::Hcl("BN node index exceeds TensorBayes NodeId range".to_string())
            })?);
            let likelihoods: Vec<f64> = allowed
                .iter()
                .map(|&is_allowed| if is_allowed { 1.0 } else { 0.0 })
                .collect();
            self.engine.set_soft_evidence(node, &likelihoods)?;
        }

        let evidence = self.base_evidence.to_batch()?;
        let marginal = self.engine.evaluate(&evidence, binding.bn_node())?;
        let mut probability = 0.0;
        for state in binding.true_states() {
            probability += marginal.values()[state.index()];
        }
        probability = probability.clamp(0.0, 1.0);
        self.bn_query_cache.insert(key, probability);
        Ok(probability)
    }
}

fn validate_bindings(
    bdd: &Bdd,
    tree: &CompiledJunctionTree,
    bindings: &HclEventBindings,
) -> Result<()> {
    for binding in bindings.iter() {
        if binding.bdd_variable() >= bdd.variable_count() {
            return Err(PraxisError::Hcl(format!(
                "binding references unknown BDD variable {}",
                binding.bdd_variable()
            )));
        }
        let variable = tree.graph().variable(binding.bn_node())?;
        if binding.true_states().len() >= variable.cardinality() {
            return Err(PraxisError::Hcl(format!(
                "binding for BDD variable {} must leave at least one BN state for false",
                binding.bdd_variable()
            )));
        }
        for state in binding.true_states() {
            if state.index() >= variable.cardinality() {
                return Err(PraxisError::Hcl(format!(
                    "binding state {} is invalid for BN node {}",
                    state.index(),
                    binding.bn_node()
                )));
            }
        }
    }
    Ok(())
}
