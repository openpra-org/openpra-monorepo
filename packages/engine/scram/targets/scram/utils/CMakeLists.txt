set(CMAKE_INCLUDE_CURRENT_DIR ON)

set(SCRAM_CLI_UTILS_HEADERS
        ConstructOptions.h
        ConstructSettings.h
        XmlLogger.h
        ParseArguments.h
        RunScram.h
)

if (NOT TARGET scram-cli-utils)
    # Create header-only interface library since all functions are inline
    add_library(scram-cli-utils INTERFACE)
    target_include_directories(scram-cli-utils INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})
endif ()

# Link utils against Boost libraries
target_link_libraries(scram-cli-utils INTERFACE scram ${LIBS})
