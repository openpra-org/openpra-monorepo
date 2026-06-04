#include <boost/test/unit_test.hpp>
#include <vector>
#include <list>
#include "ext/algorithm.h"

BOOST_AUTO_TEST_SUITE(algorithm_suite)

/**
 * @brief Test intersects function with no intersection.
 * @details Tests the intersects function with two sorted ranges that do not intersect,
 * ensuring the function correctly identifies non-intersecting sequences.
 */
    BOOST_AUTO_TEST_CASE(test_intersects_no_intersection) {
        std::vector<int> vec1 = {1, 3, 5};
        std::vector<int> vec2 = {2, 4, 6};
        BOOST_CHECK_EQUAL(ext::intersects(vec1.begin(), vec1.end(), vec2.begin(), vec2.end()), false);
    }

/**
 * @brief Test intersects function with intersection.
 * @details Tests the intersects function with two sorted ranges that do intersect,
 * ensuring the function correctly identifies intersecting sequences.
 */
    BOOST_AUTO_TEST_CASE(test_intersects_with_intersection) {
        std::vector<int> vec1 = {1, 2, 3};
        std::vector<int> vec2 = {3, 4, 5};
        BOOST_CHECK_EQUAL(ext::intersects(vec1.begin(), vec1.end(), vec2.begin(), vec2.end()), true);
    }

/**
 * @brief Test intersects function with identical ranges.
 * @details Tests the intersects function with two identical sorted ranges,
 * ensuring the function correctly identifies that a range always intersects with itself.
 */
    BOOST_AUTO_TEST_CASE(test_intersects_identical_ranges) {
        std::vector<int> vec = {1, 2, 3};
        BOOST_CHECK_EQUAL(ext::intersects(vec.begin(), vec.end(), vec.begin(), vec.end()), true);
    }

/**
 * @brief Test intersects function with empty ranges.
 * @details Tests the intersects function with two empty ranges, expecting no intersection,
 * ensuring the function correctly handles empty input sequences.
 */
    BOOST_AUTO_TEST_CASE(test_intersects_empty_ranges) {
        std::vector<int> vec1;
        std::vector<int> vec2;
        BOOST_CHECK_EQUAL(ext::intersects(vec1.begin(), vec1.end(), vec2.begin(), vec2.end()), false);
    }

/**
 * @brief Test range-based intersects function.
 * @details Tests the range-based version of intersects with two ranges that do intersect,
 * using different container types to ensure compatibility and correctness of the template function.
 */
    BOOST_AUTO_TEST_CASE(test_range_based_intersects) {
        std::vector<int> vec1 = {1, 2, 3};
        std::list<int> list2 = {3, 4, 5}; // Using different container types to ensure compatibility.
        BOOST_CHECK_EQUAL(ext::intersects(vec1, list2), true);
    }

/**
 * @brief Test none_of function with a condition that is never met.
 * @details Tests the none_of function with a predicate that is false for all elements,
 * ensuring the function correctly identifies when no elements meet the given condition.
 */
    BOOST_AUTO_TEST_CASE(test_none_of_false_for_all) {
        std::vector<int> vec = {1, 2, 3};
        BOOST_CHECK_EQUAL(ext::none_of(vec, [](int x){ return x > 3; }), true);
    }

/**
 * @brief Test any_of function with a condition that is met.
 * @details Tests the any_of function with a predicate that is true for at least one element,
 * ensuring the function correctly identifies when at least one element meets the given condition.
 */
    BOOST_AUTO_TEST_CASE(test_any_of_true_for_some) {
        std::vector<int> vec = {1, 2, 3};
        BOOST_CHECK_EQUAL(ext::any_of(vec, [](int x){ return x == 2; }), true);
    }

/**
 * @brief Test all_of function with a condition that is met by all.
 * @details Tests the all_of function with a predicate that is true for all elements,
 * ensuring the function correctly identifies when all elements meet the given condition.
 */
    BOOST_AUTO_TEST_CASE(test_all_of_true_for_all) {
        std::vector<int> vec = {2, 4, 6};
        BOOST_CHECK_EQUAL(ext::all_of(vec, [](int x){ return x % 2 == 0; }), true);
    }

BOOST_AUTO_TEST_SUITE_END()