use crate::analysis::fault_tree::FaultTreeAnalysis;
use crate::core::fault_tree::FaultTree;
use crate::error::{PraxisError, Result};

const MAX_TIME_POINTS: usize = 100_000;

pub fn time_grid(end: f64, step: f64) -> Result<Vec<f64>> {
    if !step.is_finite() || step <= 0.0 {
        return Err(PraxisError::Logic(
            "time step must be a finite positive value".to_string(),
        ));
    }
    if !end.is_finite() || end < 0.0 {
        return Err(PraxisError::Logic(
            "mission time must be a finite non-negative value".to_string(),
        ));
    }

    let estimated = (end / step).floor() as usize + 2;
    if estimated > MAX_TIME_POINTS {
        return Err(PraxisError::Logic(format!(
            "time sweep would need about {} points, over the {} cap; increase --time-step",
            estimated, MAX_TIME_POINTS
        )));
    }

    let mut grid = Vec::with_capacity(estimated);
    let mut k = 0usize;
    loop {
        let t = k as f64 * step;
        if t >= end {
            break;
        }
        grid.push(t);
        k += 1;
    }
    grid.push(end);
    Ok(grid)
}

pub fn quantify_over_time(fault_tree: &FaultTree, times: &[f64]) -> Result<Vec<(f64, f64)>> {
    let mut work = fault_tree.clone();
    let mut series = Vec::with_capacity(times.len());
    for &t in times {
        work.set_mission_time(t);
        work.reevaluate_basic_event_probabilities()?;
        let probability = FaultTreeAnalysis::new(&work)?
            .analyze()?
            .top_event_probability;
        series.push((probability, t));
    }
    Ok(series)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::gate::{Formula, Gate};
    use crate::expression::Expr;

    #[test]
    fn time_grid_includes_endpoint() {
        let grid = time_grid(100.0, 25.0).unwrap();
        assert_eq!(grid, vec![0.0, 25.0, 50.0, 75.0, 100.0]);
    }

    #[test]
    fn time_grid_appends_ragged_endpoint() {
        let grid = time_grid(100.0, 30.0).unwrap();
        assert_eq!(grid, vec![0.0, 30.0, 60.0, 90.0, 100.0]);
    }

    #[test]
    fn time_grid_rejects_nonpositive_step() {
        assert!(time_grid(100.0, 0.0).is_err());
        assert!(time_grid(100.0, -1.0).is_err());
    }

    #[test]
    fn time_grid_rejects_runaway() {
        assert!(time_grid(1.0e9, 1.0).is_err());
    }

    #[test]
    fn quantify_over_time_tracks_exponential() {
        let mut ft = FaultTree::new("FT", "top").unwrap();
        let mut gate = Gate::new("top".to_string(), Formula::Or).unwrap();
        gate.add_operand("A".to_string());
        ft.add_gate(gate).unwrap();
        let expr = Expr::Exponential {
            lambda: Box::new(Expr::Constant(0.001)),
            time: Box::new(Expr::MissionTime),
        };
        ft.add_basic_event(BasicEvent::with_value("A".to_string(), 0.0, expr).unwrap())
            .unwrap();

        let series = quantify_over_time(&ft, &[0.0, 100.0, 1000.0]).unwrap();
        assert_eq!(series.len(), 3);
        assert!((series[0].0 - 0.0).abs() < 1e-12);
        assert!((series[1].0 - (1.0 - (-0.1f64).exp())).abs() < 1e-9);
        assert!((series[2].0 - (1.0 - (-1.0f64).exp())).abs() < 1e-9);
        assert!(series[2].0 > series[1].0);
    }

    #[test]
    fn quantify_over_time_holds_constants_flat() {
        let mut ft = FaultTree::new("FT", "top").unwrap();
        let mut gate = Gate::new("top".to_string(), Formula::Or).unwrap();
        gate.add_operand("A".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("A".to_string(), 0.2).unwrap())
            .unwrap();

        let series = quantify_over_time(&ft, &[0.0, 50.0, 100.0]).unwrap();
        for (probability, _) in series {
            assert!((probability - 0.2).abs() < 1e-12);
        }
    }
}
