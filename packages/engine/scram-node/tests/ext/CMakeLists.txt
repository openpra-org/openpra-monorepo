set(Boost_USE_STATIC_LIBS OFF)

set(TEST_EXT_SOURCES
        test_ext.cpp
        algorithm_test.cpp
        combination_test.cpp
        find_iterator_test.cpp
        float_compare_test.cpp
        index_map_test.cpp
        linear_map_test.cpp
        linear_set_test.cpp
        multi_index_test.cpp
)

# Locate the Boost library for unit testing
find_package(_boost)

# Include directories for the test
include_directories(${Boost_INCLUDE_DIRS})
include_directories("../../src")

# Add the test executable
add_executable(test_ext ${TEST_EXT_SOURCES})

# Link against the Boost Test library and the project's scram library
target_link_libraries(test_ext
        ${Boost_UNIT_TEST_FRAMEWORK_LIBRARY}
        scram
)

target_compile_definitions(test_ext PUBLIC BOOST_TEST_DYN_LINK)

# Enable testing with CTest
enable_testing()
add_test(NAME ExtTest COMMAND test_ext)
