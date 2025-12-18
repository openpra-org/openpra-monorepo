#include <boost/test/unit_test.hpp>
#include <vector>
#include "ext/linear_set.h"

BOOST_AUTO_TEST_SUITE(linear_set_suite)

/**
 * @brief Test default construction.
 * @details Ensures that a default-constructed linear_set is empty.
 */
    BOOST_AUTO_TEST_CASE(default_constructor) {
        ext::linear_set<int> set;
        BOOST_CHECK(set.empty());
    }

/**
 * @brief Test initializer list construction.
 * @details Checks if the linear_set correctly initializes with an initializer list,
 * ensuring the set contains the expected elements.
 */
    BOOST_AUTO_TEST_CASE(initializer_list_constructor) {
        ext::linear_set<int> set = {1, 2, 3};
        BOOST_CHECK_EQUAL(set.size(), 3);
    }

/**
 * @brief Test copy construction.
 * @details Ensures that a linear_set can be copy-constructed with the same elements,
 * verifying the integrity of the copied set.
 */
    BOOST_AUTO_TEST_CASE(copy_constructor) {
        ext::linear_set<int> original = {1, 2, 3};
        ext::linear_set<int> copy = original;
        BOOST_CHECK(copy == original);
    }

/**
 * @brief Test range construction.
 * @details Verifies that constructing a linear_set from a range results in the correct elements,
 * ensuring the set accurately reflects the contents of the range.
 */
    BOOST_AUTO_TEST_CASE(range_constructor) {
        std::vector<int> vec = {4, 5, 6};
        ext::linear_set<int> set(vec.begin(), vec.end());
        BOOST_CHECK_EQUAL(set.size(), 3);
    }

/**
 * @brief Test insert functionality.
 * @details Checks if inserting new elements works as expected, including duplicates,
 * ensuring that duplicates are not added to the set.
 */
    BOOST_AUTO_TEST_CASE(insert) {
        ext::linear_set<int> set;
        auto [it, inserted] = set.insert(1);
        BOOST_CHECK(inserted);
        BOOST_CHECK_EQUAL(*it, 1);

        // Attempt to insert a duplicate
        auto [it2, inserted2] = set.insert(1);
        BOOST_CHECK(!inserted2);
        BOOST_CHECK_EQUAL(set.size(), 1);
    }

/**
 * @brief Test erase functionality by key.
 * @details Ensures that erasing an element by its key correctly removes it from the set,
 * verifying the set's size and contents post-removal.
 */
    BOOST_AUTO_TEST_CASE(erase_by_key) {
        ext::linear_set<int> set = {1, 2, 3};
        auto erased = set.erase(2);
        BOOST_CHECK_EQUAL(erased, 1);
        BOOST_CHECK_EQUAL(set.size(), 2);
        BOOST_CHECK(set.find(2) == set.end());
    }

/**
 * @brief Test erase functionality by iterator.
 * @details Verifies that erasing an element by its iterator correctly updates the set,
 * ensuring the iterator validity and set contents post-removal.
 */
    BOOST_AUTO_TEST_CASE(erase_by_iterator) {
        ext::linear_set<int> set = {1, 2, 3};
        auto it = set.find(2);
        auto next_it = set.erase(it);
        BOOST_CHECK_EQUAL(*next_it, 3);
        BOOST_CHECK_EQUAL(set.size(), 2);
    }

/**
 * @brief Test find functionality.
 * @details Ensures that finding elements by their key works correctly,
 * verifying both successful finds and unsuccessful searches.
 */
    BOOST_AUTO_TEST_CASE(find) {
        ext::linear_set<int> set = {1, 2, 3};
        auto it = set.find(2);
        BOOST_CHECK(it != set.end());
        BOOST_CHECK_EQUAL(*it, 2);

        auto it2 = set.find(4);
        BOOST_CHECK(it2 == set.end());
    }

/**
 * @brief Test the equality operators.
 * @details Checks if two sets are correctly identified as equal or not,
 * considering the order does not matter for equality in this implementation.
 */
    BOOST_AUTO_TEST_CASE(equality_operators) {
        ext::linear_set<int> set1 = {1, 2, 3};
        ext::linear_set<int> set2 = {1, 2, 3};
        ext::linear_set<int> set3 = {3, 2, 1}; // Order does not matter for equality
        BOOST_CHECK(set1 == set2);
        BOOST_CHECK(set1 == set3);
    }

/**
 * @brief Test the swap functionality.
 * @details Ensures that swapping two sets correctly exchanges their contents,
 * verifying the sets' contents post-swap.
 */
    BOOST_AUTO_TEST_CASE(swap) {
        ext::linear_set<int> set1 = {1, 2, 3};
        ext::linear_set<int> set2 = {4, 5, 6};
        set1.swap(set2);
        BOOST_CHECK(set1.find(4) != set1.end());
        BOOST_CHECK(set2.find(1) != set2.end());
    }

BOOST_AUTO_TEST_SUITE_END()