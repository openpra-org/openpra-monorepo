#pragma once
#include <cstddef>
#include "mc/event/node.h"

namespace scram::mc::scheduler {

template<typename bitpack_t_>
class iteration_shape {
public:
    explicit iteration_shape(const event::sample_shape<std::size_t> &shape = {}, const std::size_t trials = 0)   // canonical state = trials
        : shape_{shape}, trials_{trials} {}

    // ---- getters -------------------------------------------------------
    [[nodiscard]] std::size_t trials()     const  { return trials_; }
    [[nodiscard]] std::size_t iterations() const  {
        return (trials_ + trials_per_iteration() - 1) / trials_per_iteration();
    }

    // ---- setters -------------------------------------------------------
    void trials(const std::size_t t)  { trials_ = t; }
    void iterations(const std::size_t it)  {
        trials_ = it * trials_per_iteration();
    }

    // convenience operators
    iteration_shape& operator++()            { iterations(iterations() + 1); return *this; }
    iteration_shape& operator--()            { iterations(iterations() - 1); return *this; }
    iteration_shape& operator+=(const std::size_t i){ iterations(iterations() + i); return *this; }

    [[nodiscard]] std::size_t trials_per_iteration() const  {
        return shape_.num_bitpacks() * sizeof(bitpack_t_) * 8;
    }
private:


    event::sample_shape<std::size_t> shape_{};
    std::size_t                      trials_{};      // single source of truth
};

template <typename DataT>
struct tracked_pair {
    DataT current{};
    DataT target{};
};

template <typename DataT>
struct tracked_triplet {
    DataT current{};
    DataT target{};
    DataT remaining{};
};
}