set(CMAKE_INCLUDE_CURRENT_DIR ON)

cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

add_definitions(-DNAPI_VERSION=9)
set(CMAKE_EXPORT_COMPILE_COMMANDS 1)
find_package(NodeAddonApi)
include_directories(${CMAKE_JS_INC})

set(SCRAM_NODE_SRC
    src/AsyncScramWorker.cpp
    src/ScramWorker.cpp
    src/InitModule.cpp
)

set(SCRAM_NODE_HEADERS
    src/ScramWorker.h
    src/RunScramCli.h
    src/AsyncScramWorker.h
    src/AsyncRunScramCli.h
)


add_library(scram-node SHARED ${SCRAM_NODE_SRC})
set_target_properties(scram-node PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(scram-node scram scram-cli-utils ${LIBS} ${CMAKE_JS_LIB})
target_include_directories(scram-node PRIVATE ${CMAKE_JS_INC})


if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
   execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()

# Define a variable for the installation base directory
set(INSTALL_BASE_DIR "$ENV{HOME}/.local")

# Install share directory files to ~/.local/share
install(
        DIRECTORY ${CMAKE_SOURCE_DIR}/share/
        DESTINATION ${INSTALL_BASE_DIR}/share/scram
        FILES_MATCHING PATTERN "*.rng"
)

install(
        TARGETS scram-node
        LIBRARY DESTINATION ${INSTALL_BASE_DIR}/lib/scram
        ARCHIVE DESTINATION ${INSTALL_BASE_DIR}/lib/scram/static
        RUNTIME DESTINATION ${INSTALL_BASE_DIR}/bin
        COMPONENT scram-node
)