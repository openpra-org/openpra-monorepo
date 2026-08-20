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
/// Implementation of event tree analysis facilities.

#include "event_tree_analysis.h"

#include <sstream>
#include <type_traits>
#include <unordered_set>

#include "expression/numerical.h"
#include "ext/find_iterator.h"
#include "instruction.h"

namespace scram::core {

EventTreeAnalysis::EventTreeAnalysis(
    const mef::InitiatingEvent& initiating_event, const Settings& settings,
    mef::Context* context)
    : Analysis(settings),
      initiating_event_(initiating_event),
      context_(context) {}

namespace {  // The model cloning functions.

/// Clones the formula by applying the set-instructions.
///
/// @param[in] formula  The formula to be deep-cloned.
/// @param[in] set_instructions  The set instructions to change arguments.
/// @param[in] clones  The storage container for newly created clones.
///
/// @returns The deep-copy of the argument formula with new (changed) arguments.
std::unique_ptr<mef::Formula>
Clone(const mef::Formula& formula,
      const std::unordered_map<std::string, bool>& set_instructions,
      std::vector<std::unique_ptr<mef::Event>>* clones)  {
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
    std::vector<std::unique_ptr<mef::Event>>* event_register;
  } cloner{set_instructions, clones};

  mef::Formula::ArgSet arg_set;
  for (const mef::Formula::Arg& arg : formula.args())
    arg_set.Add(std::visit(cloner, arg.event), arg.complement);

  return std::make_unique<mef::Formula>(
      formula.connective(), std::move(arg_set), formula.min_number(),
      formula.max_number());
}

}  // namespace

namespace {  // Diagnostics helpers.

template <class>
struct AlwaysFalse : std::false_type {};

using GateVisitSet = std::unordered_set<const mef::Gate*>;

std::string DescribeFormulaInternal(const mef::Formula& formula,
                                    GateVisitSet* visited);

std::string DescribeEvent(const mef::Formula::ArgEvent& event,
                          GateVisitSet* visited) {
  return std::visit(
      [&](auto* ptr) -> std::string {
        using PtrType = std::decay_t<decltype(ptr)>;
        if (!ptr)
          return "<null>";
        if constexpr (std::is_same_v<PtrType, mef::Gate*>) {
          const std::string& label = ptr->name().empty() ? ptr->id() : ptr->name();
          if (!ptr->HasFormula())
            return label;
          if (visited->count(ptr) != 0)
            return label + "{...}";
          visited->insert(ptr);
          std::string nested = DescribeFormulaInternal(ptr->formula(), visited);
          visited->erase(ptr);
          return label + "->" + nested;
        } else if constexpr (std::is_same_v<PtrType, mef::BasicEvent*>) {
          return ptr->name().empty() ? ptr->id() : ptr->name();
        } else if constexpr (std::is_same_v<PtrType, mef::HouseEvent*>) {
          if (ptr == &mef::HouseEvent::kTrue)
            return "TRUE";
          if (ptr == &mef::HouseEvent::kFalse)
            return "FALSE";
          const std::string& label = ptr->name().empty() ? ptr->id() : ptr->name();
          return label + "=" + (ptr->state() ? "TRUE" : "FALSE");
        } else {
          static_assert(AlwaysFalse<PtrType>::value, "Unhandled ArgEvent type");
          return "<unsupported>";
        }
      },
      event);
}

std::string DescribeArg(const mef::Formula::Arg& arg, GateVisitSet* visited) {
  std::string value = DescribeEvent(arg.event, visited);
  if (arg.complement)
    return "NOT(" + value + ")";
  return value;
}

std::string DescribeFormulaInternal(const mef::Formula& formula,
                                    GateVisitSet* visited) {
  std::ostringstream oss;
  oss << mef::kConnectiveToString[static_cast<int>(formula.connective())];
  if (formula.connective() == mef::kAtleast ||
      formula.connective() == mef::kCardinality) {
    auto min = formula.min_number();
    auto max = formula.max_number();
    if (min || max) {
      oss << "[";
      bool wrote = false;
      if (min) {
        oss << "min=" << *min;
        wrote = true;
      }
      if (max) {
        if (wrote)
          oss << ",";
        oss << "max=" << *max;
      }
      oss << "]";
    }
  }
  oss << "(";
  bool first = true;
  for (const mef::Formula::Arg& arg : formula.args()) {
    if (!first)
      oss << ", ";
    first = false;
    oss << DescribeArg(arg, visited);
  }
  if (first)
    oss << "<empty>";
  oss << ")";
  return oss.str();
}

std::string DescribeFormula(const mef::Formula& formula) {
  GateVisitSet visited;
  return DescribeFormulaInternal(formula, &visited);
}

}  // namespace

EventTreeAnalysis::PathCollector::PathCollector(const PathCollector& other)
    : expressions(other.expressions), set_instructions(other.set_instructions) {
  for (const mef::FormulaPtr& formula : other.formulas)
    formulas.push_back(std::make_unique<mef::Formula>(*formula));
}

void EventTreeAnalysis::Analyze()  {
  // assert(initiating_event_.event_tree());
  int formula_id = 0;  // Enumeration of collected formulas turned into gates.
  // Creates an internal gate representing the formula.
  auto make_gate = [&formula_id, this](mef::FormulaPtr formula) {
    std::string gate_name = "___" + initiating_event_.name() + "__formula_" + std::to_string(formula_id++) + "__";
    auto gate = std::make_unique<mef::Gate>(gate_name);
    gate->formula(std::move(formula));
    auto* address = gate.get();
    events_.emplace_back(std::move(gate));
    return address;
  };

  SequenceCollector collector{initiating_event_, *context_};
  CollectSequences(initiating_event_.event_tree()->initial_state(), &collector);
  for (auto& sequence : collector.sequences) {
    auto gate = std::make_unique<mef::Gate>("__" + sequence.first->name());
    std::vector<mef::FormulaPtr> gate_formulas;
    std::vector<mef::Expression*> arg_expressions;
    for (PathCollector& path_collector : sequence.second) {
      if (path_collector.formulas.size() == 1) {
        gate_formulas.push_back(std::move(path_collector.formulas.front()));
      } else if (path_collector.formulas.size() > 1) {
        mef::Formula::ArgSet arg_set;
        for (mef::FormulaPtr& arg_formula : path_collector.formulas) {
            arg_set.Add(make_gate(std::move(arg_formula)));
        }
        gate_formulas.push_back(std::make_unique<mef::Formula>(mef::kAnd, std::move(arg_set)));
      }
      if (path_collector.expressions.size() == 1) {
        arg_expressions.push_back(path_collector.expressions.front());
      } else if (path_collector.expressions.size() > 1) {
        expressions_.push_back(std::make_unique<mef::Mul>(std::move(path_collector.expressions)));
        arg_expressions.push_back(expressions_.back().get());
      }
    }
    assert(gate_formulas.empty() || arg_expressions.empty());
    bool is_expression_only = !arg_expressions.empty();
    if (gate_formulas.size() == 1) {
      gate->formula(std::move(gate_formulas.front()));
    } else if (gate_formulas.size() > 1) {
      mef::Formula::ArgSet arg_set;
      for (mef::FormulaPtr& arg_formula : gate_formulas) {
          arg_set.Add(make_gate(std::move(arg_formula)));
      }
      gate->formula(std::make_unique<mef::Formula>(mef::kOr, std::move(arg_set)));
    } else if (!arg_expressions.empty()) {
      auto event = std::make_unique<mef::BasicEvent>("__" + sequence.first->name());
      if (arg_expressions.size() == 1) {
        event->expression(arg_expressions.front());
      } else if (arg_expressions.size() > 1) {
        expressions_.push_back(std::make_unique<mef::Add>(std::move(arg_expressions)));
        event->expression(expressions_.back().get());
      }
      gate->formula(std::make_unique<mef::Formula>(mef::kNull, mef::Formula::ArgSet{event.get()}));
      events_.push_back(std::move(event));
    } else {
      gate->formula(std::make_unique<mef::Formula>(mef::kNull, mef::Formula::ArgSet{&mef::HouseEvent::kTrue}));
    }
    sequences_.push_back({*sequence.first, std::move(gate), is_expression_only});
  }
}

void EventTreeAnalysis::CollectSequences(const mef::Branch& initial_state,
                                         SequenceCollector* result)  {
  struct Collector {
    class Visitor : public mef::InstructionVisitor {
     public:
      explicit Visitor(Collector* collector) : collector_(*collector) {}

      void Visit(const mef::SetHouseEvent* house_event) override {
        collector_.path_collector_.set_instructions[house_event->name()] =
            house_event->state();
      }

      void Visit(const mef::Link* link) override {
        is_linked_ = true;
        Collector continue_connector(collector_);
        auto save = std::move(collector_.result_->context.functional_events);
        continue_connector(&link->event_tree().initial_state());
        collector_.result_->context.functional_events = std::move(save);
      }

      void Visit(const mef::CollectFormula* collect_formula) override {
        // clang-format off
        collector_.path_collector_.formulas.push_back(
            core::Clone(collect_formula->formula(),
                        collector_.path_collector_.set_instructions,
                        collector_.clones_));
        // clang-format on
      }

      void Visit(const mef::CollectExpression* collect_expression) override {
        collector_.path_collector_.expressions.push_back(
            &collect_expression->expression());
      }

      bool is_linked() const { return is_linked_; }

     private:
      Collector& collector_;
      bool is_linked_ = false;  /// Indicate that sequences not be registered.
    };

    void operator()(const mef::Sequence* sequence) {
      Visitor visitor(this);
      for (const mef::Instruction* instruction : sequence->instructions())
        instruction->Accept(&visitor);
      if (!visitor.is_linked())
        result_->sequences[sequence].push_back(std::move(path_collector_));
    }

    void operator()(const mef::Fork* fork) const {
      const std::string& name = fork->functional_event().name();
      assert(result_->context.functional_events.count(name) == false);
      std::string& state = result_->context.functional_events[name];
      assert(state.empty());
      for (const mef::Path& fork_path : fork->paths()) {
        state = fork_path.state();
        // clang-format off
        Collector(*this)(&fork_path);  // NOLINT(runtime/explicit)
        // clang-format on
      }
      result_->context.functional_events.erase(name);
    }

    void operator()(const mef::Branch* branch) {
      Visitor visitor(this);
      for (const mef::Instruction* instruction : branch->instructions())
        instruction->Accept(&visitor);

      std::visit(*this, branch->target());
    }

    SequenceCollector* result_;
    std::vector<std::unique_ptr<mef::Event>>* clones_;
    PathCollector path_collector_;
  };
  context_->functional_events.clear();
  context_->initiating_event = initiating_event_.name();
  Collector{result, &events_}(&initial_state);  // NOLINT(whitespace/braces)
}

}  // namespace scram::core
