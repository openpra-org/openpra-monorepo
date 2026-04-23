/// GPU kernel modules for Monte Carlo simulation.
///
/// This module contains the blueprint-aligned DPMC bitpacked kernels.
pub mod cpu;
pub mod dpmc_event;

pub use cpu::{evaluate_gate_cpu, sample_event_cpu, GateOp};

#[cfg(feature = "gpu")]
pub mod dpmc_gate;

#[cfg(feature = "gpu")]
pub mod dpmc_node;

#[cfg(feature = "gpu")]
pub mod dpmc_tally;

#[cfg(feature = "gpu")]
pub mod event_tree_seq;

#[cfg(feature = "gpu")]
pub use dpmc_gate::eval_gates_packed_gpu;

#[cfg(feature = "gpu")]
pub use dpmc_event::sample_events_bitpacked_gpu;
