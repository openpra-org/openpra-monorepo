set(Boost_USE_STATIC_LIBS OFF)

set(TEST_MEF_SOURCES
        test_mef.cpp
        alignment_test.cpp
        ccf_group_test.cpp
        expression_test.cpp
)

# Locate the Boost library for unit testing
find_package(Boost REQUIRED COMPONENTS unit_test_framework)

# Include directories for the test
include_directories(${Boost_INCLUDE_DIRS})
include_directories("../../src")

add_definitions(-DBOOST_TEST_DYN_LINK)

# Add the test executable
add_executable(test_mef ${TEST_MEF_SOURCES})

# Link against the Boost Test library and the project's settings library
target_link_libraries(test_mef
        ${Boost_UNIT_TEST_FRAMEWORK_LIBRARY}
        scram
)

# Enable testing with CTest
enable_testing()
add_test(NAME MefTest COMMAND test_mef)