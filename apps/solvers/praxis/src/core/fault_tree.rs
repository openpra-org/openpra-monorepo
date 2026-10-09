use std::collections::HashMap;

use crate::core::ccf::CcfGroup;
use crate::core::distribution_sampling::{require_probability, UncertaintyProgram};
use crate::core::element::Element;
use crate::core::event::{BasicEvent, HouseEvent};
use crate::core::gate::{Formula, Gate};
use crate::expression::{EvalContext, Expr};
use crate::{MefError, PraxisError, Result};

#[derive(Debug, Clone, PartialEq)]
pub struct FaultTree {
    element: Element,
    top_event: String,
    gates: HashMap<String, Gate>,
    basic_events: HashMap<String, BasicEvent>,
    house_events: HashMap<String, HouseEvent>,
    ccf_groups: HashMap<String, CcfGroup>,
    parameters: HashMap<String, Expr>,
    mission_time: f64,
    probability_checks: Vec<(String, Expr)>,
}

impl FaultTree {
    pub fn new(id: impl Into<String>, top_event: impl Into<String>) -> Result<Self> {
        Ok(FaultTree {
            element: Element::new(id.into())?,
            top_event: top_event.into(),
            gates: HashMap::new(),
            basic_events: HashMap::new(),
            house_events: HashMap::new(),
            ccf_groups: HashMap::new(),
            parameters: HashMap::new(),
            mission_time: 1.0,
            probability_checks: Vec::new(),
        })
    }

    pub fn parameters(&self) -> &HashMap<String, Expr> {
        &self.parameters
    }

    pub fn set_parameter(&mut self, name: String, mut value: Expr) {
        value.assign_draw_keys(&format!("parameter:{}", name));
        self.parameters.insert(name, value);
    }

    pub fn mission_time(&self) -> f64 {
        self.mission_time
    }

    pub fn set_mission_time(&mut self, mission_time: f64) {
        self.mission_time = mission_time;
    }

    pub fn reevaluate_basic_event_probabilities(&mut self) -> Result<()> {
        let parameters = self.parameters.clone();
        let mission_time = self.mission_time;
        let ctx = EvalContext::constant(&parameters, mission_time);

        let mut updates = Vec::new();
        for (id, event) in &self.basic_events {
            if let Some(expr) = event.value() {
                let nominal = expr.evaluate(&ctx)?;
                require_probability(&format!("basic event '{}'", id), None, nominal)?;
                updates.push((id.clone(), nominal));
            }
        }

        for (id, nominal) in updates {
            if let Some(event) = self.basic_events.get_mut(&id) {
                event.set_probability(nominal)?;
            }
        }

        Ok(())
    }

    pub fn element(&self) -> &Element {
        &self.element
    }

    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    pub fn top_event(&self) -> &str {
        &self.top_event
    }

    pub fn add_gate(&mut self, gate: Gate) -> Result<()> {
        let id = gate.element().id().to_string();
        if self.gates.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "gate".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.gates.insert(id, gate);
        Ok(())
    }

    pub fn get_gate(&self, id: &str) -> Option<&Gate> {
        self.gates.get(id)
    }

    pub fn get_gate_mut(&mut self, id: &str) -> Option<&mut Gate> {
        self.gates.get_mut(id)
    }

    pub fn gates(&self) -> &HashMap<String, Gate> {
        &self.gates
    }

    pub fn add_basic_event(&mut self, basic_event: BasicEvent) -> Result<()> {
        let id = basic_event.element().id().to_string();
        if self.basic_events.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "basic event".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.basic_events.insert(id, basic_event);
        Ok(())
    }

    pub fn get_basic_event(&self, id: &str) -> Option<&BasicEvent> {
        self.basic_events.get(id)
    }

    pub fn get_basic_event_mut(&mut self, id: &str) -> Option<&mut BasicEvent> {
        self.basic_events.get_mut(id)
    }

    pub fn basic_events(&self) -> &HashMap<String, BasicEvent> {
        &self.basic_events
    }

    pub fn add_house_event(&mut self, house_event: HouseEvent) -> Result<()> {
        let id = house_event.element().id().to_string();
        if self.house_events.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "house event".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.house_events.insert(id, house_event);
        Ok(())
    }

    pub fn get_house_event(&self, id: &str) -> Option<&HouseEvent> {
        self.house_events.get(id)
    }

    pub fn get_house_event_mut(&mut self, id: &str) -> Option<&mut HouseEvent> {
        self.house_events.get_mut(id)
    }

    pub fn house_events(&self) -> &HashMap<String, HouseEvent> {
        &self.house_events
    }

    pub fn add_ccf_group(&mut self, ccf_group: CcfGroup) -> Result<()> {
        let id = ccf_group.element().id().to_string();
        if self.ccf_groups.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "CCF group".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.ccf_groups.insert(id, ccf_group);
        Ok(())
    }

    pub fn get_ccf_group(&self, id: &str) -> Option<&CcfGroup> {
        self.ccf_groups.get(id)
    }

    pub fn get_ccf_group_mut(&mut self, id: &str) -> Option<&mut CcfGroup> {
        self.ccf_groups.get_mut(id)
    }

    pub fn ccf_groups(&self) -> &HashMap<String, CcfGroup> {
        &self.ccf_groups
    }

    pub fn probability_checks(&self) -> &[(String, Expr)] {
        &self.probability_checks
    }

    pub fn expand_ccf_groups(&mut self) -> Result<()> {
        let program = UncertaintyProgram::from_expressions(self.parameters.clone(), self.mission_time);
        let mut group_ids: Vec<String> = self.ccf_groups.keys().cloned().collect();
        group_ids.sort();
        let mut expanded_events = Vec::new();
        let mut checks = Vec::new();
        let mut member_ccbes: HashMap<String, Vec<String>> = HashMap::new();
        let mut parent_ccbes: HashMap<String, Vec<String>> = HashMap::new();

        for id in &group_ids {
            let ccf_group = &self.ccf_groups[id];
            for (subject, check) in ccf_group.checks() {
                require_probability(&subject, None, program.point(&check)?)?;
                checks.push((subject, check));
            }
            for ccf_event in ccf_group.expand()? {
                let point = program.point(&ccf_event.value)?;
                require_probability(&format!("basic event '{}'", ccf_event.id), None, point)?;
                if ccf_group.model.replaces_parent_event() {
                    parent_ccbes
                        .entry(id.clone())
                        .or_default()
                        .push(ccf_event.id.clone());
                } else {
                    for member in &ccf_event.failed_members {
                        member_ccbes
                            .entry(member.clone())
                            .or_default()
                            .push(ccf_event.id.clone());
                    }
                }
                expanded_events.push((ccf_event, point));
            }
        }

        for (ccf_event, point) in expanded_events {
            self.add_basic_event(BasicEvent::with_value(ccf_event.id, point, ccf_event.value)?)?;
        }
        self.probability_checks.extend(checks);

        for (member, ccbe_ids) in member_ccbes {
            self.basic_events.remove(&member);
            let mut gate = Gate::new(member.clone(), Formula::Or)?;
            for ccbe_id in ccbe_ids {
                gate.add_operand(ccbe_id);
            }
            self.gates.insert(member, gate);
        }

        for (parent, ccbe_ids) in parent_ccbes {
            if self.gates.contains_key(&parent) {
                return Err(PraxisError::Logic(format!(
                    "RASP common cause parent '{}' is already a gate",
                    parent
                )));
            }
            if self.basic_events.remove(&parent).is_none() {
                return Err(PraxisError::Logic(format!(
                    "RASP common cause parent '{}' is not a basic event",
                    parent
                )));
            }
            let mut gate = Gate::new(parent.clone(), Formula::Or)?;
            for ccbe_id in ccbe_ids {
                gate.add_operand(ccbe_id);
            }
            self.gates.insert(parent, gate);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ccf::{alphas_key, fixed_components, CcfModel, RaspCcfEvent};
    use crate::core::distribution::{CcfTesting, Law};
    use crate::core::distribution_sampling::{SamplingMethod, SamplingPlan};
    use crate::core::gate::Formula;

    fn pumps(beta: f64, total: Expr) -> CcfGroup {
        CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(Expr::Constant(beta)),
            total,
        )
        .unwrap()
    }

    #[test]
    fn test_add_ccf_group_rejects_a_duplicate() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.add_ccf_group(pumps(0.2, Expr::Constant(0.1))).unwrap();
        assert_eq!(ft.ccf_groups().len(), 1);
        assert!(ft.get_ccf_group("Pumps").is_some());
        assert!(ft.get_ccf_group_mut("Pumps").is_some());
        assert!(ft.get_ccf_group("NonExistent").is_none());
        assert!(ft.add_ccf_group(pumps(0.3, Expr::Constant(0.1))).is_err());
    }

    #[test]
    fn test_expand_ccf_groups_beta_factor_rewires_members() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_ccf_group(pumps(0.2, Expr::Constant(0.1))).unwrap();
        ft.expand_ccf_groups().unwrap();

        assert_eq!(ft.basic_events().len(), 4);
        for (id, expected) in [
            ("Pumps-indep-1", 0.08),
            ("Pumps-indep-2", 0.08),
            ("Pumps-common", 0.02),
        ] {
            let event = ft.get_basic_event(id).unwrap();
            assert!((event.probability() - expected).abs() < 1e-15);
            assert!(event.value().is_some());
        }
        assert!(ft.get_basic_event("P1").is_none());
        let p1 = ft.get_gate("P1").unwrap();
        assert_eq!(p1.formula(), &Formula::Or);
        assert!(p1.operands().contains(&"Pumps-indep-1".to_string()));
        assert!(p1.operands().contains(&"Pumps-common".to_string()));
        assert!(!p1.operands().contains(&"Pumps-indep-2".to_string()));
        assert_eq!(ft.probability_checks().len(), 2);
    }

    #[test]
    fn test_expand_ccf_groups_alpha_factor_and_mgl() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.add_ccf_group(
            CcfGroup::new(
                "Valves",
                vec!["V1".to_string(), "V2".to_string()],
                CcfModel::AlphaFactor {
                    testing: CcfTesting::NonStaggered,
                    alphas: fixed_components(&alphas_key("Valves"), vec![0.6, 0.4]).unwrap(),
                },
                Expr::Constant(0.05),
            )
            .unwrap(),
        )
        .unwrap();
        ft.add_ccf_group(
            CcfGroup::new(
                "Motors",
                vec!["M1".to_string(), "M2".to_string()],
                CcfModel::Mgl(vec![Expr::Constant(0.2)]),
                Expr::Constant(0.1),
            )
            .unwrap(),
        )
        .unwrap();
        ft.expand_ccf_groups().unwrap();
        assert_eq!(ft.basic_events().len(), 6);
        let single = ft.get_basic_event("Valves-alpha-1-1").unwrap().probability();
        assert!((single - 0.6 / 1.4 * 0.05).abs() < 1e-15);
        let double = ft.get_basic_event("Valves-alpha-2-1").unwrap().probability();
        assert!((double - 2.0 * 0.4 / 1.4 * 0.05).abs() < 1e-15);
        let independent = ft.get_basic_event("Motors-mgl-1-1").unwrap().probability();
        assert!((independent - 0.08).abs() < 1e-15);
        let common = ft.get_basic_event("Motors-mgl-2-1").unwrap().probability();
        assert!((common - 0.02).abs() < 1e-15);
    }

    #[test]
    fn test_expand_rasp_mgl_replaces_parent_basic_event() {
        let mut ft = FaultTree::new("RASP", "TOP").unwrap();
        ft.add_basic_event(BasicEvent::new("RASP-PARENT".to_string(), 0.0).unwrap())
            .unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("RASP-PARENT".to_string());
        ft.add_gate(top).unwrap();
        ft.add_ccf_group(
            CcfGroup::new(
                "RASP-PARENT",
                vec!["A".into(), "B".into(), "C".into()],
                CcfModel::RaspMgl {
                    factors: vec![Expr::Constant(0.02), Expr::Constant(0.0)],
                    virtual_events: vec![RaspCcfEvent {
                        id: "RASP-PARENT-AB".into(),
                        member_indices: vec![0, 1],
                    }],
                },
                Expr::Constant(7.2e-7),
            )
            .unwrap(),
        )
        .unwrap();
        ft.expand_ccf_groups().unwrap();

        assert!(ft.get_basic_event("RASP-PARENT").is_none());
        let parent = ft.get_gate("RASP-PARENT").unwrap();
        assert!(matches!(parent.formula(), Formula::Or));
        assert_eq!(parent.operands(), &["RASP-PARENT-AB"]);
        assert!(
            (ft.get_basic_event("RASP-PARENT-AB").unwrap().probability() - 7.2e-9).abs() < 1e-20
        );
    }

    #[test]
    fn test_expand_ccf_groups_shares_one_sampled_total() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.add_ccf_group(pumps(0.2, Expr::uniform(0.01, 0.2))).unwrap();
        ft.expand_ccf_groups().unwrap();
        let indep = ft.get_basic_event("Pumps-indep-1").unwrap();
        assert!((indep.probability() - 0.8 * 0.105).abs() < 1e-15);

        let shares = [
            ("Pumps-indep-1", 0.8),
            ("Pumps-indep-2", 0.8),
            ("Pumps-common", 0.2),
        ];
        let program = crate::core::distribution_sampling::UncertaintyProgram::from_expressions(
            ft.parameters().clone(),
            ft.mission_time(),
        );
        let targets: Vec<&Expr> = shares
            .iter()
            .map(|(id, _)| ft.get_basic_event(id).unwrap().value().unwrap())
            .collect();
        let plan = SamplingPlan {
            method: SamplingMethod::MonteCarlo,
            trials: 100,
            seed: 7,
        };
        let sampled = program.sample(&targets, &plan).unwrap();
        for trial in 0..100 {
            let totals: Vec<f64> = shares
                .iter()
                .zip(&sampled)
                .map(|((_, share), column)| column[trial] / share)
                .collect();
            assert!((0.01..=0.2).contains(&totals[0]));
            assert!(totals.iter().all(|total| (total - totals[0]).abs() < 1e-12));
        }
    }

    #[test]
    fn test_expand_ccf_groups_rejects_a_point_factor_outside_zero_to_one() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.set_parameter("beta".to_string(), Expr::Constant(1.4));
        ft.add_ccf_group(
            CcfGroup::new(
                "Pumps",
                vec!["P1".to_string(), "P2".to_string()],
                CcfModel::BetaFactor(Expr::Parameter("beta".to_string())),
                Expr::draw(Law::Uniform {
                    lower: 0.01,
                    upper: 0.2,
                }),
            )
            .unwrap(),
        )
        .unwrap();
        let error = ft.expand_ccf_groups().unwrap_err().to_string();
        assert!(
            error.contains("common cause group 'Pumps' beta factor"),
            "{error}"
        );
    }

    #[test]
    fn test_fault_tree_new_basic() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert_eq!(ft.element().id(), "FT1");
        assert_eq!(ft.top_event(), "TopGate");
        assert!(ft.gates().is_empty());
        assert!(ft.basic_events().is_empty());
        assert!(ft.house_events().is_empty());
        assert!(ft.ccf_groups().is_empty());
    }

    #[test]
    fn test_fault_tree_new_with_complex_id() {
        let ft = FaultTree::new("Complex-FT_123", "Top-Event-1").unwrap();
        assert_eq!(ft.element().id(), "Complex-FT_123");
        assert_eq!(ft.top_event(), "Top-Event-1");
    }

    #[test]
    fn test_fault_tree_new_invalid_id() {
        let result = FaultTree::new("", "TopGate");
        assert!(result.is_err());
    }

    #[test]
    fn test_fault_tree_element_access() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert_eq!(ft.element().id(), "FT1");
        assert_eq!(ft.element().name(), None);

        ft.element_mut().set_name("Test Fault Tree".to_string());
        assert_eq!(ft.element().name(), Some("Test Fault Tree"));
    }

    #[test]
    fn test_fault_tree_element_with_label() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.element_mut()
            .set_label(Some("Primary fault tree for reactor system".to_string()));
        assert_eq!(
            ft.element().label(),
            Some("Primary fault tree for reactor system")
        );
    }

    #[test]
    fn test_add_gate_success() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();

        assert!(ft.add_gate(gate).is_ok());
        assert_eq!(ft.gates().len(), 1);
        assert!(ft.get_gate("TopGate").is_some());
    }

    #[test]
    fn test_add_gate_duplicate() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let gate1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        let gate2 = Gate::new("G1".to_string(), Formula::Or).unwrap();

        ft.add_gate(gate1).unwrap();
        let result = ft.add_gate(gate2);

        assert!(result.is_err());
        match result.unwrap_err() {
            PraxisError::Mef(MefError::DuplicateElement {
                element_id,
                element_type,
                container_id,
            }) => {
                assert_eq!(element_id, "G1");
                assert_eq!(element_type, "gate");
                assert_eq!(container_id, Some("FT1".to_string()));
            }
            _ => panic!("Expected DuplicateElement error"),
        }
    }

    #[test]
    fn test_add_multiple_gates() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        let g2 = Gate::new("G2".to_string(), Formula::Or).unwrap();
        let g3 = Gate::new("G3".to_string(), Formula::Not).unwrap();

        ft.add_gate(g1).unwrap();
        ft.add_gate(g2).unwrap();
        ft.add_gate(g3).unwrap();

        assert_eq!(ft.gates().len(), 3);
        assert!(ft.get_gate("G1").is_some());
        assert!(ft.get_gate("G2").is_some());
        assert!(ft.get_gate("G3").is_some());
    }

    #[test]
    fn test_get_gate_not_exists() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert!(ft.get_gate("NonExistent").is_none());
    }

    #[test]
    fn test_get_gate_mut() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        ft.add_gate(gate).unwrap();

        let gate_mut = ft.get_gate_mut("G1").unwrap();
        gate_mut.add_operand("E1".to_string());

        assert_eq!(ft.get_gate("G1").unwrap().operands().len(), 1);
    }

    #[test]
    fn test_add_gate_with_operands() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());

        ft.add_gate(gate).unwrap();

        let retrieved = ft.get_gate("TopGate").unwrap();
        assert_eq!(retrieved.operands().len(), 2);
        assert_eq!(retrieved.operands()[0], "E1");
        assert_eq!(retrieved.operands()[1], "E2");
    }

    #[test]
    fn test_top_event_access() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert_eq!(ft.top_event(), "TopGate");
    }

    #[test]
    fn test_top_event_immutable() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        let top = ft.top_event();
        assert_eq!(top, "TopGate");

        assert_eq!(top.len(), 7);
    }

    #[test]
    fn test_top_event_different_values() {
        let ft1 = FaultTree::new("FT1", "SystemFailure").unwrap();
        let ft2 = FaultTree::new("FT2", "ComponentFailure").unwrap();

        assert_eq!(ft1.top_event(), "SystemFailure");
        assert_eq!(ft2.top_event(), "ComponentFailure");
        assert_ne!(ft1.top_event(), ft2.top_event());
    }

    #[test]
    fn test_add_basic_event_success() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();

        ft.add_basic_event(event).unwrap();
        assert_eq!(ft.basic_events().len(), 1);
        assert!(ft.get_basic_event("E1").is_some());
    }

    #[test]
    fn test_add_basic_event_duplicate() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let event1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        let event2 = BasicEvent::new("E1".to_string(), 0.02).unwrap();

        ft.add_basic_event(event1).unwrap();
        let result = ft.add_basic_event(event2);

        assert!(result.is_err());
    }

    #[test]
    fn test_add_house_event_success() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let event = HouseEvent::new("H1".to_string(), true).unwrap();

        ft.add_house_event(event).unwrap();
        assert_eq!(ft.house_events().len(), 1);
        assert!(ft.get_house_event("H1").is_some());
    }

    #[test]
    fn test_fault_tree_with_all_elements() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();

        ft.add_gate(Gate::new("TopGate".to_string(), Formula::And).unwrap())
            .unwrap();
        ft.add_gate(Gate::new("G1".to_string(), Formula::Or).unwrap())
            .unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        ft.add_house_event(HouseEvent::new("H1".to_string(), false).unwrap())
            .unwrap();

        assert_eq!(ft.gates().len(), 2);
        assert_eq!(ft.basic_events().len(), 3);
        assert_eq!(ft.house_events().len(), 1);
    }

    #[test]
    fn test_fault_tree_clone() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.add_gate(Gate::new("G1".to_string(), Formula::And).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let cloned = ft.clone();
        assert_eq!(cloned.element().id(), ft.element().id());
        assert_eq!(cloned.top_event(), ft.top_event());
        assert_eq!(cloned.gates().len(), ft.gates().len());
        assert_eq!(cloned.basic_events().len(), ft.basic_events().len());
    }

    #[test]
    fn test_reevaluate_applies_mission_time() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let expr = Expr::Exponential {
            lambda: Box::new(Expr::Constant(0.001)),
            time: Box::new(Expr::MissionTime),
        };
        let nominal_at_one = 1.0 - (-0.001f64).exp();
        ft.add_basic_event(BasicEvent::with_value("E1".to_string(), nominal_at_one, expr).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        ft.set_mission_time(100.0);
        ft.reevaluate_basic_event_probabilities().unwrap();

        let expected = 1.0 - (-0.001f64 * 100.0).exp();
        assert!((ft.get_basic_event("E1").unwrap().probability() - expected).abs() < 1e-12);
        assert_eq!(ft.get_basic_event("E2").unwrap().probability(), 0.2);
    }

    #[test]
    fn test_reevaluate_resolves_parameters() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.set_parameter("lambda".to_string(), Expr::Constant(0.002));
        let expr = Expr::Exponential {
            lambda: Box::new(Expr::Parameter("lambda".to_string())),
            time: Box::new(Expr::MissionTime),
        };
        ft.add_basic_event(BasicEvent::with_value("E1".to_string(), 0.0, expr).unwrap())
            .unwrap();

        ft.set_mission_time(50.0);
        ft.reevaluate_basic_event_probabilities().unwrap();

        let expected = 1.0 - (-0.002f64 * 50.0).exp();
        assert!((ft.get_basic_event("E1").unwrap().probability() - expected).abs() < 1e-12);
    }

}
