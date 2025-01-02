add_subdirectory(utils)

set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM CLI config ##################### {{{

set(SCRAM_CLI_SOURCES
        main.cpp
)

# Define a variable for the installation base directory
set(INSTALL_BASE_DIR "$ENV{HOME}/.local")

if (NOT TARGET scram-cli)
    add_executable(scram-cli ${SCRAM_CLI_SOURCES})
endif ()


#set_target_properties(scram-cli PROPERTIES
#    INSTALL_RPATH "${INSTALL_BASE_DIR}/lib/scram"
#    BUILD_WITH_INSTALL_RPATH TRUE
#    OUTPUT_NAME scram-cli
#)
target_link_libraries(scram-cli scram-cli-utils scram ${Boost_LIBRARIES})
#target_compile_options(scram-cli PRIVATE $<$<CONFIG:DEBUG>:${SCRAM_CXX_FLAGS_DEBUG}>)

# Install the executable to ~/.local/bin
install(
        TARGETS scram-cli
        RUNTIME DESTINATION ${INSTALL_BASE_DIR}/bin
        COMPONENT scram-cli
)

install(
        TARGETS scram-cli
        RUNTIME DESTINATION ${CMAKE_SOURCE_DIR}/../../../node_modules/.bin
        COMPONENT scram-cli
)

# Install share directory files to ~/.local/share
install(
        DIRECTORY ${CMAKE_SOURCE_DIR}/share/
        DESTINATION ${INSTALL_BASE_DIR}/share/scram
        FILES_MATCHING PATTERN "*.rng"
)
####################### End SCRAM CLI config ##################### }}}
