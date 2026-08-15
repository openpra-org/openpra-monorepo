use crate::tensor::checked_size;
use crate::{DenseTensor, Error, NodeId, Result};
use std::collections::HashSet;

/// A dense factor with an explicit final batch axis.
///
/// Scope order is significant. Scalar factors use a batch size of one and
/// therefore have the same flat layout as the C++ scalar representation.
#[derive(Clone, Debug, PartialEq)]
pub struct Factor {
    scope: Vec<NodeId>,
    cardinalities: Vec<usize>,
    batch_size: usize,
    tensor: DenseTensor,
}

impl Factor {
    pub fn zeros(scope: Vec<NodeId>, cardinalities: Vec<usize>, batch_size: usize) -> Result<Self> {
        Self::filled(scope, cardinalities, batch_size, 0.0)
    }

    pub fn ones(scope: Vec<NodeId>, cardinalities: Vec<usize>, batch_size: usize) -> Result<Self> {
        Self::filled(scope, cardinalities, batch_size, 1.0)
    }

    pub fn filled(
        scope: Vec<NodeId>,
        cardinalities: Vec<usize>,
        batch_size: usize,
        value: f64,
    ) -> Result<Self> {
        validate_geometry(&scope, &cardinalities, batch_size)?;
        let mut shape = cardinalities.clone();
        shape.push(batch_size);
        Ok(Self {
            scope,
            cardinalities,
            batch_size,
            tensor: DenseTensor::filled(shape, value)?,
        })
    }

    pub fn from_values(
        scope: Vec<NodeId>,
        cardinalities: Vec<usize>,
        batch_size: usize,
        values: Vec<f64>,
    ) -> Result<Self> {
        validate_geometry(&scope, &cardinalities, batch_size)?;
        let mut shape = cardinalities.clone();
        shape.push(batch_size);
        Ok(Self {
            scope,
            cardinalities,
            batch_size,
            tensor: DenseTensor::from_vec(shape, values)?,
        })
    }

    pub fn scope(&self) -> &[NodeId] {
        &self.scope
    }

    pub fn cardinalities(&self) -> &[usize] {
        &self.cardinalities
    }

    pub fn batch_size(&self) -> usize {
        self.batch_size
    }

    pub fn is_batched(&self) -> bool {
        self.batch_size > 1
    }

    pub fn tensor(&self) -> &DenseTensor {
        &self.tensor
    }

    pub fn tensor_mut(&mut self) -> &mut DenseTensor {
        &mut self.tensor
    }

    pub fn state_configurations(&self) -> usize {
        self.tensor.len() / self.batch_size
    }

    /// Multiplies two factors, retaining the left scope order and appending
    /// variables that occur only in the right factor in right-scope order.
    pub fn multiply(&self, other: &Self) -> Result<Self> {
        let batch_size = broadcast_batch(self.batch_size, other.batch_size)?;
        let mut scope = self.scope.clone();
        let mut cardinalities = self.cardinalities.clone();

        for (&node, &cardinality) in other.scope.iter().zip(&other.cardinalities) {
            if let Some(position) = scope.iter().position(|&candidate| candidate == node) {
                if cardinalities[position] != cardinality {
                    return Err(Error::FactorCardinalityMismatch {
                        node,
                        left: cardinalities[position],
                        right: cardinality,
                    });
                }
            } else {
                scope.push(node);
                cardinalities.push(cardinality);
            }
        }

        let state_count = state_count(&cardinalities)?;
        let mut values = vec![0.0; state_count * batch_size];
        let union_strides = state_strides(&cardinalities)?;
        let left_strides = state_strides(&self.cardinalities)?;
        let right_strides = state_strides(&other.cardinalities)?;
        let left_positions = positions(&scope, &self.scope)?;
        let right_positions = positions(&scope, &other.scope)?;

        for union_index in 0..state_count {
            let coordinates = unravel(union_index, &cardinalities, &union_strides);
            let left_index = projected_index(&coordinates, &left_positions, &left_strides);
            let right_index = projected_index(&coordinates, &right_positions, &right_strides);
            for batch in 0..batch_size {
                let left_batch = if self.batch_size == 1 { 0 } else { batch };
                let right_batch = if other.batch_size == 1 { 0 } else { batch };
                values[union_index * batch_size + batch] = self.tensor.values()
                    [left_index * self.batch_size + left_batch]
                    * other.tensor.values()[right_index * other.batch_size + right_batch];
            }
        }

        Self::from_values(scope, cardinalities, batch_size, values)
    }

    /// Sums out the requested variables while preserving retained scope order.
    pub fn marginalize(&self, variables: &[NodeId]) -> Result<Self> {
        for &node in variables {
            if !self.scope.contains(&node) {
                return Err(Error::NodeOutsideFactor(node));
            }
        }
        let marginalized: HashSet<NodeId> = variables.iter().copied().collect();
        let mut scope = Vec::new();
        let mut cardinalities = Vec::new();
        let mut retained_positions = Vec::new();
        for (position, (&node, &cardinality)) in
            self.scope.iter().zip(&self.cardinalities).enumerate()
        {
            if !marginalized.contains(&node) {
                scope.push(node);
                cardinalities.push(cardinality);
                retained_positions.push(position);
            }
        }

        let output_states = state_count(&cardinalities)?;
        let mut values = vec![0.0; output_states * self.batch_size];
        let input_strides = state_strides(&self.cardinalities)?;
        let output_strides = state_strides(&cardinalities)?;

        for input_index in 0..self.state_configurations() {
            let coordinates = unravel(input_index, &self.cardinalities, &input_strides);
            let output_index = retained_positions
                .iter()
                .zip(&output_strides)
                .map(|(&position, &stride)| coordinates[position] * stride)
                .sum::<usize>();
            for batch in 0..self.batch_size {
                values[output_index * self.batch_size + batch] +=
                    self.tensor.values()[input_index * self.batch_size + batch];
            }
        }

        Self::from_values(scope, cardinalities, self.batch_size, values)
    }

    pub(crate) fn project_to(&self, retained_scope: &[NodeId]) -> Result<Self> {
        let retained: HashSet<NodeId> = retained_scope.iter().copied().collect();
        for &node in retained_scope {
            if !self.scope.contains(&node) {
                return Err(Error::NodeOutsideFactor(node));
            }
        }
        let remove: Vec<NodeId> = self
            .scope
            .iter()
            .copied()
            .filter(|node| !retained.contains(node))
            .collect();
        self.marginalize(&remove)
    }
}

fn validate_geometry(scope: &[NodeId], cardinalities: &[usize], batch_size: usize) -> Result<()> {
    if scope.len() != cardinalities.len() || batch_size == 0 || cardinalities.contains(&0) {
        return Err(Error::FactorRankMismatch);
    }
    let mut unique = HashSet::with_capacity(scope.len());
    if scope.iter().any(|node| !unique.insert(*node)) {
        return Err(Error::FactorRankMismatch);
    }
    checked_size(&[state_count(cardinalities)?, batch_size])?;
    Ok(())
}

fn state_count(cardinalities: &[usize]) -> Result<usize> {
    cardinalities
        .iter()
        .try_fold(1usize, |count, &cardinality| {
            count
                .checked_mul(cardinality)
                .ok_or(Error::DimensionOverflow {
                    context: "factor state count",
                })
        })
}

fn state_strides(cardinalities: &[usize]) -> Result<Vec<usize>> {
    if cardinalities.is_empty() {
        return Ok(Vec::new());
    }
    let mut strides = vec![1usize; cardinalities.len()];
    for position in (0..cardinalities.len() - 1).rev() {
        strides[position] = strides[position + 1]
            .checked_mul(cardinalities[position + 1])
            .ok_or(Error::DimensionOverflow {
                context: "factor strides",
            })?;
    }
    Ok(strides)
}

fn positions(union_scope: &[NodeId], factor_scope: &[NodeId]) -> Result<Vec<usize>> {
    factor_scope
        .iter()
        .map(|node| {
            union_scope
                .iter()
                .position(|candidate| candidate == node)
                .ok_or(Error::NodeOutsideFactor(*node))
        })
        .collect()
}

fn unravel(index: usize, cardinalities: &[usize], strides: &[usize]) -> Vec<usize> {
    cardinalities
        .iter()
        .zip(strides)
        .map(|(&cardinality, &stride)| (index / stride) % cardinality)
        .collect()
}

fn projected_index(coordinates: &[usize], positions: &[usize], strides: &[usize]) -> usize {
    positions
        .iter()
        .zip(strides)
        .map(|(&position, &stride)| coordinates[position] * stride)
        .sum()
}

fn broadcast_batch(left: usize, right: usize) -> Result<usize> {
    if left == right {
        Ok(left)
    } else if left == 1 {
        Ok(right)
    } else if right == 1 {
        Ok(left)
    } else {
        Err(Error::FactorBatchMismatch { left, right })
    }
}
