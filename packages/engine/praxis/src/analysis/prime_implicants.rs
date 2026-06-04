//! Prime Implicants calculation for success-oriented analysis
//!
//! Prime implicants are the dual of minimal cut sets - they represent the
//! minimal combinations of working components that ensure system success.
//! While cut sets identify failure scenarios, prime implicants identify
//! success scenarios.
//!
//! # Relationship to Cut Sets
//!
//! For a coherent system (one where more working components never makes
//! the system worse):
//! - **Minimal Cut Sets**: Minimal failure combinations
//! - **Prime Implicants**: Minimal success combinations
//!
//! The prime implicants of a system are equivalent to the minimal cut sets
//! of the complement (negated) system.
//!
//! # Examples
//!
//! For a simple AND gate (E1 AND E2):
//! - Minimal Cut Set: {E1}, {E2} (either failing causes system failure)
//! - Prime Implicant: {E1, E2} (both must work for system success)
//!
//! For a simple OR gate (E1 OR E2):
//! - Minimal Cut Set: {E1, E2} (both must fail for system failure)
//! - Prime Implicant: {E1}, {E2} (either working ensures system success)
//!
//! # Usage
//!
//! ```
//! use praxis::analysis::prime_implicants::PrimeImplicants;
//! use praxis::algorithms::pdag::{Connective, Pdag};
//!
//! let mut pdag = Pdag::new();
//! let e1 = pdag.add_basic_event("E1".to_string());
//! let e2 = pdag.add_basic_event("E2".to_string());
//! let top_gate_index = pdag
//!     .add_gate(
//!         "G1".to_string(),
//!         Connective::And,
//!         vec![e1, e2],
//!         None,
//!     )
//!     .unwrap();
//! pdag.set_root(top_gate_index).unwrap();
//!
//! let pi = PrimeImplicants::calculate(&pdag, top_gate_index);
//! for implicant in pi.implicants() {
//!     println!("Prime implicant: {:?}", implicant);
//! }
//! ```
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use std::collections::{HashMap, HashSet};

/// A single prime implicant - a minimal set of working components
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PrimeImplicant {
    /// Event indices that must work for system success
    /// Positive indices: event must work (not fail)
    /// Negative indices: complement (event must fail) - rare but possible
    pub events: Vec<i32>,
}

impl PrimeImplicant {
    /// Create a new prime implicant from event indices
    pub fn new(events: Vec<i32>) -> Self {
        let mut sorted = events;
        sorted.sort_by_key(|x| x.abs());
        PrimeImplicant { events: sorted }
    }

    /// Get the order (size) of this prime implicant
    pub fn order(&self) -> usize {
        self.events.len()
    }

    /// Check if this implicant is a subset of another
    pub fn is_subset_of(&self, other: &PrimeImplicant) -> bool {
        self.events.iter().all(|e| other.events.contains(e))
    }
}

/// Result of prime implicant calculation
#[derive(Debug, Clone)]
pub struct PrimeImplicants {
    /// List of prime implicants
    implicants: Vec<PrimeImplicant>,
    /// Minimum order (smallest implicant size)
    min_order: usize,
    /// Maximum order (largest implicant size)
    max_order: usize,
}

impl PrimeImplicants {
    /// Create from a list of implicants
    fn new(mut implicants: Vec<PrimeImplicant>) -> Self {
        // Remove non-minimal implicants (those that contain a smaller one)
        implicants = Self::minimize(implicants);

        let min_order = implicants.iter().map(|pi| pi.order()).min().unwrap_or(0);
        let max_order = implicants.iter().map(|pi| pi.order()).max().unwrap_or(0);

        PrimeImplicants {
            implicants,
            min_order,
            max_order,
        }
    }

    /// Remove non-minimal implicants
    fn minimize(mut implicants: Vec<PrimeImplicant>) -> Vec<PrimeImplicant> {
        if implicants.is_empty() {
            return implicants;
        }

        // Sort by order (size) to process smaller ones first
        implicants.sort_by_key(|pi| pi.order());

        let mut minimal = Vec::new();
        for candidate in implicants {
            // Check if any existing minimal implicant is a subset of this candidate
            let is_minimal = !minimal
                .iter()
                .any(|pi: &PrimeImplicant| pi.is_subset_of(&candidate));
            if is_minimal {
                minimal.push(candidate);
            }
        }
        minimal
    }

    /// Calculate prime implicants from a Pdag structure
    ///
    /// This uses the complement-duality principle: prime implicants of F
    /// are the minimal cut sets of NOT F.
    ///
    /// # Arguments
    /// * `pdag` - The Pdag representing the fault tree
    /// * `top_gate` - The index of the top gate
    ///
    /// # Returns
    /// * `PrimeImplicants` - The calculated prime implicants
    pub fn calculate(pdag: &Pdag, top_gate: NodeIndex) -> Self {
        let mut calculator = PrimeImplicantCalculator::new(pdag);
        let implicants = calculator.calculate(top_gate);
        PrimeImplicants::new(implicants)
    }

    /// Get the list of prime implicants
    pub fn implicants(&self) -> &[PrimeImplicant] {
        &self.implicants
    }

    /// Get the count of prime implicants
    pub fn count(&self) -> usize {
        self.implicants.len()
    }

    /// Get the minimum order
    pub fn min_order(&self) -> usize {
        self.min_order
    }

    /// Get the maximum order
    pub fn max_order(&self) -> usize {
        self.max_order
    }

    /// Check if empty (no prime implicants)
    pub fn is_empty(&self) -> bool {
        self.implicants.is_empty()
    }

    /// Get all prime implicants of a specific order
    pub fn by_order(&self, order: usize) -> Vec<&PrimeImplicant> {
        self.implicants
            .iter()
            .filter(|pi| pi.order() == order)
            .collect()
    }
}

/// Internal calculator for prime implicants
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

    /// Calculate prime implicants recursively
    ///
    /// Uses complement-duality: to find prime implicants of a gate,
    /// we convert it to its dual (complement) and find cut sets.
    fn calculate(&mut self, node: NodeIndex) -> Vec<PrimeImplicant> {
        self.calculate_internal(node, false)
    }

    fn calculate_internal(&mut self, node: NodeIndex, complement: bool) -> Vec<PrimeImplicant> {
        // Check cache
        if let Some(cached) = self.cache.get(&(node, complement)) {
            return cached.clone();
        }

        let result = match self.pdag.get_node(node) {
            None => vec![],
            Some(PdagNode::BasicEvent { .. }) => {
                // A basic event: the prime implicant is the event itself working
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
                // Apply complement using De Morgan's laws if needed
                if complement {
                    // Apply De Morgan's: NOT(A AND B) = NOT(A) OR NOT(B)
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
                // XOR prime implicants are complex - approximate with OR for now
                self.calculate_or(operands, complement)
            }
            Connective::Iff => {
                // Non-coherent connective; prime implicants not supported in current implementation.
                vec![]
            }
            Connective::AtLeast => {
                // For AtLeast, we need the min_number from the gate node
                // For now, default to majority (N/2 + 1)
                let k = (operands.len() / 2) + 1;
                self.calculate_atleast(operands, k, complement)
            }
        }
    }

    /// For AND gate: prime implicants require ALL operands to work
    /// PI(A ∧ B) = {a ∪ b | a ∈ PI(A), b ∈ PI(B)}
    fn calculate_and(&mut self, operands: &[NodeIndex], complement: bool) -> Vec<PrimeImplicant> {
        if operands.is_empty() {
            return vec![PrimeImplicant::new(vec![])];
        }

        // Get prime implicants of first operand
        let mut result = self.calculate_internal(operands[0], complement);

        // Combine with each subsequent operand
        for &operand in &operands[1..] {
            let operand_pis = self.calculate_internal(operand, complement);
            result = self.combine_and(result, operand_pis);
        }

        result
    }

    /// For OR gate: prime implicants require ANY operand to work
    /// PI(A ∨ B) = minimize(PI(A) ∪ PI(B))
    fn calculate_or(&mut self, operands: &[NodeIndex], complement: bool) -> Vec<PrimeImplicant> {
        if operands.is_empty() {
            return vec![];
        }

        let mut result = Vec::new();

        // Collect all prime implicants from all operands
        for &operand in operands {
            let operand_pis = self.calculate_internal(operand, complement);
            result.extend(operand_pis);
        }

        // Remove duplicates and non-minimal
        let unique: HashSet<_> = result.into_iter().collect();
        PrimeImplicants::minimize(unique.into_iter().collect())
    }

    /// Combine prime implicants for AND operation
    fn combine_and(
        &self,
        left: Vec<PrimeImplicant>,
        right: Vec<PrimeImplicant>,
    ) -> Vec<PrimeImplicant> {
        let mut result = Vec::new();

        for l in &left {
            for r in &right {
                // Union of two implicants
                let mut combined = l.events.clone();
                combined.extend(&r.events);

                // Remove duplicates
                combined.sort_by_key(|x| x.abs());
                combined.dedup();

                result.push(PrimeImplicant::new(combined));
            }
        }

        result
    }

    /// For K/N gate: at least K out of N must work
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

        // Generate all combinations of size k from operands
        let mut result = Vec::new();
        let combinations = Self::combinations(operands, k);

        for combo in combinations {
            // For each combination, compute AND of those operands
            let mut combo_pi = vec![PrimeImplicant::new(vec![])];
            for &op in &combo {
                let op_pis = self.calculate_internal(op, complement);
                combo_pi = self.combine_and(combo_pi, op_pis);
            }
            result.extend(combo_pi);
        }

        // Minimize the result
        let unique: HashSet<_> = result.into_iter().collect();
        PrimeImplicants::minimize(unique.into_iter().collect())
    }

    /// Generate all combinations of size k from a slice
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

        // Include first item
        for mut combo in Self::combinations(&items[1..], k - 1) {
            combo.insert(0, items[0]);
            result.push(combo);
        }

        // Exclude first item
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
            PrimeImplicant::new(vec![1, 2]), // Subset of first
            PrimeImplicant::new(vec![4, 5]),
        ];

        let minimal = PrimeImplicants::minimize(pis);
        assert_eq!(minimal.len(), 2); // Should keep [1,2] and [4,5]
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
        // For AND gate: both events must work
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
        // For OR gate: either event working ensures success
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let or_gate = pdag
            .add_gate("G1".to_string(), Connective::Or, vec![e1, e2], None)
            .unwrap();

        let pi = PrimeImplicants::calculate(&pdag, or_gate);

        // Should have 2 prime implicants: {E1} and {E2}
        assert_eq!(pi.count(), 2);
        assert_eq!(pi.min_order(), 1);
        assert_eq!(pi.max_order(), 1);
    }

    #[test]
    fn test_nested_gates() {
        // (E1 AND E2) OR E3
        // Prime implicants: {E1, E2}, {E3}
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
        // One implicant should be {E3}
        assert!(pi.implicants().iter().any(|p| p.events == vec![e3]));
        // Other should contain {E1, E2}
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

        // Constant true has empty prime implicant (always succeeds)
        assert_eq!(pi.count(), 1);
        assert_eq!(pi.implicants()[0].events.len(), 0);
    }

    #[test]
    fn test_constant_false() {
        let mut pdag = Pdag::new();
        let false_const = pdag.add_constant(false);

        let pi = PrimeImplicants::calculate(&pdag, false_const);

        // Constant false has no prime implicants (never succeeds)
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

        assert_eq!(order1.len(), 1); // {E3}
        assert_eq!(order2.len(), 1); // {E1, E2}
    }

    #[test]
    fn test_not_gate() {
        // NOT(E1) prime implicant is E1 failing (complement)
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let not_gate = pdag
            .add_gate("G1".to_string(), Connective::Not, vec![e1], None)
            .unwrap();

        let pi = PrimeImplicants::calculate(&pdag, not_gate);

        assert_eq!(pi.count(), 1);
        // Should be complement of E1
        assert_eq!(pi.implicants()[0].events, vec![-e1]);
    }
}
