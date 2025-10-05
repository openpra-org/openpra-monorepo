#pragma once
#include <cstdint>

#include "mc/prng/state128.h"

namespace scram::mc::prng::philox {

[[gnu::always_inline]] static inline void round(state128 &counters, Vec2<uint32_t> &key) {
    static constexpr Vec2<uint32_t> PHILOX_M4x32 = {
        .A = 0xD2511F53u,
        .B = 0xCD9E8D57u,
    };
    // Split into high and low parts
    Vec2<uint32_t> hi{};

    const Vec2<uint32_t> lo = {
        .A = prng::mulhilo(PHILOX_M4x32.A, counters.x[0], &hi.A),
        .B = prng::mulhilo(PHILOX_M4x32.B, counters.x[2], &hi.B),
    };

    // Mix in the key
    counters.x[0] = hi.B ^ counters.x[1] ^ key.A;
    counters.x[1] = lo.B;
    counters.x[2] = hi.A ^ counters.x[3] ^ key.B;
    counters.x[3] = lo.A;

    static constexpr Vec2<uint32_t> PHILOX_W32 = {
        .A = 0x9E3779B9u,
        .B = 0xBB67AE85u,
    };

    // Bump the key
    key.A += PHILOX_W32.A;
    key.B += PHILOX_W32.B;
}

[[gnu::always_inline]] static void generate(const state128 *seeds, state128 *results, const uint8_t generation) {
    // Key as Vec2
    Vec2<uint32_t> key = {
        .A = 382307844u,
        .B = 293830103u,
    };

    // Counter
    state128 counters = *seeds;
    counters.x[3] += generation;

    #define PHILOX4x32_DEFAULT_ROUNDS 10
    #pragma unroll
    for (auto i = 0; i < PHILOX4x32_DEFAULT_ROUNDS; i++) {
        prng::philox::round(counters, key);
    }
    *results = counters;
}

/**
 * @brief Bernoulli-sample four bits using the Philox 4x32-10 counter-based PRNG.
 */
template <typename bitpack_t_>
[[gnu::always_inline]] static bitpack_t_ sample(const state128 *seeds, const std::uint64_t threshold, const std::uint32_t generation) {
    prng::state128 results;
    prng::philox::generate(seeds, &results, static_cast<uint8_t>(generation));

    static constexpr std::uint32_t bernoulli_bits_per_generation = 4;
    const std::uint32_t bernoulli_bits_offset = bernoulli_bits_per_generation * generation;

    using b = bitpack_t_;
    bitpack_t_ out_bits = b(0);
    out_bits |= (static_cast<std::uint64_t>(results.x[0]) < threshold ? b(1) : b(0)) << bitpack_t_(bernoulli_bits_offset + 0);
    out_bits |= (static_cast<std::uint64_t>(results.x[1]) < threshold ? b(1) : b(0)) << bitpack_t_(bernoulli_bits_offset + 1);
    out_bits |= (static_cast<std::uint64_t>(results.x[2]) < threshold ? b(1) : b(0)) << bitpack_t_(bernoulli_bits_offset + 2);
    out_bits |= (static_cast<std::uint64_t>(results.x[3]) < threshold ? b(1) : b(0)) << bitpack_t_(bernoulli_bits_offset + 3);
    return out_bits;
}

template <typename bitpack_t_>
[[gnu::always_inline]] static bitpack_t_ pack_bernoulli_draws(const state128 &seed_base, const std::uint64_t p_threshold) {
    static constexpr std::uint8_t bernoulli_bits_per_generation = 4;
    static constexpr std::uint8_t num_generations = sizeof(bitpack_t_) * 8 / bernoulli_bits_per_generation;

    bitpack_t_ bitpacked_sample = bitpack_t_(0);
    #pragma unroll
    for (std::uint32_t i = 0; i < num_generations; ++i) {
        const bitpack_t_ four_bits = prng::philox::sample<bitpack_t_>(&seed_base, p_threshold, i);
        bitpacked_sample |= four_bits;
    }
    return bitpacked_sample;
}
} // namespace scram::mc::prng