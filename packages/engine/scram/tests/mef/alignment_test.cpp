#include <boost/test/unit_test.hpp>

#include "alignment.h"
#include "error.h"

using namespace scram::mef;

#include <limits>
#include "alignment.h"
#include "error.h"

using namespace scram::mef;

BOOST_AUTO_TEST_SUITE(AlignmentandPhaseTests)

/**
 * @brief Tests the constructor with a valid time fraction.
 * @details Ensures that a Phase object can be successfully created with a valid time fraction within (0, 1].
 */
    BOOST_AUTO_TEST_CASE(ValidTimeFraction) {
        BOOST_CHECK_NO_THROW(Phase("Operational", 0.5));
    }

/**
 * @brief Tests the constructor with an invalid time fraction.
 * @details Ensures that the constructor throws a DomainError when the time fraction is out of the (0, 1] range.
 */
    BOOST_AUTO_TEST_CASE(InvalidTimeFraction) {
        BOOST_CHECK_THROW(Phase("Operational", 0), DomainError);
        BOOST_CHECK_THROW(Phase("Operational", -0.1), DomainError);
        BOOST_CHECK_THROW(Phase("Operational", 1.1), DomainError);
    }

/**
 * @brief Tests the time_fraction method.
 * @details Ensures that the time_fraction method correctly returns the fraction of mission-time spent in this phase.
 */
    BOOST_AUTO_TEST_CASE(TimeFractionMethod) {
        Phase phase("Operational", 0.25);
        BOOST_CHECK_CLOSE(phase.time_fraction(), 0.25, 0.001);
    }


BOOST_AUTO_TEST_SUITE_END() // AlignmentAndPhaseTests