/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2023 OpenPRA ORG Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @file
/// Implementation of risk analysis handler.

#include "risk_analysis.h"

#include <iostream>
#include "bdd.h"
#include "event.h"
#include "expression/random_deviate.h"
#include "ext/scope_guard.h"
#include "fault_tree.h"
#include "logger.h"
#include "mc/core/direct_eval.h"
#include "mocus.h"
#include "pdag.h"
#include "zbdd.h"

#include <unordered_set>
#include <string>

// RAII helper that sets the global PDAG watch list for the current scope.
struct WatchGuard {
    explicit WatchGuard(const std::unordered_set<const scram::mef::Gate *> *wl) {
        scram::core::Pdag::SetWatchedGates(wl);
    }
    ~WatchGuard() { scram::core::Pdag::SetWatchedGates(nullptr); }
};

namespace scram::core {

RiskAnalysis::RiskAnalysis(mef::Model* model, const Settings& settings)
    : Analysis(settings), model_(model) {}

void RiskAnalysis::Analyze()  {
  assert(results_.empty() && "Rerunning the analysis.");
  // Set the seed for the pseudo-random number generator if given explicitly.
  // Otherwise it defaults to the implementation dependent value.
  if (Analysis::settings().seed() >= 0)
    mef::RandomDeviate::seed(Analysis::settings().seed());

  if (model_->alignments().empty()) {
    RunAnalysis();
  } else {
    for (const mef::Alignment& alignment : model_->alignments()) {
      for (const mef::Phase& phase : alignment.phases())
        RunAnalysis(Context{alignment, phase});
    }
  }
}

void RiskAnalysis::RunAnalysis(const std::optional<Context> &context) {
  std::vector<std::pair<mef::HouseEvent*, bool>> house_events;
  /// Restores the model after application of the context.
  ext::scope_guard restorator(
      [&house_events, this, init_time = model_->mission_time().value()] {
        model_->mission_time().value(init_time);
        Analysis::settings().mission_time(init_time);

        for (const std::pair<mef::HouseEvent*, bool>& entry : house_events)
          entry.first->state(entry.second);
      });

  if (context) {
    double mission_time = context->phase.time_fraction() * model_->mission_time().value();
    model_->mission_time().value(mission_time);
    Analysis::settings().mission_time(mission_time);

    for (const mef::SetHouseEvent* instruction : context->phase.instructions()) {
      auto it = model_->table<mef::HouseEvent>().find(instruction->name());
      assert(it != model_->table<mef::HouseEvent>().end() && "Invalid instruction.");
      mef::HouseEvent& house_event = *it;
      if (house_event.state() != instruction->state()) {
        house_events.emplace_back(&house_event, house_event.state());
        house_event.state(instruction->state());
      }
    }
  }

    // our policy is to quantify all initiating events (and linked ET, FT ....)
    // our policy is to quantify all unlinked or linked FT tops
    // our policy is to avoid requantifying an FT top if it was already linked in a IE->ET->FT analysis.

    // declare that we intend to observe the tops of fault trees that we might encounter when performing ETA analysis.
    // this list, however, only gives us the IDs of the fault trees in this entire model. This entire model can contain
    // multiple event trees, multiple fault trees, and it's possible that some (or all) FT tops are not even linked to
    // a sequence. Consider all cases of multiplicity/linking.

    for (const mef::FaultTree &ft : model_->fault_trees()) {
        for (const mef::Gate *target : ft.top_events()) {
            this->observe_for_convergence(target);
        }
    }

    // If the user requested Monte-Carlo probability analysis with the
    // DirectEval engine, run *one* combined PDAG for every sequence of this
    // event-tree.  Fall back to the legacy per-sequence path otherwise.
    const bool combined_mc_path =
        Analysis::settings().algorithm() == Algorithm::kDirect &&
        Analysis::settings().approximation() == Approximation::kMonteCarlo &&
        Analysis::settings().probability_analysis();

  // todo:: combine all initiating events and linked event trees into a unified PDAG if using MonteCarlo DirectEval Probability
  // note:: multiple initiating events may point to the same event tree, which is totally fine, it should be a simple
  // link in the PDAG
  for (const mef::InitiatingEvent& initiating_event : model_->initiating_events()) {
    if (initiating_event.event_tree()) {
      LOG(INFO) << "Running event tree analysis: " << initiating_event.name();
      auto eta = std::make_unique<EventTreeAnalysis>(initiating_event, Analysis::settings(), model_->context());
      eta->Analyze();

      if (combined_mc_path) {
        RunCombinedEtaAnalysis(initiating_event, eta.get(), context);
      } else {
        for (EventTreeAnalysis::Result& result : eta->sequences()) {
          const mef::Sequence& sequence = result.sequence;
          LOG(INFO) << "Running analysis for sequence: " << sequence.name();

          results_.push_back({{std::pair<const mef::InitiatingEvent&, const mef::Sequence&>{initiating_event, sequence}, context}});
          RunAnalysis(*result.gate, &results_.back());

          if (result.is_expression_only) {
            results_.back().fault_tree_analysis = nullptr;
            results_.back().importance_analysis = nullptr;
          }
          if (Analysis::settings().probability_analysis()) {
              result.p_sequence = results_.back().probability_analysis->p_total();
          }
          LOG(INFO) << "Finished analysis for sequence: " << sequence.name();
        }
      }
      event_tree_results_.push_back({initiating_event, context, std::move(eta)});
      LOG(INFO) << "Finished event tree analysis: " << initiating_event.name();
    }
  }
    // if (combined_mc_path) {
    //     // -------------------------------------------------------------
    //     // Avoid re-analyzing fault-tree top events that have already
    //     // been processed as part of the event-tree sequences above.
    //     // -------------------------------------------------------------
    //     return;
    // }

    std::unordered_set<const mef::Gate*> gate_results;
    for (const auto &result : results_) {
        const auto &element = result.id.target;
        if (const auto val = std::get_if<const mef::Gate *>(&element)) {
            gate_results.insert(*val);
        }
    }

  for (const mef::FaultTree& ft : model_->fault_trees()) {
    for (const mef::Gate* target : ft.top_events()) {
      if (!gate_results.contains(target)) {
          LOG(INFO) << "Running analysis for gate: " << target->id();
          results_.push_back({{target, context}});
          RunAnalysis(*target, &results_.back());
          LOG(INFO) << "Finished analysis for gate: " << target->id();
      } else {
          LOG(INFO) << "Not re-running analysis for gate: " << target->id();
      }
    }
  }
}

void RiskAnalysis::RunAnalysis(const mef::Gate& target, Result* result)  {
  switch (Analysis::settings().algorithm()) {
    case Algorithm::kBdd:
      return RunAnalysis<Bdd>(target, result);
    case Algorithm::kZbdd:
      return RunAnalysis<Zbdd>(target, result);
    case Algorithm::kMocus:
        return RunAnalysis<Mocus>(target, result);
    case Algorithm::kDirect:
        return RunAnalysis<mc::DirectEval>(target, result);
  }
}

template <class Algorithm>
void RiskAnalysis::RunAnalysis(const mef::Gate& target,
                               Result* result)  {
  std::cout << "[RiskAnalysis::RunAnalysis] Starting for gate: " << target.id() << std::endl;
  WatchGuard wg(&watched_for_tallies_and_convergence_);
  auto fta = std::make_unique<FaultTreeAnalyzer<Algorithm>>(target, Analysis::settings(), model_);
  std::cout << "[RiskAnalysis::RunAnalysis] Calling fta->Analyze()..." << std::endl;
  fta->Analyze();
  std::cout << "[RiskAnalysis::RunAnalysis] fta->Analyze() complete." << std::endl;
  if (Analysis::settings().probability_analysis()) {
    std::cout << "[RiskAnalysis::RunAnalysis] Probability analysis enabled, approximation: " << static_cast<int>(Analysis::settings().approximation()) << std::endl;
    switch (Analysis::settings().approximation()) {
      case Approximation::kNone:
        std::cout << "[RiskAnalysis::RunAnalysis] Running with Bdd approximation..." << std::endl;
        RunAnalysis<Algorithm, Bdd>(fta.get(), result);
        break;
      case Approximation::kRareEvent:
        std::cout << "[RiskAnalysis::RunAnalysis] Running with RareEvent approximation..." << std::endl;
        RunAnalysis<Algorithm, RareEventCalculator>(fta.get(), result);
        break;
      case Approximation::kMcub:
        std::cout << "[RiskAnalysis::RunAnalysis] Running with MCUB approximation..." << std::endl;
        RunAnalysis<Algorithm, McubCalculator>(fta.get(), result);
        break;
      case Approximation::kMonteCarlo:
        std::cout << "[RiskAnalysis::RunAnalysis] Running with MonteCarlo approximation..." << std::endl;
        RunAnalysis<Algorithm, mc::DirectEval>(fta.get(), result);
        break;
    }
  }
  std::cout << "[RiskAnalysis::RunAnalysis] Moving fta to result..." << std::endl;
  result->fault_tree_analysis = std::move(fta);
  std::cout << "[RiskAnalysis::RunAnalysis] Complete!" << std::endl;
}

template <class Algorithm, class Calculator>
void RiskAnalysis::RunAnalysis(FaultTreeAnalyzer<Algorithm>* fta,
                               Result* result)  {
  std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Creating ProbabilityAnalyzer..." << std::endl;
  auto pa = std::make_unique<ProbabilityAnalyzer<Calculator>>(fta, &model_->mission_time());
  std::cout << "[RiskAnalysis::RunAnalysis<A,C>] ProbabilityAnalyzer created." << std::endl;

  if constexpr (std::is_same_v<Calculator, mc::DirectEval>) {
    std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Monte Carlo path - getting graph..." << std::endl;
    // retrieve the set of "watched" nodes, i.e. the nodes the pdag is aware of. These are the ones we need to track in
    // our convergence and/or tallies

      std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Walking and collecting MEF gates..." << std::endl;
      ext::bimap<int, const mef::Gate*> bimap = WalkAndCollectMefGatesWithIndices(pa->graph());
      std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Collected " << bimap.A_to_B.size() << " gates." << std::endl;

      std::unordered_set<int> watched_for_tallies;
      for (const auto &mef_event : watched_for_tallies_) {
          if (bimap.B_to_A.contains(mef_event)) {
              watched_for_tallies.insert(bimap.B_to_A[mef_event]);
          }
      }
      std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Observing " << watched_for_tallies.size() << " tallies..." << std::endl;
      pa->observe(watched_for_tallies, false, false);
      std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Tallies observed." << std::endl;

      std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Observing " << watched_for_tallies_and_convergence_.size() << " convergence nodes..." << std::endl;
      std::unordered_set<int> watched_for_convergence;
      for (const auto &mef_event : watched_for_tallies_and_convergence_) {
          if (bimap.B_to_A.contains(mef_event)) {
              watched_for_convergence.insert(bimap.B_to_A[mef_event]);
          }
      }
      std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Observing " << watched_for_convergence.size() << " convergence indices..." << std::endl;
      pa->observe(watched_for_convergence, true, false);
      std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Convergence observed." << std::endl;
  }

  std::cout << "[RiskAnalysis::RunAnalysis<A,C>] Calling pa->Analyze()..." << std::endl;
  pa->Analyze();
  std::cout << "[RiskAnalysis::RunAnalysis<A,C>] pa->Analyze() complete." << std::endl;
  if (Analysis::settings().importance_analysis()) {
    auto ia = std::make_unique<ImportanceAnalyzer<Calculator>>(pa.get());
    ia->Analyze();
    result->importance_analysis = std::move(ia);
  }
  if (Analysis::settings().uncertainty_analysis()) {
    auto ua = std::make_unique<UncertaintyAnalyzer<Calculator>>(pa.get());
    ua->Analyze();
    result->uncertainty_analysis = std::move(ua);
  } else {
      if constexpr (std::is_same_v<Calculator, mc::DirectEval>) {
          const mc::stats::TallyNodeMap &tallies = pa->monitored();
          const auto &root_idx = pa->graph()->root()->index();
          if (tallies.contains(root_idx)) {
              const mc::stats::TallyNode &node = tallies.at(root_idx);
              result->uncertainty_analysis = std::make_unique<UncertaintyAnalysis>(node.tally_stats);
          }
      }
  }
  result->probability_analysis = std::move(pa);
}

// ---------------------------------------------------------------------------
//  Combined Monte-Carlo processing of all event-tree sequences (DirectEval)
// ---------------------------------------------------------------------------
void RiskAnalysis::RunCombinedEtaAnalysis(const mef::InitiatingEvent& initiating_event,
                                          EventTreeAnalysis* eta,
                                          const std::optional<Context> &context) {
  // Nothing to do if the event-tree produced no sequences.
  if (eta->sequences().empty())
    return;

  // -----------------------------------------------------------------------
  // 1. Build a synthetic OR gate that feeds every sequence gate.
  // -----------------------------------------------------------------------
  const std::string root_name = "__ETA_OR_ROOT__" + initiating_event.name();
  // Allocate the synthetic root on the heap; it must stay alive for as long
  // as the FaultTreeAnalyzer (stored in `results_`) is around.  We therefore
  // intentionally release ownership at the end of the function so that the
  // memory lives until process termination.  The amount of leaked memory is
  // negligible (one small Gate object per analysed event tree root).
  auto synthetic_root = std::make_unique<mef::Gate>(root_name);

  mef::Formula::ArgSet arg_set;
  for (const auto& seq_res : eta->sequences()) {
    arg_set.Add(seq_res.gate.get());
  }
  synthetic_root->formula(std::make_unique<mef::Formula>(mef::kOr, std::move(arg_set)));

  // -----------------------------------------------------------------------
  // 2. Run qualitative analysis (PDAG construction + preprocessing).
  // -----------------------------------------------------------------------
  WatchGuard wg(&watched_for_tallies_and_convergence_);
  auto fta = std::make_unique<FaultTreeAnalyzer<mc::DirectEval>>(*synthetic_root, Analysis::settings(), model_);
  fta->Analyze();

  // Inform the probability analyzer which PDAG nodes correspond to the
  // event-tree sequences so that the convergence controller monitors them.
  std::unordered_set<int> seq_node_indices;
  std::vector<int> seq_node_indices_index;

  // -----------------------------------------------------------------------
  // 3. Quantitative Monte-Carlo analysis on the entire PDAG.
  // -----------------------------------------------------------------------
  std::unique_ptr<ProbabilityAnalyzer<mc::DirectEval>> pa;
  if (Analysis::settings().probability_analysis()) {
    pa = std::make_unique<ProbabilityAnalyzer<mc::DirectEval>>(fta.get(), &model_->mission_time());

    {
      const auto& root_core_gate = fta->graph()->root_ptr();
      seq_node_indices.reserve(root_core_gate->args<Gate>().size());
      for (const auto& child : root_core_gate->args<Gate>()) {
        seq_node_indices.insert(child.second->index());
        seq_node_indices_index.push_back(child.second->index());
      }
    }
    constexpr bool track_convergence = true;
    constexpr bool clear_stats = false;
    pa->observe(seq_node_indices, track_convergence, clear_stats);
    pa->Analyze();
  }

  // Keep a reference to tallies before we possibly move the probability
  // analyzer into the first result.
  const mc::stats::TallyNodeMap *tally_node_map_ptr = pa ? &pa->monitored() : nullptr;

  // -----------------------------------------------------------------------
  // 4. Optional Importance / Uncertainty analysis (computed once).
  // -----------------------------------------------------------------------
  std::unique_ptr<ImportanceAnalyzer<mc::DirectEval>> ia;
  std::unique_ptr<UncertaintyAnalyzer<mc::DirectEval>> ua;
  if (pa && Analysis::settings().importance_analysis()) {
    ia = std::make_unique<ImportanceAnalyzer<mc::DirectEval>>(pa.get());
    ia->Analyze();
  }
  if (pa && Analysis::settings().uncertainty_analysis()) {
    ua = std::make_unique<UncertaintyAnalyzer<mc::DirectEval>>(pa.get());
    ua->Analyze();
  }

  // -----------------------------------------------------------------------
  // 5. Create one RiskAnalysis::Result entry PER SEQUENCE, re-using the same
  //    analysis artifacts (moved into the first entry).
  // -----------------------------------------------------------------------
  int seq_res_index = 0;
  for (EventTreeAnalysis::Result& seq_res : eta->sequences()) {
    const mef::Sequence& sequence = seq_res.sequence;
    LOG(INFO) << "Extracting Monte-Carlo probability for sequence: " << sequence.name();

    results_.push_back({{std::pair<const mef::InitiatingEvent&, const mef::Sequence&>{initiating_event, sequence}, context}});
    Result& out = results_.back();
    out.probability_analysis = nullptr;
    out.fault_tree_analysis = nullptr;
    out.importance_analysis = nullptr;
    // -------------------------------------------------------------------
    // Probability for this sequence gate – look it up from tallies.
    // -------------------------------------------------------------------
    double p_seq = 0.0;
    if (tally_node_map_ptr) {
        const int &node_idx = seq_node_indices_index[seq_res_index];
        if (tally_node_map_ptr->contains(node_idx)) {
            const auto &[status, tally_stats, node] = tally_node_map_ptr->at(node_idx);
            p_seq = tally_stats.mean;
            out.uncertainty_analysis = std::make_unique<UncertaintyAnalysis>(tally_stats);
        } else {
            LOG(ERROR) << "Did not find end state frequency for sequence " << node_idx;
        }
    }
    ++seq_res_index;
    seq_res.p_sequence = p_seq;
  }

    // collect all the index to mef gate mappings once.
    auto [A_to_B, B_to_A] = WalkAndCollectMefGatesWithIndices(pa->graph());
    // -----------------------------------------------------------------------
    // 6. Emit individual results for any additionally watched gates that were
    //    not part of the sequences (avoids duplicates).
    // -----------------------------------------------------------------------
    for (const mef::Gate *watched_gate : watched_for_tallies_and_convergence_) {

        if (!B_to_A.contains(watched_gate)) {
            LOG(ERROR) << "watched gate "<<watched_gate->full_path()<<" not found in pdag";
            continue;
        }

        const int idx = B_to_A[watched_gate];

        if (!tally_node_map_ptr) {
            LOG(ERROR) << "idx ["<<idx<<"] :: watched gate "<<watched_gate->full_path()<<" :: tallies not found";
            break;
        }

        if (!tally_node_map_ptr->contains(idx)) {
            LOG(ERROR) << "idx ["<<idx<<"] for watched gate "<<watched_gate->full_path()<<" not found in tallies";
            continue;
        }

        const auto &p_gate = tally_node_map_ptr->at(idx).tally_stats.mean;

        // create minimal RiskAnalysis::Result entry for this gate
        results_.push_back({
          .id = {
              .target = watched_gate,
              .context = context,
          },
        });

        Result &gate_result = results_.back();
        gate_result.probability_analysis = nullptr;
        gate_result.fault_tree_analysis = nullptr;
        gate_result.importance_analysis = nullptr;
        gate_result.uncertainty_analysis = std::make_unique<UncertaintyAnalysis>(tally_node_map_ptr->at(idx).tally_stats);
    }

    // Attach analysis artifacts only to the first sequence to retain ownership.
    if (results().size() >= 1) {
        results_[0].fault_tree_analysis = std::move(fta);
        results_[0].probability_analysis = std::move(pa);
        results_[0].importance_analysis = std::move(ia);
        results_[0].uncertainty_analysis = std::move(ua);
    }

  // Release ownership so that the Gate outlives the current scope.  This is a
  // deliberate leak to satisfy the lifetime requirements of
  // FaultTreeAnalyzer without invasive refactoring.
  synthetic_root.release();
}


}  // namespace scram::core
