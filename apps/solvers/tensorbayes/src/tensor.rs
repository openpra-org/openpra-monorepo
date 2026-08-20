use crate::{Error, Result};

/// Owned row-major dense tensor storage.
#[derive(Clone, Debug, PartialEq)]
pub struct DenseTensor {
    shape: Vec<usize>,
    strides: Vec<usize>,
    values: Vec<f64>,
}

impl DenseTensor {
    pub fn zeros(shape: Vec<usize>) -> Result<Self> {
        let size = checked_size(&shape)?;
        Ok(Self {
            strides: row_major_strides(&shape)?,
            shape,
            values: vec![0.0; size],
        })
    }

    pub fn filled(shape: Vec<usize>, value: f64) -> Result<Self> {
        let size = checked_size(&shape)?;
        Ok(Self {
            strides: row_major_strides(&shape)?,
            shape,
            values: vec![value; size],
        })
    }

    pub fn from_vec(shape: Vec<usize>, values: Vec<f64>) -> Result<Self> {
        let expected = checked_size(&shape)?;
        if values.len() != expected {
            return Err(Error::TensorDataLength {
                expected,
                actual: values.len(),
            });
        }
        Ok(Self {
            strides: row_major_strides(&shape)?,
            shape,
            values,
        })
    }

    pub fn shape(&self) -> &[usize] {
        &self.shape
    }

    pub fn strides(&self) -> &[usize] {
        &self.strides
    }

    pub fn len(&self) -> usize {
        self.values.len()
    }

    pub fn is_empty(&self) -> bool {
        self.values.is_empty()
    }

    pub fn values(&self) -> &[f64] {
        &self.values
    }

    pub fn values_mut(&mut self) -> &mut [f64] {
        &mut self.values
    }

    pub fn fill(&mut self, value: f64) {
        self.values.fill(value);
    }

    pub fn flat_index(&self, indices: &[usize]) -> Result<usize> {
        if indices.len() != self.shape.len() {
            return Err(Error::TensorRankMismatch {
                expected: self.shape.len(),
                actual: indices.len(),
            });
        }
        let mut flat = 0usize;
        for (axis, ((&index, &size), &stride)) in indices
            .iter()
            .zip(&self.shape)
            .zip(&self.strides)
            .enumerate()
        {
            if index >= size {
                return Err(Error::TensorIndexOutOfBounds { axis, index, size });
            }
            flat = flat
                .checked_add(index.checked_mul(stride).ok_or(Error::DimensionOverflow {
                    context: "tensor index",
                })?)
                .ok_or(Error::DimensionOverflow {
                    context: "tensor index",
                })?;
        }
        Ok(flat)
    }

    pub fn get(&self, indices: &[usize]) -> Result<f64> {
        Ok(self.values[self.flat_index(indices)?])
    }

    pub fn set(&mut self, indices: &[usize], value: f64) -> Result<()> {
        let index = self.flat_index(indices)?;
        self.values[index] = value;
        Ok(())
    }

    pub fn multiply_in_place(&mut self, other: &Self) -> Result<()> {
        if self.shape != other.shape {
            return Err(Error::TensorDataLength {
                expected: self.len(),
                actual: other.len(),
            });
        }
        for (left, right) in self.values.iter_mut().zip(&other.values) {
            *left *= right;
        }
        Ok(())
    }
}

pub(crate) fn checked_size(shape: &[usize]) -> Result<usize> {
    if shape.is_empty() {
        return Err(Error::EmptyTensorShape);
    }
    shape.iter().try_fold(1usize, |size, &axis| {
        size.checked_mul(axis).ok_or(Error::DimensionOverflow {
            context: "tensor size",
        })
    })
}

pub(crate) fn row_major_strides(shape: &[usize]) -> Result<Vec<usize>> {
    if shape.is_empty() {
        return Err(Error::EmptyTensorShape);
    }
    let mut strides = vec![1usize; shape.len()];
    for axis in (0..shape.len().saturating_sub(1)).rev() {
        strides[axis] =
            strides[axis + 1]
                .checked_mul(shape[axis + 1])
                .ok_or(Error::DimensionOverflow {
                    context: "tensor strides",
                })?;
    }
    Ok(strides)
}
