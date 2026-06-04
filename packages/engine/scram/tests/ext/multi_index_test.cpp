#include <boost/test/unit_test.hpp>
#include <boost/multi_index_container.hpp>
#include <boost/multi_index/sequenced_index.hpp>
#include <boost/multi_index/ordered_index.hpp>
#include <boost/multi_index/member.hpp>
#include "ext/multi_index.h"

using namespace boost::multi_index;
using namespace ext;

/**
 * Define a simple struct for testing purposes.
 * This struct includes an integer ID and a string value for basic testing
 * of multi_index_container functionalities.
 */
struct TestItem {
    int id;
    std::string value;

    /**
     * Less-than operator for ordering by ID.
     * @param other Another TestItem instance to compare with.
     * @return True if this instance's ID is less than the other's ID.
     */
    bool operator<(const TestItem& other) const {
        return id < other.id;
    }
};

/**
 * Define a multi_index_container with two indices:
 * - A sequenced index, which maintains the order of insertion.
 * - An ordered_unique index, which orders items by their ID and ensures uniqueness.
 */
typedef multi_index_container<
        TestItem,
        indexed_by<
                sequenced<>,
                ordered_unique<member<TestItem, int, &TestItem::id>>
        >
> TestContainer;

/**
 * @brief Test suite for the extract function in a multi_index_container context.
 *
 * This suite contains tests specifically designed to verify the functionality
 * and correctness of the extract operation on multi_index_container instances,
 * focusing on extraction by valid iterators.
 */
BOOST_AUTO_TEST_SUITE(multi_index_suite)

/**
 * @brief Tests extraction by a valid iterator.
 *
 * @details This test verifies that an item can be correctly extracted from a
 * multi_index_container using a valid iterator. It checks that the extracted item
 * matches the expected values and that the item is indeed removed from the container.
 */
    BOOST_AUTO_TEST_CASE(test_extract_by_valid_iterator) {
        TestContainer container;
        container.push_back({1, "first"});
        container.push_back({2, "last"});

        auto it = container.begin();
        TestItem extracted = extract(it, &container);

        BOOST_CHECK_EQUAL(extracted.id, 1);
        BOOST_CHECK_EQUAL(extracted.value, "first");
        BOOST_CHECK_EQUAL(container.size(), 1); // Ensure the item was removed
    }

BOOST_AUTO_TEST_SUITE_END()