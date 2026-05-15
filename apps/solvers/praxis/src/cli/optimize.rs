use praxis::core::fault_tree::FaultTree;
use praxis::core::model::Model;
use praxis::mc::plan::RunParams;
use sysinfo::System;

pub fn estimate_fault_tree_nodes(fault_tree: &FaultTree) -> usize {
    let fallback = fault_tree
        .gates()
        .len()
        .saturating_add(fault_tree.basic_events().len())
        .saturating_add(1);

    let mut pdag = match praxis::algorithms::pdag::Pdag::from_fault_tree(fault_tree) {
        Ok(p) => p,
        Err(_) => return fallback,
    };

    if praxis::mc::preprocess::preprocess_for_mc(&mut pdag).is_err() {
        return fallback;
    }

    pdag
        .nodes()
        .keys()
        .map(|n| n.unsigned_abs() as usize)
        .max()
        .map(|max_idx| max_idx.saturating_add(1))
        .unwrap_or(fallback)
}

pub fn estimate_model_nodes(model: &Model) -> usize {
    let total: usize = model
        .fault_trees()
        .values()
        .map(estimate_fault_tree_nodes)
        .sum();
    total.max(1)
}

pub fn optimize_run_params_for_cpu(
    node_count: usize,
    seed: u64,
) -> anyhow::Result<RunParams> {
    let mut system = System::new_all();
    system.refresh_memory();

    let avail_ram_bytes = system.available_memory() as u128;
    let total_ram_bytes = system.total_memory() as u128;

    let node_count_u128 = node_count.max(1) as u128;
    let bytes_per_bp = 8u128.saturating_mul(node_count_u128);

    const RAM_OVERHEAD_MULTIPLIER: u128 = 2;

    let ram_avail_target = ((avail_ram_bytes as f64) * 0.90).floor() as u128;
    let ram_total_target = ((total_ram_bytes as f64) * 0.75).floor() as u128;
    let mut ram_budget = ram_avail_target.min(ram_total_target);
    let ram_reserve = 512u128 * 1024u128 * 1024u128;
    ram_budget = ram_budget.saturating_sub(ram_reserve);

    let denom_ram = bytes_per_bp.saturating_mul(RAM_OVERHEAD_MULTIPLIER);
    let max_bp_by_ram = if denom_ram == 0 {
        1
    } else {
        ram_budget / denom_ram
    };

    let per_buffer_cap_bytes = 2048u128 * 1024u128 * 1024u128;
    let max_bp_by_buffer_cap = if bytes_per_bp == 0 {
        1
    } else {
        per_buffer_cap_bytes / bytes_per_bp
    };

    let max_bp = max_bp_by_ram
        .min(max_bp_by_buffer_cap)
        .max(1);

    let mut b = (max_bp as f64).sqrt().floor() as usize;
    b = b.max(1);
    let mut p = (max_bp / (b as u128)) as usize;
    p = p.max(1);

    Ok(RunParams::new(1, b, p, RunParams::DEFAULT_OMEGA, seed))
}

#[cfg(feature = "cuda")]
pub fn optimize_run_params_for_cuda(
    num_trials_target: usize,
    node_count: usize,
    seed: u64,
) -> anyhow::Result<RunParams> {
    use nvml_wrapper::Nvml;

    let mut system = System::new_all();
    system.refresh_memory();

    let avail_ram_bytes = system.available_memory();

    let nvml = Nvml::init().map_err(|e| anyhow::anyhow!("NVML init failed: {e}"))?;
    let device = nvml
        .device_by_index(0)
        .map_err(|e| anyhow::anyhow!("NVML device[0] unavailable: {e}"))?;
    let mem = device
        .memory_info()
        .map_err(|e| anyhow::anyhow!("NVML memory query failed: {e}"))?;

    let node_count_u128 = node_count.max(1) as u128;
    let bytes_per_bp = 8u128.saturating_mul(node_count_u128);

    const GPU_OVERHEAD_MULTIPLIER: u128 = 2;
    const RAM_OVERHEAD_MULTIPLIER: u128 = 2;

    let gpu_free_target = ((mem.free as f64) * 0.90).floor() as u128;
    let gpu_total_target = ((mem.total as f64) * 0.90).floor() as u128;
    let mut gpu_budget = gpu_free_target.min(gpu_total_target);
    let gpu_reserve = 256u128 * 1024u128 * 1024u128;
    gpu_budget = gpu_budget.saturating_sub(gpu_reserve);

    let ram_budget = ((avail_ram_bytes as f64) * 0.80).floor() as u128;

    let denom_gpu = bytes_per_bp.saturating_mul(GPU_OVERHEAD_MULTIPLIER);
    let denom_ram = bytes_per_bp.saturating_mul(RAM_OVERHEAD_MULTIPLIER);
    let max_bp_by_gpu = if denom_gpu == 0 {
        1
    } else {
        gpu_budget / denom_gpu
    };
    let max_bp_by_ram = if denom_ram == 0 {
        1
    } else {
        ram_budget / denom_ram
    };

    let per_buffer_cap_bytes = 1536u128 * 1024u128 * 1024u128;
    let max_bp_by_buffer_cap = if bytes_per_bp == 0 {
        1
    } else {
        per_buffer_cap_bytes / bytes_per_bp
    };

    let max_bp = max_bp_by_gpu
        .min(max_bp_by_ram)
        .min(max_bp_by_buffer_cap)
        .max(1);

    let mut b = (max_bp as f64).sqrt().floor() as usize;
    b = b.max(1);
    let mut p = (max_bp / (b as u128)) as usize;
    p = p.max(1);

    let trials_per_iter = b
        .saturating_mul(p)
        .saturating_mul(RunParams::DEFAULT_OMEGA)
        .max(1);

    let t = num_trials_target.div_ceil(trials_per_iter).max(1);

    Ok(RunParams::new(t, b, p, RunParams::DEFAULT_OMEGA, seed))
}

#[cfg(not(feature = "cuda"))]
pub fn optimize_run_params_for_cuda(
    _num_trials_target: usize,
    _node_count: usize,
    _seed: u64,
) -> anyhow::Result<RunParams> {
    Err(anyhow::anyhow!(
        "--optimize with CUDA requires a build with '--features cuda'"
    ))
}
