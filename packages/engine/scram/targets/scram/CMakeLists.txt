add_subdirectory(utils)

set(CMAKE_INCLUDE_CURRENT_DIR ON)

####################### Begin SCRAM CLI config ##################### {{{

set(SCRAM_CLI_SOURCES
        main.cpp
)

# Define a variable for the installation base directory
# Standard installation directories are provided by GNUInstallDirs; no custom base dir needed.

if (NOT TARGET scram-cli)
    add_executable(scram-cli ${SCRAM_CLI_SOURCES})
endif ()

target_link_libraries(scram-cli scram-cli-utils scram)

# Install the executable to ~/.local/bin
install(
        TARGETS scram-cli
        RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
        COMPONENT scram-cli
)

####################### End SCRAM CLI config ##################### }}}
