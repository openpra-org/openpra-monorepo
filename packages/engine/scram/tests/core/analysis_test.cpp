#include <boost/test/unit_test.hpp>
#include "analysis.h"
#include "settings.h"
#include "error.h"

using namespace scram::core;

// Overloads for printing enum values to assist in debugging and output readability.
std::ostream& operator<<(std::ostream& os, const Algorithm& algorithm) {
    switch (algorithm) {
        case Algorithm::kBdd: return os << "kBdd";
        case Algorithm::kZbdd: return os << "kZbdd";
        case Algorithm::kMocus: return os << "kMocus";
        default: return os << "Unknown Algorithm";
    }
}

std::ostream& operator<<(std::ostream& os, const Approximation& approximation) {
    switch (approximation) {
        case Approximation::kNone: return os << "kNone";
        case Approximation::kRareEvent: return os << "kRareEvent";
        case Approximation::kMcub: return os << "kMcub";
        default: return os << "Unknown Approximation";
    }
}

// Concrete subclass of Analysis for testing purposes.
class TestAnalysis : public Analysis {
public:
    using Analysis::Analysis; // Inherit constructors
    ~TestAnalysis() override = default; // Override the pure virtual destructor
};

// Fixture for setting up Analysis objects with default settings.
struct AnalysisFixture {
    Settings defaultSettings;
    AnalysisFixture() {
        // Setup default settings for testing
        defaultSettings.algorithm(Algorithm::kBdd)
                .approximation(Approximation::kNone)
                .prime_implicants(false)
                .limit_order(20)
                .cut_off(1e-8)
                .num_trials(1000)
                .num_quantiles(20)
                .num_bins(20)
                .seed(0)
                .mission_time(8760)
                .time_step(0)
                .probability_analysis(false)
                .safety_integrity_levels(false)
                .importance_analysis(false)
                .uncertainty_analysis(false)
                .ccf_analysis(false);
    }
};

BOOST_FIXTURE_TEST_SUITE(AnalysisTests, AnalysisFixture)

/**
 * @brief Tests the constructor of the Analysis class.
 * @details Ensures that an Analysis object can be successfully created with default settings.
 */
    BOOST_AUTO_TEST_CASE(ConstructorTest) {
        BOOST_CHECK_NO_THROW(TestAnalysis analysis(defaultSettings));
    }

/**
 * @brief Tests access to settings within an Analysis object.
 * @details Validates that the settings applied to an Analysis object are correctly accessible and match expected values.
 */
    BOOST_AUTO_TEST_CASE(SettingsAccessTest) {
        TestAnalysis analysis(defaultSettings);
        BOOST_CHECK_EQUAL(static_cast<int>(analysis.settings().algorithm()), static_cast<int>(Algorithm::kBdd));
        BOOST_CHECK_EQUAL(static_cast<int>(analysis.settings().approximation()), static_cast<int>(Approximation::kNone));
    }

/**
 * @brief Tests the handling of warnings within an Analysis object.
 * @details Checks if warnings can be added to an Analysis object and ensures that the warnings string is correctly updated.
 */
    BOOST_AUTO_TEST_CASE(WarningHandlingTest) {
        TestAnalysis analysis(defaultSettings);
        std::string warningMsg = "Test warning";
        analysis.AddWarning(warningMsg);
        BOOST_CHECK_EQUAL(analysis.warnings(), warningMsg);

        // Test appending another warning
        std::string secondWarning = "Second warning";
        analysis.AddWarning(secondWarning);
        BOOST_CHECK_EQUAL(analysis.warnings(), warningMsg + "; " + secondWarning);
    }

/**
 * @brief Tests the tracking of analysis time within an Analysis object.
 * @details Validates that analysis time can be added and accurately tracked within an Analysis object.
 */
    BOOST_AUTO_TEST_CASE(AnalysisTimeTest) {
        TestAnalysis analysis(defaultSettings);
        double timeSpent = 5.0; // Simulate 5 seconds of analysis time
        analysis.AddAnalysisTime(timeSpent);
        BOOST_CHECK_CLOSE(analysis.analysis_time(), timeSpent, 0.001);

        // Test adding more time
        double additionalTime = 2.5;
        analysis.AddAnalysisTime(additionalTime);
        BOOST_CHECK_CLOSE(analysis.analysis_time(), timeSpent + additionalTime, 0.001);
    }

/**
 * @brief Tests the robustness of Analysis settings validation.
 * @details Ensures that attempting to set invalid settings values results in appropriate exceptions being thrown.
 */
    BOOST_AUTO_TEST_CASE(InvalidSettingsTest) {
        // Test construction with invalid settings to ensure robustness
        Settings invalidSettings = defaultSettings;
        BOOST_CHECK_THROW(invalidSettings.limit_order(-1), scram::SettingsError);
    }

BOOST_AUTO_TEST_SUITE_END()