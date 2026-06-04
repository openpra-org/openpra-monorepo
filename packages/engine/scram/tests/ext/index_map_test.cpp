#include <boost/test/unit_test.hpp>
#include <ext/index_map.h>

BOOST_AUTO_TEST_SUITE(index_map_suite)

/**
 * @brief Tests construction and basic element access of index_map.
 * @details Verifies that an index_map can be constructed with an initializer list and
 * that elements can be accessed using a shifted index based on the specified base index.
 */
    BOOST_AUTO_TEST_CASE(basic_functionality) {
        ext::index_map<1, int> map{0, 1, 2, 3, 4}; // Initialize with a list
        // Access elements with shifted index
        BOOST_CHECK_EQUAL(map[1], 0); // Access with base index + 0
        BOOST_CHECK_EQUAL(map[2], 1); // Access with base index + 1
        BOOST_CHECK_EQUAL(map[5], 4); // Access with base index + 4
    }

/**
 * @brief Tests out-of-range access behavior of index_map.
 * @details Checks that accessing the index_map with an index below the base index
 * results in undefined behavior but does not throw an exception. This behavior is
 * consistent with standard library containers which do not check bounds in release builds.
 */
    BOOST_AUTO_TEST_CASE(out_of_range_access) {
        ext::index_map<1, int> map{0, 1, 2, 3, 4};
        // Accessing with an index of 0 is out-of-range since base index is 1
        BOOST_CHECK_NO_THROW(map[0]); // Undefined behavior, but should not throw
    }

/**
 * @brief Tests modification of elements in index_map.
 * @details Verifies that elements within the index_map can be modified using their
 * shifted index and that these modifications are correctly reflected in the map.
 */
    BOOST_AUTO_TEST_CASE(element_modification) {
        ext::index_map<1, int> map{0, 1, 2, 3, 4};
        // Modify elements
        map[1] = 10; // Modify element at base index + 0
        map[5] = 40; // Modify element at base index + 4
        BOOST_CHECK_EQUAL(map[1], 10);
        BOOST_CHECK_EQUAL(map[5], 40);
    }

/**
 * @brief Tests functionality of index_map with different base indices.
 * @details Ensures that the index_map operates correctly with various base indices,
 * including non-trivial cases like high positive values. Demonstrates the flexibility
 * and limitations of the index_map's design regarding base index choices.
 */
    BOOST_AUTO_TEST_CASE(different_base_indices) {
        ext::index_map<100, int> map_high_base{0, 1, 2, 3, 4};
        BOOST_CHECK_EQUAL(map_high_base[100], 0); // Access with high base index + 0
        BOOST_CHECK_EQUAL(map_high_base[104], 4); // Access with high base index + 4
        // Negative base indices are not supported due to the use of std::size_t for indexing
    }

/**
 * @brief Tests copy and move semantics of index_map.
 * @details Verifies that index_map can be copied and moved correctly, ensuring that
 * the state of the underlying container is preserved across such operations. This test
 * is crucial for understanding how index_map behaves in operations that require copying
 * or moving, such as passing by value or returning from a function.
 */
    BOOST_AUTO_TEST_CASE(copy_and_move_semantics) {
        ext::index_map<1, int> original_map{0, 1, 2, 3, 4};
        // Test copy constructor
        ext::index_map<1, int> copied_map = original_map;
        BOOST_CHECK_EQUAL(copied_map[1], 0);
        BOOST_CHECK_EQUAL(copied_map[5], 4);
        // Test move constructor
        ext::index_map<1, int> moved_map = std::move(original_map);
        BOOST_CHECK_EQUAL(moved_map[1], 0);
        BOOST_CHECK_EQUAL(moved_map[5], 4);
    }

BOOST_AUTO_TEST_SUITE_END()