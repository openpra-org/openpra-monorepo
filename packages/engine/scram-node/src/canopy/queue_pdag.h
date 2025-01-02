
#pragma once

#include <unordered_map>
#include <AdaptiveCpp/SYCL/sycl.hpp>

#include "../pdag.h"
#include "../event.h"

// Map from node index to sycl::event
std::unordered_map<int, sycl::event> node_events;

void EnqueueTasks(const std::vector<scram::core::NodePtr>& sorted_nodes,
                  sycl::queue& queue,
                  const scram::core::Pdag& pdag) {
    for (const scram::core::NodePtr& node : sorted_nodes) {
        int node_index = node->index();

        if (auto variable = std::dynamic_pointer_cast<scram::core::Variable>(node)) {
            // Access the basic event associated with this variable
            const scram::mef::BasicEvent* basic_event = pdag.basic_events()[node_index];
            double probability = basic_event->p(); // Assuming this method exists

            // Create a SYCL task for the variable
            sycl::event e = queue.submit([&](sycl::handler& cgh) {
                cgh.single_task<class kernel>([=]() {
                    // Store the probability in some data structure or perform computations
                    // This is placeholder code
                });
            });

            // Store the event
            node_events[node_index] = e;
        }
        else if (auto gate = std::dynamic_pointer_cast<scram::core::Gate>(node)) {
            // Collect dependency events from arguments
            std::vector<sycl::event> dependencies;

            for (const auto& arg_pair : gate->args<scram::core::Gate>()) {
                int arg_index = arg_pair.second->index();
                dependencies.push_back(node_events[arg_index]);
            }
            for (const auto& arg_pair : gate->args<scram::core::Variable>()) {
                int arg_index = arg_pair.second->index();
                dependencies.push_back(node_events[arg_index]);
            }

            // Create a SYCL task for the gate
            sycl::event e = queue.submit([&](sycl::handler& cgh) {
                // Specify dependencies
                cgh.depends_on(dependencies);

                cgh.single_task<class kernerl>([=]() {
                    // Read results from arguments and compute gate's output
                    // This is placeholder code
                });
            });

            // Store the event
            node_events[node_index] = e;
        }
        else if (auto constant = std::dynamic_pointer_cast<scram::core::Constant>(node)) {
            // If constants require processing, handle them here
            sycl::event e = queue.submit([&](sycl::handler& cgh) {
                cgh.single_task<class kernel>([=]() {
                    // Process the constant if necessary
                });
            });

            // Store the event
            node_events[node_index] = e;
        }
    }
}