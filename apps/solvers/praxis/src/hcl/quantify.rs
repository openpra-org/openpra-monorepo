use std::collections::HashMap;

use tensorbayes::{CompiledJunctionTree, ExecutionEngine};

use crate::algorithms::bdd_engine::{Bdd, BddRef, BDD_FALSE, BDD_NULL, BDD_TRUE};
use crate::hcl::context::{ContextSpace, PathContext};
use crate::hcl::{HclBaseEvidence, HclBridgeStats, HclEventBinding, HclEventBindings};
use crate::{PraxisError, Result};

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BddContextKey {
    node: BddRef,
    context: PathContext,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BnQueryKey {
    bdd_variable: usize,
    context: PathContext,
}

fn validate_base_evidence(
    tree: &CompiledJunctionTree,
    base_evidence: &HclBaseEvidence,
) -> Result<()> {
    if base_evidence.states().len() != tree.graph().num_variables() {
        return Err(PraxisError::Hcl(format!(
            "base evidence width {} does not match BN width {}",
            base_evidence.states().len(),
            tree.graph().num_variables()
        )));
    }
    for variable in tree.graph().variables() {
        let state = base_evidence.states()[variable.id().index()];
        if state < -1 || state >= variable.cardinality() as i32 {
            return Err(PraxisError::Hcl(format!(
                "base evidence state {state} is invalid for BN node {}",
                variable.id()
            )));
        }
    }
    Ok(())
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
    linked: Vec<HclEventBinding>,
    base_evidence: HclBaseEvidence,
    space: ContextSpace,
    bdd_context_cache: HashMap<BddContextKey, f64>,
    bn_query_cache: HashMap<BnQueryKey, f64>,
    occurred: Vec<bool>,
    forced: Option<(usize, bool)>,
    forced_cache: HashMap<BddContextKey, f64>,
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
        validate_base_evidence(&tree, &base_evidence)?;
        // Build once here so malformed evidence is rejected before traversal.
        base_evidence.to_batch()?;
        let space = ContextSpace::new(tree.graph(), base_evidence.states());
        let mut linked: Vec<HclEventBinding> = bindings.iter().cloned().collect();
        linked.sort_by_key(|binding| binding.bdd_variable());
        Ok(Self {
            bdd,
            engine: ExecutionEngine::new(tree),
            bindings,
            linked,
            base_evidence,
            space,
            bdd_context_cache: HashMap::new(),
            bn_query_cache: HashMap::new(),
            occurred: vec![false; bdd.variable_count()],
            forced: None,
            forced_cache: HashMap::new(),
            stats: HclBridgeStats::default(),
        })
    }

    pub fn joint_occurrence(&mut self, variables: &[usize]) -> Result<f64> {
        Ok(self.occurrence(variables)?.0)
    }

    pub fn joint_occurrence_with(&mut self, root: BddRef, variables: &[usize]) -> Result<f64> {
        if root == BDD_NULL {
            return Err(PraxisError::Hcl(
                "cannot quantify the null BDD reference".to_string(),
            ));
        }
        let (probability, context) = self.occurrence(variables)?;
        let Some(context) = context else {
            return Ok(0.0);
        };
        for &variable in variables {
            self.occurred[variable] = true;
        }
        let kept = std::mem::take(&mut self.bdd_context_cache);
        let conditional = self.recurse(root, &context);
        self.bdd_context_cache = kept;
        for &variable in variables {
            self.occurred[variable] = false;
        }
        Ok(probability * conditional?)
    }

    pub fn binding_probability(&mut self, binding: &HclEventBinding) -> Result<f64> {
        let context = self.space.empty();
        self.conditional_event_probability(binding, &context)
    }

    pub fn event_probability(&mut self, variable: usize) -> Result<f64> {
        if variable >= self.bdd.variable_count() {
            return Err(PraxisError::Hcl(format!(
                "BDD variable {variable} does not exist"
            )));
        }
        match self.bindings.get(variable).cloned() {
            Some(binding) => self.binding_probability(&binding),
            None => self.independent_probability(variable),
        }
    }

    pub fn conditional_on_binding(
        &mut self,
        root: BddRef,
        binding: &HclEventBinding,
        occurs: bool,
    ) -> Result<Option<f64>> {
        if root == BDD_NULL {
            return Err(PraxisError::Hcl(
                "cannot quantify the null BDD reference".to_string(),
            ));
        }
        let probability = self.binding_probability(binding)?;
        let condition = if occurs {
            probability
        } else {
            1.0 - probability
        };
        if condition <= 0.0 {
            return Ok(None);
        }
        let empty = self.space.empty();
        let Some(context) = self.space.extend(&empty, binding, occurs) else {
            return Ok(None);
        };
        if condition < f64::EPSILON.sqrt() && !self.possible(&context)? {
            return Ok(None);
        }
        Ok(Some(self.recurse(root, &context)?))
    }

    fn possible(&mut self, context: &PathContext) -> Result<bool> {
        self.engine.invalidate_workspace_cache();
        self.engine.clear_soft_evidence();
        for &restriction in context.iter() {
            let (node, allowed) = self.space.restriction(restriction);
            let likelihoods: Vec<f64> = allowed
                .iter()
                .map(|&is_allowed| if is_allowed { 1.0 } else { 0.0 })
                .collect();
            self.engine.set_soft_evidence(node, &likelihoods)?;
        }
        let evidence = self.base_evidence.to_batch()?;
        self.engine.allow_zero_mass(true);
        let outcome = self.engine.evaluate(&evidence, tensorbayes::NodeId::new(0));
        let possible = self.engine.zero_mass_rows().is_empty();
        self.engine.allow_zero_mass(false);
        self.engine.clear_soft_evidence();
        self.engine.invalidate_workspace_cache();
        outcome?;
        Ok(possible)
    }

    pub fn conditional_on(
        &mut self,
        root: BddRef,
        variable: usize,
        occurs: bool,
    ) -> Result<Option<f64>> {
        if root == BDD_NULL {
            return Err(PraxisError::Hcl(
                "cannot quantify the null BDD reference".to_string(),
            ));
        }
        if variable >= self.bdd.variable_count() {
            return Err(PraxisError::Hcl(format!(
                "BDD variable {variable} does not exist"
            )));
        }
        if let Some(binding) = self.bindings.get(variable).cloned() {
            return self.conditional_on_binding(root, &binding, occurs);
        }
        self.forced = Some((variable, occurs));
        self.forced_cache.clear();
        let context = self.space.empty();
        let value = self.recurse(root, &context);
        self.forced = None;
        self.forced_cache.clear();
        Ok(Some(value?))
    }

    fn occurrence(&mut self, variables: &[usize]) -> Result<(f64, Option<PathContext>)> {
        let mut ordered = variables.to_vec();
        ordered.sort_unstable();
        ordered.dedup();
        let mut probability = 1.0;
        let mut context = self.space.empty();
        for variable in ordered {
            if variable >= self.bdd.variable_count() {
                return Err(PraxisError::Hcl(format!(
                    "BDD variable {variable} does not exist"
                )));
            }
            let event_probability = match self.bindings.get(variable).cloned() {
                Some(binding) => {
                    let conditional = self.conditional_event_probability(&binding, &context)?;
                    if conditional == 0.0 {
                        return Ok((0.0, None));
                    }
                    match self.space.extend(&context, &binding, true) {
                        Some(next) => context = next,
                        None => return Ok((0.0, None)),
                    }
                    conditional
                }
                None => self.independent_probability(variable)?,
            };
            probability *= event_probability;
            if probability == 0.0 {
                return Ok((0.0, None));
            }
        }
        Ok((probability, Some(context)))
    }

    fn independent_probability(&self, variable: usize) -> Result<f64> {
        let event_probability = self.bdd.var_probs().get(variable).copied().ok_or_else(|| {
            PraxisError::Hcl(format!(
                "unbound BDD variable {variable} has no independent probability"
            ))
        })?;
        if !(0.0..=1.0).contains(&event_probability) || !event_probability.is_finite() {
            return Err(PraxisError::Hcl(format!(
                "unbound BDD variable {variable} has invalid probability {event_probability}"
            )));
        }
        Ok(event_probability)
    }

    pub fn quantify(&mut self, root: BddRef) -> Result<f64> {
        if root == BDD_NULL {
            return Err(PraxisError::Hcl(
                "cannot quantify the null BDD reference".to_string(),
            ));
        }
        self.stats.quantifications += 1;
        let context = self.space.empty();
        self.recurse(root, &context)
    }

    pub fn set_base_evidence(&mut self, base_evidence: HclBaseEvidence) -> Result<()> {
        validate_base_evidence(self.engine.junction_tree(), &base_evidence)?;
        base_evidence.to_batch()?;
        self.space.set_base(base_evidence.states());
        self.base_evidence = base_evidence;
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

    fn recurse(&mut self, reference: BddRef, context: &PathContext) -> Result<f64> {
        if reference == BDD_TRUE {
            return Ok(1.0);
        }
        if reference == BDD_FALSE {
            return Ok(0.0);
        }
        if reference.is_complement() {
            return Ok(1.0 - self.recurse(reference.regular(), context)?);
        }

        let support = self.space.support(self.bdd, &self.bindings, reference);
        let key = BddContextKey {
            node: reference,
            context: self.space.project(support, context),
        };
        let node = *self.bdd.node(reference);
        let scratch = self
            .forced
            .is_some_and(|(variable, _)| node.var <= variable);
        let known = if scratch {
            self.forced_cache.get(&key)
        } else {
            self.bdd_context_cache.get(&key)
        };
        if let Some(&probability) = known {
            self.stats.bdd_context_cache_hits += 1;
            return Ok(probability);
        }
        self.stats.bdd_context_cache_misses += 1;

        let probability = if let Some(binding) = self.bindings.get(node.var).cloned() {
            let event_probability = self.conditional_event_probability(&binding, context)?;
            let high = if event_probability == 0.0 {
                0.0
            } else if let Some(high_context) = self.space.extend(context, &binding, true) {
                self.recurse(node.high, &high_context)?
            } else {
                0.0
            };
            let low = if event_probability == 1.0 {
                0.0
            } else if let Some(low_context) = self.space.extend(context, &binding, false) {
                self.recurse(node.low, &low_context)?
            } else {
                0.0
            };
            event_probability * high + (1.0 - event_probability) * low
        } else if self.occurred[node.var] {
            self.recurse(node.high, context)?
        } else if let Some((_, occurs)) = self.forced.filter(|(variable, _)| *variable == node.var)
        {
            self.recurse(if occurs { node.high } else { node.low }, context)?
        } else {
            let event_probability = self.independent_probability(node.var)?;
            let high = self.recurse(node.high, context)?;
            let low = self.recurse(node.low, context)?;
            event_probability * high + (1.0 - event_probability) * low
        };

        if scratch {
            self.forced_cache.insert(key, probability);
        } else {
            self.bdd_context_cache.insert(key, probability);
        }
        Ok(probability)
    }

    fn conditional_event_probability(
        &mut self,
        binding: &HclEventBinding,
        context: &PathContext,
    ) -> Result<f64> {
        let support = self.space.node_support(binding.bn_node());
        let context = &self.space.project(support, context);
        let key = BnQueryKey {
            bdd_variable: binding.bdd_variable(),
            context: PathContext::clone(context),
        };
        if let Some(&probability) = self.bn_query_cache.get(&key) {
            self.stats.bn_query_cache_hits += 1;
            return Ok(probability);
        }
        self.stats.bn_query_cache_misses += 1;

        self.engine.clear_soft_evidence();
        for &restriction in context.iter() {
            let (node, allowed) = self.space.restriction(restriction);
            let likelihoods: Vec<f64> = allowed
                .iter()
                .map(|&is_allowed| if is_allowed { 1.0 } else { 0.0 })
                .collect();
            self.engine.set_soft_evidence(node, &likelihoods)?;
        }

        let evidence = self.base_evidence.to_batch()?;
        let marginal = self.engine.evaluate(&evidence, binding.bn_node())?;
        let probability = true_probability(binding, marginal.values());
        self.bn_query_cache.insert(key, probability);
        for index in 0..self.linked.len() {
            let other = &self.linked[index];
            if other.bdd_variable() == binding.bdd_variable() {
                continue;
            }
            let support = self.space.node_support(other.bn_node());
            if self.space.project(support, context).len() != context.len() {
                continue;
            }
            let key = BnQueryKey {
                bdd_variable: other.bdd_variable(),
                context: PathContext::clone(context),
            };
            if self.bn_query_cache.contains_key(&key) {
                continue;
            }
            let marginal = self.engine.workspace().query_marginal(other.bn_node())?;
            self.bn_query_cache
                .insert(key, true_probability(other, marginal.values()));
        }
        Ok(probability)
    }
}

fn true_probability(binding: &HclEventBinding, marginal: &[f64]) -> f64 {
    let mut probability = 0.0;
    for state in binding.true_states() {
        probability += marginal[state.index()];
    }
    probability.clamp(0.0, 1.0)
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
