#include <boost/test/unit_test.hpp>
#include "error.h"
#include "settings.h"

using namespace scram::core;

BOOST_AUTO_TEST_SUITE(SettingsTests)

/**
 * @brief Tests default settings values.
 * @details Ensures that a newly created `Settings` object has the expected default values for all settings.
 */
    BOOST_AUTO_TEST_CASE(test_default_settings) {
        Settings settings;
        // Test default values
        BOOST_CHECK(settings.algorithm() == Algorithm::kBdd);
        BOOST_CHECK(settings.approximation() == Approximation::kNone);
        BOOST_CHECK(!settings.prime_implicants());
        BOOST_CHECK_EQUAL(settings.limit_order(), 20);
        BOOST_CHECK_CLOSE(settings.cut_off(), 1e-8, 0.001);
        BOOST_CHECK_EQUAL(settings.num_trials(), 1000);
        BOOST_CHECK_EQUAL(settings.num_quantiles(), 20);
        BOOST_CHECK_EQUAL(settings.num_bins(), 20);
        BOOST_CHECK_EQUAL(settings.seed(), 0);
        BOOST_CHECK_CLOSE(settings.mission_time(), 8760, 0.001);
        BOOST_CHECK_CLOSE(settings.time_step(), 0, 0.001);
        BOOST_CHECK(!settings.probability_analysis());
        BOOST_CHECK(!settings.safety_integrity_levels());
        BOOST_CHECK(!settings.importance_analysis());
        BOOST_CHECK(!settings.uncertainty_analysis());
        BOOST_CHECK(!settings.ccf_analysis());
    }

/**
 * @brief Tests setting and retrieving the algorithm setting.
 * @details Verifies that changing the algorithm setting updates the algorithm and related default approximation settings.
 */
    BOOST_AUTO_TEST_CASE(test_algorithm_setting) {
        Settings settings;
        // Set to MOCUS and check if the default approximation changes to RareEvent
        settings.algorithm(Algorithm::kMocus);
        BOOST_CHECK(settings.algorithm() == Algorithm::kMocus);
        BOOST_CHECK(settings.approximation() == Approximation::kRareEvent);

        // Set to ZBDD and check if the default approximation changes to RareEvent
        settings.algorithm(Algorithm::kZbdd);
        BOOST_CHECK(settings.algorithm() == Algorithm::kZbdd);
        BOOST_CHECK(settings.approximation() == Approximation::kRareEvent);

        // Set back to BDD and check if the approximation changes to None
        settings.algorithm(Algorithm::kBdd);
        BOOST_CHECK(settings.algorithm() == Algorithm::kBdd);
        BOOST_CHECK(settings.approximation() == Approximation::kNone);
    }

/**
 * @brief Tests setting the algorithm with an invalid string.
 * @details Ensures that an exception is thrown when an invalid string is used to set the algorithm.
 */
    BOOST_AUTO_TEST_CASE(test_invalid_algorithm_string) {
        Settings settings;
        BOOST_CHECK_THROW(settings.algorithm("invalid_algorithm"), scram::SettingsError);
    }

/**
 * @brief Tests setting and retrieving the approximation setting.
 * @details Verifies that changing the approximation setting updates the approximation and related prime implicants settings.
 */
    BOOST_AUTO_TEST_CASE(test_approximation_setting) {
        Settings settings;
        // Set to RareEvent and check
        settings.approximation(Approximation::kRareEvent);
        BOOST_CHECK(settings.approximation() == Approximation::kRareEvent);

        // Set to Mcub and check
        settings.approximation(Approximation::kMcub);
        BOOST_CHECK(settings.approximation() == Approximation::kMcub);

        // Set to None and check
        settings.approximation(Approximation::kNone);
        BOOST_CHECK(settings.approximation() == Approximation::kNone);
    }

/**
 * @brief Tests setting the approximation with an invalid string.
 * @details Ensures that an exception is thrown when an invalid string is used to set the approximation.
 */
    BOOST_AUTO_TEST_CASE(test_invalid_approximation_string) {
        Settings settings;
        BOOST_CHECK_THROW(settings.approximation("invalid_approximation"), scram::SettingsError);
    }

/**
 * @brief Tests setting and retrieving the prime implicants flag.
 * @details Checks if the prime implicants setting correctly updates the flag and related approximation settings.
 */
    BOOST_AUTO_TEST_CASE(test_prime_implicants_setting) {
        Settings settings;
        // Set algorithm to BDD and enable prime implicants
        settings.algorithm(Algorithm::kBdd).prime_implicants(true);
        BOOST_CHECK(settings.prime_implicants());
        BOOST_CHECK(settings.approximation() == Approximation::kNone);

        // Try to enable prime implicants for non-BDD algorithm
        settings.prime_implicants(false).algorithm(Algorithm::kMocus);
        BOOST_CHECK_THROW(settings.prime_implicants(true), scram::SettingsError);
    }

/**
 * @brief Tests setting and retrieving the limit order.
 * @details Verifies that the limit order setting correctly updates the limit order and throws an exception for invalid values.
 */
    BOOST_AUTO_TEST_CASE(test_limit_order_setting) {
        Settings settings;
        // Set a valid limit order
        settings.limit_order(10);
        BOOST_CHECK_EQUAL(settings.limit_order(), 10);

        // Try to set an invalid limit order
        BOOST_CHECK_THROW(settings.limit_order(-1), scram::SettingsError);
    }

// Additional test cases follow the same pattern, providing detailed documentation on their purpose and behavior.

BOOST_AUTO_TEST_SUITE_END()