use crate::core::element::Element;
use crate::Result;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Formula {
    And,
    Or,
    Not,
    AtLeast { min: usize },
    Xor,
    Nand,
    Nor,
    Iff,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Gate {
    element: Element,
    formula: Formula,
    operands: Vec<String>,
}

impl Gate {
    /// Creates a new Gate with the given id and formula.
    /// Corresponds to Gate constructor in C++ (inherits from Event/Id)
    /// T033: Gate::new() constructor
    ///
    /// # Arguments
    /// * `id` - The unique identifier for the gate
    /// * `formula` - The logic formula type for this gate
    ///
    /// # Errors
    /// Returns error if id is invalid (via Element::new())
    ///
    /// # Example
    /// ```
    /// use praxis::core::gate::{Gate, Formula};
    /// let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    /// ```
    pub fn new(id: String, formula: Formula) -> Result<Self> {
        let element = Element::new(id)?;
        Ok(Gate {
            element,
            formula,
            operands: Vec::new(),
        })
    }

    /// Returns reference to the underlying Element
    /// Provides access to id, name, label
    pub fn element(&self) -> &Element {
        &self.element
    }

    /// Returns mutable reference to the underlying Element
    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    /// Returns the formula type of this gate
    /// Corresponds to Gate::formula() const in C++
    /// T036: Gate::formula() method
    pub fn formula(&self) -> &Formula {
        &self.formula
    }

    /// Adds an operand (event or gate reference) to this gate
    /// Corresponds to adding arguments to a gate in C++
    /// T039: Gate::add_operand() method
    ///
    /// # Arguments
    /// * `operand_id` - The ID of the event or gate to add as operand
    pub fn add_operand(&mut self, operand_id: String) {
        self.operands.push(operand_id);
    }

    /// Returns a slice of operand IDs for this gate
    /// Corresponds to accessing gate arguments in C++
    /// T042: Gate::operands() method
    pub fn operands(&self) -> &[String] {
        &self.operands
    }

    pub fn operands_mut(&mut self) -> &mut Vec<String> {
        &mut self.operands
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // T034: Tests for Gate::new()
    #[test]
    fn test_gate_new_and_formula() {
        let gate = Gate::new("G1".to_string(), Formula::And);
        assert!(gate.is_ok());

        let gate = gate.unwrap();
        assert_eq!(gate.element().id(), "G1");
        assert_eq!(gate.formula(), &Formula::And);
        assert_eq!(gate.operands().len(), 0);
    }

    #[test]
    fn test_gate_new_or_formula() {
        let gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        assert_eq!(gate.formula(), &Formula::Or);
    }

    #[test]
    fn test_gate_new_not_formula() {
        let gate = Gate::new("G1".to_string(), Formula::Not).unwrap();
        assert_eq!(gate.formula(), &Formula::Not);
    }

    #[test]
    fn test_gate_new_atleast_formula() {
        let gate = Gate::new("G1".to_string(), Formula::AtLeast { min: 2 }).unwrap();
        assert_eq!(gate.formula(), &Formula::AtLeast { min: 2 });
    }

    #[test]
    fn test_gate_new_xor_formula() {
        let gate = Gate::new("G1".to_string(), Formula::Xor).unwrap();
        assert_eq!(gate.formula(), &Formula::Xor);
    }

    #[test]
    fn test_gate_new_nand_formula() {
        let gate = Gate::new("G1".to_string(), Formula::Nand).unwrap();
        assert_eq!(gate.formula(), &Formula::Nand);
    }

    #[test]
    fn test_gate_new_nor_formula() {
        let gate = Gate::new("G1".to_string(), Formula::Nor).unwrap();
        assert_eq!(gate.formula(), &Formula::Nor);
    }

    #[test]
    fn test_gate_new_iff_formula() {
        let gate = Gate::new("G1".to_string(), Formula::Iff).unwrap();
        assert_eq!(gate.formula(), &Formula::Iff);
    }

    #[test]
    fn test_gate_new_invalid_id() {
        let result = Gate::new("".to_string(), Formula::And);
        assert!(result.is_err());
    }

    #[test]
    fn test_gate_element_access() {
        let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        assert_eq!(gate.element().id(), "G1");
        assert_eq!(gate.element().name(), None);
        assert_eq!(gate.element().label(), None);
    }

    #[test]
    fn test_gate_element_mut() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.element_mut().set_name("Gate One".to_string());
        gate.element_mut().set_label(Some("AND gate".to_string()));

        assert_eq!(gate.element().name(), Some("Gate One"));
        assert_eq!(gate.element().label(), Some("AND gate"));
    }

    // T037: Tests for Gate::formula()
    #[test]
    fn test_gate_formula_getter() {
        let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        assert_eq!(gate.formula(), &Formula::And);
    }

    #[test]
    fn test_gate_formula_returns_correct_type() {
        let gate_and = Gate::new("G1".to_string(), Formula::And).unwrap();
        let gate_or = Gate::new("G2".to_string(), Formula::Or).unwrap();
        let gate_not = Gate::new("G3".to_string(), Formula::Not).unwrap();

        assert_eq!(gate_and.formula(), &Formula::And);
        assert_eq!(gate_or.formula(), &Formula::Or);
        assert_eq!(gate_not.formula(), &Formula::Not);
    }

    #[test]
    fn test_gate_formula_atleast() {
        let gate = Gate::new("G1".to_string(), Formula::AtLeast { min: 3 }).unwrap();
        match gate.formula() {
            Formula::AtLeast { min } => assert_eq!(*min, 3),
            _ => panic!("Expected AtLeast formula"),
        }
    }

    #[test]
    fn test_formula_equality() {
        assert_eq!(Formula::And, Formula::And);
        assert_ne!(Formula::And, Formula::Or);
        assert_eq!(Formula::AtLeast { min: 2 }, Formula::AtLeast { min: 2 });
        assert_ne!(Formula::AtLeast { min: 2 }, Formula::AtLeast { min: 3 });
    }

    #[test]
    fn test_formula_clone() {
        let f1 = Formula::And;
        let f2 = f1.clone();
        assert_eq!(f1, f2);
    }

    // T040: Tests for Gate::add_operand()
    #[test]
    fn test_gate_add_operand_single() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        assert_eq!(gate.operands().len(), 0);

        gate.add_operand("E1".to_string());
        assert_eq!(gate.operands().len(), 1);
        assert_eq!(gate.operands()[0], "E1");
    }

    #[test]
    fn test_gate_add_operand_multiple() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();

        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        gate.add_operand("E3".to_string());

        assert_eq!(gate.operands().len(), 3);
        assert_eq!(gate.operands()[0], "E1");
        assert_eq!(gate.operands()[1], "E2");
        assert_eq!(gate.operands()[2], "E3");
    }

    #[test]
    fn test_gate_add_operand_preserves_order() {
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();

        gate.add_operand("A".to_string());
        gate.add_operand("B".to_string());
        gate.add_operand("C".to_string());

        let operands = gate.operands();
        assert_eq!(operands, &["A", "B", "C"]);
    }

    #[test]
    fn test_gate_add_operand_gate_references() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();

        gate.add_operand("G2".to_string());
        gate.add_operand("G3".to_string());
        gate.add_operand("E1".to_string());

        assert_eq!(gate.operands().len(), 3);
        assert_eq!(gate.operands()[0], "G2");
        assert_eq!(gate.operands()[1], "G3");
        assert_eq!(gate.operands()[2], "E1");
    }

    // T043: Tests for Gate::operands()
    #[test]
    fn test_gate_operands_empty() {
        let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        assert_eq!(gate.operands().len(), 0);
        assert!(gate.operands().is_empty());
    }

    #[test]
    fn test_gate_operands_getter() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());

        let operands = gate.operands();
        assert_eq!(operands.len(), 2);
        assert_eq!(operands[0], "E1");
        assert_eq!(operands[1], "E2");
    }

    #[test]
    fn test_gate_operands_returns_slice() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());

        let operands1 = gate.operands();
        let operands2 = gate.operands();

        assert_eq!(operands1, operands2);
        assert_eq!(operands1.len(), 1);
    }

    #[test]
    fn test_gate_operands_immutable() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());

        let _operands = gate.operands();
        // operands is immutable slice, cannot modify

        assert_eq!(gate.operands().len(), 1);
    }

    #[test]
    fn test_gate_clone() {
        let mut gate1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate1.add_operand("E1".to_string());
        gate1.add_operand("E2".to_string());

        let gate2 = gate1.clone();

        assert_eq!(gate1.element().id(), gate2.element().id());
        assert_eq!(gate1.formula(), gate2.formula());
        assert_eq!(gate1.operands(), gate2.operands());
    }

    #[test]
    fn test_gate_equality() {
        let mut gate1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        let mut gate2 = Gate::new("G1".to_string(), Formula::And).unwrap();
        let gate3 = Gate::new("G2".to_string(), Formula::And).unwrap();
        let gate4 = Gate::new("G1".to_string(), Formula::Or).unwrap();

        assert_eq!(gate1, gate2);
        assert_ne!(gate1, gate3);
        assert_ne!(gate1, gate4);

        gate1.add_operand("E1".to_string());
        assert_ne!(gate1, gate2);

        gate2.add_operand("E1".to_string());
        assert_eq!(gate1, gate2);
    }

    #[test]
    fn test_gate_debug_format() {
        let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        let debug_str = format!("{:?}", gate);

        assert!(debug_str.contains("Gate"));
        assert!(debug_str.contains("G1"));
    }
}
