#include "bncore/graph/graph.hpp"
#include "bncore/inference/compiler.hpp"
#include "bncore/inference/engine.hpp"

#include <cstddef>
#include <iomanip>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

namespace {

using bncore::Graph;
using bncore::NodeId;

struct SoftEvidence {
  NodeId node;
  std::vector<double> values;
};

void emit_case(const std::string &name, Graph &graph, std::size_t batch_size,
               const std::vector<int> &evidence,
               const std::vector<NodeId> &queries,
               const std::vector<SoftEvidence> &shared_soft = {},
               const std::vector<SoftEvidence> &batched_soft = {}) {
  graph.validate_cpts();
  auto tree = bncore::JunctionTreeCompiler::compile(graph, "min_fill");
  bncore::BatchExecutionEngine engine(*tree, 1, batch_size);
  engine.set_dsep_enabled(false);

  for (const auto &soft : shared_soft) {
    engine.set_soft_evidence(soft.node, soft.values.data(), soft.values.size());
  }
  for (const auto &soft : batched_soft) {
    engine.set_soft_evidence_matrix(soft.node, soft.values.data(),
                                    soft.values.size());
  }

  std::vector<std::size_t> query_values(queries.begin(), queries.end());
  std::vector<std::size_t> offsets(queries.size() + 1, 0);
  for (std::size_t i = 0; i < queries.size(); ++i) {
    offsets[i + 1] = offsets[i] + graph.get_variable(queries[i]).num_states();
  }
  const std::size_t row_width = offsets.back();
  std::vector<double> output(batch_size * row_width, 0.0);
  engine.evaluate_multi(evidence.data(), batch_size, graph.num_variables(),
                        query_values.data(), query_values.size(), offsets.data(),
                        output.data());

  for (std::size_t batch = 0; batch < batch_size; ++batch) {
    for (std::size_t query = 0; query < queries.size(); ++query) {
      const std::size_t cardinality =
          graph.get_variable(queries[query]).num_states();
      for (std::size_t state = 0; state < cardinality; ++state) {
        const double value =
            output[batch * row_width + offsets[query] + state];
        std::cout << name << '\t' << batch << '\t' << queries[query] << '\t'
                  << state << '\t' << std::setprecision(17) << value << '\n';
      }
    }
  }
}

Graph make_chain() {
  Graph graph;
  const auto a = graph.add_variable("A", {"false", "true"});
  const auto b = graph.add_variable("B", {"low", "medium", "high"});
  const auto c = graph.add_variable("C", {"false", "true"});
  graph.add_edge(a, b);
  graph.add_edge(b, c);
  graph.set_cpt(a, {0.55, 0.45});
  graph.set_cpt(b, {0.7, 0.2, 0.1, 0.1, 0.3, 0.6});
  graph.set_cpt(c, {0.95, 0.05, 0.6, 0.4, 0.2, 0.8});
  return graph;
}

void chain_cases() {
  {
    auto graph = make_chain();
    emit_case("chain_prior", graph, 1, {-1, -1, -1}, {0, 1, 2});
  }
  {
    auto graph = make_chain();
    emit_case("chain_hard_batch", graph, 4,
              {-1, -1, -1, -1, -1, 1, -1, 2, -1, 1, -1, 0},
              {0, 1, 2});
  }
  {
    auto graph = make_chain();
    emit_case("chain_soft_shared", graph, 2,
              {-1, -1, -1, 0, -1, -1}, {0, 2},
              {{1, {0.0, 1.0, 1.0}}, {2, {0.25, 1.5}}});
  }
  {
    auto graph = make_chain();
    emit_case("chain_soft_batched_leaf", graph, 3,
              {-1, -1, -1, -1, -1, -1, -1, -1, -1}, {0, 1, 2}, {},
              {{2, {1.0, 0.2, 0.2, 1.0, 0.5, 0.5}}});
  }
  {
    auto graph = make_chain();
    emit_case("chain_soft_batched_separator", graph, 3,
              {-1, -1, -1, -1, -1, -1, -1, -1, -1}, {0, 1, 2}, {},
              {{1, {1.0, 0.2, 0.1, 0.1, 1.0, 0.1, 0.1, 0.2, 1.0}}});
  }
}

void batched_cpt_case() {
  Graph graph;
  const auto a = graph.add_variable("A", {"false", "true"});
  const auto b = graph.add_variable("B", {"false", "true"});
  const auto c = graph.add_variable("C", {"low", "medium", "high"});
  graph.add_edge(a, b);
  graph.add_edge(b, c);
  graph.set_cpt(a, {0.4, 0.6});
  // Axes [A, B, batch], B=3.
  graph.set_cpt(b, {0.9, 0.6, 0.2, 0.1, 0.4, 0.8,
                    0.3, 0.5, 0.7, 0.7, 0.5, 0.3});
  graph.set_cpt(c, {0.5, 0.3, 0.2, 0.1, 0.2, 0.7});
  emit_case("batched_cpt", graph, 3,
            {-1, -1, -1, -1, 1, -1, -1, -1, 2}, {0, 1, 2});
}

void parent_order_case() {
  Graph graph;
  const auto a = graph.add_variable("A", {"false", "true"});
  const auto b = graph.add_variable("B", {"false", "true"});
  const auto c = graph.add_variable("C", {"false", "true"});
  graph.add_edge(b, c);
  graph.add_edge(a, c);
  graph.set_cpt(a, {0.5, 0.5});
  graph.set_cpt(b, {0.5, 0.5});
  // Axes [B, A, C], deliberately different from node-ID order.
  graph.set_cpt(c, {0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4});
  emit_case("parent_order", graph, 4,
            {0, 0, -1, 1, 0, -1, 0, 1, -1, 1, 1, -1}, {2});
}

} // namespace

int main() {
  chain_cases();
  batched_cpt_case();
  parent_order_case();
  return 0;
}
