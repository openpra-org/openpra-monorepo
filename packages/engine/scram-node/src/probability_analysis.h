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
/// Contains functionality to do numerical analysis of probabilities.

#pragma once

#include <utility>
#include <vector>
#include <memory>

#include "analysis.h"
#include "bdd.h"
#include "fault_tree_analysis.h"
#include "logger.h"
#include "pdag.h"

#include "mc/stats/tally.h"
#include "mc/stats/tally_node.h" // existing
#include "mc/stats/tally_node_map.h" // new map

namespace scram::mef {
class MissionTime;
} // namespace scram::mef

namespace scram::core {

    /// Safety Integrity Level metrics.
    ///
    /// @note Averages and histograms are with respect to time.
    struct Sil {
        double pfd_avg = 0;///< The average probability of failure on demand (PFD).
        double pfh_avg = 0;///< The average probability of failure hourly (PFH).

        /// The SIL PFD and PFD fractions histogram in reverse order, i.e., 4 to 1.
        /// The starting boundary is implicitly 0.
        /// The last boundary is explicit 1.
        /// The range is half open: (lower-bound, upper-bound].
        /// @{
        std::array<std::pair<const double, double>, 6> pfd_fractions{
                {{1e-5, 0}, {1e-4, 0}, {1e-3, 0}, {1e-2, 0}, {1e-1, 0}, {1, 0}}};
        std::array<std::pair<const double, double>, 6> pfh_fractions{
                {{1e-9, 0}, {1e-8, 0}, {1e-7, 0}, {1e-6, 0}, {1e-5, 0}, {1, 0}}};
        /// @}
    };

    /// Main quantitative analysis class.
    class ProbabilityAnalysis : public Analysis {
    public:
        /// Probability analysis
        /// with the results of qualitative analysis.
        ///
        /// @param[in] fta  Fault tree analysis with results.
        /// @param[in] mission_time  The mission time expression of the model.
        ///
        /// @pre The underlying fault tree must not have changed in any way
        ///      since the fault tree analysis finished.
        ProbabilityAnalysis(const FaultTreeAnalysis *fta, mef::MissionTime *mission_time);

        virtual ~ProbabilityAnalysis() = default;

        /// Performs quantitative analysis on the supplied fault tree.
        ///
        /// @pre Analysis is called only once.
        ///
        /// @post The mission time expression has its original value.
        void Analyze() ;

        /// @returns The total probability calculated by the analysis.
        ///
        /// @pre The analysis is done.
        double p_total() const { return p_total_; }

        /// @returns The probability values over the mission time in time steps.
        ///          The empty container implies no calculation has been done.
        ///
        /// @pre The analysis is done.
        const std::vector<std::pair<double, double>> &p_time() const {
            return p_time_;
        }

        /// @returns The Safety Integrity Level calculation results.
        ///
        /// @pre The analysis is done with a request for the SIL.
        const Sil &sil() const {
            assert(sil_ && "The SIL is not done!");
            return *sil_;
        }

    protected:
        /// @returns The mission time expression of the model.
        mef::MissionTime &mission_time() { return *mission_time_; }

    private:
        /// Calculates the total probability.
        ///
        /// @returns The total probability of the graph or products.
        virtual double CalculateTotalProbability()  = 0;

        /// Calculates the probability evolution through the mission time.
        ///
        /// @returns The probabilities at time steps.
        virtual std::vector<std::pair<double, double>>
        CalculateProbabilityOverTime()  = 0;

        /// Computes probability metrics related to the SIL.
        void ComputeSil() ;

        double p_total_;                               ///< Total probability of the top event.
        mef::MissionTime *mission_time_;               ///< The mission time expression.
        std::vector<std::pair<double, double>> p_time_;///< {probability, time}.
        std::unique_ptr<Sil> sil_;                     ///< The Safety Integrity Level results.
    };

    /// Quantitative calculator of a probability value of a single cut set.
    class CutSetProbabilityCalculator {
    public:
        /// Calculates a probability of a cut set,
        /// whose members are in AND relationship with each other.
        /// This function assumes independence of each member.
        ///
        /// @param[in] cut_set  A cut set with positive indices of basic events.
        /// @param[in] p_vars  Probabilities of events mapped by the variable indices.
        ///
        /// @returns The total probability of the cut set.
        /// @returns 1 for an empty cut set indicating the base set.
        ///
        /// @pre The cut set doesn't contain complements.
        /// @pre Probability values are non-negative.
        /// @pre Indices of events directly map to vector indices.
        double Calculate(const std::vector<int> &cut_set,
                         const Pdag::IndexMap<double> &p_vars) ;
    };

    class Zbdd;// The container of analysis products for computations.

    /// Quantitative calculator of probability values
    /// with the Rare-Event approximation.
    class RareEventCalculator : private CutSetProbabilityCalculator {
    public:
        /// Calculates probabilities
        /// using the Rare-Event approximation.
        ///
        /// @param[in] cut_sets  A collection of sets of indices of basic events.
        /// @param[in] p_vars  Probabilities of events mapped by the variable indices.
        ///
        /// @returns The total probability with the rare-event approximation.
        ///
        /// @post In case the calculated probability exceeds 1,
        ///       the probability is adjusted to 1.
        ///       It is very unwise to use the rare-event approximation
        ///       with large probability values.
        double Calculate(const Zbdd &cut_sets,
                         const Pdag::IndexMap<double> &p_vars) ;
    };

    /// Quantitative calculator of probability values
    /// with the Min-Cut-Upper Bound approximation.
    class McubCalculator : private CutSetProbabilityCalculator {
    public:
        /// Calculates probabilities
        /// using the minimal cut set upper bound (MCUB) approximation.
        ///
        /// @param[in] cut_sets  A collection of sets of indices of basic events.
        /// @param[in] p_vars  Probabilities of events mapped by the variable indices.
        ///
        /// @returns The total probability with the MCUB approximation.
        double Calculate(const Zbdd &cut_sets,
                         const Pdag::IndexMap<double> &p_vars) ;
    };

    /// Base class for Probability analyzers.
    class ProbabilityAnalyzerBase : public ProbabilityAnalysis {
    public:
        /// Constructs probability analyzer from a fault tree analyzer.
        ///
        /// @tparam Algorithm  Qualitative analysis algorithm.
        ///
        /// @copydetails ProbabilityAnalysis::ProbabilityAnalysis
        template<class Algorithm>
        ProbabilityAnalyzerBase(const FaultTreeAnalyzer<Algorithm> *fta,
                                mef::MissionTime *mission_time)
            : ProbabilityAnalysis(fta, mission_time),
              graph_(fta->graph()) {
            if (!settings().skip_products() && settings().requires_products()) {
                const Zbdd& zbdd = (fta->algorithm()->products());
                products_ = &zbdd;
            }
            ExtractVariableProbabilities();
        }

        /// @returns The original PDAG from the fault tree analyzer.
        [[nodiscard]] Pdag *graph() const { return graph_; }

        /// @returns The resulting products of the fault tree analyzer.
        [[nodiscard]] const Zbdd &products() const { return *products_; }

        /// @returns A mapping for probability values with indices.
        [[nodiscard]] const Pdag::IndexMap<double> &p_vars() const { return p_vars_; }

    protected:
        ~ProbabilityAnalyzerBase() override = default;

    private:
        /// Calculates the total probability
        /// with a different set of probability values
        /// than the one given upon construction.
        ///
        /// @param[in] p_vars  A map of probabilities of the graph variables.
        ///                    The indices of the variables must map
        ///                    exactly to the values.
        ///
        /// @returns The total probability calculated with the given values.
        virtual double
        CalculateTotalProbability(const Pdag::IndexMap<double> &p_vars) = 0;

        double CalculateTotalProbability()  override {
            return this->CalculateTotalProbability(p_vars_);
        }

        std::vector<std::pair<double, double>>
        CalculateProbabilityOverTime()  override;

        /// Upon construction of the probability analysis,
        /// stores the variable probabilities in a continuous container
        /// for retrieval by their indices instead of pointers.
        ///
        /// @note This function may seem redundant,
        ///       for it's super-short and simple to do it inline in the constructor.
        ///       The main benefit of the out-of-line implementation
        ///       is compile-time decoupling from the input BasicEvent classes.
        void ExtractVariableProbabilities();

        Pdag *graph_;            ///< PDAG from the fault tree analysis.
        const Zbdd *products_;  ///< A collection of products.
        Pdag::IndexMap<double> p_vars_;///< Variable probabilities.
    };

    /// Fault-tree-analysis-aware probability analyzer.
    /// Probability analyzer provides the main engine for probability analysis.
    ///
    /// @tparam Calculator  Quantitative analysis calculator.
    template<class Calculator>
    class ProbabilityAnalyzer : public ProbabilityAnalyzerBase {
    public:
        using ProbabilityAnalyzerBase::ProbabilityAnalyzerBase;

        double CalculateTotalProbability(
                const Pdag::IndexMap<double> &p_vars)  final {
            return calc_.Calculate(ProbabilityAnalyzerBase::products(), p_vars);
        }

    private:
        Calculator calc_;///< Provider of the calculation logic.
    };

    /// Specialization of probability analyzer with Binary Decision Diagrams.
    /// The quantitative analysis is done with BDD.
    template<>
    class ProbabilityAnalyzer<Bdd> : public ProbabilityAnalyzerBase {
    public:
        /// Constructs probability analyzer from a fault tree analyzer
        /// with the same algorithm.
        ///
        /// @tparam Algorithm  Fault tree analysis algorithm.
        ///
        /// @copydetails ProbabilityAnalysis::ProbabilityAnalysis
        template<class Algorithm>
        ProbabilityAnalyzer(const FaultTreeAnalyzer<Algorithm> *fta,
                            mef::MissionTime *mission_time)
            : ProbabilityAnalyzerBase(fta, mission_time),
              current_mark_(false),
              owner_(true) {
            CreateBdd(*fta);
        }

        /// Reuses BDD structures from Fault tree analyzer.
        ///
        /// @copydetails ProbabilityAnalysis::ProbabilityAnalysis
        ///
        /// @pre BDD is fully formed and used.
        ///
        /// @post FaultTreeAnalyzer is not corrupted
        ///       by use of its BDD internals.
        ProbabilityAnalyzer(FaultTreeAnalyzer<Bdd> *fta,
                            mef::MissionTime *mission_time);

        /// Deletes the PDAG and BDD
        /// only if ProbabilityAnalyzer is the owner of them.
        ~ProbabilityAnalyzer() ;

        /// @returns Binary decision diagram used for calculations.
        Bdd *bdd_graph() { return bdd_graph_; }

        double CalculateTotalProbability(
                const Pdag::IndexMap<double> &p_vars)  final;

    private:
        /// Creates a new BDD for use by the analyzer.
        ///
        /// @param[in] fta  The fault tree analysis providing the root gate.
        ///
        /// @pre The function is called in the constructor only once.
        void CreateBdd(const FaultTreeAnalysis &fta) ;

        /// Calculates exact probability
        /// of a function graph represented by its root BDD vertex.
        ///
        /// @param[in] vertex  The root vertex of a function graph.
        /// @param[in] mark  A flag to mark traversed vertices.
        /// @param[in] p_vars  The probabilities of the variables
        ///                    mapped by their indices.
        ///
        /// @returns Probability value.
        ///
        /// @warning If a vertex is already marked with the input mark,
        ///          it will not be traversed and updated with a probability value.
        double CalculateProbability(const Bdd::VertexPtr &vertex, bool mark,
                                    const Pdag::IndexMap<double> &p_vars) ;

        Bdd *bdd_graph_;   ///< The main BDD graph for analysis.
        bool current_mark_;///< To keep track of BDD current mark.
        bool owner_;       ///< Indication that pointers are handles.
    };

    /// Specialization of probability analyzer using direct evaluation of the underlying pdag.
    /// The quantitative analysis is done using Monte Carlo sampling.
    template<>
    class ProbabilityAnalyzer<mc::DirectEval> : public ProbabilityAnalyzerBase {
    public:
        using TallyNode = mc::stats::TallyNode;
        using index_t = int; // pdag index uses 32bit ints, negated values mean compliments

        /// Constructs probability analyzer from a fault tree analyzer
        /// with the same algorithm.
        ///
        /// @tparam Algorithm  Fault tree analysis algorithm.
        ///
        /// @copydetails ProbabilityAnalysis::ProbabilityAnalysis
        template<class Algorithm>
        ProbabilityAnalyzer(const FaultTreeAnalyzer<Algorithm> *fta,
                            mef::MissionTime *mission_time)
            : ProbabilityAnalyzerBase(fta, mission_time) {
            LOG(DEBUG2) << "Using PDAG from a different FaultTreeAnalyzer<Algorithm> for ProbabilityAnalyzer";
        }

        /// Reuses PDAG structures from Fault tree analyzer.
        ///
        /// @copydetails ProbabilityAnalysis::ProbabilityAnalysis
        ///
        /// @pre PDAG is fully formed and used.
        ///
        /// @post FaultTreeAnalyzer is not corrupted
        ///       by use of its PDAG internals.
        ProbabilityAnalyzer(FaultTreeAnalyzer<mc::DirectEval> *fta,
                            mef::MissionTime *mission_time);

        /// Deletes the PDAG
        /// only if ProbabilityAnalyzer is the owner of them.
        ~ProbabilityAnalyzer()  override;

        double CalculateTotalProbability(const Pdag::IndexMap<double> &p_vars)  final;

        // double CalculateTotalProbability()  override;

        std::vector<std::pair<double, double>>
        CalculateProbabilityOverTime() override;

    protected:
        void ComputeTallies(bool converge_on_root_only = false);

        mc::stats::TallyNodeMap monitored_; // all the monitored/observed nodes. always collect tallies for these.

        static auto GatherGates(Pdag *pdag) -> std::unordered_set<index_t>;
        static auto GatherGates(Pdag *pdag, std::unordered_set<index_t> *nodes);

        static auto ObserveNodes(Pdag *pdag, mc::stats::TallyNodeMap &observing,
                                 const std::unordered_set<index_t> &to_observe, bool track_convergence,
                                 bool clear_stats) -> std::unordered_set<index_t>;

        void SanitizeWatchState();
    public:

        void observe(const std::unordered_set<index_t> &node_indices, const bool track_convergence = false, const bool clear_stats = false) {
            const auto will_observe = ObserveNodes(this->graph(), this->monitored_, node_indices, track_convergence, clear_stats);
            LOG(DEBUG3)<<"Observing new nodes for "<<(track_convergence?"convergence":"tallies")<<" :: "<<will_observe.size();
        }

        void observe(const std::vector<index_t> &node_indices, const bool track_convergence = false, const bool clear_stats = false) {
            observe(std::unordered_set<index_t>{node_indices.begin(), node_indices.end()}, track_convergence, clear_stats);
        }

        void observe(const std::set<index_t> &node_indices, const bool track_convergence = false, const bool clear_stats = false) {
            observe(std::unordered_set<index_t>{node_indices.begin(), node_indices.end()}, track_convergence, clear_stats);
        }

        [[nodiscard]] const mc::stats::TallyNodeMap& monitored() const { return monitored_; }
    };
}// namespace scram::core
