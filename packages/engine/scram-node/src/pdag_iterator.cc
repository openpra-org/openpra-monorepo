#include "pdag_iterator.h"

namespace scram::core {

PdagUpwardIterator::PdagUpwardIterator(const Pdag& pdag) {
    Initialize(pdag);
    Advance(); // Advance to the first node
}

PdagUpwardIterator::PdagUpwardIterator()
    : current_node_(nullptr) {
    // End iterator
}

void PdagUpwardIterator::Initialize(const Pdag& pdag) {
    // Collect all variables (basic events)
    // Since we cannot modify the PDAG (e.g., by marking nodes), we'll use our own visited set

    // Define a lambda to collect variables
    std::function<void(const GatePtr&)> collect_variables = [&](const GatePtr& gate) {
        if (!gate) return;

        int gate_index = gate->index();

        if (visited_nodes_.count(gate_index))
            return;
        visited_nodes_.insert(gate_index);

        // Process variable arguments
        for (const auto& arg : gate->args<Variable>()) {
            node_queue_.push(arg.second);
            visited_nodes_.insert(arg.second->index());
        }

        // Recursively process gate arguments
        for (const auto& arg : gate->args<Gate>()) {
            collect_variables(arg.second);
        }
    };

    visited_nodes_.clear();
    collect_variables(pdag.root_ptr());

    // Reset visited nodes for upward traversal
    visited_nodes_.clear();
}

PdagUpwardIterator::NodePtr PdagUpwardIterator::operator*() const {
    return current_node_;
}

PdagUpwardIterator& PdagUpwardIterator::operator++() {
    Advance();
    return *this;
}

bool PdagUpwardIterator::operator==(const PdagUpwardIterator& other) const {
    return current_node_ == other.current_node_;
}

bool PdagUpwardIterator::operator!=(const PdagUpwardIterator& other) const {
    return !(*this == other);
}

void PdagUpwardIterator::Advance() {
    while (!node_queue_.empty()) {
        NodePtr node = node_queue_.front();
        node_queue_.pop();

        int node_index = node->index();
        if (visited_nodes_.count(node_index)) {
            continue; // Skip already visited nodes
        }
        visited_nodes_.insert(node_index);

        current_node_ = node;

        // Enqueue parents for upward traversal
        for (const auto& parent_pair : node->parents()) {
            auto parent_weak = parent_pair.second;
            GatePtr parent = parent_weak.lock();

            if (parent && !visited_nodes_.count(parent->index())) {
                node_queue_.push(parent);
            }
        }

        // Return the current node
        return;
    }

    // If we reach here, traversal is complete
    current_node_ = nullptr;
}

} // namespace scram::core
