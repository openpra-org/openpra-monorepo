#include <boost/test/unit_test.hpp>
#include "ccf_group.h"
#include "error.h"
#include "expression/constant.h"

using namespace scram::mef;

/**
 * @brief A mock concrete subclass of CcfGroup for testing purposes.
 *
 * This class inherits from CcfGroup and implements its pure virtual methods
 * with minimal functionality, allowing it to be instantiated for testing.
 */
class MockCcfGroup : public CcfGroup {
public:
    using CcfGroup::CcfGroup; // Inherit constructors.

protected:
    /**
     * @brief Implements CalculateProbabilities with minimal functionality.
     *
     * @return An empty ExpressionMap, as this is a mock implementation.
     */
    ExpressionMap CalculateProbabilities() override {
        return ExpressionMap{};
    }
};

/**
 * @brief Test fixture for CcfGroup tests.
 *
 * This structure sets up any common resources and cleans up after tests run,
 * ensuring a consistent environment for each test case.
 */
struct CcfGroupFixture {
    CcfGroupFixture() {
        // Setup common resources for tests, if any.
    }
    ~CcfGroupFixture() {
        // Cleanup resources, if any.
    }
};

// Define a test suite using the fixture defined above.
BOOST_FIXTURE_TEST_SUITE(CcfGroupTests, CcfGroupFixture)

/**
 * @brief Tests adding members to a CCF group.
 *
 * Validates that members are added correctly to the CCF group and
 * verifies the integrity of the member list post-addition.
 */
    BOOST_AUTO_TEST_CASE(AddMemberTest) {
        MockCcfGroup group("testGroup");
        BasicEvent event1("event1"), event2("event2");
        group.AddMember(&event1);
        group.AddMember(&event2);

        auto members = group.members();
        BOOST_CHECK_EQUAL(members.size(), 2);
        BOOST_CHECK_EQUAL(members[0]->name(), "event1");
        BOOST_CHECK_EQUAL(members[1]->name(), "event2");
    }

/**
 * @brief Tests adding a duplicate member to the CCF group.
 *
 * Ensures that attempting to add a duplicate member to the CCF group
 * results in a DuplicateElementError being thrown.
 */
    BOOST_AUTO_TEST_CASE(AddDuplicateMemberTest) {
        MockCcfGroup group("testGroup");
        BasicEvent event("event");
        group.AddMember(&event);

        // Attempting to add the same member again should throw a DuplicateElementError.
        BOOST_CHECK_THROW(group.AddMember(&event), DuplicateElementError);
    }

/**
 * @brief Tests setting the distribution for a CCF group.
 *
 * Validates that a distribution can be set correctly for a CCF group and
 * ensures that attempting to set it more than once results in a LogicError.
 */
    BOOST_AUTO_TEST_CASE(AddDistributionTest) {
        MockCcfGroup group("testGroup");
        BasicEvent event1("event1"), event2("event2");
        Expression* distribution = new ConstantExpression(0.5);

        group.AddMember(&event1);
        group.AddMember(&event2);
        group.AddDistribution(distribution);

        // Attempting to add a distribution again should throw a LogicError.
        BOOST_CHECK_THROW(group.AddDistribution(distribution), scram::LogicError);
    }

/**
 * @brief Tests adding factors to a CCF group without members.
 *
 * Validates that attempting to add factors to a CCF group without any members
 * results in a LogicError, as factors require members to be meaningful.
 */
    BOOST_AUTO_TEST_CASE(AddFactorTest) {
        MockCcfGroup group("testGroup");
        Expression* factor = new ConstantExpression(0.5);

        // Adding factors without members should throw a LogicError.
        BOOST_CHECK_THROW(group.AddFactor(factor), scram::LogicError);
    }

BOOST_AUTO_TEST_SUITE_END()