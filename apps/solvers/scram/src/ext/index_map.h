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
/// Non-zero based Index->Value map adapter on sequential containers.

#pragma once

#include <vector>
#include <algorithm>
#include <cassert>

namespace ext {

/// An adaptor map to shift zero-based containers to a different base.
///
/// @tparam BaseIndex  The starting index for the container adaptor.
/// @tparam T  A value type for the underlying container.
/// @tparam Sequence  A zero-based sequence container supporting operator[].
///
/// @post The adaptor only guarantees access adjustment for operator[].
///       The element access by other means are not adjusted, e.g., at().
template <std::size_t BaseIndex, typename T,
          template <typename...> class Sequence = std::vector>
class index_map : public Sequence<T> {
 public:
  using Sequence<T>::Sequence;

  /// @returns The reference to value at the index.
  ///
  /// @param[in] index  The BaseIndex-based index of the container adaptor.
  ///
  /// @pre index >= BaseIndex
  ///
  /// @{
  typename Sequence<T>::reference operator[](const std::size_t index) {
    return Sequence<T>::operator[](index - BaseIndex);
  }
  typename Sequence<T>::const_reference operator[](const std::size_t index) const {
    return Sequence<T>::operator[](index - BaseIndex);
  }
  /// @}
};

// -----------------------------------------------------------------------------
//  Owned Index Map – utility wrapper around `index_map` that provides explicit
//  lifecycle helpers for bulk (re)initialization and logical clearing without
//  affecting the underlying memory allocation.
// -----------------------------------------------------------------------------

/// An `index_map` variant that *owns* its storage and exposes convenience
/// methods to
/// 1. initialize the container with or without triggering a re-allocation, and
/// 2. clear or fully reset its storage.
///
/// These helpers are useful for performance-critical loops (e.g. Monte-Carlo
/// simulations) where frequent zeroing of large containers is required without
/// incurring repeated allocations.
///
/// @tparam BaseIndex  The starting (1-based) index expected by the caller.
/// @tparam T          Stored value type.
/// @tparam Sequence   Underlying sequential container template (defaults to
///                    `std::vector`). Must satisfy the usual sequence
///                    container requirements.
template <std::size_t BaseIndex, typename T,
          template <typename...> class Sequence = std::vector>
class owned_index_map : public index_map<BaseIndex, T, Sequence> {
 public:
  using base_type = index_map<BaseIndex, T, Sequence>;
  using base_type::base_type;  // Inherit constructors from `index_map`.

  /// Ensures the container holds exactly `n` elements, (re)allocating storage
  /// if required, and initialises each element to `value`.
  ///
  /// This is equivalent to `Sequence::assign(n, value)` but provided here for
  /// symmetry with `init_no_alloc`.
  void init(std::size_t n, const T &value = T()) {
    this->assign(n, value);
  }

  /// Re-initializes all existing elements to `value` **without** altering the
  /// container's size or capacity. The container must already be populated.
  ///
  /// An assertion is triggered in debug builds if the container is empty,
  /// signalling a potential misuse (e.g. caller expected prior allocation).
  void init_no_alloc(const T &value = T()) {
    assert(!this->empty() && "owned_index_map::init_no_alloc called on empty container — use init(n, value) instead.");
    std::fill(this->begin(), this->end(), value);
  }

  /// Logical clear: sets every element to `T{}` (default constructed) while
  /// preserving the current allocation.
  void clear_values() {
    std::fill(this->begin(), this->end(), T{});
  }

  /// Physical reset: releases all memory and leaves the container empty.
  void reset_storage() {
    base_type tmp;  // RVO-friendly swap trick to deallocate in O(1).
    this->swap(tmp);
  }
};

}  // namespace ext
