use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::Writer;
use std::io::Write;

use crate::analysis::fault_tree::AnalysisResult;
use crate::core::event::BasicEvent;
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::mc::core::{MonteCarloResult, MonteCarloRunConfig};
use crate::Result;

pub fn write_element<W: Write>(writer: &mut Writer<W>, event: &BasicEvent) -> Result<()> {
    let mut elem = BytesStart::new("define-basic-event");
    elem.push_attribute(("name", event.element().id()));
    writer.write_event(Event::Start(elem))?;

    let mut float_elem = BytesStart::new("float");
    float_elem.push_attribute(("value", event.probability().to_string().as_str()));
    writer.write_event(Event::Empty(float_elem))?;

    writer.write_event(Event::End(BytesEnd::new("define-basic-event")))?;

    Ok(())
}

pub fn write_gate<W: Write>(writer: &mut Writer<W>, gate: &Gate) -> Result<()> {
    let mut elem = BytesStart::new("define-gate");
    elem.push_attribute(("name", gate.element().id()));
    writer.write_event(Event::Start(elem))?;

    let formula_name = match gate.formula() {
        Formula::And => "and",
        Formula::Or => "or",
        Formula::Not => "not",
        Formula::Xor => "xor",
        Formula::Nand => "nand",
        Formula::Nor => "nor",
        Formula::Iff => "iff",
        Formula::AtLeast { min } => {
            let mut atleast_elem = BytesStart::new("atleast");
            atleast_elem.push_attribute(("min", min.to_string().as_str()));
            writer.write_event(Event::Start(atleast_elem))?;

            for operand in gate.operands() {
                let mut operand_elem = BytesStart::new("basic-event");
                operand_elem.push_attribute(("name", operand.as_str()));
                writer.write_event(Event::Empty(operand_elem))?;
            }

            writer.write_event(Event::End(BytesEnd::new("atleast")))?;
            writer.write_event(Event::End(BytesEnd::new("define-gate")))?;
            return Ok(());
        }
    };

    writer.write_event(Event::Start(BytesStart::new(formula_name)))?;

    for operand in gate.operands() {
        let mut operand_elem = BytesStart::new("basic-event");
        operand_elem.push_attribute(("name", operand.as_str()));
        writer.write_event(Event::Empty(operand_elem))?;
    }

    writer.write_event(Event::End(BytesEnd::new(formula_name)))?;
    writer.write_event(Event::End(BytesEnd::new("define-gate")))?;

    Ok(())
}

pub fn write_results<W: Write>(
    writer: &mut Writer<W>,
    fault_tree: &FaultTree,
    result: &AnalysisResult,
) -> Result<()> {
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("utf-8"), None)))?;
    writer.write_event(Event::Start(BytesStart::new("opsa-mef")))?;
    writer.write_event(Event::Start(BytesStart::new("analysis-results")))?;

    let mut fta_elem = BytesStart::new("fault-tree-analysis");
    fta_elem.push_attribute(("name", fault_tree.element().id()));
    writer.write_event(Event::Start(fta_elem))?;
    writer.write_event(Event::Start(BytesStart::new("probability")))?;
    writer.write_event(Event::Start(BytesStart::new("top-event-probability")))?;
    writer.write_event(Event::Text(BytesText::new(
        &result.top_event_probability.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("top-event-probability")))?;

    writer.write_event(Event::Start(BytesStart::new("statistics")))?;
    writer.write_event(Event::Start(BytesStart::new("gates-analyzed")))?;
    writer.write_event(Event::Text(BytesText::new(
        &result.gates_analyzed.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("gates-analyzed")))?;
    writer.write_event(Event::Start(BytesStart::new("basic-events-count")))?;
    writer.write_event(Event::Text(BytesText::new(
        &result.basic_events_count.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("basic-events-count")))?;
    writer.write_event(Event::End(BytesEnd::new("statistics")))?;
    writer.write_event(Event::End(BytesEnd::new("probability")))?;
    writer.write_event(Event::End(BytesEnd::new("fault-tree-analysis")))?;
    writer.write_event(Event::End(BytesEnd::new("analysis-results")))?;
    writer.write_event(Event::End(BytesEnd::new("opsa-mef")))?;

    Ok(())
}

pub fn write_results_with_monte_carlo<W: Write>(
    writer: &mut Writer<W>,
    fault_tree: &FaultTree,
    result: &AnalysisResult,
    mc: &MonteCarloResult,
    mc_config: Option<&MonteCarloRunConfig>,
) -> Result<()> {
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("utf-8"), None)))?;
    writer.write_event(Event::Start(BytesStart::new("opsa-mef")))?;
    writer.write_event(Event::Start(BytesStart::new("analysis-results")))?;

    let mut fta_elem = BytesStart::new("fault-tree-analysis");
    fta_elem.push_attribute(("name", fault_tree.element().id()));
    writer.write_event(Event::Start(fta_elem))?;
    writer.write_event(Event::Start(BytesStart::new("probability")))?;
    writer.write_event(Event::Start(BytesStart::new("top-event-probability")))?;
    writer.write_event(Event::Text(BytesText::new(
        &result.top_event_probability.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("top-event-probability")))?;

    writer.write_event(Event::Start(BytesStart::new("statistics")))?;
    writer.write_event(Event::Start(BytesStart::new("gates-analyzed")))?;
    writer.write_event(Event::Text(BytesText::new(
        &result.gates_analyzed.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("gates-analyzed")))?;
    writer.write_event(Event::Start(BytesStart::new("basic-events-count")))?;
    writer.write_event(Event::Text(BytesText::new(
        &result.basic_events_count.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("basic-events-count")))?;
    writer.write_event(Event::End(BytesEnd::new("statistics")))?;
    writer.write_event(Event::End(BytesEnd::new("probability")))?;

    writer.write_event(Event::Start(BytesStart::new("monte-carlo-analysis")))?;

    if let Some(cfg) = mc_config {
        writer.write_event(Event::Start(BytesStart::new("run-config")))?;

        writer.write_event(Event::Start(BytesStart::new("engine")))?;
        writer.write_event(Event::Text(BytesText::new(&cfg.engine)))?;
        writer.write_event(Event::End(BytesEnd::new("engine")))?;

        writer.write_event(Event::Start(BytesStart::new("target")))?;
        writer.write_event(Event::Text(BytesText::new(&cfg.target)))?;
        writer.write_event(Event::End(BytesEnd::new("target")))?;

        writer.write_event(Event::Start(BytesStart::new("backend-requested")))?;
        writer.write_event(Event::Text(BytesText::new(&cfg.backend_requested)))?;
        writer.write_event(Event::End(BytesEnd::new("backend-requested")))?;

        writer.write_event(Event::Start(BytesStart::new("backend-used")))?;
        writer.write_event(Event::Text(BytesText::new(&cfg.backend_used)))?;
        writer.write_event(Event::End(BytesEnd::new("backend-used")))?;

        writer.write_event(Event::Start(BytesStart::new("seed")))?;
        writer.write_event(Event::Text(BytesText::new(&cfg.seed.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("seed")))?;

        writer.write_event(Event::Start(BytesStart::new("num-trials-requested")))?;
        writer.write_event(Event::Text(BytesText::new(
            &cfg.num_trials_requested.to_string(),
        )))?;
        writer.write_event(Event::End(BytesEnd::new("num-trials-requested")))?;

        if let Some(params) = cfg.run_params {
            let mut elem = BytesStart::new("dpmc-params");
            elem.push_attribute(("t", params.t.to_string().as_str()));
            elem.push_attribute(("b", params.b.to_string().as_str()));
            elem.push_attribute(("p", params.p.to_string().as_str()));
            elem.push_attribute(("omega", params.omega.to_string().as_str()));
            writer.write_event(Event::Empty(elem))?;
        }

        if cfg.early_stop.is_some() {
            writer.write_event(Event::Start(BytesStart::new("convergence")))?;

            writer.write_event(Event::Start(BytesStart::new("policy")))?;
            writer.write_event(Event::Text(BytesText::new(
                cfg.policy.as_deref().unwrap_or(""),
            )))?;
            writer.write_event(Event::End(BytesEnd::new("policy")))?;

            if let Some(delta) = cfg.delta {
                writer.write_event(Event::Start(BytesStart::new("delta")))?;
                writer.write_event(Event::Text(BytesText::new(&delta.to_string())))?;
                writer.write_event(Event::End(BytesEnd::new("delta")))?;
            }
            if let Some(burn_in) = cfg.burn_in {
                writer.write_event(Event::Start(BytesStart::new("burn-in")))?;
                writer.write_event(Event::Text(BytesText::new(&burn_in.to_string())))?;
                writer.write_event(Event::End(BytesEnd::new("burn-in")))?;
            }
            if let Some(conf) = cfg.confidence {
                writer.write_event(Event::Start(BytesStart::new("confidence")))?;
                writer.write_event(Event::Text(BytesText::new(&conf.to_string())))?;
                writer.write_event(Event::End(BytesEnd::new("confidence")))?;
            }

            writer.write_event(Event::End(BytesEnd::new("convergence")))?;
        }

        writer.write_event(Event::End(BytesEnd::new("run-config")))?;
    }

    writer.write_event(Event::Start(BytesStart::new("probability-estimate")))?;
    writer.write_event(Event::Text(BytesText::new(
        &mc.probability_estimate.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("probability-estimate")))?;
    writer.write_event(Event::Start(BytesStart::new("std-dev")))?;
    writer.write_event(Event::Text(BytesText::new(&mc.std_dev.to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("std-dev")))?;
    writer.write_event(Event::Start(BytesStart::new("confidence-interval")))?;
    writer.write_event(Event::Start(BytesStart::new("lower")))?;
    writer.write_event(Event::Text(BytesText::new(
        &mc.confidence_interval_lower.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("lower")))?;
    writer.write_event(Event::Start(BytesStart::new("upper")))?;
    writer.write_event(Event::Text(BytesText::new(
        &mc.confidence_interval_upper.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("upper")))?;
    writer.write_event(Event::End(BytesEnd::new("confidence-interval")))?;

    writer.write_event(Event::Start(BytesStart::new("statistics")))?;
    writer.write_event(Event::Start(BytesStart::new("num-trials")))?;
    writer.write_event(Event::Text(BytesText::new(&mc.num_trials.to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("num-trials")))?;
    writer.write_event(Event::Start(BytesStart::new("successes")))?;
    writer.write_event(Event::Text(BytesText::new(&mc.successes.to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("successes")))?;
    if let Some(peak_rss_mib) = mc.peak_rss_mib {
        writer.write_event(Event::Start(BytesStart::new("peak-rss-mib")))?;
        writer.write_event(Event::Text(BytesText::new(&peak_rss_mib.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("peak-rss-mib")))?;
    }
    if let Some(peak_vram_mib) = mc.peak_vram_mib {
        writer.write_event(Event::Start(BytesStart::new("peak-vram-mib")))?;
        writer.write_event(Event::Text(BytesText::new(&peak_vram_mib.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("peak-vram-mib")))?;
    }
    writer.write_event(Event::End(BytesEnd::new("statistics")))?;
    writer.write_event(Event::End(BytesEnd::new("monte-carlo-analysis")))?;
    writer.write_event(Event::End(BytesEnd::new("fault-tree-analysis")))?;
    writer.write_event(Event::End(BytesEnd::new("analysis-results")))?;
    writer.write_event(Event::End(BytesEnd::new("opsa-mef")))?;

    Ok(())
}

pub fn write_fault_tree<W: Write>(writer: &mut Writer<W>, fault_tree: &FaultTree) -> Result<()> {
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("utf-8"), None)))?;
    writer.write_event(Event::Start(BytesStart::new("opsa-mef")))?;

    let mut ft_elem = BytesStart::new("define-fault-tree");
    ft_elem.push_attribute(("name", fault_tree.element().id()));
    writer.write_event(Event::Start(ft_elem))?;

    for gate in fault_tree.gates().values() {
        write_gate(writer, gate)?;
    }

    for event in fault_tree.basic_events().values() {
        write_element(writer, event)?;
    }

    writer.write_event(Event::End(BytesEnd::new("define-fault-tree")))?;
    writer.write_event(Event::End(BytesEnd::new("opsa-mef")))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::fault_tree::FaultTreeAnalysis;
    use crate::core::gate::Formula;

    #[test]
    fn test_write_element_basic() {
        let event = BasicEvent::new("E1".to_string(), 0.5).unwrap();
        let mut writer = Writer::new(Vec::new());
        write_element(&mut writer, &event).unwrap();

        let result = String::from_utf8(writer.into_inner()).unwrap();
        assert!(result.contains(r#"<define-basic-event name="E1">"#));
        assert!(result.contains(r#"<float value="0.5"/>"#));
        assert!(result.contains(r#"</define-basic-event>"#));
    }

    #[test]
    fn test_write_element_zero_probability() {
        let event = BasicEvent::new("E2".to_string(), 0.0).unwrap();
        let mut writer = Writer::new(Vec::new());
        write_element(&mut writer, &event).unwrap();

        let result = String::from_utf8(writer.into_inner()).unwrap();
        assert!(result.contains(r#"name="E2""#));
        assert!(result.contains(r#"value="0""#));
    }

    #[test]
    fn test_write_element_one_probability() {
        let event = BasicEvent::new("E3".to_string(), 1.0).unwrap();
        let mut writer = Writer::new(Vec::new());
        write_element(&mut writer, &event).unwrap();

        let result = String::from_utf8(writer.into_inner()).unwrap();
        assert!(result.contains(r#"name="E3""#));
        assert!(result.contains(r#"value="1""#));
    }

    #[test]
    fn test_write_gate_and() {
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());

        let mut writer = Writer::new(Vec::new());
        write_gate(&mut writer, &gate).unwrap();

        let result = String::from_utf8(writer.into_inner()).unwrap();
        assert!(result.contains(r#"<define-gate name="G1">"#));
        assert!(result.contains(r#"<and>"#));
        assert!(result.contains(r#"<basic-event name="E1"/>"#));
        assert!(result.contains(r#"<basic-event name="E2"/>"#));
        assert!(result.contains(r#"</and>"#));
        assert!(result.contains(r#"</define-gate>"#));
    }

    #[test]
    fn test_write_gate_or() {
        let mut gate = Gate::new("G2".to_string(), Formula::Or).unwrap();
        gate.add_operand("A".to_string());
        gate.add_operand("B".to_string());

        let mut writer = Writer::new(Vec::new());
        write_gate(&mut writer, &gate).unwrap();

        let result = String::from_utf8(writer.into_inner()).unwrap();
        assert!(result.contains(r#"<or>"#));
    }

    #[test]
    fn test_write_results_basic() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.25).unwrap())
            .unwrap();

        let analysis = FaultTreeAnalysis::new(&ft).unwrap();
        let result = analysis.analyze().unwrap();

        let mut writer = Writer::new(Vec::new());
        write_results(&mut writer, &ft, &result).unwrap();

        let xml = String::from_utf8(writer.into_inner()).unwrap();
        assert!(xml.contains(r#"<?xml version="1.0" encoding="utf-8"?>"#));
        assert!(xml.contains(r#"<opsa-mef>"#));
        assert!(xml.contains(r#"<analysis-results>"#));
        assert!(xml.contains(r#"<fault-tree-analysis name="FT1">"#));
        assert!(xml.contains(r#"<top-event-probability>"#));
        assert!(xml.contains("0.125"));
        assert!(xml.contains(r#"<gates-analyzed>1</gates-analyzed>"#));
        assert!(xml.contains(r#"<basic-events-count>2</basic-events-count>"#));
    }

    #[test]
    fn test_write_results_with_monte_carlo_includes_section() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.25).unwrap())
            .unwrap();

        let analysis = FaultTreeAnalysis::new(&ft).unwrap();
        let result = analysis.analyze().unwrap();

        let mc = crate::mc::core::MonteCarloResult {
            probability_estimate: 0.123,
            num_trials: 1000,
            std_dev: 0.01,
            confidence_interval_lower: 0.10,
            confidence_interval_upper: 0.15,
            successes: 123,
            peak_rss_mib: Some(64.0),
            peak_vram_mib: None,
        };

        let cfg = crate::mc::core::MonteCarloRunConfig {
            engine: "dpmc".to_string(),
            target: "fault-tree".to_string(),
            backend_requested: "cpu".to_string(),
            backend_used: "cpu".to_string(),
            seed: 42,
            num_trials_requested: 1000,
            run_params: Some(crate::mc::plan::RunParams::new(
                1,
                1,
                16,
                crate::mc::plan::RunParams::DEFAULT_OMEGA,
                42,
            )),
            early_stop: None,
            delta: None,
            burn_in: None,
            confidence: None,
            policy: None,
        };

        let mut writer = Writer::new(Vec::new());
        write_results_with_monte_carlo(&mut writer, &ft, &result, &mc, Some(&cfg)).unwrap();

        let xml = String::from_utf8(writer.into_inner()).unwrap();
        assert!(xml.contains(r#"<monte-carlo-analysis>"#));
        assert_eq!(xml.matches("<run-config>").count(), 1);
        assert!(xml.contains(r#"<engine>dpmc</engine>"#));
        assert!(xml.contains(r#"<backend-used>cpu</backend-used>"#));
        assert!(xml.contains(r#"<seed>42</seed>"#));
        assert!(xml.contains(r#"<probability-estimate>0.123</probability-estimate>"#));
        assert!(xml.contains(r#"<std-dev>0.01</std-dev>"#));
        assert!(xml.contains(r#"<confidence-interval>"#));
        assert!(xml.contains(r#"<num-trials>1000</num-trials>"#));
        assert!(xml.contains(r#"<successes>123</successes>"#));
        assert!(xml.contains(r#"<peak-rss-mib>64</peak-rss-mib>"#));
    }

    #[test]
    fn test_write_results_complex() {
        let mut ft = FaultTree::new("ComplexFT", "Root").unwrap();

        let mut root = Gate::new("Root".to_string(), Formula::Or).unwrap();
        root.add_operand("G1".to_string());
        root.add_operand("E3".to_string());
        ft.add_gate(root).unwrap();

        let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        g1.add_operand("E1".to_string());
        g1.add_operand("E2".to_string());
        ft.add_gate(g1).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.3).unwrap())
            .unwrap();

        let analysis = FaultTreeAnalysis::new(&ft).unwrap();
        let result = analysis.analyze().unwrap();

        let mut writer = Writer::new(Vec::new());
        write_results(&mut writer, &ft, &result).unwrap();

        let xml = String::from_utf8(writer.into_inner()).unwrap();
        assert!(xml.contains(r#"name="ComplexFT""#));
        assert!(xml.contains(r#"<gates-analyzed>2</gates-analyzed>"#));
        assert!(xml.contains(r#"<basic-events-count>3</basic-events-count>"#));
    }

    #[test]
    fn test_write_fault_tree_roundtrip() {
        // Create a fault tree
        let mut ft = FaultTree::new("RoundTrip", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.25).unwrap())
            .unwrap();

        // Write to XML
        let mut writer = Writer::new(Vec::new());
        write_fault_tree(&mut writer, &ft).unwrap();

        let xml = String::from_utf8(writer.into_inner()).unwrap();

        // Verify XML structure
        assert!(xml.contains(r#"<?xml version="1.0""#));
        assert!(xml.contains(r#"<define-fault-tree name="RoundTrip">"#));
        assert!(xml.contains(r#"<define-gate name="TopGate">"#));
        assert!(xml.contains(r#"<and>"#));
        assert!(xml.contains(r#"<define-basic-event name="E1">"#));
        assert!(xml.contains(r#"<float value="0.5"/>"#));
        assert!(xml.contains(r#"<define-basic-event name="E2">"#));
        assert!(xml.contains(r#"<float value="0.25"/>"#));
    }
}
