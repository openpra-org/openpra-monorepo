set(Boost_USE_STATIC_LIBS OFF)

set(TEST_CORE_SOURCES
        test_core.cpp
        settings_test.cpp
)

# Locate the Boost library for unit testing
find_package(Boost REQUIRED COMPONENTS unit_test_framework)

# Include directories for the test
include_directories(${Boost_INCLUDE_DIRS})
include_directories("../../src")

add_definitions(-DBOOST_TEST_DYN_LINK)

# Add the test executable
add_executable(test_core ${TEST_CORE_SOURCES})

# Link against the Boost Test library and the project's settings library
target_link_libraries(test_core
        ${Boost_UNIT_TEST_FRAMEWORK_LIBRARY}
        scram
)

# Enable testing with CTest
enable_testing()
add_test(NAME CoreTest COMMAND test_core)
