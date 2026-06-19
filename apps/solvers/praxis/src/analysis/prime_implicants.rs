use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PrimeImplicant {

    pub events: Vec<i32>,
}

impl PrimeImplicant {

    pub fn new(events: Vec<i32>) -> Self {
        let mut sorted = events;
        sorted.sort_by_key(|x| x.abs());
        PrimeImplicant { events: sorted }
    }

    pub fn order(&self) -> usize {
        self.events.len()
    }

    pub fn is_subset_of(&self, other: &PrimeImplicant) -> bool {
        self.events.iter().all(|e| other.events.contains(e))
    }
}

#[derive(Debug, Clone)]
pub struct PrimeImplicants {

    implicants: Vec<PrimeImplicant>,

    min_order: usize,

    max_order: usize,
}

impl PrimeImplicants {

    fn new(mut implicants: Vec<PrimeImplicant>) -> Self {

        implicants = Self::minimize(implicants);

        let min_order = implicants.iter().map(|pi| pi.order()).min().unwrap_or(0);
        let max_order = implicants.iter().map(|pi| pi.order()).max().unwrap_or(0);

        PrimeImplicants {
            implicants,
            min_order,
            max_order,
        }
    }

    fn minimize(mut implicants: Vec<PrimeImplicant>) -> Vec<PrimeImplicant> {
        if implicants.is_empty() {
            return implicants;
        }

        implicants.sort_by_key(|pi| pi.order());

        let mut minimal = Vec::new();
        for candidate in implicants {

            let is_minimal = !minimal
                .iter()
                .any(|pi: &PrimeImplicant| pi.is_subset_of(&candidate));
            if is_minimal {
                minimal.push(candidate);
            }
        }
        minimal
    }

    pub fn calculate(pdag: &Pdag, top_gate: NodeIndex) -> Self {
        let mut calculator = PrimeImplicantCalculator::new(pdag);
        let implicants = calculator.calculate(top_gate);
        PrimeImplicants::new(implicants)
    }

    pub fn implicants(&self) -> &[PrimeImplicant] {
        &self.implicants
    }

    pub fn count(&self) -> usize {
        self.implicants.len()
    }

    pub fn min_order(&self) -> usize {
        self.min_order
    }

    pub fn max_order(&self) -> usize {
        self.max_order
    }

    pub fn is_empty(&self) -> bool {
        self.implicants.is_empty()
    }

    pub fn by_order(&self, order: usize) -> Vec<&PrimeImplicant> {
        self.implicants
            .iter()
            .filter(|pi| pi.order() == order)
            .collect()
    }
}

struct PrimeImplicantCalculator<'a> {
    pdag: &'a Pdag,
    cache: HashMap<(NodeIndex, bool), Vec<PrimeImplicant>>,
}

impl<'a> PrimeImplicantCalculator<'a> {
    fn new(pdag: &'a Pdag) -> Self {
        PrimeImplicantCalculator {
            pdag,
            cache: HashMap::new(),
        }
    }

    fn calculate(&mut self, node: NodeIndex) -> Vec<PrimeImplicant> {
        self.calculate_internal(node, false)
    }

    fn calculate_internal(&mut self, node: NodeIndex, complement: bool) -> Vec<PrimeImplicant> {

        if let Some(cached) = self.cache.get(&(node, complement)) {
            return cached.clone();
        }

        let result = match self.pdag.get_node(node) {
            None => vec![],
            Some(PdagNode::BasicEvent { .. }) => {

                let event_idx = if complement { -node } else { node };
                vec![PrimeImplicant::new(vec![event_idx])]
            }
            Some(PdagNode::Constant { value, .. }) => {
                if (*value && !complement) || (!value && complement) {
                    vec![PrimeImplicant::new(vec![])]
                } else {
                    vec![]
                }
            }
            Some(PdagNode::Gate {
                connective,
                operands,
                ..
            }) => {

                if complement {

                    let dual_connective = match connective {
                        Connective::And => Connective::Or,
                        Connective::Or => Connective::And,
                        Connective::Nand => Connective::Nor,
                        Connective::Nor => Connective::Nand,
                        _ => *connective,
                    };
                    self.calculate_gate(dual_connective, operands, true)
                } else {
                    self.calculate_gate(*connective, operands, false)
                }
            }
        };

        self.cache.insert((node, complement), result.clone());
        result
    }

    fn calculate_gate(
        &mut self,
        connective: Connective,
        operands: &[NodeIndex],
        complement: bool,
    ) -> Vec<PrimeImplicant> {
        match connective {
            Connective::And => self.calculate_and(operands, complement),
            Connective::Or => self.calculate_or(operands, complement),
            Connective::Not => {
                if operands.len() == 1 {
                    self.calculate_internal(operands[0], !complement)
                } else {
                    vec![]
                }
            }
            Connective::Null => {
                if operands.len() == 1 {
                    self.calculate_internal(operands[0], complement)
                } else {
                    vec![]
                }
            }
            Connective::Nand => self.calculate_and(operands, !complement),
            Connective::Nor => self.calculate_or(operands, !complement),
            Connective::Xor => {

                self.calculate_or(operands, complement)
            }
            Connective::Iff => {

                vec![]
            }
            Connective::AtLeast => {

                let k = (operands.len() / 2) + 1;
                self.calculate_atleast(operands, k, complement)
            }
        }
    }

    fn calculate_and(&mut self, operands: &[NodeIndex], complement: bool) -> Vec<PrimeImplicant> {
        if operands.is_empty() {
            return vec![PrimeImplicant::new(vec![])];
        }

        let mut result = self.calculate_internal(operands[0], complement);

        for &operand in &operands[1..] {
            let operand_pis = self.calculate_internal(operand, complement);
            result = self.combine_and(result, operand_pis);
        }

        result
    }

    fn calculate_or(&mut self, operands: &[NodeIndex], complement: bool) -> Vec<PrimeImplicant> {
        if operands.is_empty() {
            return vec![];
        }

        let mut result = Vec::new();

        for &operand in operands {
            let operand_pis = self.calculate_internal(operand, complement);
            result.extend(operand_pis);
        }

        let unique: HashSet<_> = result.into_iter().collect();
        PrimeImplicants::minimize(unique.into_iter().collect())
    }

    fn combine_and(
        &self,
        left: Vec<PrimeImplicant>,
        right: Vec<PrimeImplicant>,
    ) -> Vec<PrimeImplicant> {
        let mut result = Vec::new();

        for l in &left {
            for r in &right {

                let mut combined = l.events.clone();
                combined.extend(&r.events);

                combined.sort_by_key(|x| x.abs());
                combined.dedup();

                result.push(PrimeImplicant::new(combined));
            }
        }

        result
    }

    fn calculate_atleast(
        &mut self,
        operands: &[NodeIndex],
        k: usize,
        complement: bool,
    ) -> Vec<PrimeImplicant> {
        if k == 0 {
            return vec![PrimeImplicant::new(vec![])];
        }
        if k > operands.len() {
            return vec![];
        }

        let mut result = Vec::new();
        let combinations = Self::combinations(operands, k);

        for combo in combinations {

            let mut combo_pi = vec![PrimeImplicant::new(vec![])];
            for &op in &combo {
                let op_pis = self.calculate_internal(op, complement);
                combo_pi = self.combine_and(combo_pi, op_pis);
            }
            result.extend(combo_pi);
        }

        let unique: HashSet<_> = result.into_iter().collect();
        PrimeImplicants::minimize(unique.into_iter().collect())
    }

    fn combinations(items: &[NodeIndex], k: usize) -> Vec<Vec<NodeIndex>> {
        if k == 0 {
            return vec![vec![]];
        }
        if k > items.len() {
            return vec![];
        }
        if k == items.len() {
            return vec![items.to_vec()];
        }

        let mut result = Vec::new();

        for mut combo in Self::combinations(&items[1..], k - 1) {
            combo.insert(0, items[0]);
            result.push(combo);
        }

        result.extend(Self::combinations(&items[1..], k));

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prime_implicant_order() {
        let pi = PrimeImplicant::new(vec![1, 2, 3]);
        assert_eq!(pi.order(), 3);
    }

    #[test]
    fn test_prime_implicant_subset() {
        let pi1 = PrimeImplicant::new(vec![1, 2]);
        let pi2 = PrimeImplicant::new(vec![1, 2, 3]);

        assert!(pi1.is_subset_of(&pi2));
        assert!(!pi2.is_subset_of(&pi1));
    }

    #[test]
    fn test_minimize() {
        let pis = vec![
            PrimeImplicant::new(vec![1, 2, 3]),
            PrimeImplicant::new(vec![1, 2]),
            PrimeImplicant::new(vec![4, 5]),
        ];

        let minimal = PrimeImplicants::minimize(pis);
        assert_eq!(minimal.len(), 2);
        assert!(minimal.iter().any(|pi| pi.events == vec![1, 2]));
        assert!(minimal.iter().any(|pi| pi.events == vec![4, 5]));
    }

    #[test]
    fn test_single_event() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());

        let pi = PrimeImplicants::calculate(&pdag, e1);

        assert_eq!(pi.count(), 1);
        assert_eq!(pi.implicants()[0].events, vec![e1]);
    }

    #[test]
    fn test_and_gate() {

        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let and_gate = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();

        let pi = PrimeImplicants::calculate(&pdag, and_gate);

        assert_eq!(pi.count(), 1);
        assert_eq!(pi.implicants()[0].events.len(), 2);
        assert!(pi.implicants()[0].events.contains(&e1));
        assert!(pi.implicants()[0].events.contains(&e2));
    }

    #[test]
    fn test_or_gate() {

        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let or_gate = pdag
            .add_gate("G1".to_string(), Connective::Or, vec![e1, e2], None)
            .unwrap();

        let pi = PrimeImplicants::calculate(&pdag, or_gate);

        assert_eq!(pi.count(), 2);
        assert_eq!(pi.min_order(), 1);
        assert_eq!(pi.max_order(), 1);
    }

    #[test]
    fn test_nested_gates() {

        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let e3 = pdag.add_basic_event("E3".to_string());

        let and_gate = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();
        let or_gate = pdag
            .add_gate("TOP".to_string(), Connective::Or, vec![and_gate, e3], None)
            .unwrap();

        let pi = PrimeImplicants::calculate(&pdag, or_gate);

        assert_eq!(pi.count(), 2);

        assert!(pi.implicants().iter().any(|p| p.events == vec![e3]));

        assert!(pi
            .implicants()
            .iter()
            .any(|p| { p.events.len() == 2 && p.events.contains(&e1) && p.events.contains(&e2) }));
    }

    #[test]
    fn test_constant_true() {
        let mut pdag = Pdag::new();
        let true_const = pdag.add_constant(true);

        let pi = PrimeImplicants::calculate(&pdag, true_const);

        assert_eq!(pi.count(), 1);
        assert_eq!(pi.implicants()[0].events.len(), 0);
    }

    #[test]
    fn test_constant_false() {
        let mut pdag = Pdag::new();
        let false_const = pdag.add_constant(false);

        let pi = PrimeImplicants::calculate(&pdag, false_const);

        assert!(pi.is_empty());
    }

    #[test]
    fn test_by_order() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let e3 = pdag.add_basic_event("E3".to_string());

        let and_gate = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();
        let or_gate = pdag
            .add_gate("TOP".to_string(), Connective::Or, vec![and_gate, e3], None)
            .unwrap();

        let pi = PrimeImplicants::calculate(&pdag, or_gate);

        let order1 = pi.by_order(1);
        let order2 = pi.by_order(2);

        assert_eq!(order1.len(), 1);
        assert_eq!(order2.len(), 1);
    }

    #[test]
    fn test_not_gate() {

        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let not_gate = pdag
            .add_gate("G1".to_string(), Connective::Not, vec![e1], None)
            .unwrap();

        let pi = PrimeImplicants::calculate(&pdag, not_gate);

        assert_eq!(pi.count(), 1);

        assert_eq!(pi.implicants()[0].events, vec![-e1]);
    }
}
