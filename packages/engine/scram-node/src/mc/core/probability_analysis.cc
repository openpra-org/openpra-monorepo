/**
 * @file probability_analysis.cc
 * @brief Monte Carlo probability analysis implementation using SYCL-based parallel computation
 * @author Arjun Earthperson
 * @date 2025
 *
 * @copyright Copyright (C) 2025 Arjun Earthperson
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @details This file implements the Monte Carlo-based probability analysis for SCRAM
 * using SYCL parallel computing. It provides the concrete implementation of the
 * ProbabilityAnalyzer<DirectEval> class specialization, which performs direct evaluation
 * of probabilistic directed acyclic graphs (PDAGs) through parallel sampling.
 *
 * @see ProbabilityAnalyzer<DirectEval> for interface documentation
 * @see mc::queue::layer_manager for execution engine details
 * @see sample_shape for memory layout configuration
 */

#include "probability_analysis.h"
#include <iostream>
#include "logger.h"
#include "logger/log_convergence.h"
#include "logger/log_pdag.h"
#include "logger/log_tally.h"
#include "logger/log_working_set.h"
#include "parameter.h"

#include "mc/core/direct_eval.h"
#include "mc/logger/log_benchmark.h"
#include "mc/logger/log_layers.h"
#include "mc/logger/log_settings.h"
#include "mc/queue/layer_manager.h"
#include "mc/scheduler/convergence_controller.h"
#include "mc/stats/tally_node.h"
#include "mc/stats/tally_node_map.h"

#include <vector>
#include <string>
#include <chrono>
#include <ctime>
#include <variant>

namespace scram::core {


/**
 * @brief Constructs a Monte Carlo probability analyzer from a fault tree analyzer
 *
 * @details Creates a probability analyzer that reuses the PDAG (Probabilistic Directed
 * Acyclic Graph) from the provided fault tree analyzer. This constructor is optimized
 * for performance by avoiding redundant graph construction and maintaining reference
 * consistency between the fault tree analysis and probability analysis phases.
 *
 * @param fta Pointer to fault tree analyzer containing the constructed PDAG
 * @param mission_time Pointer to mission time expression for time-dependent analysis
 *
 * @see ProbabilityAnalyzerBase::ProbabilityAnalyzerBase for base class documentation
 * @see FaultTreeAnalyzer<DirectEval> for fault tree analysis details
 * @see core::Pdag for graph structure documentation
 */
ProbabilityAnalyzer<mc::DirectEval>::ProbabilityAnalyzer(FaultTreeAnalyzer<mc::DirectEval> *fta,
                                                         mef::MissionTime *mission_time)
    : ProbabilityAnalyzerBase(fta, mission_time) {
    LOG(DEBUG2) << "Re-using PDAG from mc::DirectEval FaultTreeAnalyzer for ProbabilityAnalyzer";
}

/**
 * @brief Calculates total system failure probability using Monte Carlo sampling
 * @param p_vars Index-mapped probability values for all basic events in the graph
 * @return Estimated total system failure probability (range: [0.0, 1.0])
 *
 * @see mc::queue::layer_manager for execution engine details
 * @see mc::queue::layer_manager::tally for statistical computation
 * @see sample_shape for memory layout configuration
 * @see Settings for parameter configuration options
 */
double ProbabilityAnalyzer<mc::DirectEval>::CalculateTotalProbability(const Pdag::IndexMap<double> &p_vars) {
    std::cout << "[MC::CalculateTotalProbability] Starting..." << std::endl;
    std::cout << "[MC::CalculateTotalProbability] Getting root..." << std::endl;
    const auto &root_id = this->graph()->root()->index();
    std::cout << "[MC::CalculateTotalProbability] Root index: " << root_id << std::endl;
    // add the root node to observed for convergence map
    std::cout << "[MC::CalculateTotalProbability] Observing root node..." << std::endl;
    observe(std::unordered_set<int>{root_id}, true, false);
    std::cout << "[MC::CalculateTotalProbability] Computing tallies..." << std::endl;
    ComputeTallies();
    std::cout << "[MC::CalculateTotalProbability] Tallies computed, getting mean..." << std::endl;
    const double mean = monitored_[root_id].tally_stats.mean;
    LOG(DEBUG1) << "Root Event Probability: " << mean;
    std::cout << "[MC::CalculateTotalProbability] Mean: " << mean << std::endl;
    return mean;
}

void ProbabilityAnalyzer<mc::DirectEval>::ComputeTallies(const bool converge_on_root_only) {

    std::cout << "[MC::ComputeTallies] Starting..." << std::endl;
    SanitizeWatchState();
    std::cout << "[MC::ComputeTallies] Watch state sanitized." << std::endl;

    CLOCK(calc_time);

    std::cout << "[MC::ComputeTallies] Getting PDAG and settings..." << std::endl;
    Pdag *pdag = this->graph();
    const auto &settings = this->settings();
    const std::size_t N = settings.num_trials();
    std::cout << "[MC::ComputeTallies] Number of trials: " << N << std::endl;

    LOG(DEBUG3) << "Watching " << monitored_.size() << " tallies";
    std::cout << "[MC::ComputeTallies] Monitored size: " << monitored_.size() << std::endl;

    using bitpack_t_ = std::uint64_t;
    std::cout << "[MC::ComputeTallies] Creating layer_manager..." << std::endl;
    const mc::stats::TallyNodeMap &tally_node_map = this->monitored();
    mc::queue::layer_manager<bitpack_t_> manager(pdag, N, tally_node_map, settings.overhead_ratio());
    std::cout << "[MC::ComputeTallies] layer_manager created." << std::endl;

    using bayes_t = mc::stats::bayes_policy;
    using wald_t  = mc::stats::wald_policy;

    std::cout << "[MC::ComputeTallies] Creating convergence_controller with bayes_policy..." << std::endl;
    std::variant<mc::scheduler::convergence_controller<bayes_t, bitpack_t_>,
                 mc::scheduler::convergence_controller<wald_t,  bitpack_t_>> scheduler_var{std::in_place_type<mc::scheduler::convergence_controller<bayes_t, bitpack_t_>>, manager, settings};
    std::cout << "[MC::ComputeTallies] convergence_controller created." << std::endl;

    auto make_scheduler = [&](auto tag){
        using pol_t = std::decay_t<decltype(tag)>;
        return mc::scheduler::convergence_controller<pol_t, bitpack_t_>{manager, settings};
    };

    std::cout << "[MC::ComputeTallies] Checking CI policy: " << static_cast<int>(settings.ci_policy()) << std::endl;
    if (settings.ci_policy() == scram::core::CIPolicy::kWald) {
        std::cout << "[MC::ComputeTallies] Emplacing Wald policy scheduler..." << std::endl;
        scheduler_var.emplace<mc::scheduler::convergence_controller<wald_t, bitpack_t_> >(manager, settings);
        std::cout << "[MC::ComputeTallies] Wald scheduler emplaced." << std::endl;
    }

    std::cout << "[MC::ComputeTallies] Setting up visit_sched lambda..." << std::endl;
    auto visit_sched = [&](auto &scheduler){
        std::cout << "[MC::visit_sched] Starting..." << std::endl;
        // Time the result() execution with high precision
        const auto start_time = std::chrono::high_resolution_clock::now();

        std::cout << "[MC::visit_sched] converge_on_root_only: " << converge_on_root_only << std::endl;
        mc::event::tally<bitpack_t_> tally;
        if (converge_on_root_only) {
            std::cout << "[MC::visit_sched] Running to convergence on root index: " << this->graph()->root()->index() << std::endl;
            tally = scheduler.run_to_convergence(this->graph()->root()->index());
            std::cout << "[MC::visit_sched] run_to_convergence completed." << std::endl;
        } else {
            std::cout << "[MC::visit_sched] Running to convergence on monitored set (size: " << this->monitored_.size() << ")" << std::endl;
            tally = scheduler.run_to_convergence(this->monitored_);
            std::cout << "[MC::visit_sched] run_to_convergence completed." << std::endl;
        }
        std::cout << "[MC::visit_sched] Collecting tallies..." << std::endl;
        // collect observed tallies anyway
        manager.collect_tallies(this->monitored_);
        const auto end_time = std::chrono::high_resolution_clock::now();

        // Calculate duration in milliseconds
        const auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time);
        long long convergence_time_ms = duration.count();


        // benchmark specific log
        {
            using namespace scram;
            const auto &cur_state  = scheduler.current_state();
            const auto &steps_cur  = scheduler.current_steps();
            const auto &steps_proj = scheduler.projected_steps();

            const auto &root_tally = monitored_.at(this->graph()->root()->index()).tally_stats;

            std::vector<std::pair<std::string,std::string>> kv;
            // settings
            {
                auto s_pairs = log::settings::csv_pairs(this->settings());
                kv.insert(kv.end(), s_pairs.begin(), s_pairs.end());
            }
            // working_set
            {
                auto s_pairs = log::working_set::csv_pairs(mc::working_set<size_t, bitpack_t_>(manager.queue()));
                kv.insert(kv.end(), s_pairs.begin(), s_pairs.end());
            }
            // layer_manager
            {
                auto s_pairs = log::layers::csv_pairs<bitpack_t_>(manager);
                kv.insert(kv.end(), s_pairs.begin(), s_pairs.end());
            }
            // pdag
            {
                auto s_pairs = log::pdag::csv_pairs(*this->graph());
                kv.insert(kv.end(), s_pairs.begin(), s_pairs.end());
            }
            // tally
            {
                auto s_pairs = log::tally::csv_pairs(root_tally);
                kv.insert(kv.end(), s_pairs.begin(), s_pairs.end());
            }
            {
                // Add convergence time
                kv.emplace_back("convergence_time_ms", log::csv_string(convergence_time_ms));
            }
            // convergence / run metrics
            {
                log::convergence::csv_pairs(kv);
            }
            log::BenchmarkLogger mc_logger{"convergence.csv"};
            mc_logger.log_pairs(kv);
        }
        // generic log
        {
            LOG(DEBUG1) << "Calculated observed tallies for " << monitored_.size() << " events in " << DUR(calc_time);
            LOG(DEBUG1) << tally;
            for (auto [idx, t_ref] : mc::stats::tally_view(monitored_)) {
                const auto &t = t_ref;
                LOG(DEBUG2) << "[" << idx << "] | " << t;
            }
            // diagnostic stats
            LOG(DEBUG1) << *scheduler.accuracy_metrics();
            LOG(DEBUG1) << *scheduler.sampling_diagnostics();
        }
    };

    std::visit(visit_sched, scheduler_var);
}

std::unordered_set<int> ProbabilityAnalyzer<mc::DirectEval>::ObserveNodes(Pdag *pdag,
                                                                          mc::stats::TallyNodeMap &observing,
                                                                          const std::unordered_set<index_t> &to_observe,
                                                                          const bool track_convergence,
                                                                          const bool clear_stats) {
    std::unordered_set<index_t> will_observe;
    // Depth-first traversal collecting every Node
    pdag->Clear<Pdag::kGateMark>();
    TraverseNodes(pdag->root(), [&will_observe, &observing, &to_observe, &track_convergence, &clear_stats](const std::shared_ptr<Node> &n) {
        // we want to observe this node
        // node from pdag is in to_observe set, i.e. we intend to observe this node
        if (const index_t &idx = n->index(); to_observe.contains(idx)) {

            auto temp = TallyNode{
                .status = track_convergence ? mc::stats::convergence::not_converged : mc::stats::convergence::not_tracked,
                .tally_stats = mc::stats::tally{},
                .node = n,
            };

            // the currently observed map already contains this node, we need to be careful about not clearing
            // its state
            if (observing.contains(idx)) {
                if (observing[idx].node != n) {
                    LOG(ERROR) << "pdag node with idx [" << idx
                               << "] points to a different node than observed tally_node_map, will overwrite";
                }
                // clear stats if requested
                temp.tally_stats = clear_stats ? mc::stats::tally{} : observing[idx].tally_stats;
                temp.status = observing[idx].status >= mc::stats::not_converged ? observing[idx].status : temp.status;
            }

            // even if this node is not already observed, reassign it.
            observing.insert_or_assign(idx, temp);
            will_observe.insert(idx); // inserted should be usable here
        }
    });
    // Reset traversal marks so other algorithms see a pristine graph.
    pdag->Clear<Pdag::kGateMark>();
    return will_observe;
}

auto ProbabilityAnalyzer<mc::DirectEval>::GatherGates(Pdag *pdag, std::unordered_set<index_t> *nodes) {
    if (!pdag || !nodes) {
        return;
    }
    pdag->Clear<Pdag::kGateMark>();
    // Depth-first traversal collecting every Node
    TraverseNodes(pdag->root(), [&nodes](const std::shared_ptr<Node> &n) {
        if (std::dynamic_pointer_cast<core::Gate>(n)) {
            nodes->insert(n->index());
        }
    });
    // Reset traversal marks so other algorithms see a pristine graph.
    pdag->Clear<Pdag::kGateMark>();
}

std::unordered_set<int> ProbabilityAnalyzer<mc::DirectEval>::GatherGates(Pdag *pdag) {
    std::unordered_set<index_t> nodes;
    ProbabilityAnalyzer<mc::DirectEval>::GatherGates(pdag, &nodes);
    return nodes;
}

void ProbabilityAnalyzer<mc::DirectEval>::SanitizeWatchState() {
    //std::unordered_set<index_t> node_indices;
    //auto bimap = WalkAndCollectMefGatesWithIndices(this->graph());
    //auto keys = bimap.A_to_B | std::ranges::views::keys;
    //observe(keys, false, false);
}

/**
 * TODO:: This is a great opportunity for using batch_size > 1, to compute probabilities for different
 * time-slices while packing them in the same buffer. Some minor additions to mc::event::basic_event and others will
 * be needed to store the thresholds. Or, maybe those could be sliced in the work-item kernels as well...
 * TODO:: think about how already existing tallies at t=t_0 might help with the estimate at t=t_0 + dt
 * TODO:: don't assume P(x,t) is monotonically rising or decreasing.
 */
std::vector<std::pair<double, double>> ProbabilityAnalyzer<mc::DirectEval>::CalculateProbabilityOverTime() {
    std::vector<std::pair<double, double>> p_time;
    if (const std::double_t time_step = Analysis::settings().time_step(); time_step <= 0) {
        return p_time;
    }

    if (const std::double_t total_time = ProbabilityAnalysis::mission_time().value();
        Analysis::settings().mission_time() != total_time) {
        throw std::invalid_argument("cannot compute CalculateProbabilityOverTime(), mission time mismatch");
        }

    //
    // auto update = [this, &p_time](double time) {
    //     mission_time().value(time);
    //     auto it_p = p_vars_.begin();
    //     for (const mef::BasicEvent *event: graph_->basic_events())
    //         *it_p++ = event->p();
    //     p_time.emplace_back(this->CalculateTotalProbability(p_vars_), time);
    // };

    // for (double time = 0; time < total_time; time += time_step)
    //     update(time);
    // update(total_time);// Handle cases when total_time is not divisible by step.
    return p_time;
}

inline ProbabilityAnalyzer<mc::DirectEval>::~ProbabilityAnalyzer() = default;

// Helper: collect indices of PDAG gates that have an origin pointer.
static void FillIndicesWithMefOrigin(Pdag *graph, std::unordered_set<int> *out) {
    if (!graph || !out) return;
    graph->Clear<Pdag::kGateMark>();
    TraverseGates(graph->root_ptr(), [out](const std::shared_ptr<core::Gate> &g) {
      // if gate has origin (was watched using watch-guard and mef_origin_ptr)
      if (g->mef_origin_ptr()) {
        // get its index
        int idx = g->index();
        // if we haven't seen this gate's index before, add it to the list.
        if (!out->contains(idx)) {
          out->insert(idx);
        }
      }
    });
    graph->Clear<Pdag::kGateMark>();
}


static int FindIndexForMEFGate(Pdag *graph, const mef::Gate *gptr) {
    int result = 0;
    graph->Clear<Pdag::kGateMark>();
    TraverseGates(graph->root_ptr(), [&result, gptr](const std::shared_ptr<core::Gate> &pg) {
      if (pg->mef_origin_ptr() == gptr) {
        result = pg->index();
      }
    });
    graph->Clear<Pdag::kGateMark>();
    return result;
}

} // namespace scram::core