use std::collections::hash_map::Entry;
use std::collections::{BTreeMap, HashMap, HashSet};

use tensorbayes::{BayesianGraph, NodeId};

use crate::core::distribution::UncertainUnit;
use crate::core::distribution_sampling::{require_probability, UncertaintyProgram};
use crate::core::fault_tree::FaultTree;
use crate::core::special_functions as kernels;
use crate::expression::{fragility_probability, Expr};
use crate::hcl::{HclCptGenerator, HclPgaFrequencyConversion, HclUncertaintySettings};
use crate::{PraxisError, Result};

fn invalid(message: String) -> PraxisError {
    PraxisError::Hcl(message)
}

struct RowTarget {
    node: NodeId,
    row: usize,
    components: Vec<Expr>,
}

struct FragilityTarget {
    node: NodeId,
    name: String,
    true_index: usize,
    false_index: usize,
    row_demands: Vec<f64>,
    median: Expr,
    randomness: Expr,
}

struct BinTarget {
    state_index: usize,
    state_id: String,
    frequency: Expr,
}

struct BinsTarget {
    node: NodeId,
    name: String,
    none_index: usize,
    conversion: HclPgaFrequencyConversion,
    mission_time: Expr,
    bins: Vec<BinTarget>,
}

pub(super) struct Plan {
    program: UncertaintyProgram,
    events: BTreeMap<String, Expr>,
    overrides: HashSet<String>,
    rows: Vec<RowTarget>,
    fragilities: Vec<FragilityTarget>,
    pga_bins: Vec<BinsTarget>,
}

pub(super) struct Population {
    pub(super) network: BayesianGraph,
    pub(super) event_samples: HashMap<String, Vec<f64>>,
    pub(super) overrides: HashSet<String>,
}

fn row_count(network: &BayesianGraph, node: NodeId) -> Result<usize> {
    Ok(network.family_size(node)? / network.variable(node)?.cardinality())
}

fn state_index(states: &[String], state: &str, node: &str) -> Result<usize> {
    states
        .iter()
        .position(|candidate| candidate == state)
        .ok_or_else(|| invalid(format!("state '{state}' does not exist on BN node '{node}'")))
}

impl Plan {
    pub(super) fn new(
        network: &BayesianGraph,
        settings: &HclUncertaintySettings,
        sources: &[&FaultTree],
    ) -> Result<Plan> {
        let table = &settings.uncertainty_parameters;
        let mut parameters = UncertaintyProgram::from_table(table)?.into_parameters();
        let mut mission_time = None;
        let mut events = BTreeMap::new();
        for source in sources {
            mission_time.get_or_insert(source.mission_time());
            for (name, expression) in source.parameters() {
                match parameters.get(name) {
                    Some(existing) if existing != expression => {
                        return Err(invalid(format!(
                            "uncertain parameter '{name}' has two different definitions"
                        )))
                    }
                    Some(_) => {}
                    None => {
                        parameters.insert(name.clone(), expression.clone());
                    }
                }
            }
            for (id, event) in source.basic_events() {
                if let Some(value) = event.value() {
                    events.entry(id.clone()).or_insert_with(|| value.clone());
                }
            }
        }
        let program = UncertaintyProgram::from_expressions(parameters, mission_time.unwrap_or(1.0))
            .with_vectors(&settings.uncertainty_vectors)?;

        let mut overrides = HashSet::new();
        for entry in &settings.basic_events {
            if !overrides.insert(entry.event.clone()) {
                return Err(invalid(format!(
                    "basic event '{}' has more than one uncertainty definition",
                    entry.event
                )));
            }
            let target = UncertaintyProgram::target(
                table,
                &entry.expression,
                &format!("event:{}", entry.event),
                UncertainUnit::Probability,
            )?;
            events.insert(entry.event.clone(), target);
        }

        let mut sampled_rows = HashSet::new();
        let mut rows = Vec::with_capacity(settings.cpt_rows.len());
        for entry in &settings.cpt_rows {
            let node = network.node_id(&entry.node)?;
            let width = network.variable(node)?.cardinality();
            if entry.row_index >= row_count(network, node)? {
                return Err(invalid(format!(
                    "CPT row {} is out of range for BN node '{}'",
                    entry.row_index, entry.node
                )));
            }
            if !sampled_rows.insert((node, entry.row_index)) {
                return Err(invalid(format!(
                    "CPT row {} of BN node '{}' has more than one uncertainty definition",
                    entry.row_index, entry.node
                )));
            }
            let components = program
                .vector_components(&entry.row, &format!("cpt:{}/{}", entry.node, entry.row_index))?;
            if components.len() != width {
                return Err(invalid(format!(
                    "CPT row {} of BN node '{}' has {} values for {} states",
                    entry.row_index,
                    entry.node,
                    components.len(),
                    width
                )));
            }
            rows.push(RowTarget {
                node,
                row: entry.row_index,
                components,
            });
        }

        let mut generator_nodes = HashSet::new();
        let mut fragilities = Vec::new();
        let mut pga_bins = Vec::new();
        for spec in &settings.cpt_generators {
            let node = network.node_id(&spec.node)?;
            if !generator_nodes.insert(node) || sampled_rows.iter().any(|(row_node, _)| *row_node == node) {
                return Err(invalid(format!(
                    "BN node '{}' must use either row uncertainty or one generator",
                    spec.node
                )));
            }
            let states = network.variable(node)?.states().to_vec();
            match &spec.generator {
                HclCptGenerator::SeismicFragility {
                    pga_parent_id,
                    true_state_id,
                    false_state_id,
                    median,
                    randomness,
                    demands,
                } => {
                    if states.len() != 2 || true_state_id == false_state_id {
                        return Err(invalid(format!(
                            "seismic fragility node '{}' needs two distinct true and false states",
                            spec.node
                        )));
                    }
                    let true_index = state_index(&states, true_state_id, &spec.node)?;
                    let false_index = state_index(&states, false_state_id, &spec.node)?;
                    let parent = network.node_id(pga_parent_id)?;
                    let parents = network.parents(node)?;
                    let position = parents.iter().position(|candidate| *candidate == parent).ok_or_else(|| {
                        invalid(format!(
                            "seismic fragility PGA node '{}' is not a parent of '{}'",
                            pga_parent_id, spec.node
                        ))
                    })?;
                    let parent_states = network.variable(parent)?.states().to_vec();
                    let mut by_state = HashMap::new();
                    for demand in demands {
                        if !(demand.demand.is_finite() && demand.demand >= 0.0) {
                            return Err(invalid(format!(
                                "seismic fragility node '{}' has demand {} for state '{}', not a finite value of at least 0",
                                spec.node, demand.demand, demand.state_id
                            )));
                        }
                        state_index(&parent_states, &demand.state_id, pga_parent_id)?;
                        if by_state.insert(demand.state_id.as_str(), demand.demand).is_some() {
                            return Err(invalid(format!(
                                "seismic fragility node '{}' repeats the demand for state '{}'",
                                spec.node, demand.state_id
                            )));
                        }
                    }
                    if by_state.len() != parent_states.len() {
                        return Err(invalid(format!(
                            "seismic fragility node '{}' needs one demand per state of '{}'",
                            spec.node, pga_parent_id
                        )));
                    }
                    let stride = parents[position + 1..].iter().try_fold(1usize, |product, other| {
                        network.variable(*other).map(|variable| product * variable.cardinality())
                    })?;
                    let row_demands = (0..row_count(network, node)?)
                        .map(|row| by_state[parent_states[(row / stride) % parent_states.len()].as_str()])
                        .collect();
                    fragilities.push(FragilityTarget {
                        node,
                        name: spec.node.clone(),
                        true_index,
                        false_index,
                        row_demands,
                        median: UncertaintyProgram::target(
                            table,
                            median,
                            &format!("fragility:{}/median", spec.node),
                            UncertainUnit::Quantity,
                        )?,
                        randomness: UncertaintyProgram::target(
                            table,
                            randomness,
                            &format!("fragility:{}/randomness", spec.node),
                            UncertainUnit::Factor,
                        )?,
                    });
                }
                HclCptGenerator::SeismicPgaBins {
                    none_state_id,
                    mission_time,
                    conversion,
                    bins,
                } => {
                    if !network.parents(node)?.is_empty() {
                        return Err(invalid(format!(
                            "seismic PGA bin node '{}' must be a root node",
                            spec.node
                        )));
                    }
                    let none_index = state_index(&states, none_state_id, &spec.node)?;
                    let mut covered = HashSet::new();
                    let mut targets = Vec::with_capacity(bins.len());
                    for bin in bins {
                        let index = state_index(&states, &bin.state_id, &spec.node)?;
                        if index == none_index || !covered.insert(index) {
                            return Err(invalid(format!(
                                "seismic PGA bin node '{}' repeats state '{}' or uses its none state",
                                spec.node, bin.state_id
                            )));
                        }
                        targets.push(BinTarget {
                            state_index: index,
                            state_id: bin.state_id.clone(),
                            frequency: UncertaintyProgram::target(
                                table,
                                &bin.frequency,
                                &format!("pga:{}/{}/frequency", spec.node, bin.state_id),
                                UncertainUnit::PerHour,
                            )?,
                        });
                    }
                    if covered.len() + 1 != states.len() {
                        return Err(invalid(format!(
                            "seismic PGA bin node '{}' needs one bin for every state except '{}'",
                            spec.node, none_state_id
                        )));
                    }
                    pga_bins.push(BinsTarget {
                        node,
                        name: spec.node.clone(),
                        none_index,
                        conversion: *conversion,
                        mission_time: UncertaintyProgram::target(
                            table,
                            mission_time,
                            &format!("pga:{}/missionTime", spec.node),
                            UncertainUnit::Hours,
                        )?,
                        bins: targets,
                    });
                }
            }
        }
        Ok(Plan {
            program,
            events,
            overrides,
            rows,
            fragilities,
            pga_bins,
        })
    }

    pub(super) fn draw(self, network: &BayesianGraph, settings: &HclUncertaintySettings) -> Result<Population> {
        let mut targets: Vec<&Expr> = self.events.values().collect();
        for row in &self.rows {
            targets.extend(row.components.iter());
        }
        for fragility in &self.fragilities {
            targets.push(&fragility.median);
            targets.push(&fragility.randomness);
        }
        for bins in &self.pga_bins {
            targets.push(&bins.mission_time);
            targets.extend(bins.bins.iter().map(|bin| &bin.frequency));
        }
        let mut columns = self.program.sample(&targets, &settings.plan())?.into_iter();
        let count = settings.sample_count;

        let mut event_samples = HashMap::with_capacity(self.events.len());
        for id in self.events.keys() {
            let column = columns.next().ok_or_else(missing)?;
            for (trial, value) in column.iter().enumerate() {
                require_probability(&format!("basic event '{}'", id), Some(trial), *value)?;
            }
            event_samples.insert(id.clone(), column);
        }

        let mut batches: HashMap<NodeId, Vec<f64>> = HashMap::new();
        for row in &self.rows {
            let width = row.components.len();
            let target = match batches.entry(row.node) {
                Entry::Occupied(slot) => slot.into_mut(),
                Entry::Vacant(slot) => slot.insert(
                    network
                        .variable(row.node)?
                        .cpt()
                        .iter()
                        .flat_map(|probability| std::iter::repeat_n(*probability, count))
                        .collect(),
                ),
            };
            for state in 0..width {
                let column = columns.next().ok_or_else(missing)?;
                for (trial, value) in column.iter().enumerate() {
                    target[(row.row * width + state) * count + trial] = *value;
                }
            }
        }
        let mut generated: Vec<(NodeId, Vec<f64>)> = Vec::new();
        for fragility in &self.fragilities {
            let medians = columns.next().ok_or_else(missing)?;
            let randomness = columns.next().ok_or_else(missing)?;
            let mut values = vec![0.0; fragility.row_demands.len() * 2 * count];
            for trial in 0..count {
                let median = medians[trial];
                let spread = randomness[trial];
                if !(median.is_finite() && median > 0.0) {
                    return Err(invalid(format!(
                        "the seismic fragility median of BN node '{}' is {} in trial {}, not positive",
                        fragility.name,
                        median,
                        trial + 1
                    )));
                }
                if !(spread.is_finite() && spread >= 0.0) {
                    return Err(invalid(format!(
                        "the seismic fragility randomness of BN node '{}' is {} in trial {}, below 0",
                        fragility.name,
                        spread,
                        trial + 1
                    )));
                }
                for (row, demand) in fragility.row_demands.iter().enumerate() {
                    let probability = fragility_probability(median, spread, *demand)?;
                    values[(row * 2 + fragility.true_index) * count + trial] = probability;
                    values[(row * 2 + fragility.false_index) * count + trial] = 1.0 - probability;
                }
            }
            generated.push((fragility.node, values));
        }
        for bins in &self.pga_bins {
            let times = columns.next().ok_or_else(missing)?;
            let frequencies = bins
                .bins
                .iter()
                .map(|_| columns.next().ok_or_else(missing))
                .collect::<Result<Vec<Vec<f64>>>>()?;
            let width = bins.bins.len() + 1;
            let mut values = vec![0.0; width * count];
            for trial in 0..count {
                let mut total = 0.0;
                for (bin, column) in bins.bins.iter().zip(&frequencies) {
                    let exposure = column[trial] * times[trial];
                    let probability = match bins.conversion {
                        HclPgaFrequencyConversion::Poisson => -kernels::exp_minus_one(-exposure)?,
                        HclPgaFrequencyConversion::Linear => exposure,
                    };
                    require_probability(
                        &format!("PGA bin '{}' of BN node '{}'", bin.state_id, bins.name),
                        Some(trial),
                        probability,
                    )?;
                    values[bin.state_index * count + trial] = probability;
                    total += probability;
                }
                if total > 1.0 {
                    return Err(invalid(format!(
                        "the PGA bin probabilities of BN node '{}' sum to {} in trial {}, above 1",
                        bins.name,
                        total,
                        trial + 1
                    )));
                }
                values[bins.none_index * count + trial] = 1.0 - total;
            }
            generated.push((bins.node, values));
        }
        let mut result = network.clone();
        for (node, values) in batches.into_iter().chain(generated) {
            result.set_cpt(node, values)?;
        }
        result.validate()?;
        Ok(Population {
            network: result,
            event_samples,
            overrides: self.overrides,
        })
    }
}

fn missing() -> PraxisError {
    PraxisError::Logic("an HCL uncertainty sample column is missing".to_string())
}
