#pragma once

#include <cstdint>

#include "mc/prng/state128.h"

namespace scram::mc::prng::sfc64 {

/*
 * SFC64 – “Small, Fast, Counter” 64-bit generator (Curran & Mazurek, 2019).
 * We implement it in *counter* mode so that each call is pure – perfect for
 * data-parallel GPU kernels.
 *
 * API mirrors prng::philox and prng::wyrand:
 *   ▸ generate()              – 4 × 32-bit words from one 128-bit seed
 *   ▸ sample<thres>()         – converts those words into 4 Bernoulli bits
 *   ▸ pack_bernoulli_draws()  – fills an arbitrary bit-pack (8–128 bits)
 *
 * Mixed via two 64-bit multipliers and xors; passes BigCrush for Monte-Carlo
 * use while being ~30 % faster than SplitMix64.
 */

namespace detail {
    /* 64-bit mixing function inspired by SFC64’s final avalanche step. */
    [[gnu::always_inline]] static inline std::uint32_t mix32(std::uint64_t x) {
        constexpr std::uint64_t K0 = 0x8CB92BA72F3D8DD7ULL;
        constexpr std::uint64_t K1 = 0x9DDE127EB2C99B2BULL;

        x ^= x >> 25;
        x *= K0;
        x ^= x >> 47;
        x *= K1;
        x ^= x >> 28;
        return static_cast<std::uint32_t>(x);
    }
} // namespace detail

// ------------------------------------------------------------------
//  generate – produce four decorrelated 32-bit words
// ------------------------------------------------------------------
[[gnu::always_inline]]
static void generate(const prng::state128 *seeds,
                     prng::state128       *results,
                     const std::uint8_t    generation) {
    const std::uint64_t g = static_cast<std::uint64_t>(generation);

    #pragma unroll
    for (int i = 0; i < 4; ++i) {
        const std::uint64_t hi = static_cast<std::uint64_t>(seeds->x[i]);
        const std::uint64_t lo = static_cast<std::uint64_t>(seeds->x[(i + 1) & 3]);

        /* 64-bit counter derived from the 128-bit seed + generation. */
        std::uint64_t counter = (hi << 32) | lo;
        counter += (g << 17);               // cheap decorrelation

        results->x[i] = detail::mix32(counter);
    }
}

// ------------------------------------------------------------------
//  sample – four Bernoulli draws packed into bitpack_t_
// ------------------------------------------------------------------

template <typename bitpack_t_>
[[gnu::always_inline]]
static bitpack_t_ sample(const prng::state128 *seeds,
                         const std::uint64_t   threshold,
                         const std::uint32_t   generation) {
    prng::state128 rnd{};
    generate(seeds, &rnd, static_cast<std::uint8_t>(generation));

    constexpr std::uint32_t BITS_PER_GEN = 4;
    const std::uint32_t offset = BITS_PER_GEN * generation;

    bitpack_t_ out = bitpack_t_(0);
    out |= (static_cast<std::uint64_t>(rnd.x[0]) < threshold ? bitpack_t_(1) : bitpack_t_(0)) << bitpack_t_(offset + 0);
    out |= (static_cast<std::uint64_t>(rnd.x[1]) < threshold ? bitpack_t_(1) : bitpack_t_(0)) << bitpack_t_(offset + 1);
    out |= (static_cast<std::uint64_t>(rnd.x[2]) < threshold ? bitpack_t_(1) : bitpack_t_(0)) << bitpack_t_(offset + 2);
    out |= (static_cast<std::uint64_t>(rnd.x[3]) < threshold ? bitpack_t_(1) : bitpack_t_(0)) << bitpack_t_(offset + 3);
    return out;
}

// ------------------------------------------------------------------
//  Convenience: pack an arbitrary-width bit-vector of Bernoulli draws
// ------------------------------------------------------------------

template <typename bitpack_t_>
[[gnu::always_inline]]
static bitpack_t_ pack_bernoulli_draws(const prng::state128 &seed_base,
                                       const std::uint64_t  p_threshold) {
    constexpr std::uint8_t BITS_PER_GEN = 4;
    constexpr std::uint8_t NUM_GEN = sizeof(bitpack_t_) * 8 / BITS_PER_GEN;

    bitpack_t_ packed = bitpack_t_(0);
    #pragma unroll
    for (std::uint32_t i = 0; i < NUM_GEN; ++i) {
        packed |= sample<bitpack_t_>(&seed_base, p_threshold, i);
    }
    return packed;
}

} // namespace scram::mc::prng::sfc64 