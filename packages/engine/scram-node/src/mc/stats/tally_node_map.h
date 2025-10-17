#pragma once

#include <unordered_map>
#include <memory>
#include <iterator>

#include "tally_node.h"

namespace scram::mc::stats {

/// A container that owns a single `std::unordered_map<int, TallyNode>` but can
/// be interacted with as if it were **two** separate maps – one from index to
/// `tally` and one from index to `std::shared_ptr<core::Node>` – **without any
/// copies**.  The proxy maps hand out references directly into the underlying
/// `TallyNode` objects so modifications stay in sync automatically.
class TallyNodeMap {
  using inner_map_t = std::unordered_map<int, TallyNode>;
  inner_map_t data_;

  //---------------------------------------------------------------------
  //  Iterator adaptor that projects (key -> member) without copying.
  //---------------------------------------------------------------------
  template <class WrappedIt, class MemberPtr>
  class projecting_iterator {
    WrappedIt it_;
    MemberPtr member_; // pointer to data member inside TallyNode
   public:
    using difference_type   = std::ptrdiff_t;
    using value_type        = std::pair<const int, decltype(((TallyNode*)nullptr)->*member_)>;
    using reference         = value_type;
    using iterator_category = std::forward_iterator_tag;

    projecting_iterator() = default;
    projecting_iterator(WrappedIt it, MemberPtr m): it_(it), member_(m) {}

    reference operator*() const {
      return { it_->first, it_->second.*member_ };
    }
    projecting_iterator& operator++() { ++it_; return *this; }
    projecting_iterator operator++(int) { auto tmp=*this; ++(*this); return tmp; }
    friend bool operator==(const projecting_iterator &a, const projecting_iterator &b) { return a.it_==b.it_; }
    friend bool operator!=(const projecting_iterator &a, const projecting_iterator &b) { return !(a==b); }
  };

  //---------------------------------------------------------------------
  //  Proxy map façade (minimal interface required by our code base)
  //---------------------------------------------------------------------
  template <class ValueMemberPtr, class AliasType>
  class proxy_map {
    TallyNodeMap *owner_;
    ValueMemberPtr member_;
   public:
    using key_type = int;
    using mapped_type = AliasType;
    using value_type = std::pair<const key_type, mapped_type>;

    using iterator = projecting_iterator<typename inner_map_t::iterator, ValueMemberPtr>;
    using const_iterator = projecting_iterator<typename inner_map_t::const_iterator, ValueMemberPtr>;

    proxy_map(TallyNodeMap *o, ValueMemberPtr m): owner_(o), member_(m) {}

    // Iteration
    iterator begin() { return { owner_->data_.begin(), member_ }; }
    iterator end()   { return { owner_->data_.end(),   member_ }; }
    const_iterator begin() const { return { owner_->data_.cbegin(), member_ }; }
    const_iterator end()   const { return { owner_->data_.cend(),   member_ }; }

    // Lookup / insertion – create default TallyNode if missing
    mapped_type &operator[](key_type k) {
      return owner_->data_[k].*member_;
    }

    mapped_type &at(key_type k) {
      return owner_->data_.at(k).*member_;
    }

    const mapped_type &at(key_type k) const {
      return owner_->data_.at(k).*member_;
    }

    bool contains(key_type k) const { return owner_->data_.contains(k); }

    // Size helpers
    std::size_t size() const noexcept { return owner_->data_.size(); }
    bool empty() const noexcept { return owner_->data_.empty(); }
  };

 public:
  using tally_map  = proxy_map<decltype(&TallyNode::tally_stats), tally>;
  using node_map   = proxy_map<decltype(&TallyNode::node), std::shared_ptr<core::Node>>;

  // Accessors for proxy maps -------------------------------------------------
  tally_map tallies()      { return tally_map(this, &TallyNode::tally_stats); }
  node_map  nodes()        { return node_map(this, &TallyNode::node); }
  const tally_map tallies() const { return tally_map(const_cast<TallyNodeMap*>(this), &TallyNode::tally_stats); }
  const node_map  nodes()   const { return node_map(const_cast<TallyNodeMap*>(this), &TallyNode::node); }

  //--------------------------------------------------------------------
  // Direct access to the underlying map when absolutely necessary
  //--------------------------------------------------------------------
  inner_map_t &raw()             { return data_; }
  const inner_map_t &raw() const { return data_; }

  // Convenience container-like API so that TallyNodeMap can be used
  // wherever an `std::unordered_map<int, TallyNode>` was expected.
  //------------------------------------------------------------------
  using iterator = inner_map_t::iterator;
  using const_iterator = inner_map_t::const_iterator;

  iterator begin() noexcept { return data_.begin(); }
  iterator end()   noexcept { return data_.end();   }
  const_iterator begin() const noexcept { return data_.cbegin(); }
  const_iterator end()   const noexcept { return data_.cend();   }
  const_iterator cbegin() const noexcept { return data_.cbegin(); }
  const_iterator cend()   const noexcept { return data_.cend();   }

  std::size_t size() const noexcept { return data_.size(); }
  bool empty() const noexcept { return data_.empty(); }

  bool contains(int key) const { return data_.contains(key); }

  // direct access to full TallyNode record
  TallyNode &operator[](int key) { return data_[key]; }
  const TallyNode &at(int key) const { return data_.at(key); }

  template <typename TN>
  auto insert_or_assign(int key, TN &&value) {
      return data_.insert_or_assign(key, std::forward<TN>(value));
  }
};

} // namespace scram::mc::stats 