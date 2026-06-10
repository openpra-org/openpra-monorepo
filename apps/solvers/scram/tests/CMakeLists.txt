add_executable(scram-boolean-test scram_boolean_test.cpp)

target_link_libraries(scram-boolean-test
        PRIVATE scram-boolean scram Catch2::Catch2WithMain)

target_include_directories(scram-boolean-test
        PRIVATE ${CMAKE_SOURCE_DIR}/targets/scram-boolean)

catch_discover_tests(scram-boolean-test)
