use sysinfo::{Pid, ProcessesToUpdate, System};

#[derive(Debug, Clone, Copy)]
pub struct HostMemorySample {
    pub rss_bytes: u64,
    pub total_bytes: u64,
}

impl HostMemorySample {
    pub fn rss_mib(self) -> f64 {
        (self.rss_bytes as f64) / (1024.0 * 1024.0)
    }

    pub fn percent_used(self) -> f64 {
        if self.total_bytes == 0 {
            0.0
        } else {
            (self.rss_bytes as f64) * 100.0 / (self.total_bytes as f64)
        }
    }
}

pub struct HostMemoryTracker {
    system: System,
    pid: Pid,
    peak_rss_bytes: u64,
}

impl HostMemoryTracker {
    pub fn new_current_process() -> Self {
        Self {
            system: System::new_all(),
            pid: Pid::from_u32(std::process::id()),
            peak_rss_bytes: 0,
        }
    }

    pub fn sample(&mut self) -> Option<HostMemorySample> {
        self.system.refresh_memory();
        self.system
            .refresh_processes(ProcessesToUpdate::Some(&[self.pid]));

        let process = self.system.process(self.pid)?;
        let rss_bytes = process.memory();
        let total_bytes = self.system.total_memory();

        self.peak_rss_bytes = self.peak_rss_bytes.max(rss_bytes);

        Some(HostMemorySample {
            rss_bytes,
            total_bytes,
        })
    }

    pub fn peak_rss_mib(&self) -> Option<f64> {
        (self.peak_rss_bytes > 0).then(|| (self.peak_rss_bytes as f64) / (1024.0 * 1024.0))
    }
}

#[derive(Debug, Clone, Copy)]
pub struct CudaVramSample {
    pub used_bytes: u64,
    pub total_bytes: u64,
}

impl CudaVramSample {
    pub fn used_mib(self) -> f64 {
        (self.used_bytes as f64) / (1024.0 * 1024.0)
    }

    pub fn percent_used(self) -> f64 {
        if self.total_bytes == 0 {
            0.0
        } else {
            (self.used_bytes as f64) * 100.0 / (self.total_bytes as f64)
        }
    }
}

#[cfg(feature = "cuda")]
pub struct CudaVramTracker {
    nvml: Option<nvml_wrapper::Nvml>,
    pid: u32,
    peak_used_bytes: u64,
}

#[cfg(feature = "cuda")]
impl CudaVramTracker {
    pub fn new_current_process() -> Self {
        let nvml = nvml_wrapper::Nvml::init().ok();
        Self {
            nvml,
            pid: std::process::id(),
            peak_used_bytes: 0,
        }
    }

    pub fn sample(&mut self) -> Option<CudaVramSample> {
        let nvml = self.nvml.as_ref()?;
        let count = nvml.device_count().ok()?;

        let mut best_process: Option<CudaVramSample> = None;
        let mut best_device_fallback: Option<CudaVramSample> = None;

        for index in 0..count {
            let device = match nvml.device_by_index(index) {
                Ok(d) => d,
                Err(_) => continue,
            };
            let mem = match device.memory_info() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let processes = match device.running_compute_processes() {
                Ok(p) => p,
                Err(_) => continue,
            };

            let device_sample = CudaVramSample {
                used_bytes: mem.used,
                total_bytes: mem.total,
            };
            best_device_fallback = match best_device_fallback {
                Some(current) if current.used_bytes >= device_sample.used_bytes => Some(current),
                _ => Some(device_sample),
            };

            let mut saw_pid = false;
            let mut saw_unavailable = false;
            let mut process_used_max = 0u64;

            for proc in processes {
                if proc.pid == self.pid {
                    saw_pid = true;
                    match proc.used_gpu_memory {
                        nvml_wrapper::enums::device::UsedGpuMemory::Used(v) => {
                            process_used_max = process_used_max.max(v);
                        }
                        nvml_wrapper::enums::device::UsedGpuMemory::Unavailable => {
                            saw_unavailable = true;
                        }
                    }
                }
            }

            if saw_pid {
                let used_bytes = if process_used_max > 0 {
                    process_used_max
                } else if saw_unavailable {
                    mem.used
                } else {
                    0
                };

                let sample = CudaVramSample {
                    used_bytes,
                    total_bytes: mem.total,
                };

                best_process = match best_process {
                    Some(current) if current.used_bytes >= sample.used_bytes => Some(current),
                    _ => Some(sample),
                };
            }
        }

        let chosen = best_process.or(best_device_fallback);

        if let Some(sample) = chosen {
            self.peak_used_bytes = self.peak_used_bytes.max(sample.used_bytes);
            Some(sample)
        } else {
            None
        }
    }

    pub fn peak_used_mib(&self) -> Option<f64> {
        (self.peak_used_bytes > 0).then(|| (self.peak_used_bytes as f64) / (1024.0 * 1024.0))
    }
}

#[cfg(not(feature = "cuda"))]
pub struct CudaVramTracker;

#[cfg(not(feature = "cuda"))]
impl CudaVramTracker {
    pub fn new_current_process() -> Self {
        Self
    }

    pub fn sample(&mut self) -> Option<CudaVramSample> {
        None
    }

    pub fn peak_used_mib(&self) -> Option<f64> {
        None
    }
}
