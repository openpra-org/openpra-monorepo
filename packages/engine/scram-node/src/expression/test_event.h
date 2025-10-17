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
/// Event tree analysis expressions to test functional and initiating events.

#pragma once

#include <string>
#include <unordered_map>

#include "src/expression.h"

namespace scram::mef {

/// The context for test-event expressions.
struct Context {
  std::string initiating_event;  ///< The name of the initiating event.
  /// The functional event names and states.
  std::unordered_map<std::string, std::string> functional_events;
};

/// The abstract base class for non-deviate test-event expressions.
class TestEvent : public Expression {
 public:
  /// @param[in] context  The event-tree walk context.
  explicit TestEvent(const Context* context) : context_(*context) {}

  Interval interval()  override { return Interval::closed(0, 1); }
  bool IsDeviate()  override { return false; }

 protected:
  const Context& context_;  ///< The evaluation context.

 private:
  double DoSample()  override { return false; }
};

/// Upon event-tree walk, tests whether an initiating event has occurred.
class TestInitiatingEvent : public TestEvent {
 public:
  /// @copydoc TestEvent::TestEvent
  /// @param[in] name  The public element name of the initiating event to test.
  TestInitiatingEvent(std::string name, const Context* context)
      : TestEvent(context), name_(std::move(name)) {}

  /// @returns true if the initiating event has occurred in the event-tree walk.
  double value()  override;

 private:
  std::string name_;  ///< The name of the initiating event.
};

/// Upon event-tree walk, tests whether a functional event has occurred.
class TestFunctionalEvent : public TestEvent {
 public:
  /// @copydoc TestEvent::TestEvent
  /// @param[in] name  The public element name of the functional event to test.
  /// @param[in] state  One of the valid states of the functional event.
  TestFunctionalEvent(std::string name, std::string state,
                      const Context* context)
      : TestEvent(context), name_(std::move(name)), state_(std::move(state)) {}

  /// @returns true if the functional event has occurred and is in given state.
  double value()  override;

 private:
  std::string name_;  ///< The name of the functional event.
  std::string state_;  ///< The state of the functional event.
};

}  // namespace scram::mef
