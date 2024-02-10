#include <boost/test/unit_test.hpp>
#include <stdexcept>
#include <limits>
#include "error.h"
#include "settings.h"


using namespace scram::core;

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

BOOST_AUTO_TEST_CASE(test_algorithm_setting) {
  /// @brief Test setting and getting the algorithm.
  /// @details This test checks if the algorithm setting correctly updates
  ///          the algorithm and related default approximation settings.
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

BOOST_AUTO_TEST_CASE(test_invalid_algorithm_string) {
  /// @brief Test setting the algorithm with an invalid string.
  /// @details This test ensures that an exception is thrown when an invalid
  ///          string is used to set the algorithm.
  Settings settings;

  BOOST_CHECK_THROW(settings.algorithm("invalid_algorithm"), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_approximation_setting) {
  /// @brief Test setting and getting the approximation.
  /// @details This test checks if the approximation setting correctly updates
  ///          the approximation and related prime implicants settings.
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

BOOST_AUTO_TEST_CASE(test_invalid_approximation_string) {
  /// @brief Test setting the approximation with an invalid string.
  /// @details This test ensures that an exception is thrown when an invalid
  ///          string is used to set the approximation.
  Settings settings;

  BOOST_CHECK_THROW(settings.approximation("invalid_approximation"), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_prime_implicants_setting) {
  /// @brief Test setting and getting the prime implicants flag.
  /// @details This test checks if the prime implicants setting correctly updates
  ///          the flag and related approximation settings.
  Settings settings;

  // Set algorithm to BDD and enable prime implicants
  settings.algorithm(Algorithm::kBdd).prime_implicants(true);
  BOOST_CHECK(settings.prime_implicants());
  BOOST_CHECK(settings.approximation() == Approximation::kNone);

  // Try to enable prime implicants for non-BDD algorithm
  settings.algorithm(Algorithm::kMocus);
  BOOST_CHECK_THROW(settings.prime_implicants(true), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_limit_order_setting) {
  /// @brief Test setting and getting the limit order.
  /// @details This test checks if the limit order setting correctly updates
  ///          the limit order and throws an exception for invalid values.
  Settings settings;

  // Set a valid limit order
  settings.limit_order(10);
  BOOST_CHECK_EQUAL(settings.limit_order(), 10);

  // Try to set an invalid limit order
  BOOST_CHECK_THROW(settings.limit_order(-1), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_cut_off_setting) {
  /// @brief Test setting and getting the cut-off probability.
  /// @details This test checks if the cut-off probability setting correctly updates
  ///          the cut-off and throws an exception for invalid values.
  Settings settings;

  // Set a valid cut-off probability
  settings.cut_off(0.5);
  BOOST_CHECK_CLOSE(settings.cut_off(), 0.5, 0.001);

  // Try to set invalid cut-off probabilities
  BOOST_CHECK_THROW(settings.cut_off(-0.1), scram::SettingsError);
  BOOST_CHECK_THROW(settings.cut_off(1.1), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_num_trials_setting) {
  /// @brief Test setting and getting the number of trials.
  /// @details This test checks if the number of trials setting correctly updates
  ///          the number of trials and throws an exception for invalid values.
  Settings settings;

  // Set a valid number of trials
  settings.num_trials(5000);
  BOOST_CHECK_EQUAL(settings.num_trials(), 5000);

  // Try to set an invalid number of trials
  BOOST_CHECK_THROW(settings.num_trials(0), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_num_quantiles_setting) {
  /// @brief Test setting and getting the number of quantiles.
  /// @details This test checks if the number of quantiles setting correctly updates
  ///          the number of quantiles and throws an exception for invalid values.
  Settings settings;

  // Set a valid number of quantiles
  settings.num_quantiles(10);
  BOOST_CHECK_EQUAL(settings.num_quantiles(), 10);

  // Try to set an invalid number of quantiles
  BOOST_CHECK_THROW(settings.num_quantiles(0), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_num_bins_setting) {
  /// @brief Test setting and getting the number of bins.
  /// @details This test checks if the number of bins setting correctly updates
  ///          the number of bins and throws an exception for invalid values.
  Settings settings;

  // Set a valid number of bins
  settings.num_bins(30);
  BOOST_CHECK_EQUAL(settings.num_bins(), 30);

  // Try to set an invalid number of bins
  BOOST_CHECK_THROW(settings.num_bins(0), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_seed_setting) {
  /// @brief Test setting and getting the seed for the pseudo-random number generator.
  /// @details This test checks if the seed setting correctly updates the seed
  ///          and throws an exception for invalid values.
  Settings settings;

  // Set a valid seed
  settings.seed(12345);
  BOOST_CHECK_EQUAL(settings.seed(), 12345);

  // Try to set an invalid seed
  BOOST_CHECK_THROW(settings.seed(-1), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_mission_time_setting) {
  /// @brief Test setting and getting the mission time.
  /// @details This test checks if the mission time setting correctly updates
  ///          the mission time and throws an exception for invalid values.
  Settings settings;

  // Set a valid mission time
  settings.mission_time(100);
  BOOST_CHECK_CLOSE(settings.mission_time(), 100, 0.001);

  // Try to set an invalid mission time
  BOOST_CHECK_THROW(settings.mission_time(-1), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_time_step_setting) {
  /// @brief Test setting and getting the time step.
  /// @details This test checks if the time step setting correctly updates
  ///          the time step and throws an exception for invalid values.
  Settings settings;

  // Set a valid time step
  settings.time_step(1);
  BOOST_CHECK_CLOSE(settings.time_step(), 1, 0.001);

  // Try to set an invalid time step
  BOOST_CHECK_THROW(settings.time_step(-1), scram::SettingsError);

  // Try to disable time step when SIL is requested
  settings.safety_integrity_levels(true);
  BOOST_CHECK_THROW(settings.time_step(0), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_safety_integrity_levels_setting) {
  /// @brief Test setting and getting the safety integrity levels flag.
  /// @details This test checks if the safety integrity levels setting correctly updates
  ///          the flag and throws an exception if the time step is not set.
  Settings settings;

  // Set a valid time step and enable SIL
  settings.time_step(1).safety_integrity_levels(true);
  BOOST_CHECK(settings.safety_integrity_levels());

  // Try to enable SIL without setting time step
  settings.time_step(0);
  BOOST_CHECK_THROW(settings.safety_integrity_levels(true), scram::SettingsError);
}

BOOST_AUTO_TEST_CASE(test_probability_analysis_setting) {
  /// @brief Test setting and getting the probability analysis flag.
  /// @details This test checks if the probability analysis setting correctly updates
  ///          the flag and respects dependencies with other analysis types.
  Settings settings;

  // Enable probability analysis
  settings.probability_analysis(true);
  BOOST_CHECK(settings.probability_analysis());

  // Disable probability analysis when it's not required by other analyses
  settings.probability_analysis(false);
  BOOST_CHECK(!settings.probability_analysis());

  // Enable importance analysis, which requires probability analysis
  settings.importance_analysis(true);
  // Try to disable probability analysis when it's required by importance analysis
  settings.probability_analysis(false);
  BOOST_CHECK(settings.probability_analysis());
}

BOOST_AUTO_TEST_CASE(test_importance_analysis_setting) {
  /// @brief Test setting and getting the importance analysis flag.
  /// @details This test checks if the importance analysis setting correctly updates
  ///          the flag and implicitly enables probability analysis.
  Settings settings;

  // Enable importance analysis
  settings.importance_analysis(true);
  BOOST_CHECK(settings.importance_analysis());
  BOOST_CHECK(settings.probability_analysis());
}

BOOST_AUTO_TEST_CASE(test_uncertainty_analysis_setting) {
  /// @brief Test setting and getting the uncertainty analysis flag.
  /// @details This test checks if the uncertainty analysis setting correctly updates
  ///          the flag and implicitly enables probability analysis.
  Settings settings;

  // Enable uncertainty analysis
  settings.uncertainty_analysis(true);
  BOOST_CHECK(settings.uncertainty_analysis());
  BOOST_CHECK(settings.probability_analysis());
}

BOOST_AUTO_TEST_CASE(test_ccf_analysis_setting) {
  /// @brief Test setting and getting the common-cause failure analysis flag.
  /// @details This test checks if the common-cause failure analysis setting correctly updates
  ///          the flag.
  Settings settings;

  // Enable CCF analysis
  settings.ccf_analysis(true);
  BOOST_CHECK(settings.ccf_analysis());

  // Disable CCF analysis
  settings.ccf_analysis(false);
  BOOST_CHECK(!settings.ccf_analysis());
}