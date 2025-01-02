#pragma once

#include <memory>
#include <unordered_set>
#include <queue>

#include "pdag.h"

namespace scram::core {

    class PdagUpwardIterator {
    public:
        using NodePtr = std::shared_ptr<Node>;
        using GatePtr = std::shared_ptr<Gate>;
        using VariablePtr = std::shared_ptr<Variable>;

        // Type aliases for standard iterator interface
        using iterator_category = std::input_iterator_tag;
        using value_type = NodePtr;
        using difference_type = std::ptrdiff_t;
        using pointer = NodePtr;
        using reference = NodePtr;

        // Constructor
        explicit PdagUpwardIterator(const Pdag& pdag);

        // End iterator constructor
        PdagUpwardIterator();

        // Dereference operator
        NodePtr operator*() const;

        // Pre-increment operator
        PdagUpwardIterator& operator++();

        // Equality operators
        bool operator==(const PdagUpwardIterator& other) const;
        bool operator!=(const PdagUpwardIterator& other) const;

    private:
        // Internal traversal state
        std::queue<NodePtr> node_queue_;
        std::unordered_set<int> visited_nodes_;
        NodePtr current_node_;

        // Helper methods
        void Initialize(const Pdag& pdag);
        void Advance();
    };

} // namespace scram::core