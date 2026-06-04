#include <boost/test/unit_test.hpp>
#include "ext/float_compare.h"

BOOST_AUTO_TEST_SUITE(float_compare_suite)

/**
 * @brief Tests comparison of identical values.
 * @details Ensures that the function correctly identifies two identical floating-point numbers as close,
 * even when a small tolerance is allowed.
 */
    BOOST_AUTO_TEST_CASE(test_identical_values) {
        BOOST_CHECK(ext::is_close(1.0, 1.0, 0.01));
    }

/**
 * @brief Tests comparison with zero tolerance.
 * @details Verifies that the function requires exact equality when the tolerance is set to zero,
 * demonstrating the function's precision in distinguishing very close values.
 */
    BOOST_AUTO_TEST_CASE(test_zero_tolerance) {
        BOOST_CHECK(ext::is_close(1.0, 1.0, 0.0)); // Exact match required
        BOOST_CHECK(!ext::is_close(1.0, 1.0001, 0.0)); // Even a small difference is not allowed
    }

/**
 * @brief Tests comparison with small differences.
 * @details Checks the function's ability to correctly identify close values within a small tolerance,
 * highlighting its utility in applications requiring precision with a margin for minor discrepancies.
 */
    BOOST_AUTO_TEST_CASE(test_small_difference) {
        BOOST_CHECK(ext::is_close(1.0, 1.001, 0.001));
        BOOST_CHECK(!ext::is_close(1.0, 1.002, 0.001)); // Difference is outside the tolerance
    }

/**
 * @brief Tests comparison with negative values.
 * @details Ensures that the function correctly handles comparisons involving negative numbers,
 * confirming its versatility and correctness across the number line.
 */
    BOOST_AUTO_TEST_CASE(test_negative_values) {
        BOOST_CHECK(ext::is_close(-1.0, -1.001, 0.001));
        BOOST_CHECK(!ext::is_close(-1.0, -1.002, 0.001)); // Difference is outside the tolerance
    }

/**
 * @brief Tests comparison with large values.
 * @details Verifies that the function can handle large numbers, demonstrating its effectiveness
 * even with values that significantly exceed typical ranges, though it's noted in the implementation limitations.
 */
    BOOST_AUTO_TEST_CASE(test_large_values) {
        BOOST_CHECK(ext::is_close(1e10, 1e10 + 1e5, 0.001)); // Within tolerance for large numbers
    }

/**
 * @brief Tests comparison with very small values.
 * @details Checks the function's behavior with numbers close to zero, highlighting potential underflow issues
 * and the importance of considering the scale of values when determining closeness.
 */
    BOOST_AUTO_TEST_CASE(test_very_small_values) {
        BOOST_CHECK(!ext::is_close(1e-10, 1e-10 + 1e-11, 0.001)); // Difference is too large for very small numbers
    }

BOOST_AUTO_TEST_SUITE_END()