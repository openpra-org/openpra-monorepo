#pragma once
#include <unordered_map>

namespace ext {

template<typename A, typename B>
struct bimap {
    std::unordered_map<A, B> A_to_B;
    std::unordered_map<B, A> B_to_A;
};

}