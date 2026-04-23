//! Small CPU-side helpers used by tests and lightweight utilities.

/// Simple gate operator enum for CPU reference evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateOp {
    And,
    Or,
    Not,
    Xor,
    Nand,
    Nor,
    Iff,
    AtLeast,
}

/// Evaluate a gate on CPU for a slice of boolean inputs.
///
/// For [`GateOp::AtLeast`], `min_number` must be provided.
pub fn evaluate_gate_cpu(op: GateOp, inputs: &[bool], min_number: Option<usize>) -> bool {
    match op {
        GateOp::And => inputs.iter().all(|&x| x),
        GateOp::Or => inputs.iter().any(|&x| x),
        GateOp::Not => inputs.first().map(|&x| !x).unwrap_or(false),
        GateOp::Xor => inputs.iter().filter(|&&x| x).count() == 1,
        GateOp::Nand => !inputs.iter().all(|&x| x),
        GateOp::Nor => !inputs.iter().any(|&x| x),
        GateOp::Iff => {
            let trues = inputs.iter().filter(|&&x| x).count();
            trues == 0 || trues == inputs.len()
        }
        GateOp::AtLeast => {
            let k = min_number.unwrap_or(0);
            inputs.iter().filter(|&&x| x).count() >= k
        }
    }
}

fn next_u64_xorshift(state: &mut u64) -> u64 {
    // Xorshift64 (deterministic, fast, good enough for tests).
    let mut x = *state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    *state = x;
    x
}

fn next_f64_unit(state: &mut u64) -> f64 {
    // Convert to [0,1) using the top 53 bits.
    let x = next_u64_xorshift(state);
    let mantissa = x >> 11;
    (mantissa as f64) / ((1u64 << 53) as f64)
}

/// Bernoulli sample on CPU.
///
/// `rng_state` is updated in-place so callers can reproduce sequences.
pub fn sample_event_cpu(probability: f64, rng_state: &mut u64) -> bool {
    if probability <= 0.0 {
        return false;
    }
    if probability >= 1.0 {
        return true;
    }

    next_f64_unit(rng_state) < probability
}
