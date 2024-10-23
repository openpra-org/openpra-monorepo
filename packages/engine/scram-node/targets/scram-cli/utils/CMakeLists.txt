set(CMAKE_INCLUDE_CURRENT_DIR ON)

set(SCRAM_CLI_UTILS_HEADERS
        ConstructOptions.h
        ConstructSettings.h
        Logger.h
        ParseArguments.h
        RunScram.h
)

set(SCRAM_CLI_UTILS_LIB_SOURCES
        stub_scram-cli-utils.cpp
)

if (NOT TARGET scram-cli-utils)
    # Create utils
    add_library(scram-cli-utils STATIC ${SCRAM_CLI_UTILS_HEADERS} ${SCRAM_CLI_UTILS_LIB_SOURCES})
    target_include_directories(scram-cli-utils PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
endif ()

# Link utils against Boost libraries
target_link_libraries(scram-cli-utils scram ${LIBS})