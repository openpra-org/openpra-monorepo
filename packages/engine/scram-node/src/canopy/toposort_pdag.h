//
// Created by earthperson on 1/2/25.
//

#pragma once


#include <memory>
#include <pdag.h>
#include <vector>
#include <unordered_set>

// Alias for 'std::shared_ptr<Node>'
using NodePtr = std::shared_ptr<scram::core::Node>;

// Function to perform post-order traversal and collect nodes
inline void TopologicalSortCollectNodes(const NodePtr& node,
                                 std::unordered_set<int>& visited_nodes,
                                 std::vector<NodePtr>& sorted_nodes) {
    int node_index = node->index();
    if (visited_nodes.count(node_index))
        return;
    visited_nodes.insert(node_index);

    if (auto gate = std::dynamic_pointer_cast<scram::core::Gate>(node)) {
        // Recursively process gate arguments
        for (const auto& arg_pair : gate->args<scram::core::Gate>()) {
            TopologicalSortCollectNodes(arg_pair.second, visited_nodes, sorted_nodes);
        }
        for (const auto& arg_pair : gate->args<scram::core::Variable>()) {
            TopologicalSortCollectNodes(arg_pair.second, visited_nodes, sorted_nodes);
        }
    }

    // After processing all arguments, add the node to the sorted list
    sorted_nodes.push_back(node);
}

inline void GetTopologicallySortedNodes(const scram::core::Pdag& pdag, std::vector<NodePtr>& sorted_nodes) {
    std::unordered_set<int> visited_nodes;
    TopologicalSortCollectNodes(pdag.root_ptr(), visited_nodes, sorted_nodes);
}
