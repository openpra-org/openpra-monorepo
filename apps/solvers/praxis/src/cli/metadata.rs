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

    println!("{:<35} {:>15}", "Sequence / Top Event", "Top Value");
    println!("{}", "-".repeat(52));
    for e in entries {
        println!("{:<35} {:>15.6e}", e.sequence_id, e.frequency);
    }

    println!();

    println!(
        "{:<35} {:>6} {:>10} {:>16} {:>16}",
        "Sequence / Top Event", "Order", "Count", "Max Product", "Min Product"
    );
    println!("{}", "-".repeat(87));
    for e in entries {
        let mut total = 0u64;
        for s in &e.order_stats {
            total = total.saturating_add(s.count);
            println!(
                "{:<35} {:>6} {:>10} {:>16.6e} {:>16.6e}",
                e.sequence_id, s.order, s.count, s.max_freq, s.min_freq
            );
        }
        println!("{:<35} {:>6} {:>10}", e.sequence_id, "Total", total);
    }
    println!("{}\n", "=".repeat(87));
    println!(
        "Product values are cut-set probabilities for fault trees and sequence frequencies for event trees.\n"
    );
}

pub fn prompt_for_limits() -> (Option<usize>, Option<f64>) {
    prompt_for_limits_with_defaults(None, None)
}

pub fn prompt_for_limits_with_defaults(
    default_order: Option<usize>,
    default_cut_off: Option<f64>,
) -> (Option<usize>, Option<f64>) {
    use std::io::{self, Write};

    println!("Choose truncation limits before cut-set enumeration.");
    println!("Press Enter to accept a displayed default; type 'none' to clear it.");

    let order_default = default_order
        .map(|value| value.to_string())
        .unwrap_or_else(|| "none".to_string());
    print!("  Maximum order [{order_default}]: ");
    io::stdout().flush().ok();
    let mut buf = String::new();
    io::stdin().read_line(&mut buf).ok();
    let order_input = buf.trim();
    let limit_order = if order_input.is_empty() {
        default_order
    } else if order_input.eq_ignore_ascii_case("none") {
        None
    } else {
        order_input.parse::<usize>().ok()
    };

    buf.clear();
    let cut_off_default = default_cut_off
        .map(|value| format!("{value:.6e}"))
        .unwrap_or_else(|| "none".to_string());
    print!("  Minimum cut-set probability [{cut_off_default}]: ");
    io::stdout().flush().ok();
    io::stdin().read_line(&mut buf).ok();
    let cut_off_input = buf.trim();
    let cut_off = if cut_off_input.is_empty() {
        default_cut_off
    } else if cut_off_input.eq_ignore_ascii_case("none") {
        None
    } else {
        cut_off_input.parse::<f64>().ok().filter(|&value| value > 0.0)
    };

    (limit_order, cut_off)
}
