#include "event_tree_analysis.h"

#include <cassert>
#include <cmath>
#include <unordered_map>
#include <variant>

#include "expression/numerical.h"
#include "ext/find_iterator.h"
#include "instruction.h"

namespace scram::core {

EventTreeAnalysis::EventTreeAnalysis(const mef::InitiatingEvent& initiating_event,const Settings& settings, mef::Context* context)
    : Analysis(settings), initiating_event_(initiating_event), context_(context) {}

/* -------------------------------------------------------------------------- */
/*  Helper: recursively determine the failure-probability of a gate           */
/* -------------------------------------------------------------------------- */
namespace {

double EvaluateGateProbability(const mef::Gate& gate,
                               std::unordered_map<const mef::Gate*, double>& memo) noexcept
{
  if (auto it = memo.find(&gate); it != memo.end())
    return it->second;

  const mef::Formula& f = gate.formula();

  /* ----- local lambdas --------------------------------------------------- */
  /* probability of a single literal (taking complement into account) */
  auto literal_prob = [&](const mef::Formula::Arg& lit,
                          auto&& self) -> double {
    double p = std::visit(
        [&](auto* ptr) -> double {
          using T = std::decay_t<decltype(*ptr)>;
          if constexpr (std::is_same_v<T, mef::BasicEvent>)
            return ptr->p();
          else if constexpr (std::is_same_v<T, mef::HouseEvent>)
            return ptr->state() ? 1.0 : 0.0;
          else /* Gate */
            return EvaluateGateProbability(*ptr, memo);
        },
        lit.event);
    return lit.complement ? 1.0 - p : p;
  };

  /* recursive evaluation of a formula                                       */
  std::function<double(const mef::Formula&)> eval = [&](const mef::Formula& g) {
    switch (g.connective()) {
      case mef::kNull:
        assert(g.args().size() == 1);
        return literal_prob(g.args().front(), eval);

      case mef::kAnd: {
        double prod = 1.0;
        for (const auto& a : g.args())
          prod *= literal_prob(a, eval);
        return prod;
      }

      case mef::kOr: {
        double q = 1.0;
        for (const auto& a : g.args())
          q *= 1.0 - literal_prob(a, eval);
        return 1.0 - q;
      }

      case mef::kNot:
        assert(g.args().size() == 1);
        return 1.0 - literal_prob(g.args().front(), eval);

      case mef::kXor: {
        double sum = 0.0;
        for (const auto& a : g.args()) {
          double p_i = literal_prob(a, eval);
          double prod = 1.0;
          for (const auto& b : g.args())
            if (&b != &a) prod *= 1.0 - literal_prob(b, eval);
          sum += p_i * prod;
        }
        return sum;
      }
      default:
        return 0.0;
    }
  };

  double p = eval(f);
  memo[&gate] = p;
  return p;
}

}

/* -------------------------------------------------------------------------- */
/*  Clone helpers                                               */
/* -------------------------------------------------------------------------- */
namespace {  // The model cloning functions.

std::unique_ptr<mef::Formula>
Clone(const mef::Formula& formula,
      const std::unordered_map<std::string, bool>& set_instructions,
      std::vector<std::unique_ptr<mef::Event>>* clones) noexcept {
  struct {
    mef::Formula::ArgEvent operator()(mef::BasicEvent* arg) { return arg; }
    mef::Formula::ArgEvent operator()(mef::HouseEvent* arg) {
      if (auto it = ext::find(set_house, arg->id())) {
        if (it->second == arg->state())
          return arg;
        auto clone = std::make_unique<mef::HouseEvent>(
            arg->name(), "__clone__." + arg->id(),
            mef::RoleSpecifier::kPrivate);
        clone->state(it->second);
        auto* ptr = clone.get();
        event_register->emplace_back(std::move(clone));
        return ptr;
      }
      return arg;
    }
    mef::Formula::ArgEvent operator()(mef::Gate* arg) {
      if (set_house.empty())
        return arg;
      auto clone = std::make_unique<mef::Gate>(
          arg->name(), "__clone__." + arg->id(), mef::RoleSpecifier::kPrivate);
      clone->formula(Clone(arg->formula(), set_house, event_register));
      auto* ptr = clone.get();
      event_register->emplace_back(std::move(clone));
      return ptr;
    }

    const std::unordered_map<std::string, bool>& set_house;
    std::vector<std::unique_ptr<mef::Event>>*     event_register;
  } cloner{set_instructions, clones};

  mef::Formula::ArgSet arg_set;
  for (const mef::Formula::Arg& arg : formula.args())
    arg_set.Add(std::visit(cloner, arg.event), arg.complement);

  return std::make_unique<mef::Formula>(
      formula.connective(), std::move(arg_set), formula.min_number(),
      formula.max_number());
}

}

/* -------------------------------------------------------------------------- */
/*  PathCollector copy-ctor                                                   */
/* -------------------------------------------------------------------------- */
EventTreeAnalysis::PathCollector::PathCollector(const PathCollector& other)
    : expressions(other.expressions),
      set_instructions(other.set_instructions) {
  for (const mef::FormulaPtr& f : other.formulas)
    formulas.push_back(std::make_unique<mef::Formula>(*f));
}

/* -------------------------------------------------------------------------- */
/*  Analyse                                                                   */
/* -------------------------------------------------------------------------- */
void EventTreeAnalysis::Analyze() noexcept {
  assert(initiating_event_.event_tree());

  int formula_id = 0;
  auto make_gate = [&formula_id, this](mef::FormulaPtr f) {
    std::string gate_name = "___" + initiating_event_.name() +
                            "__formula_" + std::to_string(formula_id++) + "__";
    auto gate = std::make_unique<mef::Gate>(gate_name);
    gate->formula(std::move(f));
    auto* ptr = gate.get();
    events_.push_back(std::move(gate));
    return ptr;
  };

  SequenceCollector collector{initiating_event_, *context_};
  CollectSequences(initiating_event_.event_tree()->initial_state(), &collector);

  for (auto& sequence : collector.sequences) {
    auto gate = std::make_unique<mef::Gate>("__" + sequence.first->name());

    std::vector<mef::FormulaPtr>  gate_formulas;
    std::vector<mef::Expression*> arg_expressions;

    for (PathCollector& pc : sequence.second) {
      if (pc.formulas.size() == 1)
        gate_formulas.push_back(std::move(pc.formulas.front()));
      else if (!pc.formulas.empty()) {
        mef::Formula::ArgSet args;
        for (auto& f : pc.formulas) args.Add(make_gate(std::move(f)));
        gate_formulas.push_back(
            std::make_unique<mef::Formula>(mef::kAnd, std::move(args)));
      }

      if (pc.expressions.size() == 1)
        arg_expressions.push_back(pc.expressions.front());
      else if (pc.expressions.size() > 1) {
        expressions_.push_back(
            std::make_unique<mef::Mul>(std::move(pc.expressions)));
        arg_expressions.push_back(expressions_.back().get());
      }
    }

    bool expression_only = !arg_expressions.empty();

    if (gate_formulas.size() == 1)
      gate->formula(std::move(gate_formulas.front()));
    else if (gate_formulas.size() > 1) {
      mef::Formula::ArgSet args;
      for (auto& f : gate_formulas) args.Add(make_gate(std::move(f)));
      gate->formula(
          std::make_unique<mef::Formula>(mef::kOr, std::move(args)));
    } else if (!arg_expressions.empty()) {
      auto event = std::make_unique<mef::BasicEvent>("__" + sequence.first->name());
      if (arg_expressions.size() == 1)
        event->expression(arg_expressions.front());
      else {
        expressions_.push_back(
            std::make_unique<mef::Add>(std::move(arg_expressions)));
        event->expression(expressions_.back().get());
      }
      gate->formula(std::make_unique<mef::Formula>(
          mef::kNull, mef::Formula::ArgSet{event.get()}));
      events_.push_back(std::move(event));
    } else {
      gate->formula(std::make_unique<mef::Formula>(
          mef::kNull, mef::Formula::ArgSet{&mef::HouseEvent::kTrue}));
    }

    /* unconditional sequence probability (initiator * path) -------------- */
    double seq_p = 1.0;
    for (PathCollector& pc : sequence.second)
      for (mef::Expression* e : pc.expressions) seq_p *= e->value();

    sequences_.push_back({*sequence.first, std::move(gate),
                          expression_only, seq_p});
  }
}

/* -------------------------------------------------------------------------- */
/*  Collect sequences                                                         */
/* -------------------------------------------------------------------------- */
void EventTreeAnalysis::CollectSequences(const mef::Branch& initial_state,
                                         SequenceCollector* result) noexcept {
  struct Collector {
    std::string current_fe_;
    Collector(SequenceCollector* res,
              std::vector<std::unique_ptr<mef::Event>>* clones,
              std::vector<std::unique_ptr<mef::Expression>>* expr_owner)
        : result_(res),
          clones_(clones),
          expressions_owner_(expr_owner) {}

    /* ---------------------- Instruction visitor -------------------------- */
    class Visitor : public mef::InstructionVisitor {
     public:
      explicit Visitor(Collector* c) : collector_(*c) {}

      void Visit(const mef::SetHouseEvent* he) override {
        collector_.path_collector_.set_instructions[he->name()] = he->state();
      }

      void Visit(const mef::Link* link) override {
        linked_ = true;
        Collector cont(collector_);
        auto save = std::move(collector_.result_->context.functional_events);
        cont(&link->event_tree().initial_state());
        collector_.result_->context.functional_events = std::move(save);
      }

      void Visit(const mef::CollectFormula* cf) override {
        const mef::Formula& f = cf->formula();
        if (f.connective() != mef::kNull || f.args().size() != 1) return;

        mef::Gate* gate = nullptr;
        if (std::holds_alternative<mef::Gate*>(f.args().front().event))
          gate = std::get<mef::Gate*>(f.args().front().event);
        if (!gate || !gate->HasFormula()) return;

        static std::unordered_map<const mef::Gate*, double> memo;
        double p_fail = EvaluateGateProbability(*gate, memo);

        std::string state = "bypass";
        if (!collector_.current_fe_.empty()) {
          auto it = collector_.result_->context.functional_events
                        .find(collector_.current_fe_);
          if (it != collector_.result_->context.functional_events.end())
            state = it->second;
        }

        double val = (state == "failure") ? p_fail
                    : (state == "success") ? 1.0 - p_fail
                                           : 1.0;

        auto expr = std::make_unique<mef::ConstantExpression>(val);
        mef::Expression* ptr = expr.get();
        collector_.expressions_owner_->push_back(std::move(expr));
        collector_.path_collector_.expressions.push_back(ptr);
      }

      void Visit(const mef::CollectExpression* ce) override {
        collector_.path_collector_.expressions.push_back(&ce->expression());
      }

      bool linked() const { return linked_; }

     private:
      Collector& collector_;
      bool       linked_ = false;
    };

    /* dispatcher */
    void operator()(const mef::Sequence* seq) {
      Visitor vis(this);
      for (const mef::Instruction* ins : seq->instructions()) ins->Accept(&vis);
      if (!vis.linked())
        result_->sequences[seq].push_back(std::move(path_collector_));
    }

    void operator()(const mef::Fork* fork) const {
      const std::string& fe_name = fork->functional_event().name();
      assert(result_->context.functional_events.count(fe_name) == 0);

      std::string& state = result_->context.functional_events[fe_name];
      assert(state.empty());

      for (const mef::Path& p : fork->paths()) {
        state = p.state();

        Collector child(*this);
        child.current_fe_ = fe_name;
        child(&p);
      }
      result_->context.functional_events.erase(fe_name);
    }

    void operator()(const mef::Branch* br) {
      Visitor vis(this);
      for (const mef::Instruction* ins : br->instructions()) ins->Accept(&vis);
      std::visit(*this, br->target());
    }

    /* members */
    SequenceCollector*                                     result_;
    std::vector<std::unique_ptr<mef::Event>>*              clones_;
    std::vector<std::unique_ptr<mef::Expression>>*         expressions_owner_;
    PathCollector                                          path_collector_;
  };

  context_->functional_events.clear();
  context_->initiating_event = initiating_event_.name();
  Collector{result, &events_, &expressions_}(&initial_state);
}

}  // namespace scram::core
