use std::collections::HashMap;

pub struct ZbddOrderStat {
    pub order: usize,
    pub count: u64,
    pub min_freq: f64,
    pub max_freq: f64,
}

pub struct ZbddSequenceMetadata {
    pub sequence_id: String,
    pub frequency: f64,
    pub order_stats: Vec<ZbddOrderStat>,
}

impl ZbddSequenceMetadata {
    pub fn from_stats(
        sequence_id: String,
        frequency: f64,
        raw_stats: HashMap<usize, (u64, f64, f64)>,
        scale: f64,
    ) -> Self {
        let mut order_stats: Vec<ZbddOrderStat> = raw_stats
            .into_iter()
            .map(|(order, (count, min_p, max_p))| ZbddOrderStat {
                order,
                count,
                min_freq: min_p * scale,
                max_freq: max_p * scale,
            })
            .collect();
        order_stats.sort_by_key(|s| s.order);
        Self { sequence_id, frequency, order_stats }
    }
}

pub fn display_zbdd_metadata(entries: &[ZbddSequenceMetadata]) {
    println!("\n=== ZBDD Metadata ===\n");

    println!("{:<35} {:>15}", "Sequence / Top Event", "Frequency");
    println!("{}", "-".repeat(52));
    for e in entries {
        println!("{:<35} {:>15.6e}", e.sequence_id, e.frequency);
    }

    println!();

    println!(
        "{:<35} {:>6} {:>10} {:>16} {:>16}",
        "Sequence / Top Event", "Order", "Count", "Min Frequency", "Max Frequency"
    );
    println!("{}", "-".repeat(87));
    for e in entries {
        for s in &e.order_stats {
            println!(
                "{:<35} {:>6} {:>10} {:>16.6e} {:>16.6e}",
                e.sequence_id, s.order, s.count, s.min_freq, s.max_freq
            );
        }
    }
    println!("{}\n", "=".repeat(87));
}

pub fn prompt_for_limits() -> (Option<usize>, Option<f64>) {
    use std::io::{self, Write};

    println!("Set truncation limits, or press Enter to skip each:");

    print!("  limit-order (integer, e.g. 3): ");
    io::stdout().flush().ok();
    let mut buf = String::new();
    io::stdin().read_line(&mut buf).ok();
    let limit_order = buf.trim().parse::<usize>().ok();

    buf.clear();
    print!("  cut-off probability (e.g. 1e-10): ");
    io::stdout().flush().ok();
    io::stdin().read_line(&mut buf).ok();
    let cut_off = buf.trim().parse::<f64>().ok().filter(|&v| v > 0.0);

    (limit_order, cut_off)
}
