use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::Writer;
use std::io::Write;

use crate::algorithms::mocus::CutSet;
use crate::analysis::fault_tree::AnalysisResult;
use crate::analysis::importance::ImportanceRecord;
use crate::analysis::prime_implicants::PrimeImplicants;
use crate::analysis::sil::Sil;
use crate::analysis::uncertainty::UncertaintyAnalysis;
use crate::core::fault_tree::FaultTree;
use crate::mc::core::{MonteCarloResult, MonteCarloRunConfig};
use crate::mc::EventTreeMonteCarloResult;
use crate::Result;

#[derive(Debug, Clone)]
pub struct EventTreeAnalyticSequence {
    pub sequence_id: String,
    pub path: Vec<(String, String)>,
    pub probability: f64,
    pub frequency: f64,
    pub cut_sets: Vec<CutSet>,
    pub order_dist: std::collections::HashMap<usize, u64>,
}

#[derive(Debug, Clone)]
pub struct EventTreeAnalyticReport {
    pub event_tree_id: String,
    pub initiating_event_id: String,
    pub initiating_event_probability: Option<f64>,
    pub initiating_event_frequency: Option<f64>,
    pub algorithm: String,
    pub sequences: Vec<EventTreeAnalyticSequence>,
}

#[derive(Debug, Clone)]
pub struct EventTreeMonteCarloReport {
    pub event_tree_id: String,
    pub initiating_event_id: String,
    pub initiating_event_probability: Option<f64>,
    pub initiating_event_frequency: Option<f64>,

    pub monte_carlo: EventTreeMonteCarloResult,
    pub monte_carlo_config: Option<MonteCarloRunConfig>,
}

#[derive(Debug, Clone)]
pub struct AnalysisReport {
    pub fta_result: AnalysisResult,
    pub cut_sets: Option<Vec<CutSet>>,
    pub prime_implicants: Option<PrimeImplicants>,
    pub importance: Option<Vec<ImportanceRecord>>,
    pub uncertainty: Option<UncertaintyAnalysis>,
    pub sil: Option<Sil>,
    pub monte_carlo: Option<MonteCarloResult>,
    pub monte_carlo_config: Option<MonteCarloRunConfig>,
    pub event_tree_monte_carlo: Option<Vec<EventTreeMonteCarloReport>>,
    pub event_tree_analytic: Option<Vec<EventTreeAnalyticReport>>,
    pub model_features: Option<ModelFeatures>,
    pub omit_fault_tree_analysis: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct ModelFeatures {
    pub gates: usize,
    pub basic_events: usize,
}

impl AnalysisReport {
    /// Create a new analysis report with basic FTA results
    pub fn new(fta_result: AnalysisResult) -> Self {
        AnalysisReport {
            fta_result,
            cut_sets: None,
            prime_implicants: None,
            importance: None,
            uncertainty: None,
            sil: None,
            monte_carlo: None,
            monte_carlo_config: None,
            event_tree_monte_carlo: None,
            event_tree_analytic: None,
            model_features: None,
            omit_fault_tree_analysis: false,
        }
    }

    pub fn without_fault_tree_analysis(mut self) -> Self {
        self.omit_fault_tree_analysis = true;
        self
    }

    pub fn with_model_features(mut self, gates: usize, basic_events: usize) -> Self {
        self.model_features = Some(ModelFeatures { gates, basic_events });
        self
    }

    pub fn with_cut_sets(mut self, cut_sets: Vec<CutSet>) -> Self {
        self.cut_sets = Some(cut_sets);
        self
    }

    pub fn with_prime_implicants(mut self, prime_implicants: PrimeImplicants) -> Self {
        self.prime_implicants = Some(prime_implicants);
        self
    }

    pub fn with_importance(mut self, importance: Vec<ImportanceRecord>) -> Self {
        self.importance = Some(importance);
        self
    }

    pub fn with_uncertainty(mut self, uncertainty: UncertaintyAnalysis) -> Self {
        self.uncertainty = Some(uncertainty);
        self
    }

    pub fn with_sil(mut self, sil: Sil) -> Self {
        self.sil = Some(sil);
        self
    }

    pub fn with_monte_carlo(mut self, monte_carlo: MonteCarloResult) -> Self {
        self.monte_carlo = Some(monte_carlo);
        self
    }

    pub fn with_monte_carlo_config(mut self, cfg: MonteCarloRunConfig) -> Self {
        self.monte_carlo_config = Some(cfg);
        self
    }

    pub fn with_event_tree_monte_carlo(mut self, reports: Vec<EventTreeMonteCarloReport>) -> Self {
        self.event_tree_monte_carlo = Some(reports);
        self
    }

    pub fn with_event_tree_analytic(mut self, reports: Vec<EventTreeAnalyticReport>) -> Self {
        self.event_tree_analytic = Some(reports);
        self
    }
}

pub fn write_comprehensive_report<W: Write>(
    writer: &mut Writer<W>,
    fault_tree: &FaultTree,
    report: &AnalysisReport,
) -> Result<()> {
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("utf-8"), None)))?;
    writer.write_event(Event::Start(BytesStart::new("report")))?;

    write_information(writer, fault_tree, report)?;
    writer.write_event(Event::Start(BytesStart::new("results")))?;
    if !report.omit_fault_tree_analysis {
        write_fta_section(writer, fault_tree, report)?;
    }

    if let Some(ref cut_sets) = report.cut_sets {
        write_cut_sets_section(writer, cut_sets)?;
    }

    if let Some(ref prime_implicants) = report.prime_implicants {
        write_prime_implicants_section(writer, prime_implicants)?;
    }

    if let Some(ref importance) = report.importance {
        write_importance_section(writer, importance)?;
    }

    if let Some(ref uncertainty) = report.uncertainty {
        write_uncertainty_section(writer, uncertainty)?;
    }

    if let Some(ref sil) = report.sil {
        write_sil_section(writer, sil)?;
    }

    if let Some(ref mc) = report.monte_carlo {
        write_monte_carlo_section(writer, mc, report.monte_carlo_config.as_ref())?;
    }

    if let Some(ref et_mc) = report.event_tree_monte_carlo {
        write_event_tree_monte_carlo_section(writer, et_mc)?;
    }

    if let Some(ref et_analytic) = report.event_tree_analytic {
        write_event_tree_analytic_section(writer, et_analytic)?;
    }

    writer.write_event(Event::End(BytesEnd::new("results")))?;
    writer.write_event(Event::End(BytesEnd::new("report")))?;

    Ok(())
}

fn write_event_tree_analytic_section<W: Write>(
    writer: &mut Writer<W>,
    reports: &[EventTreeAnalyticReport],
) -> Result<()> {
    writer.write_event(Event::Start(BytesStart::new("event-tree-analysis")))?;

    for rep in reports {
        let mut et_elem = BytesStart::new("event-tree");
        et_elem.push_attribute(("id", rep.event_tree_id.as_str()));
        et_elem.push_attribute(("algorithm", rep.algorithm.as_str()));
        writer.write_event(Event::Start(et_elem))?;

        let mut ie_elem = BytesStart::new("initiating-event");
        ie_elem.push_attribute(("id", rep.initiating_event_id.as_str()));
        writer.write_event(Event::Start(ie_elem))?;
        if let Some(p) = rep.initiating_event_probability {
            writer.write_event(Event::Start(BytesStart::new("probability")))?;
            writer.write_event(Event::Text(BytesText::new(&p.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("probability")))?;
        }
        if let Some(f) = rep.initiating_event_frequency {
            writer.write_event(Event::Start(BytesStart::new("frequency")))?;
            writer.write_event(Event::Text(BytesText::new(&f.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("frequency")))?;
        }
        writer.write_event(Event::End(BytesEnd::new("initiating-event")))?;

        writer.write_event(Event::Start(BytesStart::new("sequences")))?;
        for seq in &rep.sequences {
            let mut seq_elem = BytesStart::new("sequence");
            seq_elem.push_attribute(("id", seq.sequence_id.as_str()));
            writer.write_event(Event::Start(seq_elem))?;

            writer.write_event(Event::Start(BytesStart::new("probability")))?;
            writer.write_event(Event::Text(BytesText::new(&seq.probability.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("probability")))?;

            writer.write_event(Event::Start(BytesStart::new("frequency")))?;
            writer.write_event(Event::Text(BytesText::new(&seq.frequency.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("frequency")))?;

            if !seq.path.is_empty() {
                writer.write_event(Event::Start(BytesStart::new("path")))?;
                for (fe_id, state) in &seq.path {
                    let mut fork_elem = BytesStart::new("fork");
                    fork_elem.push_attribute(("functional-event", fe_id.as_str()));
                    fork_elem.push_attribute(("state", state.as_str()));
                    writer.write_event(Event::Empty(fork_elem))?;
                }
                writer.write_event(Event::End(BytesEnd::new("path")))?;
            }

            if !seq.cut_sets.is_empty() {
                let mut sop = BytesStart::new("sum-of-products");
                sop.push_attribute(("products", seq.cut_sets.len().to_string().as_str()));
                writer.write_event(Event::Start(sop))?;
                let mut sorted = seq.cut_sets.clone();
                sorted.sort_by_key(|cs| cs.order());
                for cs in &sorted {
                    let mut prod = BytesStart::new("product");
                    prod.push_attribute(("order", cs.order().to_string().as_str()));
                    if cs.order() == 0 {
                        writer.write_event(Event::Empty(prod))?;
                    } else {
                        writer.write_event(Event::Start(prod))?;
                        let mut evts: Vec<&String> = cs.events.iter().collect();
                        evts.sort();
                        for evt in evts {
                            let mut be = BytesStart::new("basic-event");
                            be.push_attribute(("name", evt.as_str()));
                            writer.write_event(Event::Empty(be))?;
                        }
                        writer.write_event(Event::End(BytesEnd::new("product")))?;
                    }
                }
                writer.write_event(Event::End(BytesEnd::new("sum-of-products")))?;
            }

            writer.write_event(Event::End(BytesEnd::new("sequence")))?;
        }
        writer.write_event(Event::End(BytesEnd::new("sequences")))?;

        writer.write_event(Event::End(BytesEnd::new("event-tree")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("event-tree-analysis")))?;
    Ok(())
}

fn write_event_tree_monte_carlo_section<W: Write>(
    writer: &mut Writer<W>,
    reports: &[EventTreeMonteCarloReport],
) -> Result<()> {
    writer.write_event(Event::Start(BytesStart::new("event-tree-monte-carlo")))?;

    for rep in reports {
        let mut et_elem = BytesStart::new("event-tree");
        et_elem.push_attribute(("id", rep.event_tree_id.as_str()));
        writer.write_event(Event::Start(et_elem))?;

        let mut ie_elem = BytesStart::new("initiating-event");
        ie_elem.push_attribute(("id", rep.initiating_event_id.as_str()));
        writer.write_event(Event::Start(ie_elem))?;
        if let Some(p) = rep.initiating_event_probability {
            writer.write_event(Event::Start(BytesStart::new("probability")))?;
            writer.write_event(Event::Text(BytesText::new(&p.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("probability")))?;
        }
        if let Some(f) = rep.initiating_event_frequency {
            writer.write_event(Event::Start(BytesStart::new("frequency")))?;
            writer.write_event(Event::Text(BytesText::new(&f.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("frequency")))?;
        }
        writer.write_event(Event::End(BytesEnd::new("initiating-event")))?;

        writer.write_event(Event::Start(BytesStart::new("monte-carlo-analysis")))?;

        if let Some(cfg) = rep.monte_carlo_config.as_ref() {
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

            writer.write_event(Event::End(BytesEnd::new("run-config")))?;
        }

        writer.write_event(Event::Start(BytesStart::new("statistics")))?;
        writer.write_event(Event::Start(BytesStart::new("num-trials")))?;
        writer.write_event(Event::Text(BytesText::new(
            &rep.monte_carlo.num_trials.to_string(),
        )))?;
        writer.write_event(Event::End(BytesEnd::new("num-trials")))?;
        writer.write_event(Event::End(BytesEnd::new("statistics")))?;

        writer.write_event(Event::Start(BytesStart::new("sequences")))?;
        for seq in &rep.monte_carlo.sequences {
            let mut seq_elem = BytesStart::new("sequence");
            seq_elem.push_attribute(("id", seq.sequence.id.as_str()));
            writer.write_event(Event::Start(seq_elem))?;

            writer.write_event(Event::Start(BytesStart::new("frequency-estimate")))?;
            writer.write_event(Event::Text(BytesText::new(
                &seq.frequency_estimate.to_string(),
            )))?;
            writer.write_event(Event::End(BytesEnd::new("frequency-estimate")))?;

            writer.write_event(Event::Start(BytesStart::new("successes")))?;
            writer.write_event(Event::Text(BytesText::new(&seq.successes.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("successes")))?;

            writer.write_event(Event::Start(BytesStart::new("num-trials")))?;
            writer.write_event(Event::Text(BytesText::new(&seq.num_trials.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("num-trials")))?;

            writer.write_event(Event::End(BytesEnd::new("sequence")))?;
        }
        writer.write_event(Event::End(BytesEnd::new("sequences")))?;

        writer.write_event(Event::End(BytesEnd::new("monte-carlo-analysis")))?;
        writer.write_event(Event::End(BytesEnd::new("event-tree")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("event-tree-monte-carlo")))?;
    Ok(())
}

fn write_information<W: Write>(
    writer: &mut Writer<W>,
    fault_tree: &FaultTree,
    report: &AnalysisReport,
) -> Result<()> {
    writer.write_event(Event::Start(BytesStart::new("information")))?;

    let mut software_elem = BytesStart::new("software");
    software_elem.push_attribute(("name", "praxis"));
    software_elem.push_attribute(("version", "0.1.0"));
    writer.write_event(Event::Empty(software_elem))?;

    writer.write_event(Event::Start(BytesStart::new("model-features")))?;

    let (gates, basic_events) = report
        .model_features
        .map(|m| (m.gates, m.basic_events))
        .unwrap_or_else(|| (fault_tree.gates().len(), fault_tree.basic_events().len()));

    writer.write_event(Event::Start(BytesStart::new("gates")))?;
    writer.write_event(Event::Text(BytesText::new(&gates.to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("gates")))?;

    writer.write_event(Event::Start(BytesStart::new("basic-events")))?;
    writer.write_event(Event::Text(BytesText::new(&basic_events.to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("basic-events")))?;

    writer.write_event(Event::End(BytesEnd::new("model-features")))?;
    writer.write_event(Event::End(BytesEnd::new("information")))?;

    Ok(())
}

fn write_fta_section<W: Write>(
    writer: &mut Writer<W>,
    fault_tree: &FaultTree,
    report: &AnalysisReport,
) -> Result<()> {
    let mut fta_elem = BytesStart::new("fault-tree-analysis");
    fta_elem.push_attribute(("name", fault_tree.element().id()));
    writer.write_event(Event::Start(fta_elem))?;

    writer.write_event(Event::Start(BytesStart::new("probability")))?;
    writer.write_event(Event::Start(BytesStart::new("top-event-probability")))?;
    writer.write_event(Event::Text(BytesText::new(
        &report.fta_result.top_event_probability.to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("top-event-probability")))?;
    writer.write_event(Event::End(BytesEnd::new("probability")))?;
    writer.write_event(Event::End(BytesEnd::new("fault-tree-analysis")))?;

    Ok(())
}

fn write_cut_sets_section<W: Write>(writer: &mut Writer<W>, cut_sets: &[CutSet]) -> Result<()> {
    let mut elem = BytesStart::new("minimal-cut-sets");
    elem.push_attribute(("count", cut_sets.len().to_string().as_str()));
    writer.write_event(Event::Start(elem))?;

    for (i, cut_set) in cut_sets.iter().enumerate() {
        let mut set_elem = BytesStart::new("cut-set");
        set_elem.push_attribute(("id", (i + 1).to_string().as_str()));
        set_elem.push_attribute(("order", cut_set.order().to_string().as_str()));
        writer.write_event(Event::Start(set_elem))?;

        for event in &cut_set.events {
            writer.write_event(Event::Start(BytesStart::new("basic-event")))?;
            writer.write_event(Event::Text(BytesText::new(event)))?;
            writer.write_event(Event::End(BytesEnd::new("basic-event")))?;
        }

        writer.write_event(Event::End(BytesEnd::new("cut-set")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("minimal-cut-sets")))?;
    Ok(())
}

fn write_prime_implicants_section<W: Write>(
    writer: &mut Writer<W>,
    prime_implicants: &PrimeImplicants,
) -> Result<()> {
    let mut elem = BytesStart::new("prime-implicants");
    elem.push_attribute((
        "count",
        prime_implicants.implicants().len().to_string().as_str(),
    ));
    writer.write_event(Event::Start(elem))?;

    for (i, implicant) in prime_implicants.implicants().iter().enumerate() {
        let mut impl_elem = BytesStart::new("implicant");
        impl_elem.push_attribute(("id", (i + 1).to_string().as_str()));
        impl_elem.push_attribute(("order", implicant.order().to_string().as_str()));
        writer.write_event(Event::Start(impl_elem))?;

        for event_idx in &implicant.events {
            writer.write_event(Event::Start(BytesStart::new("basic-event")))?;
            writer.write_event(Event::Text(BytesText::new(&event_idx.to_string())))?;
            writer.write_event(Event::End(BytesEnd::new("basic-event")))?;
        }

        writer.write_event(Event::End(BytesEnd::new("implicant")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("prime-implicants")))?;
    Ok(())
}

fn write_importance_section<W: Write>(
    writer: &mut Writer<W>,
    importance: &[ImportanceRecord],
) -> Result<()> {
    writer.write_event(Event::Start(BytesStart::new("importance-analysis")))?;

    for record in importance {
        let mut event_elem = BytesStart::new("event");
        event_elem.push_attribute(("name", record.event_id.as_str()));
        writer.write_event(Event::Start(event_elem))?;

        writer.write_event(Event::Start(BytesStart::new("mif")))?;
        writer.write_event(Event::Text(BytesText::new(&record.factors.mif.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("mif")))?;

        writer.write_event(Event::Start(BytesStart::new("cif")))?;
        writer.write_event(Event::Text(BytesText::new(&record.factors.cif.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("cif")))?;

        writer.write_event(Event::Start(BytesStart::new("dif")))?;
        writer.write_event(Event::Text(BytesText::new(&record.factors.dif.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("dif")))?;

        writer.write_event(Event::Start(BytesStart::new("raw")))?;
        writer.write_event(Event::Text(BytesText::new(&record.factors.raw.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("raw")))?;

        writer.write_event(Event::Start(BytesStart::new("rrw")))?;
        writer.write_event(Event::Text(BytesText::new(&record.factors.rrw.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("rrw")))?;

        writer.write_event(Event::End(BytesEnd::new("event")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("importance-analysis")))?;
    Ok(())
}

fn write_uncertainty_section<W: Write>(
    writer: &mut Writer<W>,
    uncertainty: &UncertaintyAnalysis,
) -> Result<()> {
    writer.write_event(Event::Start(BytesStart::new("uncertainty-analysis")))?;

    writer.write_event(Event::Start(BytesStart::new("mean")))?;
    writer.write_event(Event::Text(BytesText::new(&uncertainty.mean().to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("mean")))?;

    writer.write_event(Event::Start(BytesStart::new("sigma")))?;
    writer.write_event(Event::Text(BytesText::new(
        &uncertainty.sigma().to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("sigma")))?;

    writer.write_event(Event::Start(BytesStart::new("error-factor")))?;
    writer.write_event(Event::Text(BytesText::new(
        &uncertainty.error_factor().to_string(),
    )))?;
    writer.write_event(Event::End(BytesEnd::new("error-factor")))?;

    writer.write_event(Event::Start(BytesStart::new("quantiles")))?;
    let quantile_levels = [0.05, 0.25, 0.50, 0.75, 0.95];
    for (level, value) in quantile_levels.iter().zip(uncertainty.quantiles().iter()) {
        let mut q_elem = BytesStart::new("quantile");
        q_elem.push_attribute(("level", level.to_string().as_str()));
        writer.write_event(Event::Start(q_elem))?;
        writer.write_event(Event::Text(BytesText::new(&value.to_string())))?;
        writer.write_event(Event::End(BytesEnd::new("quantile")))?;
    }
    writer.write_event(Event::End(BytesEnd::new("quantiles")))?;

    writer.write_event(Event::End(BytesEnd::new("uncertainty-analysis")))?;
    Ok(())
}

fn write_sil_section<W: Write>(writer: &mut Writer<W>, sil: &Sil) -> Result<()> {
    writer.write_event(Event::Start(BytesStart::new("sil-metrics")))?;

    // Write PFD average
    writer.write_event(Event::Start(BytesStart::new("pfd-avg")))?;
    writer.write_event(Event::Text(BytesText::new(&sil.pfd_avg.to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("pfd-avg")))?;

    // Write PFH average
    writer.write_event(Event::Start(BytesStart::new("pfh-avg")))?;
    writer.write_event(Event::Text(BytesText::new(&sil.pfh_avg.to_string())))?;
    writer.write_event(Event::End(BytesEnd::new("pfh-avg")))?;

    // Write PFD histogram
    if !sil.pfd_histogram.is_empty() {
        writer.write_event(Event::Start(BytesStart::new("pfd-histogram")))?;
        for bucket in &sil.pfd_histogram {
            let mut elem = BytesStart::new("bin");
            elem.push_attribute(("upper-bound", bucket.upper_bound.to_string().as_str()));
            elem.push_attribute(("fraction", bucket.fraction.to_string().as_str()));
            writer.write_event(Event::Empty(elem))?;
        }
        writer.write_event(Event::End(BytesEnd::new("pfd-histogram")))?;
    }

    // Write PFH histogram
    if !sil.pfh_histogram.is_empty() {
        writer.write_event(Event::Start(BytesStart::new("pfh-histogram")))?;
        for bucket in &sil.pfh_histogram {
            let mut elem = BytesStart::new("bin");
            elem.push_attribute(("upper-bound", bucket.upper_bound.to_string().as_str()));
            elem.push_attribute(("fraction", bucket.fraction.to_string().as_str()));
            writer.write_event(Event::Empty(elem))?;
        }
        writer.write_event(Event::End(BytesEnd::new("pfh-histogram")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("sil-metrics")))?;
    Ok(())
}

fn write_monte_carlo_section<W: Write>(
    writer: &mut Writer<W>,
    mc: &MonteCarloResult,
    cfg: Option<&MonteCarloRunConfig>,
) -> Result<()> {
    writer.write_event(Event::Start(BytesStart::new("monte-carlo-analysis")))?;

    if let Some(cfg) = cfg {
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
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::fault_tree::FaultTreeAnalysis;
    use crate::core::event::BasicEvent;
    use crate::core::gate::{Formula, Gate};

    #[test]
    fn test_analysis_report_new() {
        let result = AnalysisResult {
            top_event_probability: 0.125,
            gates_analyzed: 1,
            basic_events_count: 2,
        };

        let report = AnalysisReport::new(result);
        assert_eq!(report.fta_result.top_event_probability, 0.125);
        assert!(report.cut_sets.is_none());
        assert!(report.importance.is_none());
    }

    #[test]
    fn test_write_basic_report() {
        let mut ft = FaultTree::new("TestFT", "TopGate").unwrap();
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

        let report = AnalysisReport::new(result);

        let mut writer = Writer::new(Vec::new());
        write_comprehensive_report(&mut writer, &ft, &report).unwrap();

        let xml = String::from_utf8(writer.into_inner()).unwrap();
        assert!(xml.contains(r#"<?xml version="1.0""#));
        assert!(xml.contains(r#"<report>"#));
        assert!(xml.contains(r#"<information>"#));
        assert!(xml.contains(r#"<software name="praxis" version="0.1.0"/>"#));
        assert!(xml.contains(r#"<fault-tree-analysis name="TestFT">"#));
        assert!(xml.contains(r#"<top-event-probability>0.125</top-event-probability>"#));
    }
}
