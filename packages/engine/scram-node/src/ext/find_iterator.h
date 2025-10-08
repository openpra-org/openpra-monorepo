/*
 * Copyright (C) 2016-2018 Olzhas Rakhimov
 *
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
 */

/// @file
/// Convenience iterator adaptor to wrap find calls and results.

#pragma once

#include <utility>

namespace ext {

/// Iterator adaptor for indication of container ``find`` call results.
/// Conveniently wraps common calls after ``find`` into implicit Boolean value.
///
/// @tparam Iterator  Iterator type belonging to the container.
template <class Iterator>
class find_iterator : public Iterator {
 public:
  /// Initializes the iterator as the result of ``find()``.
  ///
  /// @param[in] it  The result of ``find`` call.
  /// @param[in] it_end  The sentinel iterator indicator ``not-found``.
  find_iterator(Iterator&& it, const Iterator& it_end)
      : Iterator(std::move(it)), found_(*this != it_end) {}

  /// @returns true if the iterator indicates that the item is found.
  explicit operator bool() { return found_; }

 private:
  bool found_;  ///< Indicator of the lookup result.
};

/// Wraps ``container::find()`` calls for convenient and efficient lookup
/// with ``find_iterator`` adaptor.
///
/// @tparam T  Container type supporting ``find()`` and ``end()`` calls.
/// @tparam Arg  The argument type to the ``find()`` call.
///
/// @param[in] container  The container to operate upon.
/// @param[in] arg  The argument to the ``find()`` function.
///
/// @returns find_iterator wrapping the resultant iterator.
template <class T, typename Arg>
auto find(T&& container, Arg&& arg) {
  auto it = container.find(std::forward<Arg>(arg));
  return find_iterator<decltype(it)>(std::move(it), container.end());
}

}  // namespace ext
