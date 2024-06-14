#include <boost/test/unit_test.hpp>
#include <map>
#include <vector>
#include <string>
#include <algorithm>
#include "ext/find_iterator.h"

using namespace ext;

// Overloaded find utility function template
template <class T, typename Arg>
auto overload_find(T&& container, Arg&& arg) {
    // Use std::begin and std::end to support both member and non-member begin/end functions.
    auto it = std::find(std::begin(container), std::end(container), std::forward<Arg>(arg));
    return find_iterator<decltype(it)>(std::move(it), std::end(container));
}

/**
 * @brief Test suite for find_iterator and find utility.
 * @details This suite tests various scenarios including successful finds,
 * unsuccessful finds, and behavior with different container types.
 */
BOOST_AUTO_TEST_SUITE(find_iterator_suite)

/**
 * @brief Test successful find in a vector.
 * @details Verifies that the find_iterator correctly identifies an existing element.
 */
    BOOST_AUTO_TEST_CASE(successful_find_vector) {
        std::vector<int> vec = {1, 2, 3, 4, 5};
        auto result = overload_find(vec, 3);
        BOOST_CHECK(static_cast<bool>(result)); // Should be true
        BOOST_CHECK_EQUAL(*result, 3); // Dereferencing should give the found value
    }

/**
 * @brief Test unsuccessful find in a vector.
 * @details Checks that the find_iterator correctly handles the case where an element is not found.
 */
    BOOST_AUTO_TEST_CASE(unsuccessful_find_vector) {
        std::vector<int> vec = {1, 2, 3, 4, 5};
        auto result = overload_find(vec, 6);
        BOOST_CHECK(!static_cast<bool>(result)); // Should be false
    }

/**
 * @brief Test successful find in a map.
 * @details Ensures that the find_iterator works with associative containers like std::map.
 */
    BOOST_AUTO_TEST_CASE(successful_find_map) {
        std::map<std::string, int> map = {{"one", 1}, {"two", 2}, {"three", 3}};
        auto result = find(map, std::string("two"));
        BOOST_CHECK(static_cast<bool>(result)); // Should be true
        BOOST_CHECK_EQUAL(result->second, 2); // Check the value associated with the key
    }

/**
 * @brief Test unsuccessful find in a map.
 * @details Verifies correct behavior when a key is not found in a map.
 */
    BOOST_AUTO_TEST_CASE(unsuccessful_find_map) {
        std::map<std::string, int> map = {{"one", 1}, {"two", 2}, {"three", 3}};
        auto result = find(map, std::string("four"));
        BOOST_CHECK(!static_cast<bool>(result)); // Should be false
    }

/**
 * @brief Test find with an empty container.
 * @details Checks that find_iterator correctly handles empty containers.
 */
    BOOST_AUTO_TEST_CASE(find_in_empty_container) {
        std::vector<int> vec;
        auto result = overload_find(vec, 1);
        BOOST_CHECK(!static_cast<bool>(result)); // Should be false
    }

/**
 * @brief Test the edge case of finding the last element.
 * @details Ensures that finding the last element in a container works as expected.
 */
    BOOST_AUTO_TEST_CASE(find_last_element) {
        std::vector<int> vec = {1, 2, 3, 4, 5};
        auto result = overload_find(vec, 5);
        BOOST_CHECK(static_cast<bool>(result)); // Should be true
        BOOST_CHECK_EQUAL(*result, 5); // Dereferencing should give the found value
    }

/**
 * @brief Test the edge case of finding the first element.
 * @details Verifies that finding the first element in a container is handled correctly.
 */
    BOOST_AUTO_TEST_CASE(find_first_element) {
        std::vector<int> vec = {1, 2, 3, 4, 5};
        auto result = overload_find(vec, 1);
        BOOST_CHECK(static_cast<bool>(result)); // Should be true
        BOOST_CHECK_EQUAL(*result, 1); // Dereferencing should give the found value
    }

BOOST_AUTO_TEST_SUITE_END()