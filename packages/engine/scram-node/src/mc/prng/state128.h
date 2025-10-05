#pragma once
#include <cstdint>
namespace scram::mc::prng {
struct state128 {
    /// @brief Four 32-bit state values forming the complete 128-bit state
    std::uint32_t x[4];
};

template <typename T> struct Vec2 {
    T A;
    T B;
};

template <typename T> struct Vec4 {
    T X;
    T Y;
    T Z;
    T W;
};

template <typename DW = std::uint64_t, typename W = std::uint32_t>
[[gnu::always_inline]] static inline W mulhilo(const W a, const W b, W *hi) {
    DW product = static_cast<DW>(a) * static_cast<DW>(b);
    *hi = product >> (sizeof(W) * 8);
    return static_cast<W>(product);
}
}