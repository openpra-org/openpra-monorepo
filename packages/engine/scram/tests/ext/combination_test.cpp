#include <boost/test/unit_test.hpp>
#include <vector>
#include "ext/combination.h"

// Define operator<< for std::vector<int> to make it printable
std::ostream& operator<<(std::ostream& os, const std::vector<int>& v) {
    os << "{";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i > 0) os << ", ";
        os << v[i];
    }
    os << "}";
    return os;
}

BOOST_AUTO_TEST_SUITE(combination_suite)

/**
 * @brief Tests handling of an empty range.
 * @details Verifies that `ext::for_each_combination` correctly handles an empty range by ensuring
 * the callback function is called once, which aligns with the function's expected behavior for empty ranges.
 */
    BOOST_AUTO_TEST_CASE(test_empty_range_call_once) {
        std::vector<int> v;
        bool called = false;
        auto f = [&called](auto, auto) { called = true; return false; };
        ext::for_each_combination(v.begin(), v.begin(), v.end(), f);
        BOOST_CHECK(called); // Expecting f to be called once, even for an empty range.
    }

/**
 * @brief Tests handling of a single element range.
 * @details Verifies that a range with a single element results in a single call to the callback function,
 * demonstrating the function's ability to handle minimal non-empty ranges.
 */
    BOOST_AUTO_TEST_CASE(test_single_element) {
        std::vector<int> v = {1};
        int call_count = 0;
        auto f = [&call_count](auto, auto) { ++call_count; return false; };
        ext::for_each_combination(v.begin(), v.begin(), v.end(), f);
        BOOST_CHECK_EQUAL(call_count, 1);
    }

/**
 * @brief Tests handling of a range with no combination.
 * @details Verifies that when the combination size equals the range size, `ext::for_each_combination`
 * generates a single combination, as expected for full-range combinations.
 */
    BOOST_AUTO_TEST_CASE(test_no_combination) {
        std::vector<int> v = {1, 2, 3};
        int call_count = 0;
        auto f = [&call_count](auto, auto) { ++call_count; return false; };
        ext::for_each_combination(v.begin(), v.end(), v.end(), f);
        BOOST_CHECK_EQUAL(call_count, 1);
    }

/**
 * @brief Tests generation of combinations.
 * @details Verifies that the correct number of combinations are generated for a given range and combination size,
 * and that these combinations match the expected results.
 */
    BOOST_AUTO_TEST_CASE(test_combinations) {
        std::vector<int> v = {1, 2, 3, 4};
        std::size_t combination_size = 2;
        std::vector<std::vector<int>> expected_combinations = {
                {1, 2}, {1, 3}, {1, 4}, {2, 3}, {2, 4}, {3, 4}
        };
        std::vector<std::vector<int>> generated_combinations;
        auto f = [&generated_combinations](auto first, auto last) {
            generated_combinations.emplace_back(first, last);
            return false;
        };
        ext::for_each_combination(v.begin(), v.begin() + combination_size, v.end(), f);
        BOOST_REQUIRE_EQUAL(generated_combinations.size(), expected_combinations.size());
        for (size_t i = 0; i < generated_combinations.size(); ++i) {
            BOOST_CHECK_EQUAL_COLLECTIONS(generated_combinations[i].begin(), generated_combinations[i].end(),
                                          expected_combinations[i].begin(), expected_combinations[i].end());
        }
    }

/**
 * @brief Tests early termination of combination generation.
 * @details Verifies that `ext::for_each_combination` correctly terminates early if the callback function returns true,
 * demonstrating control over the iteration process based on runtime conditions.
 */
    BOOST_AUTO_TEST_CASE(test_early_termination) {
        std::vector<int> v = {1, 2, 3, 4};
        int call_count = 0;
        auto f = [&call_count](auto, auto) {
            ++call_count;
            return call_count == 2; // Terminate early on the second call
        };
        ext::for_each_combination(v.begin(), v.begin() + 2, v.end(), f);
        BOOST_CHECK_EQUAL(call_count, 2);
    }

BOOST_AUTO_TEST_SUITE_END()