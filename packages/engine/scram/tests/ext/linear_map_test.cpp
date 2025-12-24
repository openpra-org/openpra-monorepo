#include <boost/test/unit_test.hpp>
#include <string>
#include <vector>
#include "ext/linear_map.h"

using namespace ext;

/**
 * @brief Test suite for the linear_map class.
 * @details This suite tests the linear_map class for its construction, insertion, access, erasure, and iteration functionalities, ensuring that it behaves as expected in various scenarios.
 */
BOOST_AUTO_TEST_SUITE(linear_map_suite)

/**
 * @brief Tests default construction and emptiness of a linear_map.
 * @details Checks if a linear_map that is default constructed is indeed empty, as expected. This test verifies the initial state of the map.
 */
    BOOST_AUTO_TEST_CASE(default_construction) {
        linear_map<int, std::string> map;
        BOOST_CHECK(map.empty());
    }

/**
 * @brief Tests construction of a linear_map with an initializer list.
 * @details Ensures that a linear_map constructed with an initializer list contains all the specified elements, verifying that the initializer list constructor works correctly.
 */
    BOOST_AUTO_TEST_CASE(initializer_list_construction) {
        linear_map<int, std::string> map{{1, "one"}, {2, "two"}};
        BOOST_CHECK_EQUAL(map.size(), 2);
        BOOST_CHECK_EQUAL(map.at(1), "one");
        BOOST_CHECK_EQUAL(map.at(2), "two");
    }

/**
 * @brief Tests insertion of elements into a linear_map and checks the size.
 * @details Checks if elements are correctly inserted into the map and if the size of the map is updated accordingly. Also tests the behavior when attempting to insert a duplicate key.
 */
    BOOST_AUTO_TEST_CASE(insertion_and_size) {
        linear_map<int, std::string> map;
        auto [it, inserted] = map.insert({3, "three"});
        BOOST_CHECK(inserted);
        BOOST_CHECK_EQUAL(map.size(), 1);
        BOOST_CHECK_EQUAL(it->second, "three");

        // Test insertion of a duplicate key
        auto result = map.insert({3, "tres"});
        BOOST_CHECK(!result.second); // Should not insert
        BOOST_CHECK_EQUAL(map.size(), 1); // Size should remain unchanged
    }

/**
 * @brief Tests access operators of a linear_map.
 * @details Checks if the subscript operator and at() method provide correct access to the elements and throw exceptions as expected when accessing non-existent keys.
 */
    BOOST_AUTO_TEST_CASE(access_operators) {
        linear_map<int, std::string> map{{1, "one"}};
        BOOST_CHECK_EQUAL(map[1], "one");

        map[2] = "two"; // Test non-const subscript operator for insertion
        BOOST_CHECK_EQUAL(map.at(2), "two");

        // Test at() with a non-existent key
        BOOST_CHECK_THROW(map.at(3), std::out_of_range);
    }

/**
 * @brief Tests erasure of elements from a linear_map by key and by iterator.
 * @details Ensures that elements can be erased using both a key and an iterator, and checks the size of the map after erasure to ensure it is updated correctly.
 */
    BOOST_AUTO_TEST_CASE(erasure) {
        linear_map<int, std::string> map{{1, "one"}, {2, "two"}, {3, "three"}};
        size_t erased = map.erase(2);
        BOOST_CHECK_EQUAL(erased, 1);
        BOOST_CHECK_EQUAL(map.size(), 2);
        BOOST_CHECK_THROW(map.at(2), std::out_of_range);

        // Erase using an iterator
        auto it = map.find(1);
        map.erase(it);
        BOOST_CHECK_EQUAL(map.size(), 1);
        BOOST_CHECK_THROW(map.at(1), std::out_of_range);
    }

/**
 * @brief Tests iteration over a linear_map.
 * @details Checks if iterators can be used to iterate over the map and access elements, ensuring that the map supports standard iteration mechanisms.
 */
    BOOST_AUTO_TEST_CASE(iteration) {
        linear_map<int, std::string> map{{1, "one"}, {2, "two"}};
        std::vector<int> keys;
        for (const auto& pair : map) {
            keys.push_back(pair.first);
        }
        BOOST_CHECK_EQUAL(keys.size(), 2);
        BOOST_CHECK(std::find(keys.begin(), keys.end(), 1) != keys.end());
        BOOST_CHECK(std::find(keys.begin(), keys.end(), 2) != keys.end());
    }

BOOST_AUTO_TEST_SUITE_END()